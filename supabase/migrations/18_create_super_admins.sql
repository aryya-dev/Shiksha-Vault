-- ============================================================================
-- PROVISION SUPER ADMINISTRATORS (AUTH & ADMIN TABLE)
-- Migration: 18_create_super_admins.sql
-- Run this in your Supabase SQL Editor to provision all 3 super admins.
-- ============================================================================

-- 1. Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- 2. Grant permissions to supabase_auth_admin
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all tables in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all routines in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 3. Create or Update Auth Users & Public Admins
do $$
declare
  admin_rec record;
  v_user_id uuid;
  v_hashed_pw text;
begin
  -- Generate bcrypt hash for 'Admin@123'
  v_hashed_pw := crypt('Admin@123', gen_salt('bf', 10));

  for admin_rec in
    select * from (
      values 
        ('ghosh.priyanka2019@gmail.com', 'Priyanka Ma''am'),
        ('sahaarghya2017@gmail.com', 'Arghya Sir'),
        ('aryyabandyopadhyay10@gmail.com', 'Aryya bandyopadhyay')
    ) as t(email, name)
  loop
    -- Check if user already exists in auth.users
    select id into v_user_id from auth.users where email = admin_rec.email;

    if v_user_id is null then
      v_user_id := gen_random_uuid();

      -- Insert new user into auth.users
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
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        admin_rec.email,
        v_hashed_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', admin_rec.name),
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

      -- Insert into auth.identities
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
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', admin_rec.email),
        'email',
        admin_rec.email,
        now(),
        now(),
        now()
      );
    else
      -- Update existing user's password, metadata, and ensure email is confirmed
      update auth.users
      set 
        encrypted_password = v_hashed_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('full_name', admin_rec.name),
        confirmation_token = coalesce(confirmation_token, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        recovery_token = coalesce(recovery_token, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        aud = 'authenticated',
        role = 'authenticated',
        updated_at = now()
      where id = v_user_id;

      -- Ensure identity exists
      if not exists (select 1 from auth.identities where user_id = v_user_id) then
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
          v_user_id,
          jsonb_build_object('sub', v_user_id::text, 'email', admin_rec.email),
          'email',
          admin_rec.email,
          now(),
          now(),
          now()
        );
      end if;
    end if;

    -- Insert or update in public.admins
    insert into public.admins (id, full_name, role)
    values (v_user_id, admin_rec.name, 'super_admin')
    on conflict (id) do update set 
      full_name = admin_rec.name,
      role = 'super_admin';

  end loop;
end $$;

-- 4. Verification output: list all 3 super admins
select 
  a.id, 
  a.full_name, 
  a.role, 
  u.email, 
  u.email_confirmed_at 
from public.admins a
join auth.users u on u.id = a.id
where u.email in (
  'ghosh.priyanka2019@gmail.com',
  'sahaarghya2017@gmail.com',
  'aryyabandyopadhyay10@gmail.com'
);
