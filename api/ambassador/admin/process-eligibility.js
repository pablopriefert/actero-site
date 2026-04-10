import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../lib/admin-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

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
      return res.status(500).json({ error: 'Erreur serveur.' });
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
      return res.status(500).json({ error: 'Erreur mise \u00e0 jour.' });
    }

    // Log events for each commission
    const events = ids.map(id => ({
      commission_id: id,
      event_type: 'eligible',
      note: 'D\u00e9lai J+30 atteint \u2014 commission \u00e9ligible',
      created_by: `system:process-eligibility`,
    }));
    await supabase.from('ambassador_commission_events').insert(events).catch(e => console.error('Event log error:', e));

    return res.status(200).json({ success: true, processed: ids.length });
  } catch (err) {
    console.error('Process eligibility error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
