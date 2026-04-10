import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify Shopify HMAC — strict. Never skip silently.
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret) {
    console.error('[shopify-cart] SHOPIFY_CLIENT_SECRET is not set — refusing webhook')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }
  const hmac = req.headers['x-shopify-hmac-sha256']
  if (!hmac) {
    return res.status(401).json({ error: 'Missing HMAC header' })
  }
  const body = JSON.stringify(req.body)
  const computed = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  // Use timing-safe comparison when buffer lengths match
  let hmacValid = false
  try {
    const a = Buffer.from(computed)
    const b = Buffer.from(hmac)
    hmacValid = a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    hmacValid = false
  }
  if (!hmacValid) {
    return res.status(401).json({ error: 'Invalid HMAC' })
  }

  const shop = req.headers['x-shopify-shop-domain']
  if (!shop) return res.status(400).json({ error: 'Missing shop domain' })

  // Find client by shop domain
  const { data: connection } = await supabase
    .from('client_shopify_connections')
    .select('client_id')
    .eq('shop_domain', shop)
    .maybeSingle()

  if (!connection) return res.status(404).json({ error: 'Client not found for shop' })

  const cart = req.body
  const customerEmail = cart.email || cart.customer?.email
  if (!customerEmail) return res.status(200).json({ skipped: true, reason: 'No customer email' })

  // Check if abandoned_cart playbook is active for this client
  const { data: playbook } = await supabase
    .from('engine_playbooks')
    .select('id')
    .eq('name', 'abandoned_cart')
    .eq('is_active', true)
    .maybeSingle()

  if (!playbook) return res.status(200).json({ skipped: true, reason: 'Playbook not active' })

  const { data: clientPlaybook } = await supabase
    .from('engine_client_playbooks')
    .select('id, is_active, custom_config')
    .eq('client_id', connection.client_id)
    .eq('playbook_id', playbook.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!clientPlaybook) return res.status(200).json({ skipped: true, reason: 'Client has not activated abandoned_cart' })

  // Schedule the recovery email with configurable delay
  const delayMinutes = clientPlaybook.custom_config?.delay_minutes || 60

  // Store the abandoned cart event for delayed processing
  await supabase.from('engine_events').insert({
    client_id: connection.client_id,
    event_type: 'shopify_abandoned_cart',
    source: 'shopify_webhook',
    payload: {
      cart_token: cart.token,
      email: customerEmail,
      customer_name: cart.customer?.first_name || '',
      total_price: cart.total_price,
      currency: cart.currency || 'EUR',
      line_items: (cart.line_items || []).map(i => ({
        title: i.title,
        quantity: i.quantity,
        price: i.price,
        image: i.image?.src,
      })),
      abandoned_checkout_url: cart.abandoned_checkout_url,
      shop_domain: shop,
      delay_minutes: delayMinutes,
      send_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
    },
    status: 'pending_delay',
  })

  return res.status(200).json({ success: true, scheduled_in: `${delayMinutes} minutes` })
}
