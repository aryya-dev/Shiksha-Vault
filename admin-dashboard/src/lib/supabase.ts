import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co').trim()
// Clean any accidental /rest/v1 or trailing slashes
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key').trim()

export const isSupabaseConfigured = () => {
  return (
    supabaseUrl &&
    supabaseUrl !== 'https://placeholder-project.supabase.co' &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'placeholder-anon-key'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

