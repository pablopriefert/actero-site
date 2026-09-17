import { formuleDuPrix, formulePour } from './formules.js'
import { remboursementDesCharges } from './commissions-closer.js'

/**
 * Le fil d'activité des closers — l'étape que devient un événement Stripe.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 *
 * Fonctions pures : l'événement entre, l'étape sort (ou null). Le webhook
 * (api/stripe-webhook.js) retrouve le client, puis écrit l'étape avec
 * enregistrerEvenementCloser.
 *
 * LA FORME DE L'ÉVÉNEMENT DÉPEND DE L'ENDPOINT
 *
 * La version d'API de l'endpoint n'est pas connue du code (voir
 * commissions-stripe.js). On ne lit donc que des champs présents dans toutes
 * les versions (`billing_reason`, `amount_paid`, `cancel_at_period_end`,
 * `refunded`…), et les deux formes quand elles diffèrent : une facture
 * 2026-02-25.clover porte son abonnement dans `parent.subscription_details`,
 * et le prix d'une ligne dans `pricing.price_details.price` ; une facture
 * 2024-12-18.acacia, dans `subscription_details` et `price`.
 *
 * Aucune relecture Stripe pour le fil : un plan ou une formule absents de
 * l'événement restent absents de l'étape. On ne devine pas.
 */

/** La clé d'unicité d'une étape née d'un événement Stripe : un événement rejoué n'écrit rien. */
export const cleEvenementStripe = (event) => `stripe:${event.id}`

const ETAPE_DE_LA_FACTURE = Object.freeze({
  subscription_create: 'abonnement_demarre',
  subscription_cycle: 'renouvellement_paye',
  subscription_update: 'formule_changee',
})

/**
 * Une page Checkout expirée plus de 5 minutes avant son heure ne l'a pas été
 * par Stripe : api/billing/upgrade.js ferme les pages encore ouvertes avant
 * d'en ouvrir une nouvelle (double clic, retour sur les plans).
 */
const MARGE_EXPIRATION_S = 300

/**
 * `pro_annuel` → `{ plan: 'pro', formule: 'annuel' }`, la clé que
 * api/lib/checkout-formule.js pose sur la session et sur l'abonnement. `{}`
 * pour une clé hors catalogue.
 */
export function formuleDeLaCle(cle) {
  if (typeof cle !== 'string') return {}
  const [plan, periode, reste] = cle.split('_')
  if (reste !== undefined || !formulePour(plan, periode)) return {}
  return { plan, formule: periode }
}

function ligneDAbonnement(ligne) {
  return ligne?.parent?.type === 'subscription_item_details' || ligne?.type === 'subscription'
}

function ligneDeProrata(ligne) {
  const parent = ligne?.parent?.subscription_item_details ?? ligne?.parent?.invoice_item_details
  return (parent?.proration ?? ligne?.proration) === true
}

/** Le prix d'une ligne, seulement s'il est étendu : un identifiant ne dit pas sa clé. */
function prixDeLaLigne(ligne) {
  const prix = ligne?.pricing?.price_details?.price ?? ligne?.price
  return prix && typeof prix === 'object' ? prix : null
}

/**
 * Le plan et la formule d'une facture payée, d'après ce que l'événement porte.
 *
 * Les lignes d'abonnement hors prorata d'abord : la période facturée en
 * entier. À défaut, les lignes de prorata positives : un changement de prix
 * facturé tout de suite (api/billing/upgrade.js, `always_invoice`) ne porte
 * que du prorata, et sa ligne positive est celle du nouveau prix. Toutes
 * doivent désigner la même formule du catalogue (formuleDuPrix, par la
 * `lookup_key`). Des lignes lisibles qui se contredisent, ou dont une partie
 * seulement se lit : rien.
 *
 * Aucune ligne lisible (prix non étendus, forme clover) : la formule posée sur
 * l'abonnement, que la facture copie à sa finalisation. Sauf pour un
 * changement de formule : la copie est prise avant que la route n'écrive la
 * nouvelle formule, elle dirait l'ancienne.
 *
 * @returns {{ plan?: string, formule?: string }}
 */
export function formuleDeLaFacture(facture) {
  const lignes = Array.isArray(facture?.lines?.data) ? facture.lines.data : []
  const pleines = lignes.filter((l) => ligneDAbonnement(l) && !ligneDeProrata(l))
  const retenues = pleines.length > 0 ? pleines : lignes.filter((l) => ligneDeProrata(l) && l.amount > 0)
  const formules = retenues.map((l) => formuleDuPrix(prixDeLaLigne(l)))

  if (formules.length > 0 && formules.every((f) => f && f.lookupKey === formules[0].lookupKey)) {
    return { plan: formules[0].plan, formule: formules[0].periode }
  }
  if (formules.some(Boolean) || facture?.billing_reason === 'subscription_update') return {}
  const metadonnees = facture?.parent?.subscription_details?.metadata ?? facture?.subscription_details?.metadata
  return formuleDeLaCle(metadonnees?.formule)
}

/**
 * L'essai que api/billing/upgrade.js remplace par Checkout (voir
 * essaiRemplaceParCheckout) : la route le résilie, et un marchand peut lever
 * cette résiliation. Ni l'un ni l'autre n'est une décision sur son abonnement.
 */
function essaiRemplaceParLaRoute(abonnement) {
  return abonnement?.status === 'trialing' && abonnement.metadata?.remplace_par_checkout === 'true'
}

function etapeDeLObjet(event, objet) {
  switch (event.type) {
    case 'checkout.session.expired': {
      // Une page d'abonnement seulement : c'est elle que `paiement_ouvert`
      // annonce. Un achat de crédits n'entre pas dans le fil.
      if (objet.mode !== 'subscription') return null
      // Fermée avant son heure : la route en a ouvert une autre, déjà dans le
      // fil. Le marchand n'a rien abandonné, il est sur la nouvelle page.
      if (typeof objet.expires_at === 'number' && typeof event.created === 'number'
        && event.created < objet.expires_at - MARGE_EXPIRATION_S) return null
      const metadonnees = objet.metadata ?? {}
      const lue = formuleDeLaCle(metadonnees.formule)
      return { type: 'paiement_abandonne', details: { plan: lue.plan ?? metadonnees.upgrade_to, formule: lue.formule } }
    }

    case 'invoice.paid': {
      const raison = objet.billing_reason
      if (typeof raison !== 'string' || !Object.hasOwn(ETAPE_DE_LA_FACTURE, raison)) return null
      if (!Number.isInteger(objet.amount_paid) || objet.amount_paid <= 0) return null
      const details = formuleDeLaFacture(objet)
      const abonnement = abonnementDeLaFacture(objet)
      // Le premier paiement réel d'un abonnement est son démarrage, même quand
      // il arrive au premier renouvellement : un mois offert (parrainage,
      // campagne) facture d'abord 0 €, et ce client n'aurait sinon jamais
      // « S'est abonné ». La clé par abonnement n'écrit ce démarrage qu'une
      // fois ; ensuite, un renouvellement retombe sur `renouvellement_paye`.
      if (abonnement && (raison === 'subscription_create' || raison === 'subscription_cycle')) {
        return {
          type: 'abonnement_demarre',
          details: { ...details, plateforme: 'stripe' },
          sourceKey: `demarre:stripe:${abonnement}`,
          repli: raison === 'subscription_cycle' ? { type: 'renouvellement_paye', details } : null,
        }
      }
      const type = ETAPE_DE_LA_FACTURE[raison]
      return { type, details: type === 'abonnement_demarre' ? { ...details, plateforme: 'stripe' } : details }
    }

    case 'invoice.payment_failed':
      return { type: 'paiement_echoue', details: {} }

    case 'customer.subscription.updated': {
      // Seule la résiliation programmée, ou levée, fait une étape ici. Un
      // changement de prix n'écrit rien : sa facture (`subscription_update`,
      // invoice.paid) donne déjà `formule_changee`, avec la formule payée.
      const avant = event.data.previous_attributes
      if (typeof avant?.cancel_at_period_end !== 'boolean' || typeof objet.cancel_at_period_end !== 'boolean') return null
      if (avant.cancel_at_period_end === objet.cancel_at_period_end) return null
      if (essaiRemplaceParLaRoute(objet)) return null
      return { type: objet.cancel_at_period_end ? 'resiliation_programmee' : 'resiliation_annulee', details: {} }
    }

    case 'customer.subscription.deleted':
      return { type: 'abonnement_termine', details: { plateforme: 'stripe' } }

    case 'charge.refunded': {
      // Même lecture que les commissions : rendu en entier, ou en partie.
      const remboursement = remboursementDesCharges([objet])
      if (!remboursement) return null
      return { type: 'rembourse', details: { partiel: !remboursement.total } }
    }

    default:
      return null
  }
}

/**
 * L'étape du fil que devient un événement Stripe, ou null.
 *
 * @param {any} event — l'événement reçu par le webhook
 * @returns {{ type: string, details: object, sourceKey: string, survenuLe: number } | null}
 *   `survenuLe` : `event.created`, en secondes, que enregistrerEvenementCloser accepte
 */
export function etapeDepuisEvenementStripe(event) {
  const objet = event?.data?.object
  if (typeof event?.id !== 'string' || !event.id || !objet || typeof objet !== 'object') return null
  const etape = etapeDeLObjet(event, objet)
  if (!etape) return null
  const commun = { sourceKey: cleEvenementStripe(event), survenuLe: event.created }
  const { repli, ...principale } = etape
  return { ...commun, ...principale, ...(repli ? { repli: { ...commun, ...repli } } : {}) }
}

/** L'abonnement d'une facture : forme clover (`parent`), puis forme acacia. */
function abonnementDeLaFacture(facture) {
  const brut = facture?.parent?.subscription_details?.subscription ?? facture?.subscription
  const id = typeof brut === 'string' ? brut : brut?.id
  return typeof id === 'string' && id ? id : null
}
