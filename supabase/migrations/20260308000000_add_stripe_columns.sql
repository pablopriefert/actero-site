-- Création des nouvelles colonnes pour Stripe dans la table 'clients'
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive';

-- Affichage d'un message de confirmation
SELECT 'Colonnes Stripe ajoutées à la table clients.' as message;
