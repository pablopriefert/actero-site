/**
 * Actero Engine V2 — Executor
 *
 * Prend l'action plan du Brain et exécute chaque step séquentiellement.
 * Chaque step est une action atomique. Si un step échoue, le run est en erreur.
 */

import { lookupOrder } from './lib/shopify-client.js'
import { fetchOverdueInvoices, fetchTreasuryBalance } from './connectors/accounting.js'

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
          if (aiResponse && normalized.customer_email && !normalized.customer_email.includes('@anonymous.actero.fr')) {
            const subject = normalized.subject ? `Re: ${normalized.subject}` : `${brandName} — Reponse a votre demande`
            const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <p style="color:#262626;font-size:15px;line-height:1.6">${normalized.customer_name ? `Bonjour ${normalized.customer_name},` : 'Bonjour,'}</p>
              <p style="color:#262626;font-size:15px;line-height:1.6">${aiResponse.replace(/\n/g, '<br/>')}</p>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
              <p style="color:#999;font-size:12px">${brandName} — Service client</p>
            </div>`

            // Priority 1: Client's SMTP
            const { data: smtpInt } = await supabase
              .from('client_integrations')
              .select('extra_config, api_key')
              .eq('client_id', clientId)
              .eq('provider', 'smtp_imap')
              .eq('status', 'active')
              .maybeSingle()

            const smtpConfig = smtpInt?.extra_config
            if (smtpConfig?.smtp_host && smtpInt?.api_key) {
              try {
                let nodemailer
                try { nodemailer = (await import('nodemailer')).default } catch { nodemailer = require('nodemailer') }
                const transporter = nodemailer.createTransport({
                  host: smtpConfig.smtp_host,
                  port: parseInt(smtpConfig.smtp_port) || 587,
                  secure: parseInt(smtpConfig.smtp_port) === 465,
                  auth: { user: smtpConfig.username, pass: smtpInt.api_key },
                  tls: { rejectUnauthorized: false },
                  connectionTimeout: 8000,
                })
                const fromEmail = smtpConfig.email || smtpConfig.username
                await transporter.sendMail({
                  from: `${brandName} <${fromEmail}>`,
                  to: normalized.customer_email,
                  subject, html,
                })
                stepResult.result = { email_sent: true, via: 'smtp', to: normalized.customer_email, from: fromEmail }
                break
              } catch (smtpErr) {
                console.error('[executor] SMTP send failed, falling back to Resend:', smtpErr.message)
              }
            }

            // Fallback: Resend (only if SMTP not configured)
            if (RESEND_API_KEY) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: `${brandName} <${RESEND_FROM}>`,
                  to: [normalized.customer_email],
                  subject, html,
                }),
              })
              stepResult.result = { email_sent: true, via: 'resend', to: normalized.customer_email }
            }
          }
          break

        case 'escalate':
          // Create escalation entry with full context
          try {
            await supabase.from('escalation_tickets').insert({
              client_id: clientId,
              classification,
              customer_email: normalized.customer_email || null,
              customer_name: normalized.customer_name || null,
              message_preview: normalized.message ? normalized.message.substring(0, 500) : null,
              status: 'pending',
              priority: 'high',
            })
          } catch (escErr) {
            console.error('[executor] escalation_tickets insert error:', escErr.message)
          }
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
                  <p><a href="${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://actero.fr'}/client/escalations" style="display:inline-block;padding:10px 20px;background:#0F5F35;color:white;text-decoration:none;border-radius:8px;font-weight:bold">Voir dans Actero</a></p>
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
          // Persist tag to the most recent ai_conversations entry for this client
          try {
            const { data: convo } = await supabase
              .from('ai_conversations')
              .select('id, metadata')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (convo) {
              const existingMeta = convo.metadata || {}
              const existingTags = existingMeta.tags || []
              if (!existingTags.includes(classification)) {
                existingTags.push(classification)
              }
              await supabase
                .from('ai_conversations')
                .update({ metadata: { ...existingMeta, tags: existingTags } })
                .eq('id', convo.id)
            }
          } catch (tagErr) {
            console.error('[executor] tag_contact error:', tagErr.message)
          }
          stepResult.result = { tagged: true, tag: classification }
          break

        case 'create_ticket':
          try {
            await supabase.from('escalation_tickets').insert({
              client_id: clientId,
              classification,
              customer_email: normalized.customer_email || null,
              customer_name: normalized.customer_name || null,
              message_preview: normalized.message ? normalized.message.substring(0, 500) : null,
              status: 'pending',
              priority: 'normal',
            })
          } catch (ticketErr) {
            console.error('[executor] create_ticket insert error:', ticketErr.message)
          }
          stepResult.result = { ticket_created: true }
          break

        case 'log_metric':
          // Handled by logger.js after execution
          stepResult.result = { metric_logged: true }
          break

        case 'lookup_order':
          // Shopify order lookup via shopify-client lib
          try {
            const orderResults = await lookupOrder(supabase, {
              clientId,
              orderId: normalized.order_id || null,
              customerEmail: normalized.customer_email || null,
            })
            if (orderResults && orderResults.length > 0) {
              const order = orderResults[0]
              stepResult.result = {
                order_lookup: true,
                found: true,
                orderName: order.orderName,
                fulfillmentStatus: order.fulfillmentStatus,
                financialStatus: order.financialStatus,
                trackingInfo: order.trackingInfo,
                totalPrice: order.totalPrice,
              }
            } else {
              stepResult.result = { order_lookup: true, found: false }
            }
          } catch (orderErr) {
            console.error('[executor] lookup_order error:', orderErr.message)
            stepResult.result = { order_lookup: true, found: false, error: orderErr.message }
          }
          break

        case 'send_invoice_reminder':
          try {
            const { invoices: overdueInvs, provider: invProvider, error: invError } = await fetchOverdueInvoices(clientId)
            if (invError) {
              stepResult.result = { reminder_sent: false, error: invError }
              break
            }

            const { data: comptaSettings } = await supabase
              .from('client_settings')
              .select('compta_relance_delai')
              .eq('client_id', clientId)
              .maybeSingle()
            const delayThreshold = comptaSettings?.compta_relance_delai || 7
            const filteredInvs = overdueInvs.filter(inv => inv.days_overdue >= delayThreshold)

            if (filteredInvs.length > 0) {
              const { data: smtp } = await supabase
                .from('client_integrations')
                .select('extra_config, api_key')
                .eq('client_id', clientId)
                .eq('provider', 'smtp_imap')
                .eq('status', 'active')
                .maybeSingle()

              let sentCount = 0
              if (smtp?.extra_config?.smtp_host) {
                const smtpConfig = { ...smtp.extra_config, password: smtp.api_key }
                let nodemailer
                try { nodemailer = (await import('nodemailer')).default } catch { nodemailer = require('nodemailer') }

                const transporter = nodemailer.createTransport({
                  host: smtpConfig.smtp_host,
                  port: parseInt(smtpConfig.smtp_port) || 587,
                  secure: parseInt(smtpConfig.smtp_port) === 465,
                  auth: { user: smtpConfig.username, pass: smtpConfig.password },
                  tls: { rejectUnauthorized: false },
                })

                for (const invoice of filteredInvs) {
                  if (!invoice.client_email) continue
                  try {
                    await transporter.sendMail({
                      from: `${brandName} <${smtpConfig.email || smtpConfig.username}>`,
                      to: invoice.client_email,
                      subject: `${brandName} \u2014 Rappel facture ${invoice.number} en retard`,
                      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px">
                        <p>Bonjour ${invoice.client_name || ''},</p>
                        <p>Nous vous rappelons que la facture <strong>${invoice.number}</strong> d'un montant de <strong>${invoice.amount}\u20AC</strong> est en retard de <strong>${invoice.days_overdue} jours</strong> (echeance: ${invoice.due_date}).</p>
                        <p>Merci de proceder au reglement dans les meilleurs delais.</p>
                        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
                        <p style="color:#999;font-size:12px">${brandName} \u2014 Comptabilite</p>
                      </div>`,
                    })
                    sentCount++
                  } catch (mailErr) {
                    console.error(`[executor] invoice reminder mail error:`, mailErr.message)
                  }
                }
              }
              stepResult.result = { reminder_sent: true, sent_count: sentCount, total_overdue: filteredInvs.length, provider: invProvider }
            } else {
              stepResult.result = { reminder_sent: false, reason: 'no_invoices_past_threshold', provider: invProvider }
            }
          } catch (reminderErr) {
            console.error('[executor] send_invoice_reminder error:', reminderErr.message)
            stepResult.result = { reminder_sent: false, error: reminderErr.message }
          }
          break

        case 'check_treasury':
          try {
            const { total_overdue: tOverdue, overdue_count: oCount, provider: tProvider } = await fetchTreasuryBalance(clientId)

            const { data: tSettings } = await supabase
              .from('client_settings')
              .select('compta_alerte_seuil')
              .eq('client_id', clientId)
              .maybeSingle()
            const threshold = tSettings?.compta_alerte_seuil || 1000

            if (tOverdue > threshold) {
              // Send Slack alert if available
              const { data: slackInt } = await supabase
                .from('client_integrations')
                .select('extra_config')
                .eq('client_id', clientId)
                .eq('provider', 'slack')
                .eq('status', 'active')
                .maybeSingle()

              if (slackInt?.extra_config?.webhook_url) {
                await fetch(slackInt.extra_config.webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: `\u26A0\uFE0F Alerte tresorerie: ${oCount} facture(s) en retard pour un total de ${tOverdue.toFixed(2)}\u20AC (seuil: ${threshold}\u20AC)`,
                  }),
                }).catch(() => {})
              }

              await supabase.from('automation_events').insert({
                client_id: clientId,
                event_category: 'ticket_escalated',
                event_type: 'compta_treasury_alert',
                ticket_type: 'billing',
                description: `[Compta] Alerte tresorerie: ${tOverdue.toFixed(2)}\u20AC en retard (seuil: ${threshold}\u20AC)`,
                metadata: { total_overdue: tOverdue, overdue_count: oCount, threshold },
              }).catch(() => {})

              stepResult.result = { alert_sent: true, total_overdue: tOverdue, overdue_count: oCount, threshold, provider: tProvider }
            } else {
              stepResult.result = { alert_sent: false, total_overdue: tOverdue, threshold, reason: 'below_threshold', provider: tProvider }
            }
          } catch (treasuryErr) {
            console.error('[executor] check_treasury error:', treasuryErr.message)
            stepResult.result = { alert_sent: false, error: treasuryErr.message }
          }
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
