-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - STORAGE BUCKET & POLICIES
-- Migration: 03_storage_policies.sql
-- ============================================================================

-- 1. CREATE PRIVATE STORAGE BUCKET
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false, -- Strictly private bucket, no public URL access
  52428800, -- 50 MB limit per PDF
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  allowed_mime_types = array['application/pdf'];

-- 2. STORAGE POLICIES ON storage.objects

-- Clean up existing policies if re-running
drop policy if exists "admins_storage_all" on storage.objects;
drop policy if exists "enrolled_students_storage_read" on storage.objects;

-- Allow Admins full access to upload, update, read, and delete storage files
create policy "admins_storage_all"
  on storage.objects for all
  using (
    bucket_id = 'course-materials'
    and exists (select 1 from public.admins where id = auth.uid())
  )
  with check (
    bucket_id = 'course-materials'
    and exists (select 1 from public.admins where id = auth.uid())
  );

-- Allow Enrolled Active Students to read / generate signed URLs for course files
create policy "enrolled_students_storage_read"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and (
      -- Check admin
      exists (select 1 from public.admins where id = auth.uid())
      or
      -- Check enrolled student matching file record in database
      exists (
        select 1 from public.files f
        join public.folders fl on fl.id = f.folder_id
        join public.student_subjects ss on ss.subject_id = fl.subject_id
        join public.students s on s.id = ss.student_id
        where f.storage_path = storage.objects.name
          and ss.student_id = auth.uid()
          and s.is_active = true
          and f.is_deleted = false
          and fl.is_deleted = false
      )
    )
  );
