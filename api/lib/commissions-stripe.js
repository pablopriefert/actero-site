import { OPTIONS_REQUETE_COURTE } from './stripe-customer.js'
import { commissionPourFacture, effetRemboursement, cleUnique } from './commissions-closer.js'

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

/**
 * Le client Actero d'une facture d'abonnement : par l'identifiant posé dans
 * les métadonnées de l'abonnement à sa création (api/lib/checkout-formule.js),
 * sinon par l'abonnement enregistré sur le client.
 */
async function clientDeLaFacture(supabase, facture) {
  const details = facture.parent?.subscription_details
  const clientId = details?.metadata?.client_id
  const abonnement = typeof details?.subscription === 'string' ? details.subscription : details?.subscription?.id
  const colonnes = 'id, closer_id'

  if (typeof clientId === 'string' && FORMAT_UUID.test(clientId)) {
    const { data, error } = await supabase.from('clients').select(colonnes).eq('id', clientId).maybeSingle()
    if (error) throw new Error(`clients illisible : ${error.message}`)
    if (data) return data
  }
  if (abonnement) {
    const { data, error } = await supabase.from('clients').select(colonnes).eq('stripe_subscription_id', abonnement).maybeSingle()
    if (error) throw new Error(`clients illisible : ${error.message}`)
    return data
  }
  return null
}

/**
 * `invoice.paid` : crée la commission de la facture, s'il y en a une.
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

  const client = await clientDeLaFacture(supabase, facture)
  if (!client) return { cree: false, raison: 'client_inconnu' }
  if (!client.closer_id) return { cree: false, raison: 'sans_closer' }

  // Quatre niveaux d'expansion au plus : `data.pricing.price_details.price`
  // en compte quatre. Sur la facture elle-même, il en faudrait cinq.
  const lignes = await stripe.invoices.listLineItems(
    facture.id,
    { limit: 100, expand: ['data.pricing.price_details.price'] },
    OPTIONS_STRIPE_COMMISSIONS,
  )

  const { data: unique, error: erreurUnique } = await supabase
    .from('closer_commissions').select('id').eq('source_key', cleUnique(client.id)).maybeSingle()
  if (erreurUnique) throw new Error(`closer_commissions illisible : ${erreurUnique.message}`)

  const commission = commissionPourFacture({ facture, lignes: lignes?.data ?? [], client, uniqueDejaVersee: !!unique })
  if (!commission) return { cree: false, raison: 'hors_grille' }

  const { error } = await supabase.from('closer_commissions').insert(commission)
  // 23505 : la clé existe déjà — Stripe a renvoyé l'événement, ou un second
  // événement porte la même facture. La commission est là, une seule fois.
  if (error?.code === '23505') return { cree: false, raison: 'deja_creee' }
  if (error) throw new Error(`commission non écrite : ${error.message}`)
  return { cree: true, source_key: commission.source_key }
}

/**
 * `charge.refunded` : annule, ou annote, les commissions de la facture remboursée.
 *
 * @param {import('stripe').Stripe} stripe
 * @param {any} supabase — client service_role
 * @param {string} chargeId — `event.data.object.id`
 * @returns {Promise<{ touchees: number, raison?: string }>}
 */
export async function traiterRemboursement(stripe, supabase, chargeId) {
  if (!chargeId) return { touchees: 0, raison: 'sans_charge' }
  const charge = await stripe.charges.retrieve(chargeId, {}, OPTIONS_STRIPE_COMMISSIONS)
  const intention = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
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

  const total = charge.refunded === true || charge.amount_refunded >= charge.amount
  let touchees = 0
  for (const commission of commissions ?? []) {
    const maj = effetRemboursement(commission, { total, rembourseCentimes: charge.amount_refunded })
    if (!maj) continue
    const { error: erreurEcriture } = await supabase
      .from('closer_commissions')
      .update({ ...maj, updated_at: new Date().toISOString() })
      .eq('id', commission.id)
      .eq('statut', commission.statut)
    if (erreurEcriture) throw new Error(`commission non mise à jour : ${erreurEcriture.message}`)
    touchees += 1
  }
  return { touchees }
}
