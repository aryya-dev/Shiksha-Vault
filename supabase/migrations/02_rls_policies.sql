-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 02_rls_policies.sql
-- ============================================================================

-- 1. ENABLE RLS ON ALL TABLES
alter table batches enable row level security;
alter table subjects enable row level security;
alter table batch_subjects enable row level security;
alter table admins enable row level security;
alter table students enable row level security;
alter table student_subjects enable row level security;
alter table folders enable row level security;
alter table files enable row level security;
alter table access_logs enable row level security;

-- 2. HELPER FUNCTIONS
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.admins
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;

create or replace function public.is_active_student()
returns boolean as $$
begin
  return exists (
    select 1 from public.students
    where id = auth.uid() and is_active = true
  );
end;
$$ language plpgsql security definer stable;

-- 3. ADMINS TABLE POLICIES
drop policy if exists "admins_view_policy" on admins;
create policy "admins_view_policy"
  on admins for select
  using (is_admin() or id = auth.uid());

drop policy if exists "admins_manage_policy" on admins;
create policy "admins_manage_policy"
  on admins for all
  using (is_admin())
  with check (is_admin());

-- 4. BATCHES & BATCH_SUBJECTS POLICIES
drop policy if exists "batches_read_policy" on batches;
create policy "batches_read_policy"
  on batches for select
  using (
    is_admin() 
    or (is_active_student() and id in (
      select batch_id from students where id = auth.uid()
    ))
  );

drop policy if exists "batches_admin_write" on batches;
create policy "batches_admin_write"
  on batches for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "batch_subjects_read_policy" on batch_subjects;
create policy "batch_subjects_read_policy"
  on batch_subjects for select
  using (is_admin() or is_active_student());

drop policy if exists "batch_subjects_admin_write" on batch_subjects;
create policy "batch_subjects_admin_write"
  on batch_subjects for all
  using (is_admin())
  with check (is_admin());

-- 5. SUBJECTS POLICIES
drop policy if exists "subjects_read_policy" on subjects;
create policy "subjects_read_policy"
  on subjects for select
  using (
    is_admin()
    or (
      is_active_student()
      and id in (
        select subject_id from student_subjects where student_id = auth.uid()
      )
    )
  );

drop policy if exists "subjects_admin_write" on subjects;
create policy "subjects_admin_write"
  on subjects for all
  using (is_admin())
  with check (is_admin());

-- 6. STUDENTS TABLE POLICIES
drop policy if exists "students_read_policy" on students;
create policy "students_read_policy"
  on students for select
  using (id = auth.uid() or is_admin());

drop policy if exists "students_update_self" on students;
create policy "students_update_self"
  on students for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "students_admin_all" on students;
create policy "students_admin_all"
  on students for all
  using (is_admin())
  with check (is_admin());

-- 7. STUDENT_SUBJECTS POLICIES
drop policy if exists "student_subjects_read_policy" on student_subjects;
create policy "student_subjects_read_policy"
  on student_subjects for select
  using (
    (student_id = auth.uid() and is_active_student()) 
    or is_admin()
  );

drop policy if exists "student_subjects_admin_all" on student_subjects;
create policy "student_subjects_admin_all"
  on student_subjects for all
  using (is_admin())
  with check (is_admin());

-- 8. FOLDERS POLICIES
drop policy if exists "folders_read_policy" on folders;
create policy "folders_read_policy"
  on folders for select
  using (
    is_admin()
    or (
      is_deleted = false
      and is_active_student()
      and subject_id in (
        select subject_id from student_subjects where student_id = auth.uid()
      )
    )
  );

drop policy if exists "folders_admin_insert" on folders;
create policy "folders_admin_insert"
  on folders for insert
  with check (is_admin());

drop policy if exists "folders_admin_update" on folders;
create policy "folders_admin_update"
  on folders for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "folders_admin_delete" on folders;
create policy "folders_admin_delete"
  on folders for delete
  using (is_admin());

-- 9. FILES POLICIES
drop policy if exists "files_read_policy" on files;
create policy "files_read_policy"
  on files for select
  using (
    is_admin()
    or (
      is_deleted = false
      and is_active_student()
      and folder_id in (
        select f.id from folders f
        join student_subjects ss on ss.subject_id = f.subject_id
        where ss.student_id = auth.uid() and f.is_deleted = false
      )
    )
  );

drop policy if exists "files_admin_insert" on files;
create policy "files_admin_insert"
  on files for insert
  with check (is_admin());

drop policy if exists "files_admin_update" on files;
create policy "files_admin_update"
  on files for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "files_admin_delete" on files;
create policy "files_admin_delete"
  on files for delete
  using (is_admin());

-- 10. ACCESS LOGS POLICIES
drop policy if exists "access_logs_insert_policy" on access_logs;
create policy "access_logs_insert_policy"
  on access_logs for insert
  with check (auth.uid() = student_id or is_admin());

drop policy if exists "access_logs_read_policy" on access_logs;
create policy "access_logs_read_policy"
  on access_logs for select
  using (is_admin());
