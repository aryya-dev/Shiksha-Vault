-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - SEED DATA
-- Migration: 04_seed_data.sql
-- ============================================================================

-- 1. INSERT CORE SUBJECTS WITH STANDARD COLOR SPINES & SLUGS
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

-- 2. INSERT SAMPLE BATCHES
insert into public.batches (name)
values
  ('2026 - Class 12 - Science (PCM)'),
  ('2026 - Class 12 - Science (PCB)'),
  ('2026 - Class 11 - Foundation')
on conflict do nothing;

-- 3. LINK DEFAULT SUBJECTS TO BATCHES
do $$
declare
  batch_pcm_id uuid;
  batch_pcb_id uuid;
  sub_phys uuid;
  sub_chem uuid;
  sub_math uuid;
  sub_bio uuid;
  sub_cs uuid;
begin
  select id into batch_pcm_id from public.batches where name = '2026 - Class 12 - Science (PCM)' limit 1;
  select id into batch_pcb_id from public.batches where name = '2026 - Class 12 - Science (PCB)' limit 1;

  select id into sub_phys from public.subjects where slug = 'physics';
  select id into sub_chem from public.subjects where slug = 'chemistry';
  select id into sub_math from public.subjects where slug = 'mathematics';
  select id into sub_bio from public.subjects where slug = 'biology';
  select id into sub_cs from public.subjects where slug = 'computer-science';

  if batch_pcm_id is not null then
    insert into public.batch_subjects (batch_id, subject_id)
    values 
      (batch_pcm_id, sub_phys),
      (batch_pcm_id, sub_chem),
      (batch_pcm_id, sub_math),
      (batch_pcm_id, sub_cs)
    on conflict do nothing;
  end if;

  if batch_pcb_id is not null then
    insert into public.batch_subjects (batch_id, subject_id)
    values 
      (batch_pcb_id, sub_phys),
      (batch_pcb_id, sub_chem),
      (batch_pcb_id, sub_bio)
    on conflict do nothing;
  end if;
end $$;
