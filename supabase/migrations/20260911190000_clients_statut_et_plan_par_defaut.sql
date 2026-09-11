-- Le défaut d'une colonne décide plus sûrement que cinq appelants.
--
-- CONSTATÉ LE 11 SEPTEMBRE 2026, par un audit multi-agents puis vérifié en
-- production.
--
-- 1. `clients.status` avait pour défaut 'inactive', NOT NULL. Or
--    `api/engine/webhooks/widget.js` refuse tout client dont le statut n'est
--    pas 'active' : la bulle s'affiche, le visiteur écrit, et chaque message
--    part en 403. Le marchand voit un chat mort sans une erreur pour lui dire
--    pourquoi.
--
--    Trois chemins de création sur cinq n'écrivaient pas `status` :
--      src/lib/resolve-client.js      (inscription Google — créé côté client)
--      api/shopify/callback.js        (installation App Store)
--      api/stripe-webhook.js          (tunnel de vente)
--    Les deux autres (auth/signup.js, auth/verify-code.js) l'écrivaient.
--
--    Trois comptes étaient déjà dans cet état en base. Corriger les cinq
--    appelants serait revenu à parier sur la mémoire du sixième.
--
-- 2. `clients.plan` n'avait AUCUN défaut. `plan-limits.js` retombe sur `free`
--    pour une valeur inconnue, donc un marchand du tunnel à 800 €/mois était
--    traité comme un compte gratuit partout.
--
-- 3. La contrainte CHECK n'autorisait pas 'uninstalled' — alors que
--    `api/shopify/webhooks/app/uninstalled.js:93` l'écrit, et que le
--    commentaire de la colonne le documentait comme une valeur connue.
--    L'écriture échouait donc à chaque désinstallation. L'erreur était avalée
--    par un `console.warn`, le webhook répondait 200, et le statut restait
--    'active' avec `uninstalled_at` jamais renseigné.
--
-- 4. Le commentaire de la colonne affirmait « NULL = active (default) ».
--    C'était faux sur les deux points : la colonne est NOT NULL, et le défaut
--    valait 'inactive'. C'est très probablement cette phrase qui a fait écrire
--    la garde du widget.
--
-- CE QUE 'inactive' VEUT DIRE MAINTENANT
--
-- Une seule chose : un abonnement payant terminé. C'est le seul endroit qui
-- l'écrit volontairement (api/lib/subscription-plan.js:31, sur un statut
-- Stripe canceled / unpaid / incomplete_expired). Avant cette migration le mot
-- signifiait AUSSI « jamais activé », et les deux étaient indiscernables.

alter table public.clients alter column status set default 'active';
alter table public.clients alter column plan   set default 'free';

alter table public.clients drop constraint clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status = any (array[
    'active',            -- le cas normal
    'inactive',          -- abonnement payant terminé (subscription-plan.js)
    'canceled',
    'past_due',
    'uninstalled',       -- app Shopify retirée, données encore présentes
    'redacted',          -- shop/redact traité, données effacées, ligne gardée
    'pending_deletion'
  ]));

comment on column public.clients.status is
  'Cycle de vie du compte. Défaut ''active''. ''inactive'' = abonnement payant '
  'terminé (api/lib/subscription-plan.js), et RIEN d''autre — c''était aussi la '
  'valeur par défaut avant le 11 septembre 2026, ce qui rendait les deux sens '
  'indiscernables. ''uninstalled'' = app Shopify retirée, données encore '
  'présentes en attente de shop/redact. ''redacted'' = shop/redact traité, '
  'données effacées, ligne conservée pour l''intégrité référentielle. '
  'api/engine/webhooks/widget.js refuse tout statut autre qu''''active''.';

comment on column public.clients.plan is
  'Formule du marchand. Défaut ''free''. Sans défaut, trois chemins de création '
  'laissaient NULL, et api/lib/plan-limits.js retombait silencieusement sur les '
  'limites du plan gratuit — y compris pour un marchand facturé 800 €/mois.';

-- Réparation des lignes nées avec le mauvais défaut : celles qui n'ont JAMAIS
-- eu d'abonnement Stripe. Une ligne portant un stripe_subscription_id peut
-- légitimement être 'inactive' (abonnement terminé) — on n'y touche pas.
update public.clients
   set status = 'active'
 where status = 'inactive'
   and stripe_subscription_id is null
   and stripe_customer_id is null;
