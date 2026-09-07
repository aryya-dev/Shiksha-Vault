-- ============================================================================
-- AUTO-PROVISION ADMINISTRATORS & SELF-HEALING ADMIN CLAIM RPC
-- Migration: 16_auto_provision_admins.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure pgcrypto extension exists
create extension if not exists "pgcrypto";

-- 2. Insert any existing non-student auth users into public.admins
insert into public.admins (id, full_name, role)
select 
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1),
    'Administrator'
  ),
  'super_admin'
from auth.users u
where not (coalesce(u.email, '') like '%@student.shiksharthi.in')
  and u.id not in (select s.id from public.students s)
on conflict (id) do update set 
  role = 'super_admin';

-- 3. Self-healing RPC function: claim_admin_access
-- Automatically verifies and provisions admin access for faculty/staff
create or replace function public.claim_admin_access()
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select 
    email,
    coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'Staff Admin')
  into v_email, v_name
  from auth.users 
  where id = v_uid;

  -- Safety check: student accounts cannot claim admin privileges
  if (coalesce(v_email, '') like '%@student.shiksharthi.in') or exists (select 1 from public.students where id = v_uid) then
    return jsonb_build_object('success', false, 'error', 'Student accounts cannot claim administrative privileges');
  end if;

  -- Insert or update admin record with elevated privileges
  insert into public.admins (id, full_name, role)
  values (v_uid, v_name, 'super_admin')
  on conflict (id) do update set 
    full_name = coalesce(excluded.full_name, admins.full_name),
    role = 'super_admin';

  return jsonb_build_object('success', true, 'id', v_uid, 'role', 'super_admin');
end;
$$ language plpgsql security definer;

-- Grant execution to authenticated users
grant execute on function public.claim_admin_access() to authenticated, service_role;

-- 4. Automated Trigger: When a new non-student user registers or is created in auth.users
create or replace function public.handle_new_admin_user()
returns trigger as $$
begin
  if not (coalesce(NEW.email, '') like '%@student.shiksharthi.in') then
    insert into public.admins (id, full_name, role)
    values (
      NEW.id,
      coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Administrator'),
      'super_admin'
    )
    on conflict (id) do update set role = 'super_admin';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute function public.handle_new_admin_user();

-- 5. Refresh RLS Policy on public.admins
drop policy if exists "admins_view_policy" on public.admins;
create policy "admins_view_policy"
  on public.admins for select
  using (
    id = auth.uid() 
    or exists (select 1 from public.admins where id = auth.uid())
  );

drop policy if exists "admins_manage_policy" on public.admins;
create policy "admins_manage_policy"
  on public.admins for all
  using (
    exists (select 1 from public.admins where id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins where id = auth.uid())
  );
