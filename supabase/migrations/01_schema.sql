-- ============================================================================
-- SHIKSHARTHI EDUCATIONAL INSTITUTE - DATABASE SCHEMA
-- Migration: 01_schema.sql
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. CORE ACADEMIC ENTITIES
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "2026 - Class 12 - Science"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- Physics, Chemistry, Mathematics, Biology, Computer Science
  slug text unique not null,          -- 'physics', 'chemistry', etc.
  color text default '#FFB300',       -- Hex code for subject spine / badge
  created_at timestamptz default now()
);

-- Which subjects a BATCH offers (the superset available to that batch)
create table if not exists batch_subjects (
  batch_id uuid references batches(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  primary key (batch_id, subject_id)
);

-- 3. USER ROLES & PROFILES

-- Admin accounts (Staff/Faculty)
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin', -- 'super_admin', 'admin', 'content_admin'
  created_at timestamptz default now()
);

-- Student accounts (1:1 with Supabase Auth users)
create table if not exists students (
  id uuid primary key references auth.users(id) on delete cascade,
  student_code text unique not null,  -- e.g. "SH2026-114", used as login identifier
  full_name text not null,
  batch_id uuid references batches(id) on delete set null,
  is_active boolean default true,     -- Deactivated students cannot read content
  must_change_password boolean default true, -- Force password update on first login
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Specific subjects each student takes (allows individual customization per batch)
create table if not exists student_subjects (
  student_id uuid references students(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (student_id, subject_id)
);

-- 4. CONTENT & DOCUMENTS HIERARCHY

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  name text not null,                 -- "Classwork", "PYQs", "Specimen Papers", or custom
  parent_folder_id uuid references folders(id) on delete cascade, -- null = root level in subject
  sort_order int not null default 0,  -- For drag-and-drop order in UI
  created_by uuid references admins(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted boolean default false    -- Soft delete: hide instantly from students
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references folders(id) on delete cascade,
  name text not null,                 -- Display name of the document
  storage_path text not null,         -- Path inside Supabase Storage bucket
  version int not null default 1,     -- Increment on file replacement
  uploaded_by uuid references admins(id) on delete set null,
  file_size_bytes bigint,
  file_type text default 'application/pdf',
  uploaded_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted boolean default false    -- Soft delete
);

-- 5. AUDIT & ACCESS LOGS
create table if not exists access_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  file_id uuid references files(id) on delete cascade,
  event_type text not null,          -- 'view_file', 'screenshot_attempt', 'screen_record_detected'
  ip_address text,
  user_agent text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6. INDEXES FOR HIGH-CONCURRENCY SCALE (500+ students)
create index if not exists idx_students_student_code on students(student_code);
create index if not exists idx_students_batch_id on students(batch_id);
create index if not exists idx_students_is_active on students(is_active);
create index if not exists idx_student_subjects_student on student_subjects(student_id);
create index if not exists idx_student_subjects_subject on student_subjects(subject_id);
create index if not exists idx_folders_subject on folders(subject_id);
create index if not exists idx_folders_parent on folders(parent_folder_id);
create index if not exists idx_folders_deleted on folders(is_deleted);
create index if not exists idx_files_folder on files(folder_id);
create index if not exists idx_files_deleted on files(is_deleted);
create index if not exists idx_access_logs_student on access_logs(student_id);
create index if not exists idx_access_logs_file on access_logs(file_id);
