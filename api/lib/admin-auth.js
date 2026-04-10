/**
 * Shared admin authentication helper.
 *
 * Usage:
 *   const adminUser = await requireAdmin(req, res, supabase);
 *   if (!adminUser) return; // response already sent
 */
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
