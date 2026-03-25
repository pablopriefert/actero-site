import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { first_name, last_name, email, phone, network_type, message } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'first_name, last_name et email sont requis' });
  }

  try {
    const { data, error } = await supabase
      .from('ambassador_applications')
      .insert({
        first_name,
        last_name,
        email,
        phone: phone || null,
        network_type: network_type || null,
        message: message || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('Insert application error:', error);
      return res.status(500).json({ error: 'Erreur lors de la soumission' });
    }

    return res.status(200).json({ success: true, application_id: data.id });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
