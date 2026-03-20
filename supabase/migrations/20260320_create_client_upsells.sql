-- ============================================================
-- Table: client_upsells
-- Tracks upsell activations per client
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_upsells (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  upsell_type TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'ecommerce',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'active', 'canceled', 'payment_failed')),
  calculated_price INTEGER, -- Price in EUR
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- No unique constraint on status to allow cancel/reactivate cycles
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_upsells_client_id ON public.client_upsells(client_id);
CREATE INDEX IF NOT EXISTS idx_client_upsells_stripe_sub ON public.client_upsells(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_client_upsells_stripe_session ON public.client_upsells(stripe_checkout_session_id);

-- RLS: Clients can only see their own upsells
ALTER TABLE public.client_upsells ENABLE ROW LEVEL SECURITY;

-- Policy: client can read their own upsells
CREATE POLICY "client_upsells_select" ON public.client_upsells
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM public.clients WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: service role can do everything (for API routes)
CREATE POLICY "client_upsells_service" ON public.client_upsells
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_upsells_updated_at ON public.client_upsells;
CREATE TRIGGER update_client_upsells_updated_at
  BEFORE UPDATE ON public.client_upsells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
