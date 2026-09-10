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

### 3. Supprimer

Depuis l'interface admin (action « delete_client », confirmation requise), ou
directement :

```sql
select * from public.delete_client_data('<ID>');
```

La fonction renvoie le décompte par étape. Elle s'exécute dans une seule
transaction : si quelque chose échoue, **rien** n'est supprimé — pas de
suppression à moitié faite.

### 4. Vérifier

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

### 5. Répondre au demandeur

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
