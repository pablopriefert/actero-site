# Cadence des crons — pourquoi chacune est ce qu'elle est

> ACT-23. Ce fichier existe pour que la question ne se repose pas dans trois
> mois, et surtout pour qu'un cron ralenti parce que le système était vide ne
> le reste pas quand les clients arrivent.
>
> `api/lib/crons-cadences.test.js` échoue si `vercel.json` et ce tableau
> divergent. Changer une cadence sans écrire pourquoi casse la CI.

## Ce que la mesure a montré (9 septembre 2026)

Relevé Vercel sur 24 h, confirmé par les compteurs théoriques : **1 779
invocations par jour, soit 53 370 par mois** pour deux clients réels.

Le plan Vercel Pro inclut 1 million d'invocations par mois. 53 370 en
représentaient **5 %** : le coût n'était pas le problème, et il ne l'est
toujours pas. La raison de ranger, c'est le signal — quatre crons tournaient
sur exactement zéro travail, et 14 400 invocations mensuelles qui ne font
jamais rien noient dans le bruit la seule qui échouerait vraiment.

| Cron | Travail réel mesuré en base |
| --- | --- |
| `poll-inbound-emails` | 1 client avec l'agent email activé |
| `process-abandoned-carts` | **0 client** avec le playbook `abandoned_cart` actif |
| `process-e2b-jobs` | **1 ligne** dans `e2b_jobs` depuis la création de la table |
| `slack-canvas-update` | **0 client** avec `slack_ops_enabled` |
| `proactive-watchdog` | **0 événement** dans `proactive_events`, jamais |
| `process-comptabilite` | **0 client** avec le playbook `comptabilite_auto` actif |

## Les cadences, et à quelle condition les remettre

| Cron | Cadence | Pourquoi | Quand l'accélérer |
| --- | --- | --- | --- |
| `agent-healthcheck` | `*/5 * * * *` | Détecte une dépréciation de modèle ou une panne de fournisseur avant les clients. C'est le seul cron dont le retard se paie en tickets sans réponse. | Jamais à ralentir. |
| `poll-inbound-emails` | `*/5 * * * *` | Était à `*/2` pour **un** client. Cinq minutes de latence sur une réponse email sont invisibles pour un client qui attend déjà des heures ailleurs. Le plus gros poste : 21 600 → 8 640. | Repasser à `*/2` si un marchand vend une réponse email en moins de 5 minutes. |
| `process-abandoned-carts` | `*/5 * * * *` | **Volontairement non ralenti** malgré 0 playbook actif. Le jour où un marchand l'active, la cadence pèse directement sur le chiffre récupéré, et personne ne se souviendra de la remettre. 8 640 invocations, c'est 0,86 % de l'enveloppe : le risque commercial coûte plus cher que l'économie. | — |
| `process-e2b-jobs` | `*/5 * * * *` | **Volontairement non ralenti** malgré une seule ligne depuis toujours. Un marchand qui lance un crawl profond attend que le job démarre : la cadence est sa latence perçue. | — |
| `proactive-watchdog` | `*/30 * * * *` | Zéro événement produit depuis toujours, faute de commandes à surveiller. Les signaux qu'il cherche — colis bloqué, paiement échoué, client VIP silencieux — se mesurent en heures, pas en minutes. 2 880 → 1 440. | Repasser à `*/15` dès que `proactive_events` reçoit des lignes. Le cron le signale lui-même (voir ci-dessous). |
| `slack-canvas-update` | `0 * * * *` | Zéro client avec `slack_ops_enabled`. Un canvas rafraîchi à l'heure reste un canvas à jour. 2 880 → 720. | Repasser à `*/15` si un marchand suit ses opérations en direct dans Slack. |
| `process-comptabilite` | `0 8 * * *` | Zéro client, mais 30 invocations par mois : ralentir ne rapporterait rien. | — |
| `purge-vision-images` | `0 3 * * *` | Purge RGPD, quotidienne par nature. | — |
| `purge-deleted-clients` | `0 4 * * *` | Second temps de la suppression de compte (ACT-25) : efface les clients dont le délai de grâce est écoulé. Quotidien, parce qu'un jour de retard sur un effacement RGPD se défend, une semaine non. | — |
| `slack-daily-digest` | `30 7 * * 1-5` | Avant l'arrivée au bureau. | — |
| `improvement-loop` | `0 6 * * 1` | Hebdomadaire par conception. | — |
| `churn-predictions` | `0 6 * * 0` | Hebdomadaire par conception. | — |
| `monthly-report` | `0 8 1 * *` | Mensuel par conception. | — |

**Total : 36 900 invocations par mois**, contre 53 370 avant. Soit 3,7 % de
l'enveloppe Pro.

## Le piège que ce fichier essaie d'éviter

Un cron ralenti parce que le système était vide devient un défaut silencieux
le jour où il ne l'est plus. Rien ne le signale : le cron tourne, ne renvoie
pas d'erreur, et fait simplement son travail trop tard.

Deux garde-fous :

1. **Les deux crons dont la latence est visible par un client n'ont pas été
   ralentis**, même s'ils tournent aujourd'hui sur zéro travail. L'économie ne
   valait pas le risque.
2. **`proactive-watchdog` s'annonce lui-même** : dès qu'il produit un
   événement alors qu'il tourne à la cadence prévue pour un système vide, il
   écrit une erreur dans les logs Vercel qui renvoie ici.

C'est la même leçon que le reste de la semaine : un contrôle qui a l'air
présent est plus dangereux qu'un contrôle absent.
