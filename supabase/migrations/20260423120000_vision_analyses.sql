-- 20260423120000_vision_analyses.sql
-- Claude Vision feature — persistent layer.
--
-- Adds:
--   (1) vision_analyses — one row per image analyzed, for audit + billing
--   (2) ticket-attachments storage bucket — PRIVATE, signed URLs only
--   (3) client_settings.vision_enabled toggle

-- ===== 1. vision_analyses table =====

CREATE TABLE IF NOT EXISTS vision_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  image_path TEXT NOT NULL,
  image_bytes INTEGER,
  result_json JSONB NOT NULL,
  use_case TEXT,
  is_sensitive_detected BOOLEAN NOT NULL DEFAULT false,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_eur NUMERIC(8, 5) NOT NULL DEFAULT 0,
  model_id TEXT,
  processing_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vision_analyses_client_period_idx
  ON vision_analyses (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vision_analyses_ticket_idx
  ON vision_analyses (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE vision_analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vision_analyses' AND policyname = 'Clients view own vision analyses'
  ) THEN
    CREATE POLICY "Clients view own vision analyses" ON vision_analyses FOR SELECT
      USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vision_analyses' AND policyname = 'Service role manages vision analyses'
  ) THEN
    CREATE POLICY "Service role manages vision analyses" ON vision_analyses
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ===== 2. Storage bucket =====

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'ticket_attachments_service_role'
  ) THEN
    CREATE POLICY "ticket_attachments_service_role" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'ticket-attachments')
      WITH CHECK (bucket_id = 'ticket-attachments');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'ticket_attachments_owner_read'
  ) THEN
    CREATE POLICY "ticket_attachments_owner_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'ticket-attachments'
        AND (string_to_array(name, '/'))[1] IN (
          SELECT id::text FROM clients WHERE owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ===== 3. client_settings toggle =====

ALTER TABLE client_settings
  ADD COLUMN IF NOT EXISTS vision_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN client_settings.vision_enabled IS 'Enable Claude Vision analysis on inbound ticket attachments';
