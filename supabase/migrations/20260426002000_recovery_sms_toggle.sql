-- Recovery SMS via Customer.io — when enabled, the abandoned-carts cron
-- forwards each event to Customer.io as `cart_abandoned_recovery` with
-- the shopper's phone + cart payload. The merchant configures a CIO
-- Journey on that event with an SMS step (Twilio backend in CIO).
-- Actero stays out of the carrier business.

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS recovery_sms_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_settings.recovery_sms_enabled IS
  'When true, abandoned-cart cron emits cart_abandoned_recovery events to Customer.io with shopper phone — merchant CIO Journey then triggers SMS.';
