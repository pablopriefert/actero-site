# Supprimer un compte client — procédure

> ACT-25. Un marchand écrit à `contact@actero.fr` pour demander l'effacement de
> ses données. Le RGPD laisse **un mois** pour répondre. Voici quoi faire.

## Avant : ce qu'il ne faut pas faire

Ne pas supprimer la ligne `clients` à la main. **Ça ne marche pas.**

Huit clés étrangères pointent vers `clients.id` en `NO ACTION` et bloquent la
suppression. Vérifié le 10 septembre 2026 sur la base de production, par une
suppression tentée dans un bloc qui s'annule : les deux clients ayant réellement
connecté une boutique Shopify sont **bloqués** par
`client_shopify_connections_client_id_fkey`. Les seuls qui passaient étaient
ceux sans boutique — le compte interne, celui de Pablo, et le client de démo.

Le chemin échouait donc exactement dans le seul cas qui compte : un vrai
marchand.

## La procédure

### 1. Identifier le client

```sql
select id, brand_name, contact_email, plan, status, created_at
  from clients
 where contact_email ilike '%@domaine-du-demandeur%'
    or brand_name ilike '%nom%';
```

Vérifier que c'est bien la bonne ligne **avant** de continuer : la suppression
n'est pas réversible et il n'y a pas de sauvegarde restaurable tant qu'ACT-14
n'est pas fait.

### 2. Prévisualiser ce qui va partir

```sql
select 'engine_messages' as tbl, count(*) from engine_messages where client_id = '<ID>'
union all select 'escalation_tickets', count(*) from escalation_tickets where client_id = '<ID>'
union all select 'client_knowledge_base', count(*) from client_knowledge_base where client_id = '<ID>'
union all select 'client_integrations', count(*) from client_integrations where client_id = '<ID>'
union all select 'customer_memories', count(*) from customer_memories where client_id = '<ID>';
```

### 3. Demander l'effacement — en deux temps

L'action admin **ne détruit pas tout de suite**. Elle marque le client, coupe
son agent, et laisse un **délai de grâce de 14 jours** avant la purge.

Pourquoi : la destruction est irréversible et aucune sauvegarde restaurable
n'existe encore (ACT-14). Une demande envoyée par erreur, ou un clic de trop
dans l'admin, doit pouvoir être rattrapée.

L'agent est coupé **immédiatement** — le marchand a demandé à partir, il ne
doit pas découvrir que ses clients reçoivent encore des réponses. Mais les
accès fournisseurs ne sont **pas** révoqués à ce moment-là : il faudrait tout
reconnecter en cas d'annulation, et un délai de grâce annulable seulement sur
le papier n'en est pas un.

| | |
| -- | -- |
| Annuler pendant le délai | action `cancel_delete_client` — remet l'agent en marche |
| Forcer la destruction immédiate | `immediate: true` — à réserver aux demandes urgentes |
| La purge automatique | cron `purge-deleted-clients`, tous les jours à 4 h |

Le délai se règle avec `DELAI_GRACE_SUPPRESSION_JOURS`.

### 4. La purge — la révocation part automatiquement d'abord

L'action admin **révoque les accès chez les fournisseurs avant** d'effacer.
C'est l'ordre qui compte : une fois la ligne supprimée, on n'a plus les jetons
pour le faire.

Supprimer notre copie d'un secret nous empêche de nous en servir, mais
n'annule pas l'autorisation côté fournisseur — le marchand continuerait de
voir Actero dans ses applications connectées.

| Fournisseur | Ce qui se passe |
| --- | --- |
| **Shopify** | Mutation `appUninstall` : l'app se désinstalle elle-même et le jeton est invalidé |
| **Slack** | `auth.revoke` |
| **Zendesk** | Suppression du jeton OAuth courant |
| **Notion** | Aucune API — le marchand doit retirer Actero dans Paramètres → Mes connexions |
| **Resend** | La clé est dans SON compte — il doit la supprimer dans Resend → API Keys |
| **SMTP / IMAP** | Nous détenions son mot de passe : il doit le **changer**, pas seulement le retirer |

La réponse contient `a_finir_a_la_main` : tout ce qui n'a pas pu être révoqué,
avec la marche à suivre. **Un échec de révocation ne bloque pas l'effacement** —
le RGPD impose de supprimer, un fournisseur injoignable n'est pas une excuse.
C'est justement pour ça qu'il faut lire cette liste.



Depuis l'interface admin (action « delete_client », confirmation requise), ou
directement :

```sql
select * from public.delete_client_data('<ID>');
```

La fonction renvoie le décompte par étape. Elle s'exécute dans une seule
transaction : si quelque chose échoue, **rien** n'est supprimé — pas de
suppression à moitié faite.

### 5. Vérifier

```sql
-- Doit renvoyer 0 partout.
do $$
declare r record; c bigint;
begin
  for r in select table_name, column_name from information_schema.columns
            where table_schema='public' and column_name in ('client_id','onboarded_client_id')
  loop
    execute format('select count(*) from public.%I where %I = %L', r.table_name, r.column_name, '<ID>') into c;
    if c > 0 then raise notice 'RESTE % dans %', c, r.table_name; end if;
  end loop;
end $$;
```

### 6. Répondre au demandeur

Confirmer par écrit que l'effacement est fait, en indiquant la date. La preuve
vit dans `admin_action_logs` : la procédure **détache** ces lignes au lieu de
les supprimer, précisément pour qu'il reste une trace de la demande et de la
réponse.

## Ce qui est supprimé, ce qui est conservé

Le partage n'est pas technique, il est juridique : on efface la donnée
personnelle, on conserve ce qui fait foi en coupant le lien.

| Conservé, lien coupé | Pourquoi |
| --- | --- |
| `admin_action_logs` | La preuve qu'on a répondu à la demande |
| `deployment_requests` | Historique opérationnel, anonyme une fois détaché |
| `funnel_clients` | Analytique d'acquisition agrégée |
| `clients.referred_by_client_id` | Un autre client peut avoir été parrainé |
| 6 tables en `SET NULL` | Commissions ambassadeurs et partenaires, journal RGPD Shopify — comptabilité |

| Supprimé | Pourquoi |
| --- | --- |
| `client_shopify_connections` | **Contient le jeton d'accès à la boutique** |
| `escalation_tickets` | Emails et messages des clients DU marchand |
| `call_notes` | Colonne `client_id` NOT NULL — impossible à détacher |
| `deployments` | Colonne `client_id` NOT NULL |
| **57 tables en cascade** | Credentials, base de connaissances, mémoires clients, photos analysées, conversations, métriques… |

## Si la fonction refuse de démarrer

Elle affiche :

> `delete_client_data : table(s) non traitée(s) avec une clé étrangère NO ACTION vers clients.id : <nom>`

C'est volontaire. Une nouvelle table avec ce type de clé casserait la
suppression **au milieu** si on la laissait faire — sur une erreur de contrainte
illisible. La fonction préfère refuser en nommant la table.

Que faire : décider si cette table doit être **détachée** (elle fait foi, sa
colonne est nullable) ou **supprimée** (donnée personnelle, ou colonne NOT
NULL), ajouter l'étape dans `delete_client_data`, ajouter le nom dans
`v_connus`, et mettre à jour les deux tableaux ci-dessus.

## Le cas Shopify est différent

Quand un marchand désinstalle l'app, Shopify envoie `shop/redact` ~48 h après.
Ce webhook fait un effacement **plus étroit et volontairement conservateur** :
il supprime les messages, événements, appels et la connexion Shopify, puis
marque le client `status = 'redacted'` sans supprimer sa ligne — pour préserver
les liens de facturation.

Les deux procédures ne se remplacent pas : `shop/redact` répond à l'obligation
Shopify, `delete_client_data` répond à une demande d'effacement RGPD complète.
