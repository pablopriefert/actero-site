import { withSentry } from '../../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Shopify HMAC must be computed against the RAW request body.
// Disable Vercel body parsing so we can read the raw bytes.
export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

async function handler(req, res) {
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

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (err) {
    console.error('[shopify-cart] getRawBody error:', err.message)
    return res.status(400).json({ error: 'Unable to read request body' })
  }

  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
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

  // Parse the JSON body now that the signature is verified
  let parsedBody
  try {
    parsedBody = JSON.parse(rawBody.toString('utf8'))
  } catch (_err) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  req.body = parsedBody

  const shop = req.headers['x-shopify-shop-domain']
  // Là aussi on acquitte, mais on crie dans les journaux.
  //
  // On n'arrive ici qu'APRÈS une signature HMAC valide : c'est donc une
  // livraison authentique de Shopify, et Shopify joint toujours l'en-tête du
  // domaine. Y parvenir signifie que c'est NOUS qui le lisons mal. Un 400
  // ferait réessayer Shopify indéfiniment pour un défaut de notre côté, et
  // gonflerait le taux d'échec — sans jamais le corriger.
  if (!shop) {
    console.error(
      '[shopify-cart] en-tête de domaine absent malgré une HMAC valide — '
      + 'le nom de l\'en-tête a-t-il changé ?',
      Object.keys(req.headers).filter((h) => h.startsWith('x-shopify')),
    )
    return res.status(200).json({ skipped: true, reason: 'Domaine de boutique absent' })
  }

  try {
  // Find client by shop domain
  const { data: connection } = await supabase
    .from('client_shopify_connections')
    .select('client_id')
    .eq('shop_domain', shop)
    .maybeSingle()

  // UNE BOUTIQUE INCONNUE N'EST PAS UN ÉCHEC DE LIVRAISON.
  //
  // Ce 404 était le seul code d'erreur métier des six gestionnaires de
  // webhooks — les cinq autres ne refusent que si le corps est illisible. Or
  // Shopify compte TOUT code non-2xx comme une livraison ratée : il réessaie,
  // fait grimper le taux d'échec affiché dans le Dev Dashboard, et finit par
  // retirer l'abonnement.
  //
  // Le 11 septembre 2026, ce taux était à 33,3 % sur sept jours. Trois
  // abonnements hors conformité, un qui échoue : le compte est exact.
  //
  // Le cas est parfaitement normal : une boutique désinstalle l'app, Shopify
  // livre un `checkouts/create` encore en file, et la connexion n'existe plus.
  // Constaté le 8 septembre — appstoretest9 installée à 17:13, désinstallée à
  // 17:14. Réessayer n'y changera jamais rien : on l'acquitte.
  if (!connection) {
    return res.status(200).json({ skipped: true, reason: 'Boutique non rattachée à un client' })
  }

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
  } catch (err) {
    // Ici le 500 est VOLONTAIRE, contrairement au 404 ci-dessus : une panne de
    // notre côté mérite que Shopify réessaie. Mais le message d'erreur reste
    // chez nous — il n'a rien à faire dans une réponse publique.
    console.error('[shopify-cart] Handler error:', err)
    return res.status(500).json({ error: 'internal_error' })
  }
}

export default withSentry(handler)
