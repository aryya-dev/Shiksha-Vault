-- ============================================================================
-- INCREASE STORAGE BUCKET FILE SIZE LIMIT TO 500 MB (OR UNLIMITED)
-- Migration: 25_set_storage_limit_500mb.sql
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hgsfflqydnnhghfvfmrc/sql/new
-- ============================================================================

-- 1. Update course-materials bucket size limit to 500 MB (524,288,000 bytes)
-- or set to NULL if you want no bucket-level limit (project level limit applies)
update storage.buckets
set 
  file_size_limit = 524288000, -- 500 MB limit
  allowed_mime_types = array[
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/webm',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
where id = 'course-materials';

-- 2. Verify the updated bucket configuration
select 
  id, 
  name, 
  public, 
  file_size_limit,
  round(file_size_limit / (1024 * 1024)) as limit_mb,
  allowed_mime_types 
from storage.buckets 
where id = 'course-materials';
