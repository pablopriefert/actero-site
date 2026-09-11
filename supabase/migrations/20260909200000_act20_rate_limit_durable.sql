-- ACT-20 — Le rate limiting ne survivait pas au serverless.
--
-- api/lib/rate-limit.js comptait dans une Map de process. Sur Vercel chaque
-- instance a sa propre mémoire : deux requêtes qui atterrissent sur deux
-- instances voient chacune un compteur à zéro. La limite effective n'était
-- pas « 5 par heure », c'était « 5 par heure et par instance », donc autant
-- de fois 5 que la plateforme décide d'ouvrir d'instances.
--
-- 17 endpoints en dépendaient. Le plus exposé était
-- api/auth/send-verification-code.js : aucune garde durable ne s'y ajoutait,
-- donc on pouvait déclencher un nombre arbitraire d'emails de vérification
-- vers une adresse arbitraire, et empiler autant de lignes contenant un mot
-- de passe chiffré. (api/auth/verify-code.js, lui, tient : son compteur
-- d'essais vit sur la ligne du code, pas en mémoire.)
--
-- Un compteur partagé doit vivre là où toutes les instances le voient.

create table if not exists public.rate_limit_buckets (
  key      text primary key,
  hits     integer     not null default 0,
  reset_at timestamptz not null
);

comment on table public.rate_limit_buckets is
  'Compteurs de rate limiting partagés entre instances serverless (ACT-20). Écrit uniquement via consume_rate_limit().';

-- Sert au balayage des seaux périmés.
create index if not exists rate_limit_buckets_reset_at_idx
  on public.rate_limit_buckets (reset_at);

-- Aucune policy : la table n'est jamais lue par le navigateur. Seule la clé
-- service_role, qui contourne RLS, y accède — et uniquement via la fonction.
alter table public.rate_limit_buckets enable row level security;

-- Incrémente et décide en une seule instruction. Le UPSERT est atomique :
-- deux requêtes concurrentes sur la même clé ne peuvent pas lire le même
-- compteur puis l'écrire toutes les deux (le défaut classique du
-- lire-puis-écrire, qui laisse passer une requête de trop sous charge —
-- exactement la charge d'une attaque).
create or replace function public.consume_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_hits  integer;
  v_reset timestamptz;
begin
  if p_key is null or p_key = '' then
    raise exception 'consume_rate_limit: clé vide';
  end if;
  if p_limit is null or p_limit < 1 or p_window_ms is null or p_window_ms < 1 then
    raise exception 'consume_rate_limit: limite ou fenêtre invalide';
  end if;

  insert into public.rate_limit_buckets as b (key, hits, reset_at)
  values (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
  on conflict (key) do update
    set hits = case when b.reset_at <= v_now then 1 else b.hits + 1 end,
        reset_at = case
          when b.reset_at <= v_now
            then v_now + (p_window_ms || ' milliseconds')::interval
          else b.reset_at
        end
  returning b.hits, b.reset_at into v_hits, v_reset;

  -- Balayage opportuniste : une fois sur cent environ, on retire les seaux
  -- périmés depuis plus d'une heure. Évite un cron dédié pour une table dont
  -- la croissance est bornée par le nombre d'IP actives.
  if random() < 0.01 then
    delete from public.rate_limit_buckets
     where reset_at < v_now - interval '1 hour';
  end if;

  return query select (v_hits <= p_limit), greatest(0, p_limit - v_hits), v_reset;
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Consomme un jeton de rate limiting de façon atomique et partagée (ACT-20).';

-- Le navigateur n'a aucune raison d'appeler ça : il pourrait consommer les
-- jetons d'une autre IP en devinant la clé.
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;

-- Appliqué dans un second temps (migration act20_rate_limit_revoke_table_grants),
-- après vérification des droits réels en base : RLS sans policy refuse déjà
-- toute lecture, mais le GRANT de table restait présent — Supabase l'accorde
-- par défaut sur `public`. Le laisser signifie qu'une policy permissive
-- ajoutée plus tard ouvrirait la table sans que personne ne l'ait décidé.
-- C'est le piège rencontré sur ACT-7 le même jour : il ne suffit pas
-- d'activer RLS, il faut aussi retirer le droit de table.
revoke all on table public.rate_limit_buckets from anon, authenticated;
grant all on table public.rate_limit_buckets to service_role;
