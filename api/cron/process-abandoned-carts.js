import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { track, trackShopperRecovery } from '../lib/customerio.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Allow up to 60s so slow SMTPs don't kill the lambda before Sentry gets
// the final cron check-in. Batch is capped below to stay within this budget.
export const maxDuration = 60

/**
 * Send email via SMTP using nodemailer (loaded dynamically to avoid bundle issues).
 */
async function sendViaSMTP(smtpConfig, { to, subject, html, brandName }) {
  let nodemailer
  try {
    nodemailer = (await import('nodemailer')).default
  } catch (e1) {
    try {
      nodemailer = require('nodemailer')
    } catch (e2) {
      throw new Error('nodemailer not available: ' + e1.message)
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.smtp_host,
    port: parseInt(smtpConfig.smtp_port) || 587,
    secure: parseInt(smtpConfig.smtp_port) === 465,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  })

  const fromEmail = smtpConfig.email || smtpConfig.username
  const fromDisplay = brandName ? `${brandName} <${fromEmail}>` : fromEmail

  const info = await transporter.sendMail({ from: fromDisplay, to, subject, html })
  return { sent: true, from: fromEmail, messageId: info.messageId }
}

/**
 * Build a branded abandoned cart recovery email.
 */
function buildCartRecoveryHtml({ customerName, lineItems, totalPrice, currency, checkoutUrl, brandName }) {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  const currencySymbol = currency === 'EUR' ? '\u20AC' : currency

  const itemRows = (lineItems || []).map(item => {
    const imgHtml = item.image
      ? `<img src="${item.image}" alt="${item.title}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" />`
      : `<div style="width:64px;height:64px;background:#f5f5f5;border-radius:8px;"></div>`
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:middle;">
          ${imgHtml}
        </td>
        <td style="padding:12px 12px;border-bottom:1px solid #f0f0f0;vertical-align:middle;">
          <p style="margin:0;font-size:14px;color:#262626;font-weight:600;">${item.title}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#999;">Quantite : ${item.quantity}</p>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:middle;text-align:right;">
          <p style="margin:0;font-size:14px;color:#262626;font-weight:600;">${item.price} ${currencySymbol}</p>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;background:#ffffff;">
      <p style="color:#262626;font-size:15px;line-height:1.6;">${greeting}</p>
      <p style="color:#262626;font-size:15px;line-height:1.6;">
        Vous avez laisse des articles dans votre panier. Pas d'inquietude, ils sont toujours disponibles !
      </p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        ${itemRows}
      </table>

      <div style="text-align:right;margin:16px 0 32px;">
        <p style="font-size:16px;color:#262626;font-weight:700;margin:0;">
          Total : ${totalPrice} ${currencySymbol}
        </p>
      </div>

      <div style="text-align:center;margin:32px 0;">
        <a href="${checkoutUrl}" style="display:inline-block;padding:14px 32px;background:#0E653A;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
          Finaliser ma commande
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
      <p style="color:#999;font-size:12px;text-align:center;">
        ${brandName} — Cet email a ete envoye car vous avez laisse des articles dans votre panier.<br/>
        Si vous avez deja finalise votre commande, ignorez ce message.
      </p>
    </div>
  `
}

async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require Vercel cron secret or internal secret. If neither is configured
  // the endpoint refuses to run (fail-closed).
  const cronSecret = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_API_SECRET
  const authHeader = req.headers.authorization || ''
  const internalHeader = req.headers['x-internal-secret']
  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (internalSecret && internalHeader === internalSecret)
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date().toISOString()

  // 1. Fetch pending abandoned cart events whose send_at has passed
  const { data: events, error: fetchError } = await supabase
    .from('engine_events')
    .select('*')
    .eq('event_type', 'shopify_abandoned_cart')
    .eq('status', 'pending_delay')
    .order('received_at', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error('[cron/abandoned-carts] Fetch error:', fetchError.message)
    return res.status(500).json({ error: fetchError.message })
  }

  // Filter events whose send_at has passed
  const readyEvents = (events || []).filter(e => {
    const sendAt = e.payload?.send_at
    return sendAt && new Date(sendAt) <= new Date(now)
  })

  if (readyEvents.length === 0) {
    return res.status(200).json({ processed: 0, message: 'No carts ready to process' })
  }

  let processed = 0
  let errors = 0

  for (const event of readyEvents) {
    const { client_id, payload } = event

    try {
      // 2. Get client info for branding
      const { data: client } = await supabase
        .from('clients')
        .select('brand_name, contact_email')
        .eq('id', client_id)
        .maybeSingle()

      const brandName = client?.brand_name || 'Votre boutique'

      // 3. Get SMTP config + recovery toggle in parallel
      const [{ data: smtpConfig }, { data: settings }] = await Promise.all([
        supabase
          .from('client_integrations')
          .select('config')
          .eq('client_id', client_id)
          .eq('provider', 'smtp_imap')
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('client_settings')
          .select('recovery_sms_enabled')
          .eq('client_id', client_id)
          .maybeSingle(),
      ])

      if (!smtpConfig?.config) {
        // No SMTP configured — mark as skipped
        await supabase.from('engine_events').update({
          status: 'skipped',
          payload: { ...payload, skip_reason: 'No SMTP configured' },
        }).eq('id', event.id)
        continue
      }

      // 4. Build and send the recovery email
      const html = buildCartRecoveryHtml({
        customerName: payload.customer_name,
        lineItems: payload.line_items,
        totalPrice: payload.total_price,
        currency: payload.currency,
        checkoutUrl: payload.abandoned_checkout_url,
        brandName,
      })

      await sendViaSMTP(smtpConfig.config, {
        to: payload.email,
        subject: `${brandName} — Votre panier vous attend`,
        html,
        brandName,
      })

      // 5. Mark event as completed
      await supabase.from('engine_events').update({
        status: 'completed',
        payload: { ...payload, sent_at: new Date().toISOString() },
      }).eq('id', event.id)

      // 5b. SMS recovery via Customer.io — fire-and-forget, off the email path.
      // The merchant configures a CIO Journey on `cart_abandoned_recovery`
      // with an SMS step that uses the shopper_phone attribute.
      if (settings?.recovery_sms_enabled) {
        const phone = payload.phone
          || payload.shipping_address?.phone
          || payload.billing_address?.phone
          || null
        trackShopperRecovery({
          merchantId: client_id,
          brandName,
          shopperEmail: payload.email,
          shopperPhone: phone,
          shopperFirstName: payload.customer_name?.split(' ')[0] || null,
          cartValue: payload.total_price,
          currency: payload.currency,
          recoveryUrl: payload.abandoned_checkout_url,
          items: (payload.line_items || []).map((it) => ({
            title: it.title || it.name,
            quantity: it.quantity,
            price: it.price,
          })).slice(0, 10),
        }).catch(() => {}) // never block the email path
      }

      // CIO — first_cart_recovered: emit only on the first successful cart recovery for this client
      try {
        const { count: recoveredCount } = await supabase
          .from('engine_events')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client_id)
          .eq('event_type', 'shopify_abandoned_cart')
          .eq('status', 'completed')
        if (recoveredCount === 1) {
          track(client_id, 'first_cart_recovered', {
            shop_domain: payload.shop_domain || '',
            total_price: payload.total_price || 0,
            currency: payload.currency || 'EUR',
          }).catch(() => {})
        }
      } catch { /* non-blocking */ }

      processed++
    } catch (err) {
      console.error(`[cron/abandoned-carts] Error processing event ${event.id}:`, err.message)
      await supabase.from('engine_events').update({
        status: 'failed',
        payload: { ...payload, error: err.message },
      }).eq('id', event.id)
      errors++
    }
  }

  return res.status(200).json({ processed, errors, total_ready: readyEvents.length })
}

export default withCronMonitor('cron-process-abandoned-carts', '*/5 * * * *', handler)
