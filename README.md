# 🎓 Shiksharthi Educational Institute — Application Suite

A secure, permissioned document-delivery platform for coaching institutes.

---

## 📁 Repository Structure

```
Shiksha Vault/
├── shiksharthi-app-spec.md         # Master product & architecture specification
├── supabase/
│   └── migrations/
│       ├── 01_schema.sql           # Database schema & indexes
│       ├── 02_rls_policies.sql     # Database Row Level Security (RLS)
│       ├── 03_storage_policies.sql # Private storage bucket & access policies
│       └── 04_seed_data.sql        # Standard subjects & sample batches
├── admin-dashboard/                # Admin Web Dashboard (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/             # Sidebar, Header, Modals
│   │   ├── pages/                  # Students (CSV Import), Batches, Content, Trash, Logs
│   │   ├── lib/supabase.ts         # Supabase client connector
│   │   └── types/database.ts       # TypeScript database types
└── student-app/                    # Mobile Student App (Flutter for Android & iOS)
    ├── lib/
    │   ├── core/                   # Dark theme tokens, Supabase & Security services (FLAG_SECURE)
    │   ├── models/                 # Subject, Folder, FileItem, Student models
    │   └── screens/                # Login, Subjects, Folders, Secure Watermarked Viewer
```

---

## ⚡ Quick Setup Guide

### 1. Supabase Database & Storage Setup
1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Run the SQL files from `supabase/migrations/` in sequential order:
   - `01_schema.sql` (Creates tables, relations, and indexes)
   - `02_rls_policies.sql` (Enforces Row-Level Security for students and admins)
   - `03_storage_policies.sql` (Creates private `course-materials` bucket and access rules)
   - `04_seed_data.sql` (Seeds subjects with brand spine colors and sample batches)

### 2. Admin Web Dashboard
1. Create a `.env` file inside `admin-dashboard/`:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
2. Run the development server:
   ```bash
   cd admin-dashboard
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser. (The dashboard also includes a built-in interactive demo mode for testing UI flows).

### 3. Flutter Student App
1. Navigate to `student-app/`:
   ```bash
   cd student-app
   flutter pub get
   ```
2. Run with your Supabase credentials:
   ```bash
   flutter run --dart-define=SUPABASE_URL=https://<your-project-ref>.supabase.co --dart-define=SUPABASE_ANON_KEY=<your-anon-key>
   ```

---

## 🔒 Security Features Implemented
- **Database Row-Level Security (RLS)**: Access control is strictly enforced at the Postgres database layer. Students cannot query or receive rows for subjects they are not actively enrolled in.
- **FLAG_SECURE**: Hardware-level screenshot and screen-recording prevention on Android.
- **Dynamic Traceable Watermark**: Real-time canvas overlay rendering `Student Name | Student ID | Timestamp` diagonally across every page.
- **Private Storage**: PDFs are never public; loaded via 5-minute ephemeral signed URLs.
