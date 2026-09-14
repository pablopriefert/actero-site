-- Réservation d'action : une action irréversible ne part qu'une fois.
--
-- `runExecutor` déroule un plan d'actions pour un événement. Si le même
-- événement est rejoué — retry de cron, webhook redélivré, job repris, appel
-- concurrent — le plan se redéroule et une action irréversible part deux fois.
-- Concrètement : le client du marchand reçoit deux fois la même réponse.
--
-- Le 9 septembre 2026 ce défaut a été trouvé sur le chemin email et corrigé
-- localement. L'exécuteur, lui, restait sans protection — or c'est le point de
-- passage commun de TOUS les chemins.
--
-- L'unicité est portée par la base, pas par le code. Un contrôle « est-ce que
-- ça existe déjà ? » suivi d'une insertion laisse une fenêtre entre les deux :
-- c'est exactement la fenêtre restée ouverte sur le correctif email du matin.
-- Ici, deux exécutions simultanées ne peuvent pas gagner toutes les deux.
--
-- Seules les actions `external && !reversible` du registre sont réservées
-- (send_reply, send_email, send_invoice_reminder, notify_slack, escalate).
-- Réserver un compteur interne coûterait deux requêtes pour rien.

create table if not exists public.engine_action_claims (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  event_id     uuid not null,
  action       text not null,
  status       text not null default 'running',
  result       jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- LA contrainte qui fait tout le travail.
create unique index if not exists engine_action_claims_event_action_uniq
  on public.engine_action_claims (event_id, action);

-- Lecture par événement lors d'un retry, et vue par client pour l'audit.
create index if not exists engine_action_claims_client_created_idx
  on public.engine_action_claims (client_id, created_at desc);

-- Table interne au moteur : seul le service_role l'écrit et la lit. Le
-- navigateur n'a rien à y faire, et une action réservée n'est pas une donnée
-- que le marchand consulte directement (l'audit passe par engine_runs_v2).
alter table public.engine_action_claims enable row level security;

create policy engine_action_claims_service_role
  on public.engine_action_claims
  for all
  using (auth.role() = 'service_role');

revoke all on public.engine_action_claims from anon, authenticated;
