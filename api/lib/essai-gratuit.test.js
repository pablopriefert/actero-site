import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { joursEssaiPour, ESSAI_STANDARD_JOURS, ESSAI_PARRAINAGE_JOURS, ESSAI_CAMPAGNE_JOURS } from './essai-gratuit.js'

/**
 * ACT-33 — un seul essai gratuit, quel que soit le bouton cliqué.
 *
 * Le 10 septembre 2026, trois chemins menaient à un abonnement Stripe et
 * accordaient trois essais différents : 30 jours si parrainage, sinon 7 jours
 * sur deux d'entre eux et **aucun essai** sur le troisième. Les valeurs
 * avaient dérivé séparément, et rien ne les tenait ensemble.
 *
 * Ce qui rend le défaut coûteux, c'est la campagne publicitaire : une
 * publicité qui promet un mois gratuit et un produit qui en donne sept jours,
 * c'est la première chose que le marchand vérifie.
 */

// Retire les commentaires avant toute analyse de source.
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CHEMINS = [
  'api/create-checkout-session.js',
  'api/billing/create-subscription.js',
  'api/billing/upgrade.js',
]

describe('durée de l\'essai gratuit', () => {
  it('un parrainage donne un mois', () => {
    expect(joursEssaiPour({ referral_first_month_free: true })).toBe(ESSAI_PARRAINAGE_JOURS)
  })

  it('un marchand venu de la campagne a un mois', () => {
    // Décision du 10 septembre : la pub annonce « 1 mois gratuit », mais
    // seulement pour ceux qui arrivent par elle.
    expect(joursEssaiPour({ campaign_first_month_free: true })).toBe(ESSAI_CAMPAGNE_JOURS)
    expect(ESSAI_CAMPAGNE_JOURS).toBe(30)
  })

  it('celui qui trouve Actero autrement garde l\'essai standard', () => {
    expect(joursEssaiPour({ campaign_first_month_free: false })).toBe(ESSAI_STANDARD_JOURS)
    expect(ESSAI_STANDARD_JOURS).toBe(7)
  })

  it('un nouveau marchand a l\'essai standard', () => {
    expect(joursEssaiPour({})).toBe(ESSAI_STANDARD_JOURS)
    expect(joursEssaiPour({ trial_ends_at: null })).toBe(ESSAI_STANDARD_JOURS)
  })

  it('un marchand qui a déjà eu un essai n\'en a pas un second', () => {
    // Même expiré : `trial_ends_at` est la trace qui empêche de réclamer un
    // nouvel essai en résiliant puis en se réabonnant.
    expect(joursEssaiPour({ trial_ends_at: '2026-01-01T00:00:00Z' })).toBeUndefined()
  })

  it('le parrainage l\'emporte sur un essai déjà consommé', () => {
    expect(joursEssaiPour({ referral_first_month_free: true, trial_ends_at: '2026-01-01T00:00:00Z' }))
      .toBe(ESSAI_PARRAINAGE_JOURS)
  })

  it('« pas d\'essai » vaut undefined, jamais 0', () => {
    // Stripe traite `trial_period_days: 0` autrement que l'absence du champ :
    // l'abonnement est facturé tout de suite mais marqué comme sortant
    // d'essai, ce qui fausse `trial_ends_at` et donc l'éligibilité future.
    expect(joursEssaiPour({ trial_ends_at: '2026-01-01T00:00:00Z' })).not.toBe(0)
  })

  it('les chemins qui lisent le drapeau de campagne le sélectionnent aussi', () => {
    // Le piège de gorgias.js, transposé : lire `client.campaign_first_month_free`
    // sans le ramener dans le `.select()` donnerait TOUJOURS undefined. Le
    // marchand venu de la pub aurait sept jours au lieu de trente, et rien
    // n'échouerait — la campagne aurait simplement l'air de ne pas marcher.
    for (const f of ['api/billing/create-subscription.js', 'api/billing/upgrade.js']) {
      const src = readFileSync(f, 'utf8')
      if (!/client\.campaign_first_month_free/.test(src)) continue
      expect(src, `${f} lit le drapeau sans le sélectionner`)
        .toMatch(/\.select\(\s*'[^']*campaign_first_month_free/)
    }
  })

  it('le mois de campagne se consomme, comme celui du parrainage', () => {
    // Sans ça, un marchand qui résilie et se réabonne le réclame à chaque fois.
    for (const f of ['api/billing/create-subscription.js', 'api/billing/upgrade.js']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} ne remet jamais campaign_first_month_free à false`)
        .toMatch(/campaign_first_month_free:\s*false/)
    }
  })

  it('le code de campagne est validé côté serveur, jamais cru sur parole', () => {
    // Offrir un mois sur la foi d'un paramètre que le navigateur envoie, c'est
    // un cadeau à qui devine le mot. Le code doit être confronté à une
    // variable d'environnement.
    // La décision a été déplacée dans api/lib/campagne.js le 10 septembre,
    // quand il a fallu la partager avec le chemin Google. C'est donc là que
    // la validation et l'écriture doivent se trouver — et nulle part ailleurs.
    const src = readFileSync('api/lib/campagne.js', 'utf8')
    expect(src, 'le code n\'est pas confronté à la liste des codes actifs')
      .toMatch(/process\.env\.CAMPAIGN_TRIAL_CODES/)
    expect(src, 'le drapeau doit être écrit côté serveur après validation')
      .toMatch(/campaign_first_month_free: true/)
  })

  it('les DEUX chemins d\'inscription accordent le mois de campagne', () => {
    // Le défaut du 10 septembre, constaté en vrai : le code était branché sur
    // l'inscription email/mot de passe seulement. Un marchand venu de la pub
    // et inscrit avec GOOGLE repartait avec sept jours — son compte n'est créé
    // par aucune route serveur, mais côté navigateur au retour d'OAuth.
    //
    // Un chemin sur deux, et rien ne l'aurait signalé : la campagne aurait
    // simplement converti moitié moins bien.
    const signup = sansCommentaires(readFileSync('api/auth/signup.js', 'utf8'))
    expect(signup, 'le chemin email n\'applique pas la campagne')
      .toMatch(/appliquerCampagne\(/)

    expect(existsSync('api/auth/apply-campaign.js'),
      'le chemin Google n\'a pas de route pour réclamer son mois').toBe(true)

    const resolve = sansCommentaires(readFileSync('src/lib/resolve-client.js', 'utf8'))
    expect(resolve, 'le client créé après OAuth ne présente jamais son code')
      .toMatch(/presenterCodeCampagne\(/)
  })

  it('la campagne s\'applique là où le compte est VRAIMENT créé', () => {
    // Trois routes portent le mot « signup » dans ce dépôt, et une seule crée
    // le compte pour l'inscription email : verify-code.js. J'avais branché la
    // campagne sur signup.js — elle ne s'appliquait jamais. Un nom de fichier
    // n'est pas une preuve de chemin.
    const verify = sansCommentaires(readFileSync('api/auth/verify-code.js', 'utf8'))
    expect(verify, 'verify-code.js crée le compte mais n\'applique pas la campagne')
      .toMatch(/appliquerCampagne\(/)
    expect(verify, 'verify-code.js doit lire le code envoyé par le formulaire')
      .toMatch(/payload\.campaign_code/)
  })

  it('un inscrit venu de la pub voit la page de plans, pas le tableau de bord', () => {
    // Il vient POUR le mois offert : l'envoyer directement au tableau de bord
    // lui fait rater ce qu'on a payé pour lui vendre. Les deux chemins
    // d'inscription doivent l'emmener choisir un plan.
    const verify = sansCommentaires(readFileSync('api/auth/verify-code.js', 'utf8'))
    expect(verify, 'le chemin email ne redirige pas vers la sélection de plan')
      .toMatch(/\/signup\/plan\?campagne=/)

    const callback = sansCommentaires(readFileSync('src/pages/AuthCallbackPage.jsx', 'utf8'))
    expect(callback, 'le chemin Google ne redirige pas vers la sélection de plan')
      .toMatch(/\/signup\/plan\?campagne=/)
  })

  it('la page de plans reconnaît une arrivée par la publicité', () => {
    // Sans ça, elle annoncerait « Essai gratuit 7 jours » à quelqu'un qui en a
    // trente — et il partirait en se demandant s'il a bien eu son mois.
    const page = sansCommentaires(readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8'))
    expect(page, 'la page de plans ignore le paramètre de campagne')
      .toMatch(/urlParams\.get\("campagne"\)/)
    expect(page, 'le bouton n\'annonce pas les 30 jours')
      .toMatch(/isCampagne\) \? "30 jours gratuits"/)
  })

  it('le code survit à l\'aller-retour vers Google', () => {
    // La redirection OAuth perd la chaîne de requête. Sans mémorisation avant
    // le départ, le code n'existe plus au retour — et la route la mieux
    // écrite du monde n'a rien à valider.
    // Commentaires retirés avant l'analyse. Sans ça, mettre l'appel en
    // commentaire laissait le test vert — vérifié : c'est arrivé. Quatrième
    // fois aujourd'hui qu'une garde se laisse berner par du texte ; un test
    // qui lit du code doit lire du code.
    const main = sansCommentaires(readFileSync('src/main.jsx', 'utf8'))
    expect(main, 'le code n\'est pas mémorisé au chargement, il sera perdu')
      .toMatch(/memoriserCodeCampagne\(\)/)
  })

  it('le navigateur ne s\'accorde jamais le mois lui-même', () => {
    // resolve-client.js crée le client depuis le navigateur, sous RLS. S'il
    // écrivait campaign_first_month_free, n'importe qui s'offrirait un mois en
    // modifiant une requête.
    const resolve = readFileSync('src/lib/resolve-client.js', 'utf8')
    expect(resolve, 'le navigateur écrit lui-même le drapeau de campagne')
      .not.toMatch(/campaign_first_month_free/)

    const campagne = readFileSync('api/lib/campagne.js', 'utf8')
    expect(campagne, 'le serveur ne confronte pas le code à la liste des codes actifs')
      .toMatch(/CAMPAIGN_TRIAL_CODES/)
  })

  it('le formulaire d\'inscription transporte bien le code de campagne', () => {
    // Sans ça, la route accepterait un `campaign_code` que personne
    // n'envoie jamais : le neuvième « code écrit mais jamais appelé » de la
    // semaine, et la campagne n'accorderait rien à personne.
    const src = readFileSync('src/pages/SignupPage.jsx', 'utf8')
    expect(src, 'SignupPage ne lit plus le code de campagne')
      .toMatch(/codeCampagneCourant\(\)/)
    expect(src, 'SignupPage ne transmet pas campaign_code à l\'API')
      .toMatch(/campaign_code: campaignCode/)
  })

  it('aucun chemin de paiement ne redéfinit sa propre durée', () => {
    // C'est la garde qui compte. Trois fichiers, une seule source : si l'un
    // d'eux réécrit un nombre de jours en dur, la divergence recommence — et
    // elle ne se voit pas, parce que chaque chemin marche très bien tout seul.
    const fautifs = []
    for (const f of CHEMINS) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      if (/trial_period_days\s*[:=]\s*\d/.test(src)) fautifs.push(`${f} : durée écrite en dur`)
      if (!/joursEssaiPour\(/.test(src)) fautifs.push(`${f} : n'utilise pas joursEssaiPour()`)
    }
    expect(fautifs, `Divergence des essais :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('l\'email de fin d\'essai part bien du webhook Stripe', () => {
    // Une durée alignée ne sert à rien si le marchand n'est pas prévenu : le
    // rappel « votre essai se termine le … » est envoyé sur l'événement
    // trial_will_end, trois jours avant.
    const src = readFileSync('api/stripe-webhook.js', 'utf8')
    expect(src, 'plus personne n\'écoute la fin d\'essai').toMatch(/customer\.subscription\.trial_will_end/)
  })
})
