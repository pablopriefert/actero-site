# Design — 1er client payant en 72h (POC GTM)

**Date** : 2026-04-17
**Auteur** : Pablo + Claude
**Statut** : design validé, en attente de plan d'implémentation

## Objectif

Signer **1 client payant Actero sur le plan Pro** (ou Starter acceptable) dans les 72 heures suivant le lancement, en automatisant un maximum le marketing et en utilisant le budget réserve de 100–300€ uniquement en contingency.

**Critère de succès** : 1 `client` avec `stripe_subscription_active = true` (après la fin du trial 7j) attribué à cette campagne via `acquisition_source`.

## Contexte

- Actero est 100% self-serve (setup Shopify → agent actif en 15 min). Pas de démo personnelle.
- Trial Starter/Pro = 7 jours avec CB requise (prouve l'intent).
- Différenciateur unique vs Gorgias/Zendesk : white-label complet (portail custom domain + hide "Propulsé par Actero").
- Produit mature : empty state digne, SetupChecklist 7 étapes, Copilot, monitoring, portal self-service.
- Outils déjà payés : Apollo (sequences + search + enrichment), Clay (find-and-enrich, tech stack detection).

## ICP validé

**Marque Shopify FR en scaling** :
- 10–50 employés, CA 1–5M€
- Déjà un outil SAV en place (Gorgias, Zendesk, Freshdesk, Help Scout, Re:amaze) → pain admis + budget prouvé
- Verticaux prioritaires : mode/apparel, beauté/cosmétique, food, consumer goods
- Décideur visé : Founder/CEO/COO ET opérationnel : Head of CX/CS
- Contact en parallèle des deux personas pour doubler le taux de réponse

## Stratégie retenue — "Hybrid concierge"

Approche 3 validée parmi 3 explorées. Combinaison **ultra-qualification × personnalisation profonde × automation sur le follow-up**.

### Angle messaging unique

*« 100% votre marque, 0% tool tier »*

Déclinaisons possibles :
- "Vos clients savent quand c'est Gorgias qui répond ?"
- "Pas de Powered by Actero. Pas de support@actero.fr. Rien qui trahit."
- "On remplace Gorgias par un agent qui parle comme votre marque."

### Offre d'urgence

*"5 premiers clients payants : Pro à 199€/mois **à vie** (au lieu de 399€). Lock avant le [date J+3]."*

Mécanisme : coupon Stripe `POC_PRO_199` valable à vie, désactivé manuellement après la 5e activation.

## Architecture — qui fait quoi, quand

### Jour 0 (setup + sourcing) — 2–3h effort humain

1. **Auto (Claude MCPs)** :
   - Apollo `mixed_companies_search` → 200 comptes bruts (France, 11–50 employés, Shopify, verticaux cibles, pas series-B+)
   - Clay enrichment tech stack → filtre à ~80 comptes avec Gorgias/Zendesk/etc détecté
   - Scoring intent (hiring CX, funding récent, reviews négatives Trustpilot, Gorgias vs Zendesk) → top 50
   - Clay `find-and-enrich-contacts-at-company` → 2 contacts/compte (décideur + opérationnel)
   - Génération 50 messages personnalisés (email + LinkedIn DM) avec personalization hook basée sur enrichissement

2. **Humain (Pablo)** :
   - Revue 20 min de la liste finale
   - Setup Apollo Sequence (2 templates T1 + T2)
   - Création coupon Stripe `POC_PRO_199`
   - Audit rapide du pipeline signup → trial (voir section "Audit pipeline")

### Jour 1 (envoi multi-canal) — 2h effort humain

- **Auto (Apollo)** : envoi email T1 (~25/mailbox, continue J2)
- **Humain** : 20 LinkedIn DMs personnalisés (manuels, pas d'automation = 0 risque ban)
- **Humain (30 min)** : post Reddit `r/ShopifyFR` + post Slack e-com FR + post LinkedIn public (angle hook provocateur)
- **Humain** : réaction aux signups qui tombent en live (support immédiat si blocage OAuth ou setup)

### Jour 2 (relance + closing) — 2h effort humain

- **Auto (Apollo)** : envoi T2 aux non-répondants de T1 (objection handler)
- **Humain** : 30 LinkedIn DMs restants + relances perso aux "engaged silencieux" (opened/viewed mais pas clic)
- **Humain** : post LinkedIn J2 (angle résultat chiffré) + 2e post communauté
- **Humain** : support total aux trials actifs (chaque ticket bloquant débloqué en <1h)

### Jour 3 et suivants

- **Auto** : séquence email transactionnelle post-signup (J0 welcome, J+2 nudge, J+3 digest, J+6 conversion CTA)
- **Humain** : monitoring conversion trial → paid à J+7 sur les signups J1/J2
- **Humain** : post LinkedIn J3 (offre scarcity compteur de places restantes)

## Outils & budget

| Outil | Rôle | Coût |
|---|---|---|
| Apollo (abo existant) | Sourcing + enrichissement + sequences multi-canal | 0€ |
| Clay (abo existant) | Enrichment tech stack + contacts + intent signals | 0€ |
| LinkedIn perso | DMs + posts publics | 0€ |
| Loom | Vidéo démo 90s si demandée en objection | 0€ |
| Stripe coupon | POC_PRO_199 | 0€ |
| Reddit / Slack e-com FR | Posts communautaires | 0€ |

**Total lancement : 0€.** Les 100–300€ réservés restent disponibles pour le plan B (contingency).

## Sourcing — critères de filtrage

### Filtres Apollo (`mixed_companies_search`)

- `organization_locations` : France
- `organization_num_employees_ranges` : `11,20` + `21,50`
- `currently_using_any_of_technology_uids` : `shopify`, `shopify_plus`
- `organization_industry_tag_ids` : `retail`, `consumer goods`, `apparel & fashion`, `cosmetics`, `food & beverages`
- `organization_latest_funding_stage_cd` : `seed`, `series_a`, `bootstrapped`

### Filtre Clay (tech stack SAV)

Garder si détecté : Gorgias, Zendesk, Freshdesk, Help Scout, Re:amaze, Intercom.

### Scoring intent

| Signal | Points |
|---|---|
| Hiring CX/support (Clay job postings) | +2 |
| Funding < 6 mois | +2 |
| Reviews négatives Trustpilot SAV < 30j | +3 |
| Gorgias détecté (vs autres) | +1 |

Top 50 scoreurs → liste finale.

### Extraction contacts

Deux contacts par compte :
- Décideur : Founder / Co-Founder / CEO / COO
- Opérationnel : Head of Customer Experience / Head of Customer Success / Customer Service Manager / Head of Support

Email vérifié + LinkedIn URL + titre requis.

### Livrable sourcing

CSV structuré prêt pour Apollo Sequence :

```
company, domain, tech_stack_sav, intent_score,
contact1_name, contact1_title, contact1_email, contact1_linkedin,
contact2_name, contact2_title, contact2_email, contact2_linkedin,
personalization_hook
```

## Messaging — 5 templates

### Template A — Email Touche 1 (J+1)

```
Subject: {BrandName}, vos clients savent quand c'est Gorgias qui répond ?

Salut {FirstName},

{PersonalizationHook}

Le SAV de {BrandName} est propulsé par Gorgias aujourd'hui. Ça marche.
Mais y'a un truc dommage : vos clients reçoivent des réponses
formatées Gorgias. Sur le ton de voix, c'est pas à 100% {BrandName}.

On a construit Actero pour ça : un agent IA qui répond 24/7 à ~60% des tickets,
100% depuis votre domaine, avec votre ton, votre persona, votre portail client
à votre nom (pas de "Powered by Actero" si vous ne voulez pas).

Setup : 15 minutes, connexion Shopify native.
Essai gratuit 7 jours.

→ actero.fr/signup?ref=ae1

{CEOName}
CEO, Actero

PS : on lock le prix Pro à 199€/mois à vie pour les 5 premiers clients
qui rejoignent cette semaine (au lieu de 399€). Il en reste 5 ce matin.
```

### Template B — Email Touche 2 (J+3 aux non-répondants)

```
Subject: Re: {BrandName}, vos clients savent quand c'est Gorgias qui répond ?

{FirstName},

Je comprends que changer d'outil SAV n'est jamais la priorité N°1 —
y'a toujours un truc plus urgent.

Alors au lieu de vous demander de migrer, voilà une autre approche :
testez Actero 7 jours en parallèle de votre Gorgias, sans rien toucher.
On se branche sur un sous-ensemble de vos tickets (ou sur votre adresse
hello@ alternative), vous comparez les réponses sur 7 jours, vous décidez.

Setup : 15 min. Rien à migrer. Gratuit.

→ actero.fr/signup?ref=ae2

Si c'est nul, vous déconnectez. Si c'est bon, vous remplacez.

{CEOName}
```

### Template C — LinkedIn DM (400 caractères max)

```
Salut {FirstName},

{PersonalizationHookCourt}

Un truc rapide : j'ai construit Actero pour que vos emails SAV aient
exactement le ton de {BrandName} — pas celui de Gorgias.

Setup 15 min, essai 7j gratuit. Si ça match pas vous fermez.
→ actero.fr/signup?ref=li

(PS je lock Pro à 199€ à vie pour les 5 premiers cette semaine)
```

### Template D — LinkedIn Posts (3 posts, 1/jour)

Voir section 3 du brainstorming pour le contenu détaillé des 3 posts.
Résumé :
- J1 : hook provocateur ("Vos clients savent quand ils parlent à l'IA")
- J2 : résultat chiffré ("127 tickets traités automatiquement en 2 jours")
- J3 : offre scarcity ("Il reste 3 places sur 5")

### Template E — Posts communauté (Reddit + Slack)

Ton casual, pas pitch. Voir section 3. CTA : `actero.fr` ou `actero.fr/signup?ref=rd` ou `?ref=sl`.

## Pipeline de conversion — 9 étapes

```
Lead touché (email+LI)
  → 15% clic
  → actero.fr/signup?ref=*
  → 40% signup completed
  → 80% email validation
  → 70% Shopify OAuth
  → 50% config minimale
  → 60% CB saisie (trial)
  → 70% conversion trial → paid à J+7
= 1 client attendu sur ~50 leads
```

### Audit critique pré-lancement (30 min)

Avant J0, vérifier :

| Étape | Check | Fix si KO |
|---|---|---|
| `/signup` page | Existe et capte `?ref=*` | Créer ou fix |
| CTA "Essai gratuit" sur landing | Présent en haut + banner urgent | Ajouter |
| Shopify OAuth | Test sur store de dev | Fix avant lancement |
| Stripe Checkout Pro 7j trial | Test complet | — |
| Coupon `POC_PRO_199` | Créé côté Stripe | Créer manuellement |
| Welcome email transactionnel | Actero-branded envoyé | Créer si manque |
| UTM tracking (`acquisition_source`) | Event sur signup | Instrumenter |
| Notif Slack/email interne sur signup | Pour réactivité J1/J2 | Hook Stripe → Slack |

## Tracking — dashboard 3x/jour

Tableau Google Sheets/Notion :

| Lead | Company | Contact | T1 sent | LI DM | Opened | Viewed | Clicked | Signup | Shopify | Trial | CB | Status |

Statuts : `cold` → `engaged` → `clicked` → `signed_up` → `activated` → `trialing` → `paying` ou `lost`

## Seuils go/no-go

### Fin J1 (24h après T1)
- ✅ ≥5 clics → continuer
- ⚠️ 2–4 clics → booster LinkedIn + Reddit
- 🔴 0–1 clic → changer subject, intensifier LinkedIn DMs

### Fin J2 (48h)
- ✅ ≥1 signup activé (Shopify connecté) → support ultra-réactif pour conversion J+7
- ⚠️ 1–2 signups sans activation → DM immédiat pour débloquer
- 🔴 0 signup → activer budget 100–300€ sur Meta/LinkedIn Ads + élargir communautés

### J+7
- ✅ 1 client payant (subscription active) → POC réussi, scale la méthodo
- 🔴 0 client → post-mortem, diagnostiquer le bloqueur réel (prix ? produit ? pain ? copy ?)

## Relance tactique "engaged silencieux"

Pour chaque lead qui a `opened` ou `viewed` mais pas cliqué, DM LinkedIn manuel dans les 24h :

```
Salut {FirstName}, j'ai vu que tu as jeté un œil à mon email sur Actero —
des questions bloquantes ? Je peux répondre en 2 min si utile.
(Sans pitch, promis.)
```

Taux de réponse attendu : ~30% sur les engaged silencieux. C'est là qu'on gagne les deals serrés.

## Contingency plans

### Plan B — si J1 = zéro clic

1. Ouverture budget réserve (≤300€)
2. Meta Ads retargeting + interest targeting (founders Shopify FR)
3. LinkedIn Ads single-image ad (audience Head of CX + Founders FR e-commerce)
4. 50 DMs supplémentaires ciblés agences Shopify FR (référents potentiels)

### Plan C — si J2 = zéro signup

1. Baisse prix anchor : "Starter à 49€/mois à vie (6 premiers)"
2. Offre concierge gratuit en échange case study public
3. Activation réseau perso hors e-commerce (amis, ex-collègues, famille)

## Post-POC — si succès à J+7

1. Case study client en 48h (interview + chiffres avant/après)
2. Scale méthodo : 50 → 500 comptes/semaine
3. Automatiser la personnalisation via n8n workflow (Apollo → Clay → OpenAI → Apollo Sequence = 0 manuel)
4. Content flywheel : 1 post LinkedIn/jour sur les apprentissages POC
5. Partnership launch : 5 agences Shopify FR via Actero Partners

## Métriques long-terme

| Semaine | Cible |
|---|---|
| S1 | 1 client payant (ce POC) |
| S4 | 5 clients / ~1000€ MRR |
| S12 | 20 clients / ~5000€ MRR, 2 partenaires actifs |
| S24 | 50+ clients / 15k€ MRR, Academy lancé |

## Out of scope

- Ads Meta/LinkedIn en J0 : 3 jours trop court pour optimiser (relégué en contingency)
- Démo commerciale humaine : incompatible positionnement self-serve
- Cold calling : ICP FR peu réceptif, pas d'efficacité pour ce volume
- Whatsapp/SMS outreach : trop invasif, zero consentement
- Content marketing long-terme (SEO, podcasts) : hors horizon 72h
- Partnerships avec agences : hors horizon 72h (va en post-POC)

## Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Deliverability Apollo dégradée en cold pur | Clics < 2% | LinkedIn canal de fallback + domaine pro-warm |
| Shopify OAuth bug non détecté | Signup → -80% activation | Audit critique J0, test sur store dev |
| Prospect "intéressé mais pas maintenant" | Cycle dépasse 3 jours | Offre scarcity "5 premiers" force la décision |
| Concurrent répond avant (Gorgias AI) | Effet de surprise perdu | Angle différenciateur hide-branding reste unique |
| Zéro traction en 72h | 0 client | Plans B et C activables dès J1/J2 |

## Prochaines étapes

1. **Writing-plans** : écrire le plan d'implémentation détaillé avec tasks découpées, ordonnancement J0–J2, et handoffs humain/auto
2. **Audit pipeline** (30 min) : checker les 8 points avant lancement et lister les fix bloquants
3. **GO/NOGO décision** : après audit, confirmer la date de lancement (J0 = ?)
4. **Exécution** : lancer le sourcing Apollo live dès GO

---

**Document validé pour exécution.**
