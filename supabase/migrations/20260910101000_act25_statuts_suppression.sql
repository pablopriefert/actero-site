-- ACT-25 — deux statuts que le code écrivait déjà, et que la contrainte refusait.
--
-- Elle n'autorisait que inactive / active / canceled / past_due.
--
-- 1. `redacted` — api/shopify/webhooks/shop/redact.js marque le client ainsi
--    après un effacement Shopify. L'update échouait donc sur la contrainte, et
--    le code ne fait qu'un console.warn : l'échec était invisible. Aucun client
--    n'a jamais porté ce statut. Trouvé le 10 septembre 2026 en butant sur la
--    même contrainte pour une autre raison.
--
-- 2. `pending_deletion` — le délai de grâce avant purge définitive.

alter table public.clients drop constraint if exists clients_status_check;

alter table public.clients add constraint clients_status_check
  check (status = any (array[
    'inactive'::text,
    'active'::text,
    'canceled'::text,
    'past_due'::text,
    'redacted'::text,          -- effacement Shopify (shop/redact)
    'pending_deletion'::text   -- demande RGPD, purge après délai de grâce
  ]));
