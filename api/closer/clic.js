import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js'
import { normaliserCodeCloser } from '../lib/code-closer.js'
import { enregistrerEvenementCloser } from '../lib/evenements-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Un visiteur réel ouvre un lien une ou deux fois : au-delà, ce n'est plus une visite. */
const CLICS_PAR_HEURE = 30
const UNE_HEURE_MS = 60 * 60 * 1000

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Robots d'indexation, aperçus de lien des messageries, navigateurs sans tête. */
const ROBOTS = /bot|crawl|spider|preview|slurp|facebookexternalhit|headless/i

/** Le corps : un objet (JSON lu par Vercel), ou un texte si le navigateur l'a envoyé comme tel. */
function corpsLu(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body !== 'string') return {}
  try {
    const corps = JSON.parse(req.body)
    return corps && typeof corps === 'object' ? corps : {}
  } catch {
    return {}
  }
}

/**
 * Note l'ouverture si c'en est une : ni robot, ni requête invalide, ni
 * adresse au-delà de sa limite, ni code inconnu ou de closer suspendu.
 */
async function noterOuverture(req) {
  const agent = req.headers?.['user-agent']
  if (typeof agent !== 'string' || !agent.trim() || ROBOTS.test(agent)) return

  const { code: brut, visite } = corpsLu(req)
  const code = normaliserCodeCloser(brut)
  if (!code || typeof visite !== 'string' || !FORMAT_UUID.test(visite)) return

  // L'adresse ne sert qu'à la limite : elle n'est écrite nulle part ailleurs.
  const limite = await checkRateLimit(`closer-clic:${getClientIp(req)}`, CLICS_PAR_HEURE, UNE_HEURE_MS)
  if (!limite.allowed) return

  const { data: closer, error } = await supabase.from('closers').select('id, statut').eq('code', code).maybeSingle()
  if (error) throw error
  if (!closer || closer.statut !== 'actif') return

  const visiteId = visite.toLowerCase()
  const jour = new Date().toISOString().slice(0, 10)
  await enregistrerEvenementCloser(supabase, {
    closerId: closer.id,
    visiteId,
    type: 'lien_ouvert',
    // Au plus une ouverture par visiteur, par lien et par jour.
    sourceKey: `clic:${code}:${visiteId}:${jour}`,
  })
}

/**
 * POST /api/closer/clic — le lien d'un closer vient d'être ouvert
 * (src/pages/LienCloserPage.jsx). Anonyme.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 * Corps : { code: 'ACT-XXXXX', visite: '<uuid du cookie closer_visite>' }
 *
 * Réponses :
 *   204  toujours, sans corps : ouverture notée, ou ignorée (robot, requête
 *        invalide, trop de clics, code inconnu, closer suspendu, panne). Rien
 *        ne permet de deviner un code, ni de savoir qu'on est limité.
 *   405  une autre méthode que POST.
 *
 * Le navigateur n'attend pas cette réponse : la redirection vers
 * l'inscription part sans elle.
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })
  try {
    await noterOuverture(req)
  } catch (err) {
    // Identifiants seulement : ni adresse, ni agent.
    console.warn('[closer/clic] ouverture non notée', { erreur: err?.code || err?.name || 'erreur' })
  }
  return res.status(204).end()
}

export default withSentry(handler)
