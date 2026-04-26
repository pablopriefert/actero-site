-- Discount Policy in E2B sandbox — merchant writes a Python `decide_discount`
-- function that gets executed in an isolated sandbox per call. Every run
-- is logged in agent_action_logs (existing table) so the merchant has a
-- full audit trail of "given input X, the policy returned Y%".

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS discount_policy_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_policy_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_policy_max_pct REAL NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS discount_policy_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_settings.discount_policy_enabled IS
  'When true, the agent calls the merchant''s discount policy (executed in an E2B sandbox) to decide cart discounts.';
COMMENT ON COLUMN public.client_settings.discount_policy_code IS
  'Python source code of decide_discount(cart, customer, policy_caps) — executed in an isolated E2B sandbox per call.';
COMMENT ON COLUMN public.client_settings.discount_policy_max_pct IS
  'Hard cap enforced by the wrapper after the policy returns — protects margin even if the policy mis-returns.';
