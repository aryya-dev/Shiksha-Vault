-- ============================================================================
-- MIGRATION 23: ALLOW STUDENTS TO READ SECONDARY BATCHES
-- File: supabase/migrations/23_allow_students_read_secondary_batches.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- Update batches RLS read policy so students can access both their primary batch
-- and any secondary batches they are enrolled in (e.g. Foundation Batch).
drop policy if exists "batches_read_policy" on public.batches;

create policy "batches_read_policy"
  on public.batches for select
  using (
    public.is_admin() 
    or (
      public.is_active_student() and (
        id in (select batch_id from public.students where id = auth.uid())
        or id in (select batch_id from public.student_batches where student_id = auth.uid())
      )
    )
  );
