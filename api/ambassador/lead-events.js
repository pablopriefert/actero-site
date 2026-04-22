import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autoris\u00e9.' });

  const leadId = req.query.lead_id;
  if (!leadId) return res.status(400).json({ error: 'lead_id requis.' });

  // Check the user owns this lead (ambassador) or is admin
  const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');

  if (!isAdmin) {
    const { data: ambassador } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!ambassador) return res.status(403).json({ error: 'Acc\u00e8s refus\u00e9.' });

    const { data: lead } = await supabase
      .from('ambassador_leads')
      .select('id')
      .eq('id', leadId)
      .eq('ambassador_id', ambassador.id)
      .maybeSingle();

    if (!lead) return res.status(403).json({ error: 'Acc\u00e8s refus\u00e9.' });
  }

  try {
    const { data: events, error } = await supabase
      .from('ambassador_lead_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch lead events error:', error);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }

    return res.status(200).json({ events });
  } catch (err) {
    console.error('Lead events error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

export default withSentry(handler)
