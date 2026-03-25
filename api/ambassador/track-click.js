import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.query.code;
  if (!code) {
    return res.redirect(302, '/audit');
  }

  try {
    // Verify ambassador code exists
    const { data: ambassador, error: ambError } = await supabase
      .from('ambassadors')
      .select('id, ambassador_code, status')
      .eq('ambassador_code', code.toUpperCase())
      .maybeSingle();

    if (ambError || !ambassador) {
      // Invalid code, just redirect to audit page
      return res.redirect(302, '/audit');
    }

    // Create a lead entry with source 'link' to track the click
    // Only if no recent click from same code (within 1 hour, anti-spam)
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
      await supabase
        .from('ambassador_leads')
        .insert({
          ambassador_id: ambassador.id,
          prospect_name: 'Visiteur (lien)',
          company_name: 'A qualifier',
          source: 'link',
          status: 'submitted',
        });
    }

    // Set cookie with ambassador code (90 days)
    const maxAge = 90 * 24 * 60 * 60; // 90 days in seconds
    res.setHeader('Set-Cookie', `ambassador_ref=${code.toUpperCase()}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);

    // Redirect to audit page with ref param
    return res.redirect(302, `/audit?ref=${code.toUpperCase()}`);
  } catch (err) {
    console.error('Track click error:', err);
    return res.redirect(302, '/audit');
  }
}
