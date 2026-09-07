-- ============================================================================
-- AUTO-PROVISION SUPABASE AUTH USER ON STUDENT CREATION (TRIGGER)
-- Migration: 13_auto_create_student_auth_trigger.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. TRIGGER FUNCTION: Automatically create auth.users & auth.identities
create or replace function public.handle_student_auto_auth()
returns trigger as $$
declare
  v_email text;
  v_hashed_password text;
  v_default_password text := 'Shiksha@123';
begin
  v_email := lower(trim(NEW.student_code)) || '@student.shiksharthi.in';
  v_hashed_password := crypt(v_default_password, gen_salt('bf', 10));

  -- If auth user doesn't already exist, create it
  if not exists (select 1 from auth.users where id = NEW.id or email = v_email) then
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
      NEW.id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      v_hashed_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('student_code', NEW.student_code, 'full_name', NEW.full_name),
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
      NEW.id,
      jsonb_build_object('sub', NEW.id::text, 'email', v_email),
      'email',
      v_email,
      now(),
      now(),
      now()
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 2. TRIGGER FUNCTION: Automatically remove auth user when student is deleted
create or replace function public.handle_student_delete_auth()
returns trigger as $$
declare
  v_email text;
begin
  v_email := lower(trim(OLD.student_code)) || '@student.shiksharthi.in';
  delete from auth.users where id = OLD.id or email = v_email;
  return OLD;
end;
$$ language plpgsql security definer;

-- 3. BIND TRIGGERS TO public.students
drop trigger if exists trg_student_auto_auth on public.students;
create trigger trg_student_auto_auth
  after insert on public.students
  for each row
  execute function public.handle_student_auto_auth();

drop trigger if exists trg_student_delete_auth on public.students;
create trigger trg_student_delete_auth
  after delete on public.students
  for each row
  execute function public.handle_student_delete_auth();

-- 4. ONE-TIME SYNC: Create auth accounts for any existing students missing auth
do $$
declare
  st record;
  s_email text;
  s_hash text;
begin
  s_hash := crypt('Shiksha@123', gen_salt('bf', 10));

  for st in select id, student_code, full_name from public.students
  loop
    s_email := lower(trim(st.student_code)) || '@student.shiksharthi.in';

    if not exists (select 1 from auth.users where id = st.id or email = s_email) then
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
        s_email,
        s_hash,
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
        jsonb_build_object('sub', st.id::text, 'email', s_email),
        'email',
        s_email,
        now(),
        now(),
        now()
      );
    end if;
  end loop;
end $$;
