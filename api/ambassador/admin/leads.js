import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../lib/admin-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VALID_STATUSES = ['submitted', 'audit_booked', 'second_call', 'client_paid', 'won', 'lost'];

export default async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Window', '60');

  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  if (req.method === 'GET') {
    try {
      const { data: leads, error } = await supabase
        .from('ambassador_leads')
        .select('*, ambassadors(first_name, last_name, email, ambassador_code)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Admin fetch leads error:', error);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }

      return res.status(200).json({ leads });
    } catch (err) {
      console.error('Admin leads error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, status_note, admin_note, client_id } = req.body || {};

    if (!id) return res.status(400).json({ error: 'id requis.' });

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs accept\u00e9es: ${VALID_STATUSES.join(', ')}` });
    }

    const updates = {};
    if (status) updates.status = status;
    if (status === 'client_paid') updates.client_paid_at = new Date().toISOString();
    if (status_note !== undefined) updates.status_note = status_note;
    if (admin_note !== undefined) updates.admin_note = admin_note;
    if (client_id !== undefined) updates.client_id = client_id;

    try {
      const { data, error } = await supabase
        .from('ambassador_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update lead error:', error);
        return res.status(500).json({ error: 'Erreur mise \u00e0 jour.' });
      }

      // Log event for status change
      if (status) {
        const eventType = status;
        await supabase.from('ambassador_lead_events').insert({
          lead_id: id,
          event_type: eventType,
          note: status_note || `Statut chang\u00e9 en "${status}" par admin`,
          created_by: `admin:${adminUser.email}`,
        }).catch(e => console.error('Event log error:', e));
      }

      // Log event for note added
      if (admin_note && !status) {
        await supabase.from('ambassador_lead_events').insert({
          lead_id: id,
          event_type: 'note_added',
          note: admin_note,
          created_by: `admin:${adminUser.email}`,
        }).catch(e => console.error('Event log error:', e));
      }

      return res.status(200).json({ success: true, lead: data });
    } catch (err) {
      console.error('Patch lead error:', err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
