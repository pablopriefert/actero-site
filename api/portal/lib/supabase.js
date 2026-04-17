import { createClient } from '@supabase/supabase-js';
let cached;
export function getServiceRoleClient() {
  if (cached) return cached;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
