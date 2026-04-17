-- 2026-04-17 — POC GTM 72h: capture UTM attribution per client signup.
--
-- Stocke les paramètres UTM captés au moment du signup (depuis la query string URL)
-- dans un JSONB unique pour attribution marketing. Format :
--   {
--     "source": "apollo" | "linkedin" | "reddit" | "slack" | "meta" | "google" | ...,
--     "medium": "cold-email" | "dm" | "organic-post" | "community" | "paid-social" | "cpc",
--     "campaign": "poc-72h" | ...,
--     "content": "t1-gorgias" | "hook-j1" | ...,
--     "term": string | null,
--     "referrer": document.referrer at signup time,
--     "captured_at": ISO timestamp
--   }

alter table public.clients
  add column if not exists acquisition_source jsonb default '{}'::jsonb;

comment on column public.clients.acquisition_source is
  'UTM parameters captured at signup: {source, medium, campaign, content, term, referrer, captured_at}.';

-- Index pour reporting rapide par campagne
create index if not exists idx_clients_acquisition_campaign
  on public.clients ((acquisition_source->>'campaign'));

create index if not exists idx_clients_acquisition_source
  on public.clients ((acquisition_source->>'source'));
