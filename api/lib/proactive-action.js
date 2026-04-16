/**
 * Actero — Proactive Action Executor
 *
 * Given a new detection, sends the appropriate proactive action (email via
 * client SMTP) with a personalized message using Claude.
 *
 * Reuses the existing SMTP infra from api/escalation/respond.js.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

let _anthropic = null
function getAnthropic() {
  if (_anthropic) return _anthropic
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

/**
 * Compose a proactive email using Claude with the detection context + brand voice.
 * Returns { subject, body_html, body_text }.
 */
async function composeEmail(supabase, clientId, event) {
  const { data: client } = await supabase.from('clients')
    .select('brand_name')
    .eq('id', clientId).maybeSingle()

  const { data: settings } = await supabase.from('client_settings')
    .select('brand_tone, email_signature, tone_style')
    .eq('client_id', clientId).maybeSingle()

  const brandName = client?.brand_name || 'notre équipe'
  const brandTone = settings?.brand_tone || settings?.tone_style || 'chaleureux et professionnel'
  const signature = settings?.email_signature || `— L'équipe ${brandName}`
  const customerFirstName = (event.customer_name || '').split(' ')[0]

  const contextByRule = {
    shipment_delayed: `Votre client a commandé et son colis est bloqué depuis ${event.trigger_data?.hours_since_update || 'plusieurs'} heures.
- Statut actuel : ${event.trigger_data?.status_label || event.trigger_data?.status}
- Transporteur : ${event.trigger_data?.carrier || 'transporteur'}
- Numéro de suivi : ${event.trigger_data?.tracking_number || '—'}
${event.trigger_data?.tracking_url ? `- Lien de suivi : ${event.trigger_data.tracking_url}` : ''}

Écris un email PROACTIF (ton de la marque) qui :
1. Salue le client par son prénom
2. Reconnaît le problème AVANT qu'il ne se plaigne
3. Explique en 1 ligne le statut
4. Offre une solution concrète (surveillance renforcée, recontact sous 48h)
5. S'excuse et remercie pour la patience
6. Reste court (max 6 lignes)`,

    failed_payment: `Le paiement de la commande #${event.trigger_data?.order_number || '—'} n'a pas abouti (total ${event.trigger_data?.total || '?'} ${event.trigger_data?.currency || 'EUR'}).
- Commande passée le ${event.trigger_data?.created_at || '—'}
- Statut : ${event.trigger_data?.financial_status}
${event.trigger_data?.checkout_url ? `- Lien pour finaliser : ${event.trigger_data.checkout_url}` : ''}

Écris un email (ton de la marque) qui :
1. Salue le client par son prénom
2. Explique gentiment que le paiement n'a pas été validé
3. Rassure : "votre commande est encore réservée 24h"
4. Met en avant le lien pour finaliser
5. Offre de l'aide si problème carte
6. Reste court (max 5 lignes)`,

    silent_vip: `C'est un client VIP : total dépensé ${event.trigger_data?.total_spent}€, ${event.trigger_data?.orders_count} commandes, silencieux depuis ${event.trigger_data?.days_silent} jours.

Écris un email CHALEUREUX (ton de la marque) qui :
1. Salue par prénom
2. Exprime qu'il nous manque (sans être pushy)
3. Mentionne subtilement qu'il fait partie de tes meilleurs clients
4. Propose une attention : code privilège, accès aperçu nouveauté, rien de spammy
5. Termine avec une ouverture "dis-nous ce qui te ferait plaisir"
6. Court (max 6 lignes)`,
  }

  const prompt = contextByRule[event.rule_name]
  if (!prompt) throw new Error(`No template for rule ${event.rule_name}`)

  const systemMsg = `Tu es l'assistant email de la marque "${brandName}". Ton de marque : ${brandTone}.
Tu écris des emails proactifs (avant que le client se plaigne).
RÈGLES :
- Français natif, fluide, jamais corporate robotique
- Ne jamais dire "Cher client" → utilise son prénom${customerFirstName ? ` (${customerFirstName})` : ' (ou "Bonjour" si pas de prénom)'}
- Ne jamais dire "nous sommes désolés pour la gêne occasionnée" → reformule naturellement
- Jamais promettre ce qu'on ne peut pas tenir
- Signer avec : ${signature}

Tu renvoies STRICTEMENT un JSON : { "subject": "...", "body": "..." }
Le body est du texte simple (pas de HTML), avec \\n entre paragraphes.`

  const resp = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: systemMsg,
    messages: [{ role: 'user', content: prompt + '\n\nRéponds UNIQUEMENT avec le JSON demandé.' }],
  })

  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  // Extract JSON
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in LLM output')
  const parsed = JSON.parse(match[0])
  return {
    subject: parsed.subject || `Un message de ${brandName}`,
    body_text: parsed.body,
    body_html: parsed.body
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>'),
  }
}

/**
 * Send an email via the client's SMTP integration.
 * Reuses the same approach as /api/escalation/respond.js.
 */
async function sendViaSMTP(supabase, clientId, { to, subject, html, brandName }) {
  const { data: smtp } = await supabase.from('client_integrations')
    .select('api_key, extra_config')
    .eq('client_id', clientId).eq('provider', 'smtp_imap').eq('status', 'active')
    .maybeSingle()
  if (!smtp || !smtp.extra_config?.smtp_host) {
    return { sent: false, error: 'SMTP non configuré' }
  }

  const { decryptToken } = await import('./crypto.js')
  const password = decryptToken(smtp.api_key) || smtp.api_key
  const config = { ...smtp.extra_config, password }

  let nodemailer
  try {
    nodemailer = (await import('nodemailer')).default
  } catch {
    return { sent: false, error: 'nodemailer not available' }
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10) || 587,
    secure: parseInt(config.smtp_port, 10) === 465,
    auth: { user: config.username, pass: password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
  })

  try {
    const fromEmail = config.email || config.username
    const info = await transporter.sendMail({
      from: brandName ? `${brandName} <${fromEmail}>` : fromEmail,
      to, subject, html,
    })
    return { sent: true, from: fromEmail, messageId: info.messageId }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

/**
 * Execute the action for a pending proactive event.
 */
export async function executeProactiveAction(supabase, event) {
  if (!event.customer_email) {
    await supabase.from('proactive_events').update({
      action_status: 'skipped', action_error: 'no customer email',
    }).eq('id', event.id)
    return { ok: false, reason: 'no_email' }
  }

  try {
    const { data: client } = await supabase.from('clients')
      .select('brand_name').eq('id', event.client_id).maybeSingle()
    const brandName = client?.brand_name || 'Support'

    const { subject, body_html, body_text } = await composeEmail(supabase, event.client_id, event)
    const result = await sendViaSMTP(supabase, event.client_id, {
      to: event.customer_email, subject, html: body_html, brandName,
    })

    await supabase.from('proactive_events').update({
      action_status: result.sent ? 'sent' : 'failed',
      action_subject: subject,
      action_body: body_text,
      action_error: result.sent ? null : (result.error || 'unknown'),
      sent_at: result.sent ? new Date().toISOString() : null,
    }).eq('id', event.id)

    return { ok: result.sent, error: result.error }
  } catch (err) {
    await supabase.from('proactive_events').update({
      action_status: 'failed', action_error: err.message,
    }).eq('id', event.id)
    return { ok: false, error: err.message }
  }
}
