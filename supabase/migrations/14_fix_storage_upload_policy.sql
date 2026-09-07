-- ============================================================================
-- FIX STORAGE UPLOAD & ACCESS POLICIES FOR COURSE MATERIALS
-- Migration: 14_fix_storage_upload_policy.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure course-materials bucket exists, is strictly private, and accepts PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  52428800, -- 50 MB limit
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  allowed_mime_types = array['application/pdf'];

-- 2. Grant permissions to roles on storage schema
grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on all tables in schema storage to postgres, anon, authenticated, service_role;

-- 3. Drop old policies
drop policy if exists "admins_storage_all" on storage.objects;
drop policy if exists "admin_storage_insert" on storage.objects;
drop policy if exists "admin_storage_update" on storage.objects;
drop policy if exists "admin_storage_delete" on storage.objects;
drop policy if exists "enrolled_students_storage_read" on storage.objects;
drop policy if exists "authenticated_storage_upload" on storage.objects;

-- 3. Allow Faculty / Admin Dashboard to upload and manage PDFs
create policy "admin_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'course-materials');

create policy "admin_storage_update"
  on storage.objects for update
  using (bucket_id = 'course-materials')
  with check (bucket_id = 'course-materials');

create policy "admin_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'course-materials');

-- 4. Allow Active Enrolled Students (and Admins) to read/download PDFs
create policy "enrolled_students_storage_read"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and (
      -- Admins or service role
      exists (select 1 from public.admins where id = auth.uid())
      or
      auth.role() = 'service_role'
      or
      -- Active enrolled students matching their assigned batch & subjects
      exists (
        select 1 from public.files f
        join public.folders fl on fl.id = f.folder_id
        join public.student_subjects ss on ss.subject_id = fl.subject_id
        join public.students s on s.id = ss.student_id
        where f.storage_path = storage.objects.name
          and ss.student_id = auth.uid()
          and s.is_active = true
          and (fl.batch_id is null or fl.batch_id = s.batch_id)
          and f.is_deleted = false
          and fl.is_deleted = false
      )
    )
  );
