-- ============================================================================
-- GOOGLE DRIVE STORAGE INTEGRATION
-- Migration: 26_add_google_drive_storage_support.sql
-- Enables storing unlimited large files (videos, high-res PDFs) in Google Drive
-- while maintaining folder hierarchy, student batch security, and in-app streaming.
-- ============================================================================

-- 1. Add storage provider and gdrive_file_id columns to public.files
alter table public.files 
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists gdrive_file_id text;

-- 2. Add constraint to validate supported storage providers
alter table public.files 
  drop constraint if exists check_files_storage_provider;

alter table public.files 
  add constraint check_files_storage_provider 
  check (storage_provider in ('supabase', 'gdrive'));

-- 3. Create indexes for quick lookup
create index if not exists idx_files_storage_provider on public.files(storage_provider);
create index if not exists idx_files_gdrive_file_id on public.files(gdrive_file_id);

-- 4. Verify existing files default to 'supabase'
update public.files 
set storage_provider = 'supabase' 
where storage_provider is null;

-- 5. Helper function for verifying student file access (used by Edge Function and RLS)
create or replace function public.can_student_access_file(p_student_id uuid, p_file_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_has_access boolean;
begin
  select exists (
    select 1 
    from public.files f
    join public.folders fl on fl.id = f.folder_id
    join public.students s on s.id = p_student_id
    where f.id = p_file_id
      and f.is_deleted = false
      and fl.is_deleted = false
      and s.is_active = true
      and (
        -- Primary Batch match
        fl.batch_id = s.batch_id
        or
        -- Secondary Batch match
        exists (
          select 1 from public.student_secondary_batches ssb
          where ssb.student_id = p_student_id
            and ssb.batch_id = fl.batch_id
        )
      )
      and (
        -- Foundation or general batch (no subject requirement)
        fl.subject_id is null
        or
        -- Subject enrollment match
        exists (
          select 1 from public.student_subjects ss
          where ss.student_id = p_student_id
            and ss.subject_id = fl.subject_id
        )
      )
  ) into v_has_access;

  return coalesce(v_has_access, false);
end;
$$;
