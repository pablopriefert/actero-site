# Fil d'activité de l'espace closer — design

Demande de Pablo, 17 septembre 2026 : le closer voit, dans son espace, ce que
fait le client venu par son lien — paiement et autres actions. Design validé le
même jour (« Oui, fonce »).

## Choix de Pablo

- Les quatre familles d'actions : lien, inscription et mise en route, paiement,
  abonnement.
- Un fil d'activité dans l'espace closer, **sans e-mail**.
- Une phrase dans la politique de confidentialité pour informer les marchands.

## Principe

Un journal d'événements dédié, écrit au moment où chaque action se produit,
côté serveur ou par déclencheur en base. Rien n'est reconstitué à l'affichage.

Le closer voit le type d'action, la boutique, le plan et la formule, et la date.
Il ne voit **jamais** : un montant, une adresse e-mail, un message, un volume de
conversations, ni le chiffre d'affaires de la boutique.

## Données — `public.closer_evenements`

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid | clé |
| `closer_id` | uuid | `closers(id)`, `on delete cascade` |
| `client_id` | uuid, nullable | `clients(id)`, `on delete cascade` ; vide pour un clic pas encore relié |
| `visite_id` | uuid, nullable | identifiant aléatoire du visiteur du lien (cookie), pour relier ses clics à l'inscription |
| `type` | text | liste fermée ci-dessous |
| `details` | jsonb objet | clés permises : `plan`, `formule`, `plateforme`, `partiel` — rien d'autre (contrainte SQL) |
| `source_key` | text unique | empêche les doublons |
| `survenu_le` | timestamptz | moment de l'action |
| `created_at` | timestamptz | écriture |

RLS activée sans politique, droits d'`anon` et d'`authenticated` retirés, comme
les autres tables closer. Seules les routes serveur la lisent.

## Événements

| Famille | `type` | Libellé closer | `details` | Source | `source_key` |
|---|---|---|---|---|---|
| lien | `lien_ouvert` | A ouvert votre lien | — | `POST /api/closer/clic` | `clic:<code>:<visite>:<AAAA-MM-JJ>` |
| inscription | `inscription` | S'est inscrit | — | `api/closer/attribuer.js` (rattachement réussi) | `inscription:<client>` |
| paiement | `paiement_ouvert` | A choisi {plan} {formule} et ouvert le paiement | plan, formule, plateforme | `api/billing/upgrade.js` (session Checkout créée), `api/billing/shopify-billing.js` | `paiement_ouvert:<session>` / `paiement_ouvert:shopify:<client>:<minute>` |
| paiement | `paiement_abandonne` | Paiement non finalisé | plan, formule si connus | webhook `checkout.session.expired` | `stripe:<event>` |
| paiement | `abonnement_demarre` | S'est abonné ({plan} {formule}) | plan, formule, plateforme | `invoice.paid` (`subscription_create`, montant > 0) ; Shopify `ACTIVE` | `stripe:<event>` / `shopify:<abonnement>:actif` |
| paiement | `renouvellement_paye` | Renouvellement payé | plan, formule | `invoice.paid` (`subscription_cycle`) | `stripe:<event>` |
| paiement | `paiement_echoue` | Paiement échoué | — | `invoice.payment_failed` ; Shopify `FROZEN` | `stripe:<event>` / `shopify:<abonnement>:gele` |
| abonnement | `formule_changee` | Est passé à {plan} {formule} | plan, formule | `customer.subscription.updated` (prix changé) | `stripe:<event>` |
| abonnement | `resiliation_programmee` | A programmé sa résiliation | — | `customer.subscription.updated` (`cancel_at_period_end` passe à vrai) | `stripe:<event>` |
| abonnement | `resiliation_annulee` | A annulé sa résiliation | — | idem (passe à faux) | `stripe:<event>` |
| abonnement | `abonnement_termine` | Abonnement terminé | plateforme | `customer.subscription.deleted` ; Shopify `CANCELLED`, `DECLINED`, `EXPIRED` | `stripe:<event>` / `shopify:<abonnement>:<statut>` |
| abonnement | `rembourse` | Remboursé (en partie / en totalité) | partiel | `charge.refunded` | `stripe:<event>` |
| abonnement | `app_desinstallee` | A désinstallé l'application Shopify | — | webhook `app/uninstalled` | `shopify:<boutique>:desinstallee:<jour>` |
| mise_en_route | `boutique_connectee` | A connecté sa boutique {plateforme} | plateforme | déclencheurs sur `client_shopify_connections` et `client_integrations` (woocommerce, webflow, statut `active`) | `boutique:<client>:<plateforme>` |
| mise_en_route | `agent_premiere_reponse` | L'agent a envoyé sa première réponse | — | déclencheur sur `engine_responses` (non escaladée) | `premiere_reponse:<client>` |
| mise_en_route | `agent_en_pause` | A mis l'agent en pause | — | déclencheur sur `client_settings.agent_enabled` | `pause:<client>:<horodatage>` |
| mise_en_route | `agent_reactive` | A réactivé l'agent | — | idem | `reactivation:<client>:<horodatage>` |

Un événement n'est écrit que si le client a un closer (`clients.closer_id`),
sauf `lien_ouvert`, rattaché au closer du code.

## Écriture

- `api/lib/evenements-closer.js` : `enregistrerEvenementCloser(supabase, { clientId, closerId, type, details, sourceKey, survenuLe })`.
  - Elle retrouve le closer du client si `closerId` n'est pas fourni.
  - Elle ne crée rien sans closer, filtre `details` sur les clés permises et ignore un doublon (`source_key`).
  - Elle ne lève **jamais** : une panne est journalisée (identifiants seulement), et le paiement ou le webhook continue.
- Déclencheurs en base : une fonction `security definer` commune, dont l'exécution est retirée à `public`, `anon` et `authenticated` ; son bloc `exception` garantit qu'une panne du fil ne fait jamais échouer l'action du marchand.
- **Clics** : `POST /api/closer/clic` `{ code, visite }`, anonyme.
  - Garde-fous : limite de débit par IP, robots ignorés (user-agent), code inconnu ou closer suspendu ignorés, avec la même réponse `204`.
  - Au plus un clic par visiteur et par jour. Aucune IP stockée.
  - `LienCloserPage` pose un `visite_id` aléatoire dans le cookie du lien (60 jours) et appelle la route sans attendre sa réponse.
- **Reliage** : au rattachement réussi, `attribuer.js` relie les clics du même `visite_id` (et du même closer) au client, puis écrit `inscription`.

## Lecture — `GET /api/closer/activite`

- Authentification : la fiche closer du jeton, comme les autres routes `api/closer/*`.
- Paramètres :
  - `client` (optionnel) : le parcours d'un client, qui doit appartenir au closer ; sinon 404 ;
  - `famille` (optionnel) : `lien`, `inscription`, `paiement`, `abonnement` ou `mise_en_route` ;
  - `avant` (curseur ISO, optionnel) et `limite` (défaut 50, max 100).
- Réponse 200 :
  ```json
  {
    "evenements": [
      { "id": "…", "type": "paiement_ouvert", "famille": "paiement",
        "survenu_le": "ISO", "client_id": "… ou null", "boutique": "Nom ou null",
        "details": { "plan": "pro", "formule": "annuel", "plateforme": "stripe" } }
    ],
    "suivant": "ISO ou null",
    "resume": { "visites_7j": 12, "inscriptions_30j": 3, "paiements_en_attente": 1 }
  }
  ```
- `paiements_en_attente` : les clients dont le dernier événement de paiement est `paiement_ouvert` ou `paiement_abandonne`, sans `abonnement_demarre` après.
- `resume` n'est calculé que sans le paramètre `client`.
- Erreurs : 401 `non_authentifie`, 404 `pas_de_fiche` ou `client_introuvable`, 400 `parametre_invalide`, 503 `indisponible`.

## Interface

- **Nouvel onglet « Activité »** dans `/closer` :
  - trois compteurs (visites du lien sur 7 jours, inscriptions sur 30 jours, paiements en attente) ;
  - un fil groupé par jour, avec des filtres (Tout, Paiements, Abonnement, Mise en route, Lien) et un bouton « Voir plus » (curseur) ;
  - mise à jour toutes les 60 s tant que la page est visible.
- **« Mes clients »** : chaque ligne se déplie sur le parcours du client (`?client=`). Un badge montre la dernière étape ; il est orange pour `paiement_abandonne`, `paiement_echoue`, `resiliation_programmee`, `agent_en_pause` et `app_desinstallee`.
- Libellés et couleurs dans `src/lib/affichage-closer.js`, avec des dates relatives en français (« il y a 2 h »).

## Confidentialité

`PrivacyPage.jsx` reçoit la phrase suivante, validée par Pablo dans son principe :

> « Si vous créez votre compte à partir du lien d'un closer partenaire d'Actero,
> ce closer voit l'avancement de votre inscription et de votre abonnement (étapes
> et dates). Il ne voit jamais les données de votre boutique, vos conversations,
> ni vos montants. »

## Tests

- **Écriture** : filtre des `details`, absence de closer, doublon et panne qui ne lève pas.
- **Correspondance** : chaque événement Stripe ou Shopify donne le bon événement de fil.
- **Webhook** : une panne du fil ne change pas la réponse.
- **Migration**, lue dans son texte :
  - RLS, droits retirés, contrainte sur `details`, liste des types identique à la bibliothèque ;
  - fonctions `security definer` avec `search_path` vide, exécution retirée, bloc `exception`.
- **Route de clic** : limite de débit, robots, code inconnu, un clic par jour.
- **Route de lecture** : cloisonnement entre deux closers, client d'un autre closer en 404, pagination, résumé, aucun montant ni e-mail dans la réponse.
- **Interface** : libellés de chaque type, badge de la dernière étape, onglet présent. Chartes `couleurs` et `typographie` vertes.

## Hors périmètre

Les e-mails au closer, l'historique antérieur au 17 septembre (le fil démarre à la
mise en production) et le volume d'usage de l'agent.
