-- =====================================================================
-- Extend shopify_gdpr_log.webhook_type to accept billing-related topics.
--
-- The original constraint (migration 20260521000000_shopify_gdpr_webhooks)
-- only allowed the four GDPR / lifecycle topics. We now also receive
-- `app_subscriptions/update` (required by App Store policy 1.2.2 — handle
-- charge acceptance, decline, and resubscription) and want to keep the
-- same append-only audit trail.
--
-- Additive: we drop the old check and add a broader one that still pins
-- the column to a known whitelist.
-- =====================================================================

alter table public.shopify_gdpr_log drop constraint if exists shopify_gdpr_log_webhook_type_check;

alter table public.shopify_gdpr_log
  add constraint shopify_gdpr_log_webhook_type_check
  check (webhook_type in (
    'customers/data_request',
    'customers/redact',
    'shop/redact',
    'app/uninstalled',
    'app_subscriptions/update'
  ));
