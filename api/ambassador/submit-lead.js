import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '20');
  res.setHeader('X-RateLimit-Window', '3600');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  // Find ambassador for this user
  const { data: ambassador, error: ambError } = await supabase
    .from('ambassadors')
    .select('id, status, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  if (ambError || !ambassador) {
    return res.status(403).json({ error: 'Compte ambassadeur non trouv\u00e9.' });
  }

  if (ambassador.status !== 'active') {
    return res.status(403).json({ error: 'Votre compte ambassadeur est inactif. Contactez Actero.' });
  }

  const { prospect_name, company_name, company_niche, prospect_email, prospect_phone, message } = req.body || {};

  // Validation
  if (!prospect_name || typeof prospect_name !== 'string' || prospect_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom du prospect est requis (minimum 2 caract\u00e8res).' });
  }
  if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom de l\'entreprise est requis (minimum 2 caract\u00e8res).' });
  }
  if (prospect_email && !isValidEmail(prospect_email)) {
    return res.status(400).json({ error: 'L\'email du prospect est invalide.' });
  }
  if (prospect_phone && !/^[+\d\s()-]{6,20}$/.test(prospect_phone)) {
    return res.status(400).json({ error: 'Le t\u00e9l\u00e9phone du prospect est invalide.' });
  }

  const cleanEmail = prospect_email?.trim().toLowerCase() || null;
  const cleanCompany = company_name.trim().toLowerCase();

  try {
    // Duplicate detection: check by email + company_name
    if (cleanEmail) {
      const { data: existingByEmail } = await supabase
        .from('ambassador_leads')
        .select('id, ambassador_id, status')
        .eq('prospect_email', cleanEmail)
        .not('status', 'eq', 'lost')
        .maybeSingle();

      if (existingByEmail) {
        return res.status(409).json({
          error: 'Ce prospect (email) a d\u00e9j\u00e0 \u00e9t\u00e9 soumis. R\u00e8gle du premier arriv\u00e9.',
          duplicate: true,
        });
      }
    }

    // Also check by company name (fuzzy)
    const { data: existingByCompany } = await supabase
      .from('ambassador_leads')
      .select('id, ambassador_id, company_name')
      .ilike('company_name', cleanCompany)
      .not('status', 'eq', 'lost')
      .maybeSingle();

    if (existingByCompany && existingByCompany.ambassador_id !== ambassador.id) {
      return res.status(409).json({
        error: 'Cette entreprise a d\u00e9j\u00e0 \u00e9t\u00e9 soumise par un autre ambassadeur.',
        duplicate: true,
      });
    }

    const { data: lead, error } = await supabase
      .from('ambassador_leads')
      .insert({
        ambassador_id: ambassador.id,
        prospect_name: prospect_name.trim(),
        company_name: company_name.trim(),
        company_niche: company_niche || null,
        prospect_email: cleanEmail,
        prospect_phone: prospect_phone?.trim() || null,
        message: message?.trim() || null,
        source: 'form',
        status: 'submitted',
      })
      .select()
      .single();

    if (error) {
      console.error('Submit lead error:', error);
      return res.status(500).json({ error: 'Erreur lors de la cr\u00e9ation du lead.' });
    }

    // Log event
    await supabase.from('ambassador_lead_events').insert({
      lead_id: lead.id,
      event_type: 'submitted',
      note: `Lead soumis par ${ambassador.first_name} ${ambassador.last_name}`,
      created_by: `ambassador:${ambassador.id}`,
    });

    return res.status(200).json(lead);
  } catch (err) {
    console.error('Submit lead error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
