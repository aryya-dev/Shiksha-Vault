-- ============================================================================
-- AUTO-CREATE SUPABASE AUTH ACCOUNTS FOR ALL SEEDED STUDENTS
-- Migration: 11_create_student_auth_users.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- 2. Grant permissions to supabase_auth_admin
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all tables in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all routines in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 3. Create or reset Auth accounts for all students in public.students
do $$
declare
  st record;
  student_email text;
  hashed_password text;
  default_pass text := 'Shiksha@123'; -- Default initial password for all students
begin
  -- Generate bcrypt hash for default password
  hashed_password := crypt(default_pass, gen_salt('bf', 10));

  for st in select id, student_code, full_name from public.students
  loop
    student_email := lower(trim(st.student_code)) || '@student.shiksharthi.in';

    -- Insert into auth.users if not already exists
    if not exists (select 1 from auth.users where id = st.id or email = student_email) then
      insert into auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        role,
        aud,
        confirmation_token,
        email_change,
        email_change_token_new,
        email_change_token_current,
        recovery_token,
        phone_change,
        phone_change_token,
        created_at,
        updated_at
      ) values (
        st.id,
        '00000000-0000-0000-0000-000000000000',
        student_email,
        hashed_password,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('student_code', st.student_code, 'full_name', st.full_name),
        'authenticated',
        'authenticated',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        now(),
        now()
      );

      -- Insert into auth.identities for GoTrue password auth
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        st.id,
        jsonb_build_object('sub', st.id::text, 'email', student_email),
        'email',
        student_email,
        now(),
        now(),
        now()
      );
    else
      -- If user already exists in auth, reset password and sanitize tokens to empty string
      update auth.users
      set encrypted_password = hashed_password,
          confirmation_token = coalesce(confirmation_token, ''),
          email_change = coalesce(email_change, ''),
          email_change_token_new = coalesce(email_change_token_new, ''),
          email_change_token_current = coalesce(email_change_token_current, ''),
          recovery_token = coalesce(recovery_token, ''),
          phone_change = coalesce(phone_change, ''),
          phone_change_token = coalesce(phone_change_token, ''),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          aud = coalesce(aud, 'authenticated'),
          role = coalesce(role, 'authenticated'),
          updated_at = now()
      where id = st.id or email = student_email;
    end if;

    -- Ensure must_change_password is true so they set their own password on first login
    update public.students
    set must_change_password = true
    where id = st.id;
  end loop;
end $$;

-- 4. HELPER FUNCTION: Admin can reset any student password easily
create or replace function public.admin_reset_student_password(
  p_student_code text,
  p_new_password text default 'Shiksha@123'
)
returns text as $$
declare
  v_student_id uuid;
  v_email text;
  v_hash text;
begin
  select id into v_student_id from public.students where student_code = p_student_code;
  if v_student_id is null then
    raise exception 'Student with code % not found', p_student_code;
  end if;

  v_email := lower(trim(p_student_code)) || '@student.shiksharthi.in';
  v_hash := crypt(p_new_password, gen_salt('bf', 10));

  update auth.users
  set encrypted_password = v_hash,
      confirmation_token = coalesce(confirmation_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      recovery_token = coalesce(recovery_token, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = v_student_id or email = v_email;

  update public.students
  set must_change_password = true,
      updated_at = now()
  where id = v_student_id;

  return 'Password for ' || p_student_code || ' successfully reset to ' || p_new_password;
end;
$$ language plpgsql security definer;
