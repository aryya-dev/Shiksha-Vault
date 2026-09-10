-- ============================================================================
-- ALLOW MP4 VIDEOS, IMAGES, AND NESTED SUBFOLDER METADATA
-- Migration: 20_allow_media_types_and_nested_folders.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Update course-materials storage bucket to allow MP4 videos, images, and PDFs
update storage.buckets
set 
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
  ],
  file_size_limit = 524288000 -- 500 MB maximum for high-resolution video materials
where id = 'course-materials';

-- If course-materials bucket doesn't exist yet, insert with media support
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  524288000,
  array[
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
)
on conflict (id) do update set
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
  ],
  file_size_limit = 524288000;

-- 2. Ensure parent_folder_id index exists on folders for fast recursive subfolder lookups
create index if not exists idx_folders_parent_folder_id on public.folders(parent_folder_id);

-- 3. Verify bucket configuration
select id, name, public, file_size_limit, allowed_mime_types 
from storage.buckets 
where id = 'course-materials';
