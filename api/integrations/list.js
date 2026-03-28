import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  try {
    // Find the client_id for this user
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

    // Fetch integrations — never return tokens/keys
    const { data: integrations, error } = await supabase
      .from('client_integrations')
      .select('id, provider, provider_label, auth_type, status, status_message, connected_at, last_checked_at')
      .eq('client_id', clientId);

    if (error) throw error;

    // Also check for existing Shopify connection
    const { data: shopifyConn } = await supabase
      .from('client_shopify_connections')
      .select('id, shop_domain, installed_at')
      .eq('client_id', clientId)
      .maybeSingle();

    return res.status(200).json({
      integrations: integrations || [],
      shopify_connected: !!shopifyConn,
      shopify_domain: shopifyConn?.shop_domain || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
