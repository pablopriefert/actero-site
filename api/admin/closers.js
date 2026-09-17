import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { decryptToken } from '../lib/crypto.js'
import { etatClient } from '../lib/attribution-closer.js'
import { cleMensuelleManuelle, moisCourant, montantPreRempli, totauxParStatut } from '../lib/commissions-closer.js'
import { profilComplet } from '../lib/fiche-closer.js'
import { periodeDepuisApi } from '../lib/formules.js'
import { ibanMasque } from '../lib/iban.js'
import { logAdminAction } from './_helpers.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const ACTIONS = { suspendre: 'suspendu', reactiver: 'actif' }

/**
 * /api/admin/closers — la section « Closers » de l'admin.
 *
 * GET   → { closers, clients, mois_courant }
 *         closers : fiche, IBAN masqué, profil complet, nombre de clients,
 *                   totaux par statut (centimes)
 *         clients : les clients rattachés, avec leur canal de facturation, le
 *                   montant pré-rempli d'une saisie et « mensualité du mois
 *                   saisie ? » ; les clients Shopify actifs au mois dont la
 *                   mensualité manque sont en tête
 * PATCH { closer_id, action: 'suspendre' | 'reactiver' } → { closer }
 */
async function handler(req, res) {
  const admin = await requireAdmin(req, res, supabase)
  if (!admin) return
  if (req.method === 'GET') return lister(res)
  if (req.method === 'PATCH') return changerStatut(req, res, admin)
  return res.status(405).json({ error: 'methode_non_autorisee' })
}

async function lister(res) {
  const [closersR, clientsR, commissionsR] = await Promise.all([
    supabase.from('closers')
      .select('id, prenom, nom, email, telephone, siret, titulaire_iban, iban_chiffre, code, statut, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('clients')
      .select('id, brand_name, plan, billing_period, billing_provider, stripe_subscription_id, status, closer_id, closer_attribue_at, closer_source')
      .not('closer_id', 'is', null),
    supabase.from('closer_commissions').select('closer_id, montant_centimes, statut, source_key'),
  ])
  const erreur = closersR.error || clientsR.error || commissionsR.error
  if (erreur) return res.status(503).json({ error: 'indisponible', message: erreur.message })

  const clients = clientsR.data || []
  const commissions = commissionsR.data || []
  let boutiquesShopify = new Set()
  if (clients.length) {
    const { data, error } = await supabase
      .from('client_shopify_connections').select('client_id').in('client_id', clients.map((c) => c.id))
    if (error) return res.status(503).json({ error: 'indisponible', message: error.message })
    boutiquesShopify = new Set((data || []).map((l) => l.client_id))
  }

  const mois = moisCourant()
  const cles = new Set(commissions.map((c) => c.source_key))
  const vueClients = clients.map((c) => ({
    id: c.id,
    boutique: c.brand_name,
    closer_id: c.closer_id,
    plan: c.plan,
    formule: periodeDepuisApi(c.billing_period),
    facturation: c.billing_provider === 'shopify' || boutiquesShopify.has(c.id)
      ? 'shopify'
      : (c.stripe_subscription_id ? 'stripe' : 'autre'),
    etat: etatClient(c),
    rattache_le: c.closer_attribue_at,
    source: c.closer_source,
    montant_pre_rempli: montantPreRempli(c),
    mensualite_du_mois_saisie: cles.has(cleMensuelleManuelle(c.id, mois)),
  }))
  const aSaisir = (c) => c.facturation === 'shopify' && c.etat === 'actif' && c.formule === 'mensuel' && !c.mensualite_du_mois_saisie
  vueClients.sort((a, b) => Number(aSaisir(b)) - Number(aSaisir(a)))

  const vueClosers = (closersR.data || []).map((k) => ({
    id: k.id,
    prenom: k.prenom,
    nom: k.nom,
    email: k.email,
    telephone: k.telephone,
    siret: k.siret,
    titulaire_iban: k.titulaire_iban,
    iban_masque: k.iban_chiffre ? ibanMasque(decryptToken(k.iban_chiffre)) : null,
    code: k.code,
    statut: k.statut,
    inscrit_le: k.created_at,
    profil_complet: profilComplet(k),
    nb_clients: clients.filter((c) => c.closer_id === k.id).length,
    totaux: totauxParStatut(commissions.filter((c) => c.closer_id === k.id)),
  }))

  return res.status(200).json({ closers: vueClosers, clients: vueClients, mois_courant: mois })
}

async function changerStatut(req, res, admin) {
  const { closer_id: closerId, action } = req.body || {}
  if (typeof closerId !== 'string' || !closerId) return res.status(400).json({ error: 'closer_requis' })
  if (!Object.hasOwn(ACTIONS, action)) return res.status(400).json({ error: 'action_inconnue' })

  const { data, error } = await supabase
    .from('closers')
    .update({ statut: ACTIONS[action], updated_at: new Date().toISOString() })
    .eq('id', closerId)
    .select('id, statut')
  if (error) return res.status(500).json({ error: 'erreur_interne', message: error.message })
  if (!data?.length) return res.status(404).json({ error: 'closer_introuvable' })

  await logAdminAction(admin.id, admin.email, `closer_${action}`, 'closer', closerId, null, {})
  return res.status(200).json({ closer: data[0] })
}

export default withSentry(handler)
