import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });

  // Find ambassador
  const { data: ambassador, error: ambError } = await supabase
    .from('ambassadors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (ambError || !ambassador) {
    return res.status(403).json({ error: 'Compte ambassadeur non trouve' });
  }

  try {
    const { data: commissions, error } = await supabase
      .from('ambassador_commissions')
      .select('*, ambassador_leads(prospect_name, company_name)')
      .eq('ambassador_id', ambassador.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch commissions error:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    return res.status(200).json({ commissions });
  } catch (err) {
    console.error('Commissions error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
