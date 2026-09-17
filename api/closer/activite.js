import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { ficheDuCompte } from '../lib/fiche-closer.js'
import { FAMILLES, FAMILLE_DU_TYPE, TYPES_EVENEMENT, typesDeLaFamille } from '../lib/familles-evenements.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const LIMITE_PAR_DEFAUT = 50
const LIMITE_MAX = 100
const JOUR_MS = 24 * 60 * 60 * 1000

/**
 * Ce qu'un closer peut savoir d'une étape : la sélection de colonnes est la
 * liste complète, et `details` n'en garde que ces clés, de ce type.
 */
const COLONNES = 'id, type, survenu_le, client_id, details'
const DETAILS_VISIBLES = Object.freeze({ plan: 'string', formule: 'string', plateforme: 'string', partiel: 'boolean' })

const TYPES_PAIEMENT = typesDeLaFamille('paiement')
const PAIEMENT_EN_ATTENTE = new Set(['paiement_ouvert', 'paiement_abandonne'])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

const indisponible = (res) => res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })

/** Les paramètres de la requête, ou null si l'un d'eux est invalide. */
function lireParametres(query = {}) {
  const brut = {}
  for (const cle of ['client', 'famille', 'avant', 'limite']) {
    const v = query[cle]
    if (v !== undefined && typeof v !== 'string') return null
    brut[cle] = v
  }
  const { client, famille, avant } = brut
  if (client !== undefined && !UUID.test(client)) return null
  if (famille !== undefined && !FAMILLES.includes(famille)) return null
  if (avant !== undefined && (!ISO.test(avant) || Number.isNaN(Date.parse(avant)))) return null
  let limite = LIMITE_PAR_DEFAUT
  if (brut.limite !== undefined) {
    if (!/^\d{1,3}$/.test(brut.limite)) return null
    limite = Number(brut.limite)
    if (limite < 1 || limite > LIMITE_MAX) return null
  }
  return { client, famille, avant, limite }
}

function detailsVisibles(details) {
  const visibles = {}
  if (!details || typeof details !== 'object') return visibles
  for (const [cle, genre] of Object.entries(DETAILS_VISIBLES)) {
    if (typeof details[cle] === genre) visibles[cle] = details[cle]
  }
  return visibles
}

/**
 * Une page du fil, de la plus récente à la plus ancienne.
 *
 * Le curseur `avant` est strict : les étapes du même instant que la dernière
 * de la page seraient perdues si la page s'arrêtait au milieu d'elles. Elles
 * passent donc toutes à la page suivante (sauf si la page entière tient dans
 * ce seul instant, cas où l'on rend la page telle quelle).
 */
async function lirePage(closerId, { client, famille, avant, limite }) {
  let requete = supabase
    .from('closer_evenements')
    .select(COLONNES)
    .eq('closer_id', closerId)
    .in('type', famille ? typesDeLaFamille(famille) : TYPES_EVENEMENT)
  if (client) requete = requete.eq('client_id', client)
  if (avant) requete = requete.lt('survenu_le', avant)
  const { data, error } = await requete.order('survenu_le', { ascending: false }).limit(limite + 1)
  if (error) throw error

  const lignes = data || []
  if (lignes.length <= limite) return { lignes, suivant: null }
  const frontiere = lignes[limite].survenu_le
  const entieres = lignes.slice(0, limite).filter((e) => e.survenu_le !== frontiere)
  const page = entieres.length > 0 ? entieres : lignes.slice(0, limite)
  return { lignes: page, suivant: page[page.length - 1].survenu_le }
}

/** Le nom des boutiques du fil, parmi les clients rattachés au closer. */
async function lireBoutiques(closerId, lignes) {
  const ids = [...new Set(lignes.map((e) => e.client_id).filter(Boolean))]
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('clients').select('id, brand_name').eq('closer_id', closerId).in('id', ids)
  if (error) throw error
  return new Map((data || []).map((c) => [c.id, c.brand_name || null]))
}

/**
 * Les trois compteurs de l'onglet Activité.
 *
 * Paiement en attente : le dernier événement de paiement du client est un
 * paiement ouvert ou abandonné. La lecture est plafonnée par PostgREST (1 000
 * lignes, des plus récentes aux plus anciennes) : au-delà, un paiement ouvert
 * il y a très longtemps et jamais repris n'est simplement plus compté.
 */
async function calculerResume(closerId) {
  const maintenant = Date.now()
  const depuis = (jours) => new Date(maintenant - jours * JOUR_MS).toISOString()
  const compter = (type, jours) => supabase
    .from('closer_evenements')
    .select('id', { count: 'exact', head: true })
    .eq('closer_id', closerId)
    .eq('type', type)
    .gte('survenu_le', depuis(jours))

  const [visites, inscriptions, paiements] = await Promise.all([
    compter('lien_ouvert', 7),
    compter('inscription', 30),
    supabase
      .from('closer_evenements')
      .select('client_id, type, survenu_le')
      .eq('closer_id', closerId)
      .in('type', TYPES_PAIEMENT)
      .not('client_id', 'is', null)
      .order('survenu_le', { ascending: false }),
  ])
  for (const r of [visites, inscriptions, paiements]) if (r.error) throw r.error

  const dernier = new Map()
  for (const e of paiements.data || []) if (!dernier.has(e.client_id)) dernier.set(e.client_id, e.type)
  return {
    visites_7j: visites.count ?? 0,
    inscriptions_30j: inscriptions.count ?? 0,
    paiements_en_attente: [...dernier.values()].filter((type) => PAIEMENT_EN_ATTENTE.has(type)).length,
  }
}

/**
 * GET /api/closer/activite — le fil d'activité du closer connecté.
 *
 * Paramètres : `client` (le parcours d'un de ses clients), `famille`, `avant`
 * (curseur ISO) et `limite` (50 par défaut, 100 au plus). Le fil est toujours
 * lu sur le closer du jeton : un client d'un autre closer répond 404.
 *
 * Le closer voit le type d'étape, la boutique, le plan, la formule et la date.
 * Jamais un montant, une adresse e-mail, un message ni un chiffre d'affaires.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'methode_non_autorisee' })
  const appel = await ficheDuCompte(supabase, req, res)
  if (!appel) return
  const { closer } = appel

  const parametres = lireParametres(req.query)
  if (!parametres) return res.status(400).json({ error: 'parametre_invalide', message: 'Paramètre invalide.' })
  const { client } = parametres

  try {
    if (client) {
      const { data, error } = await supabase.from('clients').select('id').eq('id', client).eq('closer_id', closer.id).maybeSingle()
      if (error) return indisponible(res)
      if (!data) return res.status(404).json({ error: 'client_introuvable', message: 'Ce client ne vous est pas rattaché.' })
    }

    const [{ lignes, suivant }, resume] = await Promise.all([
      lirePage(closer.id, parametres),
      client ? null : calculerResume(closer.id),
    ])
    const boutiques = await lireBoutiques(closer.id, lignes)

    return res.status(200).json({
      evenements: lignes.map((e) => ({
        id: e.id,
        type: e.type,
        famille: FAMILLE_DU_TYPE[e.type],
        survenu_le: e.survenu_le,
        client_id: e.client_id ?? null,
        boutique: (e.client_id && boutiques.get(e.client_id)) || null,
        details: detailsVisibles(e.details),
      })),
      suivant,
      resume,
    })
  } catch {
    return indisponible(res)
  }
}

export default withSentry(handler)
