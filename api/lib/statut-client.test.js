import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Le statut d'un compte décide s'il est servi. Il ne doit dépendre de personne.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER — 11 septembre 2026
 *
 * `clients.status` avait pour défaut 'inactive', et
 * `api/engine/webhooks/widget.js` refuse tout statut autre qu'`active`. Un
 * marchand créé par l'un des TROIS chemins qui n'écrivent pas `status`
 * obtenait donc une bulle qui s'affiche, un visiteur qui écrit, et un 403 sur
 * chaque message. Aucune erreur côté marchand : juste un chat mort.
 *
 *   src/lib/resolve-client.js   inscription Google, client créé côté navigateur
 *   api/shopify/callback.js     installation App Store
 *   api/stripe-webhook.js       tunnel de vente
 *
 * Trois comptes étaient déjà dans cet état en base. Deux ont été réparés, le
 * troisième portait un abonnement Stripe et n'a pas été touché.
 *
 * POURQUOI LE DÉFAUT ET PAS LES APPELANTS
 *
 * Corriger les cinq chemins de création revient à parier sur la mémoire du
 * sixième. Le défaut de colonne, lui, ne s'oublie pas. C'est la même leçon que
 * partout cette semaine : ce qui dépend de la discipline finit par céder.
 *
 * ET LE COMMENTAIRE QUI A TOUT DÉCLENCHÉ
 *
 * La colonne était documentée « NULL = active (default) ». Faux deux fois :
 * NOT NULL, et défaut 'inactive'. C'est très probablement cette phrase qui a
 * fait écrire la garde du widget telle qu'elle est.
 */

const SCHEMA = readFileSync('supabase/schema.sql', 'utf8')

/** La définition de la table clients, extraite de la photo du schéma. */
function tableClients() {
  const i = SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS "public"."clients"')
  if (i === -1) return null
  return SCHEMA.slice(i, SCHEMA.indexOf('\n);', i))
}

describe('statut et formule d’un compte', () => {
  it('la table clients a bien été trouvée dans la photo du schéma', () => {
    // Sans ça, les gardes ci-dessous lisent `null` et passent au vert sans
    // rien vérifier.
    expect(tableClients(), 'CREATE TABLE clients introuvable dans schema.sql').not.toBeNull()
  })

  it('un compte est ACTIF par défaut', () => {
    // Le défaut est la seule chose qui protège les chemins de création qui
    // oublient d'écrire le statut — et il y en a trois sur cinq.
    expect(
      tableClients(),
      'Le défaut de clients.status n’est plus « active ». Tout chemin de '
      + 'création qui oublie ce champ produira un marchand dont la bulle '
      + 'répond 403 à chacun de ses clients, sans erreur visible.',
    ).toMatch(/"status" "text" DEFAULT 'active'/)
  })

  it('une formule vaut « free » par défaut, jamais NULL', () => {
    // `plan-limits.js` retombe sur les limites du plan gratuit pour une valeur
    // inconnue. Sans défaut, un marchand du tunnel facturé 800 €/mois était
    // donc traité comme un compte gratuit partout.
    expect(
      tableClients(),
      'Le défaut de clients.plan a disparu : un marchand payant peut redevenir '
      + 'silencieusement un compte gratuit.',
    ).toMatch(/"plan" "text" DEFAULT 'free'/)
  })

  it('tout statut dont le code a besoin est autorisé par la contrainte', () => {
    // La garde qui manquait, et le défaut qu'elle arrête.
    //
    // `api/shopify/webhooks/app/uninstalled.js:93` écrivait
    // `status: 'uninstalled'`, valeur ABSENTE du CHECK. L'écriture échouait à
    // chaque désinstallation ; l'erreur était avalée par un `console.warn`, le
    // webhook répondait 200, et le compte restait 'active' avec
    // `uninstalled_at` jamais renseigné. Rien, nulle part, ne pouvait le dire.
    //
    // Une première version de ce test corrélait `from('clients')` et un
    // `status:` proche. Elle lisait la contrainte d'une AUTRE table et
    // signalait 'signed_up', 'dismissed', 'none' — des statuts qui n'ont rien
    // à voir avec les comptes. Une garde qui crie faux finit désactivée : on
    // énumère donc, avec la raison de chacun.
    const STATUTS_UTILISES = {
      active: 'le cas normal — seul statut que le widget accepte de servir',
      inactive: 'abonnement payant terminé (api/lib/subscription-plan.js)',
      canceled: 'résiliation enregistrée (api/stripe-webhook.js)',
      past_due: 'paiement en échec côté Stripe',
      uninstalled: 'app Shopify retirée (api/shopify/webhooks/app/uninstalled.js)',
      redacted: 'shop/redact traité, données effacées, ligne gardée pour les FK',
      pending_deletion: 'suppression demandée, délai de grâce en cours',
    }

    // La contrainte de la table CLIENTS, pas la première trouvée dans le
    // fichier — plusieurs tables ont une colonne `status` sous contrainte.
    const bloc = tableClients() || ''
    const contrainte = bloc.match(/"status" = ANY \(ARRAY\[([^\]]*)\]/)
    expect(contrainte, 'la contrainte CHECK sur clients.status a disparu').not.toBeNull()
    const autorises = new Set([...contrainte[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))

    const manquants = Object.keys(STATUTS_UTILISES).filter((v) => !autorises.has(v))
    expect(
      manquants.map((v) => `${v} — ${STATUTS_UTILISES[v]}`),
      'Statut dont le code a besoin mais que la contrainte refuse : toute '
      + 'écriture de cette valeur échouera, et si l’erreur est avalée le compte '
      + 'gardera silencieusement son ancien statut.\n  ' + manquants.join('\n  '),
    ).toEqual([])
  })

  it('« inactive » ne signifie plus qu’une seule chose', () => {
    // Avant, le mot voulait dire à la fois « jamais activé » (le défaut) et
    // « abonnement terminé » (subscription-plan.js). Les deux étaient
    // indiscernables, donc aucun code ne pouvait traiter l'un sans l'autre.
    // Maintenant que le défaut est 'active', il ne reste que le second sens —
    // et ce commentaire existe pour que la prochaine personne le sache.
    const plan = readFileSync('api/lib/subscription-plan.js', 'utf8')
    expect(plan, 'subscription-plan.js n’écrit plus « inactive » : si un autre '
      + 'fichier a repris ce rôle, mettez ce test à jour')
      .toMatch(/update\.status = 'inactive'/)
  })
})
