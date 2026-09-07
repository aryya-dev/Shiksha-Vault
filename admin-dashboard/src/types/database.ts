export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Batch {
  id: string
  name: string
  class_name?: string
  board?: string
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  name: string
  slug: string
  color: string
  created_at: string
}

export interface BatchSubject {
  batch_id: string
  subject_id: string
}

export interface Student {
  id: string
  student_code: string
  full_name: string
  class_name?: string
  board?: string
  batch_id: string | null
  is_active: boolean
  must_change_password: boolean
  created_at: string
  updated_at: string
  batches?: Batch
  student_subjects?: { subject_id: string; subjects: Subject }[]
}

export interface Admin {
  id: string
  full_name: string
  role: 'super_admin' | 'admin' | 'content_admin'
  created_at: string
}

export interface Folder {
  id: string
  batch_id?: string | null
  subject_id: string
  name: string
  parent_folder_id: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  children?: Folder[]
  files_count?: number
}

export interface FileItem {
  id: string
  folder_id: string
  name: string
  storage_path: string
  version: number
  uploaded_by: string | null
  file_size_bytes: number | null
  file_type: string
  uploaded_at: string
  updated_at: string
  is_deleted: boolean
}

export interface AccessLog {
  id: string
  student_id: string
  file_id: string
  event_type: 'view_file' | 'screenshot_attempt' | 'screen_record_detected'
  ip_address: string | null
  user_agent: string | null
  metadata: Json
  created_at: string
}
