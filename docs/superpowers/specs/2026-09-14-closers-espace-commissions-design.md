# Closers : inscription, lien d'abonnement, espace dédié et commissions — Design

**Date :** 14 septembre 2026
**Statut :** design validé par Pablo le 14 septembre — spec à relire
**Dépend de :** `2026-09-14-formules-trimestrielle-annuelle-checkout-design.md` (chantier A) —
la commission dépend de la formule payée, que seul le catalogue de A sait lire.
**Suite :** chantier C, remise à neuf de l'admin (spec séparée) ; la section
« Closers » décrite ici en est le premier écran.

## Pourquoi

Actero recrute des closers freelances (pas de setters). Chacun s'inscrit seul, reçoit
un lien d'abonnement personnel, retrouve dans son espace les clients qu'il a signés et
ses commissions. Actero valide chaque commission avant de la payer.

## Décisions validées

1. **Inscription libre, sur une page non listée** : e-mail et mot de passe, ou Google.
   Pablo transmet le lien aux closers ; la page n'apparaît ni dans la navigation, ni
   dans le sitemap, et porte `noindex`.
2. **Un lien d'abonnement par closer.** Le client qui s'abonne par ce lien est
   rattaché à ce closer.
3. **Espace closer dès le lancement** : ses clients, ses commissions, son lien.
4. **Les closers démarchent aussi les boutiques Shopify** (décision finale du 14
   septembre). Une boutique Shopify s'abonne **par Shopify**, au mois ou à l'année :
   la règle 1.2.1 de l'App Store interdit à l'app de facturer ailleurs. Les
   commissions des clients facturés par Stripe (WooCommerce, Webflow, autres) sont
   calculées automatiquement ; celles des clients Shopify sont **saisies à la main**
   dans l'admin, montant pré-rempli. La saisie manuelle sert aussi pour Enterprise et
   les corrections.
5. **Actero valide chaque commission** dans l'admin, et **la paie dès la
   validation**, par virement. Conséquence assumée : une commission payée puis
   remboursée par le client n'est pas reprise automatiquement.
6. **Le programme ambassadeurs disparaît** : ses routes sont supprimées ; ses tables,
   vides, restent en base jusqu'à un nettoyage ultérieur.

### Choix par défaut, à confirmer à la relecture

- **Un closer inscrit est actif tout de suite** : son lien fonctionne dès
  l'inscription. Actero peut le suspendre. Le risque d'un inconnu tombé sur la page
  est borné par la validation manuelle de chaque commission.
- **Cookie d'attribution valable 60 jours.**

## Grille de commission (note de Pablo)

| | Mensuel | Trimestriel | Annuel |
|---|---|---|---|
| Starter | 25 € par mois payé | 100 € une fois | 250 € une fois |
| Pro | 100 € par mois payé | 250 € une fois | 600 € une fois |

- **Mensuel** : une commission par mensualité réellement encaissée, tant que le client
  reste. L'essai et le mois offert ne rapportent rien : rien n'est encaissé.
- **Trimestriel, annuel** : une seule fois par client. Un client qui résilie puis se
  réabonne ne génère pas de seconde commission unique.
- **Changement de plan** : la grille suit ce qui est payé. Un client Starter passé
  Pro rapporte 100 € par mois ensuite.
- **Enterprise** : hors grille, commission saisie à la main.
- Une facture remboursée n'ouvre droit à rien ; voir « Remboursement ».

## Parcours

### Le closer

1. Ouvre `actero.fr/closer/inscription` (lien transmis par Pablo).
2. S'inscrit :
   - **e-mail** : prénom, nom, e-mail, mot de passe → code à 6 chiffres reçu par
     e-mail → compte créé ;
   - **Google** : retour sur `/closer/callback`, qui crée la fiche closer.
3. Arrive sur `/closer` : son lien, ses chiffres, ses clients, ses commissions.
4. Complète son profil de paiement (téléphone, SIRET, titulaire et IBAN) — demandé
   dès l'accueil tant qu'il manque, requis avant le premier paiement.
5. Se reconnecte plus tard par `actero.fr/closer/connexion` (e-mail et mot de passe,
   ou Google).

**Adresse déjà utilisée** (un marchand, par exemple) : l'inscription par e-mail le dit
et renvoie vers la connexion. Après connexion, un compte sans fiche closer voit
« Devenir closer », qui crée la fiche. **Aucun de ces chemins n'écrit le rôle d'un
compte** (`app_metadata`, `profiles`) : c'est exactement ce qui rendait
`api/ambassador/apply.js` dangereux.

### Le prospect

1. Clique le lien du closer : `actero.fr/c/ACT-XXXXX`. Le closer peut y ajouter le
   plan et la formule convenus (`?plan=pro&formule=annuel`), grâce au générateur de
   son espace.
2. Le lien pose le cookie d'attribution, puis mène à l'inscription marchand, plan et
   formule présélectionnés.
3. Dès que son compte existe, le site présente le code au serveur, qui rattache le
   client au closer — même mécanique que le code campagne (`src/lib/campagne.js`) :
   mémorisé au chargement, présenté après la création du compte, oublié une fois
   accepté.

## Règles d'attribution

- **Le premier closer gagne.** Un client déjà rattaché ne change pas de closer par un
  lien.
- **Refusée si le client paie déjà** — plan payant actif au moment du rattachement :
  sinon un closer pourrait s'attribuer un client existant.
- **Refusée si le closer est membre de ce client** (`client_users`) : pas
  d'auto-attribution.
- **Refusée si le closer est suspendu.**
- **Correction manuelle** dans l'admin : rattacher, changer ou retirer le closer d'un
  client (source « manuel »), sans les règles ci-dessus — c'est une décision d'Actero.
  C'est le recours pour un prospect inscrit depuis un autre appareil, ou un marchand
  Shopify installé directement depuis l'App Store. Les commissions déjà créées ne
  bougent pas ; les suivantes vont au nouveau closer.

## Commissions

### Création

- **Stripe (automatique)** — événement `invoice.paid`, montant payé > 0, facture
  d'abonnement, client rattaché à un closer. La formule et le plan viennent du prix,
  via le catalogue de A. Clé d'unicité `source_key` : `stripe:<id facture>` pour une
  mensualité, `unique:<id client>` pour une commission unique. Stripe peut renvoyer un
  événement : la clé garantit une seule commission. Un closer suspendu reçoit quand
  même la commission, en `a_valider` : la décision revient à Actero. Un prix hors
  catalogue (tarif Enterprise sur mesure) ne crée rien.
- **Manuel (Shopify, Enterprise, corrections)** — dans l'admin, « Saisir une
  commission » pour un client rattaché. Montant pré-rempli d'après la grille (plan et
  formule du client) quand elle s'applique, modifiable, avec une note obligatoire.
  Pour un client Shopify, la mensualité se saisit chaque mois tant que son abonnement
  Shopify est actif. Clé :
  `manuel:<id client>:<AAAA-MM>` pour une mensualité, `unique:<id client>` pour une
  commission unique : deux saisies du même mois sont impossibles. Une mensualité
  manuelle est refusée pour un client facturé par Stripe sur une formule du catalogue,
  dont les commissions sont automatiques.

**À vérifier pendant l'implémentation, sur un vrai événement de test** : selon la
version d'API Stripe du webhook, l'abonnement d'une facture se lit dans
`invoice.subscription` ou dans `invoice.parent.subscription_details.subscription`, et
une charge ne porte plus toujours sa facture. Le code lit la forme réellement reçue ;
un test fige la charge utile observée.

### Statuts

| Statut | Signification | Qui le pose |
|---|---|---|
| `a_valider` | créée, en attente d'Actero | webhook ou saisie manuelle |
| `validee` | acceptée, à payer | admin |
| `payee` | virement fait | admin |
| `refusee` | écartée, avec une note | admin |
| `annulee` | facture remboursée avant paiement | webhook |

L'admin voit, pour chaque commission à valider : le client, le plan et la formule, le
montant encaissé et la date, et **« remboursable jusqu'au »** (paiement + 30 jours),
à titre d'information. Valider reste une décision humaine.

### Remboursement

Événement `charge.refunded` : la commission liée à cette facture passe `annulee` si
elle est `a_valider` ou `validee`. Si elle est déjà `payee`, elle garde son statut et
reçoit une note « facture remboursée après paiement », visible dans l'admin : aucune
reprise automatique.

## Données (migration additive)

- **`closers`** : `id`, `user_id` (unique, compte Supabase), `prenom`, `nom`, `email`,
  `telephone`, `siret`, `titulaire_iban`, `iban_chiffre` (chiffré par
  `encryptToken` de `api/lib/crypto.js`, jamais stocké en clair), `code` (unique,
  format `ACT-XXXXX`, généré par `crypto.randomBytes`), `statut` (`actif` |
  `suspendu`), dates.
- **`clients`** : `closer_id` (référence `closers`, `on delete set null`),
  `closer_attribue_at`, `closer_source` (`lien` | `manuel`).
- **`closer_commissions`** : `id`, `closer_id`, `client_id`, `montant_centimes`
  (> 0), `plan`, `formule`, `type` (`mensuelle` | `unique`), `source` (`stripe` |
  `manuel`), `source_key` (unique), `stripe_invoice_id`, `payee_par_client_le`,
  `statut`, `validee_at`, `validee_par`, `payee_at`, `note`, dates.
- **RLS activée, aucune politique pour les rôles `anon` et `authenticated`** : ni un
  closer ni un marchand ne lit ces tables depuis le navigateur. Tout passe par des
  routes serveur qui vérifient l'identité. Une politique mal écrite ne peut donc pas
  exposer les commissions ou les IBAN des autres.
- `email_verification_codes` (existante) accueille aussi les inscriptions closer :
  `payload.kind = 'closer'`. **La vérification marchand refuse un code closer, et
  inversement** — sans quoi un code d'inscription closer créerait un compte marchand.

## Routes serveur

**Espace closer** — chacune vérifie le jeton, puis retrouve la fiche par `user_id` :

| Route | Rôle |
|---|---|
| `POST /api/closer/envoyer-code` | public, limité en débit : envoie le code d'inscription |
| `POST /api/closer/verifier-code` | public, limité en débit : crée le compte et la fiche |
| `POST /api/closer/devenir-closer` | crée la fiche pour le compte connecté, s'il n'en a pas |
| `GET /api/closer/moi` | profil, lien, totaux (à valider, validées, payées) |
| `GET /api/closer/clients` | ses clients : boutique, plan, formule, date de rattachement, actif ou résilié — ni coordonnées ni chiffre d'affaires |
| `GET /api/closer/commissions` | ses commissions, avec le motif en cas de refus |
| `PATCH /api/closer/profil` | téléphone, SIRET, titulaire, IBAN (chiffré à l'écriture, jamais renvoyé en clair : seuls les 4 derniers caractères) |

**Côté marchand** : `POST /api/closer/attribuer` — le marchand connecté présente le
code mémorisé ; les règles d'attribution s'appliquent côté serveur.

**Admin** — `requireAdmin` :

| Route | Rôle |
|---|---|
| `GET /api/admin/closers` | closers, clients rattachés, totaux par statut |
| `PATCH /api/admin/closers` | suspendre, réactiver |
| `GET /api/admin/closer-commissions` | commissions filtrées par statut, avec leur contexte |
| `POST /api/admin/closer-commissions` | saisie manuelle (Shopify, Enterprise) |
| `PATCH /api/admin/closer-commissions` | valider, refuser (note), marquer payée |
| `GET /api/admin/closer-iban` | IBAN en clair d'un closer, au moment de payer — chaque lecture est journalisée |
| `PATCH /api/admin/closer-attribution` | rattacher, changer ou retirer le closer d'un client |

**Webhook Stripe** : `invoice.paid` et `charge.refunded` rejoignent
`api/stripe-webhook.js`. Calcul pur dans `api/lib/commissions-closer.js`
(`commissionPourFacture`) ; le webhook ne fait que lire, appeler et insérer.

**Supprimées** : tout `api/ambassador/`, `src/lib/ambassador-helpers.js`, l'entrée
« Ambassadors » de `CommandPalette.jsx`, et la page `/ambassadeurs` restée dans
`public/sitemap.xml` et `scripts/prerender-routes.mjs` : Google indexe encore un
« Programme Ambassadeurs — 20 % de commission récurrente » que plus aucune route ne
sert. `api/ambassador/apply.test.js` devient une
garde plus large : aucune route hors admin n'écrit `app_metadata.role` ni
`profiles.role`.

## Pages

| Chemin | Contenu |
|---|---|
| `/closer/inscription` | inscription e-mail ou Google, `noindex` |
| `/closer/connexion` | connexion e-mail ou Google, mot de passe oublié, `noindex` |
| `/closer/callback` | retour Google : crée la fiche si besoin, mène à `/closer` ; **ne crée jamais de client marchand** |
| `/closer` | l'espace : accueil, clients, commissions, profil et paiement |
| `/c/:code` | lien d'abonnement : pose le cookie, mène à l'inscription marchand |

- **Accueil** : le lien à copier, le générateur (plan × formule), trois chiffres (à
  valider, validées, payées), l'invitation à compléter le profil de paiement.
- **Clients** et **Commissions** : tableaux simples, du plus récent au plus ancien.
- **Profil et paiement** : identité, téléphone, SIRET, titulaire, IBAN masqué.
- **Style** : le système visuel actuel d'Actero (Inter Tight, DM Mono pour les
  montants, fond blanc, bouton vert), pas l'ancien.
- **Séparation des espaces** : un compte closer sans client qui ouvre `/client` est
  renvoyé vers `/closer`, **sans création de client marchand**. Aujourd'hui, ouvrir
  `/client` connecté suffit à en créer un (`resolveOrCreateClientId`).
- **Hors sitemap, hors navigation**, `noindex` sur toutes les pages `/closer`.

## Section « Closers » de l'admin

Premier écran du chantier C, construit dans le nouveau style :

- **Closers** : nom, e-mail, code, statut, nombre de clients, totaux par statut ;
  suspendre ou réactiver.
- **À valider** : la file des commissions `a_valider`, avec leur contexte ; valider ou
  refuser (note).
- **À payer** : les commissions `validee`, regroupées par closer, IBAN révélé à la
  demande ; marquer payée.
- **Saisie manuelle** : client rattaché (Shopify, Enterprise ou correction), montant
  pré-rempli, mois concerné, note. Les clients Shopify rattachés dont la mensualité du
  mois n'a pas encore été saisie sont listés en tête.
- **Payer** : valider puis faire le virement dans la foulée ; « marquer payée » une
  fois le virement parti.
- **Attributions** : chercher un client, rattacher, changer ou retirer son closer.

## Tests — chacun échoue si le défaut revient

1. `api/lib/commissions-closer.test.js` : la grille complète ; facture à 0 € → rien ;
   commission unique déjà versée → rien ; formule inconnue → rien plutôt qu'un montant
   deviné.
2. Attribution : premier closer gagne ; client payant refusé ; auto-attribution
   refusée ; closer suspendu refusé ; code inconnu refusé.
3. Webhook : le même `invoice.paid` reçu deux fois → une seule commission ;
   `charge.refunded` → `annulee` avant paiement, note après.
4. Étanchéité : un closer ne lit ni les clients ni les commissions d'un autre, sur
   chaque route `/api/closer/*` ; un marchand ne peut rien y lire.
5. Codes d'inscription : un code closer ne crée pas de client marchand ; un code
   marchand ne crée pas de fiche closer.
6. Garde de rôle : aucune route hors admin n'écrit `app_metadata.role` ni
   `profiles.role`.
7. `/closer/callback` et l'inscription closer n'appellent jamais
   `resolveOrCreateClientId` ; `/client` renvoie un closer vers `/closer`.
8. Pages : `noindex` sur `/closer/*`, absentes de `public/sitemap.xml` et de la
   navigation.
9. IBAN : jamais écrit en clair, jamais renvoyé en clair par les routes closer.

## Ta part (Pablo)

1. Supabase → Authentication → URL Configuration : autoriser
   `https://actero.fr/closer/callback` si la liste des redirections n'accepte pas déjà
   tout le domaine.
2. Stripe → Webhooks : ajouter les événements `invoice.paid` et `charge.refunded` à
   l'endpoint existant.
3. Donner aux closers le lien `https://actero.fr/closer/inscription`.
4. Chaque mois : saisir les commissions des clients Shopify rattachés.
5. Au fil de l'eau : valider les commissions, faire le virement, marquer payée.

## Hors périmètre

- Setters.
- Calcul automatique des commissions Shopify (saisie manuelle en attendant).
- E-mails au closer (commission validée, payée).
- Contrat et conditions du programme closer.
- Factures des closers (auto-entrepreneurs) : hors produit.
- Suppression des tables ambassadeurs vides.
