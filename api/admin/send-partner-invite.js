/**
 * Admin — Send partner invitation email via Resend
 *
 * POST /api/admin/send-partner-invite
 * Body: { agency_name, contact_name?, contact_email, expires_in_days?, notes? }
 *
 * Creates a new partner token + sends the invitation email in one shot.
 * Admin only.
 */
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function requireAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) { res.status(401).json({ error: 'Non autorisé' }); return null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') { res.status(403).json({ error: 'Accès réservé aux administrateurs' }); return null }
  return user
}

function renderEmail({ agencyName, contactName, url }) {
  const greeting = contactName ? `Bonjour ${contactName}` : 'Bonjour'
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; margin: 0; padding: 40px 20px; color: #1a1a1a; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .logo { width: 48px; height: 48px; background: #0F5F35; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px; }
    .cta { display: inline-block; padding: 12px 24px; background: #0F5F35; color: white !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .cta:hover { background: #003725; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #9ca3af; }
    .highlights { background: #fafafa; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .highlight { display: flex; gap: 10px; padding: 6px 0; font-size: 14px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #0F5F35; margin-top: 7px; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">A</div>
    <h1>${greeting},</h1>
    <p>Je suis Pablo, fondateur d'Actero — une solution d'automatisation IA pour le support client e-commerce (Shopify, WooCommerce, Webflow).</p>
    <p>J'ai préparé une invitation personnalisée pour <strong>${agencyName}</strong> au programme partenaire Actero. Vous pouvez recommander Actero à vos clients et toucher une commission sur chaque abonnement.</p>

    <div class="highlights">
      <div class="highlight"><span class="dot"></span><span><strong>20% de commission</strong> récurrente sur les abonnements (sans plafond)</span></div>
      <div class="highlight"><span class="dot"></span><span><strong>Démos clés en main</strong> — on s'occupe de la technique et du closing</span></div>
      <div class="highlight"><span class="dot"></span><span><strong>Support dédié</strong> et onboarding prioritaire pour vos clients</span></div>
    </div>

    <a href="${url}" class="cta">Découvrir le programme →</a>

    <p>Ce lien est personnel et permet un accès prioritaire à notre programme partenaire. Il vous donne également accès à notre documentation interne et aux tarifs réservés aux agences.</p>

    <p>Répondez simplement à cet email si vous avez des questions.</p>

    <p style="margin-top: 24px;">À bientôt,<br/>Pablo Priefert<br/>Fondateur, Actero</p>

    <div class="footer">
      Actero — ${new Date().getFullYear()} · <a href="https://actero.fr" style="color: #9ca3af;">actero.fr</a><br/>
      Vous recevez cet email car vous êtes une agence e-commerce identifiée comme partenaire potentiel. Si vous ne souhaitez pas être contacté, répondez simplement "STOP".
    </div>
  </div>
</body>
</html>`
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res)
  if (!user) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!resend) return res.status(500).json({ error: 'Resend non configuré (RESEND_API_KEY manquante)' })

  const { agency_name, contact_name, contact_email, expires_in_days, notes } = req.body || {}
  if (!agency_name || !contact_email) {
    return res.status(400).json({ error: 'agency_name et contact_email requis' })
  }

  // 1. Create the partner token
  const token = 'ptr_' + crypto.randomBytes(16).toString('hex')
  const expires_at = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null

  const { data: tokenRow, error: insertErr } = await supabase
    .from('partner_access_tokens')
    .insert({
      token,
      agency_name,
      contact_email,
      contact_name: contact_name || null,
      created_by: user.id,
      expires_at,
      notes: notes || null,
    })
    .select()
    .single()

  if (insertErr) return res.status(500).json({ error: insertErr.message })

  // 2. Send the email via Resend
  const url = `https://actero.fr/partner?token=${token}`
  try {
    const { data, error } = await resend.emails.send({
      from: 'Pablo de Actero <contact@actero.fr>',
      to: contact_email,
      subject: `${agency_name} — Invitation au programme partenaire Actero`,
      html: renderEmail({ agencyName: agency_name, contactName: contact_name, url }),
      replyTo: 'contact@actero.fr',
    })

    if (error) {
      // Token is created but email failed — return partial success
      return res.status(500).json({
        error: `Email non envoyé: ${error.message}`,
        token: tokenRow,
        url,
      })
    }

    return res.status(200).json({
      success: true,
      token: tokenRow,
      url,
      email_id: data?.id,
      sent_to: contact_email,
    })
  } catch (err) {
    return res.status(500).json({
      error: `Erreur Resend: ${err.message}`,
      token: tokenRow,
      url,
    })
  }
}
