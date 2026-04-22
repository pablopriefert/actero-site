import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/partners/me
 * Returns the partner profile, commissions and referral link for the
 * currently authenticated user. Also supports PATCH to update the profile.
 */
async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (partnerError) throw partnerError;
      if (!partner) return res.status(404).json({ error: 'Partner profile not found' });

      const { data: commissions } = await supabase
        .from('partner_commissions')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';
      const referralUrl = `${siteUrl}/?ref=${partner.referral_code}`;

      return res.status(200).json({
        partner,
        commissions: commissions || [],
        referral_url: referralUrl,
      });
    } catch (err) {
      console.error('[partners/me] GET error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'PATCH') {
    const allowed = [
      'bio',
      'avatar_url',
      'website',
      'linkedin',
      'specialties',
      'industries',
      'languages',
      'company_name',
      'is_public',
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    try {
      const { data, error } = await supabase
        .from('partners')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Partner profile not found' });
      return res.status(200).json({ partner: data });
    } catch (err) {
      console.error('[partners/me] PATCH error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withSentry(handler)
