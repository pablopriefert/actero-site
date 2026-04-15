/**
 * Actero Engine — Shopify Widget Auto-Install
 * Automatically installs/uninstalls the Actero chat widget on a Shopify store.
 */
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const WIDGET_TAG = '<!-- ACTERO-WIDGET -->'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  const { action, client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })
  if (!['install', 'uninstall'].includes(action)) return res.status(400).json({ error: 'action: install ou uninstall' })

  // Get Shopify credentials
  const { data: shopify } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', client_id)
    .maybeSingle()

  const shopifyToken = decryptToken(shopify?.access_token)
  if (!shopifyToken) {
    return res.status(400).json({ error: 'Shopify non connecte. Connectez votre boutique d\'abord.' })
  }

  const baseUrl = `https://${shopify.shop_domain}/admin/api/2024-01`
  const headers = {
    'X-Shopify-Access-Token': shopifyToken,
    'Content-Type': 'application/json',
  }

  try {
    // 1. Get the active theme
    const themesRes = await fetch(`${baseUrl}/themes.json`, { headers })
    if (!themesRes.ok) throw new Error('Impossible de recuperer les themes Shopify')
    const { themes } = await themesRes.json()
    const activeTheme = themes.find(t => t.role === 'main')
    if (!activeTheme) throw new Error('Aucun theme actif trouve')

    // 2. Get theme.liquid content
    const assetKey = 'layout/theme.liquid'
    const assetRes = await fetch(`${baseUrl}/themes/${activeTheme.id}/assets.json?asset[key]=${assetKey}`, { headers })
    if (!assetRes.ok) throw new Error('Impossible de lire theme.liquid')
    const { asset } = await assetRes.json()
    let content = asset.value

    const cacheBuster = Date.now()
    const widgetScript = `\n${WIDGET_TAG}\n<script src="https://actero.fr/widget.js?v=${cacheBuster}" data-actero-key="${client_id}"></script>\n${WIDGET_TAG}`

    if (action === 'install') {
      // Check if already installed — update the widget script to latest version
      if (content.includes(WIDGET_TAG)) {
        // Replace existing widget with fresh cache-busted version
        const existingRegex = new RegExp(`\\n${WIDGET_TAG}\\n[\\s\\S]*?\\n${WIDGET_TAG}`)
        content = content.replace(existingRegex, widgetScript)
        await fetch(`https://${shop}/admin/api/2024-01/themes/${themeId}/assets.json`, {
          method: 'PUT',
          headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset: { key: 'layout/theme.liquid', value: content } }),
        })
        return res.status(200).json({ success: true, message: 'Widget mis a jour' })
      }

      // Inject before </body>
      if (content.includes('</body>')) {
        content = content.replace('</body>', `${widgetScript}\n</body>`)
      } else {
        // Fallback: append at end
        content += widgetScript
      }
    } else {
      // Uninstall: remove widget block
      const regex = new RegExp(`\\n?${WIDGET_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${WIDGET_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g')
      content = content.replace(regex, '')
    }

    // 3. Save the modified theme.liquid
    const saveRes = await fetch(`${baseUrl}/themes/${activeTheme.id}/assets.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        asset: { key: assetKey, value: content },
      }),
    })

    if (!saveRes.ok) {
      const err = await saveRes.text()
      throw new Error(`Erreur Shopify: ${err}`)
    }

    return res.status(200).json({
      success: true,
      action,
      message: action === 'install'
        ? 'Widget installe sur votre boutique Shopify'
        : 'Widget retire de votre boutique Shopify',
      theme: activeTheme.name,
    })
  } catch (err) {
    console.error('[shopify-widget] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
