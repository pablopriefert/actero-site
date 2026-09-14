# Admin resserrée — Design

**Date :** 14 septembre 2026
**Statut :** design validé par Pablo le 14 septembre — spec à relire
**Liens :** la rubrique « Closers » vient de la spec B
(`2026-09-14-closers-espace-commissions-design.md`) ; le calcul du revenu Stripe et
la configuration Stripe viennent de la spec A
(`2026-09-14-formules-trimestrielle-annuelle-checkout-design.md`).

## Pourquoi

Inventaire du 14 septembre (45 fichiers, 14 000 lignes dans
`src/components/admin/`, plus 1 242 dans `src/pages/AdminDashboard.jsx`), dont cinq
constats revérifiés à la main. Dernière vraie modification : mai 2026.

- **Des écrans vides sans erreur.** La fiche client demande à
  `client_metrics_latest` des colonnes qui n'existent pas (`health_score`,
  `churn_risk`, `tickets_handled_month`). Les notes négatives lisent `rated_at` et
  `rating_comment`, absents d'`ai_conversations`. Huit tables refusent la lecture à
  l'admin depuis le navigateur (`client_shopify_connections`, `partner_applications`,
  `referrals`…).
- **Aucun des trois boutons « ajouter un client » ne marche** : statut `onboarding`
  refusé par la contrainte, colonne `monthly_price` inexistante, ou « Enterprise »
  créé en Free par `api/auth/signup.js`.
- **Cinq MRR différents.** L'onglet Revenus lit `v_admin_mrr_snapshot`, c'est-à-dire
  `funnel_clients.monthly_price`. Aucun ne compte les marchands facturés par
  Shopify.
- **Des écrans pour des outils disparus** (n8n, immobilier), des alertes Slack que
  rien n'évalue, un flux « en direct » absent de la publication temps réel.
- **Des doublons** : coûts IA ×2, santé client ×3 formules, satisfaction ×3.
- **Trois définitions d'« admin »** : `isActeroAdmin` côté serveur, `get_my_role()`
  dans la plupart des politiques RLS, `fetchUserRole` côté front.

## Décisions validées

1. **Une admin resserrée en six rubriques**, refaites dans le style actuel. Le reste
   est supprimé.
2. **Programmes encore actifs** : parrainage client et offres sur mesure.
3. **Programmes arrêtés** : partenaires agences et Actero for Startups. Ils
   disparaissent de l'admin **et du site public**.

## Les six rubriques

### 1. Aujourd'hui — page d'accueil de l'admin

Uniquement ce qui attend une action, chaque ligne menant à l'écran qui la traite :

- commissions closers à valider ;
- réponses de l'agent à relire (`engine_reviews_v2` en attente) ;
- erreurs du moteur sur 24 h ;
- marchands en difficulté : bulle invisible (`widget_health`), intégration en échec
  (`client_integrations`), quota presque atteint (la logique du panneau existant, qui
  est juste, servie désormais par une route serveur) ;
- abonnements et résiliations des 7 derniers jours.

### 2. Clients

- **Tous les clients** : statut (les valeurs réelles de la contrainte), plan, formule,
  canal de facturation (Stripe, Shopify, sur mesure), closer, revenu mensuel. Filtres
  et export CSV sur ces colonnes-là.
- **Fiche client** : réparée sur des colonnes qui existent ; exécutions, escalades,
  intégrations, backtest, contrôle de la bulle, notes, actions rapides (les deux
  composants existants, qui fonctionnent, sont conservés ; leurs lectures passent par
  des routes serveur). **Pas de score de santé
  composite** : trois formules se contredisaient ; la fiche montre les signaux
  eux-mêmes.
- **Créer un client** : un seul flux, par une route serveur admin, qui écrit un statut
  et un plan valides — Enterprise compris, avec son prix — et invite le contact à créer
  son compte.
- **Offres sur mesure** : créer une offre, envoyer le lien `/start/…`, suivre son
  paiement (reprend `AdminFunnelView`, sans la partie déploiement n8n).
- **Parrainages** : liste des parrainages et récompenses ; la validation manuelle
  appelle la même règle que `api/referral/validate.js` (aujourd'hui l'écran accorde
  800 € / 1 600 €, une règle abandonnée).

### 3. Revenus

- **Un seul revenu mensuel**, calculé par une seule fonction, `api/lib/revenus.js`,
  utilisée par toutes les rubriques :
  - Stripe : montant du prix ÷ mois de la période (fonction `mensualiteCentimes` de
    la spec A) ;
  - Shopify : prix du plan dans le catalogue (mensuel, ou annuel ÷ 12). Hypothèse :
    les prix du Partner Dashboard sont ceux du catalogue ;
  - sur mesure : `funnel_clients.monthly_price` ;
  - Free, résilié ou en essai : 0.
- Total, répartition par plan, formule et canal, évolution sur 12 mois, liste des
  abonnements (reprend l'appel Stripe de `AdminBillingView`).
- `v_admin_mrr_snapshot` n'est plus lue.

### 4. Closers

La section décrite dans la spec B : closers, commissions à valider, à payer, saisie
manuelle, attributions.

### 5. Qualité de l'agent

- **Relectures** : la file des réponses à valider, modifier ou rejeter.
- **Exécutions et erreurs** : une seule vue pour les exécutions, le top des erreurs et
  la répartition par agent (trois écrans aujourd'hui) ; rafraîchissement périodique,
  sans promettre du « temps réel ».
- **Hallucinations** : l'écran existant, lu côté serveur.
- **Coûts IA** : un seul écran (deux aujourd'hui), par fournisseur réel et non plus
  intitulé « Claude ».
- **Satisfaction** : lue dans `conversation_feedback`, là où la bulle écrit.

### 6. Système

- **Santé des intégrations**, avec le test forcé existant.
- **Rapports d'erreurs** des clients.
- **Journal des actions** : `admin_action_logs` et `admin_audit_log` réunis ;
  aujourd'hui les actions faites depuis le navigateur n'apparaissent nulle part.
- **Configuration Stripe** : l'écran mis à jour par la spec A.

## Principes

- **L'admin lit ses données par des routes serveur** (`api/admin/*`,
  `requireAdmin`), plus jamais par `supabase.from(...)` depuis le navigateur. Les huit
  listes vides venaient de là : une politique RLS qui refuse ne lève pas d'erreur, elle
  renvoie zéro ligne.
- **Une seule définition d'« admin »**, partagée par le serveur et le front :
  `admin_users`, `app_metadata.role` ou `profiles.role`. **Le compte de Pablo reçoit
  une ligne `admin_users`** : son accès ne dépend plus de deux champs qu'une route
  pouvait réécrire (ACT-42).
- **Le style actuel** : Inter Tight, DM Mono pour les chiffres, fond blanc, bouton
  vert, les jetons de couleur de `src/index.css`. Les composants partagés existants
  (`PageHeader`, `SectionCard`, `KpiCard`…) sont gardés ; `StatusPill` est corrigé
  (il ignore aujourd'hui les propriétés `label` et `tone` qu'on lui passe).
- **Une seule palette ⌘K** sur `/admin` (deux s'ouvrent aujourd'hui l'une sur l'autre),
  avec les six rubriques et une recherche de clients qui fonctionne (elle interroge
  aujourd'hui une colonne `plan_id` inexistante).

## Supprimé

**Écrans admin** : moniteur n8n ; kanban de déploiement, `CallNotesWizard`,
`DeploymentProgress` et `AdminClientSettingsModal` (ère n8n) ; demandes IA
(`requests`) ; leads ; notes négatives ; constructeur d'alertes ; flux « en direct » ;
testeur du moteur ; e-mail d'installation Shopify ; terminal IA ; cohortes de churn ;
classement ROI ; pipeline de conversion ; santé client ; jetons (doublon des coûts) ;
heatmap et top erreurs (fusionnés) ; playbooks ; vue « intelligence » cachée ;
création Enterprise ; partenaires ; jetons partenaires ; candidatures startups ; la vue
« Stats » et ses requêtes sans limite.

**Programmes arrêtés, côté site** :

- Partenaires : pages `/partner`, `/partners-program`, `/partners`,
  `/partners/apply`, `/partners/:slug` ; lien « Partenaires » du pied de page ; routes
  `api/partners/`, `api/partner/`, `api/admin/partner-tokens.js`,
  `api/admin/send-partner-invite.js` ; branche `partner_certification` du webhook
  Stripe ; entrées de pré-rendu.
- Startups : page `/startups` ; routes `api/startups/`,
  `api/admin/startup-applications.js` ; bandeau « code Startup » de la page de choix du
  plan ; entrée de pré-rendu. Le mécanisme générique des codes promo Stripe reste.
- Redirections permanentes de ces chemins vers l'accueil, pour les liens déjà partagés
  et les pages indexées.
- Les tables de ces programmes restent en base, pour un nettoyage ultérieur.

## Découpage

1. **Socle** : définition unique d'« admin », ligne `admin_users`, nouvelle
   navigation, Aujourd'hui, Clients, Revenus.
2. **Qualité de l'agent et Système.**
3. **Suppressions** : écrans admin, puis programmes arrêtés côté site.

La rubrique Closers arrive avec la spec B et se branche dans cette navigation.

## Tests — chacun échoue si le défaut revient

1. `api/lib/revenus.test.js` : Stripe mensuel, trimestriel, 13 mois ; Shopify mensuel
   et annuel ; sur mesure ; Free, résilié et essai à 0.
2. Garde : aucun fichier de `src/components/admin/` n'appelle `supabase.from(`.
3. Garde : chaque route de `api/admin/` vérifie l'admin avant toute lecture.
4. Garde : chaque statut écrit ou filtré par l'admin appartient à la contrainte de
   `clients.status` (même liste que `api/lib/statut-client.test.js`).
5. Création de client : statut et plan valides, Enterprise conservé.
6. Admin : le front et le serveur donnent le même verdict pour un même compte.
7. Plus aucune référence aux écrans et routes supprimés ; les chemins retirés
   redirigent vers l'accueil.

## Ta part (Pablo)

- Relire chaque rubrique en production à la fin de chaque étape du découpage.
- Dire si un écran supprimé te manque — en particulier le terminal IA.

## Hors périmètre

- Retirer les critères `app_metadata.role` et `profiles.role` de la définition
  d'admin, une fois `admin_users` seule source prouvée.
- Stocker le prix réel d'un abonnement Shopify à l'activation.
- Suppression des tables des programmes arrêtés et des tables n8n.

`/api/engine/reviews`, relevée par l'audit, n'est plus un sujet : elle est réservée
aux admins depuis le 14 septembre (`de798f9`). Tout compte connecté y lisait la file
de relecture de tous les marchands et pouvait faire écrire à leurs clients.
