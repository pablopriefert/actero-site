/**
 * GET /api/engine/widget-config?api_key=...
 *
 * Public endpoint hit by public/widget.js at boot to resolve the merchant's
 * visual configuration. CORS-open because the widget runs on any merchant
 * storefront / landing page.
 *
 * Response shape (stable contract — widget.js depends on it):
 *
 *   {
 *     brandColor:     "#0F5F35",
 *     accentColor:    "#14A85C",
 *     position:       "bottom-right" | "bottom-left",
 *     greeting:       "Bonjour ! Comment puis-je vous aider ?",
 *     logoUrl:        "https://..." | null,
 *     showPoweredBy:  true,
 *     agentEnabled:   true,
 *     brandName:      "Acme Cosmetics"
 *   }
 *
 * If the api_key resolves to a client whose plan is below "pro", we force
 * showPoweredBy to true — the dashboard UI does the same when it renders
 * the toggle, but we belt-and-brace it here so a tampered DB row can't
 * accidentally strip our attribution from a free-tier widget.
 *
 * On any error (unknown key, DB down, …) we still return a 200 with the
 * factory defaults so the widget keeps rendering. The widget itself
 * tolerates a non-200 by falling back to its built-in hard-coded styling.
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const PLANS_WITHOUT_WHITELABEL = new Set([null, 'free', 'starter'])

const DEFAULTS = {
  brandColor: '#0F5F35',
  accentColor: '#14A85C',
  position: 'bottom-right',
  greeting: 'Bonjour ! Comment puis-je vous aider ?',
  logoUrl: null,
  showPoweredBy: true,
  agentEnabled: true,
  proactiveEnabled: false,
  brandName: null,
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  // 5-minute browser cache — config changes propagate fast enough for
  // merchants iterating from the dashboard and we save a lot of round trips.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
}

async function handler(req, res) {
  applyCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const apiKey = req.query?.api_key
  if (!apiKey) {
    return res.status(200).json(DEFAULTS)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json(DEFAULTS)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  // Resolve api_key → client_id. Same precedence as the chat endpoint:
  // 1. client_api_keys.key_value (active rows) — primary, supports rotation
  // 2. client_settings.widget_api_key — legacy single-key install
  let clientId = null
  try {
    const { data } = await supabase
      .from('client_api_keys')
      .select('client_id')
      .eq('key_value', apiKey)
      .eq('is_active', true)
      .maybeSingle()
    if (data) clientId = data.client_id
  } catch (err) {
    console.warn('[widget-config] client_api_keys lookup failed:', err?.message)
  }

  if (!clientId) {
    try {
      const { data } = await supabase
        .from('client_settings')
        .select('client_id')
        .eq('widget_api_key', apiKey)
        .maybeSingle()
      if (data) clientId = data.client_id
    } catch (err) {
      console.warn('[widget-config] client_settings lookup failed:', err?.message)
    }
  }

  if (!clientId) {
    return res.status(200).json(DEFAULTS)
  }

  // Pull settings + plan in two cheap queries.
  let settings = null
  let plan = null
  let brandName = null
  try {
    const { data: s } = await supabase
      .from('client_settings')
      .select(
        'widget_brand_color, widget_accent_color, widget_position, widget_greeting, widget_logo_url, widget_show_powered_by, agent_enabled, widget_proactive_enabled',
      )
      .eq('client_id', clientId)
      .maybeSingle()
    settings = s

    const { data: c } = await supabase
      .from('clients')
      .select('plan, brand_name')
      .eq('id', clientId)
      .maybeSingle()
    plan = c?.plan || null
    brandName = c?.brand_name || null
  } catch (err) {
    console.warn('[widget-config] settings lookup failed:', err?.message)
  }

  if (!settings) {
    return res.status(200).json({ ...DEFAULTS, brandName })
  }

  // Plans below Pro cannot hide the attribution footer.
  const showPoweredBy = PLANS_WITHOUT_WHITELABEL.has(plan)
    ? true
    : !!settings.widget_show_powered_by

  return res.status(200).json({
    brandColor: settings.widget_brand_color || DEFAULTS.brandColor,
    accentColor: settings.widget_accent_color || DEFAULTS.accentColor,
    position: settings.widget_position || DEFAULTS.position,
    greeting: settings.widget_greeting || DEFAULTS.greeting,
    logoUrl: settings.widget_logo_url || null,
    showPoweredBy,
    agentEnabled: settings.agent_enabled !== false,
    proactiveEnabled: settings.widget_proactive_enabled === true,
    brandName,
  })
}

export default withSentry(handler)
