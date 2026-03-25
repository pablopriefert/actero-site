import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.query.code;
  if (!code || typeof code !== 'string' || code.trim().length < 3) {
    return res.redirect(302, '/audit');
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    // Verify ambassador code exists and is active
    const { data: ambassador, error: ambError } = await supabase
      .from('ambassadors')
      .select('id, ambassador_code, status')
      .eq('ambassador_code', cleanCode)
      .maybeSingle();

    if (ambError || !ambassador) {
      return res.redirect(302, '/audit');
    }

    if (ambassador.status !== 'active') {
      return res.redirect(302, '/audit');
    }

    // Anti-spam: only create a lead entry if no recent click from same ambassador (within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentClick } = await supabase
      .from('ambassador_leads')
      .select('id')
      .eq('ambassador_id', ambassador.id)
      .eq('source', 'link')
      .eq('status', 'submitted')
      .gte('created_at', oneHourAgo)
      .maybeSingle();

    if (!recentClick) {
      const { data: lead } = await supabase
        .from('ambassador_leads')
        .insert({
          ambassador_id: ambassador.id,
          prospect_name: 'Visiteur (lien)',
          company_name: '\u00c0 qualifier',
          source: 'link',
          status: 'submitted',
        })
        .select('id')
        .single();

      // Log event
      if (lead) {
        await supabase.from('ambassador_lead_events').insert({
          lead_id: lead.id,
          event_type: 'submitted',
          note: 'Clic sur lien de parrainage',
          created_by: `system:track-click`,
        }).catch(() => {});
      }
    }

    // Set cookie with ambassador code (90 days)
    const maxAge = 90 * 24 * 60 * 60;
    res.setHeader('Set-Cookie', `ambassador_ref=${cleanCode}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);

    // Redirect to audit page with ref param
    return res.redirect(302, `/audit?ref=${cleanCode}`);
  } catch (err) {
    console.error('Track click error:', err);
    return res.redirect(302, '/audit');
  }
}
