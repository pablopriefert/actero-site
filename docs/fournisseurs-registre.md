# Registre des fournisseurs et de leurs échéances

Document interne. Objectif : qu'aucun renouvellement, aucune fin de crédits et aucun dépassement ne soit découvert **par la carte bancaire**.

Relevé le 9 septembre 2026 en lisant le code et les APIs. Les colonnes marquées **À REMPLIR** ne sont pas dans le dépôt : elles vivent dans tes comptes et dans les conditions des programmes. Personne d'autre que toi ne peut les renseigner.

---

## Ce qui est établi

| Fournisseur | Rôle | État vérifié | Renouvellement | Fin des crédits |
|---|---|---|---|---|
| **Vercel** | hébergement, 12 crons, fonctions | équipe `actero1`, plan **Pro** | À REMPLIR | À REMPLIR — *crédits programme startup* |
| **Supabase** | base, auth, stockage | org `Actero`, plan **Pro** | À REMPLIR | À REMPLIR — *perk Station F, obtenu le 9 sept.* |
| **OpenRouter** | fournisseur LLM par défaut (Sonnet 5) | actif, `LLM_PROVIDER=openrouter` | à l'usage | prépayé — **solde à surveiller** |
| **Resend** | tous les emails sortants | actif | À REMPLIR | à l'usage |
| **Shopify Partners** | l'app, en cours d'examen | actif | gratuit | — |

---

## Les dépendances à l'usage, par ordre de surprise possible

Une clé configurée est une facture qui peut démarrer. Relevé du nombre de fichiers qui l'utilisent — c'est un indicateur d'exposition, pas de coût.

| Service | Fichiers | Ce qui casse si ça s'arrête | Ce qui se passe si ça dérape |
|---|---|---|---|
| **Resend** | 29 | **tout l'email sortant** — réponses clients, alertes, rapports | plafond de plan atteint en silence |
| **Anthropic** | 11 | voir l'avertissement ci-dessous | facturé en parallèle d'OpenRouter |
| **Gemini** | 6 | analyse d'images des tickets | à l'usage |
| **ElevenLabs** | 6 | agent vocal | **le plus cher à la minute** |
| **E2B** | 5 | bacs à sable des politiques, onboarding | facturé à la seconde |
| **OpenAI** | 4 | repli LLM, embeddings | à l'usage |
| **OpenRouter** | 3 | **le moteur SAV entier** | prépayé — s'arrête net à zéro |
| **Tavily** | 1 | extraction de la base de connaissances | à l'usage |
| **SerpAPI** | 1 | collecte d'avis | à l'usage |
| **Braintrust** | 1 | traces LLM | à l'usage |
| **Amplitude** | 1 | analytics produit | palier gratuit |
| **Twilio** | — | SMS / voix | à l'usage |
| **Stripe** | — | facturation des marchands | commission |

---

## Trois avertissements qui valent plus que le tableau

### 1. La bascule vers OpenRouter n'a couvert que le moteur SAV

`llm-client.js` route bien par `LLM_PROVIDER` (défaut `openrouter`, Anthropic en **repli** seulement). Mais **dix autres points d'appel** lisent `ANTHROPIC_API_KEY` directement, sans passer par cette abstraction :

```
client-copilot.js          admin/ai-terminal.js
knowledge/import-url.js    lib/llm.js
lib/kpi-tools.js           lib/proactive-action.js
jobs/kb-deep-crawl.js      engine/copilot-drafts.js
engine/lib/embeddings.js   cron/agent-healthcheck.js
```

Ce n'est donc pas un double paiement pour le même travail — c'est une bascule **partielle**. Le copilote, le crawler de base de connaissances, les outils KPI, le moteur proactif et les brouillons continuent d'être facturés par Anthropic.

Conséquence directe : l'« économie marginale » notée dans le rapport hebdomadaire est encore plus marginale qu'annoncé, puisque la majorité des appels LLM n'a jamais migré.

**À faire** : ouvrir la console Anthropic, comparer la consommation avant et après le 8 septembre. Si elle n'a pas baissé, c'est que ces dix appels dominent — et il faut décider si on les migre ou si on assume deux fournisseurs.

### 2. Le crédit LLM d'Actero n'a aucune alerte

Si le solde OpenRouter tombe à zéro, le fournisseur renvoie 402, le healthcheck échoue, et on l'apprend **quand le SAV est déjà mort**.

Il n'existe **aucune alerte de dépense** — rien qui prévienne avant. Le coût par ticket est mesuré (0,012 €), personne ne surveille le cumul.

**En attendant** : regarder le solde une fois par semaine. C'est le seul poste qui peut arrêter le produit du jour au lendemain.

### 3. Les crédits ne meurent pas bruyamment

Vercel Pro et Supabase Pro tournent aujourd'hui sur des crédits de programme. Le jour où ils expirent, **rien ne casse** : la facturation réelle commence, simplement. On l'apprend au prélèvement.

C'est précisément le risque qui a motivé ce ticket, et c'est celui que le tableau ne peut pas couvrir tant que les deux dates sont vides.

---

## Les deux rappels par ligne

Pour chaque échéance renseignée, poser **deux** rappels dans ton agenda :

- **un mois avant** — pour décider : on paie, on migre, ou on redemande le perk ;
- **une semaine avant** — parce qu'un mois avant, on repousse.

Un seul rappel se rate. Deux, beaucoup moins.

---

## Ce qui manque à ce registre

Les dates. C'est l'essentiel du ticket, et je ne peux pas les établir : elles sont dans la console Vercel (facturation → crédits), dans les conditions du perk Station F pour Supabase, et dans les emails de confirmation des programmes.

Tant qu'elles sont vides, ce document est un **inventaire**, pas un registre d'échéances.
