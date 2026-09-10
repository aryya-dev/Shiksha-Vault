-- ============================================================================
-- MIGRATION 21: FOUNDATION BATCH & REAL ADMIN PASSWORD RESET RPC
-- File: supabase/migrations/21_add_foundation_batch_and_admin_password_reset.sql
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. INSERT FOUNDATION SUBJECT WITH DEDICATED SLUG & COLOR
insert into public.subjects (name, slug, color)
values ('Foundation Batch', 'foundation-batch', '#FF9F1C')
on conflict (slug) do update set
  name = excluded.name,
  color = excluded.color;

-- 2. CREATE A DEDICATED CLASS 9 FOUNDATION BATCH FOR CONTENT ORGANIZATION
insert into public.batches (name, class_name, board)
values ('Class 9 - Foundation Batch', '9', 'Foundation')
on conflict do nothing;

-- 3. LINK FOUNDATION SUBJECT TO THE FOUNDATION BATCH
insert into public.batch_subjects (batch_id, subject_id)
select b.id, s.id
from public.batches b, public.subjects s
where b.name = 'Class 9 - Foundation Batch' and s.slug = 'foundation-batch'
on conflict do nothing;

-- ALSO LINK FOUNDATION SUBJECT TO ALL OTHER CLASS 9 BATCHES
insert into public.batch_subjects (batch_id, subject_id)
select b.id, s.id
from public.batches b, public.subjects s
where b.class_name = '9' and s.slug = 'foundation-batch'
on conflict do nothing;

-- 4. RPC FUNCTION: REAL ADMIN PASSWORD RESET FOR STUDENTS
-- Allows admins to reset any student's password in auth.users directly.
create or replace function public.admin_reset_student_password(
  p_student_id uuid,
  p_new_password text default 'Shiksha@123'
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_email text;
  v_student_code text;
  v_hashed_password text;
begin
  -- A. Ensure caller is an authenticated admin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can reset student credentials.';
  end if;

  -- B. Validate student existence
  select id, student_code, lower(trim(student_code)) || '@student.shiksharthi.in'
  into v_user_id, v_student_code, v_email
  from public.students
  where id = p_student_id;

  if v_user_id is null then
    raise exception 'Student record not found.';
  end if;

  -- C. Validate password length
  if length(p_new_password) < 6 then
    raise exception 'Password must be at least 6 characters long.';
  end if;

  -- D. Hash the password with bcrypt
  v_hashed_password := crypt(p_new_password, gen_salt('bf', 10));

  -- E. Update password in auth.users
  update auth.users
  set 
    encrypted_password = v_hashed_password,
    updated_at = now()
  where id = v_user_id;

  -- If auth user didn't exist yet, provision it now
  if not found then
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
      v_email,
      v_hashed_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('student_code', v_student_code),
      'authenticated',
      'authenticated',
      '', '', '', '', '', '', '',
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
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      null,
      now(),
      now()
    ) on conflict do nothing;
  end if;

  -- F. Mark student as must_change_password = true
  update public.students
  set 
    must_change_password = true,
    updated_at = now()
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Student password successfully reset',
    'student_code', v_student_code,
    'new_password', p_new_password
  );
end;
$$ language plpgsql security definer;

-- 5. Grant execute permission on RPC function to authenticated users (function checks is_admin internally)
grant execute on function public.admin_reset_student_password(uuid, text) to authenticated;

-- 6. Verification
select s.name as subject_name, s.slug, s.color, count(bs.batch_id) as linked_batches
from public.subjects s
left join public.batch_subjects bs on bs.subject_id = s.id
where s.slug = 'foundation-batch'
group by s.name, s.slug, s.color;
