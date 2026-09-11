-- ============================================================================
-- MIGRATION 24: FIX FOUNDATION FOLDERS AND PERMISSIONS
-- File: supabase/migrations/24_fix_foundation_folders_and_permissions.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure all folders in Foundation Batch have subject_id = null
update public.folders
set subject_id = null
where batch_id in (select id from public.batches where board = 'Foundation' or name ilike '%foundation%');

-- 2. Update folders_read_policy so Foundation batch folders are guaranteed accessible
drop policy if exists "folders_read_policy" on public.folders;

create policy "folders_read_policy"
  on public.folders for select
  using (
    public.is_admin()
    or (
      is_deleted = false
      and public.is_active_student()
      -- Must match primary batch or secondary batch
      and (
        batch_id is null 
        or batch_id = (select batch_id from public.students where id = auth.uid())
        or batch_id in (select batch_id from public.student_batches where student_id = auth.uid())
      )
      -- If folder has a subject, student must be enrolled in that subject
      -- If folder has NO subject or is in Foundation Batch, access is granted via batch match
      and (
        subject_id is null
        or batch_id in (select id from public.batches where board = 'Foundation' or name ilike '%foundation%')
        or subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
      )
    )
  );

-- 3. Update files_read_policy so Foundation batch files are guaranteed accessible
drop policy if exists "files_read_policy" on public.files;

create policy "files_read_policy"
  on public.files for select
  using (
    public.is_admin()
    or (
      is_deleted = false
      and public.is_active_student()
      and folder_id in (
        select f.id from public.folders f
        join public.students s on s.id = auth.uid()
        where s.id = auth.uid()
          and (
            f.batch_id is null 
            or f.batch_id = s.batch_id
            or f.batch_id in (select batch_id from public.student_batches where student_id = auth.uid())
          )
          and (
            f.subject_id is null
            or f.batch_id in (select id from public.batches where board = 'Foundation' or name ilike '%foundation%')
            or f.subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
          )
          and f.is_deleted = false
      )
    )
  );

-- 4. Update storage access validator function
create or replace function public.can_access_storage_file(file_path text)
returns boolean as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return true;
  end if;

  return exists (
    select 1 from public.files f
    join public.folders fl on fl.id = f.folder_id
    join public.students s on s.id = auth.uid()
    where f.storage_path = file_path
      and s.is_active = true
      and (
        fl.batch_id is null 
        or fl.batch_id = s.batch_id
        or fl.batch_id in (select batch_id from public.student_batches where student_id = auth.uid())
      )
      and (
        fl.subject_id is null
        or fl.batch_id in (select id from public.batches where board = 'Foundation' or name ilike '%foundation%')
        or fl.subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
      )
      and f.is_deleted = false
      and fl.is_deleted = false
  );
end;
$$ language plpgsql security definer stable;

grant execute on function public.can_access_storage_file(text) to authenticated, anon, service_role;
