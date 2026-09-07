-- ============================================================================
-- REMOVE "(Board)" DUPLICATES FROM SUBJECTS
-- Migration: 10_remove_board_subjects.sql
-- Run this in Supabase SQL Editor to clean up duplicate (Board) subjects.
-- ============================================================================

-- 1. Ensure clean subjects exist with correct colors and slugs
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

-- 2. Safely reassign any dependencies from (Board) subjects to clean subjects
do $$
declare
  board_sub record;
  target_id uuid;
begin
  for board_sub in 
    select id, name, slug 
    from public.subjects 
    where slug like '%-board' or name like '%(Board)%'
  loop
    -- Map each board subject to its clean equivalent
    if board_sub.slug like 'physics%' or board_sub.name like 'Physics%' then
      select id into target_id from public.subjects where slug = 'physics';
    elsif board_sub.slug like 'chemistry%' or board_sub.name like 'Chemistry%' then
      select id into target_id from public.subjects where slug = 'chemistry';
    elsif board_sub.slug like 'math%' or board_sub.name like 'Math%' then
      select id into target_id from public.subjects where slug = 'mathematics';
    elsif board_sub.slug like 'bio%' or board_sub.name like 'Bio%' then
      select id into target_id from public.subjects where slug = 'biology';
    elsif board_sub.slug like 'computer%' or board_sub.name like 'Computer%' then
      select id into target_id from public.subjects where slug = 'computer-science';
    else
      target_id := null;
    end if;

    if target_id is not null and target_id <> board_sub.id then
      -- Delete any existing conflict before updating
      delete from public.batch_subjects where subject_id = board_sub.id and batch_id in (
        select batch_id from public.batch_subjects where subject_id = target_id
      );
      update public.batch_subjects set subject_id = target_id where subject_id = board_sub.id;

      delete from public.student_subjects where subject_id = board_sub.id and student_id in (
        select student_id from public.student_subjects where subject_id = target_id
      );
      update public.student_subjects set subject_id = target_id where subject_id = board_sub.id;

      update public.folders set subject_id = target_id where subject_id = board_sub.id;
    end if;

    -- Delete the duplicate (Board) subject
    delete from public.batch_subjects where subject_id = board_sub.id;
    delete from public.student_subjects where subject_id = board_sub.id;
    delete from public.subjects where id = board_sub.id;
  end loop;
end $$;
