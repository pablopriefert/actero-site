/**
 * GET /api/leads/unsubscribe?token=<report_token>
 *
 * PUBLIC, no auth. RGPD/LCEN opt-out endpoint linked from cold emails.
 * Reuses the prospect's report_token as the unsubscribe identifier
 * (already unique + unguessable).
 *
 * Adds the prospect's email to email_suppressions and stops further
 * relances. Always responds 200 with a branded HTML page and never
 * leaks whether the token existed.
 */

import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function htmlPage(message) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Désinscription · Actero</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#F9F7F1;color:#003725;
      font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
    .card{background:#fff;border-radius:20px;padding:40px 48px;max-width:440px;
      text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
    h1{font-size:20px;font-weight:700;margin:0 0 12px;color:#003725;}
    p{font-size:14px;line-height:1.6;color:#003725;opacity:0.8;margin:0;}
    a{display:inline-block;margin-top:24px;color:#003725;font-size:13px;
      font-weight:600;text-decoration:none;border:1px solid #003725;
      padding:8px 18px;border-radius:999px;}
  </style>
</head>
<body>
  <div class="card">
    <h1>Désinscription</h1>
    <p>${message}</p>
    <a href="https://actero.fr">Retour sur actero.fr</a>
  </div>
</body>
</html>`
}

const DONE_MESSAGE =
  'Vous êtes désinscrit. Vous ne recevrez plus d\'emails d\'Actero.'

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).send('Method not allowed')
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const token =
    typeof req.query?.token === 'string' ? req.query.token.trim() : ''

  // Generic, non-leaking message used for both "no token" and "not found".
  if (!token) {
    return res.status(200).send(htmlPage(DONE_MESSAGE))
  }

  try {
    const { data: audit } = await supabase
      .from('prospect_audits')
      .select('id, contact_email, email_status')
      .eq('report_token', token)
      .maybeSingle()

    if (audit && audit.contact_email) {
      const email = audit.contact_email.toLowerCase()

      await supabase
        .from('email_suppressions')
        .upsert(
          {
            email,
            reason: 'unsubscribe',
            source: 'prospect_audit',
          },
          { onConflict: 'email', ignoreDuplicates: true },
        )

      // Stop any relance — leave 'replied' untouched (terminal & valuable).
      if (audit.email_status !== 'replied') {
        await supabase
          .from('prospect_audits')
          .update({ pipeline_status: 'skipped' })
          .eq('id', audit.id)
      }
    }
  } catch (err) {
    // Never leak internal state; still confirm to the user.
    console.error('Unsubscribe error:', err)
  }

  // Always the same response — do not reveal whether the token existed.
  return res.status(200).send(htmlPage(DONE_MESSAGE))
}

export default withSentry(handler)
