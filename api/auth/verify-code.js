/**
 * Verify the 6-digit code and complete the signup.
 *
 * POST /api/auth/verify-code
 * Body: { email, code }
 *
 * - Looks up the most recent non-expired code for this email
 * - If code matches → creates Supabase user + client rows (same logic as signup.js)
 * - If invalid → increments attempts (max 5)
 *
 * Returns: { success, redirect }
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js'
import { decryptToken } from '../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MAX_ATTEMPTS = 5

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const rl = checkRateLimit(`verify-code-check:${ip}`, 15, 60 * 60 * 1000)
  if (!rl.allowed) return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' })

  const { email, code } = req.body || {}
  if (!email || !code) return res.status(400).json({ error: 'Email et code requis.' })

  const normalizedEmail = String(email).trim().toLowerCase()
  const codeStr = String(code).replace(/\s/g, '')
  if (!/^\d{6}$/.test(codeStr)) return res.status(400).json({ error: 'Code invalide (6 chiffres requis).' })

  // Fetch the most recent valid verification row
  const { data: rows } = await supabase
    .from('email_verification_codes')
    .select('*')
    .eq('email', normalizedEmail)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  const record = rows?.[0]
  if (!record) {
    return res.status(400).json({ error: 'Code expiré ou inexistant. Demandez un nouveau code.' })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Trop de tentatives incorrectes. Demandez un nouveau code.' })
  }

  // Verify code (constant-time compare via hash)
  const valid = hashCode(codeStr) === record.code_hash
  if (!valid) {
    await supabase
      .from('email_verification_codes')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id)
    return res.status(400).json({
      error: 'Code incorrect.',
      attempts_left: Math.max(0, MAX_ATTEMPTS - record.attempts - 1),
    })
  }

  // Mark code as used
  await supabase.from('email_verification_codes').update({ used_at: new Date().toISOString() }).eq('id', record.id)

  // Create account (replicated from api/auth/signup.js)
  const payload = record.payload || {}
  // Support both legacy (password in clear) and encrypted (password_enc) formats.
  const password = payload.password_enc
    ? decryptToken(payload.password_enc)
    : payload.password
  const brand_name = payload.brand_name
  const shopify_url = payload.shopify_url
  const referral_code = payload.referral_code

  let userId = null
  let clientId = null

  try {
    // 1. Create Supabase user (email_confirm=true since we just verified)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { brand_name, plan: 'free' },
    })

    if (authError) {
      if (authError.message?.includes('already') || authError.status === 422) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' })
      }
      return res.status(500).json({ error: 'Erreur lors de la création du compte.' })
    }

    userId = authData.user.id

    // 2. Create client row
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        brand_name,
        contact_email: normalizedEmail,
        owner_user_id: userId,
        plan: 'free',
        status: 'active',
        ...(shopify_url && { shopify_url }),
      }])
      .select()
      .single()
    if (clientError) throw new Error('Failed to create client')
    clientId = client.id

    // 3. client_settings
    await supabase.from('client_settings').insert([{ client_id: clientId, hourly_cost: 25 }])

    // 4. client_users (owner)
    await supabase.from('client_users').insert([{ client_id: clientId, user_id: userId, role: 'owner' }])

    // 5. Handle referral
    if (referral_code) {
      try {
        const { data: referrer } = await supabase
          .from('clients')
          .select('id')
          .eq('referral_code', referral_code)
          .maybeSingle()
        if (referrer?.id && referrer.id !== clientId) {
          await supabase.from('clients').update({
            referral_first_month_free: true,
            referred_by_client_id: referrer.id,
          }).eq('id', clientId)

          await supabase.from('referrals').upsert({
            referrer_client_id: referrer.id,
            referee_client_id: clientId,
            referee_email: normalizedEmail,
            referral_code,
            status: 'signed_up',
            signed_up_at: new Date().toISOString(),
          }, { onConflict: 'referral_code,referee_email' })
        }
      } catch (refErr) {
        console.error('[verify-code] referral error:', refErr.message)
        // Non-blocking
      }
    }

    // 6. Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = await import('../lib/welcome-email.js')
      sendWelcomeEmail({
        email: normalizedEmail,
        brand_name,
        has_referral: !!referral_code,
      }).then((r) => {
        if (r.sent) console.log(`[verify-code] welcome email sent to ${normalizedEmail}`)
      })
    } catch (welcomeErr) {
      console.error('[verify-code] welcome email error:', welcomeErr.message)
    }

    // 7. Return success
    return res.status(200).json({ success: true, redirect: '/signup/plan' })
  } catch (err) {
    console.error('[verify-code] Account creation error:', err)
    // Cleanup on failure
    try {
      if (clientId) {
        await supabase.from('client_users').delete().eq('client_id', clientId)
        await supabase.from('client_settings').delete().eq('client_id', clientId)
        await supabase.from('clients').delete().eq('id', clientId)
      }
      if (userId) await supabase.auth.admin.deleteUser(userId)
    } catch { /* ignore */ }
    return res.status(500).json({ error: 'Erreur lors de la création du compte.' })
  }
}
