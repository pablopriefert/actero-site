/**
 * GET  /api/admin/startup-applications          — list all applications (admin)
 * POST /api/admin/startup-applications/review   — accept or reject + send email + Stripe coupon
 *
 * Flow accept :
 *   1. Create or reuse Stripe Coupon "STARTUP_50_6MONTHS" (50% off, 6 months, once per customer)
 *   2. Generate a unique Stripe Promotion Code (ex: "ACTERO-STARTUP-A3B9C2")
 *   3. Update DB : status=accepted, promo_code, stripe_promotion_code_id, accepted_at
 *   4. Send email via Resend with the promo code + CTA to signup with it
 *
 * Flow reject :
 *   1. Update DB : status=rejected, rejected_at, notes
 *   2. Send polite rejection email
 */
import { withSentry } from '../lib/sentry.js'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { requireAdmin } from '../lib/admin-auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const SITE_URL = process.env.SITE_URL || 'https://actero.fr'
const PARENT_COUPON_ID = 'STARTUP_50_6MONTHS' // Stripe coupon id (we create it lazily)

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generatePromoCode() {
  // ACTERO-STARTUP-XXXXXX (base32-like, easy to type)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  const bytes = crypto.randomBytes(6)
  for (const b of bytes) suffix += alphabet[b % alphabet.length]
  return `ACTERO-STARTUP-${suffix}`
}

async function ensureParentCoupon(stripe) {
  // Reuse if exists (idempotent)
  try {
    const existing = await stripe.coupons.retrieve(PARENT_COUPON_ID)
    if (existing && !existing.deleted) return existing
  } catch (err) {
    // not found — will create below
    console.log('[startup-applications] parent coupon not found, creating new one:', err?.code || err?.message)
  }
  try {
    return await stripe.coupons.create({
      id: PARENT_COUPON_ID,
      percent_off: 50,
      duration: 'repeating',
      duration_in_months: 6,
      name: 'Actero for Startups — 50% off 6 months',
      metadata: { source: 'startup_program' },
    })
  } catch (err) {
    // If id is already taken (race condition), retrieve it again
    if (err?.code === 'resource_already_exists' || err?.message?.includes('already exists')) {
      return stripe.coupons.retrieve(PARENT_COUPON_ID)
    }
    throw err
  }
}

async function createPromotionCode(stripe, code, email) {
  const parentCoupon = await ensureParentCoupon(stripe)
  console.log('[startup-applications] parent coupon ready:', parentCoupon.id)

  // Pass the real coupon id we got back (handles case where the Stripe account
  // couldn't use our custom id and auto-generated one).
  const payload = {
    coupon: parentCoupon.id,
    code,
    max_redemptions: 1,
    metadata: { program: 'actero_for_startups', contact_email: email },
  }

  try {
    const promo = await stripe.promotionCodes.create(payload)
    return promo
  } catch (err) {
    // Log everything for debugging
    console.error('[startup-applications] promotionCodes.create failed', {
      code: err?.code,
      type: err?.type,
      message: err?.message,
      param: err?.param,
      raw: err?.raw,
      payload,
    })
    throw err
  }
}

async function sendAcceptedEmail({ email, boutique_name, promo_code }) {
  if (!resend) return { sent: false, error: 'RESEND_API_KEY missing' }
  const signupUrl = `${SITE_URL}/signup/plan?promo=${encodeURIComponent(promo_code)}`
  try {
    await resend.emails.send({
      from: 'Actero <noreply@actero.fr>',
      to: [email],
      subject: `Bienvenue chez Actero for Startups — votre code -50% est ici`,
      html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f8f8f8;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px;">
          <div style="font-size:28px;font-weight:800;color:#003725;letter-spacing:-0.8px;margin-bottom:8px;">Félicitations 🎉</div>
          <div style="font-size:16px;color:#716D5C;margin-bottom:32px;">Votre candidature Actero for Startups est acceptée.</div>

          <p style="color:#262626;font-size:15px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
          <p style="color:#262626;font-size:15px;line-height:1.6;margin:0 0 24px;">Bonne nouvelle : <strong>${escapeHtml(boutique_name)}</strong> a été sélectionnée pour le programme <strong>Actero for Startups</strong>. Vous bénéficiez de <strong>-50% pendant 6 mois</strong> sur tous les plans payants (Starter ou Pro).</p>

          <!-- Promo code card -->
          <table width="100%" style="background:#F9F7F1;border:1px solid #e5e5e5;border-radius:12px;padding:24px;margin:0 0 24px;">
            <tr><td>
              <div style="font-size:11px;font-weight:700;color:#716D5C;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Votre code promo</div>
              <div style="font-size:22px;font-weight:800;color:#0E653A;font-family:'SFMono-Regular',Consolas,Menlo,monospace;letter-spacing:0.5px;margin-bottom:8px;">${escapeHtml(promo_code)}</div>
              <div style="font-size:13px;color:#716D5C;line-height:1.5;">-50% pendant 6 mois · valable une fois · s'applique automatiquement à la caisse</div>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td align="center">
              <a href="${signupUrl}" style="display:inline-block;padding:14px 32px;background:#0E653A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">
                Activer mon compte Actero →
              </a>
            </td></tr>
          </table>

          <p style="color:#716D5C;font-size:13px;line-height:1.6;margin:0 0 8px;text-align:center;">Le code est pré-rempli via ce lien. Choisissez Starter (99€/mois) ou Pro (399€/mois), -50% appliqué pendant 6 mois.</p>

          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />

          <p style="color:#262626;font-size:14px;line-height:1.6;margin:0 0 8px;"><strong>Comment ça marche ?</strong></p>
          <ol style="color:#716D5C;font-size:14px;line-height:1.7;margin:0 0 16px;padding-left:20px;">
            <li>Cliquez sur le bouton ci-dessus (le code est déjà appliqué)</li>
            <li>Choisissez votre plan</li>
            <li>Connectez Shopify / WooCommerce / Gmail en 5 min</li>
            <li>Votre agent SAV IA tourne en autonome 24/7</li>
          </ol>

          <p style="color:#716D5C;font-size:13px;line-height:1.6;margin:24px 0 0;">Une question ? Répondez à ce mail ou contactez-nous sur <a href="mailto:contact@actero.fr" style="color:#0E653A;">contact@actero.fr</a>.</p>

          <p style="color:#262626;font-size:14px;line-height:1.6;margin:24px 0 0;">À bientôt sur Actero,<br />L'équipe.</p>
        </td></tr>

        <tr><td style="padding:24px 40px;background:#F9F7F1;border-top:1px solid #e5e5e5;">
          <div style="font-size:11px;color:#9ca3af;line-height:1.5;">Code unique valable pour ${escapeHtml(boutique_name)}. Non cumulable avec d'autres offres. -50% pendant 6 mois, puis prix plein à partir du mois 7. Annulable à tout moment.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

async function sendRejectedEmail({ email, boutique_name, notes }) {
  if (!resend) return { sent: false, error: 'RESEND_API_KEY missing' }
  const customNote = notes ? `<p style="color:#716D5C;font-size:14px;line-height:1.6;margin:0 0 16px;">${escapeHtml(notes)}</p>` : ''
  try {
    await resend.emails.send({
      from: 'Actero <noreply@actero.fr>',
      to: [email],
      subject: 'Votre candidature Actero for Startups',
      html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f8f8f8;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px;">
          <div style="font-size:20px;font-weight:700;color:#262626;margin-bottom:16px;">Merci pour votre candidature</div>
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 16px;">Merci d'avoir postulé au programme <strong>Actero for Startups</strong> pour <strong>${escapeHtml(boutique_name)}</strong>.</p>
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 16px;">Après étude de votre candidature, nous ne pouvons malheureusement pas vous accorder le bénéfice du programme pour le moment. N'hésitez pas à réessayer plus tard lorsque votre projet aura évolué.</p>
          ${customNote}
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 16px;">Vous pouvez bien sûr utiliser Actero à tarif standard dès maintenant sur <a href="${SITE_URL}/tarifs" style="color:#0E653A;font-weight:600;">${SITE_URL}/tarifs</a>.</p>
          <p style="color:#262626;font-size:14px;line-height:1.6;margin:24px 0 0;">L'équipe Actero.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

/* -------------------------------------------------------------------------- */
/*  Handler                                                                   */
/* -------------------------------------------------------------------------- */

async function handler(req, res) {
  // Admin auth
  const admin = await requireAdmin(req, res, supabase)
  if (!admin) return

  // GET — list
  if (req.method === 'GET') {
    const status = req.query?.status
    let query = supabase.from('startup_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
      query = query.eq('status', status)
    }
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Stats
    const [{ count: total }, { count: pending }, { count: accepted }, { count: rejected }] = await Promise.all([
      supabase.from('startup_applications').select('id', { count: 'exact', head: true }),
      supabase.from('startup_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('startup_applications').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('startup_applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ])

    return res.status(200).json({
      applications: data || [],
      stats: { total: total || 0, pending: pending || 0, accepted: accepted || 0, rejected: rejected || 0 },
    })
  }

  // POST — review (accept / reject)
  if (req.method === 'POST') {
    const { id, action, notes } = req.body || {}
    if (!id || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'id + action (accept|reject) required' })
    }

    const { data: application, error: fetchErr } = await supabase
      .from('startup_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr || !application) return res.status(404).json({ error: 'Application introuvable' })

    if (application.status !== 'pending') {
      return res.status(400).json({ error: `Candidature déjà ${application.status}` })
    }

    if (action === 'accept') {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: 'Stripe not configured' })
      }
      // Create promotion code via Stripe
      let Stripe
      try {
        Stripe = (await import('stripe')).default
      } catch (e) {
        return res.status(500).json({ error: 'Stripe SDK not available: ' + e.message })
      }
      // Force a recent API version that supports promotion_codes.
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-11-20.acacia',
      })

      const promoCode = generatePromoCode()
      let promotion
      try {
        promotion = await createPromotionCode(stripe, promoCode, application.email)
      } catch (err) {
        console.error('[startup-applications] Stripe promo create failed:', err.message)
        return res.status(500).json({ error: `Stripe coupon creation failed: ${err.message}` })
      }

      // Send email
      const emailResult = await sendAcceptedEmail({
        email: application.email,
        boutique_name: application.boutique_name,
        promo_code: promoCode,
      })

      // Update DB
      const now = new Date().toISOString()
      await supabase.from('startup_applications').update({
        status: 'accepted',
        promo_code: promoCode,
        stripe_promotion_code_id: promotion.id,
        accepted_at: now,
        accepted_email_sent_at: emailResult.sent ? now : null,
        reviewed_at: now,
        reviewed_by: admin.id,
        notes: notes || application.notes,
        updated_at: now,
      }).eq('id', id)

      return res.status(200).json({
        ok: true,
        action: 'accepted',
        promo_code: promoCode,
        email_sent: emailResult.sent,
        email_error: emailResult.error || null,
      })
    }

    // action === 'reject'
    const emailResult = await sendRejectedEmail({
      email: application.email,
      boutique_name: application.boutique_name,
      notes,
    })
    const now = new Date().toISOString()
    await supabase.from('startup_applications').update({
      status: 'rejected',
      rejected_at: now,
      reviewed_at: now,
      reviewed_by: admin.id,
      notes: notes || application.notes,
      updated_at: now,
    }).eq('id', id)

    return res.status(200).json({
      ok: true,
      action: 'rejected',
      email_sent: emailResult.sent,
      email_error: emailResult.error || null,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
