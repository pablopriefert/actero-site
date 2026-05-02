# 📅 Roadmap 30 jours — Mai 2026

> Audit complet du codebase Actero (70k LOC · 45 pages · 158 composants · 158 endpoints · 28 migrations) + plan d'action priorisé sur 30 jours pour transformer la veille concurrentielle en pipeline d'exécution. Date de référence : 2026-05-02.

---

## 1. Diagnostic en 60 secondes

**Forces** — Le produit est étonnamment complet pour une équipe de 2. Engine IA bien architecturé (5 agents spécialisés, classification + routing + escalation), infra prod solide (cron monitors corrigés, RLS partout, audit log, error reports self-service), 12 pages de comparaison concurrentielle déjà publiées, portail client final existant, agent vocal complet, marketplace. Stack moderne (React 19, Vite 7, Tailwind 4, Sentry, Amplitude, Supabase, Stripe Entitlements).

**Faiblesses bloquantes pour le go-to-market** — `ClientDashboard.jsx` 1369 lignes avec 14 onglets = surcharge cognitive critique pour un nouveau marchand. `SupportGuidePage.jsx` 1272 lignes en 1 page = ingérable. Pricing 925 lignes très dense face à des concurrents avec pricing à la résolution. **Pas de page comparison vs eesel AI** alors qu'eesel mène une offensive SEO sur les mots-clés ICP (vu dans la veille du 02/05). Pas de page vs Crisp Hugo AI alors que Crisp a fait #1 ProductHunt le 22/04. Onboarding probablement long : Setup Wizard + KB + guardrails + ton + intégrations + simulator avant la 1ère valeur. Aucun design system formel documenté. Très peu de tests E2E.

**Risques externes immédiats** — Zendesk Relate le 21 mai (annonces IA agentique), Intercom 2 lancé le 01/05, eesel SEO en cours. Fenêtre d'action de 19 jours avant que le SERP soit verrouillé.

---

## 2. Inventaire condensé

### Pages publiques (28)
- **Landing/produit** : Landing, Product, Company, FAQ, Pricing, Audit, ProspectDemo
- **Comparaison concurrents** : 8 alternative-X (Crisp, Gorgias, Intercom, Reamaze, Siena, Tidio, Zendesk) + 4 vs-X (Gorgias, Intercom, Tidio, Zendesk) + Calculateur Gorgias = **12 pages** ⚠️ manque eesel + Crisp Hugo + Alhena + Zipchat
- **Acquisition** : ActeroForStartups, Partner Landing, Partners Directory, Partner Apply, Referral
- **Marketplace** : Marketplace + Template detail
- **Support** : SupportGuide (1272 lignes 🚨), Help Center embed dashboard
- **Legal** : Privacy, Terms, Legal

### Auth/onboarding (7)
Start, Signup, AuthCallback, PlanSelection, ShopifySuccess, Success, Cancel

### Client Dashboard (14 onglets actifs)
Overview · Automation ⭐ · Email Agent (PRO) · Knowledge · Guardrails · Simulator (STARTER) · Agent Control · Escalations · Activity · Portal SAV (STARTER) · Integrations · Insights · Peak Hours · Settings — **trop pour un nouvel utilisateur**

### Admin Dashboard (41 vues)
MRR · Churn cohorts · Client health · Live runs · Engine test · Pipeline · Funnel · Manual review · Hallucinations · Top errors · Connector health · Cost tracker · Negative ratings · Action logs · Stripe setup · Partners · Referrals · etc. — très complet

### Backend (158 endpoints)
- **engine/** 52 (cœur produit)
- **integrations/** 28 (Shopify, Gmail, Slack, Stripe, Gorgias, Zendesk, Intercom, Aftership, AccountingApps)
- **portal/** 27 (magic link client final)
- **lib/** 22 (utilitaires partagés)
- **admin/** 15
- **voice/** 12 (ElevenLabs + Twilio)
- **ambassador/** 12 + **marketplace/** 10 + **cron/** 9 + **mcp/** 6 + **vision/** 5 + autres

### Crons Vercel (8 actifs après nettoyage du 01/05)
poll-inbound-emails (2 min) · process-abandoned-carts (5 min) · proactive-watchdog (15 min) · slack-canvas-update (15 min) · slack-daily-digest (lun-ven 7h30) · process-comptabilite (8h00) · monthly-report (1er) · churn-predictions (dim 6h) · purge-vision-images (3h00)

### Code smells > 500 lignes (à split)
1. `pages/ClientDashboard.jsx` — 1369
2. `pages/SupportGuidePage.jsx` — 1272
3. `components/client/ClientIntegrationsView.jsx` — 1153
4. `pages/AdminDashboard.jsx` — 1090
5. `components/client/GuardrailsEditor.jsx` — 1029
6. `components/client/ClientEscalationsView.jsx` — 1014
7. `components/client/PromptEditor.jsx` — 951
8. `pages/PricingPage.jsx` — 925
9. `components/client/ClientKnowledgeBaseView.jsx` — 886
10. `components/client/AutomationHubView.jsx` — 833

### Dette technique mesurable
- 10 TODO/FIXME/HACK marqueurs (très propre)
- 2 TODOs `portal_tone` non exposé (legacy de la migration tu/vous)
- 2 TODOs n8n-copilot conversion de nodes invalides (feature inachevée)
- 0 dossier `__tests__` ou `*.test.js` détecté hors Playwright (1 seul `tests/e2e/portal.spec.js`)

---

## 3. Plan 30 jours — 3 sprints de 10 jours

Chaque ticket a un **Owner suggéré** (Pablo / Gaspard / les 2), une **acceptance criteria mesurable**, et une **estimation en heures**.

### 🚀 Sprint 1 — J1 à J10 : Capter la demande qui existe DÉJÀ

> Capitaliser sur la veille concurrentielle. La demande arrive sur des comparatifs SEO et des CTA Pricing — il faut la convertir avant que les concurrents le fassent.

#### J1 (vendredi 2 mai) — Audit & priorisation
- [ ] **Décision positioning post-purchase vs conversational commerce** (Pablo+Gaspard, 1h)
  - Lecture du brief A/B/C de la veille concurrentielle
  - Décision actée dans Notion `🧭 Stratégie & Roadmap > Positioning 2026`
  - Critère de validation : 1 paragraphe écrit qui devient la north-star de tout le marketing copy

#### J2-J3 — Pages comparaison manquantes (priorité veille)
- [ ] **Créer `AlternativeEesel.jsx` + `EeselVsActero.jsx`** (Pablo, 4h)
  - Forme : reprendre la structure des `Alternative*Page` existantes (8 templates en stock)
  - Contenu : tarif PAYG eesel ($0.40/ticket) vs forfait fixe Actero ; absence SMTP marchand ; absence ROI live
  - Angle : "eesel pour ceux qui veulent du PAYG sans engagement, Actero pour ceux qui veulent un coût prévisible"
  - Critère : page indexable, schema FAQ, CTA `Démarrer gratuitement → /signup`, push sitemap
- [ ] **Créer `AlternativeCrispHugo.jsx`** (Pablo, 2h)
  - Crisp Hugo AI verrouillé derrière plan Plus 295€/mois — angle prix
  - Critère idem

#### J3-J5 — Refresh Pricing avec calculateur live
- [ ] **Splitter `PricingPage.jsx` 925 lignes** en 4 sous-composants (Pablo, 4h)
  - `<HeroPricing>`, `<PlansGrid>`, `<ROISimulator>`, `<ComparisonTable>`, `<FaqPricing>`
  - Critère : aucun fichier > 250 lignes
- [ ] **Ajouter calculateur live "votre coût Gorgias/Intercom/Zendesk vs Actero"** (Pablo, 6h)
  - Composant `<CostComparator>` : 3 sliders (volume tickets/mois, plan concurrent actuel, plan Actero cible)
  - Output live : tableau side-by-side avec coût mensuel concurrent (résolution × tarif) vs forfait Actero
  - Tarifs concurrents dans `src/lib/competitor-pricing.js` (config centralisée, mise à jour par la veille)
  - Critère : sur 1000 tickets/mois, l'écart Intercom $990 vs Actero 399€ apparaît clairement

#### J5-J6 — Cleanup marketing
- [ ] **Sweep WhatsApp restant** (Pablo, 2h)
  - 4 pages marketing avec mention WhatsApp détectées hier (CapabilitiesA, ProductPage, ZendeskVsActero, AlternativeGorgias, ClientDashboard hero)
  - Décision : retirer toute mention OU remplacer par "Voice agent"
  - Critère : `grep -ri "whatsapp" src/pages src/components/landing` retourne 0
- [ ] **Sweep code mort** (Pablo, 2h)
  - Vérifier IndustryPicker.jsx (signalé en début de session comme dead code potentiel)
  - Vérifier Zendesk*Widget.jsx (deux fichiers dans `src/components/` racine — probablement obsolète)
  - Critère : retirer 2-3 fichiers ou les déplacer dans `src/components/legacy/`

#### J7-J9 — Réduire le time-to-value du Setup Wizard
- [ ] **Refondre `SetupWizard.jsx` en 4 étapes max** (Pablo, 8h)
  - Étape 1 : OAuth Shopify (déjà existant)
  - Étape 2 : Auto-import KB depuis politiques de la boutique (déjà existant via knowledge import URL)
  - Étape 3 : 1 question marketing — "Tu vouvoies ou tutoies ?"
  - Étape 4 : **Live demo** — l'agent traite 3 tickets historiques de la boutique en démo, montre les résultats
  - Tout le reste (guardrails, ton détaillé, intégrations email) → onglet "Polish" déclaré optionnel post-onboarding
  - Critère : un nouveau merchant peut activer son agent SAV en < 10 min, mesurable via Amplitude `setup_completed_at - signup_at`
- [ ] **Ajouter `<EmptyStateOnboarded>` dans chaque tab dashboard** (Pablo, 3h)
  - Si l'utilisateur n'a aucune donnée dans tab X (escalations, knowledge, etc.) → afficher un appel à action concret au lieu d'un tableau vide
  - Ex Knowledge tab vide : "Aucune entrée. Importez votre 1er PDF de politique → bouton"
  - Critère : aucun tab vide ne montre juste un tableau blanc

#### J10 — Push & mesure Sprint 1
- [ ] **Deploy + tracker Amplitude** (Pablo, 2h)
  - Events : `pricing_calculator_used`, `comparison_page_viewed` (par concurrent), `setup_step_completed`
  - Dashboard Amplitude "Sprint 1 conversion" : visiteurs → signup → setup → 1er ticket résolu

**KPIs Sprint 1** :
- Time-to-value moyen < 10 min (vs estimé 30 min actuel)
- 2 nouvelles pages comparison live (eesel + Crisp)
- Calculateur live sur Pricing utilisé par > 30% des visiteurs Pricing
- 0 mention WhatsApp restante en pages marketing

---

### 🛠 Sprint 2 — J11 à J20 : Activation & dashboard

> Les utilisateurs s'inscrivent (sprint 1) — maintenant il faut qu'ils restent. ClientDashboard 1369 lignes avec 14 tabs = échec d'activation programmé. On simplifie + on densifie l'insight.

#### J11-J13 — Splitter ClientDashboard
- [ ] **Convertir ClientDashboard en sub-routes React Router** (Pablo, 8h)
  - Au lieu de `<ClientDashboard tabId="X">`, faire `/dashboard/overview`, `/dashboard/automation`, etc.
  - Chaque tab devient sa propre page lazy-loaded (`React.lazy`)
  - Bénéfices : URL deeplinkable par tab (utile pour partager un onboarding spécifique), réduction bundle initial, navigation ressentie plus rapide
  - Critère : `ClientDashboard.jsx` < 300 lignes, chaque tab dans son propre fichier

#### J13-J14 — Réorganiser les 14 tabs en 5 groupes mentaux
- [ ] **Refonte navigation latérale** (Pablo+Gaspard, 4h)
  - **🤖 Agent IA** : Automation ⭐, Email Agent, Voice Agent, Simulator, Guardrails, Knowledge
  - **📊 Activité** : Overview, Activity, Insights, Peak Hours, Escalations
  - **🔌 Configuration** : Integrations, Portal SAV, Agent Control
  - **⚙️ Compte** : Settings, Billing, Team, API Docs
  - **🎁 Programme** (badge nouveau) : Achievements, Referral, Marketplace
  - Critère : un nouveau utilisateur trouve "où ajouter une FAQ" en < 30 sec au test utilisateur (test sur 3 personnes hors équipe)

#### J15-J16 — Quick wins activation
- [ ] **Démo "voici ce que vous allez économiser" post-Shopify-OAuth** (Pablo, 6h)
  - Après OAuth Shopify, automatiquement traiter 3 tickets récents (qui existent dans Shopify) en mode shadow (pas envoyés)
  - Afficher en grand sur Overview : "Si nous avions été activés ce mois, nous aurions économisé X heures, soit Y€"
  - Critère : sur le client de test, l'estimation est cohérente vs leur volume réel
- [ ] **`Insights` tab : top 5 questions récurrentes → suggestions KB** (Pablo, 4h)
  - Actuellement Insights = graphes
  - Ajouter section "Vos clients posent souvent ces questions, vous devriez les ajouter à la KB" avec bouton 1-click ajout
  - Critère : sur compte avec 50+ tickets, suggestions affichées avec scoring

#### J17-J18 — Splitter les 3 plus gros components après dashboard
- [ ] **Splitter `ClientIntegrationsView.jsx` 1153 → < 300 par fichier** (Pablo, 4h)
  - 1 sous-composant par catégorie d'intégration (Shopify, Email, Helpdesk, Slack, Compta)
  - Critère : aucun fichier > 350 lignes
- [ ] **Splitter `GuardrailsEditor.jsx` 1029** (Pablo, 4h)
  - Idem, par catégorie de règles
- [ ] **Splitter `ClientEscalationsView.jsx` 1014** (Pablo, 4h)

#### J19-J20 — Polish UX
- [ ] **Audit responsive mobile dashboard** (Pablo, 6h)
  - Test sur viewports 375 / 414 / 768 sur les 5 tabs principaux
  - Fix : sidebar burger sur mobile, tables → cards, KPI grid 1-col
  - Critère : tous les flows critiques (signup, OAuth, voir un ticket, répondre) marchent sans scroll horizontal sur 375px
- [ ] **Loading states & skeletons** (Pablo, 3h)
  - Aujourd'hui beaucoup de tabs montrent "Chargement..." en texte brut
  - Implémenter `<SkeletonRow>` (existe déjà dans ui/) sur Overview, Activity, Escalations, Insights
  - Critère : aucun état "Chargement..." en text plain

**KPIs Sprint 2** :
- Activation D7 : % de signups qui résolvent ≥1 ticket en 7 jours, cible > 40%
- Bounce rate dashboard 1ère visite < 30%
- Aucun fichier composant > 400 lignes
- Tous les tabs critiques : mobile-friendly OK

---

### 🏗 Sprint 3 — J21 à J30 : Solidify & prep launch sustainable

> Les bases tiennent (sprint 1+2). On documente, teste, sécurise et on prépare la suite.

#### J21-J22 — Design system documenté
- [ ] **Créer page Notion `🎨 Design System Actero` sous Produit & Stack** (Pablo, 4h)
  - Inventaire des 51 composants `ui/` avec : nom, props, exemple visuel (screenshot), où c'est utilisé
  - Tokens couleur extraits de `tailwind.config.js` + variables CSS custom
  - Typographie : Instrument Serif + Inter + DM Mono (déjà identifié dans LandingPage)
  - Critère : Gaspard peut composer un nouveau email marketing en respectant la charte sans demander à Pablo

#### J23-J24 — Tests E2E critiques
- [ ] **Playwright tests E2E flows critiques** (Pablo, 8h)
  - Test 1 : signup → email verification → OAuth Shopify → setup wizard → 1er ticket résolu
  - Test 2 : Stripe checkout → upgrade Pro → entitlements bien provisionnés
  - Test 3 : escalation depuis email → review humaine → réponse envoyée
  - Test 4 : portail client final magic link → demande retour → confirmation
  - Lancer en CI sur Vercel preview à chaque PR
  - Critère : 4 tests verts en local + CI

#### J25-J26 — Splitter SupportGuide & Academy
- [ ] **Splitter `SupportGuidePage.jsx` 1272 lignes** en /docs multi-pages (Pablo, 6h)
  - Sommaire : Onboarding, Knowledge Base, Guardrails, Integrations, Portal SAV, Voice Agent, Billing, FAQ
  - 1 page par chapitre + index
  - Search Algolia ou simple `Ctrl+K` palette via fuzzy
  - Critère : `SupportGuidePage.jsx` retiré, remplacé par routing `/docs/*`
- [ ] **Audit Academy** (Pablo, 1h)
  - Vérifier ce qui est dedans (`api/academy` + `src/components/academy/` + 2 pages Academy)
  - Si vide → roadmap Q3 ou hide entry
  - Si populé → checker la qualité

#### J27-J28 — Fix TODOs critiques
- [ ] **Implémenter portal_tone exposé via API** (Pablo, 3h)
  - 4 TODO restants dans `usePortalTone.js`, `PortalLoginPage.jsx`, `PortalApp.jsx` autour de l'absence de portal_tone dans `/api/portal/resolve-client`
  - Étendre l'endpoint pour retourner `portal_tone`, sweeper les hardcoded `tu` restants
  - Critère : le portail SAV respecte le ton choisi par le merchant (tu/vous)
- [ ] **Fix n8n-copilot TODOs nodes invalides** (Pablo, 4h)
  - 2 TODOs sur la conversion de nodes n8n invalides dans `api/n8n-copilot.js:569,577`
  - Implémenter ou supprimer la feature
  - Critère : aucun TODO restant ou fonction implémentée et testée

#### J29-J30 — Préparer le launch + revoir
- [ ] **Préparer la réplique Zendesk Relate (21 mai déjà passé donc J29-J30 = ~31 mai)** (Gaspard+Pablo, 4h)
  - Si Zendesk a annoncé X nouveau le 21 mai, publier post LinkedIn + article blog 24h après
  - Mettre à jour `ZendeskVsActero.jsx` avec les nouveautés Zendesk
  - Critère : article publié + 1 carrousel LinkedIn live
- [ ] **Retro 30 jours** (Pablo+Gaspard, 2h)
  - Mettre à jour le cockpit Notion `👥 Clients & Pipeline > 📊 Sprint retro`
  - KPIs réels vs cibles
  - Décider du focus 30 jours suivants (sprint 4-6)
  - Critère : page de retro publiée dans Notion

**KPIs Sprint 3** :
- 4 tests E2E verts en CI
- Design system Notion live, utilisé par Gaspard pour 1 livrable
- 0 TODO/FIXME critique restant
- `SupportGuidePage` < 200 lignes (devient un sommaire)
- Article post-Zendesk-Relate publié dans les 48h

---

## 4. Backlog hors-scope (sprint 4+, à reprendre après J30)

Décidé hors scope V1 pour rester focus :

- **Programme partenaires lancé** — pour l'instant la page existe mais le pipeline réel commence à peine (1 partenaire en discussion dans le CRM Notion). Pas de quotas / commission tracking automatique avant qu'on ait 5+ partenaires actifs.
- **Marketplace de templates** — l'infra existe, l'usage non-prouvé. Décider de continuer ou archiver après 30 jours d'observation.
- **Academy** — pareil. Probablement à roadmap Q3 ou archiver.
- **Voice agent enterprise features** (multi-langue, voix custom) — Pro 200 min suffisent pour les 100 premiers clients.
- **PostHog LLM Analytics** — décidé hier de ne pas l'ajouter (Amplitude suffit, anti tool sprawl).
- **Multi-shop Enterprise** — feature gate existe mais 0 client Enterprise réel.
- **Probability auto par stage dans Notion CRM** — déjà noté dans la roadmap V2 du cockpit.
- **DB Notion `🎯 Competitors` structurée** — peut attendre, l'agent Theona produit déjà des rapports lisibles.

## 5. KPIs north-star à observer pendant 30 jours

| Métrique | Source | Cible J30 | Pourquoi |
|---|---|---|---|
| **Signups/jour** | Amplitude | 5+ | Sprint 1 doit tirer la demande |
| **Activation D7** | Amplitude funnel | >40% | Sprint 2 doit fixer l'onboarding |
| **Time-to-value moyen** | Amplitude | <10 min | Setup Wizard refondu |
| **Conversion Free→Pro M1** | Stripe + Supabase | >5% | Pricing calculator + démos |
| **MRR new** | Stripe | +1500€ | 5 clients Pro à 399€ - churn |
| **Churn M1** | Stripe + Amplitude | <10% | Onboarding solide = rétention |
| **Sentry errors prod** | Sentry | 0 nouveau cron alert phantom | Sprint 2/3 |
| **Pages marketing comparison** | Google Search Console | 12 → 14 (eesel + Crisp) + ranks T10 sur "alternative gorgias", "intercom alternative france" | Sprint 1 |

## 6. Comment on suit ce plan

- **Tableau Notion** : ce plan est dupliqué dans `🧭 Stratégie & Roadmap > 📅 Roadmap 30j — Mai 2026` avec checkboxes par ticket. Update au quotidien.
- **Stand-up async lundi 9h** : Pablo+Gaspard, 15 min en Slack, qu'avez-vous fait / qu'allez-vous faire / blockers
- **Retro fin de sprint (J10, J20, J30)** : 30 min, ce qui a marché / pas marché / décisions
- **Linear** : créer 1 epic par sprint, 1 ticket par checkbox du plan ci-dessus, assigné à Pablo ou Gaspard

---

## 7. Hors codebase — Risques externes à monitorer

- **Concurrent moves** : la veille Theona du lundi flag automatiquement les changements. Si une menace 🔴 émerge mid-sprint, on peut ré-arbitrer le plan.
- **Zendesk Relate 21 mai** : préparer la réplique avant.
- **Shopify Editions Summer 2026** : annoncées en juin habituellement — restez agile.
- **eesel SEO offensive** : surveiller les mots-clés ICP toutes les 2 semaines via Search Console + reformuler les pages comparison si on perd des positions.
