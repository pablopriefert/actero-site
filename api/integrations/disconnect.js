import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non authentifié' });

  const { integration_id } = req.body;
  if (!integration_id) {
    return res.status(400).json({ error: 'integration_id requis' });
  }

  try {
    const { data: clientUser } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: ownedClient } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    const clientId = clientUser?.client_id || ownedClient?.id;
    if (!clientId) return res.status(404).json({ error: 'Client introuvable' });

    // Verify ownership then delete
    const { error } = await supabase
      .from('client_integrations')
      .delete()
      .eq('id', integration_id)
      .eq('client_id', clientId);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
