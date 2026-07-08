/**
 * Actero Engine — Shopify Widget Install (theme app extension only)
 *
 * The Actero chat widget installs exclusively via the theme app extension at
 * extensions/actero-widget/ — the merchant enables the "Actero AI Support"
 * app-embed block from their Theme Editor. Shopify App Store policy 5.1.1
 * forbids editing theme files through the Asset/Theme API.
 *
 * This endpoint used to inject the widget into layout/theme.liquid via the
 * Asset API; that path has been removed. It now only returns the theme-editor
 * deep link so the dashboard can guide the merchant to the app-embed block.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  const { client_id } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  // App Store policy 5.1.1: apps must install via a theme app extension, NOT by
  // editing theme files through the Asset/Theme API. This endpoint no longer
  // touches the Themes API — it returns the theme-editor deep link so the
  // merchant enables the "Actero AI Support" app-embed block themselves.
  try {
    const { data: shopify } = await supabase
      .from('client_shopify_connections')
      .select('shop_domain')
      .eq('client_id', client_id)
      .maybeSingle()

    const deepLink = shopify?.shop_domain
      ? `https://${shopify.shop_domain}/admin/themes/current/editor?context=apps`
      : null

    return res.status(200).json({
      success: false,
      method: 'theme_app_extension',
      message:
        "L'installation se fait via l'extension de thème Actero : dans l'éditeur de thème, activez le bloc « Actero AI Support ».",
      deepLink,
    })
  } catch (err) {
    console.error('[shopify-widget] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
