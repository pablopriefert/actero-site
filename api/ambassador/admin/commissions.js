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
  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Acces refuse' });

  if (req.method === 'GET') {
    try {
      const { data: commissions, error } = await supabase
        .from('ambassador_commissions')
        .select('*, ambassadors(first_name, last_name, email, ambassador_code), ambassador_leads(prospect_name, company_name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Admin fetch commissions error:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      return res.status(200).json({ commissions });
    } catch (err) {
      console.error('Admin commissions error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    const { ambassador_id, lead_id, client_id, amount, client_payment_date } = req.body;

    if (!ambassador_id || !lead_id || !amount) {
      return res.status(400).json({ error: 'ambassador_id, lead_id et amount sont requis' });
    }

    // Calculate eligibility date (payment date + 30 days)
    let eligibility_date = null;
    let status = 'pending';
    if (client_payment_date) {
      eligibility_date = new Date(new Date(client_payment_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      status = 'waiting_30_days';
    }

    try {
      const { data, error } = await supabase
        .from('ambassador_commissions')
        .insert({
          ambassador_id,
          lead_id,
          client_id: client_id || null,
          amount,
          currency: 'EUR',
          client_payment_date: client_payment_date || null,
          eligibility_date,
          status,
        })
        .select('*, ambassadors(first_name, last_name), ambassador_leads(prospect_name, company_name)')
        .single();

      if (error) {
        console.error('Create commission error:', error);
        return res.status(500).json({ error: 'Erreur creation commission' });
      }

      return res.status(200).json({ success: true, commission: data });
    } catch (err) {
      console.error('Post commission error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, admin_note, client_payment_date } = req.body;

    if (!id) return res.status(400).json({ error: 'id requis' });

    const updates = {};
    if (status) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;

    // If setting client_payment_date, calculate eligibility
    if (client_payment_date) {
      updates.client_payment_date = client_payment_date;
      updates.eligibility_date = new Date(new Date(client_payment_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (!status) updates.status = 'waiting_30_days';
    }

    // If marking as paid, set paid_at
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }

    try {
      const { data, error } = await supabase
        .from('ambassador_commissions')
        .update(updates)
        .eq('id', id)
        .select('*, ambassadors(first_name, last_name), ambassador_leads(prospect_name, company_name)')
        .single();

      if (error) {
        console.error('Update commission error:', error);
        return res.status(500).json({ error: 'Erreur mise a jour' });
      }

      return res.status(200).json({ success: true, commission: data });
    } catch (err) {
      console.error('Patch commission error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
