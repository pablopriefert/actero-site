/**
 * Send a 6-digit email verification code during signup.
 *
 * POST /api/auth/send-verification-code
 * Body: { email, password, brand_name, shopify_url?, referral_code? }
 *
 * - Validates inputs (email format, password length, brand_name)
 * - Generates a random 6-digit code, hashes it (SHA-256), stores with 15-min TTL
 * - Sends the code via Resend to the user's email
 * - Stores signup payload to use once code is verified
 *
 * Returns: { success: true }
 */
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js'
import { encryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}

function generateCode() {
  // 6-digit code, leading zeros allowed
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit: 5 verification requests per IP per hour
  const ip = getClientIp(req)
  const rl = checkRateLimit(`verify-code:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Trop de demandes. Réessayez plus tard.' })
  }

  const { email, password, brand_name, shopify_url, referral_code } = req.body || {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' })
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' })
  }
  if (!brand_name || !brand_name.trim()) {
    return res.status(400).json({ error: 'Le nom de la boutique est requis.' })
  }

  try {
    const code = generateCode()
    const code_hash = hashCode(code)
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Store the pending signup payload — encrypt the password at rest so the 15-min
    // DB row does not leak plaintext credentials if the table is ever exfiltrated.
    await supabase.from('email_verification_codes').insert({
      email: email.trim().toLowerCase(),
      code_hash,
      payload: {
        password_enc: encryptToken(password),
        brand_name: brand_name.trim(),
        shopify_url: shopify_url ? shopify_url.trim() : null,
        referral_code: referral_code || null,
      },
      expires_at,
    })

    // Send email
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Actero <contact@actero.fr>',
          to: email.trim(),
          subject: `${code} — Votre code de vérification Actero`,
          html: renderEmail({ code, email }),
          replyTo: 'contact@actero.fr',
        })
      } catch (err) {
        console.error('[send-verification-code] Resend error:', err.message)
        // Still return success — code is stored and user can still verify via another means
      }
    } else {
      console.log(`[send-verification-code] RESEND_API_KEY missing — code for ${email}: ${code}`)
    }

    return res.status(200).json({ success: true, expires_in: 900 })
  } catch (err) {
    console.error('[send-verification-code] Error:', err.message)
    return res.status(500).json({ error: 'Erreur serveur, réessayez.' })
  }
}

function renderEmail({ code }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafafa;margin:0;padding:40px 20px;color:#1a1a1a">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div style="width:48px;height:48px;background:#0F5F35;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;margin-bottom:24px">A</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 10px">Votre code de vérification</h1>
    <p style="color:#4a4a4a;line-height:1.6;margin:0 0 24px">Entrez ce code dans Actero pour finaliser la création de votre compte.</p>
    <div style="background:#fafafa;border:2px dashed #0F5F35;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px">Code</p>
      <p style="margin:0;font-size:36px;font-weight:800;color:#0F5F35;letter-spacing:8px;font-family:ui-monospace,monospace">${code}</p>
    </div>
    <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0">Ce code expire dans <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0">
    <p style="color:#9ca3af;font-size:11px;margin:0">Actero — ${new Date().getFullYear()} · <a href="https://actero.fr" style="color:#9ca3af">actero.fr</a></p>
  </div>
</body>
</html>`
}
