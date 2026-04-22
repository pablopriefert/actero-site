import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { withCronMonitor } from '../lib/cron-monitor.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMonthYear(date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function getPreviousMonthRange(now = new Date()) {
  // Previous month: [start, end] as Date; also its comparison = 2-month-ago
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endPrev = new Date(now.getFullYear(), now.getMonth(), 1)
  const startPrevPrev = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  return { startPrev, endPrev, startPrevPrev }
}

function variationPct(cur, prev) {
  if (!prev || prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function variationBadge(v) {
  if (v === 0) return { arrow: '▬', color: '#9ca3af', sign: '' }
  if (v > 0) return { arrow: '▲', color: '#0E653A', sign: '+' }
  return { arrow: '▼', color: '#dc2626', sign: '' }
}

/* -------------------------------------------------------------------------- */
/* SMTP sender (reuses client_integrations smtp_imap, fallback Resend)        */
/* -------------------------------------------------------------------------- */

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
    auth: { user: smtpConfig.username, pass: smtpConfig.password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  })

  const fromEmail = smtpConfig.email || smtpConfig.username
  const fromDisplay = brandName ? `${brandName} <${fromEmail}>` : fromEmail
  return transporter.sendMail({ from: fromDisplay, to, subject, html })
}

async function sendEmail(clientId, { to, subject, html, brandName }) {
  // 1) Try client SMTP
  const { data: smtp } = await supabase
    .from('client_integrations')
    .select('extra_config, api_key')
    .eq('client_id', clientId)
    .eq('provider', 'smtp_imap')
    .eq('status', 'active')
    .maybeSingle()

  if (smtp?.extra_config?.smtp_host) {
    try {
      const { decryptToken } = await import('../lib/crypto.js')
      const smtpConfig = { ...smtp.extra_config, password: decryptToken(smtp.api_key) }
      await sendViaSMTP(smtpConfig, { to, subject, html, brandName })
      return { provider: 'smtp' }
    } catch (err) {
      console.error(`[monthly-report] SMTP failed for client ${clientId}:`, err.message)
    }
  }

  // 2) Fallback Resend
  if (!resend) throw new Error('No email provider available (no SMTP, no RESEND_API_KEY)')
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
    to: [to],
    subject,
    html,
  })
  if (error) throw new Error(`Resend failed: ${error.message || error}`)
  return { provider: 'resend' }
}

/* -------------------------------------------------------------------------- */
/* Metric aggregation                                                         */
/* -------------------------------------------------------------------------- */

async function computeMonthlyStats(clientId, start, end) {
  // metrics_daily range [start, end)
  const { data: daily = [] } = await supabase
    .from('metrics_daily')
    .select('time_saved_minutes, estimated_roi, tasks_executed, tickets_auto, tickets_escalated, tickets_total')
    .eq('client_id', clientId)
    .gte('date', start.toISOString().split('T')[0])
    .lt('date', end.toISOString().split('T')[0])

  // automation_events for category / classification
  const { data: events = [] } = await supabase
    .from('automation_events')
    .select('event_category, ticket_type, time_saved_seconds, revenue_amount')
    .eq('client_id', clientId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  const sumMinutes = daily.reduce((s, d) => s + (Number(d.time_saved_minutes) || 0), 0)
  const sumRoi = daily.reduce((s, d) => s + (Number(d.estimated_roi) || 0), 0)
  const sumTicketsAuto = daily.reduce((s, d) => s + (Number(d.tickets_auto) || 0), 0)
  const sumTasks = daily.reduce((s, d) => s + (Number(d.tasks_executed) || 0), 0)

  // Fallback via events if daily missing
  const fallbackMinutes = events.reduce((s, e) => s + (Number(e.time_saved_seconds) || 0), 0) / 60
  const fallbackRoi = events.reduce((s, e) => s + (Number(e.revenue_amount) || 0), 0)
  const fallbackResolved = events.filter(e => e.event_category === 'ticket_resolved').length

  // Classification: top 5 ticket_type
  const classCount = {}
  events.forEach(e => {
    const t = e.ticket_type || 'autre'
    classCount[t] = (classCount[t] || 0) + 1
  })
  const totalClassified = Object.values(classCount).reduce((s, v) => s + v, 0) || 1
  const topProblems = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / totalClassified) * 100),
    }))

  return {
    tickets_resolved: sumTicketsAuto || fallbackResolved,
    hours_saved: Math.round(((sumMinutes || fallbackMinutes) / 60) * 10) / 10,
    roi: Math.round(sumRoi || fallbackRoi),
    tasks_executed: sumTasks || events.length,
    top_problems: topProblems,
  }
}

/* -------------------------------------------------------------------------- */
/* HTML report builder                                                        */
/* -------------------------------------------------------------------------- */

const TICKET_TYPE_LABELS = {
  tracking: 'Suivi de commande',
  address: 'Changement d\'adresse',
  return: 'Retours & remboursements',
  other: 'Autres',
  autre: 'Autres',
  product: 'Questions produit',
  shipping: 'Livraison',
  refund: 'Remboursement',
  cancel: 'Annulation',
}

function labelForType(t) {
  return TICKET_TYPE_LABELS[t] || (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : 'Autres')
}

function buildReportHtml({ brandName, periodLabel, current, previous }) {
  const safeName = escapeHtml(brandName)
  const safePeriod = escapeHtml(periodLabel)

  const varTickets = variationPct(current.tickets_resolved, previous.tickets_resolved)
  const varHours = variationPct(current.hours_saved, previous.hours_saved)
  const varRoi = variationPct(current.roi, previous.roi)
  const varTasks = variationPct(current.tasks_executed, previous.tasks_executed)

  const badge = (v) => {
    const b = variationBadge(v)
    return `<span style="color:${b.color};font-size:11px;font-weight:700;">${b.arrow} ${b.sign}${v}%</span>`
  }

  const metricCard = (label, value, suffix, v) => `
    <td width="50%" style="padding:18px 16px;background:#fafafa;border:1px solid #f0f0f0;border-radius:12px;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${label}</div>
      <div style="font-size:26px;font-weight:800;color:#0E653A;margin-top:6px;letter-spacing:-0.5px;">
        ${value}${suffix ? `<span style="font-size:16px;font-weight:700;color:#1a1a1a;"> ${suffix}</span>` : ''}
      </div>
      <div style="margin-top:6px;">${badge(v)}</div>
    </td>`

  const topRows = (current.top_problems || [])
    .map((p) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:13px;color:#1a1a1a;font-weight:500;">${escapeHtml(labelForType(p.type))}</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">
          <span style="font-size:13px;color:#0E653A;font-weight:700;">${p.pct}%</span>
          <span style="font-size:11px;color:#9ca3af;margin-left:6px;">(${p.count})</span>
        </td>
      </tr>`)
    .join('') || `
      <tr><td colspan="2" style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;">
        Aucune classification sur ce mois
      </td></tr>`

  // Simple ROI detail: time_saved_minutes * hourly_rate implied by estimated_roi / hours
  const implicitHourly = current.hours_saved > 0 ? Math.round(current.roi / current.hours_saved) : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="padding:32px 32px 0 32px;">
          <table width="100%"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:20px;font-weight:800;color:#0E653A;letter-spacing:-0.5px;">Actero</div>
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">${safeName}</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:28px 32px 16px 32px;">
          <h1 style="font-size:24px;font-weight:800;color:#1a1a1a;margin:0 0 6px 0;letter-spacing:-0.5px;">
            Votre rapport mensuel — ${safePeriod}
          </h1>
          <p style="font-size:14px;color:#6b7280;margin:0;">Voici vos performances pour le mois, ${safeName}.</p>
        </td></tr>

        <!-- Vos chiffres -->
        <tr><td style="padding:12px 32px 4px 32px;">
          <h2 style="font-size:13px;font-weight:700;color:#1a1a1a;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.05em;">Vos chiffres</h2>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              ${metricCard('Tickets resolus', current.tickets_resolved.toLocaleString('fr-FR'), '', varTickets)}
              ${metricCard('Temps economise', current.hours_saved, 'h', varHours)}
            </tr>
            <tr>
              ${metricCard('ROI genere', current.roi.toLocaleString('fr-FR'), '€', varRoi)}
              ${metricCard('Actions executees', current.tasks_executed.toLocaleString('fr-FR'), '', varTasks)}
            </tr>
          </table>
        </td></tr>

        <!-- Top problemes -->
        <tr><td style="padding:28px 32px 4px 32px;">
          <h2 style="font-size:13px;font-weight:700;color:#1a1a1a;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.05em;">Top problemes clients</h2>
          <p style="font-size:12px;color:#9ca3af;margin:0 0 14px 0;">Classification automatique des tickets recus.</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;">
            ${topRows}
          </table>
        </td></tr>

        <!-- ROI net -->
        <tr><td style="padding:28px 32px 4px 32px;">
          <h2 style="font-size:13px;font-weight:700;color:#1a1a1a;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.05em;">ROI net</h2>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #0E653A;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:12px;color:#6b7280;">${current.hours_saved}h economisees ${implicitHourly > 0 ? `× ~${implicitHourly}€/h` : ''}</div>
              <div style="font-size:24px;font-weight:800;color:#0E653A;margin-top:6px;letter-spacing:-0.5px;">
                ${current.roi.toLocaleString('fr-FR')}€ de valeur generee
              </div>
              <div style="font-size:11px;color:#6b7280;margin-top:6px;">vs mois precedent : ${badge(varRoi)}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:32px 32px 8px 32px;">
          <a href="https://actero.fr/client" style="display:inline-block;background:#0E653A;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
            Voir le detail dans mon dashboard
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 32px 32px 32px;">
          <p style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">Merci pour votre confiance,</p>
          <p style="font-size:12px;font-weight:700;color:#1a1a1a;margin:0;">L'equipe Actero</p>
        </td></tr>

        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
          <p style="font-size:10px;color:#9ca3af;margin:0;text-align:center;">Actero · actero.fr · Rapport mensuel automatique</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

async function resolveRecipient(client) {
  if (client.contact_email) return client.contact_email
  // Fallback: first linked user
  const { data: link } = await supabase
    .from('client_users')
    .select('user_id')
    .eq('client_id', client.id)
    .limit(1)
    .maybeSingle()
  if (link?.user_id) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(link.user_id)
      if (user?.email) return user.email
    } catch {}
  }
  // Fallback: owner user
  if (client.owner_user_id) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(client.owner_user_id)
      if (user?.email) return user.email
    } catch {}
  }
  return null
}

async function handler(req, res) {
  // Auth: allow Vercel Cron (Bearer CRON_SECRET) or internal secret or explicit x-vercel-cron-secret
  const authHeader = req.headers.authorization
  const cronSecret = req.headers['x-vercel-cron-secret']
  const internalSecret = req.headers['x-internal-secret']
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) ||
    (process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET)

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const { startPrev, endPrev, startPrevPrev } = getPreviousMonthRange(now)
    const periodLabel = formatMonthYear(startPrev)

    // Active clients only
    const { data: clients = [], error: clientsErr } = await supabase
      .from('clients')
      .select('id, brand_name, contact_email, owner_user_id, status')
      .in('status', ['active', 'onboarding', 'live'])

    if (clientsErr) throw clientsErr

    const results = []

    for (const client of clients) {
      try {
        const [current, previous] = await Promise.all([
          computeMonthlyStats(client.id, startPrev, endPrev),
          computeMonthlyStats(client.id, startPrevPrev, startPrev),
        ])

        // Skip silent clients (no activity at all)
        if (
          current.tickets_resolved === 0 &&
          current.hours_saved === 0 &&
          current.roi === 0 &&
          current.tasks_executed === 0
        ) {
          results.push({ client_id: client.id, skipped: 'no_activity' })
          continue
        }

        const recipient = await resolveRecipient(client)
        if (!recipient) {
          results.push({ client_id: client.id, skipped: 'no_email' })
          continue
        }

        const html = buildReportHtml({
          brandName: client.brand_name || 'votre marque',
          periodLabel,
          current,
          previous,
        })

        const sent = await sendEmail(client.id, {
          to: recipient,
          subject: `Votre rapport mensuel Actero — ${periodLabel}`,
          html,
          brandName: client.brand_name,
        })

        results.push({
          client_id: client.id,
          sent_to: recipient,
          provider: sent.provider,
          stats: current,
        })
      } catch (err) {
        console.error(`[monthly-report] Error for client ${client.id}:`, err.message)
        results.push({ client_id: client.id, error: err.message })
      }
    }

    return res.status(200).json({
      success: true,
      period: periodLabel,
      total_clients: clients.length,
      processed: results.length,
      results,
    })
  } catch (err) {
    console.error('[monthly-report] Fatal:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withCronMonitor('cron-monthly-report', '0 8 1 * *', handler)
