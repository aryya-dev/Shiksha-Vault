-- ============================================================================
-- STANDARDIZE STUDENT ID FORMAT AND SYNC SUPABASE AUTH ON CODE UPDATE
-- Migration: 28_update_student_id_format.sql
-- Format: [First 4 chars of name + First char of surname]_[Board + Class + Batch]_[Year]
-- Example: Aariz Molla, Class 9, Batch E, ICSE, 2026 => AARIM_I9E_2026
-- ============================================================================

-- 1. FUNCTION TO COMPUTE STANDARDIZED STUDENT CODE
create or replace function public.generate_student_code(
  p_full_name text,
  p_class_name text,
  p_board text,
  p_batch_name text,
  p_year text default '2026'
)
returns text as $$
declare
  v_clean_name text;
  v_words text[];
  v_name_part text := 'STUD';
  v_board_letter text := 'I';
  v_class_part text := '9';
  v_batch_letter text := '';
  v_middle_part text;
  v_year_part text;
  v_tokens text[];
  v_last_token text;
  v_first_word text;
  v_last_word text;
begin
  -- 1. Extract Name Part
  v_clean_name := trim(regexp_replace(coalesce(p_full_name, 'STUDENT'), '[^a-zA-Z\s]', '', 'g'));
  if length(v_clean_name) > 0 then
    v_words := regexp_split_to_array(v_clean_name, '\s+');
    if array_length(v_words, 1) = 1 then
      v_name_part := upper(substring(v_words[1] from 1 for 5));
    else
      v_first_word := upper(v_words[1]);
      v_last_word := upper(v_words[array_length(v_words, 1)]);
      v_name_part := substring(v_first_word from 1 for 4) || substring(v_last_word from 1 for 1);
    end if;
  end if;

  -- 2. Extract Board Letter
  if upper(coalesce(p_board, '')) like '%CBSE%' then
    v_board_letter := 'C';
  elsif upper(coalesce(p_board, '')) like '%ICSE%' then
    v_board_letter := 'I';
  elsif upper(coalesce(p_board, '')) like '%WBBSE%' then
    v_board_letter := 'W';
  elsif upper(coalesce(p_board, '')) like '%FOUNDATION%' then
    v_board_letter := 'F';
  elsif length(trim(coalesce(p_board, ''))) > 0 then
    v_board_letter := upper(substring(trim(p_board) from 1 for 1));
  else
    v_board_letter := 'I';
  end if;

  -- 3. Extract Class Number
  v_class_part := regexp_replace(coalesce(p_class_name, '9'), '[^0-9]', '', 'g');
  if length(v_class_part) = 0 then
    v_class_part := coalesce(trim(p_class_name), '9');
  end if;

  -- 4. Extract Batch Section Letter
  if p_batch_name is not null and length(trim(p_batch_name)) > 0 then
    v_tokens := regexp_split_to_array(trim(p_batch_name), '\s+');
    v_last_token := upper(v_tokens[array_length(v_tokens, 1)]);
    if length(v_last_token) = 1 and v_last_token ~ '^[A-Z]$' and v_last_token not in ('I', 'C', 'W') then
      v_batch_letter := v_last_token;
    end if;
  end if;

  -- Combine Middle Part & Year
  v_middle_part := upper(v_board_letter || v_class_part || v_batch_letter);
  v_year_part := trim(coalesce(p_year, '2026'));

  return upper(v_name_part || '_' || v_middle_part || '_' || v_year_part);
end;
$$ language plpgsql immutable;


-- 2. TRIGGER FUNCTION: SYNC SUPABASE AUTH USER & IDENTITY WHEN STUDENT CODE IS UPDATED
create or replace function public.handle_student_update_auth()
returns trigger as $$
declare
  v_new_email text;
  v_old_email text;
begin
  if NEW.student_code is distinct from OLD.student_code then
    v_new_email := lower(trim(NEW.student_code)) || '@student.shiksharthi.in';
    v_old_email := lower(trim(OLD.student_code)) || '@student.shiksharthi.in';

    -- Update auth.users email and metadata
    update auth.users
    set 
      email = v_new_email,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('student_code', NEW.student_code, 'full_name', NEW.full_name),
      updated_at = now()
    where id = NEW.id or email = v_old_email;

    -- Update auth.identities
    update auth.identities
    set
      identity_data = jsonb_build_object('sub', NEW.id::text, 'email', v_new_email),
      provider_id = v_new_email,
      updated_at = now()
    where user_id = NEW.id and provider = 'email';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Bind trigger to public.students
drop trigger if exists trg_student_update_auth on public.students;
create trigger trg_student_update_auth
  after update of student_code on public.students
  for each row
  execute function public.handle_student_update_auth();


-- 3. ADMIN RPC: BATCH MIGRATE ALL EXISTING STUDENTS TO NEW FORMAT
create or replace function public.admin_migrate_all_student_codes(p_year text default '2026')
returns table (
  student_id uuid,
  student_name text,
  old_code text,
  new_code text
) as $$
declare
  r record;
  v_candidate text;
  v_final_code text;
  v_counter integer;
begin
  for r in
    select 
      s.id,
      s.student_code as current_code,
      s.full_name,
      s.class_name,
      s.board,
      b.name as batch_name,
      b.class_name as b_class,
      b.board as b_board
    from public.students s
    left join public.batches b on b.id = s.batch_id
    order by s.created_at asc
  loop
    -- Generate new code using available student or batch metadata
    v_candidate := public.generate_student_code(
      r.full_name,
      coalesce(r.class_name, r.b_class, '9'),
      coalesce(r.board, r.b_board, 'ICSE'),
      r.batch_name,
      p_year
    );

    v_final_code := v_candidate;
    v_counter := 1;

    -- Collision handling: if this code is already taken by another student
    while exists (
      select 1 from public.students 
      where student_code = v_final_code and id <> r.id
    ) loop
      v_counter := v_counter + 1;
      -- e.g. AARIM2_I9E_2026
      v_final_code := replace(v_candidate, '_', v_counter::text || '_');
    end loop;

    -- Update student table (trg_student_update_auth will automatically update auth.users & identities)
    update public.students
    set student_code = v_final_code, updated_at = now()
    where id = r.id;

    student_id := r.id;
    student_name := r.full_name;
    old_code := r.current_code;
    new_code := v_final_code;
    return next;
  end loop;
end;
$$ language plpgsql security definer;


-- 4. ONE-TIME AUTO MIGRATE EXISTING STUDENTS (Immediately runs when this file is executed)
do $$
declare
  m record;
begin
  for m in select * from public.admin_migrate_all_student_codes('2026')
  loop
    raise notice 'Migrated student "%": % -> %', m.student_name, m.old_code, m.new_code;
  end loop;
end;
$$;
