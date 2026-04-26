-- Replay recording — opt-in toggle. When ON, the chat widget loads
-- Amplitude Session Replay (Actero's EU workspace, Scholarship plan,
-- 100% sample for ticket-bearing sessions) and Actero stores the
-- deviceId + sessionId on each ai_conversations.metadata so an Actero
-- support agent can pull the replay when investigating an escalation.
-- ai_conversations.metadata already exists (JSONB) — no schema change there.

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS replay_recording_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_settings.replay_recording_enabled IS
  'When true, the embedded chat widget loads Amplitude Session Replay and persists deviceId/sessionId on each conversation for post-incident review.';
