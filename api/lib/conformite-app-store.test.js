import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les deux exigences de l'App Store qui feraient refuser Actero.
 *
 * Audit de pré-soumission du 11 septembre 2026, contre la liste officielle
 * (`shopify doc fetch` → app-store-ai-self-review-requirements). Trente-quatre
 * exigences applicables, deux problèmes.
 *
 * 2.3.1 — INITIER L'INSTALLATION DEPUIS UNE SURFACE SHOPIFY
 *
 * « Votre app ne doit pas demander la saisie manuelle d'une URL myshopify.com
 * ni du domaine d'une boutique pendant l'installation ou la configuration. »
 *
 * Deux écrans le demandaient : l'assistant de démarrage et la page
 * Intégrations. La consigne de vérification de Shopify dit textuellement de
 * chercher ce genre de champ dans le code — c'est un refus quasi certain.
 *
 * 1.2.1 — FACTURER VIA SHOPIFY
 *
 * « Les apps qui facturent hors plateforme ne peuvent pas être distribuées. »
 *
 * L'architecture était juste — Managed Pricing pour les marchands Shopify,
 * Stripe pour les inscriptions directes — mais la règle ne vivait que dans le
 * navigateur. Les trois routes Stripe ne vérifiaient rien côté serveur, et le
 * repli vers Stripe se déclenchait même sur une erreur de base de données.
 *
 * Ces deux défauts se reposeraient sans bruit : personne ne voit une garde
 * absente, et l'app continue de « marcher ».
 */

/** Retire les commentaires : une garde qui lit du code doit lire du code. */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Les fichiers que voit un MARCHAND. Les outils internes (src/components/admin)
 * sont exclus : ils vivent derrière l'authentification Actero, un examinateur
 * Shopify ne peut pas les atteindre, et un commercial y saisit légitimement le
 * domaine d'un prospect.
 */
function fichiersMarchand(dir = 'src', acc = []) {
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree)
    if (chemin.startsWith('src/components/admin')) continue
    if (statSync(chemin).isDirectory()) fichiersMarchand(chemin, acc)
    else if (/\.(jsx?|tsx?)$/.test(entree) && !entree.includes('.test.')) acc.push(chemin)
  }
  return acc
}

const ROUTES_STRIPE = [
  'api/billing/upgrade.js',
  'api/billing/create-subscription.js',
  'api/create-checkout-session.js',
]

describe('App Store 2.3.1 — l\'installation part de chez Shopify', () => {
  it('aucun écran marchand ne réclame un domaine de boutique', () => {
    const fautifs = []
    for (const f of fichiersMarchand()) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      // On cherche la SAISIE, pas la mention. Un badge qui affiche le domaine
      // déjà connecté est légitime ; un placeholder qui invite à le taper non.
      if (/placeholder\s*=\s*["'{][^"'}]*myshopify/i.test(src)) {
        fautifs.push(`${f} — champ de saisie d'un domaine myshopify`)
      }
      if (/oauthPromptPlaceholder\s*:\s*['"][^'"]*myshopify/i.test(src)) {
        fautifs.push(`${f} — invite OAuth demandant un domaine myshopify`)
      }
    }
    expect(
      fautifs,
      'App Store 2.3.1 interdit de faire taper le domaine de la boutique :\n' + fautifs.join('\n'),
    ).toEqual([])
  })

  it('le fournisseur Shopify n\'a pas d\'invite de domaine', () => {
    const src = sansCommentaires(readFileSync('src/config/integrations.js', 'utf8'))
    // Borne de fin : l'entrée SUIVANTE. La version précédente s'arrêtait sur
    // `category: 'ecommerce'`, un champ que personne ne lisait — et qui a été
    // retiré. Se borner sur un champ dont on ne se sert pas, c'est confier sa
    // garde à une ligne que rien ne protège.
    const début = src.indexOf("id: 'shopify'")
    const suivant = src.indexOf("id: '", début + 5)
    const bloc = src.slice(début, suivant === -1 ? undefined : suivant)
    expect(bloc.length, 'bloc Shopify introuvable ou vide').toBeGreaterThan(50)
    expect(bloc, 'le bloc Shopify redemande un domaine').not.toMatch(/oauthPrompt\s*:/)
  })

  it('la route d\'installation renvoie vers l\'App Store au lieu d\'exiger un domaine', () => {
    const src = sansCommentaires(readFileSync('api/shopify/install.js', 'utf8'))
    expect(src, 'la route refuse encore la requête sans `shop` au lieu de rediriger')
      .not.toMatch(/Missing shop parameter/)
    expect(src, 'aucune redirection vers la fiche App Store')
      .toMatch(/apps\.shopify\.com/)
  })

  it('le rattachement au compte survit au détour par l\'App Store', () => {
    // Sans le cookie, un marchand déjà inscrit se retrouverait avec un SECOND
    // compte après l'installation : callback.js résout le client depuis
    // `actero_token`, pas depuis le paramètre `shop`.
    const src = sansCommentaires(readFileSync('api/shopify/install.js', 'utf8'))
    const sansShop = src.slice(src.indexOf('if (!shop)'))
    expect(sansShop, 'le cookie de session n\'est pas posé avant le départ vers Shopify')
      .toMatch(/actero_token=/)
  })
})

describe('App Store 1.2.1 — un marchand Shopify se facture chez Shopify', () => {
  it('les trois routes Stripe refusent un client ayant une boutique Shopify', () => {
    const sans = []
    for (const f of ROUTES_STRIPE) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (!/refuserFacturationStripe\s*\(/.test(src)) sans.push(f)
    }
    expect(
      sans,
      'Ces routes factureraient un marchand venu de l\'App Store — motif de refus :\n' + sans.join('\n'),
    ).toEqual([])
  })

  it('une erreur de base ne devient jamais « pas de boutique Shopify »', () => {
    // Le défaut d'origine : `const { data: connection } = await ...` jetait
    // l'erreur, donc une base indisponible faisait replier sur Stripe.
    const src = readFileSync('api/lib/facturation-shopify.js', 'utf8')
    expect(src, 'l\'erreur de requête n\'est pas distinguée de l\'absence de connexion')
      .toMatch(/if\s*\(error\)\s*return\s*\{\s*statut:\s*'indetermine'/)

    const billing = sansCommentaires(readFileSync('api/billing/shopify-billing.js', 'utf8'))
    expect(billing, 'shopify-billing ignore encore l\'erreur de requête')
      .not.toMatch(/const\s*\{\s*data:\s*connection\s*\}\s*=\s*await/)
  })

  it('l\'état indéterminé n\'autorise personne', () => {
    // Ni Shopify ni Stripe. Mieux vaut un paiement à réessayer qu'un marchand
    // facturé sur le mauvais rail.
    const src = readFileSync('api/lib/facturation-shopify.js', 'utf8')
    expect(src).toMatch(/statut === 'indetermine'/)
    expect(src, 'l\'état indéterminé devrait répondre 503, pas laisser passer')
      .toMatch(/status\(503\)/)
  })

  it('le garde-fou serveur double celui du navigateur, il ne le remplace pas', () => {
    // billing-router.js reste : il évite un aller-retour inutile et donne un
    // message clair. Mais il n'est plus la SEULE chose qui applique la règle.
    expect(existsSync('src/lib/billing-router.js')).toBe(true)
    const src = sansCommentaires(readFileSync('src/lib/billing-router.js', 'utf8'))
    expect(src, 'le routeur navigateur doit toujours passer par shopify-billing')
      .toMatch(/billing\/shopify-billing/)
  })
})
