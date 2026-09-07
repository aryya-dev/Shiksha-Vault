-- ============================================================================
-- EXPLICITLY GRANT ADMIN ACCESS TO PRIMARY STAFF & NON-STUDENT ACCOUNTS
-- Migration: 17_grant_admin_aryyabandyopadhyay.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Insert or update all non-student users into public.admins as super_admin
insert into public.admins (id, full_name, role)
select 
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Administrator'),
  'super_admin'
from auth.users u
where u.email = 'aryyabandyopadhyay10@gmail.com'
   or not (coalesce(u.email, '') like '%@student.shiksharthi.in')
on conflict (id) do update set 
  role = 'super_admin',
  full_name = coalesce(excluded.full_name, admins.full_name);

-- 2. Verify all non-student accounts are elevated
select a.id, a.full_name, a.role, u.email 
from public.admins a
join auth.users u on u.id = a.id;
