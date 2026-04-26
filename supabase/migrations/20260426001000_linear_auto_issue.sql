-- Linear auto-issue — push every critical SAV escalation as a Linear issue
-- in the merchant's product team. Triggered from api/engine/respond.js
-- handleEscalation when sentiment <= linear_sentiment_threshold AND the
-- toggle is on.

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS linear_auto_issue_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linear_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS linear_team_id TEXT,
  ADD COLUMN IF NOT EXISTS linear_team_name TEXT,
  ADD COLUMN IF NOT EXISTS linear_sentiment_threshold REAL NOT NULL DEFAULT -0.5;

COMMENT ON COLUMN public.client_settings.linear_auto_issue_enabled IS
  'When true, escalations with sentiment <= linear_sentiment_threshold push a new Linear issue.';
COMMENT ON COLUMN public.client_settings.linear_api_key_encrypted IS
  'Personal Linear API key, encrypted with the same scheme as Slack/Shopify tokens (api/lib/crypto.js).';
COMMENT ON COLUMN public.client_settings.linear_team_id IS
  'Linear team UUID where issues are created. Resolved at connect time from /api/integrations/linear/connect.';
COMMENT ON COLUMN public.client_settings.linear_team_name IS
  'Cached team display name — surfaced in the dashboard so the merchant sees where issues land.';
COMMENT ON COLUMN public.client_settings.linear_sentiment_threshold IS
  'Only escalations with sentiment_score <= threshold push a Linear issue. -0.5 is "moderately negative".';

ALTER TABLE public.escalation_tickets
  ADD COLUMN IF NOT EXISTS linear_issue_id TEXT,
  ADD COLUMN IF NOT EXISTS linear_issue_url TEXT,
  ADD COLUMN IF NOT EXISTS linear_issue_identifier TEXT;

COMMENT ON COLUMN public.escalation_tickets.linear_issue_id IS
  'Linear issue UUID — set when auto-push succeeded. NULL means no Linear issue exists for this escalation.';
COMMENT ON COLUMN public.escalation_tickets.linear_issue_identifier IS
  'Human-readable Linear ID (e.g. SUP-123) — used in dashboard links and Slack mentions.';
