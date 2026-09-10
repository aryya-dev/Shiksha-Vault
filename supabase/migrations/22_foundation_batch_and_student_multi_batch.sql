-- ============================================================================
-- MIGRATION 22: FOUNDATION AS SECONDARY BATCH (NO SUBJECTS) & BATCH SWITCHING
-- File: supabase/migrations/22_foundation_batch_and_student_multi_batch.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MAKE SURE CLASS 9 FOUNDATION BATCH EXISTS
-- ----------------------------------------------------------------------------
insert into public.batches (name, class_name, board)
values ('Class 9 - Foundation Batch', '9', 'Foundation')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. REMOVE FOUNDATION FROM SUBJECTS TABLE & DETACH ALL SUBJECTS FROM FOUNDATION BATCH
-- User requirement: "dont need this subjects in foundation batch, also remove foundation as subject"
-- ----------------------------------------------------------------------------

-- Remove all subject links for Class 9 Foundation Batch
delete from public.batch_subjects
where batch_id in (select id from public.batches where name ilike '%Foundation Batch%');

-- Remove 'foundation-batch' from student_subjects if any were linked
delete from public.student_subjects
where subject_id in (select id from public.subjects where slug = 'foundation-batch');

-- Remove 'foundation-batch' from batch_subjects across all batches
delete from public.batch_subjects
where subject_id in (select id from public.subjects where slug = 'foundation-batch');

-- Remove 'foundation-batch' from subjects table
delete from public.subjects
where slug = 'foundation-batch';

-- ----------------------------------------------------------------------------
-- 3. ALLOW FOLDERS TO HAVE NULL subject_id (DIRECT BATCH FOLDERS)
-- Foundation batch folders are created directly under the batch without subjects
-- ----------------------------------------------------------------------------
alter table public.folders alter column subject_id drop not null;

-- ----------------------------------------------------------------------------
-- 4. CREATE student_batches TABLE (SECONDARY BATCHES)
-- Allows a student of Class 9 ICSE A to also be enrolled in Class 9 - Foundation Batch
-- ----------------------------------------------------------------------------
create table if not exists public.student_batches (
  student_id uuid references public.students(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (student_id, batch_id)
);

create index if not exists idx_student_batches_student on public.student_batches(student_id);
create index if not exists idx_student_batches_batch on public.student_batches(batch_id);

alter table public.student_batches enable row level security;

drop policy if exists "student_batches_read" on public.student_batches;
create policy "student_batches_read"
  on public.student_batches for select
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "student_batches_admin_all" on public.student_batches;
create policy "student_batches_admin_all"
  on public.student_batches for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.student_batches to authenticated;
grant all on public.student_batches to service_role;

-- ----------------------------------------------------------------------------
-- 5. UPDATE FOLDERS RLS POLICY (SUPPORTS DIRECT BATCH FOLDERS & SECONDARY BATCHES)
-- ----------------------------------------------------------------------------
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
      -- If folder has NO subject (e.g. direct Foundation Batch folder), access is granted via batch match
      and (
        subject_id is null
        or subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. UPDATE FILES RLS POLICY
-- ----------------------------------------------------------------------------
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
            or f.subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
          )
          and f.is_deleted = false
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. UPDATE STORAGE VALIDATOR FUNCTION (can_access_storage_file)
-- ----------------------------------------------------------------------------
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
        or fl.subject_id in (select subject_id from public.student_subjects where student_id = auth.uid())
      )
      and f.is_deleted = false
      and fl.is_deleted = false
  );
end;
$$ language plpgsql security definer stable;

grant execute on function public.can_access_storage_file(text) to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 8. VERIFY BATCHES & SUBJECTS STATE
-- ----------------------------------------------------------------------------
select b.name as batch_name, b.board, count(bs.subject_id) as assigned_subjects
from public.batches b
left join public.batch_subjects bs on bs.batch_id = b.id
where b.name ilike '%Foundation%'
group by b.name, b.board;
