/**
 * Shared admin authentication helpers.
 *
 * Usage:
 *   const adminUser = await requireAdmin(req, res, supabase);
 *   if (!adminUser) return; // response already sent
 *
 *   // OR, when you already have a user object (from supabase.auth.getUser):
 *   const isAdmin = await isActeroAdmin(user, supabase);
 *
 * SECURITY: Never check admin status by email string (e.g.
 * user.email?.endsWith('@actero.fr')). Supabase invites, SSO flows and
 * unverified sign-ups can produce such an email without any server-side
 * vetting — that string is user-influenced. Always use one of:
 *   - user.app_metadata.role === 'admin' (server-only field)
 *   - row in public.profiles with role = 'admin'
 *   - row in public.admin_users
 */

/**
 * Check whether an authenticated user is an Actero admin.
 * Mirrors the resolution order of `requireAdmin`.
 */
export async function isActeroAdmin(user, supabase) {
  if (!user) return false;
  if (user.app_metadata?.role === 'admin') return true;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'admin') return true;
  } catch {}

  try {
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminRow) return true;
  } catch {}

  return false;
}


export async function requireAdmin(req, res, supabase) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  // 1) App metadata role (authoritative, set via supabase admin API)
  if (user.app_metadata?.role === 'admin') return user;

  // 2) profiles.role = 'admin' (profiles.id = auth user id)
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'admin') return user;
  } catch {}

  // 3) admin_users table membership
  try {
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminRow) return user;
  } catch {}

  res.status(403).json({ error: 'Admin access required' });
  return null;
}
