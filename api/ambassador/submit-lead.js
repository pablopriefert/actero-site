import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  // Find ambassador for this user
  const { data: ambassador, error: ambError } = await supabase
    .from('ambassadors')
    .select('id, status')
    .eq('user_id', user.id)
    .single();

  if (ambError || !ambassador) {
    return res.status(403).json({ error: 'Compte ambassadeur non trouve' });
  }

  if (ambassador.status !== 'active') {
    return res.status(403).json({ error: 'Compte ambassadeur inactif' });
  }

  const { prospect_name, company_name, company_niche, prospect_email, prospect_phone, message } = req.body;

  if (!prospect_name || !company_name) {
    return res.status(400).json({ error: 'prospect_name et company_name sont requis' });
  }

  try {
    const { data: lead, error } = await supabase
      .from('ambassador_leads')
      .insert({
        ambassador_id: ambassador.id,
        prospect_name,
        company_name,
        company_niche: company_niche || null,
        prospect_email: prospect_email || null,
        prospect_phone: prospect_phone || null,
        message: message || null,
        source: 'form',
        status: 'submitted',
      })
      .select()
      .single();

    if (error) {
      console.error('Submit lead error:', error);
      return res.status(500).json({ error: 'Erreur creation lead' });
    }

    return res.status(200).json({ success: true, lead });
  } catch (err) {
    console.error('Submit lead error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
