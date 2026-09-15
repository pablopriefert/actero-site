import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { OPTIONS_REQUETE_COURTE } from './stripe-customer.js'
import {
  planUpdateFromSubscription,
  formuleDeLAbonnement,
  doitResoudreLaCarte,
  ecritureAutorisee,
  annoncerLaFinDEssai,
  STATUTS_TERMINES,
} from './subscription-plan.js'

const PRO_MENSUEL = { id: 'price_pm', lookup_key: 'actero_pro_mensuel' }
const sub = (over = {}, price = PRO_MENSUEL) => ({ status: 'active', items: { data: [{ price }] }, ...over })
const CARTE = { aUneCarte: true }
const SANS_CARTE = { aUneCarte: false }

function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('STATUTS_TERMINES', () => {
  it('contient exactement les trois statuts qui ferment tout droit', () => {
    // Contenu exact, pas seulement « en contient au moins un » : un statut
    // ajouté ou retiré ici change le comportement des DEUX fichiers qui s'en
    // servent (planUpdateFromSubscription et la branche upgrade du webhook).
    expect(STATUTS_TERMINES).toEqual(['canceled', 'unpaid', 'incomplete_expired'])
  })

  it('est gelé : y ajouter un statut lève, plutôt que de le glisser en silence', () => {
    // Modules ES = strict mode : une écriture sur un tableau gelé lève au
    // lieu d'échouer en silence. On vérifie le comportement, pas seulement
    // le type — un `Object.freeze` retiré par erreur laisserait ce test rouge.
    expect(() => STATUTS_TERMINES.push('active')).toThrow(TypeError)
    expect(STATUTS_TERMINES).toEqual(['canceled', 'unpaid', 'incomplete_expired'])
  })
})

describe('planUpdateFromSubscription', () => {
  it('n’accorde rien à un essai sans carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing' }), SANS_CARTE)
    expect(u.plan).toBeUndefined()
    expect(u.status).toBeUndefined()
  })

  it('accorde en essai avec une carte', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: 1893456000 }), CARTE)
    expect(u.plan).toBe('pro')
    expect(u.status).toBe('active')
    expect(u.trial_ends_at).toBeTruthy()
  })

  it('accorde un abonnement actif avec une carte', () => {
    expect(planUpdateFromSubscription(sub(), CARTE).plan).toBe('pro')
  })

  it('n’accorde rien sans carte', () => {
    expect(planUpdateFromSubscription(sub(), SANS_CARTE).plan).toBeUndefined()
  })

  it('sans information de carte, n’accorde rien', () => {
    expect(planUpdateFromSubscription(sub()).plan).toBeUndefined()
  })

  it('n’accorde rien pour incomplete', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete' }), CARTE).plan).toBeUndefined()
  })

  it('rétrograde en free sur canceled / unpaid, carte ou pas', () => {
    expect(planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE).plan).toBe('free')
    expect(planUpdateFromSubscription(sub({ status: 'unpaid' }), CARTE).plan).toBe('free')
  })

  it('un prix trimestriel et un prix annuel donnent leur plan, sans variable d’environnement', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'p1', lookup_key: 'actero_starter_trimestriel' }), CARTE))
      .toMatchObject({ plan: 'starter', status: 'active', billing_period: 'quarterly', billing_provider: 'stripe' })
    expect(planUpdateFromSubscription(sub({}, { id: 'p2', lookup_key: 'actero_pro_annuel' }), CARTE))
      .toMatchObject({ plan: 'pro', billing_period: 'annual' })
  })

  it('un prix hors catalogue n’accorde aucun plan', () => {
    expect(planUpdateFromSubscription(sub({}, { id: 'price_sur_mesure', lookup_key: null }), CARTE).plan).toBeUndefined()
  })

  it('past_due ne rétrograde pas et n’accorde rien : rien à écrire', () => {
    expect(planUpdateFromSubscription(sub({ status: 'past_due' }), CARTE)).toEqual({})
  })

  it('incomplete_expired rétrograde en free', () => {
    expect(planUpdateFromSubscription(sub({ status: 'incomplete_expired' }), CARTE).plan).toBe('free')
  })

  it('une rétrogradation ne pose ni billing_provider ni billing_period', () => {
    const u = planUpdateFromSubscription(sub({ status: 'canceled' }), SANS_CARTE)
    expect(u).not.toHaveProperty('billing_provider')
    expect(u).not.toHaveProperty('billing_period')
  })

  it('trial_end à null : pas de clé trial_ends_at', () => {
    const u = planUpdateFromSubscription(sub({ status: 'trialing', trial_end: null }), SANS_CARTE)
    expect(u).not.toHaveProperty('trial_ends_at')
  })
})

describe('formuleDeLAbonnement', () => {
  it('formule connue', () => {
    expect(formuleDeLAbonnement(sub())?.plan).toBe('pro')
  })

  it('formule inconnue (hors catalogue)', () => {
    expect(formuleDeLAbonnement(sub({}, { id: 'price_sur_mesure', lookup_key: null }))).toBeNull()
  })
})

describe('doitResoudreLaCarte', () => {
  it('active + formule connue → true', () => {
    expect(doitResoudreLaCarte(sub({ status: 'active' }))).toBe(true)
  })

  it('trialing + formule connue → true', () => {
    expect(doitResoudreLaCarte(sub({ status: 'trialing' }))).toBe(true)
  })

  it('past_due → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'past_due' }))).toBe(false)
  })

  it('canceled → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'canceled' }))).toBe(false)
  })

  it('hors catalogue → false', () => {
    expect(doitResoudreLaCarte(sub({ status: 'active' }, { id: 'price_sur_mesure', lookup_key: null }))).toBe(false)
  })
})

describe('ecritureAutorisee', () => {
  const abonnementCourant = { id: 'sub_B' }
  const ancienAbonnement = { id: 'sub_A' }

  it('rien à écrire → null', () => {
    expect(ecritureAutorisee({}, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toBeNull()
  })

  it('rétrogradation d’un abonnement qui n’est plus le courant → null', () => {
    // Un ancien abonnement A impayé ne doit pas couper un client qui paie B.
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toBeNull()
  })

  it('rétrogradation de l’abonnement courant → la rétrogradation', () => {
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toEqual(miseAJour)
  })

  it('rétrogradation quand aucun abonnement n’est enregistré → la rétrogradation', () => {
    const miseAJour = { plan: 'free', status: 'inactive' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: null }, ancienAbonnement)).toEqual(miseAJour)
  })

  it('accord avec stripe_subscription_id vide → ajoute l’identifiant', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: null }, abonnementCourant))
      .toEqual({ ...miseAJour, stripe_subscription_id: 'sub_B' })
  })

  it('accord de l’abonnement courant → inchangé', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, abonnementCourant)).toEqual(miseAJour)
  })

  it('non courant avec un accord payant → écrit tel quel, sans stripe_subscription_id', () => {
    // Cas légitime : customer.subscription.updated du NOUVEL abonnement arrive
    // avant checkout.session.completed, qui posera stripe_subscription_id
    // ensuite. On accorde le plan sans toucher à l'abonnement enregistré.
    // Le client n'a ici aucun `plan` enregistré (undefined) : c'est justement
    // le cas que la condition « client encore sans plan payant » doit laisser
    // passer — voir les trois tests juste en dessous.
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toEqual(miseAJour)
  })

  it('non courant, accord payant, client en free → écrit tel quel', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { plan: 'free', stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toEqual(miseAJour)
  })

  it('non courant, accord payant, client sans plan (undefined ou null) → écrit tel quel', () => {
    const miseAJour = { plan: 'pro', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { plan: undefined, stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toEqual(miseAJour)
    expect(ecritureAutorisee(miseAJour, { plan: null, stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toEqual(miseAJour)
  })

  it('non courant, accord Starter sur un client déjà en pro → null', () => {
    // Un ancien essai Starter sans carte (sub_1, encore trialing) ne doit pas
    // écraser le plan Pro d'un client qui a payé un nouvel abonnement (sub_2)
    // — voir la docstring de ecritureAutorisee pour le scénario complet.
    const miseAJour = { plan: 'starter', status: 'active' }
    expect(ecritureAutorisee(miseAJour, { plan: 'pro', stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toBeNull()
  })

  it('non courant avec trial_ends_at seul → null', () => {
    // Une date d'essai future, à elle seule, ouvre tout le produit : elle ne
    // doit pas s'écrire pour un abonnement qui n'est pas celui enregistré.
    const miseAJour = { trial_ends_at: '2026-01-01T00:00:00.000Z' }
    expect(ecritureAutorisee(miseAJour, { stripe_subscription_id: 'sub_B' }, ancienAbonnement)).toBeNull()
  })
})

describe('annoncerLaFinDEssai', () => {
  const FIN_ESSAI = 1_900_000_000
  const essai = (over = {}) => ({ status: 'trialing', trial_end: FIN_ESSAI, cancel_at: null, cancel_at_period_end: false, ...over })

  it('un essai qui démarrera à sa fin : on l’annonce', () => {
    expect(annoncerLaFinDEssai(essai())).toBe(true)
  })

  it('résilié en fin de période : il ne démarrera pas, rien à annoncer', () => {
    // C'est l'essai sans carte que la route de paiement neutralise avant
    // d'ouvrir Checkout : lui écrire « ajoutez une carte pour continuer »
    // ferait payer Starter en plus du Pro que le marchand vient de prendre.
    expect(annoncerLaFinDEssai(essai({ cancel_at_period_end: true }))).toBe(false)
  })

  it('résiliation programmée au plus tard à la fin de l’essai : rien à annoncer', () => {
    expect(annoncerLaFinDEssai(essai({ cancel_at: FIN_ESSAI }))).toBe(false)
    expect(annoncerLaFinDEssai(essai({ cancel_at: FIN_ESSAI - 3600 }))).toBe(false)
  })

  it('résiliation programmée APRÈS la fin de l’essai : l’abonnement démarre d’abord, on l’annonce', () => {
    expect(annoncerLaFinDEssai(essai({ cancel_at: FIN_ESSAI + 1 }))).toBe(true)
  })

  it('cancel_at sans date de fin d’essai à comparer : on l’annonce', () => {
    expect(annoncerLaFinDEssai(essai({ cancel_at: FIN_ESSAI, trial_end: null }))).toBe(true)
  })
})

describe('trial_will_end : le webhook relit l’abonnement avant d’annoncer la fin de l’essai', () => {
  // L'objet d'un événement est figé à sa création. Un essai neutralisé par la
  // route de paiement après la création de l'événement, mais avant sa
  // livraison, y paraît encore en cours : décider dessus enverrait « ajoutez
  // une carte pour continuer » à un marchand qui vient de payer une autre formule.
  //
  // Le vrai webhook est chargé, ses dépendances externes remplacées pour ce
  // bloc seulement (vi.doMock) : Stripe, Resend, Supabase, Sentry. La décision
  // (annoncerLaFinDEssai, resolveCustomerCard) reste la vraie.
  const w = { stripe: null, envoyer: null }
  const MODULES = ['./sentry.js', '../marketplace/install.js', './amplitude.js', 'resend', '@supabase/supabase-js', 'stripe']
  const secretAvant = process.env.STRIPE_WEBHOOK_SECRET
  let webhook
  let avertissements
  let traces

  beforeAll(async () => {
    // Lu au chargement du module : à poser avant l'import.
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.resetModules()
    vi.doMock('./sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }))
    vi.doMock('../marketplace/install.js', () => ({ finalizeInstall: async () => {} }))
    vi.doMock('./amplitude.js', () => ({ trackServerEvent: async () => {} }))
    vi.doMock('resend', () => ({ Resend: function Resend() { return { emails: { send: (...args) => w.envoyer(...args) } } } }))
    // Seule écriture en base sur ce chemin : la réservation de l'événement.
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) }))
    // Le webhook crée son client Stripe au chargement : il délègue au faux du test en cours.
    vi.doMock('stripe', () => ({ default: function Stripe() { return new Proxy({}, { get: (_, cle) => w.stripe[cle] }) } }))
    ;({ default: webhook } = await import('../stripe-webhook.js'))
  })

  afterAll(() => {
    for (const module of MODULES) vi.doUnmock(module)
    vi.resetModules()
    if (secretAvant === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = secretAvant
  })

  beforeEach(() => {
    avertissements = vi.spyOn(console, 'warn').mockImplementation(() => {})
    traces = vi.spyOn(console, 'log').mockImplementation(() => {})
    w.envoyer = vi.fn(async () => ({ id: 'email_1' }))
  })

  afterEach(() => {
    avertissements.mockRestore()
    traces.mockRestore()
  })

  const essai = (over = {}) => ({
    id: 'sub_essai', object: 'subscription', status: 'trialing', customer: 'cus_1',
    trial_end: 1_900_000_000, cancel_at: null, cancel_at_period_end: false,
    default_payment_method: null, metadata: { client_id: 'c1' }, ...over,
  })

  /** Livre un trial_will_end dont l'objet est `evenement` ; Stripe relit `relu` (ou lève si c'est une erreur). */
  async function livrer({ evenement, relu }) {
    w.stripe = {
      webhooks: { constructEvent: vi.fn(() => ({ id: 'evt_1', type: 'customer.subscription.trial_will_end', data: { object: evenement } })) },
      subscriptions: { retrieve: vi.fn(async () => { if (relu instanceof Error) throw relu; return relu }) },
      customers: { retrieve: vi.fn(async (id) => ({ id, email: 'marchand@ex.com', deleted: false })) },
      paymentMethods: { list: vi.fn(async () => ({ data: [] })) },
    }
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
    await webhook({
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=signature' },
      async *[Symbol.asyncIterator]() { yield Buffer.from('{}') },
    }, res)
    return res
  }

  it('l’événement dit « essai en cours », l’abonnement relu est résilié à sa fin : aucun email', async () => {
    const res = await livrer({ evenement: essai(), relu: essai({ cancel_at_period_end: true }) })
    expect(res.statusCode).toBe(200)
    expect(w.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_essai', {}, OPTIONS_REQUETE_COURTE)
    expect(w.envoyer).not.toHaveBeenCalled()
  })

  it('c’est l’abonnement relu qui décide, dans les deux sens : relu sans résiliation, l’email part', async () => {
    const res = await livrer({ evenement: essai({ cancel_at_period_end: true }), relu: essai() })
    expect(res.statusCode).toBe(200)
    expect(w.envoyer).toHaveBeenCalledTimes(1)
    expect(w.envoyer.mock.calls[0][0].to).toEqual(['marchand@ex.com'])
  })

  it('relecture impossible : on retombe sur l’objet de l’événement, avec une trace', async () => {
    let res = await livrer({ evenement: essai({ cancel_at_period_end: true }), relu: new Error('Stripe indisponible') })
    expect(res.statusCode).toBe(200)
    expect(w.envoyer).not.toHaveBeenCalled()
    expect(avertissements).toHaveBeenCalled()

    avertissements.mockClear()
    res = await livrer({ evenement: essai(), relu: new Error('Stripe indisponible') })
    expect(res.statusCode).toBe(200)
    expect(w.envoyer).toHaveBeenCalledTimes(1)
    expect(avertissements).toHaveBeenCalled()
  })
})

describe('le webhook s’en sert comme prévu', () => {
  const webhook = sansCommentaires(readFileSync('api/stripe-webhook.js', 'utf8'))

  // Bornée au `case` suivant : sans ça, les gardes ci-dessous retrouvent
  // l'appel `resolveCustomerCard(` de `trial_will_end`, plus bas dans le
  // fichier, et restent vertes même si ce bloc-ci régresse.
  function blocSubscriptionUpdated() {
    const debut = webhook.indexOf("case 'customer.subscription.updated'")
    expect(debut).toBeGreaterThan(-1)
    return webhook.slice(debut, webhook.indexOf("case '", debut + 1))
  }

  // Bornée au bloc suivant (l'achat de template marketplace) : sans ça, une
  // régression dans la branche upgrade pourrait passer inaperçue si un autre
  // appel plus loin dans le fichier satisfait déjà les gardes ci-dessous.
  function blocUpgrade() {
    const debut = webhook.indexOf('if (session.metadata?.actero_client_id && session.metadata?.upgrade_to)')
    expect(debut).toBeGreaterThan(-1)
    const fin = webhook.indexOf('if (session.metadata?.template_id && session.metadata?.buyer_client_id)', debut)
    expect(fin).toBeGreaterThan(debut)
    return webhook.slice(debut, fin)
  }

  it('plus aucune table de prix construite depuis STRIPE_PRICE_*', () => {
    expect(webhook).not.toMatch(/STRIPE_PRICE_/)
  })

  it('aucune relecture Stripe n’est laissée sans délai borné', () => {
    // Sans OPTIONS_REQUETE_COURTE, le SDK Stripe attend jusqu'à 80 s par
    // tentative et réessaie deux fois : Vercel coupe la fonction à 60 s avant
    // l'écriture, la réservation de l'événement reste posée, et le réessai de
    // Stripe reçoit "duplicate" — le client paie sans recevoir son plan.
    const appels = webhook.match(/stripe\.subscriptions\.retrieve\([^)]*\)/g) || []
    expect(appels.length).toBeGreaterThan(0)
    for (const appel of appels) {
      expect(appel).toContain('OPTIONS_REQUETE_COURTE')
    }
  })

  it('la branche upgrade relit l’abonnement avant d’écrire, et se sert de STATUTS_TERMINES', () => {
    // Depuis e82d0e5, une erreur d'écriture vaut 500 et Stripe peut rejouer
    // l'événement jusqu'à 3 jours plus tard. Si l'abonnement a été résilié
    // entre-temps, il ne faut plus accorder le plan — voir subscription-plan.js
    // et le commentaire de ce bloc dans stripe-webhook.js. Le contenu exact
    // des trois statuts n'est vérifié qu'une fois, sur la constante elle-même
    // — voir describe('STATUTS_TERMINES') plus haut : plus de liste littérale
    // à dupliquer ici.
    const bloc = blocUpgrade()
    const idxRetrieve = bloc.indexOf('stripe.subscriptions.retrieve(session.subscription')
    const idxUpdate = bloc.indexOf('.update(updateData)')
    expect(idxRetrieve).toBeGreaterThan(-1)
    expect(idxUpdate).toBeGreaterThan(-1)
    expect(idxRetrieve).toBeLessThan(idxUpdate)
    expect(bloc).toMatch(/STATUTS_TERMINES/)
  })

  it('la branche upgrade sort AVANT d’écrire si l’abonnement relu est terminé', () => {
    // Une garde qui se contente de chercher les trois statuts dans le bloc
    // reste verte même si on supprime le `return` : rien ne vérifiait qu'il
    // mène à une sortie. On exige ici la forme précise de la garde — une
    // sortie `return res.status(200)` entre le test des statuts terminés et
    // l'écriture — pour qu'une régression fasse échouer CE test, pas
    // seulement une relecture humaine.
    const bloc = blocUpgrade()
    expect(bloc).toMatch(
      /STATUTS_TERMINES\.includes\(subscription\.status\)\)\s*\{[\s\S]*?return res\.status\(200\)[\s\S]*?\.update\(updateData\)/
    )
  })

  it('la carte est résolue en mode strict, et c’est son résultat qui décide du plan', () => {
    // Seul `subscription.default_payment_method` comptait autrefois : une
    // carte rangée sur le client Stripe n'accordait jamais le plan. Et sans
    // le mode strict, une panne Stripe valait « aucune carte » au lieu de
    // lever — voir stripe-customer.js. Le \1 vérifie que c'est bien la MÊME
    // variable qui nourrit `aUneCarte`, pas seulement une variable quelconque.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/(\w+) = await resolveCustomerCard\([^)]*\{\s*strict:\s*true\s*\}\)[\s\S]*planUpdateFromSubscription\(subscription,\s*\{\s*aUneCarte:\s*!!\1\s*\}/)
  })

  it('un abonnement payé hors catalogue laisse une trace', () => {
    // Offre sur mesure ou clé mal posée : aucun plan n'est accordé, et sans
    // trace, personne ne le verrait.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/hors catalogue/)
  })

  it('l’écriture passe par ecritureAutorisee', () => {
    // Sans ce garde-fou, un ancien abonnement impayé peut rétrograder un
    // client qui paie un abonnement plus récent — voir subscription-plan.js.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/ecritureAutorisee\(/)
  })

  it('une erreur libère la réservation de l’événement et répond 500', () => {
    // Sinon Stripe ne réessaie jamais : l'événement est marqué traité alors
    // que rien n'a été écrit.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/webhook_events_processed/)
    expect(bloc).toMatch(/status\(500\)/)
  })

  it('l’email de fin d’essai ne part pas pour un essai qui ne démarrera pas', () => {
    // La garde doit SORTIR avant l'envoi : chercher le nom de la fonction dans
    // le bloc resterait vert avec un `if` qui ne fait que journaliser.
    const debut = webhook.indexOf("case 'customer.subscription.trial_will_end'")
    expect(debut).toBeGreaterThan(-1)
    const bloc = webhook.slice(debut, webhook.indexOf("case '", debut + 1))
    const garde = bloc.search(/if\s*\(\s*!annoncerLaFinDEssai\(subscription\)\s*\)\s*\{/)
    const envoi = bloc.indexOf('resend.emails.send(')
    expect(garde).toBeGreaterThan(-1)
    expect(envoi).toBeGreaterThan(garde)
    // Entre la garde et l'envoi : une trace, puis la sortie du `case`.
    const entre = bloc.slice(garde, envoi)
    expect(entre).toMatch(/console\.\w+\([\s\S]*break;/)
  })

  it('décide sur l’abonnement relu, pas sur l’objet figé de l’événement', () => {
    // Stripe peut rejouer un événement des heures plus tard, ou le livrer
    // dans le désordre : décider sur `event.data.object` risquerait
    // d'appliquer un état périmé (voir la Task 3 bis). On relit l'abonnement
    // avec un délai borné, et c'est SON résultat qui nourrit planUpdateFromSubscription.
    const bloc = blocSubscriptionUpdated()
    expect(bloc).toMatch(/const subscription = await stripe\.subscriptions\.retrieve\([\s\S]*OPTIONS_REQUETE_COURTE[\s\S]*planUpdateFromSubscription\(subscription/)
  })
})
