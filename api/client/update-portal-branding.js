/**
 * Update portal branding for the authed client (Pro+ only).
 *
 * POST /api/client/update-portal-branding
 * Body: { portal_display_name, portal_logo_url, portal_primary_color }
 * Auth: Bearer token (Supabase session)
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { syncProjectDomain } from '../lib/vercel.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PRO_PLANS = ['pro', 'enterprise']
const HEX_RE = /^#[0-9a-fA-F]{6}$/

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth ──────────────────────────────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  // ── Resolve client_id ─────────────────────────────────────────
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let clientId = link?.client_id
  if (!clientId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()
    clientId = clientRow?.id
  }

  if (!clientId) return res.status(404).json({ error: 'Client introuvable' })

  // ── Fetch plan + trial + previous custom domain (for Vercel sync) ──
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('plan, trial_ends_at, portal_custom_domain')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError || !clientData) return res.status(404).json({ error: 'Client introuvable' })

  const plan = clientData.plan || 'free'
  const inTrial = clientData.trial_ends_at && new Date(clientData.trial_ends_at) > new Date()

  // Allowed if plan is pro/enterprise, OR in a trial on a pro/enterprise plan
  const isPro = PRO_PLANS.includes(plan) || (inTrial && PRO_PLANS.includes(plan))
  if (!isPro) {
    return res.status(403).json({ error: 'Cette fonctionnalité nécessite le plan Pro ou Enterprise.' })
  }

  // ── Validate body ─────────────────────────────────────────────
  const {
    portal_display_name,
    portal_logo_url,
    portal_primary_color,
    portal_custom_domain,
    portal_hide_actero_branding,
  } = req.body || {}

  if (portal_display_name !== undefined && typeof portal_display_name === 'string' && portal_display_name.length > 60) {
    return res.status(400).json({ error: 'portal_display_name doit faire 60 caractères maximum.' })
  }

  if (portal_logo_url !== undefined && portal_logo_url !== '' && portal_logo_url !== null) {
    try {
      const u = new URL(portal_logo_url)
      if (u.protocol !== 'https:') throw new Error()
    } catch {
      return res.status(400).json({ error: 'portal_logo_url doit être une URL HTTPS valide.' })
    }
  }

  if (portal_primary_color !== undefined && portal_primary_color !== '' && portal_primary_color !== null) {
    if (!HEX_RE.test(portal_primary_color)) {
      return res.status(400).json({ error: 'portal_primary_color doit être une couleur hex valide (ex: #0E653A).' })
    }
  }

  // Custom domain: lowercase hostname, allow empty to clear, reject anything with a protocol/path/port.
  if (
    portal_custom_domain !== undefined &&
    portal_custom_domain !== null &&
    portal_custom_domain !== ''
  ) {
    if (typeof portal_custom_domain !== 'string') {
      return res.status(400).json({ error: 'portal_custom_domain doit être une chaîne.' })
    }
    const domain = portal_custom_domain.trim().toLowerCase()
    const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
    if (!HOSTNAME_RE.test(domain)) {
      return res.status(400).json({ error: 'portal_custom_domain doit être un nom de domaine valide (ex: sav.mamarque.fr).' })
    }
    if (domain.endsWith('.actero.fr')) {
      return res.status(400).json({ error: 'Ce sous-domaine est réservé — choisissez votre propre domaine.' })
    }
  }

  if (
    portal_hide_actero_branding !== undefined &&
    typeof portal_hide_actero_branding !== 'boolean'
  ) {
    return res.status(400).json({ error: 'portal_hide_actero_branding doit être un booléen.' })
  }

  // ── Build update payload ──────────────────────────────────────
  const update = {}

  if (portal_display_name !== undefined) {
    update.portal_display_name = portal_display_name.trim() || null
  }
  if (portal_logo_url !== undefined) {
    update.portal_logo_url = portal_logo_url?.trim() || null
  }
  if (portal_primary_color !== undefined) {
    update.portal_primary_color = portal_primary_color || null
  }
  if (portal_custom_domain !== undefined) {
    update.portal_custom_domain = portal_custom_domain
      ? portal_custom_domain.trim().toLowerCase()
      : null
  }
  if (portal_hide_actero_branding !== undefined) {
    update.portal_hide_actero_branding = !!portal_hide_actero_branding
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' })
  }

  // ── Write to DB ───────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('clients')
    .update(update)
    .eq('id', clientId)

  if (updateError) {
    // Surface unique-violation on custom domain as a 409 so the UI can show
    // a friendly "ce domaine est déjà utilisé" message.
    if (updateError.code === '23505' && updateError.message?.includes('portal_custom_domain')) {
      return res.status(409).json({ error: 'Ce domaine est déjà utilisé par un autre portail.' })
    }
    console.error('[update-portal-branding] DB update error:', updateError.message)
    return res.status(500).json({ error: 'Erreur serveur' })
  }

  // ── Sync custom domain with Vercel (best-effort, does not fail the request)
  let vercelSync = null
  if (portal_custom_domain !== undefined) {
    const prev = clientData.portal_custom_domain || null
    const next = update.portal_custom_domain || null
    if (prev !== next) {
      try {
        vercelSync = await syncProjectDomain({ prev, next })
      } catch (e) {
        console.error('[update-portal-branding] Vercel sync error:', e)
        vercelSync = { error: 'vercel_sync_failed' }
      }
    }
  }

  return res.status(200).json({
    ok: true,
    branding: {
      portal_display_name: update.portal_display_name ?? null,
      portal_logo_url: update.portal_logo_url ?? null,
      portal_primary_color: update.portal_primary_color ?? null,
      portal_custom_domain: update.portal_custom_domain ?? null,
      portal_hide_actero_branding: update.portal_hide_actero_branding ?? null,
    },
    vercelSync,
  })
}

export default withSentry(handler)
