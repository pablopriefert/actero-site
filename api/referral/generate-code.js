import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function generateCode(clientName) {
  const clean = removeAccents(clientName).replace(/[^a-zA-Z]/g, '').toUpperCase();
  const prefix = clean.substring(0, 3).padEnd(3, 'X');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + suffix;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Find client for this user
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let clientId = link?.client_id;
    if (!clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      clientId = client?.id;
    }

    if (!clientId) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Check if client already has a code
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, brand_name, referral_code')
      .eq('id', clientId)
      .single();

    if (existingClient?.referral_code) {
      return res.status(200).json({
        code: existingClient.referral_code,
        link: `https://actero.fr/r/${existingClient.referral_code}`,
      });
    }

    // Generate unique code with retries
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateCode(existingClient.brand_name || 'ACT');
      const { data: conflict } = await supabase
        .from('clients')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();
      if (!conflict) break;
      attempts++;
    }

    // Update client with code
    const { error: updateError } = await supabase
      .from('clients')
      .update({ referral_code: code })
      .eq('id', clientId);

    if (updateError) {
      console.error('Failed to update referral code:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la génération du code' });
    }

    return res.status(200).json({
      code,
      link: `https://actero.fr/r/${code}`,
    });
  } catch (err) {
    console.error('Generate code error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
