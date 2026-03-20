-- ============================================================
-- Actero Copilot — Cache table for AI analyses
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS copilot_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL DEFAULT 'ecommerce',
  summary TEXT NOT NULL DEFAULT '',
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_copilot_analyses_client_id ON copilot_analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_copilot_analyses_generated_at ON copilot_analyses(generated_at);

-- RLS: clients can read their own analyses
ALTER TABLE copilot_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own copilot analyses"
  ON copilot_analyses
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE owner_user_id = auth.uid()
    )
  );

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access to copilot_analyses"
  ON copilot_analyses
  FOR ALL
  USING (auth.role() = 'service_role');
