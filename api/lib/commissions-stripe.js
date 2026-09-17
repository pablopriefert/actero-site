import { OPTIONS_REQUETE_COURTE } from './stripe-customer.js'
import { evaluerFacture, effetRemboursement, remboursementDesCharges, cleUnique, DEVISE_COMMISSIONS } from './commissions-closer.js'

/**
 * Les commissions des closers côté webhook Stripe : lire, appeler le calcul
 * pur (commissions-closer.js), écrire.
 *
 * LA VERSION D'API EST FIXÉE À CHAQUE APPEL
 *
 * Le client Stripe du webhook est épinglé sur 2024-12-18.acacia, et la forme de
 * l'objet d'un événement dépend de la version configurée sur l'endpoint, que le
 * code ne connaît pas. Depuis 2025-03-31.basil, une facture n'a plus
 * `subscription` ni `payment_intent`, et une charge ne porte plus son
 * `invoice`. On ne lit donc dans l'événement que l'identifiant, puis on relit
 * la facture ou la charge sous la version du SDK (2026-02-25.clover), celle
 * de ses types : l'abonnement dans `parent.subscription_details`, les prix
 * dans `lines[].pricing.price_details.price`, la facture d'un paiement par
 * `invoicePayments.list`. Relire protège aussi d'un événement rejoué ou livré
 * dans le désordre.
 *
 * Chaque appel a le délai borné du webhook (OPTIONS_REQUETE_COURTE) : Vercel
 * coupe la fonction à 60 s. Une panne lève ; le webhook libère alors
 * l'événement et répond 500 pour que Stripe réessaie.
 */
export const VERSION_API_COMMISSIONS = '2026-02-25.clover'
export const OPTIONS_STRIPE_COMMISSIONS = Object.freeze({ ...OPTIONS_REQUETE_COURTE, apiVersion: VERSION_API_COMMISSIONS })

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Quatre niveaux d'expansion au plus : `data.pricing.price_details.price`
// en compte quatre. Sur la facture elle-même, il en faudrait cinq.
const EXPANSION_LIGNES = Object.freeze(['data.pricing.price_details.price'])
// 20 pages de 100 lignes : bien au-delà d'une facture d'abonnement réelle.
const PAGES_DE_LIGNES_MAX = 20

/**
 * Le client Actero d'une facture d'abonnement : par l'identifiant posé dans
 * les métadonnées de l'abonnement à sa création (api/lib/checkout-formule.js),
 * sinon par l'abonnement enregistré sur le client.
 *
 * Deux clients sur le même abonnement : on ne choisit pas. `ambigu` le dit, et
 * l'appelant termine sans lever — lever ferait réessayer Stripe pendant des
 * jours sur une donnée qu'aucun réessai ne corrigera.
 *
 * @returns {Promise<{ client: { id: string, closer_id: string|null } | null, ambigu?: true, abonnement?: string }>}
 */
async function clientDeLaFacture(supabase, facture) {
  const details = facture.parent?.subscription_details
  const clientId = details?.metadata?.client_id
  const abonnement = typeof details?.subscription === 'string' ? details.subscription : details?.subscription?.id
  const colonnes = 'id, closer_id'

  if (typeof clientId === 'string' && FORMAT_UUID.test(clientId)) {
    const { data, error } = await supabase.from('clients').select(colonnes).eq('id', clientId).maybeSingle()
    if (error) throw new Error(`clients illisible : ${error.message}`)
    if (data) return { client: data }
  }
  if (abonnement) {
    const { data, error } = await supabase.from('clients').select(colonnes).eq('stripe_subscription_id', abonnement).limit(2)
    if (error) throw new Error(`clients illisible : ${error.message}`)
    if ((data ?? []).length > 1) return { client: null, ambigu: true, abonnement }
    return { client: data?.[0] ?? null }
  }
  return { client: null }
}

/**
 * Toutes les lignes de la facture, page après page (`has_more`). Une formule
 * se juge sur toutes ses lignes : une seconde page peut porter un autre prix.
 */
async function lignesDeLaFacture(stripe, factureId) {
  const lignes = []
  let apres = null
  for (let n = 0; n < PAGES_DE_LIGNES_MAX; n += 1) {
    const params = { limit: 100, expand: [...EXPANSION_LIGNES] }
    if (apres) params.starting_after = apres
    const liste = await stripe.invoices.listLineItems(factureId, params, OPTIONS_STRIPE_COMMISSIONS)
    const data = liste?.data ?? []
    lignes.push(...data)
    if (!liste?.has_more) return lignes
    apres = data.at(-1)?.id
    // Une page vide qui annonce une suite : Stripe répond mal, on ne boucle pas.
    if (!apres) break
  }
  throw new Error(`lignes de la facture ${factureId} illisibles en entier`)
}

const identifiant = (valeur) => (typeof valeur === 'string' ? valeur : valeur?.id) || null

/** La charge elle-même : un objet étendu tel quel, un identifiant relu. */
async function chargeLue(stripe, charge) {
  if (charge && typeof charge === 'object') return charge
  if (typeof charge !== 'string' || !charge) return null
  return stripe.charges.retrieve(charge, {}, OPTIONS_STRIPE_COMMISSIONS)
}

/**
 * La charge d'un paiement de facture : par son PaymentIntent et sa dernière
 * charge (`latest_charge`), ou directement quand le paiement est une charge.
 * Un `payment_record` (paiement enregistré hors Stripe) n'a pas de charge.
 */
async function chargeDuPaiement(stripe, paiement) {
  if (paiement?.type === 'payment_intent') {
    const id = identifiant(paiement.payment_intent)
    if (!id) return null
    const intention = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] }, OPTIONS_STRIPE_COMMISSIONS)
    return chargeLue(stripe, intention?.latest_charge)
  }
  if (paiement?.type === 'charge') return chargeLue(stripe, paiement.charge)
  return null
}

/**
 * Ce que le client a déjà récupéré sur cette facture, ou null.
 *
 * Stripe ne garantit pas l'ordre des événements : `charge.refunded` peut
 * arriver avant `invoice.paid` (ou avant son réessai). Il ne trouve alors
 * aucune commission à annuler ; c'est donc à la création qu'on lit l'état du
 * paiement. Une facture remboursée garde le statut `paid` : l'état se lit sur
 * ses paiements, puis leur PaymentIntent, puis sa dernière charge.
 */
async function remboursementDeLaFacture(stripe, factureId) {
  const paiements = await stripe.invoicePayments.list({ invoice: factureId, limit: 10 }, OPTIONS_STRIPE_COMMISSIONS)
  const charges = []
  for (const paiement of paiements?.data ?? []) {
    if (paiement?.status !== 'paid') continue
    const charge = await chargeDuPaiement(stripe, paiement.payment)
    if (charge) charges.push(charge)
  }
  return remboursementDesCharges(charges)
}

/**
 * Un client rattaché dont la facture ne crée rien : on le dit dans les
 * journaux, avec des identifiants seulement (ni nom, ni e-mail, ni montant).
 */
function sansCommission(raison, { facture, client = null, abonnement }) {
  console.warn('[CLOSER] facture sans commission', {
    facture,
    client,
    ...(abonnement ? { abonnement } : {}),
    raison,
  })
  return { cree: false, raison }
}

/**
 * `invoice.paid` : crée la commission de la facture, s'il y en a une.
 *
 * Raisons d'une absence : sans_facture, rien_encaisse, hors_abonnement,
 * client_inconnu, sans_closer, deja_creee, et, journalisées parce qu'un closer
 * attendait peut-être une commission : client_ambigu, devise, hors_grille,
 * unique_deja_versee.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {any} supabase — client service_role
 * @param {string} factureId — `event.data.object.id`
 * @returns {Promise<{ cree: true, source_key: string } | { cree: false, raison: string }>}
 */
export async function traiterFacturePayee(stripe, supabase, factureId) {
  if (!factureId) return { cree: false, raison: 'sans_facture' }
  const facture = await stripe.invoices.retrieve(factureId, {}, OPTIONS_STRIPE_COMMISSIONS)
  // Sorties rapides, avant toute autre lecture : la plupart des factures ne rapportent rien.
  if (facture.status !== 'paid' || !(facture.amount_paid > 0)) return { cree: false, raison: 'rien_encaisse' }
  if (facture.parent?.type !== 'subscription_details') return { cree: false, raison: 'hors_abonnement' }

  const { client, ambigu, abonnement } = await clientDeLaFacture(supabase, facture)
  if (ambigu) return sansCommission('client_ambigu', { facture: facture.id, abonnement })
  if (!client) return { cree: false, raison: 'client_inconnu' }
  if (!client.closer_id) return { cree: false, raison: 'sans_closer' }
  const reperes = { facture: facture.id, client: client.id }
  if (facture.currency !== DEVISE_COMMISSIONS) return sansCommission('devise', reperes)

  const lignes = await lignesDeLaFacture(stripe, facture.id)

  const { data: unique, error: erreurUnique } = await supabase
    .from('closer_commissions').select('id').eq('source_key', cleUnique(client.id)).maybeSingle()
  if (erreurUnique) throw new Error(`closer_commissions illisible : ${erreurUnique.message}`)

  const { commission, raison } = evaluerFacture({ facture, lignes, client, uniqueDejaVersee: !!unique })
  if (!commission) return sansCommission(raison, reperes)

  // Déjà remboursée : la commission naît comme si `charge.refunded` l'avait
  // trouvée (annulée, ou annotée pour un remboursement partiel).
  const remboursement = await remboursementDeLaFacture(stripe, facture.id)
  const aEcrire = { ...commission, ...(remboursement ? effetRemboursement(commission, remboursement) : null) }

  const { error } = await supabase.from('closer_commissions').insert(aEcrire)
  // 23505 : la clé existe déjà — Stripe a renvoyé l'événement, ou un second
  // événement porte la même facture. La commission est là, une seule fois.
  if (error?.code === '23505') return { cree: false, raison: 'deja_creee' }
  if (error) throw new Error(`commission non écrite : ${error.message}`)
  return { cree: true, source_key: commission.source_key }
}

/**
 * `charge.refunded` : annule, ou annote, les commissions de la facture remboursée.
 *
 * Raisons quand rien n'est touché d'emblée : sans_charge, sans_remboursement,
 * sans_paiement, hors_facture.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {any} supabase — client service_role
 * @param {string} chargeId — `event.data.object.id`
 * @returns {Promise<{ touchees: number, raison?: string }>}
 */
export async function traiterRemboursement(stripe, supabase, chargeId) {
  if (!chargeId) return { touchees: 0, raison: 'sans_charge' }
  const charge = await stripe.charges.retrieve(chargeId, {}, OPTIONS_STRIPE_COMMISSIONS)
  // Même règle qu'à la création (remboursementDesCharges) : total ou partiel.
  const remboursement = remboursementDesCharges([charge])
  if (!remboursement) return { touchees: 0, raison: 'sans_remboursement' }
  const intention = identifiant(charge.payment_intent)
  if (!intention) return { touchees: 0, raison: 'sans_paiement' }

  // Une charge ne porte plus sa facture : on la retrouve par le paiement.
  const paiements = await stripe.invoicePayments.list(
    { payment: { type: 'payment_intent', payment_intent: intention }, limit: 10 },
    OPTIONS_STRIPE_COMMISSIONS,
  )
  const factures = [...new Set((paiements?.data ?? [])
    .map((p) => (typeof p.invoice === 'string' ? p.invoice : p.invoice?.id))
    .filter(Boolean))]
  if (factures.length === 0) return { touchees: 0, raison: 'hors_facture' }

  const { data: commissions, error } = await supabase
    .from('closer_commissions').select('id, statut, note').in('stripe_invoice_id', factures)
  if (error) throw new Error(`closer_commissions illisible : ${error.message}`)

  let touchees = 0
  for (const commission of commissions ?? []) {
    if (await appliquerRemboursement(supabase, commission, remboursement)) touchees += 1
  }
  return { touchees }
}

/**
 * Écrit l'effet du remboursement, seulement sur la commission encore dans
 * l'état lu : une décision admin passée entre-temps n'est pas écrasée.
 *
 * Si l'écriture ne touche aucune ligne, l'admin a décidé entre la lecture et
 * l'écriture. On relit et on applique la règle du nouveau statut : validée et
 * remboursée en entier, elle est annulée ; payée, elle reçoit une note ;
 * refusée ou annulée, plus rien à faire. Une seconde course perdue lève : le
 * webhook répond 500 et Stripe réessaiera sur un état stable.
 *
 * @returns {Promise<boolean>} true si la commission a été modifiée
 */
async function appliquerRemboursement(supabase, commission, remboursement) {
  let lue = commission
  for (let essai = 1; essai <= 2; essai += 1) {
    const maj = effetRemboursement(lue, remboursement)
    if (!maj) return false
    const { data: ecrites, error } = await supabase
      .from('closer_commissions')
      .update({ ...maj, updated_at: new Date().toISOString() })
      .eq('id', lue.id)
      .eq('statut', lue.statut)
      .select('id')
    if (error) throw new Error(`commission non mise à jour : ${error.message}`)
    if (ecrites?.length) return true
    if (essai === 2) break

    const { data: relue, error: erreurRelecture } = await supabase
      .from('closer_commissions').select('id, statut, note').eq('id', commission.id).maybeSingle()
    if (erreurRelecture) throw new Error(`closer_commissions illisible : ${erreurRelecture.message}`)
    if (!relue) return false
    lue = relue
  }
  throw new Error(`commission ${commission.id} modifiée pendant le remboursement : Stripe réessaiera`)
}
