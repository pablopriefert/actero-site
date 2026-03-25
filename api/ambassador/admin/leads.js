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
      const { data: leads, error } = await supabase
        .from('ambassador_leads')
        .select('*, ambassadors(first_name, last_name, email, ambassador_code)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Admin fetch leads error:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      return res.status(200).json({ leads });
    } catch (err) {
      console.error('Admin leads error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, status_note, admin_note, client_id } = req.body;

    if (!id) return res.status(400).json({ error: 'id requis' });

    const updates = {};
    if (status) updates.status = status;
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
        return res.status(500).json({ error: 'Erreur mise a jour' });
      }

      return res.status(200).json({ success: true, lead: data });
    } catch (err) {
      console.error('Patch lead error:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
