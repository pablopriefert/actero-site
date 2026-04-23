-- Add portal_tone to client_settings for configurable tutoiement vs vouvoiement
-- across the customer-facing portal and widget copy.

ALTER TABLE client_settings
  ADD COLUMN IF NOT EXISTS portal_tone TEXT NOT NULL DEFAULT 'tu'
  CHECK (portal_tone IN ('tu', 'vous'));

COMMENT ON COLUMN client_settings.portal_tone IS
  'Customer-facing tone for the portal/widget: tu (informal, default) or vous (formal).';
