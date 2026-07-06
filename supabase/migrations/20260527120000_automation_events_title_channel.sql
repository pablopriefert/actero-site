-- =====================================================================
-- automation_events — add event_title + source_channel columns
--
-- The engine logger (api/engine/logger.js) and four dashboard views
-- (OverviewHome, ActivityView, ChannelsHubView, InsightsHubView) already
-- read/write these two columns, but they were never created on the table.
-- Result: every ticket's automation_events insert failed with
--   "Could not find the 'event_title' column of 'automation_events'"
-- which silently broke the activity feed + per-channel metrics the
-- dashboard (and the App Store reviewer) sees.
--
-- Add both as nullable text — no backfill needed; new events populate them
-- and readers already fall back to metadata/labels for older rows.
-- =====================================================================

alter table public.automation_events
  add column if not exists event_title   text,
  add column if not exists source_channel text;

-- ChannelsHubView / InsightsHubView group by source_channel over a 7-day
-- window; index it so those dashboard queries stay fast as events grow.
create index if not exists automation_events_source_channel_idx
  on public.automation_events (client_id, source_channel, created_at desc);
