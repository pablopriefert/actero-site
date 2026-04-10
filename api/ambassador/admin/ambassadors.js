import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../lib/admin-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  if (req.method === 'GET') {
    try {
      // Fetch ambassadors
      const { data: ambassadors, error } = await supabase
        .from('ambassadors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch ambassadors error:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      // Fetch leads counts per ambassador
      const { data: leads } = await supabase
        .from('ambassador_leads')
        .select('ambassador_id, status');

      // Fetch commissions per ambassador
      const { data: commissions } = await supabase
        .from('ambassador_commissions')
        .select('ambassador_id, amount, status');

      // Aggregate stats
      const stats = {};
      (leads || []).forEach(l => {
        if (!stats[l.ambassador_id]) stats[l.ambassador_id] = { leads_count: 0, won_count: 0, commissions_total: 0, commissions_paid: 0 };
        stats[l.ambassador_id].leads_count++;
        if (l.status === 'won') stats[l.ambassador_id].won_count++;
      });
      (commissions || []).forEach(c => {
        if (!stats[c.ambassador_id]) stats[c.ambassador_id] = { leads_count: 0, won_count: 0, commissions_total: 0, commissions_paid: 0 };
        stats[c.ambassador_id].commissions_total += Number(c.amount) || 0;
        if (c.status === 'paid') stats[c.ambassador_id].commissions_paid += Number(c.amount) || 0;
      });

      const result = ambassadors.map(a => ({
        ...a,
        stats: stats[a.id] || { leads_count: 0, won_count: 0, commissions_total: 0, commissions_paid: 0 },
      }));

      return res.status(200).json({ ambassadors: result });
    } catch (err) {
      console.error('Admin ambassadors error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, notes_admin } = req.body;

    if (!id) return res.status(400).json({ error: 'id requis' });

    const updates = {};
    if (status) updates.status = status;
    if (notes_admin !== undefined) updates.notes_admin = notes_admin;

    try {
      const { data, error } = await supabase
        .from('ambassadors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update ambassador error:', error);
        return res.status(500).json({ error: 'Erreur mise a jour' });
      }

      return res.status(200).json({ success: true, ambassador: data });
    } catch (err) {
      console.error('Patch ambassador error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
