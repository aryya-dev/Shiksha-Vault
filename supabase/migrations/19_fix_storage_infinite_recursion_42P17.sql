-- ============================================================================
-- FIX STORAGE 503 "DOCUMENT SERVER IS BUSY" / POSTGRES 42P17 RLS RECURSION
-- Migration: 19_fix_storage_infinite_recursion_42P17.sql
-- Run this in your Supabase SQL Editor to immediately fix PDF viewing in the app.
-- ============================================================================

-- 1. FIX INFINITE RECURSION ON public.admins TABLE (Error 42P17)
-- Previous policy had "exists (select 1 from public.admins ...)" inside a policy ON public.admins.
drop policy if exists "admins_view_policy" on public.admins;
drop policy if exists "admins_manage_policy" on public.admins;

-- Non-recursive select policy: Authenticated users can view admin profiles without circular lookups
create policy "admins_view_policy"
  on public.admins for select
  to authenticated
  using (true);

-- 2. Ensure is_admin() is strictly SECURITY DEFINER (bypasses RLS during evaluation)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.admins
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;

create policy "admins_manage_policy"
  on public.admins for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. High-Performance, Zero-Recursion File Access Validator for Storage
-- Uses SECURITY DEFINER so storage requests never hit circular RLS checks
create or replace function public.can_access_storage_file(file_path text)
returns boolean as $$
begin
  -- 1. Admins and service_role have full access
  if public.is_admin() or auth.role() = 'service_role' then
    return true;
  end if;

  -- 2. Active students enrolled in the matching batch & subject
  return exists (
    select 1 from public.files f
    join public.folders fl on fl.id = f.folder_id
    join public.student_subjects ss on ss.subject_id = fl.subject_id
    join public.students s on s.id = ss.student_id
    where f.storage_path = file_path
      and ss.student_id = auth.uid()
      and s.is_active = true
      and (fl.batch_id is null or fl.batch_id = s.batch_id)
      and f.is_deleted = false
      and fl.is_deleted = false
  );
end;
$$ language plpgsql security definer stable;

grant execute on function public.can_access_storage_file(text) to authenticated, anon, service_role;

-- 4. Clean Storage Read Policy for Course Materials
drop policy if exists "enrolled_students_storage_read" on storage.objects;
drop policy if exists "storage_course_materials_select" on storage.objects;

create policy "enrolled_students_storage_read"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and public.can_access_storage_file(storage.objects.name)
  );

-- 5. Force reload PostgREST and Storage API schema caches
notify pgrst, 'reload schema';
