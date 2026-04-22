/**
 * Actero Engine — Shopify Vocal Widget Auto-Install
 * Installs/uninstalls the ElevenLabs voice agent widget on a Shopify store.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VOCAL_TAG = '<!-- ACTERO-VOCAL-WIDGET -->'
const ELEVENLABS_AGENT_ID = 'agent_6901kns1pd7yfxz9nk6cq0f7gaq4'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  const { action, client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })
  if (!['install', 'uninstall'].includes(action)) return res.status(400).json({ error: 'action: install ou uninstall' })

  const { data: shopify } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', client_id)
    .maybeSingle()

  const shopifyToken = decryptToken(shopify?.access_token)
  if (!shopifyToken) {
    return res.status(400).json({ error: 'Shopify non connecte.' })
  }

  const baseUrl = `https://${shopify.shop_domain}/admin/api/2024-01`
  const headers = {
    'X-Shopify-Access-Token': shopifyToken,
    'Content-Type': 'application/json',
  }

  try {
    const themesRes = await fetch(`${baseUrl}/themes.json`, { headers })
    if (!themesRes.ok) throw new Error('Impossible de recuperer les themes Shopify')
    const { themes } = await themesRes.json()
    const activeTheme = themes.find(t => t.role === 'main')
    if (!activeTheme) throw new Error('Aucun theme actif trouve')

    const assetKey = 'layout/theme.liquid'
    const assetRes = await fetch(`${baseUrl}/themes/${activeTheme.id}/assets.json?asset[key]=${assetKey}`, { headers })
    if (!assetRes.ok) throw new Error('Impossible de lire theme.liquid')
    const { asset } = await assetRes.json()
    let content = asset.value

    const vocalWidget = `\n${VOCAL_TAG}\n<elevenlabs-convai agent-id="${ELEVENLABS_AGENT_ID}"></elevenlabs-convai>\n<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>\n${VOCAL_TAG}`

    if (action === 'install') {
      if (content.includes(VOCAL_TAG)) {
        return res.status(200).json({ success: true, message: 'Widget vocal deja installe' })
      }
      if (content.includes('</body>')) {
        content = content.replace('</body>', `${vocalWidget}\n</body>`)
      } else {
        content += vocalWidget
      }
    } else {
      const regex = new RegExp(`\\n?${VOCAL_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${VOCAL_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g')
      content = content.replace(regex, '')
    }

    const saveRes = await fetch(`${baseUrl}/themes/${activeTheme.id}/assets.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ asset: { key: assetKey, value: content } }),
    })

    if (!saveRes.ok) throw new Error(`Erreur Shopify: ${await saveRes.text()}`)

    return res.status(200).json({
      success: true,
      action,
      message: action === 'install'
        ? 'Agent vocal installe sur votre boutique Shopify'
        : 'Agent vocal retire de votre boutique Shopify',
    })
  } catch (err) {
    console.error('[shopify-vocal-widget] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
