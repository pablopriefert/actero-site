-- ============================================================
-- Feature 1: Base de connaissances editable par le client
-- ============================================================

CREATE TABLE IF NOT EXISTS client_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('policy', 'faq', 'product', 'tone', 'temporary')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage their own knowledge base"
ON client_knowledge_base FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_kb_client_id ON client_knowledge_base(client_id);
CREATE INDEX IF NOT EXISTS idx_kb_category ON client_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_active ON client_knowledge_base(is_active);

CREATE OR REPLACE FUNCTION update_kb_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_updated_at ON client_knowledge_base;
CREATE TRIGGER kb_updated_at
BEFORE UPDATE ON client_knowledge_base
FOR EACH ROW EXECUTE FUNCTION update_kb_updated_at();

-- ============================================================
-- Feature 2: Notation des reponses IA (ai_conversations)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  subject TEXT,
  customer_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  status TEXT DEFAULT 'resolved' CHECK (status IN ('resolved', 'escalated', 'pending')),
  ticket_id TEXT,
  order_id TEXT,
  ticket_type TEXT,
  confidence_score NUMERIC,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_conversations' AND policyname = 'Clients view own conversations'
  ) THEN
    CREATE POLICY "Clients view own conversations" ON ai_conversations FOR SELECT
    USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));
  END IF;
END $$;

-- Rating columns
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS rating TEXT CHECK (rating IN ('positive', 'negative'));
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS rating_comment TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

-- Escalation columns (Feature 4)
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS human_response TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS human_responded_at TIMESTAMPTZ;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS added_to_kb BOOLEAN DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_conversations' AND policyname = 'Clients can update their conversations'
  ) THEN
    CREATE POLICY "Clients can update their conversations" ON ai_conversations FOR UPDATE
    USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()))
    WITH CHECK (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- Feature 3: Notifications client configurables
-- ============================================================

CREATE TABLE IF NOT EXISTS client_notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL UNIQUE,
  daily_summary BOOLEAN DEFAULT true,
  weekly_summary BOOLEAN DEFAULT false,
  escalation_alert BOOLEAN DEFAULT true,
  milestone_alert BOOLEAN DEFAULT true,
  monthly_report BOOLEAN DEFAULT true,
  preferred_hour INTEGER DEFAULT 8 CHECK (preferred_hour >= 0 AND preferred_hour <= 23),
  timezone TEXT DEFAULT 'Europe/Paris',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage their notification preferences"
ON client_notification_preferences FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS client_notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view their notification history"
ON client_notifications_log FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));
