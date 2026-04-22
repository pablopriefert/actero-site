import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../lib/rate-limit.js';

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

// Postgres unique_violation error code
const PG_UNIQUE_VIOLATION = '23505';

async function handler(req, res) {
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

    // Rate limit: 20 requests/min per user
    const rl = checkRateLimit(`referral_code:${user.id}`, 20, 60_000);
    res.setHeader('X-RateLimit-Limit', '20');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un instant.' });
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

    // Generate a code and rely on the UNIQUE constraint on clients.referral_code
    // to guarantee uniqueness. If a collision happens (very unlikely), we retry
    // a few times on unique_violation — without a TOCTOU read.
    let code = null;
    let updateError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode(existingClient.brand_name || 'ACT');
      const { error } = await supabase
        .from('clients')
        .update({ referral_code: candidate })
        .eq('id', clientId)
        .is('referral_code', null); // only set if still null (idempotency guard)

      if (!error) {
        code = candidate;
        updateError = null;
        break;
      }

      // If the row had a code in the meantime, re-read and return it
      if (error.code === PG_UNIQUE_VIOLATION) {
        // collision on UNIQUE(referral_code) — try another candidate
        updateError = error;
        continue;
      }
      updateError = error;
      break;
    }

    if (!code) {
      // Maybe a concurrent request already assigned a code
      const { data: refetched } = await supabase
        .from('clients')
        .select('referral_code')
        .eq('id', clientId)
        .maybeSingle();
      if (refetched?.referral_code) {
        return res.status(200).json({
          code: refetched.referral_code,
          link: `https://actero.fr/r/${refetched.referral_code}`,
        });
      }
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

export default withSentry(handler)
