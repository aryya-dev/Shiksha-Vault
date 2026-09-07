-- ============================================================================
-- FIX PERMISSIONS FOR SUPABASE AUTH SERVICE (GoTrue)
-- Migration: 05_fix_auth_permissions.sql
-- ============================================================================

-- Grant permissions on public schema to all Supabase roles including auth admin
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all tables in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant all on all routines in schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role, supabase_auth_admin;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role, supabase_auth_admin;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role, supabase_auth_admin;
