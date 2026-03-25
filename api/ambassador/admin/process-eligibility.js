import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Acces refuse' });

  try {
    const now = new Date().toISOString();

    // Find all commissions in waiting_30_days where eligibility_date has passed
    const { data: eligible, error: fetchError } = await supabase
      .from('ambassador_commissions')
      .select('id, eligibility_date')
      .eq('status', 'waiting_30_days')
      .lte('eligibility_date', now);

    if (fetchError) {
      console.error('Fetch eligible error:', fetchError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!eligible || eligible.length === 0) {
      return res.status(200).json({ success: true, processed: 0 });
    }

    // Update all eligible commissions
    const ids = eligible.map(c => c.id);
    const { error: updateError } = await supabase
      .from('ambassador_commissions')
      .update({ status: 'eligible' })
      .in('id', ids);

    if (updateError) {
      console.error('Update eligible error:', updateError);
      return res.status(500).json({ error: 'Erreur mise a jour' });
    }

    return res.status(200).json({ success: true, processed: ids.length });
  } catch (err) {
    console.error('Process eligibility error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
