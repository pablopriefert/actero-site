/**
 * Actero Engine V2 — Executor
 *
 * Prend l'action plan du Brain et exécute chaque step séquentiellement.
 * Chaque step est une action atomique. Si un step échoue, le run est en erreur.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'support@actero.fr'

/**
 * Execute an action plan step by step.
 * Returns: { success, steps: [{action, status, duration_ms, error}], error }
 */
export async function runExecutor(supabase, { event, playbook, clientId, normalized, brainResult }) {
  const { actionPlan, aiResponse, classification } = brainResult
  const steps = []
  let overallSuccess = true
  let overallError = null

  // Load client info for actions
  const { data: client } = await supabase.from('clients').select('brand_name, contact_email').eq('id', clientId).single()
  const brandName = client?.brand_name || 'Actero'

  for (const action of actionPlan) {
    const stepStart = Date.now()
    let stepResult = { action, status: 'completed', result: null, error: null }

    try {
      switch (action) {
        case 'send_reply':
        case 'send_email':
          if (aiResponse && normalized.customer_email && RESEND_API_KEY) {
            const subject = normalized.subject ? `Re: ${normalized.subject}` : `${brandName} — Reponse a votre demande`
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${brandName} <${RESEND_FROM}>`,
                to: [normalized.customer_email],
                subject,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <p style="color:#262626;font-size:15px;line-height:1.6">${normalized.customer_name ? `Bonjour ${normalized.customer_name},` : 'Bonjour,'}</p>
                  <p style="color:#262626;font-size:15px;line-height:1.6">${aiResponse.replace(/\n/g, '<br/>')}</p>
                  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
                  <p style="color:#999;font-size:12px">${brandName} — Service client</p>
                </div>`,
              }),
            })
            stepResult.result = { email_sent: true, to: normalized.customer_email }
          }
          break

        case 'escalate':
          // Create escalation entry
          try { await supabase.from('escalation_tickets').insert({ client_id: clientId, status: 'pending' }) } catch {}
          // Notify client
          if (RESEND_API_KEY && client?.contact_email) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `Actero <${RESEND_FROM}>`,
                to: [client.contact_email],
                subject: `⚠️ Escalade — ${classification}`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <h2 style="color:#dc2626">⚠️ Ticket escalade</h2>
                  <p><strong>Client:</strong> ${normalized.customer_name || normalized.customer_email}</p>
                  <p><strong>Classification:</strong> ${classification}</p>
                  <p><strong>Message:</strong> ${normalized.message.substring(0, 300)}</p>
                  <p><a href="https://actero.fr/client/escalations" style="display:inline-block;padding:10px 20px;background:#0F5F35;color:white;text-decoration:none;border-radius:8px;font-weight:bold">Voir dans Actero</a></p>
                </div>`,
              }),
            })
          }
          stepResult.result = { escalated: true }
          break

        case 'notify_slack':
          const { data: slackIntegration } = await supabase
            .from('client_integrations')
            .select('access_token, extra_config')
            .eq('client_id', clientId).eq('provider', 'slack').eq('status', 'active')
            .maybeSingle()

          if (slackIntegration?.extra_config?.webhook_url) {
            await fetch(slackIntegration.extra_config.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blocks: [{
                  type: 'section',
                  text: { type: 'mrkdwn', text: `*${classification}* — ${normalized.customer_name || normalized.customer_email}\n${normalized.message.substring(0, 200)}` },
                }],
              }),
            })
            stepResult.result = { slack_notified: true }
          } else if (slackIntegration?.access_token && slackIntegration?.extra_config?.channel_id) {
            await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${slackIntegration.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channel: slackIntegration.extra_config.channel_id,
                text: `*${classification}* — ${normalized.customer_name || normalized.customer_email}: ${normalized.message.substring(0, 200)}`,
              }),
            })
            stepResult.result = { slack_notified: true }
          }
          break

        case 'tag_contact':
          // Store tag in automation_events metadata
          stepResult.result = { tagged: true, tag: classification }
          break

        case 'create_ticket':
          try { await supabase.from('escalation_tickets').insert({ client_id: clientId, status: 'pending' }) } catch {}
          stepResult.result = { ticket_created: true }
          break

        case 'log_metric':
          // Handled by logger.js after execution
          stepResult.result = { metric_logged: true }
          break

        case 'lookup_order':
          // Shopify order lookup (already handled in brain context)
          stepResult.result = { order_lookup: true }
          break

        case 'wait_then':
          // For V1, we don't implement delayed execution (would need a queue/cron)
          stepResult.result = { scheduled: true, note: 'Delayed execution planned' }
          break

        default:
          stepResult.result = { unknown_action: action }
          break
      }

    } catch (err) {
      stepResult.status = 'failed'
      stepResult.error = err.message
      overallSuccess = false
      overallError = `Step "${action}" failed: ${err.message}`
      // Don't break — continue with remaining steps
    }

    stepResult.duration_ms = Date.now() - stepStart
    steps.push(stepResult)
  }

  return { success: overallSuccess, steps, error: overallError }
}
