-- Création des nouvelles colonnes pour Stripe dans la table 'clients'
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'canceled', 'past_due'));

-- Index on owner_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON public.clients(owner_user_id);

-- Index on stripe_subscription_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_clients_stripe_subscription_id ON public.clients(stripe_subscription_id);

-- Affichage d'un message de confirmation
SELECT 'Colonnes Stripe ajoutées à la table clients.' as message;
