import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  // Rate limiting headers
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Window', '3600');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { first_name, last_name, email, phone, network_type, message } = req.body || {};

  // Validation
  if (!first_name || typeof first_name !== 'string' || first_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le pr\u00e9nom est requis (minimum 2 caract\u00e8res).' });
  }
  if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom est requis (minimum 2 caract\u00e8res).' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Un email valide est requis.' });
  }
  if (phone && !/^[+\d\s()-]{6,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Num\u00e9ro de t\u00e9l\u00e9phone invalide.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check for duplicate application (same email, not rejected)
    const { data: existing } = await supabase
      .from('ambassador_applications')
      .select('id, status')
      .eq('email', cleanEmail)
      .neq('status', 'rejected')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Une candidature avec cet email existe d\u00e9j\u00e0.' });
    }

    // Also check if already an ambassador
    const { data: existingAmbassador } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAmbassador) {
      return res.status(409).json({ error: 'Cet email est d\u00e9j\u00e0 associ\u00e9 \u00e0 un compte ambassadeur. Connectez-vous.' });
    }

    const { data, error } = await supabase
      .from('ambassador_applications')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: phone?.trim() || null,
        network_type: network_type || null,
        message: message?.trim() || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('Insert application error:', error);
      return res.status(500).json({ error: 'Erreur lors de la soumission.' });
    }

    return res.status(200).json({ success: true, application_id: data.id });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
