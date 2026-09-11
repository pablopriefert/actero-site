-- ACT-25 — un délai de grâce avant l'effacement définitif.
--
-- La suppression était immédiate et irréversible, sans aucune sauvegarde
-- restaurable derrière (ACT-14 n'est pas fait). Une demande envoyée par erreur,
-- ou un clic de trop dans l'admin, ne se rattrapait pas.
--
-- Arbitrage assumé : on coupe l'agent TOUT DE SUITE — le marchand a demandé à
-- partir, il doit le constater — mais on ne révoque les accès fournisseurs
-- qu'à la purge. Révoquer dès la demande rendrait l'annulation illusoire : il
-- faudrait tout reconnecter. Un délai de grâce annulable seulement sur le
-- papier n'en est pas un.
--
-- 14 jours par défaut : le RGPD laisse un mois pour répondre, ce qui garde
-- encore deux semaines de marge après la purge pour confirmer au demandeur.

alter table public.clients
  add column if not exists deletion_requested_at timestamptz;

comment on column public.clients.deletion_requested_at is
  'Date de la demande d''effacement (ACT-25). La purge intervient après le délai de grâce.';

create index if not exists clients_deletion_requested_at_idx
  on public.clients (deletion_requested_at)
  where deletion_requested_at is not null;

-- Marquer le client ET couper l'agent, en une seule transaction. Faire l'un
-- sans l'autre laisserait un état incohérent que personne ne remarquerait :
-- soit un compte marqué qui répond encore, soit un compte muet sans raison.
create or replace function public.request_client_deletion(p_client_id uuid)
returns table (etape text, detail text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
begin
  select brand_name into v_nom from clients where id = p_client_id;
  if v_nom is null then
    raise exception 'request_client_deletion : aucun client %', p_client_id
      using errcode = 'no_data_found';
  end if;

  update clients
     set deletion_requested_at = coalesce(deletion_requested_at, now()),
         status = 'pending_deletion'
   where id = p_client_id;
  etape := 'client marqué'; detail := v_nom; return next;

  update client_settings set agent_enabled = false where client_id = p_client_id;
  etape := 'agent coupé'; detail := 'plus aucune réponse envoyée'; return next;

  return;
end;
$$;

-- Annuler pendant le délai. Remet l'agent en marche : sans ça, l'annulation
-- laisserait un compte vivant mais muet.
create or replace function public.cancel_client_deletion(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_demande timestamptz;
begin
  select deletion_requested_at into v_demande from clients where id = p_client_id;
  if v_demande is null then
    raise exception 'cancel_client_deletion : aucune demande en cours pour %', p_client_id
      using errcode = 'no_data_found';
  end if;

  update clients set deletion_requested_at = null, status = 'active' where id = p_client_id;
  update client_settings set agent_enabled = true where client_id = p_client_id;
  return 'demande annulée, agent réactivé';
end;
$$;

revoke all on function public.request_client_deletion(uuid) from public, anon, authenticated;
revoke all on function public.cancel_client_deletion(uuid)  from public, anon, authenticated;
grant execute on function public.request_client_deletion(uuid) to service_role;
grant execute on function public.cancel_client_deletion(uuid)  to service_role;
