-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - BATCH & CLASS SCOPED CONTENT HIERARCHY
-- Migration: 06_batch_content_hierarchy.sql
-- ============================================================================

-- 1. ADD CLASS_NAME TO BATCHES TABLE (For grouping e.g. "Class 12", "Class 11", "Droppers")
alter table public.batches 
add column if not exists class_name text default 'Class 12';

-- 2. ADD BATCH_ID TO FOLDERS TABLE
alter table public.folders 
add column if not exists batch_id uuid references public.batches(id) on delete cascade;

-- Create index for fast batch-folder lookups
create index if not exists idx_folders_batch_id on public.folders(batch_id);

-- 3. UPDATE RLS POLICIES FOR FOLDERS (STUDENT SEES ONLY THEIR BATCH & ENROLLED SUBJECTS)
drop policy if exists "folders_read_policy" on public.folders;

create policy "folders_read_policy"
  on public.folders for select
  using (
    is_admin()
    or (
      is_deleted = false
      and is_active_student()
      -- Must match the student's assigned batch
      and (
        batch_id is null 
        or batch_id = (select batch_id from public.students where id = auth.uid())
      )
      -- Must be enrolled in this subject
      and subject_id in (
        select subject_id from public.student_subjects where student_id = auth.uid()
      )
    )
  );

-- 4. UPDATE RLS POLICIES FOR FILES (INHERITED THROUGH BATCH-SCOPED FOLDERS)
drop policy if exists "files_read_policy" on public.files;

create policy "files_read_policy"
  on public.files for select
  using (
    is_admin()
    or (
      is_deleted = false
      and is_active_student()
      and folder_id in (
        select f.id from public.folders f
        join public.student_subjects ss on ss.subject_id = f.subject_id
        join public.students s on s.id = ss.student_id
        where ss.student_id = auth.uid()
          and (f.batch_id is null or f.batch_id = s.batch_id)
          and f.is_deleted = false
      )
    )
  );

-- 5. UPDATE STORAGE RLS POLICIES
drop policy if exists "enrolled_students_storage_read" on storage.objects;

create policy "enrolled_students_storage_read"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and (
      exists (select 1 from public.admins where id = auth.uid())
      or
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
