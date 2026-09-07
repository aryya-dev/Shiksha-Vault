-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - BATCHES, BOARDS & SUBJECTS SYNC
-- Migration: 07_institute_batches_and_subjects.sql
-- ============================================================================

-- 1. ADD BOARD & CLASS_NAME COLUMNS
alter table public.batches 
add column if not exists board text;

alter table public.students 
add column if not exists class_name text,
add column if not exists board text;

-- Allow flexible student onboarding (student record can exist before Auth user signs up)
alter table public.students alter column id set default gen_random_uuid();
alter table public.students drop constraint if exists students_id_fkey;

create index if not exists idx_students_class_name on public.students(class_name);
create index if not exists idx_students_board on public.students(board);
create index if not exists idx_batches_board on public.batches(board);

-- 2. UPSERT CLEAN INSTITUTE SUBJECTS
insert into public.subjects (name, slug, color)
values
  ('Physics', 'physics', '#5B8DEF'),
  ('Chemistry', 'chemistry', '#2FD4A5'),
  ('Mathematics', 'mathematics', '#8B7CF6'),
  ('Biology', 'biology', '#4CD97A'),
  ('Computer Science', 'computer-science', '#FF6FA8')
on conflict (slug) do update set
  name = excluded.name,
  color = excluded.color;
