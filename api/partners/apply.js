import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/partners/apply
 * Public endpoint for the Actero Partners certification program.
 * Creates a partner_applications row with status='pending'.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 applications/min/IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`partners-apply:${ip}`, 5, 60_000);
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans quelques instants.' });
  }

  const {
    full_name,
    email,
    company_name,
    website,
    linkedin,
    pitch,
    experience_years,
    clients_managed,
  } = req.body || {};

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom complet est requis.' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Un email valide est requis.' });
  }
  if (!pitch || typeof pitch !== 'string' || pitch.trim().length < 20) {
    return res.status(400).json({ error: 'Le pitch doit contenir au moins 20 caractères.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const nameParts = full_name.trim().split(/\s+/);
  const firstName = nameParts[0] || full_name.trim();
  const lastName = nameParts.slice(1).join(' ') || '.';

  try {
    // Reject if a pending/approved/certified application with this email already exists
    const { data: existing } = await supabase
      .from('partner_applications')
      .select('id, status')
      .eq('email', cleanEmail)
      .in('status', ['pending', 'approved', 'paid', 'certified'])
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'Une candidature avec cet email est déjà en cours de traitement.',
      });
    }

    const { data, error } = await supabase
      .from('partner_applications')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          full_name: full_name.trim(),
          email: cleanEmail,
          company_name: company_name ? String(company_name).trim() : null,
          website: website ? String(website).trim() : null,
          linkedin: linkedin ? String(linkedin).trim() : null,
          pitch: pitch.trim(),
          experience_years: Number.isFinite(Number(experience_years))
            ? Number(experience_years)
            : null,
          clients_managed: Number.isFinite(Number(clients_managed))
            ? Number(clients_managed)
            : null,
          status: 'pending',
          source: 'partners_program',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[partners/apply] error:', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
}

export default withSentry(handler)
