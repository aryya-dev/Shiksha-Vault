-- ============================================================================
-- SHIKSHA VAULT - PUBLIC APP RELEASE BUCKET
-- Migration: 15_create_public_app_release_bucket.sql
-- Enables direct public internet download of the Android APK for students
-- ============================================================================

-- 1. Create or update public bucket for APK distribution
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-release',
  'app-release',
  true, -- PUBLIC bucket: anyone with the URL can download
  157286400, -- 150 MB limit
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 157286400,
  allowed_mime_types = array[
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'application/x-zip-compressed'
  ];

-- 2. Storage Policies for Public Download
drop policy if exists "public_apk_download" on storage.objects;
create policy "public_apk_download"
  on storage.objects for select
  using (bucket_id = 'app-release');

-- 3. Storage Policies for Admin Upload
drop policy if exists "admin_apk_upload" on storage.objects;
create policy "admin_apk_upload"
  on storage.objects for insert
  with check (bucket_id = 'app-release');

drop policy if exists "admin_apk_update" on storage.objects;
create policy "admin_apk_update"
  on storage.objects for update
  using (bucket_id = 'app-release')
  with check (bucket_id = 'app-release');

drop policy if exists "admin_apk_delete" on storage.objects;
create policy "admin_apk_delete"
  on storage.objects for delete
  using (bucket_id = 'app-release');
