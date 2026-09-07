-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - BATCHES (CLASSES 7 TO 10)
-- Migration: 09_insert_all_batches_7_to_10.sql
-- Run this in your Supabase SQL Editor to insert all batches serially (Classes 7-10)
-- ============================================================================

-- Ensure columns exist
alter table public.batches add column if not exists class_name text;
alter table public.batches add column if not exists board text;

-- Insert all 20 batches serially from Class 7 to Class 10
insert into public.batches (name, class_name, board)
values
  -- CLASS 7
  ('7 CBSE', '7', 'CBSE'),
  ('7 ICSE A', '7', 'ICSE'),
  ('7 ICSE B', '7', 'ICSE'),
  ('7 ICSE C', '7', 'ICSE'),

  -- CLASS 8
  ('8 CBSE', '8', 'CBSE'),
  ('8 ICSE A', '8', 'ICSE'),
  ('8 ICSE B', '8', 'ICSE'),
  ('8 ICSE C', '8', 'ICSE'),
  ('8 ICSE D', '8', 'ICSE'),

  -- CLASS 9
  ('9 CBSE A', '9', 'CBSE'),
  ('9 ICSE A', '9', 'ICSE'),
  ('9 ICSE C', '9', 'ICSE'),
  ('9 ICSE D', '9', 'ICSE'),
  ('9 ICSE E', '9', 'ICSE'),

  -- CLASS 10
  ('10 CBSE A', '10', 'CBSE'),
  ('10 CBSE B', '10', 'CBSE'),
  ('10 ICSE A', '10', 'ICSE'),
  ('10 ICSE B', '10', 'ICSE'),
  ('10 ICSE C', '10', 'ICSE'),
  ('10 ICSE D', '10', 'ICSE')
on conflict do nothing;

-- Map all existing subjects to all newly created batches
insert into public.batch_subjects (batch_id, subject_id)
select b.id, s.id
from public.batches b
cross join public.subjects s
on conflict do nothing;
