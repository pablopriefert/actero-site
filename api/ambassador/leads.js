import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Window', '60');

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  // Find ambassador for this user
  const { data: ambassador, error: ambError } = await supabase
    .from('ambassadors')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  if (ambError || !ambassador) {
    return res.status(403).json({ error: 'Compte ambassadeur non trouv\u00e9.' });
  }

  if (req.method === 'GET') {
    try {
      const { data: leads, error } = await supabase
        .from('ambassador_leads')
        .select('*')
        .eq('ambassador_id', ambassador.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch leads error:', error);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }

      return res.status(200).json({ leads });
    } catch (err) {
      console.error('Leads GET error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  if (req.method === 'POST') {
    if (ambassador.status === 'suspended' || ambassador.status === 'inactive') {
      return res.status(403).json({ error: 'Votre compte ambassadeur est inactif.' });
    }

    const { prospect_name, company_name, company_niche, prospect_email, prospect_phone, message, source } = req.body || {};

    if (!prospect_name || typeof prospect_name !== 'string' || prospect_name.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom du prospect est requis.' });
    }
    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom de l\'entreprise est requis.' });
    }
    if (prospect_email && !isValidEmail(prospect_email)) {
      return res.status(400).json({ error: 'L\'email du prospect est invalide.' });
    }

    const cleanEmail = prospect_email?.trim().toLowerCase() || null;

    try {
      // Duplicate detection
      if (cleanEmail) {
        const { data: existing } = await supabase
          .from('ambassador_leads')
          .select('id')
          .eq('prospect_email', cleanEmail)
          .not('status', 'eq', 'lost')
          .maybeSingle();

        if (existing) {
          return res.status(409).json({ error: 'Ce prospect (email) a d\u00e9j\u00e0 \u00e9t\u00e9 soumis.' });
        }
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
          source: source || 'form',
          status: 'submitted',
        })
        .select()
        .single();

      if (error) {
        console.error('Insert lead error:', error);
        return res.status(500).json({ error: 'Erreur cr\u00e9ation lead.' });
      }

      // Log event
      await supabase.from('ambassador_lead_events').insert({
        lead_id: lead.id,
        event_type: 'submitted',
        note: `Lead soumis par ${ambassador.first_name} ${ambassador.last_name}`,
        created_by: `ambassador:${ambassador.id}`,
      });

      return res.status(200).json({ success: true, lead });
    } catch (err) {
      console.error('Leads POST error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withSentry(handler)
