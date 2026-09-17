import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../lib/admin-auth.js'
import { STATUTS_COMMISSION, commissionManuelle, remboursableJusquau, transitionCommission } from '../lib/commissions-closer.js'
import { profilComplet } from '../lib/fiche-closer.js'
import { logAdminAction } from './_helpers.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MESSAGES = {
  client_introuvable: 'Client introuvable.',
  client_non_rattache: 'Ce client n’est rattaché à aucun closer : rattachez-le d’abord (Attributions).',
  plan_non_payant: 'Ce client n’a pas de plan payant.',
  formule_inconnue: 'Formule inconnue.',
  montant_invalide: 'Montant invalide (en centimes, supérieur à 0).',
  note_requise: 'Une note est requise.',
  mois_invalide: 'Mois invalide (AAAA-MM).',
  commission_automatique: 'Ce client est facturé par Stripe sur une formule du catalogue : ses mensualités sont créées automatiquement.',
  commission_introuvable: 'Commission introuvable.',
  statut_incompatible: 'Cette action n’est pas possible dans l’état actuel de la commission.',
  profil_incomplet: 'Le profil de paiement du closer est incomplet (téléphone, SIRET, titulaire, IBAN).',
  action_inconnue: 'Action inconnue.',
}

const STATUT_HTTP = {
  client_introuvable: 404,
  commission_introuvable: 404,
  client_non_rattache: 409,
  commission_automatique: 409,
  statut_incompatible: 409,
  profil_incomplet: 409,
}

const erreur = (res, code) => res.status(STATUT_HTTP[code] ?? 400).json({ error: code, message: MESSAGES[code] ?? code })

/**
 * /api/admin/closer-commissions
 *
 * GET   ?statut=a_valider|validee|payee|refusee|annulee (a_valider par défaut)
 *       → { commissions } avec le closer, la boutique et « remboursable jusqu'au »
 * POST  { client_id, formule, montant_centimes, mois?, note } → 201 { commission }
 *       saisie manuelle (Shopify, Enterprise, correction) ; 409 deja_saisie
 * PATCH { id, action: 'valider'|'refuser'|'marquer_payee', note? } → { commission }
 */
async function handler(req, res) {
  const admin = await requireAdmin(req, res, supabase)
  if (!admin) return
  if (req.method === 'GET') return lister(req, res)
  if (req.method === 'POST') return saisir(req, res, admin)
  if (req.method === 'PATCH') return decider(req, res, admin)
  return res.status(405).json({ error: 'methode_non_autorisee' })
}

async function lister(req, res) {
  const statut = req.query?.statut || 'a_valider'
  if (!STATUTS_COMMISSION.includes(statut)) return res.status(400).json({ error: 'statut_inconnu' })

  const { data: commissions, error } = await supabase
    .from('closer_commissions')
    .select('id, closer_id, client_id, montant_centimes, plan, formule, type, source, source_key, stripe_invoice_id, payee_par_client_le, statut, validee_at, payee_at, note, created_at')
    .eq('statut', statut)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return res.status(503).json({ error: 'indisponible', message: error.message })

  const idsClosers = [...new Set(commissions.map((c) => c.closer_id))]
  const idsClients = [...new Set(commissions.map((c) => c.client_id).filter(Boolean))]
  const [closersR, clientsR] = await Promise.all([
    idsClosers.length
      ? supabase.from('closers').select('id, prenom, nom, code, statut, telephone, siret, titulaire_iban, iban_chiffre').in('id', idsClosers)
      : { data: [], error: null },
    idsClients.length
      ? supabase.from('clients').select('id, brand_name').in('id', idsClients)
      : { data: [], error: null },
  ])
  if (closersR.error || clientsR.error) return res.status(503).json({ error: 'indisponible' })

  const closers = Object.fromEntries(closersR.data.map((k) => [k.id, {
    id: k.id, prenom: k.prenom, nom: k.nom, code: k.code, statut: k.statut, profil_complet: profilComplet(k),
  }]))
  const boutiques = Object.fromEntries(clientsR.data.map((c) => [c.id, c.brand_name]))

  return res.status(200).json({
    commissions: commissions.map((c) => ({
      ...c,
      closer: closers[c.closer_id] ?? null,
      boutique: boutiques[c.client_id] ?? 'Client supprimé',
      remboursable_jusqu_au: remboursableJusquau(c.payee_par_client_le),
    })),
  })
}

async function saisir(req, res, admin) {
  const { client_id: clientId, formule, montant_centimes: montantCentimes, mois, note } = req.body || {}
  if (typeof clientId !== 'string' || !clientId) return res.status(400).json({ error: 'client_requis', message: 'Choisissez un client.' })

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, brand_name, plan, billing_period, billing_provider, stripe_subscription_id, closer_id')
    .eq('id', clientId)
    .maybeSingle()
  if (error) return res.status(503).json({ error: 'indisponible', message: error.message })

  const resultat = commissionManuelle({ client, formule, montantCentimes, mois, note })
  if (resultat.erreur) return erreur(res, resultat.erreur)

  const { data: creee, error: erreurEcriture } = await supabase
    .from('closer_commissions').insert(resultat.commission).select('id, source_key, statut').single()
  if (erreurEcriture?.code === '23505') {
    return res.status(409).json({ error: 'deja_saisie', message: 'Cette commission existe déjà : même client et même mois, ou commission unique déjà versée.' })
  }
  if (erreurEcriture) return res.status(500).json({ error: 'erreur_interne', message: erreurEcriture.message })

  await logAdminAction(admin.id, admin.email, 'closer_commission_saisie', 'closer_commission', creee.id, client.id, { montant_centimes: montantCentimes, formule, mois: mois ?? null })
  return res.status(201).json({ commission: creee })
}

async function decider(req, res, admin) {
  const { id, action, note } = req.body || {}
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'commission_requise' })

  const { data: commission, error } = await supabase
    .from('closer_commissions').select('id, closer_id, client_id, statut, note').eq('id', id).maybeSingle()
  if (error) return res.status(503).json({ error: 'indisponible', message: error.message })

  let complet = false
  if (commission && action === 'marquer_payee') {
    const { data: closer, error: erreurCloser } = await supabase
      .from('closers').select('telephone, siret, titulaire_iban, iban_chiffre').eq('id', commission.closer_id).maybeSingle()
    if (erreurCloser) return res.status(503).json({ error: 'indisponible', message: erreurCloser.message })
    complet = profilComplet(closer)
  }

  const resultat = transitionCommission(commission, action, { note, profilComplet: complet, adminId: admin.id })
  if (resultat.erreur) return erreur(res, resultat.erreur)

  // Seulement si elle n'a pas changé depuis la lecture : deux clics simultanés
  // ne paient pas deux fois, et un remboursement arrivé entre-temps gagne.
  const { data: ecrites, error: erreurEcriture } = await supabase
    .from('closer_commissions')
    .update({ ...resultat.maj, updated_at: new Date().toISOString() })
    .eq('id', commission.id)
    .eq('statut', commission.statut)
    .select('id, statut, validee_at, payee_at, note')
  if (erreurEcriture) return res.status(500).json({ error: 'erreur_interne', message: erreurEcriture.message })
  if (!ecrites?.length) return res.status(409).json({ error: 'conflit', message: 'La commission a changé entre-temps. Rechargez la page.' })

  await logAdminAction(admin.id, admin.email, `closer_commission_${action}`, 'closer_commission', commission.id, commission.client_id, {})
  return res.status(200).json({ commission: ecrites[0] })
}

export default withSentry(handler)
