# Shiksharthi Educational Institute — App Specification

**Version:** 1.0
**Purpose:** Handoff document for the development team. Covers architecture, database, security, and design for the student content-delivery app and the admin dashboard.

---

## 1. Project overview

A permissioned document-delivery system for Shiksharthi Educational Institute.

- **Students** log in with an ID and password (issued by admins, no self-signup) and see only the subjects they are enrolled in. Within each subject they see folders (Classwork, PYQs, Specimen Papers, and any others admins create later) and the files inside.
- **Admins** manage batches, subjects, student enrollment (per-student, not just per-batch — a student may skip subjects their batch otherwise offers), and upload/organize content.
- **Scale target:** 500+ students at launch, growing over time.
- **Core constraint:** access must be enforced by the database, not just hidden in the UI — a student must not be able to reach another subject's files even by tampering with the app or calling the API directly.
- **Secondary constraint:** minimize casual leaking of PDFs (screenshots, screen recording, forwarding raw files) and make any leak traceable back to the student who caused it. This cannot be made 100% leak-proof (a photo of the screen with a second device can never be blocked) — the goal is deterrence and traceability, not an unbreakable vault. Set this expectation with the institute's admins/faculty up front.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend / DB / Auth / Storage | **Supabase** (Postgres + Auth + Storage) | Client's chosen stack. Row Level Security (RLS) gives us database-enforced access control, not just app-side filtering. |
| Student mobile app | **Flutter** | Single codebase for Android + iOS. Mature `supabase_flutter` SDK. Good in-app PDF rendering support needed for the custom secure viewer. |
| Admin panel | **Web app** (React or Flutter Web), responsive | Admins upload content and manage students from a desk, not a phone. A tablet-friendly web dashboard is more practical than a native admin app. |

---

## 3. System architecture (overview)

```
                         ┌─────────────────────┐
                         │   Supabase Auth      │  ← admin provisions each
                         │ (email/ID + password)│    student login (no self-signup)
                         └──────────┬───────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                     Supabase Postgres                  │
        │  students / batches / subjects / student_subjects /    │
        │  folders / files  — all protected by RLS policies      │
        └──────────┬─────────────────────────────┬───────────────┘
                    │                             │
        ┌───────────▼───────────┐     ┌───────────▼───────────┐
        │   Flutter student app  │     │   Admin web dashboard  │
        │ (Android + iOS)        │     │ (upload, enroll, CSV)  │
        │ - subject list         │     └─────────────────────────┘
        │ - folder browser       │
        │ - secure PDF viewer     │←──── Supabase Storage (private
        │   (FLAG_SECURE / blur)  │      buckets, storage policies
        └─────────────────────────┘      mirror the DB RLS rules)
```

Students and admins both authenticate through Supabase Auth, but only admins have a role that allows writing to `students`, `folders`, `files`, etc. Everything a student can see is filtered live by RLS at the database layer.

---

## 4. Database schema

Run as SQL migrations in Supabase. Comments explain intent so the team can adapt without losing the design reasoning.

```sql
-- ========== CORE ENTITIES ==========

create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "2026 - Class 12 - Science"
  created_at timestamptz default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- Physics, Chemistry, Mathematics, Biology, Computer Science
  slug text unique not null           -- 'physics', 'chemistry', etc. — used for stable color/icon mapping in the app
);

-- Which subjects a BATCH offers (the superset available to that batch)
create table batch_subjects (
  batch_id uuid references batches(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  primary key (batch_id, subject_id)
);

-- One row per student, linked 1:1 to a Supabase Auth user
create table students (
  id uuid primary key references auth.users(id) on delete cascade,
  student_code text unique not null,  -- e.g. "SH2026-114", used as the login ID
  full_name text not null,
  batch_id uuid references batches(id),
  is_active boolean default true,     -- admins can deactivate without deleting history
  created_at timestamptz default now()
);

-- Which subjects THIS student actually studies (subset of their batch's subjects)
-- This is the table that solves the "not all students in a batch take all subjects" problem.
create table student_subjects (
  student_id uuid references students(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  primary key (student_id, subject_id)
);

-- ========== ADMIN ROLES ==========
-- Separate from students so a compromised student account can never gain admin rights.
create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin'  -- room to grow: 'super_admin', 'content_admin', etc.
);

-- ========== CONTENT ==========

create table folders (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  name text not null,                 -- "Classwork", "PYQs", "Specimen Papers", or admin-created
  parent_folder_id uuid references folders(id) on delete cascade, -- null = top-level folder
  sort_order int not null default 0,  -- lets admins reorder folders in the UI (drag-and-drop)
  created_by uuid references admins(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted boolean default false    -- soft delete: hide from students instantly, let admins undo/audit before a hard delete job cleans up storage
);

create table files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references folders(id) on delete cascade,
  name text not null,
  storage_path text not null,         -- path inside the Supabase Storage bucket
  version int not null default 1,     -- bumped when an admin replaces a file with a corrected copy
  uploaded_by uuid references admins(id),
  file_size_bytes bigint,
  uploaded_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted boolean default false
);

```

---

## 5. Row Level Security (RLS) — the actual access-control enforcement

**This is the most important section in this document.** Enable RLS on every table above (`alter table X enable row level security;`) and add policies like these. Test policies with raw SQL/API calls *before* building any UI on top.

```sql
alter table students enable row level security;
alter table student_subjects enable row level security;
alter table folders enable row level security;
alter table files enable row level security;

-- Helper: is the current logged-in user an admin?
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admins where id = auth.uid());
$$ language sql security definer stable;

-- Students can read their own row only
create policy "students read own row"
  on students for select
  using (id = auth.uid() or is_admin());

-- Students can read their own subject enrollments only
create policy "students read own subjects"
  on student_subjects for select
  using (student_id = auth.uid() or is_admin());

-- A folder is visible if:
--   (a) the current user is an admin, OR
--   (b) it isn't soft-deleted AND its subject_id is one the current student is enrolled in
create policy "folders visible if enrolled"
  on folders for select
  using (
    is_admin()
    or (
      is_deleted = false
      and subject_id in (
        select subject_id from student_subjects where student_id = auth.uid()
      )
    )
  );

-- Same rule for files, joined through their folder's subject
create policy "files visible if enrolled"
  on files for select
  using (
    is_admin()
    or (
      is_deleted = false
      and folder_id in (
        select f.id from folders f
        join student_subjects ss on ss.subject_id = f.subject_id
        where ss.student_id = auth.uid() and f.is_deleted = false
      )
    )
  );

-- Only admins may write (insert/update/delete) to content tables.
-- Split into explicit operations so the admin dashboard's create/rename/reorder/
-- soft-delete/replace-file actions all map to a clear, auditable policy.
create policy "only admins insert folders"
  on folders for insert
  with check (is_admin());

create policy "only admins update folders"
  on folders for update
  using (is_admin()) with check (is_admin());
  -- covers: rename, reorder (sort_order), move (parent_folder_id), soft delete (is_deleted)

create policy "only admins delete folders"
  on folders for delete
  using (is_admin());
  -- reserved for the hard-delete cleanup job; the admin UI itself should only ever soft-delete

create policy "only admins insert files"
  on files for insert
  with check (is_admin());

create policy "only admins update files"
  on files for update
  using (is_admin()) with check (is_admin());
  -- covers: rename, move between folders, replace (bump version), soft delete

create policy "only admins delete files"
  on files for delete
  using (is_admin());
```

**Why this matters:** these rules run inside Postgres on every query, regardless of what the app sends. Even if someone reverse-engineers the API calls or edits the app, the database itself refuses to return rows the student isn't entitled to. Do not rely on hiding subjects in the UI alone.

---

## 6. Storage structure & policies

- Use a **private** Supabase Storage bucket (not public). Never generate long-lived public URLs for files.
- Suggested path convention: `{subject_slug}/{folder_id}/{file_id}-v{version}-{filename}` — including `version` in the path means replacing a file uploads a new object rather than overwriting the old one, so a botched replace is always recoverable from the previous version.
- Mirror the same enrollment logic as RLS above using **Storage policies** (Supabase supports SQL-style policies on `storage.objects`), so a direct storage request is checked the same way a database query is.
- Serve files to the app via **short-lived signed URLs** generated per request, not permanent links. A signed URL should expire quickly (a few minutes) since it's only meant to load one page in the in-app viewer.

---

## 7. Auth & account provisioning flow

1. Students **never self-register.** An admin creates each account via the admin dashboard, which calls Supabase's admin API to create an Auth user (email or a synthetic address built from the student code) with a generated password.
2. The student's `student_code` becomes their login ID; the institute distributes the code + initial password physically (printed slip, etc.) — do not email/SMS raw passwords if avoidable.
3. Force a password change on first login.
4. Admins can reset a student's password or deactivate (`is_active = false`) a student at any time — deactivation should be checked at login and also enforced via RLS (`is_active = true` in the student-read policy) so an old device session can't keep working after deactivation.
5. Admin accounts are provisioned separately and manually (not self-serve) — this is a small, trusted list of institute staff.

---

## 8. Anti-leak / content protection requirements

**Set expectations clearly with the institute:** this raises the bar significantly against casual leaking (screenshot → WhatsApp forward) and makes any leak traceable, but it cannot stop someone photographing the screen with a second device. No app, anywhere, can prevent that.

### Required behaviors

1. **Never expose raw PDF files to the OS.** Do not let students download a file or open it in the system's default PDF viewer / Google Drive / Adobe app. Render pages inside a **custom in-app viewer only**, ideally as rendered images/canvas rather than a native embeddable PDF control.
2. **Android:** apply `FLAG_SECURE` to the viewer's window. This blocks screenshots and screen recording at the OS level and blacks the app out in the recent-apps switcher. Add root detection and refuse to render content on rooted devices, since `FLAG_SECURE` can sometimes be bypassed there.
3. **iOS:** Apple does not allow blocking screenshots. Instead:
   - Listen for `UIScreen.capturedDidChangeNotification` (screen recording start) and instantly blur/hide the content.
   - Listen for `userDidTakeScreenshotNotification` and log the event (student ID + file + timestamp) even though the screenshot itself can't be prevented.
4. **Dynamic watermark on every page**, tiled and semi-transparent: student name + student code + timestamp. This doesn't stop a screenshot but makes any leaked page traceable to the student.
5. **No text selection, copy, print, or share options** in the custom viewer.
6. **No offline caching of complete files.** Fetch content per-session via short-lived signed URLs (see §6); don't persist full documents to device storage.
7. **Log and flag suspicious access patterns** — e.g., a student rapidly opening and re-opening every page in a folder in one sitting.
8. Skip paid PDF-DRM SDKs (Vitrium, Locklizard, etc.) for now — the combination above gives strong protection at a fraction of the cost/complexity, appropriate for internal coaching-institute material.

---

## 9. Design system

### 9.1 Theme

**Dark UI on both Android and iOS**, black base with a yellow/orange accent family.

| Token | Hex | Use |
|---|---|---|
| `bg-page` | `#0E0E10` | App background |
| `surface-card` | `#1A1A1D` | Cards, list rows, panels |
| `surface-raised` | `#222226` | Modals, sheets, elevated elements |
| `border` | `#2E2E32` | Default hairline |
| `border-strong` | `#3A3A3F` | Emphasized divider |
| `text-primary` | `#F5F4F0` | Body text (off-white, not pure white) |
| `text-secondary` | `#A3A29C` | Supporting text |
| `text-muted` | `#6B6A65` | Placeholders, captions, hints |
| `accent-primary` (brand) | `#FFB300` (amber) | Primary buttons, active tab/nav item, links, focus rings |
| `accent-secondary` | `#FF6A1F` (orange) | Warnings, secondary highlights, "new" badges |
| `success` | `#2ECC71` | Upload confirmations, success toasts |
| `danger` | `#FF4D4D` | Errors, destructive actions |

Only **one** accent-primary action per screen (e.g. one amber button) — everything else stays neutral gray, so the accent keeps its weight.

### 9.2 Subject color-coding (kept as a functional device, not decoration)

Distinct from the brand accent on purpose, so "this is a Physics file" is never confused with "this is a primary action":

| Subject | Hex |
|---|---|
| Physics | `#5B8DEF` (blue) |
| Chemistry | `#2FD4A5` (teal) |
| Mathematics | `#8B7CF6` (violet) |
| Biology | `#4CD97A` (green) |
| Computer Science | `#FF6FA8` (pink) |

Used as a thin left-edge spine on subject rows and as small badges in the admin roster — never as a full-card background wash.

### 9.3 Typography

- Single family across the product: **IBM Plex Sans** (technical, highly legible at small sizes, fits STEM subject matter). Vary weight/size for hierarchy rather than mixing in a second display face.
- Two weights only: regular (400) and medium (500). Avoid heavier weights — they read harsh against a dark background.
- Body text: 16px / line-height 1.6. Left-aligned throughout; this is a scanning tool, not a marketing page.

### 9.4 Layout principles

- **List-first, not card-grid.** Subject list, folder list, and file list are all dense rows, not large illustrated cards.
- **The reader view is the quietest screen in the app** — just the page, the watermark, and a page counter. No color, no nav chrome, nothing competing with the content.
- **Admin dashboard favors density over polish** — tables and bulk actions, since staff will use it daily for hundreds of students.
- Empty states are instructional, in the interface's voice: e.g. "No files yet — your teacher hasn't added anything for Chemistry," not a generic illustration.
- Copy is plain and direct: sentence case, active voice, no filler ("Upload files," not "Please upload your files here").

---

## 10. Screen inventory

### Student app
1. **Login** — student code + password, forced change on first login.
2. **Home / subject list** — only enrolled subjects, color-spined rows, file counts.
3. **Folder browser** — Classwork / PYQs / Specimen Papers / admin-created folders, nested if needed.
4. **File list** — dense rows: icon, name, date.
5. **Secure viewer** — watermarked, FLAG_SECURE (Android) / blur-on-record (iOS), page counter only.

### Admin dashboard
1. **Login** (separate, trusted account list).
2. **Batch & subject management** — create/edit batches, define which subjects a batch offers.
3. **Student roster** — list with subject badges per student, search, bulk CSV import, edit/reset password/deactivate per student.
4. **Content manager** — the admin's full file/folder management surface, per subject:
   - **Folders:** create (top-level or nested under an existing folder), rename, reorder via drag-and-drop (`sort_order`), move to a different parent, soft-delete (immediately hidden from students, recoverable), and a separate "empty trash" action that hard-deletes and clears the underlying storage.
   - **Files:** upload single files or bulk-upload multiple at once into a folder, rename, move to a different folder, **replace** a file with a corrected version (bumps `version`, keeps the same `id` so any existing links/references stay valid), soft-delete, and hard-delete from the trash view.
   - **Bulk actions:** select multiple files/folders to move or delete together — important once a subject accumulates hundreds of files across batches.
   - **Trash / recycle view:** lists soft-deleted items with a restore button, so an accidental delete doesn't require a database rollback.
5. **(Later)** access logs — who viewed/attempted-to-capture what, and when.

---

## 11. Build order (recommended milestones)

1. **Schema + RLS first.** Stand up the tables and policies above, and verify access control with raw SQL/API calls before any UI exists. This is the foundation everything else depends on.
2. **Admin web dashboard** — batches, subjects, student CRUD + CSV import, folder/file upload. This is what makes the system operable day-to-day, even before the student app exists.
3. **Flutter student app** — login → subject list → folder browser → file list → secure viewer (basic version, watermark + FLAG_SECURE first; iOS blur-on-record next).
4. **Hardening pass** — root detection, signed-URL expiry tuning, suspicious-access logging.
5. **Polish** — search, push notifications for new uploads, access logs in the admin dashboard.

---

## 12. Non-functional requirements

- **Scale:** design for 500+ students at launch; RLS policies above use indexed foreign keys (`student_id`, `subject_id`, `folder_id`) and should be checked with `explain analyze` once real data volume exists.
- **Offline behavior:** the app should degrade gracefully with no connection (clear "you're offline" state) rather than crash, given signed URLs expire and content isn't cached.
- **Accessibility:** maintain contrast against the dark background per the token table above; don't rely on subject color alone to convey meaning — always pair color with the subject name/label.

---

## 13. Open decisions for the team / institute to confirm

- Exact list of subjects beyond the five named (any electives?).
- Whether batches are per-year or persist across years (affects whether `batches` needs a year/term field).
- Retention policy for access/attempt logs.
- Whether admin roles need finer granularity (e.g., a content-only admin who can't manage students) — schema in §4 already leaves room for this via `admins.role`.
