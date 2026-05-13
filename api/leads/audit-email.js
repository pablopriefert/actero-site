/**
 * POST /api/leads/audit-email
 *
 * Generates and sends a personalized cold email to a prospect
 * based on their audit results. Uses Resend for delivery.
 *
 * Body: { audit_id }
 * Auth: admin only
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.SITE_URL || 'https://actero.fr'

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailHtml(audit) {
  const { store_name, analysis, support_score, average_rating, total_reviews, report_token } = audit
  const safeName = escapeHtml(store_name)
  const reportLink = `${SITE_URL}/audit-report/${report_token}`

  const topIssues = (analysis?.top_issues || []).slice(0, 3)
  const savings = analysis?.estimated_savings || {}
  const hook = escapeHtml(analysis?.email_hook || '')

  const issueRows = topIssues
    .map(
      (issue) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#262626;">
          ${escapeHtml(issue.category)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
          <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;${
            issue.severity === 'critical'
              ? 'background:#fef2f2;color:#dc2626;'
              : issue.severity === 'high'
                ? 'background:#fffbeb;color:#d97706;'
                : 'background:#f0fdf4;color:#16a34a;'
          }">
            ${escapeHtml(issue.severity)}
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#71717a;">
          ${issue.percentage || '—'}%
        </td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <img src="${SITE_URL}/actero-logo.png" alt="Actero" width="100" style="margin-bottom:24px;" />
            </td>
          </tr>

          <!-- Score badge -->
          <tr>
            <td style="padding:0 32px;">
              <div style="background:#f9f7f1;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                  Score Support de ${safeName}
                </div>
                <div style="font-size:48px;font-weight:800;color:${support_score >= 70 ? '#16a34a' : support_score >= 40 ? '#d97706' : '#dc2626'};line-height:1;">
                  ${support_score}<span style="font-size:20px;color:#71717a;">/100</span>
                </div>
                <div style="font-size:13px;color:#71717a;margin-top:6px;">
                  Basé sur ${total_reviews} avis · Note moyenne ${average_rating}/5
                </div>
              </div>
            </td>
          </tr>

          <!-- Hook -->
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="font-size:16px;line-height:1.6;color:#262626;margin:0;">
                ${hook}
              </p>
            </td>
          </tr>

          <!-- Issues table -->
          ${topIssues.length > 0 ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                Problèmes identifiés
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;border-collapse:collapse;">
                <thead>
                  <tr style="background:#fafafa;">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">Problème</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">Sévérité</th>
                    <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;">% avis</th>
                  </tr>
                </thead>
                <tbody>
                  ${issueRows}
                </tbody>
              </table>
            </td>
          </tr>` : ''}

          <!-- Savings -->
          ${savings.hours_per_month ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:linear-gradient(135deg,#003725 0%,#005c3d 100%);border-radius:12px;padding:20px;color:white;">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:12px;">
                  Potentiel d'économie estimé
                </div>
                <div style="display:flex;gap:16px;">
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${savings.hours_per_month}h</div>
                    <div style="font-size:11px;opacity:0.7;">gagnées/mois</div>
                  </div>
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${savings.tickets_automatable}%</div>
                    <div style="font-size:11px;opacity:0.7;">automatisable</div>
                  </div>
                  <div style="flex:1;text-align:center;">
                    <div style="font-size:28px;font-weight:800;">${escapeHtml(savings.response_time_improvement || '')}</div>
                    <div style="font-size:11px;opacity:0.7;">temps réponse</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${reportLink}" style="display:block;text-align:center;background:#003725;color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;">
                Voir mon rapport complet →
              </a>
              <p style="text-align:center;font-size:12px;color:#71717a;margin:12px 0 0;">
                Ce rapport est privé et accessible uniquement via ce lien.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="font-size:12px;color:#71717a;margin:0;">
                Actero — Agent IA pour le support e-commerce<br />
                <a href="${SITE_URL}" style="color:#003725;">actero.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUser = await requireAdmin(req, res, supabase)
  if (!adminUser) return

  const { audit_id } = req.body
  if (!audit_id) return res.status(400).json({ error: 'audit_id required' })

  try {
    // Fetch the audit
    const { data: audit, error: fetchError } = await supabase
      .from('prospect_audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    if (fetchError || !audit) {
      return res.status(404).json({ error: 'Audit not found' })
    }

    if (!audit.contact_email) {
      return res.status(400).json({ error: 'No contact_email on this audit' })
    }

    // Build and send the email
    const emailHtml = buildEmailHtml(audit)
    const subject = `${audit.store_name} : votre score support est ${audit.support_score}/100`

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Pablo d\'Actero <pablo@actero.fr>',
      to: audit.contact_email,
      subject,
      html: emailHtml,
      reply_to: 'pablo@actero.fr',
      tags: [
        { name: 'type', value: 'prospect-audit' },
        { name: 'store', value: audit.store_name.slice(0, 50) },
      ],
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return res.status(500).json({ error: 'Email send failed: ' + emailError.message })
    }

    // Update audit status
    await supabase
      .from('prospect_audits')
      .update({
        email_status: 'sent',
        email_sent_at: new Date().toISOString(),
        resend_email_id: emailResult?.id || null,
      })
      .eq('id', audit_id)

    return res.status(200).json({
      ok: true,
      email_id: emailResult?.id,
      sent_to: audit.contact_email,
    })
  } catch (error) {
    console.error('Audit email error:', error)
    return res.status(500).json({ error: 'Erreur envoi email: ' + error.message })
  }
}

export default withSentry(handler)
