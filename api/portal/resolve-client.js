import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js';

const PLANS_WITH_CUSTOMIZATION = new Set(['pro', 'enterprise']);

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const hostname = (req.query.hostname || '').toLowerCase();
  if (!hostname) return res.status(400).json({ error: 'hostname_required' });

  const parts = hostname.split('.');
  const isPortalSubdomain = hostname.endsWith('.portal.actero.fr') && parts.length >= 4;
  const slug = isPortalSubdomain ? parts[0] : null;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, slug, brand_name, plan, trial_ends_at, portal_enabled, portal_custom_domain, portal_logo_url, portal_primary_color, portal_display_name, portal_hide_actero_branding')
    .or(slug ? `slug.eq.${slug},portal_custom_domain.eq.${hostname}` : `portal_custom_domain.eq.${hostname}`)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'lookup_failed' });
  if (!data || !data.portal_enabled) return res.status(404).json({ error: 'portal_not_found' });

  const inTrial = data.trial_ends_at && new Date(data.trial_ends_at) > new Date();
  const canCustomize = PLANS_WITH_CUSTOMIZATION.has(data.plan) || inTrial;

  return res.status(200).json({
    clientId: data.id,
    slug: data.slug,
    merchantName: data.brand_name,
    branding: canCustomize
      ? {
          logoUrl: data.portal_logo_url || null,
          primaryColor: data.portal_primary_color || null,
          displayName: data.portal_display_name || null,
          source: 'merchant',
          hideActeroBranding: !!data.portal_hide_actero_branding,
        }
      : {
          logoUrl: null,
          primaryColor: null,
          displayName: null,
          source: 'actero',
          hideActeroBranding: false,
        },
  });
}

export default withSentry(handler)
