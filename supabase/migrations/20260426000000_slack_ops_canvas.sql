-- Slack Ops Canvas — live operational dashboard pinned in the merchant's Slack.
-- A cron refreshes the canvas every 15 min with current ticket KPIs, top topics,
-- pending escalations and SLA alerts. The merchant gets a single Slack page
-- they can keep open as their war room.

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS slack_ops_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_ops_canvas_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_ops_canvas_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_ops_last_refreshed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_settings.slack_ops_enabled IS
  'When true, the cron-slack-canvas-update job refreshes a Slack Canvas every 15 min for this client.';
COMMENT ON COLUMN public.client_settings.slack_ops_canvas_id IS
  'Slack canvas_id returned by canvases.create — used by canvases.edit on subsequent refreshes.';
COMMENT ON COLUMN public.client_settings.slack_ops_canvas_url IS
  'Permalink to the Slack canvas — surfaced in the dashboard so the merchant can open it in one click.';
COMMENT ON COLUMN public.client_settings.slack_ops_last_refreshed_at IS
  'Wall-clock of the last successful canvas refresh — used to flag stale canvases in the UI.';
