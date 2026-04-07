import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifie' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifie' });

  const { client_id, email, role } = req.body;
  if (!client_id || !email || !role) {
    return res.status(400).json({ error: 'client_id, email et role requis' });
  }

  // Verify caller is owner or admin of this client
  const { data: callerLink } = await supabase
    .from('client_users')
    .select('role')
    .eq('client_id', client_id)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: clientOwner } = await supabase
    .from('clients')
    .select('owner_user_id')
    .eq('id', client_id)
    .single();

  const isOwner = clientOwner?.owner_user_id === user.id;
  const isAdmin = callerLink?.role === 'owner' || callerLink?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Seuls les owners et admins peuvent inviter' });
  }

  try {
    // Check if email is already in the team
    const { data: existing } = await supabase
      .from('client_users')
      .select('user_id')
      .eq('client_id', client_id)
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Cet email est deja dans l\'equipe' });
    }

    // Try to find if user already exists in auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingUser = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Invite new user via Supabase Auth
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.SITE_URL || 'https://actero.fr'}/setup-password`,
        data: { client_id },
      });

      if (inviteError) {
        return res.status(500).json({ error: 'Erreur invitation: ' + inviteError.message });
      }
      userId = inviteData.user.id;
    }

    // Create the client_users entry with service role (bypasses RLS)
    const { error: linkError } = await supabase
      .from('client_users')
      .insert({
        client_id,
        user_id: userId,
        role,
        email,
        invited_at: new Date().toISOString(),
      });

    if (linkError) {
      return res.status(500).json({ error: linkError.message });
    }

    return res.status(200).json({ success: true, message: `Invitation envoyee a ${email}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
