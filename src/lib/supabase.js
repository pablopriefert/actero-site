import { createClient } from '@supabase/supabase-js'

// Save the initial URL state BEFORE createClient() consumes the hash fragment
// This is critical for invite/recovery flows where tokens arrive via hash
export const INITIAL_URL = {
  hash: window.location.hash,
  search: window.location.search,
  path: window.location.pathname,
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Actero] CRITICAL: Supabase credentials missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Check your .env file.')
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
)
