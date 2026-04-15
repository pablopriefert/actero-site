import { createClient } from '@supabase/supabase-js'
import { fetchOverdueInvoices, fetchTreasuryBalance } from '../engine/connectors/accounting.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Auth: only allow Vercel Cron or internal secret
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.headers['x-internal-secret'] !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Find all clients with active comptabilite_auto playbook
    const { data: playbook } = await supabase
      .from('engine_playbooks')
      .select('id')
      .eq('name', 'comptabilite_auto')
      .eq('is_active', true)
      .maybeSingle()

    if (!playbook) return res.status(200).json({ message: 'No comptabilite playbook found' })

    const { data: activeClients } = await supabase
      .from('engine_client_playbooks')
      .select('client_id, custom_config')
      .eq('playbook_id', playbook.id)
      .eq('is_active', true)

    if (!activeClients?.length) return res.status(200).json({ message: 'No active clients' })

    const results = []

    for (const cp of activeClients) {
      const clientId = cp.client_id

      // Get client settings
      const { data: settings } = await supabase
        .from('client_settings')
        .select('compta_relance_delai, compta_alerte_seuil, compta_channels')
        .eq('client_id', clientId)
        .maybeSingle()

      const delayThreshold = settings?.compta_relance_delai || 7
      const alertThreshold = settings?.compta_alerte_seuil || 1000
      // compta_channels can be an object {email: true, slack: false} or an array ['email', 'slack']
      const rawChannels = settings?.compta_channels || []
      const channels = Array.isArray(rawChannels)
        ? rawChannels
        : Object.entries(rawChannels).filter(([, v]) => v).map(([k]) => k)

      // Fetch overdue invoices
      const { invoices, provider, error } = await fetchOverdueInvoices(clientId)
      if (error) {
        results.push({ clientId, error })
        continue
      }

      // Filter invoices overdue more than threshold
      const overdueInvoices = invoices.filter(inv => inv.days_overdue >= delayThreshold)

      // Send reminders for overdue invoices
      if (overdueInvoices.length > 0 && (channels.includes('email') || channels.length === 0)) {
        // Get client SMTP config
        const { data: smtp } = await supabase
          .from('client_integrations')
          .select('extra_config, api_key')
          .eq('client_id', clientId)
          .eq('provider', 'smtp_imap')
          .eq('status', 'active')
          .maybeSingle()

        if (smtp?.extra_config?.smtp_host) {
          const { decryptToken } = await import('../lib/crypto.js')
          const smtpConfig = { ...smtp.extra_config, password: decryptToken(smtp.api_key) }

          for (const invoice of overdueInvoices) {
            if (!invoice.client_email) continue
            try {
              let nodemailer
              try { nodemailer = (await import('nodemailer')).default } catch { nodemailer = require('nodemailer') }

              const { data: client } = await supabase.from('clients').select('brand_name').eq('id', clientId).single()
              const brandName = client?.brand_name || 'Service comptabilite'

              const transporter = nodemailer.createTransport({
                host: smtpConfig.smtp_host,
                port: parseInt(smtpConfig.smtp_port) || 587,
                secure: parseInt(smtpConfig.smtp_port) === 465,
                auth: { user: smtpConfig.username, pass: smtpConfig.password },
                tls: { rejectUnauthorized: false },
              })

              await transporter.sendMail({
                from: `${brandName} <${smtpConfig.email || smtpConfig.username}>`,
                to: invoice.client_email,
                subject: `${brandName} — Rappel facture ${invoice.number} en retard`,
                html: `
                  <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
                    <p>Bonjour ${invoice.client_name || ''},</p>
                    <p>Nous vous rappelons que la facture <strong>${invoice.number}</strong> d'un montant de <strong>${invoice.amount}\u20AC</strong> est en retard de <strong>${invoice.days_overdue} jours</strong> (echeance: ${invoice.due_date}).</p>
                    <p>Merci de proceder au reglement dans les meilleurs delais.</p>
                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
                    <p style="color: #999; font-size: 12px;">${brandName} — Comptabilite</p>
                  </div>
                `,
              })
            } catch (emailErr) {
              console.error(`[compta] Email reminder failed for invoice ${invoice.number}:`, emailErr.message)
            }
          }
        }

        // Log to automation_events
        await supabase.from('automation_events').insert({
          client_id: clientId,
          event_category: 'ticket_resolved',
          event_type: 'compta_invoice_reminder',
          ticket_type: 'billing',
          description: `[Compta] ${overdueInvoices.length} relance(s) facture envoyee(s) via ${provider}`,
          metadata: { invoices_count: overdueInvoices.length, provider },
        }).catch(() => {})
      }

      // Check treasury threshold for Slack alerts
      const { total_overdue, overdue_count } = await fetchTreasuryBalance(clientId)
      if (total_overdue > alertThreshold && channels.includes('slack')) {
        // Send Slack notification
        const { data: slackIntegration } = await supabase
          .from('client_integrations')
          .select('extra_config')
          .eq('client_id', clientId)
          .eq('provider', 'slack')
          .eq('status', 'active')
          .maybeSingle()

        if (slackIntegration?.extra_config?.webhook_url) {
          await fetch(slackIntegration.extra_config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `\u26A0\uFE0F Alerte tresorerie: ${overdue_count} facture(s) en retard pour un total de ${total_overdue.toFixed(2)}\u20AC (seuil: ${alertThreshold}\u20AC)`,
            }),
          }).catch(() => {})
        }

        await supabase.from('automation_events').insert({
          client_id: clientId,
          event_category: 'ticket_escalated',
          event_type: 'compta_treasury_alert',
          ticket_type: 'billing',
          description: `[Compta] Alerte tresorerie: ${total_overdue.toFixed(2)}\u20AC en retard (seuil: ${alertThreshold}\u20AC)`,
          metadata: { total_overdue, overdue_count, threshold: alertThreshold },
        }).catch(() => {})
      }

      results.push({ clientId, invoices_reminded: overdueInvoices.length, total_overdue, provider })
    }

    return res.status(200).json({ processed: results.length, results })
  } catch (error) {
    console.error('[cron/comptabilite] Error:', error.message)
    return res.status(500).json({ error: error.message })
  }
}
