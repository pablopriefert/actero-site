import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../lib/admin-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VALID_STATUSES = ['pending', 'waiting_30_days', 'eligible', 'approved', 'paid', 'cancelled'];

export default async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Window', '60');

  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  if (req.method === 'GET') {
    try {
      const { data: commissions, error } = await supabase
        .from('ambassador_commissions')
        .select('*, ambassadors(first_name, last_name, email, ambassador_code), ambassador_leads(prospect_name, company_name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Admin fetch commissions error:', error);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }

      return res.status(200).json({ commissions });
    } catch (err) {
      console.error('Admin commissions error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  if (req.method === 'POST') {
    const { ambassador_id, lead_id, client_id, amount, client_payment_date } = req.body || {};

    if (!ambassador_id || !lead_id) {
      return res.status(400).json({ error: 'ambassador_id et lead_id sont requis.' });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Un montant valide (> 0) est requis.' });
    }

    // Check for duplicate commission for same lead
    const { data: existingCommission } = await supabase
      .from('ambassador_commissions')
      .select('id')
      .eq('lead_id', lead_id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingCommission) {
      return res.status(409).json({ error: 'Une commission existe d\u00e9j\u00e0 pour ce lead.' });
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
          amount: Number(amount),
          currency: 'EUR',
          client_payment_date: client_payment_date || null,
          eligibility_date,
          status,
        })
        .select('*, ambassadors(first_name, last_name), ambassador_leads(prospect_name, company_name)')
        .single();

      if (error) {
        console.error('Create commission error:', error);
        return res.status(500).json({ error: 'Erreur cr\u00e9ation commission.' });
      }

      // Log commission event
      await supabase.from('ambassador_commission_events').insert({
        commission_id: data.id,
        event_type: 'created',
        note: `Commission de ${Number(amount).toLocaleString('fr-FR')} EUR cr\u00e9\u00e9e`,
        created_by: `admin:${adminUser.email}`,
      }).catch(e => console.error('Event log error:', e));

      if (client_payment_date) {
        await supabase.from('ambassador_commission_events').insert({
          commission_id: data.id,
          event_type: 'j30_started',
          note: `D\u00e9lai J+30 d\u00e9marr\u00e9 (paiement client: ${new Date(client_payment_date).toLocaleDateString('fr-FR')})`,
          created_by: `admin:${adminUser.email}`,
        }).catch(e => console.error('Event log error:', e));
      }

      return res.status(200).json({ success: true, commission: data });
    } catch (err) {
      console.error('Post commission error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, admin_note, client_payment_date } = req.body || {};

    if (!id) return res.status(400).json({ error: 'id requis.' });

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs accept\u00e9es: ${VALID_STATUSES.join(', ')}` });
    }

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
        return res.status(500).json({ error: 'Erreur mise \u00e0 jour.' });
      }

      // Log commission event for status change
      if (status) {
        const eventMap = {
          waiting_30_days: 'j30_started',
          eligible: 'eligible',
          approved: 'approved',
          paid: 'paid',
          cancelled: 'cancelled',
        };
        const eventType = eventMap[status] || 'note_added';
        await supabase.from('ambassador_commission_events').insert({
          commission_id: id,
          event_type: eventType,
          note: admin_note || `Statut chang\u00e9 en "${status}" par admin`,
          created_by: `admin:${adminUser.email}`,
        }).catch(e => console.error('Event log error:', e));
      }

      return res.status(200).json({ success: true, commission: data });
    } catch (err) {
      console.error('Patch commission error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
