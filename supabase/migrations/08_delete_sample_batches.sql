-- ============================================================================
-- CLEANUP MOCK / SEED BATCHES
-- Migration: 08_delete_sample_batches.sql
-- Run this in your Supabase SQL Editor if any sample batches exist in your DB.
-- ============================================================================

delete from public.batches 
where name in (
  '2026 - Class 12 - Science (PCM)',
  '2026 - Class 12 - Science (PCB)',
  '2026 - Class 11 - Foundation'
);
