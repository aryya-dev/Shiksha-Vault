-- ============================================================================
-- FIX SUPABASE AUTH 500 "Database error querying schema"
-- Migration: 12_fix_auth_500_error.sql
-- Run this in your Supabase SQL Editor to immediately fix the 500 login error.
-- ============================================================================

-- 1. Grant necessary permissions to supabase_auth_admin
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all tables in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all routines in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 2. Fix GoTrue string scan error: Replace NULL token columns with empty strings ('')
update auth.users
set 
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  recovery_token = coalesce(recovery_token, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  aud = coalesce(aud, 'authenticated'),
  role = coalesce(role, 'authenticated')
where 
  confirmation_token is null 
  or email_change is null 
  or email_change_token_new is null 
  or recovery_token is null;
