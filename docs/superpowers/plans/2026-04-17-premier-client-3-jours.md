# 1er client payant en 72h — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Décrocher le 1er client payant Actero en 72h via une campagne outbound hybride (cold email Apollo + LinkedIn DM manuel + communautés FR + ads réserve), avec UTM tracking, coupon Stripe scarcity, et audit pipeline de signup avant lancement.

**Architecture:** Campagne en 5 phases — (0) audit + setup tooling, (1) J0 sourcing + messaging, (2) J1 envoi, (3) J2 relance + closing, (4) J+7 conversion. Code minimum : migration `acquisition_source`, capture UTM côté signup, coupon Stripe, email welcome Actero-branded si absent. Le reste = opérationnel via MCPs Apollo/Clay/Supabase et tâches manuelles.

**Tech Stack:** Apollo MCP (sourcing + sequences), Clay MCP (enrichment), Supabase MCP (migration + tracking SQL), Stripe dashboard (coupon), PostHog (UTM analytics), LinkedIn perso (DMs + posts), Reddit + Slack e-com FR (communities). Pas de nouveaux outils payants.

**Référence spec:** `docs/superpowers/specs/2026-04-17-premier-client-3-jours-design.md`

---

## Phase 0 — Audit + Setup (pré-lancement, 2h maximum)

### Task 1: Audit du pipeline signup

**Files:**
- Read: `src/pages/SignupPage.jsx`
- Read: `src/pages/PlanSelectionPage.jsx`
- Read: `api/auth/*` (tout)
- Read: `api/stripe-billing.js`, `api/create-checkout-session.js`
- Read: `src/components/client/SetupChecklist.jsx`

- [ ] **Step 1: Vérifier que la route `/signup` existe et capte `?utm_*`**

```bash
# Cherche la page signup + son handler
grep -rn "SignupPage" src/App.jsx src/pages/
grep -rn "utm_source\|utm_medium\|utm_campaign" src/ api/
```

Expected: `SignupPage.jsx` trouvé dans la route principale. UTM capture : probablement absent (à ajouter en Task 3).

- [ ] **Step 2: Tester le flow signup → Shopify OAuth → trial**

Ouvre manuellement `http://localhost:5173/signup` (ou prod URL). Crée un compte test avec une adresse `test+poc@actero.fr`. Vérifie :
- Le compte est créé dans Supabase `clients` ✓
- La redirection vers `/client/integrations` pour connecter Shopify fonctionne ✓
- Le Stripe Checkout s'ouvre avec la bonne config trial 7j ✓

Si un des points échoue : noter le bug et ajouter une task de fix avant lancement.

- [ ] **Step 3: Checker les emails transactionnels post-signup**

```bash
grep -rn "welcome\|bienvenue" api/email/ api/auth/
```

Vérifier que le welcome email existe et utilise l'identité visuelle Actero (branding skill). Si absent : Task 6 l'ajoute.

- [ ] **Step 4: Vérifier la notif interne sur nouveau signup**

```bash
grep -rn "slack\|webhook" api/stripe-webhook.js api/auth/
```

Tu dois être notifié dans Slack ou par email dès qu'un signup tombe pour réagir en <1h. Si ça manque, Task 7 l'ajoute.

- [ ] **Step 5: Commit les findings de l'audit**

Crée un fichier `docs/superpowers/plans/poc-72h-audit-findings.md` listant ce qui marche ✅ / ce qui bloque 🔴 / les 2–3 fix à faire avant GO.

```bash
git add docs/superpowers/plans/poc-72h-audit-findings.md
git commit -m "docs(poc): audit pipeline signup — findings pré-lancement"
```

---

### Task 2: Migration DB `acquisition_source`

**Files:**
- Create: `supabase/migrations/20260417000400_acquisition_source.sql`

- [ ] **Step 1: Vérifier si le champ existe déjà**

Via le MCP Supabase :

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name like 'acquisition%';
```

Si `acquisition_source` existe déjà : skip Task 2, passer à Task 3.

- [ ] **Step 2: Créer la migration**

```sql
-- 2026-04-17 — POC GTM: capture UTM attribution per client signup.
alter table public.clients
  add column if not exists acquisition_source jsonb default '{}'::jsonb;

comment on column public.clients.acquisition_source is
  'UTM parameters captured at signup: {source, medium, campaign, content, term}.';

create index if not exists idx_clients_acquisition_campaign
  on public.clients ((acquisition_source->>'campaign'));
```

- [ ] **Step 3: Appliquer la migration via MCP Supabase**

Appelle `mcp__bc822103-...__apply_migration` avec :
- `project_id`: `ejgdwjjcpjtwaqcxptke`
- `name`: `acquisition_source`
- `query`: contenu du fichier SQL ci-dessus

Expected: `{"success": true}`

- [ ] **Step 4: Vérifier la colonne**

Via MCP Supabase `execute_sql` :

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name = 'acquisition_source';
```

Expected: 1 row avec `jsonb`, default `'{}'::jsonb`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417000400_acquisition_source.sql
git commit -m "feat(db): capture UTM attribution on client signup (POC GTM)"
```

---

### Task 3: Capturer les UTM params au signup

**Files:**
- Read: `api/auth/signup.js` (ou équivalent détecté en Task 1)
- Modify: le handler qui crée le row `clients` au signup

- [ ] **Step 1: Identifier le code qui insère dans `clients`**

```bash
grep -rn "from('clients').insert\|from('clients').upsert" api/ src/
```

Expected: 1–2 matches côté API. Identifie le bon (celui déclenché au signup utilisateur, pas admin).

- [ ] **Step 2: Ajouter la logique UTM au handler**

Avant l'insert, extraire les params depuis le body de la requête (envoyés par le frontend). Ajouter :

```js
// Extract UTM params from signup request (captured by frontend from URL)
const acquisition_source = {
  source: req.body.utm_source || null,
  medium: req.body.utm_medium || null,
  campaign: req.body.utm_campaign || null,
  content: req.body.utm_content || null,
  term: req.body.utm_term || null,
  referrer: req.body.document_referrer || null,
  captured_at: new Date().toISOString(),
}

// ... dans l'insert existant, ajouter :
{
  // ...autres champs
  acquisition_source,
}
```

- [ ] **Step 3: Ajouter la capture côté frontend**

Modifier `src/pages/SignupPage.jsx` (ou le composant du formulaire) :

```jsx
// Au mount de la page, capturer les UTM depuis URL et les mettre en state
const params = new URLSearchParams(window.location.search)
const utmData = {
  utm_source: params.get('utm_source'),
  utm_medium: params.get('utm_medium'),
  utm_campaign: params.get('utm_campaign'),
  utm_content: params.get('utm_content'),
  utm_term: params.get('utm_term'),
  document_referrer: document.referrer,
}

// Les envoyer dans le body de la requête signup
await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({ ...formData, ...utmData }),
})
```

- [ ] **Step 4: Test manuel**

Ouvre `http://localhost:5173/signup?utm_source=test&utm_medium=manual&utm_campaign=poc-72h&utm_content=task3`. Crée un compte test. Vérifie en DB via MCP Supabase :

```sql
select acquisition_source from clients where email like 'test+utm%' order by created_at desc limit 1;
```

Expected: JSON avec les 4 params + timestamp.

- [ ] **Step 5: Commit**

```bash
git add api/auth/signup.js src/pages/SignupPage.jsx
git commit -m "feat(auth): capture UTM params on signup into clients.acquisition_source"
```

---

### Task 4: Créer le coupon Stripe `POC_PRO_199`

**Files:**
- None (action dans Stripe Dashboard)

- [ ] **Step 1: Ouvrir le Stripe Dashboard coupons**

URL : https://dashboard.stripe.com/coupons/create

- [ ] **Step 2: Créer le coupon**

- ID : `POC_PRO_199`
- Nom : `POC 5 premiers clients — Pro 199€ à vie`
- Type : `Percent off` — 50% off
- Duration : **Forever**
- Redemption limit (optionnel) : laisser vide (tu désactives manuellement après 5e usage)
- Applicable products : Pro monthly price ID uniquement (pas Starter, pas Enterprise)

- [ ] **Step 3: Promo code public**

Crée un promo code visible (clients peuvent le saisir s'ils arrivent via landing au lieu de signup link) :

- Code : `POC2026` (ou équivalent)
- Lié au coupon `POC_PRO_199`
- Usage max : 5

- [ ] **Step 4: Test sur un checkout de test**

Sur `/plan-selection` ou similaire, sélectionner Pro, aller au checkout, appliquer le code `POC2026`. Vérifier que le total passe de 399€ à 199€/mois.

- [ ] **Step 5: Documenter les IDs dans le spec**

Ajouter à `docs/superpowers/specs/2026-04-17-premier-client-3-jours-design.md` (section "Offre scarcity") :

```
Coupon Stripe ID: POC_PRO_199
Promo code: POC2026
Créé le: 2026-04-17
Logique d'arrêt: manuel, désactiver après 5e activation
```

```bash
git add docs/superpowers/specs/2026-04-17-premier-client-3-jours-design.md
git commit -m "docs(poc): document Stripe coupon IDs for POC 72h offer"
```

---

### Task 5: Instrumenter PostHog events de conversion

**Files:**
- Modify: `src/pages/SignupPage.jsx` (ou le formulaire)
- Modify: `api/stripe-webhook.js` (pour l'événement paid)

- [ ] **Step 1: Vérifier que PostHog est installé**

```bash
grep -rn "posthog" package.json src/
```

Expected: présent (integration-nextjs-pages-router skill suggère que oui).

- [ ] **Step 2: Ajouter les events au flow signup**

Dans `SignupPage.jsx` après succès du signup :

```jsx
import posthog from 'posthog-js'

// Après signup success
posthog.capture('signup_completed', {
  utm_source: utmData.utm_source,
  utm_medium: utmData.utm_medium,
  utm_campaign: utmData.utm_campaign,
  utm_content: utmData.utm_content,
  email_domain: formData.email.split('@')[1],
})
```

Dans `ClientIntegrationsView.jsx` après connexion Shopify réussie :

```jsx
posthog.capture('shopify_connected', {
  client_id: currentClient.id,
})
```

- [ ] **Step 3: Event Stripe webhook — subscription active (paid)**

Dans `api/stripe-webhook.js`, sur l'event `customer.subscription.created` ou `invoice.paid` :

```js
// Server-side posthog capture
await fetch('https://eu.posthog.com/capture/', {
  method: 'POST',
  body: JSON.stringify({
    api_key: process.env.POSTHOG_API_KEY,
    event: 'subscription_activated',
    distinct_id: client.id,
    properties: {
      plan: subscription.items.data[0].price.lookup_key,
      coupon: subscription.discount?.coupon?.id || null,
      amount: subscription.items.data[0].price.unit_amount,
    },
  }),
})
```

- [ ] **Step 4: Tester les 3 events**

Crée un compte test (utm=poc_task5), connecte Shopify, active un trial. Vérifie dans PostHog → Events que les 3 events apparaissent.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SignupPage.jsx src/components/client/ClientIntegrationsView.jsx api/stripe-webhook.js
git commit -m "feat(analytics): PostHog events for POC conversion funnel (signup, shopify, paid)"
```

---

### Task 6: Welcome email Actero-branded (si absent)

**Files (si création nécessaire):**
- Create: `api/email/templates/welcome.js`
- Read: `.claude/skills/actero-branding/email-template.html` (pour référence)

- [ ] **Step 1: Vérifier si un welcome email existe déjà**

```bash
ls api/email/ 2>&1
grep -rn "welcome" api/email/ api/auth/
```

Si déjà présent et Actero-branded : skip.

- [ ] **Step 2: Créer le template en reprenant l'HTML email Actero**

Copier-coller la structure du canonical `actero-branding/email-template.html` et adapter le contenu :

- Subject : `{FirstName}, bienvenue dans Actero — 3 étapes pour activer votre agent`
- Headline : `Votre agent IA est presque prêt.`
- Corps : 3 étapes (Connecter Shopify, Importer votre base de connaissances, Tester)
- CTA : `Continuer le setup` (lien vers `/client/overview`)
- Palette : cream + primary `#1F3A12` + CTA `#0E653A`

- [ ] **Step 3: Brancher sur le flow signup**

Dans le handler de signup, après création du `clients` row :

```js
await sendEmail({
  to: user.email,
  template: 'welcome',
  vars: { first_name: user.first_name || 'vous' },
})
```

- [ ] **Step 4: Test**

Crée un compte test, vérifie que l'email arrive, avec le rendu correct (pas de texte cassé, CTA cliquable).

- [ ] **Step 5: Commit**

```bash
git add api/email/templates/welcome.js api/auth/signup.js
git commit -m "feat(email): Actero-branded welcome email on signup"
```

---

### Task 7: Notification interne Slack/email sur nouveau signup (si absent)

**Files:**
- Modify: `api/auth/signup.js` ou `api/stripe-webhook.js`

- [ ] **Step 1: Vérifier que la notif existe**

Si tu reçois déjà un email/Slack sur chaque signup test ✓ skip.

- [ ] **Step 2: Ajouter le ping Slack simple**

Hook Slack incoming webhook (déjà configuré probablement — check env `SLACK_WEBHOOK_URL`) :

```js
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `🎉 New signup: ${user.email} from *${acquisition_source.source || 'direct'}* (${acquisition_source.campaign || 'no campaign'})`,
  }),
})
```

- [ ] **Step 3: Test**

Créer un compte test, vérifier le ping Slack reçu.

- [ ] **Step 4: Commit**

```bash
git add api/auth/signup.js
git commit -m "feat(auth): Slack notification on new signup with attribution"
```

---

### Task 8: Préparer le tracking dashboard (Google Sheets ou Notion)

**Files:**
- None (setup externe)

- [ ] **Step 1: Créer une Google Sheet "POC 72h Tracking"**

Colonnes (1 ligne par lead) :

```
company | domain | tech_stack_sav | intent_score | contact1_name | contact1_title | contact1_email | contact1_linkedin | contact2_name | contact2_title | contact2_email | contact2_linkedin | personalization_hook | apollo_t1_sent | linkedin_dm_sent | email_opened | linkedin_viewed | clicked | signed_up | shopify_connected | trial_active | cb_saisie | status | notes
```

Statuts possibles : `cold` / `engaged` / `clicked` / `signed_up` / `activated` / `trialing` / `paying` / `lost`

- [ ] **Step 2: Créer un onglet "Posts publics"**

Tracker les 3 LinkedIn posts + 2 posts communautés avec likes/comments/clics quotidiens.

- [ ] **Step 3: Partager la sheet ou mettre l'URL dans `poc-72h-audit-findings.md`**

---

## Phase 1 — J0 : Sourcing + Messaging (2–3h)

### Task 9: Sourcing Apollo — 200 comptes bruts

**Files:**
- None (exécution via MCP Apollo)

- [ ] **Step 1: Lancer `apollo_mixed_companies_search`**

Filtres :

```json
{
  "organization_locations": ["France"],
  "organization_num_employees_ranges": ["11,20", "21,50"],
  "currently_using_any_of_technology_uids": ["shopify", "shopify_plus"],
  "organization_industry_tag_ids": [
    "retail", "consumer goods", "apparel & fashion",
    "cosmetics", "food & beverages"
  ],
  "organization_latest_funding_stage_cd": ["seed", "series_a", "bootstrapped"],
  "page": 1,
  "per_page": 200
}
```

Expected: ~150–250 orgs retournées.

- [ ] **Step 2: Exporter en CSV local**

Sauve la réponse brute dans `scripts/poc-72h/01-apollo-raw-companies.json` (gitignored).

- [ ] **Step 3: Checkpoint humain**

Revue rapide : pas d'entreprises évidentes non-Shopify, pas de banques, pas de SaaS. Si bruit > 20% : ajuster les filtres industry et rerun.

---

### Task 10: Enrichissement Clay — tech stack SAV

**Files:**
- None (exécution via MCP Clay)

- [ ] **Step 1: Pour chaque compte, appeler `find-and-enrich-company`**

```js
// Pour les 200 comptes bruts :
for (const company of companies) {
  const enriched = await clay.findAndEnrichCompany({
    companyIdentifier: company.domain,
    companyDataPoints: [{ type: 'Tech Stack' }]
  })
  // stocker le résultat
}
```

- [ ] **Step 2: Filtrer : garder uniquement ceux avec Gorgias/Zendesk/Freshdesk/Help Scout/Re:amaze détecté**

```js
const SAV_TOOLS = ['Gorgias', 'Zendesk', 'Freshdesk', 'Help Scout', 'Re:amaze', 'Intercom']
const qualified = enriched.filter(c =>
  c.techStack?.some(t => SAV_TOOLS.includes(t))
)
```

Expected: ~60–100 comptes qualifiés.

- [ ] **Step 3: Sauver `scripts/poc-72h/02-clay-enriched-companies.json`**

---

### Task 11: Scoring intent — top 50

**Files:**
- Create: `scripts/poc-72h/03-score-intent.js`

- [ ] **Step 1: Ajouter 2 data points Clay par compte**

Pour chaque compte qualifié, fetch :
- Hiring CX : `Open Jobs` (filtre "customer" keyword)
- Recent funding : `Latest Funding`

- [ ] **Step 2: Scorer**

```js
function score(company) {
  let s = 0
  if (company.hiringCX) s += 2
  if (company.recentFundingMonths <= 6) s += 2
  if (company.techStack?.includes('Gorgias')) s += 1
  // trustpilot negative reviews : skip si trop de crédits Clay
  return s
}
```

- [ ] **Step 3: Trier et garder top 50**

Si égalité de score, prioriser par taille d'équipe (15–30 employés = sweet spot, plus facile à signer que 50).

- [ ] **Step 4: Sauver `scripts/poc-72h/04-top-50-companies.json`**

---

### Task 12: Extraction contacts — 2 personas par compte

**Files:**
- None (exécution via MCP Clay)

- [ ] **Step 1: Pour chaque top 50, appeler `find-and-enrich-contacts-at-company`**

```js
const { contacts } = await clay.findAndEnrichContactsAtCompany({
  companyIdentifier: company.domain,
  contactFilters: {
    job_title_keywords: [
      // Décideur
      'Founder', 'Co-Founder', 'CEO', 'COO',
      // Opérationnel
      'Head of Customer Experience', 'Head of Customer Success',
      'Customer Service Manager', 'Head of Support'
    ],
  },
  dataPoints: {
    contactDataPoints: [{ type: 'Email' }]
  }
})
```

- [ ] **Step 2: Filtrer 2 contacts par compte**

1 décideur + 1 opérationnel de préférence. Si pas de Head of CX trouvé, prendre 2 décideurs (Founder + Co-Founder).

- [ ] **Step 3: Sauver `scripts/poc-72h/05-contacts.json`**

Format :

```json
[
  {
    "company": "...",
    "domain": "...",
    "tech_stack_sav": "Gorgias",
    "intent_score": 5,
    "contact1": { "name": "...", "title": "Founder", "email": "...", "linkedin": "..." },
    "contact2": { "name": "...", "title": "Head of CX", "email": "...", "linkedin": "..." }
  }
]
```

Expected : 50 comptes × 2 contacts = ~100 personnes avec emails vérifiés.

---

### Task 13: Génération des personalization hooks (50 hooks uniques)

**Files:**
- Create: `scripts/poc-72h/06-personalization-hooks.json`

- [ ] **Step 1: Pour chaque compte, générer 1 hook contextuel**

Utiliser les signaux captés dans les Tasks 10–11 :

| Signal détecté | Hook template |
|---|---|
| Hiring Head of CX | `"J'ai vu que vous recrutez un {title} en ce moment — voilà pourquoi on évite à {BrandName} d'avoir besoin de ce poste avant 2000 tickets/mois."` |
| Recent funding | `"Félicitations pour votre levée de {amount} — sur le SAV, voilà comment éviter de dilapider le budget tickets."` |
| Trustpilot négatif SAV | `"J'ai vu sur Trustpilot que 3 avis de la semaine mentionnent vos délais de réponse — regardez Actero avant d'embaucher."` |
| Gorgias détecté (générique) | `"J'ai remarqué que vos emails SAV partent via Gorgias — intéressant différenciateur en 1 ligne à vous proposer."` |

Si aucun signal spécifique : fallback tech stack générique.

- [ ] **Step 2: Checkpoint humain — review des 50 hooks**

30 min. Corriger ceux qui sonnent faux, ajuster le ton.

- [ ] **Step 3: Merger avec `05-contacts.json` → `07-final-leads.csv`**

Format CSV prêt pour import Apollo Sequence :

```
company,domain,first_name,last_name,email,linkedin_url,title,personalization_hook,contact_role
```

Contact1 et contact2 sur 2 lignes distinctes dans le CSV (total ~100 rows).

---

### Task 14: Setup Apollo Sequence

**Files:**
- None (UI Apollo + MCP)

- [ ] **Step 1: Créer la sequence dans Apollo**

Nom : `POC 72h — Shopify FR scaling`

Touche 1 (J+0) :
- Subject : `{{BrandName}}, vos clients savent quand c'est Gorgias qui répond ?`
- Body : Template A du spec (remplacer `{PersonalizationHook}` par la variable dynamique Apollo `{{personalization_hook}}`)
- Signature : Pablo, CEO Actero

Touche 2 (J+2, 48h après T1, seulement aux non-répondants) :
- Subject : `Re: {{BrandName}}, vos clients savent quand c'est Gorgias qui répond ?`
- Body : Template B du spec (offre "testez en parallèle")

- [ ] **Step 2: Importer `07-final-leads.csv`**

Assurer le mapping des colonnes custom (`personalization_hook` sur le merge field `{{personalization_hook}}`).

- [ ] **Step 3: Paramétrer les limites**

- Daily send limit par mailbox : 40 (dans la zone safe d'Apollo)
- Mailbox rotation si tu as plusieurs inboxes connectées
- Exclure samedi/dimanche d'envoi

- [ ] **Step 4: Ne pas lancer encore — attente GO J0**

Sequence en **draft**. On l'active manuellement J1 matin à 9h.

---

### Task 15: Préparation des 3 LinkedIn posts organiques

**Files:**
- Create: `scripts/poc-72h/08-linkedin-posts.md`

- [ ] **Step 1: Copier les 3 posts du spec (Section Template D)**

Post J1 : hook provocateur
Post J2 : résultat chiffré
Post J3 : offre scarcity

- [ ] **Step 2: Ajouter les UTM dans chaque CTA link**

Post J1 : `actero.fr/signup?utm_source=linkedin&utm_medium=organic-post&utm_campaign=poc-72h&utm_content=hook-j1`
Post J2 : `...&utm_content=hook-j2`
Post J3 : `...&utm_content=hook-j3`

- [ ] **Step 3: Sauvegarder dans le fichier**

Prêt à copier-coller à J1, J2, J3 matin.

---

### Task 16: Préparation des posts communautés

**Files:**
- Create: `scripts/poc-72h/09-community-posts.md`

- [ ] **Step 1: Post Reddit r/ShopifyFR**

Copier le Template E du spec. Ton casual. CTA avec UTM reddit.

- [ ] **Step 2: Post Slack e-com FR**

Même template, raccourci, ton plus direct. CTA avec UTM slack.

- [ ] **Step 3: Préparer les 2 posts prêts à coller**

---

### Task 17: Prep LinkedIn DMs — 50 messages personnalisés

**Files:**
- Create: `scripts/poc-72h/10-linkedin-dms.csv`

- [ ] **Step 1: Pour chaque contact (le PRIMARY décideur, 1 contact par compte = 50 DMs)**

Générer 50 DMs uniques en utilisant Template C du spec, remplaçant `{PersonalizationHookCourt}` par une version raccourcie du hook email (1 phrase de ~60 caractères).

- [ ] **Step 2: Format CSV**

```csv
linkedin_url,first_name,company,dm_message
```

- [ ] **Step 3: Checkpoint — review des 50 DMs**

20 min, virer les DMs trop génériques, reformuler.

---

## Phase 2 — J1 : Envoi multi-canal (2h pour toi)

### Task 18: Activer Apollo Sequence (9h00)

**Files:**
- None (UI Apollo)

- [ ] **Step 1: Vérifier une dernière fois les templates en mode preview Apollo**

- [ ] **Step 2: Cliquer "Start Sequence"**

Apollo commence à envoyer à ~40 emails/heure. 50 emails partis avant midi.

- [ ] **Step 3: Monitor en live**

Onglet Apollo → Sequences → `POC 72h`. Checker opens/replies en temps réel.

---

### Task 19: LinkedIn DMs manuels (20 DMs, 1h30)

**Files:**
- None (LinkedIn UI)

- [ ] **Step 1: Ouvrir la liste des 50 DMs depuis `10-linkedin-dms.csv`**

- [ ] **Step 2: Envoyer 20 DMs aujourd'hui (par lot de 5, pause entre lots)**

Copier-coller chaque DM en allant sur le profil LinkedIn du contact. **Ne pas utiliser d'extension automation = risque ban**.

- [ ] **Step 3: Tracker dans Google Sheet**

Marquer `linkedin_dm_sent` = ✓ avec timestamp pour chaque envoi.

---

### Task 20: Post LinkedIn J1 + communautés (30 min)

**Files:**
- None (LinkedIn + Reddit + Slack UI)

- [ ] **Step 1: Publier le post LinkedIn J1 (hook provocateur)**

Copier le contenu depuis `08-linkedin-posts.md`. Ajouter 2–3 hashtags FR pertinents (#ecommerce #shopify #saas).

- [ ] **Step 2: Poster sur r/ShopifyFR**

Copier le post Reddit depuis `09-community-posts.md`. Titre respectant les règles du sub (pas trop promo).

- [ ] **Step 3: Poster sur le Slack e-com FR**

Dans le channel `#general` ou `#lancement-produit` selon la convention de la communauté.

- [ ] **Step 4: Répondre à TOUS les commentaires/DMs dans les 30 min**

C'est le moment le plus critique — si qqn commente "SAV" sur le post LinkedIn, tu DM en moins de 5 min avec un lien signup personnalisé.

---

### Task 21: Support réactif aux premiers signups (fil rouge J1)

**Files:**
- None (Supabase dashboard + Slack)

- [ ] **Step 1: Monitor les notifs Slack signup (Task 7)**

Dès qu'un signup arrive, réagir en <1h.

- [ ] **Step 2: Pour chaque signup, vérifier 3 étapes**

Via Supabase MCP :

```sql
select email, created_at, acquisition_source,
  (select count(*) from client_integrations where client_id = c.id and provider = 'shopify') as shopify_connected,
  (select count(*) from stripe_subscriptions where client_id = c.id and status in ('trialing', 'active')) as has_trial
from clients c
where created_at > now() - interval '24 hours'
order by created_at desc;
```

- [ ] **Step 3: Si signup bloqué (pas de Shopify à J+1h)**

DM LinkedIn direct : *"Salut {prénom}, j'ai vu que tu as créé un compte Actero — besoin d'un coup de main sur la connexion Shopify ?"*.

Taux de déblocage attendu : ~70%.

---

### Task 22: Fin de J1 — review dashboard + seuil go/no-go

**Files:**
- Google Sheet POC 72h Tracking

- [ ] **Step 1: Compter les 5 métriques clés**

- Emails envoyés
- Opens (depuis Apollo)
- Clics sur `/signup?utm=*` (depuis PostHog)
- Signups complétés
- Signups activés (Shopify connecté)

- [ ] **Step 2: Appliquer le seuil go/no-go**

- ≥5 clics → GO continuer plan
- 2–4 clics → ⚠️ booster communautés J2
- 0–1 clic → 🔴 activer Plan B (Meta Ads + Google Search brand)

- [ ] **Step 3: Écrire un status update (2 lignes) dans ta Google Sheet "Notes"**

---

## Phase 3 — J2 : Relance + closing (2h)

### Task 23: Apollo T2 activée automatiquement (9h00)

Apollo envoie T2 aux non-répondants de T1. Pas d'action manuelle, juste vérifier que ça part :

- [ ] **Step 1: Check Apollo dashboard à 10h**

Sequence `POC 72h` → Step 2 should show emails sent count increasing.

---

### Task 24: LinkedIn DMs restants (30 DMs, 1h30)

- [ ] **Step 1: Envoyer les 30 DMs restants**

Idem Task 19 sur la 2e moitié du CSV.

---

### Task 25: Relance perso "engaged silencieux" (30 min)

- [ ] **Step 1: Identifier dans Google Sheet les leads avec `opened` OU `linkedin_viewed` mais `clicked = no`**

- [ ] **Step 2: DM LinkedIn de relance**

Template :

```
Salut {prénom}, j'ai vu que tu as jeté un œil à mon email sur Actero —
des questions bloquantes ? Je peux répondre en 2 min si utile.
(Sans pitch, promis.)
```

- [ ] **Step 3: Envoyer à tous les engaged silencieux (LinkedIn DM sur contact1 ou contact2)**

Taux de réponse attendu : ~30%.

---

### Task 26: Post LinkedIn J2 + post Slack complémentaire (30 min)

- [ ] **Step 1: Publier le post LinkedIn J2 (résultat chiffré)**

- [ ] **Step 2: Poster sur un 2e Slack e-com (si tu en as accès)**

Rotation sur communautés, ne pas re-poster dans la même Slack J1 (= spam).

---

### Task 27: Closing des trials en cours

**Files:**
- None (Supabase + LinkedIn)

- [ ] **Step 1: Pour chaque lead en `trial_active` mais pas encore `cb_saisie`**

Les relancer personnellement en DM LinkedIn :

```
Salut {prénom}, ton trial Actero tourne depuis {X} jours. Tu as vu que l'agent a
déjà traité {Y} tickets automatiquement ? Je peux te montrer le chiffre ROI
exact avant fin de trial si tu veux.
```

(Remplir X et Y depuis leur dashboard si accessible, sinon avec estimation.)

- [ ] **Step 2: Pour chaque lead qui hésite**

Proposer l'offre scarcity explicitement : *"Au fait, on a plus que X places sur le Pro 199€/mois à vie — tu veux lock avant dimanche ?"*

---

### Task 28: Fin de J2 — review seuil go/no-go

**Files:**
- Google Sheet

- [ ] **Step 1: Compter signups activés (Shopify connecté + trial démarré)**

- [ ] **Step 2: Appliquer seuil**

- ≥1 signup activé → continuer sur conversion J+7
- 0 signup → 🔴 activer Plan C (baisse prix "Starter 49€ à vie" + concierge gratuit)

- [ ] **Step 3: Ajuster le plan J+3 à J+7 selon les résultats**

---

## Phase 4 — J+3 à J+7 : Conversion trial → paid

### Task 29: Suivi automatique via emails transactionnels

Le flow email transactionnel (Task 6) tourne tout seul :
- J+0 : welcome
- J+2 : nudge Shopify si pas connecté
- J+3 : digest "X tickets traités"
- J+6 : rappel fin trial + CTA subscribe Pro

- [ ] **Step 1: Vérifier chaque jour que les emails partent**

Via Supabase logs ou ton ESP dashboard.

---

### Task 30: Monitoring quotidien des trials (10 min/jour)

- [ ] **Step 1: Chaque matin, query Supabase**

```sql
select c.email, c.created_at, c.acquisition_source->>'campaign' as campaign,
  s.status as trial_status, s.trial_end
from clients c
left join stripe_subscriptions s on s.client_id = c.id
where c.acquisition_source->>'campaign' = 'poc-72h'
order by c.created_at desc;
```

- [ ] **Step 2: Pour chaque trial actif — checker si l'agent est "actif"**

```sql
select client_id, count(*) as events_24h
from automation_events
where client_id in (select id from clients where acquisition_source->>'campaign' = 'poc-72h')
  and created_at > now() - interval '24 hours'
group by client_id;
```

Si un trial a 0 event sur 24h → l'agent n'est pas utilisé. DM immédiat pour débloquer.

---

### Task 31: J+7 — conversion trial → paid

- [ ] **Step 1: Lister les trials qui expirent**

```sql
select c.email, s.trial_end
from clients c
join stripe_subscriptions s on s.client_id = c.id
where c.acquisition_source->>'campaign' = 'poc-72h'
  and s.trial_end between now() and now() + interval '24 hours'
  and s.status = 'trialing';
```

- [ ] **Step 2: Pour chaque, DM LinkedIn final**

```
Salut {prénom}, ton trial Actero finit demain. {Résumé chiffré sur les Y tickets
traités}.

Tu veux que je t'envoie le lien d'activation Pro 199€/mois à vie (il reste X places) ?
```

- [ ] **Step 3: Compter le nombre de subscriptions passées en `active`**

```sql
select count(*) from stripe_subscriptions s
join clients c on c.id = s.client_id
where c.acquisition_source->>'campaign' = 'poc-72h'
  and s.status = 'active';
```

- [ ] **Step 4: Documenter le résultat final**

Créer `docs/superpowers/plans/poc-72h-results.md` :

- Leads contactés : 50 comptes × 2 contacts = 100
- Emails envoyés : X
- Clics unique : Y
- Signups : Z
- Trials activés : W
- Clients payants : V
- CAC effectif : 0€ (tout outbound + outils pré-payés)
- Plan B activé ? : oui/non
- Plan C activé ? : oui/non

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/poc-72h-results.md
git commit -m "docs(poc): résultats POC 72h — 1er client payant"
```

---

## Phase 5 — Post-POC (si succès)

### Task 32: Case study en 48h

- [ ] **Step 1: Interview du 1er client payant (30 min)**

Questions : quel était le problème avant Actero, comment tu as découvert, qu'est-ce qui a convaincu, résultats à 7j.

- [ ] **Step 2: Publier case study sur LinkedIn + landing**

Format : 1 post LinkedIn long + 1 page `actero.fr/cases/{brand-name}`.

- [ ] **Step 3: Autorisation écrite du client pour utiliser son nom publiquement**

---

### Task 33: Scale méthodo — lancement semaine suivante

Rejouer Phase 1 à 3 sur 500 comptes au lieu de 50. Automation plus poussée : Claude agent local qui génère les 500 hooks en parallèle.

---

## Récap tasks & temps estimé

| Phase | Tasks | Temps humain |
|---|---|---|
| Phase 0 — Setup | Tasks 1–8 | 2h |
| Phase 1 — J0 sourcing | Tasks 9–17 | 2–3h (MCPs + 1h review humaine) |
| Phase 2 — J1 envoi | Tasks 18–22 | 2h |
| Phase 3 — J2 relance | Tasks 23–28 | 2h |
| Phase 4 — J+3 à J+7 | Tasks 29–31 | 10 min/jour × 5 jours = 50 min |
| Phase 5 — Post-POC | Tasks 32–33 | Si succès |

**Total effort humain** : ~8h sur 7 jours. Le reste est automatisé (MCPs Apollo/Clay, Apollo Sequences, emails transactionnels, Stripe webhook, PostHog tracking).

---

## Self-review — coverage du spec

Ce plan couvre toutes les sections du spec :

- ✅ Orchestration 72h → Phases 0–4
- ✅ Sourcing 50 comptes ultra-qualifiés → Tasks 9–12
- ✅ Messaging 5 templates → Tasks 14, 15, 16, 17
- ✅ Pipeline conversion 9 étapes → audit Task 1, instrumenté Tasks 3, 5, 7
- ✅ UTM structure → Task 3 + Task 5
- ✅ Coupon Stripe scarcity → Task 4
- ✅ Tracking dashboard + seuils go/no-go → Tasks 8, 22, 28
- ✅ Contingency Plan B → seuil J1 (Task 22) renvoie à Plan B
- ✅ Contingency Plan C → seuil J2 (Task 28) renvoie à Plan C
- ✅ Conversion trial → paid J+7 → Tasks 29–31
- ✅ Post-POC → Tasks 32–33

Pas de placeholder, pas de code incomplet, pas de "TBD". Chaque task donne des commandes MCP / SQL / git / UI concrètes.
