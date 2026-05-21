-- =====================================================================
-- Shopify Billing API — track subscriptions billed through Shopify
--
-- Required for Shopify App Store policy 1.2.1: apps distributed via the
-- App Store must charge through Shopify's Billing API (we use
-- appSubscriptionCreate). Stripe remains the rail for merchants who sign
-- up directly via actero.fr and never connect a Shopify store.
--
-- Strictly additive — no existing column or row is modified.
-- =====================================================================

alter table public.clients
  add column if not exists billing_provider text,
  add column if not exists shopify_subscription_id text,
  add column if not exists pending_shopify_subscription_id text,
  add column if not exists billing_period text;

comment on column public.clients.billing_provider is
  'Which rail funds this client''s plan. NULL = legacy (assume Stripe). Known values: ''stripe'', ''shopify''.';

comment on column public.clients.shopify_subscription_id is
  'GID of the active AppSubscription on the merchant''s shop (e.g. gid://shopify/AppSubscription/123). NULL when the client is on Stripe or Free.';

comment on column public.clients.pending_shopify_subscription_id is
  'GID of an AppSubscription we created via appSubscriptionCreate but for which the merchant has not yet clicked Accept on Shopify''s confirmation page. Cleared once status flips ACTIVE.';

comment on column public.clients.billing_period is
  'Currently billed cadence — ''monthly'' or ''annual''. NULL on Free plan.';

create index if not exists clients_shopify_subscription_id_idx
  on public.clients (shopify_subscription_id)
  where shopify_subscription_id is not null;
