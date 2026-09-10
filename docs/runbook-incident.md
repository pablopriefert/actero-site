# Runbook incident — que faire quand ça casse

Document interne. Écrit pour que **Gaspard puisse gérer un incident de niveau 1 sans Pablo**.

Chaque procédure ci-dessous a été vérifiée dans le code le 9 septembre 2026. Quand une garantie n'existe pas, c'est écrit — un runbook qui promet ce qui n'existe pas est pire qu'un runbook absent.

---

## D'abord : comment on apprend qu'il y a un problème

| Canal | Ce qu'il détecte | Fiabilité |
|---|---|---|
| **Sentry** | cron en échec, erreur non rattrapée | garantie — c'est le chemin de référence |
| **Webhook ops** (`OPS_ALERT_WEBHOOK_URL`) | mêmes pannes, plus vite | **non vérifiée** — si la variable n'est pas définie, l'alerte part dans le vide, en silence |
| **Alerte marchand** | son quota à 80 % et 100 % | email garanti + canaux choisis |
| **Moniteur de silence** | un marchand qui recevait des messages n'en reçoit plus depuis 24 h (`ENGINE_SILENCE_HOURS`) | une alerte par incident, par email Resend à `OPS_ALERT_EMAIL` — Sentry reste le filet garanti |
| **Le marchand lui-même** | tout le reste | c'est aujourd'hui le canal le plus probable |

> Jusqu'au 10 septembre 2026, le moniteur de silence envoyait son alerte par le webhook ops — le canal marqué « non vérifiée » juste au-dessus, mort depuis la réinstallation de l'app. Corrigé (ACT-21) : l'alerte part maintenant par email via Resend, à l'adresse `OPS_ALERT_EMAIL` (plusieurs adresses possibles, séparées par des virgules). Sans cette variable, l'envoi est ignoré avec un avertissement dans les logs — pas d'échec silencieux — et `captureError` vers Sentry reste le chemin garanti. Une panne Resend ne casse pas le healthcheck lui-même.

> **À faire avant de compter dessus** : provoquer une panne volontaire et **prouver** qu'une alerte arrive. Tant que ce test n'a pas été fait, ce tableau décrit une intention. C'est la leçon des trois workflows d'alerte n8n qui affichaient `NEVER RAN` — ils étaient configurés, ils n'avaient jamais tourné.

---

## 1. L'agent répond n'importe quoi

**Objectif : l'arrêter en moins de deux minutes.** Le reste attend.

### Couper

Il y a **deux interrupteurs, un par canal**. Couper un seul laisse l'agent répondre sur l'autre.

**Bulle de chat sur le site du marchand**
Dashboard → **Automatisations** → désactiver l'agent pour ce client.
Effet immédiat côté serveur : la bulle répond « notre assistant est momentanément indisponible, un membre de notre équipe vous répondra ».

**Email**
Dashboard → **Agent email** → désactiver.
Les emails continuent d'arriver, ils ne reçoivent simplement plus de réponse automatique.

En base, si le dashboard est inaccessible :

```sql
update public.client_settings
   set agent_enabled = false, email_agent_enabled = false
 where client_id = '<uuid du client>';
```

> Jusqu'au 9 septembre 2026, l'interrupteur de la bulle **ne coupait rien** : il n'était lu que par le navigateur, et l'API continuait de répondre. Corrigé. Si tu lis ce runbook après une longue interruption de maintenance, revérifie que c'est toujours vrai avant de t'y fier.

### Ensuite seulement

1. Récupérer les échanges fautifs : dashboard → **Conversations**, filtrer sur le client.
2. Regarder la raison de la décision dans `engine_runs_v2` (`status`, `classification`, `confidence`).
3. Si l'agent a **inventé** quelque chose — un numéro de suivi, une commande, une promesse commerciale — c'est le cas le plus grave. Prévenir Pablo, ne pas rallumer.
4. Si l'agent a seulement mal répondu, remonter le seuil de confiance de ce client avant de rallumer :

```sql
update public.engine_client_playbooks
   set custom_config = jsonb_set(coalesce(custom_config,'{}'::jsonb), '{confidence_threshold}', '0.9')
 where client_id = '<uuid>';
```

Le seuil par défaut est **0,75**. À 0,9, l'agent ne répond seul que s'il est presque certain, et le reste part en revue humaine.

---

## 2. L'API Shopify d'un client tombe

### Ce qui se passe réellement

`lookupOrder` **ne lève jamais d'exception**. Toutes ses voies d'échec — pas de connexion, requête refusée, réponse non-OK, zéro résultat — renvoient `null`.

L'agent commande reçoit donc « aucune commande trouvée » et, conformément à son prompt, **demande poliment son numéro de commande au client**. Il n'invente rien et ne plante pas.

### La limite qu'il faut connaître

**Le système ne distingue pas « Shopify est en panne » de « la commande n'existe pas ».** Les deux donnent `null`.

Pendant une panne Shopify, l'agent demande donc son numéro au client, le client le donne, et ça échoue encore. Poliment, en boucle.

### Que faire

1. Vérifier que c'est bien Shopify : [status.shopify.com](https://status.shopify.com).
2. Si c'est une panne Shopify générale : **ne rien couper**. L'agent dégrade proprement, il répond au reste, et il redeviendra utile tout seul.
3. Si un seul marchand est touché, son jeton est probablement mort — révoqué, app désinstallée, ou droits changés :

```sql
select shop_domain, scopes, updated_at
  from public.client_shopify_connections
 where client_id = '<uuid>';
```

Un jeton mort se répare en **réinstallant l'app** côté marchand. Ça ne se répare pas de notre côté.

4. Prévenir le marchand : son agent répond, mais sans accès à ses commandes.

---

## 3. Le quota explose

**Attention, il y a deux quotas différents, et on les confond facilement.**

### A. Le quota de tickets du marchand

Automatique et bien couvert. À **80 %** un avertissement part, à **100 %** l'agent se met en pause plutôt que de dépasser silencieusement.

Livraison : les canaux que le marchand a choisis, **plus un email garanti** — un blocage de quota coûte trop cher pour dépendre d'une préférence. Une seule alerte par seuil, garantie par une écriture conditionnelle sur `usage_counters`.

Rien à faire en urgence : le marchand est prévenu, il achète des crédits ou change de plan. Vérifier où il en est :

```sql
select c.brand_name, u.tickets_used, u.period
  from public.usage_counters u
  join public.clients c on c.id = u.client_id
 order by u.tickets_used desc;
```

### B. Le crédit LLM d'Actero — le nôtre

**C'est le trou.** Si le crédit OpenRouter s'épuise, le fournisseur renvoie 402, le healthcheck échoue et alerte. Donc on est prévenu **quand tout est déjà cassé**.

Il n'existe **aucune alerte de dépense** — rien qui dise « on brûle plus vite que prévu » avant la panne. Le coût par ticket est mesuré (0,012 €) mais personne ne surveille le cumul.

En attendant, à faire à la main : regarder le solde OpenRouter une fois par semaine.

---

## 4. Qui appelle le client, et sous quel délai

### Ce que le système fait tout seul

Quand un message est escaladé, trois choses partent : un **ticket d'escalade**, une **notification au marchand** sur ses canaux, et un **webhook sortant** pour les plans Pro et supérieurs.

Le marchand voit ses escalades sur `actero.fr/client/escalations`.

### Ce que le système ne fait pas

**Il n'appelle personne.** Il n'y a pas de délai de réponse contractuel, pas de rotation d'astreinte, pas de règle écrite disant sous combien de temps un humain reprend la main.

> **Décision à prendre par Pablo, elle n'est pas dans le code.** Sous combien de temps s'engage-t-on à traiter une escalade ? Qui, en dehors des heures ouvrées ? Et que dit-on au marchand quand on n'a pas tenu ?
>
> Tant que ce n'est pas décidé, ce runbook ne peut pas répondre à la question du ticket ACT-13.

### En attendant, la règle de bon sens

| Situation | Délai visé |
|---|---|
| L'agent a inventé une information | tout de suite — couper d'abord, expliquer ensuite |
| Client en colère escaladé | dans l'heure ouvrée |
| Escalade ordinaire | même jour ouvré |
| Question de configuration | 24 h |

---

## Ce que ce runbook ne couvre pas

- **Aucune restauration de base n'a jamais été testée.** Les sauvegardes existent, huit quotidiennes vérifiées, mais personne n'a jamais restauré. On ne sait donc pas combien de temps ça prend (ACT-14).
- **Aucun environnement de test** séparé de la production (ACT-15).
- **L'alerting n'a jamais été prouvé de bout en bout** (ACT-21). L'alerte du moniteur de silence passe désormais par Resend, le canal déjà éprouvé par les emails de bienvenue et les rapports mensuels — mais le test de bout en bout (panne volontaire, alerte reçue) reste à faire.
- **Aucune procédure de suppression de compte client** (ACT-25).

Ces quatre trous sont connus et suivis. Les écrire ici évite qu'on les découvre pendant un incident.
