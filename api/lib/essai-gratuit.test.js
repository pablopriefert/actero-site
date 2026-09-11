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

  it('un essai déjà pris l\'emporte sur TOUS les drapeaux', () => {
    // Règle inversée le 10 septembre, et c'est le cœur du correctif.
    //
    // Avant, les drapeaux passaient devant `trial_ends_at`. Un drapeau resté
    // posé rouvrait donc un second essai — ce qui obligeait les routes de
    // facturation à le consommer dès la création de la session Stripe, avant
    // tout paiement. C'est cette consommation anticipée qui brûlait le mois
    // d'un marchand ayant simplement fermé l'écran de carte bancaire.
    //
    // Maintenant la date tranche en premier : un essai pris est pris, quel que
    // soit le drapeau. Plus rien n'oblige à consommer par avance.
    expect(joursEssaiPour({ referral_first_month_free: true, trial_ends_at: '2026-01-01T00:00:00Z' }))
      .toBeUndefined()
    expect(joursEssaiPour({ campaign_first_month_free: true, trial_ends_at: '2026-01-01T00:00:00Z' }))
      .toBeUndefined()
  })

  it('un panier abandonné ne brûle pas le mois offert', () => {
    // LE DÉFAUT CONSTATÉ EN VRAI, le 10 septembre.
    //
    // Pablo s'inscrit par le lien de la campagne, arrive sur Stripe, et lit
    // « Démarrer l'essai de 7 jours » alors qu'on lui en promet trente. Cause :
    // un premier clic avait créé une session Stripe, ce qui consommait le
    // drapeau sur-le-champ ; il avait fermé la page sans payer, et son mois
    // était déjà perdu — définitivement, sans aucun moyen de le récupérer.
    //
    // Tant que `trial_ends_at` est vide, AUCUN essai n'a réellement eu lieu, et
    // le mois reste dû. C'est exactement la situation d'un écran de paiement
    // qu'on referme, le geste le plus banal du parcours.
    const apresAbandon = { campaign_first_month_free: true, trial_ends_at: null }
    expect(joursEssaiPour(apresAbandon)).toBe(ESSAI_CAMPAGNE_JOURS)
    // Et autant de fois qu'il revient : rien ne s'use tant que rien n'est payé.
    expect(joursEssaiPour(apresAbandon)).toBe(ESSAI_CAMPAGNE_JOURS)
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

  it('aucun chemin de paiement ne consomme le mois avant le paiement', () => {
    // La garde exactement INVERSE de celle qu'il y avait ici avant, parce que
    // l'ancienne exigeait précisément ce qui cassait le parcours.
    //
    // Ces routes créent une session Stripe : à cet instant le marchand n'a rien
    // payé, rien signé, et peut très bien fermer l'onglet. Remettre un drapeau
    // à false ici, c'est retirer un mois à quelqu'un qui n'a rien reçu.
    //
    // Ce qui interdit d'en réclamer un second est ailleurs, et ne dépend pas de
    // la bonne volonté de ces fichiers : `joursEssaiPour` refuse tout essai dès
    // que `trial_ends_at` existe, et cette date n'est écrite qu'une fois
    // l'abonnement réellement créé par Stripe.
    const fautifs = []
    for (const f of ['api/billing/create-subscription.js', 'api/billing/upgrade.js']) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      if (/campaign_first_month_free:\s*false/.test(src)) {
        fautifs.push(`${f} consomme le mois de campagne avant le paiement`)
      }
      if (/referral_first_month_free:\s*false/.test(src)) {
        fautifs.push(`${f} consomme le mois de parrainage avant le paiement`)
      }
    }
    expect(fautifs, `Mois brûlé sans contrepartie :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('c\'est bien `trial_ends_at` qui garde la porte, et en premier', () => {
    // Si quelqu'un remet un jour les drapeaux devant la date, le trou se
    // rouvre en silence : un drapeau non consommé rendrait l'essai infini.
    // Cette garde lit l'ordre réel des tests dans la fonction.
    const src = sansCommentaires(readFileSync('api/lib/essai-gratuit.js', 'utf8'))
    const corps = src.slice(src.indexOf('export function joursEssaiPour'))
    const posDate = corps.indexOf('trial_ends_at')
    const posParrainage = corps.indexOf('referral_first_month_free')
    const posCampagne = corps.indexOf('campaign_first_month_free')
    expect(posDate, 'trial_ends_at doit être testé AVANT les drapeaux').toBeGreaterThan(-1)
    expect(posDate).toBeLessThan(posParrainage)
    expect(posDate).toBeLessThan(posCampagne)
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
    //
    // La destination se vérifie ; le CODE dans l'URL ne doit surtout pas s'y
    // trouver. Le 11 septembre, ces deux redirections remettaient le code
    // dans la chaîne de requête, `memoriserCodeCampagne()` le relisait au
    // chargement, et le cookie de trente jours se réarmait après que le mois
    // eut été accordé — tout compte créé ensuite dans ce navigateur repartait
    // avec un mois offert. Ce test épinglait ce mécanisme et le protégeait.
    // Il porte maintenant sur l'intention : arriver sur la page de plans.
    for (const f of ['api/auth/verify-code.js', 'src/pages/AuthCallbackPage.jsx']) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      expect(src, `${f} ne redirige pas vers la sélection de plan`)
        .toMatch(/\/signup\/plan/)
      expect(src, `${f} remet le code de campagne dans l'URL — le cookie se réarmera`)
        .not.toMatch(/signup\/plan\?campagne=/)
    }
  })

  it('la page de plans annonce le mois — et seulement quand il est accordé', () => {
    // Deux erreurs symétriques, et ce test a longtemps ne gardé que la
    // première :
    //
    //   annoncer 7 jours à quelqu'un qui en a 30 → il part en se demandant
    //     s'il a bien eu son mois ;
    //   annoncer 30 jours à quelqu'un qui en a 7 → il le découvre sur sa
    //     facture, et c'est le premier motif de remboursement.
    //
    // La page décidait sur la SEULE PRÉSENCE d'un paramètre dans l'URL, quelle
    // que soit sa valeur : `?campagne=NIMPORTEQUOI` promettait un mois. Un
    // vieux code d'une publicité arrêtée faisait pareil. Ce test épinglait
    // `urlParams.get("campagne")` — il protégeait donc le mécanisme fautif.
    const page = sansCommentaires(readFileSync('src/pages/PlanSelectionPage.jsx', 'utf8'))

    expect(page, 'le bouton n\'annonce plus les 30 jours')
      .toMatch(/moisOffert \? "30 jours gratuits"/)

    // Ce que la page a le droit de croire : le marqueur que NOUS posons après
    // l'accord du serveur, et les drapeaux écrits sur la ligne `clients`.
    expect(page, 'le marqueur d\'affichage posé par le serveur n\'est pas lu')
      .toMatch(/urlParams\.get\("offre"\)/)
    expect(page, 'la page ne confirme pas auprès du serveur')
      .toMatch(/campaign_first_month_free/)

    // Ce qu'elle n'a pas le droit de croire : un code brut dans l'URL.
    for (const param of ['campagne', 'campaign_code', 'referral_code']) {
      expect(page, `la page décide encore d'après urlParams.get("${param}") — `
        + 'une valeur quelconque suffit alors à promettre un mois')
        .not.toMatch(new RegExp(`urlParams\\.get\\("${param}"\\)`))
    }
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

  it('l\'écran de paiement annonce la durée que le SERVEUR a accordée', () => {
    // Le défaut du 10 septembre, deuxième couche — et le plus trompeur des deux.
    //
    // Le serveur accordait bien trente jours à un marchand venu de la campagne.
    // Stripe enregistrait trente jours. Et l'écran de paiement affichait
    // « Démarrer l'essai de 7 jours », parce que PaymentModal lisait
    // `plan?.trial?.days || 7` — la valeur commerciale écrite en dur dans
    // src/lib/plans.js — faute qu'on lui ait jamais transmis le vrai chiffre.
    //
    // Pour une publicité qui promet un mois, afficher sept revient exactement au
    // même que de n'en donner que sept : le marchand ne vérifie pas dans Stripe,
    // il lit l'écran et il part.
    const modal = sansCommentaires(readFileSync('src/components/billing/PaymentModal.jsx', 'utf8'))

    expect(modal, 'le modal n\'utilise pas la durée renvoyée par le serveur')
      .toMatch(/data\.trial_days/)
    expect(modal, 'le modal invente une durée d\'essai au lieu de la demander')
      .not.toMatch(/trial\?\.days\s*\|\|\s*\d/)

    const route = sansCommentaires(readFileSync('api/billing/create-subscription.js', 'utf8'))
    expect(route, 'la route ne dit pas au navigateur combien de jours elle a accordés')
      .toMatch(/trial_days:/)
  })

  it('l\'email de fin d\'essai part bien du webhook Stripe', () => {
    // Une durée alignée ne sert à rien si le marchand n'est pas prévenu : le
    // rappel « votre essai se termine le … » est envoyé sur l'événement
    // trial_will_end, trois jours avant.
    const src = readFileSync('api/stripe-webhook.js', 'utf8')
    expect(src, 'plus personne n\'écoute la fin d\'essai').toMatch(/customer\.subscription\.trial_will_end/)
  })

  it('l\'email de fin d\'essai ne promet pas un renouvellement qui n\'aura pas lieu', () => {
    // Ce que devient l'abonnement à la fin dépend d'UNE chose : la carte.
    // create-subscription.js pose `missing_payment_method: 'cancel'`, donc sans
    // moyen de paiement l'abonnement ne démarre pas — il s'annule.
    //
    // L'email affirmait pourtant à tout le monde « aucune action n'est requise,
    // votre abonnement démarrera automatiquement », et proposait d'aller au
    // tableau de bord « si vous souhaitez annuler ». Pour un marchand sans
    // carte, c'était l'inverse exact de ce qu'il devait faire — envoyé trois
    // jours avant qu'il perde son accès.
    //
    // Le cas est courant sur le parcours de la campagne : l'écran de paiement
    // s'ouvre, le marchand le referme sans saisir sa carte, et l'abonnement
    // d'essai reste là un mois.
    const webhook = sansCommentaires(readFileSync('api/stripe-webhook.js', 'utf8'))
    const bloc = webhook.slice(webhook.indexOf('trial_will_end'))

    expect(bloc, 'le webhook ne regarde pas si une carte est enregistrée')
      .toMatch(/resolveCustomerCard\(/)
    expect(bloc, 'aucune version de l\'email ne s\'adresse au marchand sans carte')
      .toMatch(/Ajouter une carte/)

    // La prémisse. Si `end_behavior` disparaissait, l'abonnement se
    // poursuivrait sans carte et c'est ce test qu'il faudrait revoir — pas
    // l'email, qui deviendrait alors juste pour tout le monde.
    const route = sansCommentaires(readFileSync('api/billing/create-subscription.js', 'utf8'))
    expect(route, 'l\'email suppose qu\'un essai sans carte s\'annule : ce n\'est plus le cas')
      .toMatch(/missing_payment_method:\s*'cancel'/)
  })
})
