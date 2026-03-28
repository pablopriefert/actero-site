-- Table pour stocker les intégrations connectées par chaque client
CREATE TABLE IF NOT EXISTS client_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_label TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key')),
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT,
  extra_config JSONB DEFAULT '{}',
  scopes TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error', 'pending')),
  status_message TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, provider)
);

-- RLS : chaque client ne voit que ses propres intégrations
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own integrations"
  ON client_integrations FOR SELECT
  USING (client_id IN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM clients WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Clients can insert own integrations"
  ON client_integrations FOR INSERT
  WITH CHECK (client_id IN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM clients WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Clients can update own integrations"
  ON client_integrations FOR UPDATE
  USING (client_id IN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM clients WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Clients can delete own integrations"
  ON client_integrations FOR DELETE
  USING (client_id IN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM clients WHERE owner_user_id = auth.uid()
  ));

-- Admins ont accès complet
CREATE POLICY "Admins have full access to integrations"
  ON client_integrations FOR ALL
  USING (
    auth.uid() IN (SELECT auth.uid() FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin')
    OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@actero.fr'
  );

-- Index pour les lookups rapides
CREATE INDEX idx_client_integrations_client ON client_integrations(client_id);
CREATE INDEX idx_client_integrations_provider ON client_integrations(client_id, provider);
