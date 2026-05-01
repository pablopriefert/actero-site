-- Surface inbound-email poll failures in the client dashboard so merchants
-- can self-diagnose mailbox issues (expired IMAP password, IONOS rate-limit,
-- revoked Gmail token, etc.) instead of wondering why no tickets land.
--
-- The poller (api/cron/poll-inbound-emails.js) writes to these columns on
-- every cron tick. The Email Agent view reads them.

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS email_last_error TEXT,
  ADD COLUMN IF NOT EXISTS email_last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_consecutive_failures INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.client_settings.email_last_error IS
  'Last error from inbound email poller. NULL = last poll succeeded.';
COMMENT ON COLUMN public.client_settings.email_consecutive_failures IS
  'Streak of poll failures since last success. >= 10 trips a circuit breaker that the merchant resets from the dashboard.';
