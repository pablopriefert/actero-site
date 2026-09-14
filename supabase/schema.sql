


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."event_category" AS ENUM (
    'ticket_resolved',
    'ticket_escalated',
    'cart_email_sent',
    'cart_recovered',
    'email_opened',
    'email_clicked',
    'lead_qualified',
    'lead_escalated',
    'visit_reply_sent',
    'visit_scheduled',
    'match_found',
    'document_request_sent',
    'document_received',
    'document_reminder_sent',
    'prospect_relance_sent',
    'ticket_error',
    'ticket_human_resolved',
    'generic',
    'compta_invoice_reminder',
    'compta_treasury_alert',
    'cart_abandoned_recovered'
);


ALTER TYPE "public"."event_category" OWNER TO "postgres";


CREATE TYPE "public"."ticket_type" AS ENUM (
    'order_tracking',
    'address_change',
    'return_exchange',
    'product_info',
    'other',
    'lead_qualification',
    'visit_request',
    'property_matching',
    'billing',
    'general'
);


ALTER TYPE "public"."ticket_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_onboarding_status"("p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id       uuid;
  v_client_id     uuid;
  v_client_role   text;
  v_user_exists   boolean := false;
  v_client_linked boolean := false;
BEGIN
  -- ── Garde : admin uniquement ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('ok', false, 'message', 'email est requis');
  END IF;

  -- ── Chercher le user dans auth.users ──────────────────────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  v_user_exists := (v_user_id IS NOT NULL);

  -- ── Chercher le lien client_users ─────────────────────────────────────────
  IF v_user_exists THEN
    SELECT cu.client_id, cu.role
    INTO v_client_id, v_client_role
    FROM public.client_users cu
    WHERE cu.user_id = v_user_id
    LIMIT 1;

    v_client_linked := (v_client_id IS NOT NULL);
  END IF;

  -- ── Retour ────────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'ok',            true,
    'email',         lower(trim(p_email)),
    'user_exists',   v_user_exists,
    'user_id',       v_user_id,
    'client_linked', v_client_linked,
    'client_id',     v_client_id,
    'client_role',   v_client_role
  );
END;
$$;


ALTER FUNCTION "public"."admin_get_onboarding_status"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_get_onboarding_status"("p_email" "text") IS 'Admin RPC : vérifie l''état d''onboarding d''un email (user existe, client lié).';



CREATE OR REPLACE FUNCTION "public"."admin_onboard_client"("p_brand_name" "text", "p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_client_id        uuid;
  v_user_id          uuid;
  v_project_url      text;
  v_service_key      text;
  v_response         extensions.http_response;
  v_response_body    jsonb;
  v_invite_sent      boolean := false;
  v_user_existed     boolean := false;
BEGIN
  -- Admin only
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Basic validation
  IF p_brand_name IS NULL OR trim(p_brand_name) = '' THEN
    RETURN json_build_object('ok', false, 'message', 'brand_name est requis');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('ok', false, 'message', 'email est requis');
  END IF;

  -- Vault secrets
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN json_build_object(
      'ok', false,
      'message', 'Vault secrets manquants (supabase_project_url / supabase_service_role_key)'
    );
  END IF;

  -- Step 1: create client
  INSERT INTO public.clients (brand_name)
  VALUES (trim(p_brand_name))
  RETURNING id INTO v_client_id;

  -- Step 2: check if user already exists in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_user_existed := true;
    v_invite_sent := false;
  ELSE
    SELECT * INTO v_response
    FROM extensions.http((
      'POST',
      v_project_url || '/auth/v1/invite',
      ARRAY[
        extensions.http_header('apikey', v_service_key),
        extensions.http_header('Authorization', 'Bearer ' || v_service_key)
      ],
      'application/json',
      json_build_object(
        'email', lower(trim(p_email)),
        'redirect_to', 'https://actero.fr/setup-password',
        'data', json_build_object('client_id', v_client_id)
      )::text
    )::extensions.http_request);

    BEGIN
      v_response_body := v_response.content::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object(
        'ok', false,
        'message', 'Auth API non-JSON response (check endpoint/keys)',
        'status', v_response.status,
        'raw', v_response.content,
        'client_id', v_client_id
      );
    END;

    IF v_response.status BETWEEN 200 AND 299 THEN
      v_user_id := COALESCE(
        NULLIF(v_response_body->>'id','')::uuid,
        NULLIF((v_response_body->'user'->>'id'), '')::uuid
      );
      v_invite_sent := true;
    ELSE
      RETURN json_build_object(
        'ok', false,
        'message', 'Auth API error: ' || COALESCE(v_response_body->>'msg', 'unknown'),
        'status', v_response.status,
        'error_code', v_response_body->>'error_code',
        'body', v_response_body,
        'client_id', v_client_id
      );
    END IF;
  END IF;

  -- Step 3: link user -> client
  INSERT INTO public.client_users (user_id, client_id, role)
  VALUES (v_user_id, v_client_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Step 4: create default client_settings row
  INSERT INTO public.client_settings (client_id, hourly_cost, avg_ticket_time_min, actero_monthly_price, currency)
  VALUES (v_client_id, 0, 5, 0, 'EUR')
  ON CONFLICT (client_id) DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'client_id', v_client_id,
    'user_id', v_user_id,
    'email', lower(trim(p_email)),
    'invite_sent', v_invite_sent,
    'linked', true,
    'message', CASE 
      WHEN v_user_existed THEN 'Utilisateur existant lié au client'
      ELSE 'Invitation envoyée avec succès'
    END
  );
END;
$$;


ALTER FUNCTION "public"."admin_onboard_client"("p_brand_name" "text", "p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_onboard_client"("p_brand_name" "text", "p_email" "text") IS 'Admin RPC : crée un client, invite l''email via Auth Admin, lie le user comme owner.';



CREATE OR REPLACE FUNCTION "public"."admin_resend_magic_link"("p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_project_url   text;
  v_service_key   text;
  v_response      extensions.http_response;
  v_response_body jsonb;
BEGIN
  -- ── Garde : admin uniquement ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('ok', false, 'message', 'email est requis');
  END IF;

  -- ── Secrets vault ─────────────────────────────────────────────────────────
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_project_url' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN json_build_object(
      'ok', false,
      'message', 'Vault secrets manquants'
    );
  END IF;

  -- ── Appel Auth Admin generate_link ────────────────────────────────────────
  BEGIN
    SELECT * INTO v_response
    FROM extensions.http((
      'POST',
      v_project_url || '/auth/v1/admin/generate_link',
      ARRAY[
        extensions.http_header('apikey',        v_service_key),
        extensions.http_header('Authorization', 'Bearer ' || v_service_key)
      ],
      'application/json',
      json_build_object(
        'type',       'magiclink',
        'email',      lower(trim(p_email)),
        'redirectTo', 'https://actero.fr/auth/callback'
      )::text
    )::extensions.http_request);

    v_response_body := v_response.content::jsonb;

    IF v_response.status BETWEEN 200 AND 299 THEN
      RETURN json_build_object(
        'ok',      true,
        'email',   lower(trim(p_email)),
        'message', 'Magic link envoyé'
      );
    ELSE
      RETURN json_build_object(
        'ok',      false,
        'message', 'Auth API error: ' || coalesce(
          v_response_body ->> 'msg',
          v_response_body ->> 'error_description',
          v_response.content
        )
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'ok',      false,
      'message', 'HTTP call failed: ' || SQLERRM
    );
  END;
END;
$$;


ALTER FUNCTION "public"."admin_resend_magic_link"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_resend_magic_link"("p_email" "text") IS 'Admin RPC : génère et envoie un magic link via Auth Admin API.';



CREATE OR REPLACE FUNCTION "public"."cancel_client_deletion"("p_client_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_demande timestamptz;
begin
  select deletion_requested_at into v_demande from clients where id = p_client_id;
  if v_demande is null then
    raise exception 'cancel_client_deletion : aucune demande en cours pour %', p_client_id
      using errcode = 'no_data_found';
  end if;

  update clients set deletion_requested_at = null, status = 'active' where id = p_client_id;
  update client_settings set agent_enabled = true where client_id = p_client_id;
  return 'demande annulee, agent reactive';
end;
$$;


ALTER FUNCTION "public"."cancel_client_deletion"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_credits"("p_client_id" "uuid", "p_amount" integer, "p_description" "text" DEFAULT NULL::"text", "p_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current integer;
  v_new_balance integer;
BEGIN
  -- Upsert client_credits row with FOR UPDATE lock
  INSERT INTO client_credits (client_id, balance) VALUES (p_client_id, 0) ON CONFLICT (client_id) DO NOTHING;
  SELECT balance INTO v_current FROM client_credits WHERE client_id = p_client_id FOR UPDATE;

  IF v_current < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_current, 'required', p_amount);
  END IF;

  v_new_balance := v_current - p_amount;

  UPDATE client_credits SET balance = v_new_balance, total_used = total_used + p_amount, updated_at = now()
    WHERE client_id = p_client_id;

  INSERT INTO credit_transactions (client_id, type, amount, balance_after, description, related_event_id)
    VALUES (p_client_id, 'usage', -p_amount, v_new_balance, p_description, p_event_id);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'consumed', p_amount);
END;
$$;


ALTER FUNCTION "public"."consume_credits"("p_client_id" "uuid", "p_amount" integer, "p_description" "text", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" integer) RETURNS TABLE("allowed" boolean, "remaining" integer, "reset_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now   timestamptz := now();
  v_hits  integer;
  v_reset timestamptz;
begin
  if p_key is null or p_key = '' then
    raise exception 'consume_rate_limit: cle vide';
  end if;
  if p_limit is null or p_limit < 1 or p_window_ms is null or p_window_ms < 1 then
    raise exception 'consume_rate_limit: limite ou fenetre invalide';
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

  if random() < 0.01 then
    delete from public.rate_limit_buckets
     where reset_at < v_now - interval '1 hour';
  end if;

  return query select (v_hits <= p_limit), greatest(0, p_limit - v_hits), v_reset;
end;
$$;


ALTER FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" integer) IS 'Consomme un jeton de rate limiting de facon atomique et partagee (ACT-20).';



CREATE OR REPLACE FUNCTION "public"."delete_client_data"("p_client_id" "uuid") RETURNS TABLE("etape" "text", "lignes" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_nom      text;
  v_n        integer;
  v_inconnus text;
  -- Les huit bloqueurs connus au 10 septembre 2026, chacun traite plus bas.
  v_connus text[] := array[
    'admin_action_logs', 'call_notes', 'client_shopify_connections', 'clients',
    'deployment_requests', 'deployments', 'escalation_tickets', 'funnel_clients'
  ];
begin
  -- Auto-verification. Une nouvelle table avec une cle etrangere NO ACTION
  -- vers clients.id casserait la suppression sans prevenir : elle echouerait
  -- au milieu, sur une violation de cle etrangere illisible. Mieux vaut
  -- refuser de commencer, en nommant la table a traiter.
  select string_agg(distinct tc.table_name, ', ')
    into v_inconnus
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and ccu.table_name = 'clients' and ccu.column_name = 'id'
     and rc.delete_rule = 'NO ACTION'
     and tc.table_name <> all (v_connus);

  if v_inconnus is not null then
    raise exception
      'delete_client_data : table(s) non traitee(s) avec une cle etrangere NO ACTION vers clients.id : %. Ajouter leur traitement (detacher ou supprimer) avant de poursuivre — voir docs/runbook-suppression-client.md',
      v_inconnus
      using errcode = 'raise_exception';
  end if;

  select brand_name into v_nom from clients where id = p_client_id;
  if v_nom is null then
    raise exception 'delete_client_data : aucun client %', p_client_id
      using errcode = 'no_data_found';
  end if;

  update admin_action_logs set client_id = null where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'admin_action_logs (detache)'; lignes := v_n; return next;

  update deployment_requests set client_id = null where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'deployment_requests (detache)'; lignes := v_n; return next;

  update funnel_clients set onboarded_client_id = null where onboarded_client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'funnel_clients (detache)'; lignes := v_n; return next;

  update clients set referred_by_client_id = null where referred_by_client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'clients.referred_by (detache)'; lignes := v_n; return next;

  delete from client_shopify_connections where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'client_shopify_connections (supprime)'; lignes := v_n; return next;

  delete from escalation_tickets where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'escalation_tickets (supprime)'; lignes := v_n; return next;

  delete from call_notes where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'call_notes (supprime)'; lignes := v_n; return next;

  delete from deployments where client_id = p_client_id;
  get diagnostics v_n = row_count;
  etape := 'deployments (supprime)'; lignes := v_n; return next;

  delete from clients where id = p_client_id;
  get diagnostics v_n = row_count;
  etape := format('clients « %s » + 57 tables en cascade', v_nom); lignes := v_n; return next;

  return;
end;
$$;


ALTER FUNCTION "public"."delete_client_data"("p_client_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_client_data"("p_client_id" "uuid") IS 'Efface un client et ses donnees (ACT-25). Detache ce qui fait foi, supprime ce qui est personnel. Renvoie le decompte par etape.';



CREATE OR REPLACE FUNCTION "public"."enqueue_ai_execution_from_reco"("p_reco_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reco       record;
  v_req_id     uuid;
  v_payload    jsonb;
  v_notify     jsonb;
  v_webhook_url    text;
  v_webhook_secret text;
BEGIN
  -- ── E1. Charger et valider la reco ─────────────────────────────────────────
  SELECT * INTO v_reco
  FROM public.ai_recommendations
  WHERE id = p_reco_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_recommendation introuvable: %', p_reco_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_reco.status <> 'implemented' THEN
    RAISE EXCEPTION 'ai_recommendation % n''est pas implemented (status: %)',
      p_reco_id, v_reco.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── E2. Idempotence ─────────────────────────────────────────────────────────
  SELECT id INTO v_req_id
  FROM public.requests
  WHERE source    = 'intelligence'
    AND source_id = p_reco_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_req_id;
  END IF;

  -- ── E3. Payload snapshot figé au moment de l'implémentation ─────────────────
  v_payload := jsonb_build_object(
    'reco_id',                      v_reco.id,
    'title',                        v_reco.title,
    'category',                     v_reco.category,
    'priority_level',               v_reco.priority_level,
    'impact_score',                 v_reco.impact_score,
    'estimated_time_gain_minutes',  v_reco.estimated_time_gain_minutes,
    'estimated_revenue_gain',       v_reco.estimated_revenue_gain,
    'fingerprint',                  v_reco.fingerprint,
    'evidence',                     v_reco.evidence,
    'implemented_at',               now()
  );

  -- ── E4. INSERT dans requests ─────────────────────────────────────────────────
  INSERT INTO public.requests (
    client_id,
    title,
    description,
    request_type,
    status,
    priority,
    source,
    source_id,
    payload
  ) VALUES (
    v_reco.client_id,
    '[AI] ' || v_reco.title,
    'Exécution automatique — ' || v_reco.category
      || ' | impact: ' || v_reco.impact_score || '/100',
    'ai_execution',
    'en_attente',
    CASE v_reco.priority_level
      WHEN 'high'   THEN 'high'
      WHEN 'medium' THEN 'normal'
      ELSE               'low'
    END,
    'intelligence',
    p_reco_id,
    v_payload
  )
  RETURNING id INTO v_req_id;

  -- ── E5. Notification n8n via pg_net — fire-and-forget ──────────────────────
  v_notify := jsonb_build_object(
    'request_id', v_req_id,
    'client_id',  v_reco.client_id,
    'reco_id',    p_reco_id
  );

  BEGIN
    -- Lire les secrets depuis vault (chiffrés au repos)
    SELECT decrypted_secret INTO v_webhook_url
    FROM vault.decrypted_secrets
    WHERE name = 'n8n_webhook_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'n8n_webhook_secret'
    LIMIT 1;

    IF v_webhook_url IS NOT NULL AND v_webhook_secret IS NOT NULL THEN
      -- net.http_post() est asynchrone (retourne un bigint request_id)
      -- → ne bloque JAMAIS la transaction parente
      PERFORM net.http_post(
        url     := v_webhook_url,
        body    := v_notify,
        headers := jsonb_build_object(
          'Content-Type',    'application/json',
          'X-Actero-Secret', v_webhook_secret
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- pg_net indisponible ou erreur : on log et on continue
    -- La request est déjà insérée → n8n peut poller 'en_attente' en fallback
    RAISE NOTICE 'Webhook n8n non envoyé (%). Fallback: pg_notify + polling.', SQLERRM;
  END;

  -- Fallback NOTIFY toujours émis (coût nul, utile pour Realtime/debug)
  PERFORM pg_notify('n8n_execution', v_notify::text);

  RETURN v_req_id;
END;
$$;


ALTER FUNCTION "public"."enqueue_ai_execution_from_reco"("p_reco_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_ai_execution_from_reco"("p_reco_id" "uuid") IS 'Crée une request ai_execution à partir d''une reco implemented, puis notifie n8n via pg_net (fire-and-forget). Idempotent.';



CREATE OR REPLACE FUNCTION "public"."fill_actero_monthly_price"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_price numeric;
  v_stripe_customer_id text;
  v_contact_email text;
BEGIN
  IF NEW.actero_monthly_price IS NULL OR NEW.actero_monthly_price = 0 THEN
    SELECT c.stripe_customer_id, c.contact_email
      INTO v_stripe_customer_id, v_contact_email
    FROM clients c
    WHERE c.id = NEW.client_id;

    SELECT fc.monthly_price INTO v_price
    FROM funnel_clients fc
    WHERE fc.monthly_price IS NOT NULL
      AND fc.monthly_price > 0
      AND (
        fc.onboarded_client_id = NEW.client_id
        OR (fc.stripe_customer_id IS NOT NULL AND fc.stripe_customer_id = v_stripe_customer_id)
        OR (fc.email IS NOT NULL AND v_contact_email IS NOT NULL AND lower(fc.email) = lower(v_contact_email))
      )
    ORDER BY
      CASE WHEN fc.onboarded_client_id = NEW.client_id THEN 0
           WHEN fc.stripe_customer_id = v_stripe_customer_id THEN 1
           ELSE 2 END,
      fc.created_at DESC
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      NEW.actero_monthly_price := v_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fill_actero_monthly_price"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_funnel_client_public"("p_slug" "text") RETURNS TABLE("company_name" "text", "setup_price" integer, "monthly_price" integer, "client_type" "text", "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select f.company_name,
         f.setup_price,
         f.monthly_price,
         f.client_type,
         f.status
  from public.funnel_clients f
  where f.slug = p_slug
  limit 1;
$$;


ALTER FUNCTION "public"."get_funnel_client_public"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_client_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
  UNION
  SELECT id FROM clients WHERE owner_user_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_my_client_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_metrics"("client_uuid" "uuid", "tasks_inc" integer, "minutes_inc" integer, "roi_inc" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Sécurité : autoriser seulement service_role ou admin
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role'
     AND public.get_my_role() != 'admin'
  THEN
    RAISE EXCEPTION 'Unauthorized: only service_role or admin can call increment_metrics';
  END IF;

  INSERT INTO public.metrics_daily (
    client_id,
    date,
    active_automations,
    tasks_executed,
    time_saved_minutes,
    estimated_roi
  )
  VALUES (
    client_uuid,
    CURRENT_DATE,
    0,
    tasks_inc,
    minutes_inc,
    roi_inc
  )
  ON CONFLICT (client_id, date) DO UPDATE SET
    tasks_executed     = metrics_daily.tasks_executed     + EXCLUDED.tasks_executed,
    time_saved_minutes = metrics_daily.time_saved_minutes + EXCLUDED.time_saved_minutes,
    estimated_roi      = metrics_daily.estimated_roi      + EXCLUDED.estimated_roi;
END;
$$;


ALTER FUNCTION "public"."increment_metrics"("client_uuid" "uuid", "tasks_inc" integer, "minutes_inc" integer, "roi_inc" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ticket_usage"("p_client_id" "uuid", "p_period" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO usage_counters (client_id, period, tickets_used, updated_at)
  VALUES (p_client_id, p_period, 1, now())
  ON CONFLICT (client_id, period)
  DO UPDATE SET tickets_used = usage_counters.tickets_used + 1, updated_at = now()
  RETURNING tickets_used INTO v_count;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_ticket_usage"("p_client_id" "uuid", "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and coalesce(raw_app_meta_data ->> 'role', '') = 'admin'
  ) or exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_client"("p_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.client_users cu
    where cu.client_id = p_client_id
      and cu.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_member_of_client"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_automation_event"("p_client_id" "uuid", "p_event_category" "text", "p_ticket_type" "text" DEFAULT NULL::"text", "p_time_saved_seconds" integer DEFAULT 300, "p_revenue_amount" numeric DEFAULT 0, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_event_cat event_category;
  v_ticket_t ticket_type;
BEGIN
  -- Cast les enums
  v_event_cat := p_event_category::event_category;
  IF p_ticket_type IS NOT NULL THEN
    v_ticket_t := p_ticket_type::ticket_type;
  END IF;

  -- 1. Insert l'event
  INSERT INTO automation_events (client_id, event_category, ticket_type, time_saved_seconds, revenue_amount, metadata)
  VALUES (p_client_id, v_event_cat, v_ticket_t, p_time_saved_seconds, p_revenue_amount, p_metadata);

  -- 2. Upsert dans metrics_daily
  INSERT INTO metrics_daily (client_id, date, tickets_total, tickets_auto, tickets_escalated, 
    tickets_tracking, tickets_address, tickets_return, tickets_other,
    hours_saved, money_saved, revenue_recovered, cart_emails_sent, cart_recovered)
  VALUES (
    p_client_id, v_today,
    CASE WHEN v_event_cat IN ('ticket_resolved', 'ticket_escalated') THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_resolved' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_escalated' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_resolved' AND v_ticket_t = 'order_tracking' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_resolved' AND v_ticket_t = 'address_change' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_resolved' AND v_ticket_t = 'return_exchange' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'ticket_resolved' AND v_ticket_t = 'other' THEN 1 ELSE 0 END,
    p_time_saved_seconds / 3600.0,
    (p_time_saved_seconds / 3600.0) * COALESCE((SELECT hourly_cost FROM client_settings WHERE client_id = p_client_id), 25),
    p_revenue_amount,
    CASE WHEN v_event_cat = 'cart_email_sent' THEN 1 ELSE 0 END,
    CASE WHEN v_event_cat = 'cart_recovered' THEN 1 ELSE 0 END
  )
  ON CONFLICT (client_id, date) DO UPDATE SET
    tickets_total = metrics_daily.tickets_total + EXCLUDED.tickets_total,
    tickets_auto = metrics_daily.tickets_auto + EXCLUDED.tickets_auto,
    tickets_escalated = metrics_daily.tickets_escalated + EXCLUDED.tickets_escalated,
    tickets_tracking = metrics_daily.tickets_tracking + EXCLUDED.tickets_tracking,
    tickets_address = metrics_daily.tickets_address + EXCLUDED.tickets_address,
    tickets_return = metrics_daily.tickets_return + EXCLUDED.tickets_return,
    tickets_other = metrics_daily.tickets_other + EXCLUDED.tickets_other,
    hours_saved = metrics_daily.hours_saved + EXCLUDED.hours_saved,
    money_saved = metrics_daily.money_saved + EXCLUDED.money_saved,
    revenue_recovered = metrics_daily.revenue_recovered + EXCLUDED.revenue_recovered,
    cart_emails_sent = metrics_daily.cart_emails_sent + EXCLUDED.cart_emails_sent,
    cart_recovered = metrics_daily.cart_recovered + EXCLUDED.cart_recovered;

  RETURN json_build_object('status', 'ok', 'date', v_today);
END;
$$;


ALTER FUNCTION "public"."log_automation_event"("p_client_id" "uuid", "p_event_category" "text", "p_ticket_type" "text", "p_time_saved_seconds" integer, "p_revenue_amount" numeric, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_ai_recommendation"("p_id" "uuid", "p_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_client_id uuid;
  v_rec       record;
BEGIN
  -- Valider le statut autorisé pour un client
  IF p_status NOT IN ('dismissed', 'implemented') THEN
    RAISE EXCEPTION 'status invalide: seuls dismissed et implemented sont autorisés'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Résoudre le client_id de l'appelant
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE owner_user_id = auth.uid()
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'client introuvable pour cet utilisateur'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Mettre à jour UNIQUEMENT si la recommandation appartient au client
  UPDATE public.ai_recommendations
  SET
    status     = p_status,
    updated_at = now()
  WHERE id        = p_id
    AND client_id = v_client_id
    AND status    = 'active'   -- on ne peut changer que depuis 'active'
  RETURNING id, client_id, status, updated_at
  INTO v_rec;

  IF v_rec IS NULL THEN
    RAISE EXCEPTION 'recommandation introuvable, déjà traitée, ou non autorisée'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object(
    'id',         v_rec.id,
    'status',     v_rec.status,
    'updated_at', v_rec.updated_at
  );
END;
$$;


ALTER FUNCTION "public"."mark_ai_recommendation"("p_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_customer_memories"("p_client_id" "uuid", "p_customer_email" "text", "p_query_embedding" "public"."vector", "p_match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "memory_type" "text", "content" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.memory_type,
    m.content,
    m.metadata,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM customer_memories m
  WHERE m.client_id = p_client_id
    AND m.customer_email = p_customer_email
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;


ALTER FUNCTION "public"."match_customer_memories"("p_client_id" "uuid", "p_customer_email" "text", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_client_metrics"("p_client_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tasks_executed      bigint;
  v_time_saved_minutes  numeric;
  v_estimated_roi       numeric;
  v_active_automations  integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = p_client_id AND c.owner_user_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.client_users cu
       WHERE cu.client_id = p_client_id AND cu.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'ce client ne vous appartient pas'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  SELECT
    COUNT(*)                                                  AS tasks_executed,
    COALESCE(SUM(GREATEST(ROUND(time_saved_seconds::numeric / 60), 1)), 0) AS time_saved_minutes,
    COALESCE(SUM(revenue_amount), 0)                          AS estimated_roi
  INTO v_tasks_executed, v_time_saved_minutes, v_estimated_roi
  FROM public.automation_events
  WHERE client_id = p_client_id
    AND metrics_counted = false;

  IF v_tasks_executed = 0 THEN
    RETURN (
      SELECT jsonb_build_object(
        'tasks_executed',     COALESCE(SUM(tasks_executed), 0),
        'time_saved_minutes', COALESCE(SUM(time_saved_minutes), 0),
        'estimated_roi',      COALESCE(SUM(estimated_roi), 0),
        'active_automations', COALESCE(MAX(active_automations), 0),
        'events_processed',   0
      )
      FROM public.metrics_daily
      WHERE client_id = p_client_id
        AND date >= CURRENT_DATE - INTERVAL '30 days'
    );
  END IF;

  SELECT COALESCE(
    (SELECT active_automations FROM public.metrics_daily
     WHERE client_id = p_client_id
     ORDER BY date DESC LIMIT 1),
    0
  ) INTO v_active_automations;

  INSERT INTO public.metrics_daily (
    client_id, date,
    active_automations, tasks_executed,
    time_saved_minutes, estimated_roi
  )
  VALUES (
    p_client_id, CURRENT_DATE,
    v_active_automations, v_tasks_executed,
    v_time_saved_minutes, v_estimated_roi
  )
  ON CONFLICT (client_id, date) DO UPDATE SET
    tasks_executed     = metrics_daily.tasks_executed     + EXCLUDED.tasks_executed,
    time_saved_minutes = metrics_daily.time_saved_minutes + EXCLUDED.time_saved_minutes,
    estimated_roi      = metrics_daily.estimated_roi      + EXCLUDED.estimated_roi;

  UPDATE public.automation_events
  SET
    metrics_counted = true,
    counted_at      = now()
  WHERE client_id = p_client_id
    AND metrics_counted = false;

  RETURN jsonb_build_object(
    'tasks_executed',     v_tasks_executed,
    'time_saved_minutes', v_time_saved_minutes,
    'estimated_roi',      v_estimated_roi,
    'active_automations', v_active_automations,
    'events_processed',   v_tasks_executed
  );
END;
$$;


ALTER FUNCTION "public"."recompute_client_metrics"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_client_deletion"("p_client_id" "uuid") RETURNS TABLE("etape" "text", "detail" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  etape := 'client marque'; detail := v_nom; return next;

  -- L'agent s'arrete immediatement : le marchand a demande a partir, il ne
  -- doit pas decouvrir que ses clients recoivent encore des reponses.
  update client_settings set agent_enabled = false where client_id = p_client_id;
  etape := 'agent coupe'; detail := 'plus aucune reponse envoyee'; return next;

  return;
end;
$$;


ALTER FUNCTION "public"."request_client_deletion"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_customer_follow_up_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.customer_follow_up is distinct from old.customer_follow_up then
    new.customer_follow_up_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_customer_follow_up_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_ai_reco_implemented"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  -- Transition stricte : seulement la première fois qu'on atteint 'implemented'
  IF NEW.status = 'implemented' AND (OLD.status IS DISTINCT FROM 'implemented') THEN
    -- Les exceptions dans enqueue ne doivent pas annuler le UPDATE de la reco.
    -- On wrappe dans un sous-bloc pour isoler les erreurs.
    BEGIN
      PERFORM public.enqueue_ai_execution_from_reco(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enqueue_ai_execution_from_reco failed for reco %: %',
        NEW.id, SQLERRM;
      -- On laisse le UPDATE réussir quand même → la reco est bien 'implemented'
      -- n8n peut créer la request en polling si besoin
    END;
  END IF;
  RETURN NULL; -- AFTER trigger
END;
$$;


ALTER FUNCTION "public"."trg_fn_ai_reco_implemented"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_call_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_call_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_referrals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_referrals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_deleted_test_accounts_backup" (
    "deleted_at" timestamp with time zone DEFAULT "now"(),
    "kind" "text",
    "payload" "jsonb"
);


ALTER TABLE "public"."_deleted_test_accounts_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "description" "text",
    "cover_image" "text",
    "category" "text" NOT NULL,
    "level" "text" DEFAULT 'beginner'::"text",
    "duration_minutes" integer,
    "module_count" integer DEFAULT 0,
    "is_published" boolean DEFAULT false,
    "is_premium" boolean DEFAULT false,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "academy_courses_level_check" CHECK (("level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."academy_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "course_id" "uuid",
    "progress" "jsonb" DEFAULT '{}'::"jsonb",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "video_url" "text",
    "duration_seconds" integer,
    "transcript" "text",
    "resources" "jsonb" DEFAULT '[]'::"jsonb",
    "quiz" "jsonb",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "client_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_action_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_alert_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_type" "text" NOT NULL,
    "condition" "jsonb" NOT NULL,
    "channel" "text" DEFAULT 'slack'::"text" NOT NULL,
    "target" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "cooldown_minutes" integer DEFAULT 15,
    "last_triggered_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_alert_rules_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['event_threshold'::"text", 'client_metric'::"text", 'engine_error'::"text", 'webhook_failure'::"text"])))
);


ALTER TABLE "public"."admin_alert_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_user_id" "uuid",
    "admin_email" "text",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_audit_log" IS 'Append-only record of destructive/privileged admin actions. Read/insert restricted to admins.';



COMMENT ON COLUMN "public"."admin_audit_log"."action" IS 'Dot-separated event name, e.g. client.delete or keys.rotate.';



COMMENT ON COLUMN "public"."admin_audit_log"."details" IS 'Free-form JSON context (reason, before/after snapshot, etc.).';



CREATE SEQUENCE IF NOT EXISTS "public"."admin_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."admin_audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."admin_audit_log_id_seq" OWNED BY "public"."admin_audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."admin_client_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_email" "text",
    "body" "text" NOT NULL,
    "mentions" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_client_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_impersonation_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_impersonation_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "payload" "jsonb",
    "guardrails" "jsonb",
    "decision" "text",
    "success" boolean NOT NULL,
    "output" "text",
    "error" "text",
    "duration_ms" integer,
    "sandbox_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_action_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_action_logs" IS 'Audit trail of every agentic action executed in an E2B sandbox. Inserts via api/engine/execute-agent-action.js with service_role.';



COMMENT ON COLUMN "public"."agent_action_logs"."action_type" IS 'refund_with_rules | analyze_defect_photo | create_return_label | pause_subscription | edit_address | custom_playbook';



COMMENT ON COLUMN "public"."agent_action_logs"."decision" IS 'For actions that branch: refunded | escalate_human | reject | success | etc.';



COMMENT ON COLUMN "public"."agent_action_logs"."sandbox_id" IS 'E2B sandbox identifier (useful to cross-reference with E2B dashboard logs).';



CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "customer_email" "text",
    "customer_name" "text",
    "customer_message" "text",
    "ai_response" "text",
    "subject" "text",
    "ticket_type" "text",
    "ticket_id" "text",
    "order_id" "text",
    "status" "text" DEFAULT 'resolved'::"text",
    "escalation_reason" "text",
    "human_response" "text",
    "human_responded_at" timestamp with time zone,
    "rating" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "confidence_score" numeric,
    "response_time_ms" integer,
    "added_to_kb" boolean DEFAULT false,
    "session_id" "text",
    "human_response_audio_url" "text",
    "email_message_id" "text",
    "email_references" "text",
    "intent" "text",
    "customer_follow_up" "text",
    "customer_follow_up_at" timestamp with time zone,
    CONSTRAINT "ai_conversations_status_check" CHECK (("status" = ANY (ARRAY['resolved'::"text", 'escalated'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "priority_level" "text" NOT NULL,
    "impact_score" integer NOT NULL,
    "estimated_time_gain_minutes" integer,
    "estimated_revenue_gain" numeric,
    "evidence" "jsonb",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "source_version" "text",
    "fingerprint" "text",
    CONSTRAINT "ai_recommendations_category_check" CHECK (("category" = ANY (ARRAY['growth'::"text", 'efficiency'::"text", 'risk'::"text", 'automation'::"text"]))),
    CONSTRAINT "ai_recommendations_estimated_revenue_gain_check" CHECK (("estimated_revenue_gain" >= (0)::numeric)),
    CONSTRAINT "ai_recommendations_estimated_time_gain_minutes_check" CHECK (("estimated_time_gain_minutes" >= 0)),
    CONSTRAINT "ai_recommendations_impact_score_check" CHECK ((("impact_score" >= 0) AND ("impact_score" <= 100))),
    CONSTRAINT "ai_recommendations_priority_level_check" CHECK (("priority_level" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "ai_recommendations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'dismissed'::"text", 'implemented'::"text"])))
);


ALTER TABLE "public"."ai_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassador_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "network_type" "text",
    "message" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ambassador_applications_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ambassador_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassador_commission_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "note" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ambassador_commission_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'client_paid'::"text", 'j30_started'::"text", 'eligible'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text", 'note_added'::"text"])))
);


ALTER TABLE "public"."ambassador_commission_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassador_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ambassador_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "client_payment_date" timestamp with time zone,
    "eligibility_date" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "admin_note" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ambassador_commissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'waiting_30_days'::"text", 'eligible'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ambassador_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassador_lead_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "note" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ambassador_lead_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['submitted'::"text", 'contacted'::"text", 'qualified'::"text", 'audit_booked'::"text", 'audit_done'::"text", 'closing'::"text", 'won'::"text", 'lost'::"text", 'note_added'::"text"])))
);


ALTER TABLE "public"."ambassador_lead_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassador_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ambassador_id" "uuid" NOT NULL,
    "prospect_name" "text" NOT NULL,
    "prospect_email" "text",
    "prospect_phone" "text",
    "company_name" "text" NOT NULL,
    "company_niche" "text",
    "message" "text",
    "source" "text" DEFAULT 'form'::"text",
    "status" "text" DEFAULT 'submitted'::"text",
    "status_note" "text",
    "admin_note" "text",
    "client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "client_paid_at" timestamp with time zone,
    CONSTRAINT "ambassador_leads_company_niche_check" CHECK (("company_niche" = ANY (ARRAY['ecommerce'::"text", 'immobilier'::"text", 'autre'::"text"]))),
    CONSTRAINT "ambassador_leads_source_check" CHECK (("source" = ANY (ARRAY['form'::"text", 'link'::"text", 'manual'::"text"]))),
    CONSTRAINT "ambassador_leads_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'audit_booked'::"text", 'second_call'::"text", 'client_paid'::"text", 'won'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."ambassador_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassadors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "network_type" "text",
    "siret" "text",
    "ambassador_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "notes_admin" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "iban" "text",
    "bic" "text",
    "iban_holder" "text",
    CONSTRAINT "ambassadors_network_type_check" CHECK (("network_type" = ANY (ARRAY['e-commerce'::"text", 'immobilier'::"text", 'tech'::"text", 'finance'::"text", 'autre'::"text"]))),
    CONSTRAINT "ambassadors_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."ambassadors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_category" "public"."event_category" NOT NULL,
    "ticket_type" "public"."ticket_type",
    "time_saved_seconds" integer DEFAULT 0,
    "revenue_amount" numeric DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metrics_counted" boolean DEFAULT false NOT NULL,
    "counted_at" timestamp with time zone,
    "description" "text",
    "event_type" "text",
    "feedback" "text",
    "feedback_at" timestamp with time zone,
    "event_title" "text",
    "source_channel" "text",
    CONSTRAINT "automation_events_feedback_check" CHECK (("feedback" = ANY (ARRAY['positive'::"text", 'negative'::"text", NULL::"text"])))
);


ALTER TABLE "public"."automation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "filled_by" "uuid",
    "company_name" "text" NOT NULL,
    "website_url" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_phone" "text",
    "vertical" "text" NOT NULL,
    "shopify_store_url" "text",
    "ticketing_tool" "text",
    "monthly_ticket_volume" integer,
    "avg_ticket_time_minutes" integer DEFAULT 5,
    "hourly_support_cost" integer DEFAULT 25,
    "wants_chatbot" boolean DEFAULT false,
    "avg_cart_value" integer,
    "monthly_abandoned_carts" integer,
    "agency_zones" "text",
    "agency_hours" "text",
    "visit_process" "text",
    "agents_names" "text",
    "agents_emails" "text",
    "crm_used" "text",
    "monthly_leads_volume" integer,
    "avg_response_time_hours" integer,
    "hourly_agent_cost" integer DEFAULT 30,
    "support_email" "text",
    "email_sending_preference" "text" DEFAULT 'resend'::"text",
    "smtp_host" "text",
    "smtp_port" integer,
    "smtp_user" "text",
    "smtp_password" "text",
    "url_cgv" "text",
    "url_livraison" "text",
    "url_retours" "text",
    "url_faq" "text",
    "url_about" "text",
    "workflows_requested" "jsonb" DEFAULT '[]'::"jsonb",
    "resend_domain_id" "text",
    "resend_dns_records" "jsonb",
    "resend_domain_verified" boolean DEFAULT false,
    "resend_verified_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "call_notes_email_sending_preference_check" CHECK (("email_sending_preference" = ANY (ARRAY['resend'::"text", 'smtp_client'::"text", 'smtp_actero'::"text"]))),
    CONSTRAINT "call_notes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'complete'::"text", 'deployed'::"text"]))),
    CONSTRAINT "call_notes_ticketing_tool_check" CHECK (("ticketing_tool" = ANY (ARRAY['gorgias'::"text", 'zendesk'::"text", 'freshdesk'::"text", 'email_only'::"text", 'none'::"text", NULL::"text"]))),
    CONSTRAINT "call_notes_vertical_check" CHECK (("vertical" = ANY (ARRAY['ecommerce'::"text", 'immobilier'::"text"])))
);


ALTER TABLE "public"."call_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."churn_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_name" "text",
    "churn_risk" numeric NOT NULL,
    "churn_signals" "jsonb" DEFAULT '[]'::"jsonb",
    "clv_estimate" numeric,
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "predicted_at" timestamp with time zone DEFAULT "now"(),
    "last_order_at" timestamp with time zone,
    "total_orders" integer DEFAULT 0,
    "total_spent" numeric DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "churn_predictions_churn_risk_check" CHECK ((("churn_risk" >= (0)::numeric) AND ("churn_risk" <= (100)::numeric))),
    CONSTRAINT "churn_predictions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'addressed'::"text", 'churned'::"text", 'recovered'::"text"])))
);


ALTER TABLE "public"."churn_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "achievement_key" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."client_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "key_value" "text" NOT NULL,
    "label" "text" DEFAULT 'Cle par defaut'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."client_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_credits" (
    "client_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "total_purchased" integer DEFAULT 0 NOT NULL,
    "total_used" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "stripe_entitlement_id" "text",
    "stripe_feature_id" "text",
    "source" "text" DEFAULT 'stripe'::"text",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_entitlements_source_check" CHECK (("source" = ANY (ARRAY['stripe'::"text", 'manual'::"text", 'plan_fallback'::"text"])))
);


ALTER TABLE "public"."client_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_escalation_thresholds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "order_value_threshold" numeric DEFAULT 0,
    "repeat_customer_orders" integer DEFAULT 0,
    "aggressive_tone_enabled" boolean DEFAULT true,
    "low_confidence_threshold" integer DEFAULT 60,
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_escalation_thresholds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_guardrails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rule_text" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_guardrails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_label" "text",
    "auth_type" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "api_key" "text",
    "extra_config" "jsonb" DEFAULT '{}'::"jsonb",
    "scopes" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "status_message" "text",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "last_checked_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "webhook_secret_encrypted" "text",
    CONSTRAINT "client_integrations_auth_type_check" CHECK (("auth_type" = ANY (ARRAY['oauth'::"text", 'api_key'::"text", 'smtp'::"text"]))),
    CONSTRAINT "client_integrations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'error'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."client_integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_integrations"."webhook_secret_encrypted" IS 'Secret partage des webhooks entrants (ACT-25). Sorti de extra_config, qui est lisible par le navigateur.';



CREATE TABLE IF NOT EXISTS "public"."metrics_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "date" "date",
    "tickets_total" bigint,
    "tickets_auto" bigint,
    "hours_saved" numeric,
    "revenue_recovered" numeric,
    "tickets_escalated" bigint DEFAULT 0,
    "tickets_tracking" bigint DEFAULT 0,
    "tickets_address" bigint DEFAULT 0,
    "tickets_return" bigint DEFAULT 0,
    "tickets_other" bigint DEFAULT 0,
    "cart_emails_sent" bigint DEFAULT 0,
    "cart_recovered" bigint DEFAULT 0,
    "money_saved" numeric DEFAULT 0,
    "avg_response_time_sec" numeric DEFAULT 0,
    "active_automations" integer DEFAULT 0 NOT NULL,
    "tasks_executed" integer DEFAULT 0 NOT NULL,
    "time_saved_minutes" numeric DEFAULT 0 NOT NULL,
    "estimated_roi" numeric DEFAULT 0 NOT NULL,
    "conversations_handled" integer DEFAULT 0,
    "resolution_rate" numeric DEFAULT 0
);


ALTER TABLE "public"."metrics_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."client_metrics_latest" WITH ("security_invoker"='true') AS
 SELECT "client_id",
    ( SELECT "m2"."active_automations"
           FROM "public"."metrics_daily" "m2"
          WHERE (("m2"."client_id" = "m"."client_id") AND ("m2"."date" >= (CURRENT_DATE - '30 days'::interval)))
          ORDER BY "m2"."date" DESC
         LIMIT 1) AS "active_automations",
    "sum"("tasks_executed") AS "tasks_executed",
    "sum"("time_saved_minutes") AS "time_saved_minutes",
    "sum"("estimated_roi") AS "estimated_roi"
   FROM "public"."metrics_daily" "m"
  WHERE ("date" >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY "client_id";


ALTER VIEW "public"."client_metrics_latest" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."client_intelligence_context_30d" WITH ("security_invoker"='true') AS
 SELECT "client_id",
    ("now"() - '30 days'::interval) AS "window_start",
    "now"() AS "window_end",
    "count"("id") AS "total_events_30d",
    "max"("created_at") AS "last_event_at",
    COALESCE("sum"("time_saved_seconds"), (0)::bigint) AS "total_time_saved_seconds_30d",
    COALESCE("sum"("revenue_amount"), (0)::numeric) AS "total_revenue_amount_30d",
    COALESCE(( SELECT "jsonb_agg"("row_to_json"("t".*) ORDER BY "t"."cnt" DESC) AS "jsonb_agg"
           FROM ( SELECT ("ae2"."event_category")::"text" AS "event_category",
                    "count"(*) AS "cnt"
                   FROM "public"."automation_events" "ae2"
                  WHERE (("ae2"."client_id" = "ae"."client_id") AND ("ae2"."created_at" >= ("now"() - '30 days'::interval)))
                  GROUP BY "ae2"."event_category"
                  ORDER BY ("count"(*)) DESC
                 LIMIT 5) "t"), '[]'::"jsonb") AS "top_event_categories",
    COALESCE(( SELECT "jsonb_agg"("row_to_json"("t".*) ORDER BY "t"."cnt" DESC) AS "jsonb_agg"
           FROM ( SELECT ("ae3"."ticket_type")::"text" AS "ticket_type",
                    "count"(*) AS "cnt"
                   FROM "public"."automation_events" "ae3"
                  WHERE (("ae3"."client_id" = "ae"."client_id") AND ("ae3"."created_at" >= ("now"() - '30 days'::interval)))
                  GROUP BY "ae3"."ticket_type"
                  ORDER BY ("count"(*)) DESC
                 LIMIT 5) "t"), '[]'::"jsonb") AS "top_ticket_types",
    COALESCE(( SELECT "jsonb_build_object"('active_automations', "cml"."active_automations", 'tasks_executed', "cml"."tasks_executed", 'time_saved_minutes', "cml"."time_saved_minutes", 'estimated_roi', "cml"."estimated_roi") AS "jsonb_build_object"
           FROM "public"."client_metrics_latest" "cml"
          WHERE ("cml"."client_id" = "ae"."client_id")), '{}'::"jsonb") AS "metrics_latest"
   FROM "public"."automation_events" "ae"
  WHERE ("created_at" >= ("now"() - '30 days'::interval))
  GROUP BY "client_id";


ALTER VIEW "public"."client_intelligence_context_30d" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'faq'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text",
    "external_id" "text",
    "needs_review" boolean DEFAULT false NOT NULL,
    CONSTRAINT "client_knowledge_base_category_check" CHECK (("category" = ANY (ARRAY['policy'::"text", 'faq'::"text", 'product'::"text", 'tone'::"text", 'temporary'::"text"])))
);


ALTER TABLE "public"."client_knowledge_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_n8n_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "n8n_workflow_id" "text" NOT NULL,
    "label" "text",
    "category" "text" DEFAULT 'other'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_n8n_workflows_category_check" CHECK (("category" = ANY (ARRAY['sav'::"text", 'prospection'::"text", 'metrics'::"text", 'intake'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."client_n8n_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "daily_summary" boolean DEFAULT true,
    "weekly_summary" boolean DEFAULT false,
    "monthly_report" boolean DEFAULT true,
    "escalation_alert" boolean DEFAULT true,
    "milestone_alert" boolean DEFAULT true,
    "anomaly_alert" boolean DEFAULT true,
    "urgent_ticket_alert" boolean DEFAULT true,
    "preferred_hour" integer DEFAULT 8,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notification_channels" "jsonb" DEFAULT '{}'::"jsonb",
    "quiet_hours_enabled" boolean DEFAULT false,
    "quiet_hours_start" integer DEFAULT 22,
    "quiet_hours_end" integer DEFAULT 7
);


ALTER TABLE "public"."client_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notifications_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "notification_type" "text" NOT NULL,
    "channel" "text",
    "recipient" "text",
    "subject" "text",
    "body" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'sent'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_notifications_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_response_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "shortcut" "text",
    "body" "text" NOT NULL,
    "category" "text",
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_response_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "hourly_cost" numeric DEFAULT 25 NOT NULL,
    "avg_ticket_time_min" numeric DEFAULT 5 NOT NULL,
    "actero_monthly_price" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_tone" "text" DEFAULT 'professionnel et chaleureux'::"text",
    "brand_language" "text" DEFAULT 'fr'::"text",
    "return_policy" "text" DEFAULT ''::"text",
    "excluded_products" "text" DEFAULT ''::"text",
    "custom_instructions" "text" DEFAULT ''::"text",
    "greeting_template" "text" DEFAULT ''::"text",
    "brand_context" "text",
    "compta_tool" "text",
    "compta_relance_delai" integer DEFAULT 7,
    "compta_alerte_seuil" numeric DEFAULT 1000,
    "compta_export_frequency" "text" DEFAULT 'monthly'::"text",
    "compta_channels" "jsonb" DEFAULT '[]'::"jsonb",
    "brand_identity" "text",
    "tone_style" "text",
    "example_responses" "jsonb" DEFAULT '[]'::"jsonb",
    "product_recommendations_enabled" boolean DEFAULT true,
    "product_tour_completed" boolean DEFAULT false,
    "tested_agent" boolean DEFAULT false,
    "industry_preset_applied" "text",
    "voice_agent_enabled" boolean DEFAULT false,
    "elevenlabs_agent_id" "text",
    "elevenlabs_voice_id" "text",
    "voice_phone_number" "text",
    "voice_phone_number_id" "text",
    "voice_greeting" "text" DEFAULT 'Bonjour, agent vocal IA, comment puis-je vous aider ?'::"text",
    "voice_business_hours" "jsonb",
    "voice_phone_provider" "text" DEFAULT 'twilio'::"text",
    "voice_phone_twilio_sid" "text",
    "voice_phone_country" "text" DEFAULT 'FR'::"text",
    "voice_phone_type" "text",
    "voice_phone_provisioned_at" timestamp with time zone,
    "whatsapp_agent_enabled" boolean DEFAULT false,
    "whatsapp_custom_prompt" "text",
    "whatsapp_greeting" "text" DEFAULT 'Bonjour ! Je suis l''assistant de votre boutique. Comment puis-je vous aider aujourd''hui ?'::"text",
    "widget_api_key" "text",
    "whatsapp_admin_phones" "jsonb" DEFAULT '[]'::"jsonb",
    "voice_sip_phone_number" "text",
    "voice_sip_server" "text",
    "voice_sip_username" "text",
    "voice_sip_password_encrypted" "text",
    "voice_sip_transport" "text" DEFAULT 'UDP'::"text",
    "voice_sip_attached_at" timestamp with time zone,
    "elevenlabs_phone_number_id" "text",
    "email_agent_enabled" boolean DEFAULT false NOT NULL,
    "email_auto_reply_enabled" boolean DEFAULT true NOT NULL,
    "email_confidence_threshold" integer DEFAULT 80 NOT NULL,
    "email_quiet_hours_start" integer,
    "email_quiet_hours_end" integer,
    "email_signature" "text",
    "email_exclusions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "email_send_delay_seconds" integer DEFAULT 0 NOT NULL,
    "email_attach_voice" boolean DEFAULT false NOT NULL,
    "email_last_polled_at" timestamp with time zone,
    "supported_languages" "text"[] DEFAULT ARRAY['fr'::"text", 'en'::"text"],
    "vision_enabled" boolean DEFAULT false NOT NULL,
    "portal_tone" "text" DEFAULT 'tu'::"text" NOT NULL,
    "agent_enabled" boolean DEFAULT true NOT NULL,
    "notifications_enabled" boolean DEFAULT true NOT NULL,
    "email_notifications_enabled" boolean DEFAULT true NOT NULL,
    "slack_ops_enabled" boolean DEFAULT false NOT NULL,
    "slack_ops_canvas_id" "text",
    "slack_ops_canvas_url" "text",
    "slack_ops_last_refreshed_at" timestamp with time zone,
    "linear_auto_issue_enabled" boolean DEFAULT false NOT NULL,
    "linear_api_key_encrypted" "text",
    "linear_team_id" "text",
    "linear_team_name" "text",
    "linear_sentiment_threshold" real DEFAULT '-0.5'::numeric NOT NULL,
    "discount_policy_enabled" boolean DEFAULT false NOT NULL,
    "discount_policy_code" "text",
    "discount_policy_max_pct" real DEFAULT 15 NOT NULL,
    "discount_policy_updated_at" timestamp with time zone,
    "email_last_error" "text",
    "email_last_error_at" timestamp with time zone,
    "email_consecutive_failures" integer DEFAULT 0 NOT NULL,
    "kb_autocrawl_done" boolean DEFAULT false NOT NULL,
    "kb_last_deep_crawl_at" timestamp with time zone,
    "widget_brand_color" "text" DEFAULT '#0F5F35'::"text" NOT NULL,
    "widget_accent_color" "text" DEFAULT '#14A85C'::"text" NOT NULL,
    "widget_position" "text" DEFAULT 'bottom-right'::"text" NOT NULL,
    "widget_greeting" "text" DEFAULT 'Bonjour ! Comment puis-je vous aider ?'::"text" NOT NULL,
    "widget_logo_url" "text",
    "widget_show_powered_by" boolean DEFAULT true NOT NULL,
    "widget_proactive_enabled" boolean DEFAULT false NOT NULL,
    "roi_conservative_mode" boolean DEFAULT false NOT NULL,
    CONSTRAINT "client_settings_portal_tone_check" CHECK (("portal_tone" = ANY (ARRAY['tu'::"text", 'vous'::"text"]))),
    CONSTRAINT "client_settings_widget_position_check" CHECK (("widget_position" = ANY (ARRAY['bottom-right'::"text", 'bottom-left'::"text"])))
);


ALTER TABLE "public"."client_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_settings"."supported_languages" IS 'ISO 639-1 language codes the agent is allowed to respond in when brand_language = multi. Outside this whitelist, the agent falls back to French and offers human escalation.';



COMMENT ON COLUMN "public"."client_settings"."vision_enabled" IS 'Enable Claude Vision analysis on inbound ticket attachments';



COMMENT ON COLUMN "public"."client_settings"."portal_tone" IS 'Customer-facing tone for the portal/widget: tu (informal, default) or vous (formal).';



COMMENT ON COLUMN "public"."client_settings"."agent_enabled" IS 'Master kill-switch — when false, the agent is paused (no auto-replies, no actions). Surfaced in AgentControlCenterView header.';



COMMENT ON COLUMN "public"."client_settings"."notifications_enabled" IS 'Master toggle for in-app notifications.';



COMMENT ON COLUMN "public"."client_settings"."email_notifications_enabled" IS 'Master toggle for email notifications sent to the merchant team.';



COMMENT ON COLUMN "public"."client_settings"."slack_ops_enabled" IS 'When true, the cron-slack-canvas-update job refreshes a Slack Canvas every 15 min for this client.';



COMMENT ON COLUMN "public"."client_settings"."slack_ops_canvas_id" IS 'Slack canvas_id returned by canvases.create — used by canvases.edit on subsequent refreshes.';



COMMENT ON COLUMN "public"."client_settings"."slack_ops_canvas_url" IS 'Permalink to the Slack canvas — surfaced in the dashboard so the merchant can open it in one click.';



COMMENT ON COLUMN "public"."client_settings"."slack_ops_last_refreshed_at" IS 'Wall-clock of the last successful canvas refresh — used to flag stale canvases in the UI.';



COMMENT ON COLUMN "public"."client_settings"."linear_auto_issue_enabled" IS 'When true, escalations with sentiment <= linear_sentiment_threshold push a new Linear issue.';



COMMENT ON COLUMN "public"."client_settings"."linear_api_key_encrypted" IS 'Personal Linear API key, encrypted with the same scheme as Slack/Shopify tokens (api/lib/crypto.js).';



COMMENT ON COLUMN "public"."client_settings"."linear_team_id" IS 'Linear team UUID where issues are created. Resolved at connect time from /api/integrations/linear/connect.';



COMMENT ON COLUMN "public"."client_settings"."linear_team_name" IS 'Cached team display name — surfaced in the dashboard so the merchant sees where issues land.';



COMMENT ON COLUMN "public"."client_settings"."linear_sentiment_threshold" IS 'Only escalations with sentiment_score <= threshold push a Linear issue. -0.5 is moderately negative.';



COMMENT ON COLUMN "public"."client_settings"."discount_policy_enabled" IS 'When true, the agent calls the merchant''s discount policy (executed in an E2B sandbox) to decide cart discounts.';



COMMENT ON COLUMN "public"."client_settings"."discount_policy_code" IS 'Python source code of decide_discount(cart, customer, policy_caps) — executed in an isolated E2B sandbox per call.';



COMMENT ON COLUMN "public"."client_settings"."discount_policy_max_pct" IS 'Hard cap enforced by the wrapper after the policy returns — protects margin even if the policy mis-returns.';



COMMENT ON COLUMN "public"."client_settings"."email_last_error" IS 'Last error message from inbound email poller (IMAP/Gmail). NULL when last poll succeeded. Surfaced in the client dashboard so merchants can self-diagnose mailbox issues (expired password, IONOS rate-limit, etc).';



COMMENT ON COLUMN "public"."client_settings"."email_consecutive_failures" IS 'Number of consecutive poll failures since last success. Used by the inbound poller to skip a mailbox after 10 failures (circuit breaker).';



COMMENT ON COLUMN "public"."client_settings"."widget_brand_color" IS 'Primary color used by the chat widget. Hex string.';



COMMENT ON COLUMN "public"."client_settings"."widget_accent_color" IS 'Accent color used by the chat widget for hover states.';



COMMENT ON COLUMN "public"."client_settings"."widget_position" IS 'Which corner the floating chat bubble sits in.';



COMMENT ON COLUMN "public"."client_settings"."widget_greeting" IS 'Message the agent uses to open the conversation.';



COMMENT ON COLUMN "public"."client_settings"."widget_logo_url" IS 'Optional URL of the merchant logo, displayed inside the widget header.';



COMMENT ON COLUMN "public"."client_settings"."widget_show_powered_by" IS 'Whether the Powered by Actero footer is rendered (forced true on Free/Starter).';



COMMENT ON COLUMN "public"."client_settings"."widget_proactive_enabled" IS 'When true, the SAV chat bubble may show a contextual proactive peek (product/cart pages). Off by default (merchant opt-in).';



COMMENT ON COLUMN "public"."client_settings"."roi_conservative_mode" IS 'ACT-12 : plafonne le temps valorise par ticket a la borne basse defendable (3 min) au lieu du reglage/defaut potentiellement optimiste.';



CREATE TABLE IF NOT EXISTS "public"."client_shopify_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "shop_domain" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "scopes" "text",
    "installed_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_shopify_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_upsells" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "upsell_type" "text" NOT NULL,
    "vertical" "text" DEFAULT 'ecommerce'::"text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "calculated_price" integer,
    "stripe_checkout_session_id" "text",
    "stripe_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_upsells_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'pending'::"text", 'active'::"text", 'canceled'::"text", 'payment_failed'::"text"])))
);


ALTER TABLE "public"."client_upsells" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_users" (
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "invited_at" timestamp with time zone,
    CONSTRAINT "client_users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'operational'::"text", 'support'::"text", 'finance'::"text"])))
);


ALTER TABLE "public"."client_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_webhook_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb",
    "response_status" integer,
    "response_body" "text",
    "duration_ms" integer,
    "succeeded" boolean,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_webhook_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "events" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "secret" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_delivery_at" timestamp with time zone,
    "last_delivery_status" integer,
    "failure_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_webhooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_name" "text" NOT NULL,
    "owner_user_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "client_type" "text" DEFAULT 'ecommerce'::"text" NOT NULL,
    "contact_email" "text",
    "referral_code" "text",
    "deployment_sla_target_minutes" integer DEFAULT 120,
    "payment_received_at" timestamp with time zone,
    "deployment_completed_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "plan_updated_at" timestamp with time zone,
    "referral_first_month_free" boolean DEFAULT false,
    "referred_by_client_id" "uuid",
    "slack_digest_enabled" boolean DEFAULT true NOT NULL,
    "portal_enabled" boolean DEFAULT false NOT NULL,
    "portal_custom_domain" "text",
    "portal_logo_url" "text",
    "portal_primary_color" "text",
    "portal_display_name" "text",
    "slug" "text",
    "portal_hide_actero_branding" boolean DEFAULT false NOT NULL,
    "acquisition_source" "jsonb" DEFAULT '{}'::"jsonb",
    "uninstalled_at" timestamp with time zone,
    "billing_provider" "text",
    "shopify_subscription_id" "text",
    "pending_shopify_subscription_id" "text",
    "billing_period" "text",
    "deletion_requested_at" timestamp with time zone,
    CONSTRAINT "clients_client_type_check" CHECK (("client_type" = ANY (ARRAY['ecommerce'::"text", 'immobilier'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'canceled'::"text", 'past_due'::"text", 'uninstalled'::"text", 'redacted'::"text", 'pending_deletion'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."status" IS 'Cycle de vie du compte. Defaut ''active''. ''inactive'' = abonnement payant termine (api/lib/subscription-plan.js), et RIEN d''autre. ''uninstalled'' = app Shopify retiree, donnees encore presentes. ''redacted'' = shop/redact traite, donnees effacees, ligne conservee pour l''integrite referentielle. api/engine/webhooks/widget.js refuse tout statut autre qu''''active''.';



COMMENT ON COLUMN "public"."clients"."portal_hide_actero_branding" IS 'When true and plan is Pro/Enterprise, the portal footer will not display "Propulsé par Actero".';



COMMENT ON COLUMN "public"."clients"."acquisition_source" IS 'UTM parameters captured at signup: {source, medium, campaign, content, term, referrer, captured_at}.';



COMMENT ON COLUMN "public"."clients"."uninstalled_at" IS 'Timestamp the Shopify app/uninstalled webhook fired for this client. NULL while installed or re-installed.';



COMMENT ON COLUMN "public"."clients"."billing_provider" IS 'Which rail funds this client''s plan. NULL = legacy (assume Stripe). Known values: ''stripe'', ''shopify''.';



COMMENT ON COLUMN "public"."clients"."shopify_subscription_id" IS 'GID of the active AppSubscription on the merchant''s shop. NULL when the client is on Stripe or Free.';



COMMENT ON COLUMN "public"."clients"."pending_shopify_subscription_id" IS 'GID of an AppSubscription created via appSubscriptionCreate but for which the merchant has not yet clicked Accept. Cleared once status flips ACTIVE.';



COMMENT ON COLUMN "public"."clients"."billing_period" IS 'Currently billed cadence — monthly or annual. NULL on Free plan.';



COMMENT ON COLUMN "public"."clients"."deletion_requested_at" IS 'Date de la demande d''effacement (ACT-25). La purge intervient apres le delai de grace.';



CREATE TABLE IF NOT EXISTS "public"."conversation_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "session_id" "text",
    "rating" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_feedback_rating_check" CHECK (("rating" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."conversation_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_feedback" IS 'Per-message CSAT (up/down) from the SAV chat widget. Written by the widget webhook (service role).';



CREATE TABLE IF NOT EXISTS "public"."cost_calculator_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "tickets" integer NOT NULL,
    "ai_percent" integer NOT NULL,
    "source" "text",
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cost_calculator_leads_ai_percent_check" CHECK ((("ai_percent" >= 0) AND ("ai_percent" <= 100))),
    CONSTRAINT "cost_calculator_leads_tickets_check" CHECK ((("tickets" >= 1) AND ("tickets" <= 100000)))
);


ALTER TABLE "public"."cost_calculator_leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."cost_calculator_leads" IS 'Leads captures depuis le calculateur de coût Gorgias (/calculateur-gorgias et embeds). Inserts via api/leads/gorgias-cost-pdf.js avec service_role.';



COMMENT ON COLUMN "public"."cost_calculator_leads"."tickets" IS 'Volume mensuel de tickets saisi par le prospect (1-100000)';



COMMENT ON COLUMN "public"."cost_calculator_leads"."ai_percent" IS 'Pourcentage de résolution IA visé par le prospect (0-100)';



COMMENT ON COLUMN "public"."cost_calculator_leads"."source" IS 'Origine du lead : standalone | alternative_gorgias | vs_gorgias | inline';



CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "balance_after" integer,
    "description" "text",
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "related_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_transactions_type_check" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'usage'::"text", 'refund'::"text", 'bonus'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_email" "text" NOT NULL,
    "memory_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_referenced_at" timestamp with time zone
);


ALTER TABLE "public"."customer_memories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."dashboard_summary" WITH ("security_invoker"='on') AS
 SELECT "c"."id" AS "client_id",
    "c"."brand_name",
    "cs"."hourly_cost",
    "cs"."avg_ticket_time_min",
    "cs"."actero_monthly_price",
    COALESCE("sum"("m"."tickets_auto") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "tickets_auto_this_month",
    COALESCE("sum"("m"."tickets_total") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "tickets_total_this_month",
    COALESCE("sum"("m"."tickets_escalated") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "tickets_escalated_this_month",
    COALESCE("sum"("m"."hours_saved") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "hours_saved_this_month",
    COALESCE("sum"("m"."money_saved") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "money_saved_this_month",
    COALESCE("sum"("m"."revenue_recovered") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "revenue_recovered_this_month",
    COALESCE("sum"("m"."cart_emails_sent") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "cart_emails_this_month",
    COALESCE("sum"("m"."cart_recovered") FILTER (WHERE ("m"."date" >= "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS "cart_recovered_this_month",
    COALESCE("sum"("m"."money_saved") FILTER (WHERE (("m"."date" >= ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND ("m"."date" < "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))), (0)::numeric) AS "money_saved_last_month",
    COALESCE("sum"("m"."tickets_auto") FILTER (WHERE (("m"."date" >= ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval)) AND ("m"."date" < "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))), (0)::numeric) AS "tickets_auto_last_month",
    COALESCE("sum"("m"."money_saved"), (0)::numeric) AS "money_saved_total",
    COALESCE("sum"("m"."revenue_recovered"), (0)::numeric) AS "revenue_recovered_total",
    COALESCE("sum"("m"."hours_saved"), (0)::numeric) AS "hours_saved_total",
    COALESCE("sum"("m"."tickets_auto"), (0)::numeric) AS "tickets_auto_total"
   FROM (("public"."clients" "c"
     LEFT JOIN "public"."client_settings" "cs" ON (("cs"."client_id" = "c"."id")))
     LEFT JOIN "public"."metrics_daily" "m" ON (("m"."client_id" = "c"."id")))
  GROUP BY "c"."id", "c"."brand_name", "cs"."hourly_cost", "cs"."avg_ticket_time_min", "cs"."actero_monthly_price";


ALTER VIEW "public"."dashboard_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deployment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "shop_domain" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deployed_at" timestamp with time zone,
    "workflow_id" "text",
    CONSTRAINT "deployment_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'deployed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."deployment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text",
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "total_duration_ms" integer,
    "workflows_deployed" "jsonb" DEFAULT '[]'::"jsonb",
    "brand_context_generated" boolean DEFAULT false,
    "email_configured" boolean DEFAULT false,
    "tests_passed" integer DEFAULT 0,
    "tests_failed" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deployments_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text", 'completed_with_warnings'::"text"])))
);


ALTER TABLE "public"."deployments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."e2b_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "sandbox_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "progress" integer DEFAULT 0 NOT NULL,
    "progress_message" "text",
    "cost_usd" numeric(10,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    CONSTRAINT "e2b_jobs_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "e2b_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'timeout'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."e2b_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."e2b_jobs" IS 'Background jobs running in E2B sandboxes. See api/lib/e2b-runner.js.';



COMMENT ON COLUMN "public"."e2b_jobs"."progress" IS '0-100. The sandbox script writes incremental progress while running.';



COMMENT ON COLUMN "public"."e2b_jobs"."expires_at" IS 'After this timestamp the watchdog cron will mark the job as timeout and kill its sandbox.';



CREATE TABLE IF NOT EXISTS "public"."email_verification_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "payload" "jsonb",
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_verification_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_action_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."engine_action_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_client_playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "playbook_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT false,
    "custom_config" "jsonb" DEFAULT '{}'::"jsonb",
    "runs_count" integer DEFAULT 0,
    "last_run_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "deactivated_at" timestamp with time zone
);


ALTER TABLE "public"."engine_client_playbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_conversation_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_email" "text",
    "external_ticket_id" "text",
    "source" "text" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "message_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engine_conversation_threads_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved'::"text", 'escalated'::"text"])))
);


ALTER TABLE "public"."engine_conversation_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "normalized" "jsonb" DEFAULT '{}'::"jsonb",
    "playbook_id" "uuid",
    "status" "text" DEFAULT 'received'::"text",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "engine_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'needs_review'::"text", 'dead_letter'::"text", 'pending_delay'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."engine_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "external_ticket_id" "text",
    "conversation_id" "uuid",
    "customer_email" "text",
    "customer_name" "text",
    "subject" "text",
    "message_body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'received'::"text",
    "retry_count" integer DEFAULT 0,
    "last_retry_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engine_messages_source_check" CHECK (("source" = ANY (ARRAY['email'::"text", 'gorgias'::"text", 'zendesk'::"text", 'shopify'::"text", 'whatsapp'::"text", 'web_widget'::"text", 'slack'::"text", 'intercom'::"text", 'crisp'::"text"]))),
    CONSTRAINT "engine_messages_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text", 'escalated'::"text"])))
);


ALTER TABLE "public"."engine_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "event_types" "text"[] DEFAULT '{}'::"text"[],
    "classification_prompt" "text",
    "decision_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "confidence_threshold" double precision DEFAULT 0.85,
    "actions_available" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."engine_playbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "response_text" "text" NOT NULL,
    "confidence_score" numeric(3,2),
    "was_escalated" boolean DEFAULT false,
    "escalation_reason" "text",
    "detected_intent" "text",
    "sentiment_score" integer,
    "injection_detected" boolean DEFAULT false,
    "delivery_channel" "text",
    "delivery_status" "text" DEFAULT 'pending'::"text",
    "delivery_error" "text",
    "delivered_at" timestamp with time zone,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engine_responses_delivery_channel_check" CHECK (("delivery_channel" = ANY (ARRAY['email'::"text", 'gorgias'::"text", 'zendesk'::"text", 'shopify'::"text", 'whatsapp'::"text", 'slack'::"text", 'web_widget'::"text"]))),
    CONSTRAINT "engine_responses_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."engine_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_reviews_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "proposed_action" "jsonb" DEFAULT '{}'::"jsonb",
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "feedback_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engine_reviews_v2_reason_check" CHECK (("reason" = ANY (ARRAY['low_confidence'::"text", 'error'::"text", 'rule'::"text", 'sentiment'::"text", 'injection'::"text", 'human_requested'::"text"]))),
    CONSTRAINT "engine_reviews_v2_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'modified'::"text"])))
);


ALTER TABLE "public"."engine_reviews_v2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_run_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "note" "text",
    "flagged_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engine_run_tags_tag_check" CHECK (("tag" = ANY (ARRAY['hallucination'::"text", 'tone_off'::"text", 'wrong_classification'::"text", 'wrong_action'::"text", 'correct'::"text", 'needs_review'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."engine_run_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_runs_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "playbook_id" "uuid",
    "status" "text" DEFAULT 'running'::"text",
    "classification" "text",
    "confidence" double precision,
    "action_plan" "jsonb" DEFAULT '[]'::"jsonb",
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "duration_ms" integer,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tokens_in" integer,
    "tokens_out" integer,
    "cost_usd" numeric(10,6),
    "model_id" "text",
    "rag_check_score" numeric(5,4),
    "rag_check_flagged" boolean DEFAULT false,
    "rag_check_details" "jsonb",
    "agent_used" "text",
    "error_message" "text",
    CONSTRAINT "engine_runs_v2_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text", 'needs_review'::"text"])))
);


ALTER TABLE "public"."engine_runs_v2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "user_id" "uuid",
    "user_email" "text",
    "brand_name" "text",
    "url" "text",
    "description" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'open'::"text",
    "admin_notes" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "error_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'investigating'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."error_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalation_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "classification" "text",
    "customer_email" "text",
    "customer_name" "text",
    "message_preview" "text",
    "assigned_to" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "linear_issue_id" "text",
    "linear_issue_url" "text",
    "linear_issue_identifier" "text",
    CONSTRAINT "escalation_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "escalation_tickets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."escalation_tickets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."escalation_tickets"."linear_issue_id" IS 'Linear issue UUID — set when auto-push succeeded. NULL means no Linear issue exists for this escalation.';



COMMENT ON COLUMN "public"."escalation_tickets"."linear_issue_identifier" IS 'Human-readable Linear ID (e.g. SUP-123) — used in dashboard links and Slack mentions.';



CREATE TABLE IF NOT EXISTS "public"."funnel_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "email" "text" NOT NULL,
    "setup_price" integer DEFAULT 800 NOT NULL,
    "monthly_price" integer DEFAULT 800 NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "stripe_session_id" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "onboarded_client_id" "uuid",
    "hourly_cost" numeric DEFAULT 0,
    "avg_ticket_time_min" integer DEFAULT 5,
    "actero_monthly_price" numeric DEFAULT 0,
    "client_type" "text" DEFAULT 'ecommerce'::"text" NOT NULL,
    CONSTRAINT "funnel_clients_client_type_check" CHECK (("client_type" = ANY (ARRAY['ecommerce'::"text", 'immobilier'::"text"]))),
    CONSTRAINT "funnel_clients_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'paid'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."funnel_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "source" "text" DEFAULT 'landing_architecture'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leads_brand_name_check" CHECK (("length"(TRIM(BOTH FROM "brand_name")) >= 2)),
    CONSTRAINT "leads_email_check" CHECK (("email" ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'::"text"))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_installs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "client_id" "uuid",
    "installed_at" timestamp with time zone DEFAULT "now"(),
    "paid_amount" numeric DEFAULT 0,
    "commission_amount" numeric DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "marketplace_installs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'uninstalled'::"text"])))
);


ALTER TABLE "public"."marketplace_installs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "client_id" "uuid",
    "rating" integer,
    "review" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketplace_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."marketplace_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_client_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "long_description" "text",
    "category" "text" NOT NULL,
    "industry" "text",
    "preview_image" "text",
    "price" numeric DEFAULT 0,
    "is_published" boolean DEFAULT false,
    "content" "jsonb" NOT NULL,
    "rating" numeric DEFAULT 0,
    "rating_count" integer DEFAULT 0,
    "install_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_actero_pick" boolean DEFAULT false
);


ALTER TABLE "public"."marketplace_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_auth_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "code_challenge" "text",
    "code_challenge_method" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mcp_auth_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "agency_name" "text",
    "contact_email" "text",
    "contact_name" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "first_used_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "notes" "text"
);


ALTER TABLE "public"."partner_access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "company_name" "text" NOT NULL,
    "activity_type" "text",
    "potential_clients" "text",
    "message" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source" "text" DEFAULT 'partner_page'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text",
    "website" "text",
    "linkedin" "text",
    "pitch" "text",
    "experience_years" integer,
    "clients_managed" integer,
    "stripe_session_id" "text",
    "certified_at" timestamp with time zone,
    CONSTRAINT "partner_applications_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text", 'paid'::"text", 'certified'::"text", 'contacted'::"text", 'qualified'::"text", 'won'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."partner_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "client_id" "uuid",
    "amount" numeric NOT NULL,
    "percentage" numeric DEFAULT 20,
    "status" "text" DEFAULT 'pending'::"text",
    "invoice_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "partner_commissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."partner_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "application_id" "uuid",
    "slug" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "company_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "website" "text",
    "linkedin" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "industries" "text"[] DEFAULT '{}'::"text"[],
    "languages" "text"[] DEFAULT ARRAY['fr'::"text"],
    "referral_code" "text" NOT NULL,
    "total_referred" integer DEFAULT 0,
    "active_clients" integer DEFAULT 0,
    "total_commission_earned" numeric DEFAULT 0,
    "rating" numeric DEFAULT 0,
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."poc_funnel_report" WITH ("security_invoker"='true') AS
 SELECT COALESCE(("acquisition_source" ->> 'campaign'::"text"), 'unknown'::"text") AS "campaign",
    "count"(*) AS "signups",
    "count"(*) FILTER (WHERE (EXISTS ( SELECT 1
           FROM "public"."client_integrations" "ci"
          WHERE (("ci"."client_id" = "c"."id") AND ("ci"."provider" = 'shopify'::"text") AND ("ci"."status" = 'connected'::"text"))))) AS "activated",
    "count"(*) FILTER (WHERE (("stripe_subscription_id" IS NOT NULL) AND ("trial_ends_at" IS NOT NULL) AND ("trial_ends_at" > "now"()))) AS "trialing",
    "count"(*) FILTER (WHERE (("plan" <> 'free'::"text") AND ("stripe_subscription_id" IS NOT NULL) AND (("trial_ends_at" IS NULL) OR ("trial_ends_at" <= "now"())) AND ("status" = 'active'::"text"))) AS "paying",
    "min"("created_at") AS "first_signup_at",
    "max"("created_at") AS "last_signup_at"
   FROM "public"."clients" "c"
  GROUP BY COALESCE(("acquisition_source" ->> 'campaign'::"text"), 'unknown'::"text");


ALTER VIEW "public"."poc_funnel_report" OWNER TO "postgres";


COMMENT ON VIEW "public"."poc_funnel_report" IS 'Signup -> activated -> trial -> paying funnel aggregated by UTM campaign. Used for POC 72h daily go/no-go reviews.';



CREATE OR REPLACE VIEW "public"."poc_funnel_report_by_source" WITH ("security_invoker"='true') AS
 SELECT COALESCE(("acquisition_source" ->> 'campaign'::"text"), 'unknown'::"text") AS "campaign",
    COALESCE(("acquisition_source" ->> 'source'::"text"), 'direct'::"text") AS "source",
    COALESCE(("acquisition_source" ->> 'medium'::"text"), 'unknown'::"text") AS "medium",
    COALESCE(("acquisition_source" ->> 'content'::"text"), 'unknown'::"text") AS "content",
    "count"(*) AS "signups",
    "count"(*) FILTER (WHERE (EXISTS ( SELECT 1
           FROM "public"."client_integrations" "ci"
          WHERE (("ci"."client_id" = "c"."id") AND ("ci"."provider" = 'shopify'::"text") AND ("ci"."status" = 'connected'::"text"))))) AS "activated",
    "count"(*) FILTER (WHERE (("stripe_subscription_id" IS NOT NULL) AND ("trial_ends_at" IS NOT NULL) AND ("trial_ends_at" > "now"()))) AS "trialing",
    "count"(*) FILTER (WHERE (("plan" <> 'free'::"text") AND ("stripe_subscription_id" IS NOT NULL) AND (("trial_ends_at" IS NULL) OR ("trial_ends_at" <= "now"())) AND ("status" = 'active'::"text"))) AS "paying"
   FROM "public"."clients" "c"
  GROUP BY COALESCE(("acquisition_source" ->> 'campaign'::"text"), 'unknown'::"text"), COALESCE(("acquisition_source" ->> 'source'::"text"), 'direct'::"text"), COALESCE(("acquisition_source" ->> 'medium'::"text"), 'unknown'::"text"), COALESCE(("acquisition_source" ->> 'content'::"text"), 'unknown'::"text");


ALTER VIEW "public"."poc_funnel_report_by_source" OWNER TO "postgres";


COMMENT ON VIEW "public"."poc_funnel_report_by_source" IS 'Same funnel as poc_funnel_report, broken down by UTM source/medium/content for per-channel analysis.';



CREATE TABLE IF NOT EXISTS "public"."portal_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_email" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_inet" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portal_action_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "ip_inet" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portal_sessions_purpose_check" CHECK (("purpose" = ANY (ARRAY['magic_link'::"text", 'session'::"text"])))
);


ALTER TABLE "public"."portal_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proactive_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "detection_key" "text" NOT NULL,
    "trigger_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "customer_email" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "action_type" "text",
    "action_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "action_body" "text",
    "action_subject" "text",
    "action_error" "text",
    "estimated_value_cents" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone
);


ALTER TABLE "public"."proactive_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proactive_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proactive_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_injection_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "is_injection" boolean DEFAULT false,
    "confidence" numeric(3,2) DEFAULT 0,
    "severity" "text",
    "injection_type" "text",
    "explanation" "text",
    "protection_level" "text" DEFAULT 'advanced'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "prompt_injection_logs_severity_check" CHECK (("severity" = ANY (ARRAY['haute'::"text", 'moyenne'::"text", 'basse'::"text", 'aucune'::"text"])))
);


ALTER TABLE "public"."prompt_injection_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" (
    "key" "text" NOT NULL,
    "hits" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rate_limit_buckets" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limit_buckets" IS 'Compteurs de rate limiting partages entre instances serverless (ACT-20). Ecrit uniquement via consume_rate_limit().';



CREATE TABLE IF NOT EXISTS "public"."referral_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "reward_type" "text" DEFAULT 'stripe_credit'::"text" NOT NULL,
    "amount_cents" integer DEFAULT 0 NOT NULL,
    "stripe_credit_note_id" "text",
    "applied_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."referral_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_client_id" "uuid" NOT NULL,
    "referral_code" "text" NOT NULL,
    "referee_email" "text",
    "referee_name" "text",
    "referee_client_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "referrer_credit_amount" integer DEFAULT 0,
    "referrer_credit_applied" boolean DEFAULT false,
    "referee_setup_waived" boolean DEFAULT false,
    "referral_link" "text",
    "clicked_at" timestamp with time zone,
    "signed_up_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "rewarded_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "referee_first_month_free" boolean DEFAULT false,
    CONSTRAINT "referrals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'clicked'::"text", 'signed_up'::"text", 'paid'::"text", 'rewarded'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "stack" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source" "text" DEFAULT 'dashboard'::"text" NOT NULL,
    "source_id" "uuid",
    "payload" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "requests_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text"]))),
    CONSTRAINT "requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['manual'::"text", 'ai_execution'::"text"]))),
    CONSTRAINT "requests_source_check" CHECK (("source" = ANY (ARRAY['dashboard'::"text", 'intelligence'::"text"]))),
    CONSTRAINT "requests_status_check" CHECK (("status" = ANY (ARRAY['en_attente'::"text", 'en_cours'::"text", 'planifie'::"text", 'termine'::"text", 'echec'::"text"])))
);


ALTER TABLE "public"."requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sentiment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "customer_name" "text",
    "message" "text",
    "score" integer,
    "category" "text",
    "trigger" "text",
    "excerpt" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sentiment_logs_category_check" CHECK (("category" = ANY (ARRAY['tres_positif'::"text", 'positif'::"text", 'neutre'::"text", 'negatif'::"text", 'tres_negatif'::"text"]))),
    CONSTRAINT "sentiment_logs_score_check" CHECK ((("score" >= 1) AND ("score" <= 10)))
);


ALTER TABLE "public"."sentiment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_gdpr_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_type" "text" NOT NULL,
    "shop_domain" "text",
    "customer_email" "text",
    "client_id" "uuid",
    "payload_hash" "text",
    "rows_affected" "jsonb" DEFAULT '{}'::"jsonb",
    "http_status" integer NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    CONSTRAINT "shopify_gdpr_log_webhook_type_check" CHECK (("webhook_type" = ANY (ARRAY['customers/data_request'::"text", 'customers/redact'::"text", 'shop/redact'::"text", 'app/uninstalled'::"text", 'app_subscriptions/update'::"text"])))
);


ALTER TABLE "public"."shopify_gdpr_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."shopify_gdpr_log" IS 'Append-only audit trail for Shopify GDPR / lifecycle webhooks. Never store the raw payload — only its SHA-256 hash plus the action we took.';



CREATE TABLE IF NOT EXISTS "public"."slack_debug_logs" (
    "id" bigint NOT NULL,
    "stage" "text" NOT NULL,
    "payload" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."slack_debug_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."slack_debug_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."slack_debug_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."slack_debug_logs_id_seq" OWNED BY "public"."slack_debug_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."slack_events_seen" (
    "event_id" "text" NOT NULL,
    "team_id" "text",
    "client_id" "uuid",
    "seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."slack_events_seen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."startup_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "boutique_name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "email" "text" NOT NULL,
    "revenue" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "motivation" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "promo_code" "text",
    "stripe_promotion_code_id" "text",
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "accepted_email_sent_at" timestamp with time zone,
    CONSTRAINT "startup_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."startup_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_backtests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "total_tickets" integer DEFAULT 0 NOT NULL,
    "would_resolve_count" integer DEFAULT 0 NOT NULL,
    "would_escalate_count" integer DEFAULT 0 NOT NULL,
    "resolution_rate" numeric(5,2),
    "sample" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "provider" "text",
    "model_id" "text",
    CONSTRAINT "ticket_backtests_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ticket_backtests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "tickets_used" integer DEFAULT 0,
    "voice_minutes_used" numeric DEFAULT 0,
    "whatsapp_messages_used" integer DEFAULT 0,
    "overage_tickets" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "alerted_80_at" timestamp with time zone,
    "alerted_100_at" timestamp with time zone
);


ALTER TABLE "public"."usage_counters" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usage_counters"."alerted_80_at" IS 'When the 80%-of-quota warning was sent for this period (null = not sent).';



COMMENT ON COLUMN "public"."usage_counters"."alerted_100_at" IS 'When the 100%-quota-reached alert was sent for this period (null = not sent).';



CREATE OR REPLACE VIEW "public"."v_admin_mrr_snapshot" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "client_id",
    "c"."brand_name",
    "c"."created_at" AS "signup_at",
    COALESCE("fc"."monthly_price", 0) AS "mrr",
        CASE
            WHEN ("c"."status" = 'churned'::"text") THEN 'churned'::"text"
            WHEN ("c"."created_at" > ("now"() - '30 days'::interval)) THEN 'new'::"text"
            ELSE 'active'::"text"
        END AS "mrr_status"
   FROM ("public"."clients" "c"
     LEFT JOIN "public"."funnel_clients" "fc" ON (("fc"."onboarded_client_id" = "c"."id")));


ALTER VIEW "public"."v_admin_mrr_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vision_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "ticket_id" "uuid",
    "image_path" "text" NOT NULL,
    "image_bytes" integer,
    "result_json" "jsonb" NOT NULL,
    "use_case" "text",
    "is_sensitive_detected" boolean DEFAULT false NOT NULL,
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "cost_eur" numeric(8,5) DEFAULT 0 NOT NULL,
    "model_id" "text",
    "processing_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vision_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_agent_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT false,
    "voice_id" "text" DEFAULT '21m00Tcm4TlvDq8ikWAM'::"text",
    "language" "text" DEFAULT 'fr'::"text",
    "max_duration" integer DEFAULT 5,
    "greeting_message" "text" DEFAULT 'Bonjour, comment puis-je vous aider ?'::"text",
    "escalation_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "knowledge_base" "text",
    "transfer_number" "text",
    "max_amount_before_escalation" numeric
);


ALTER TABLE "public"."voice_agent_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "conversation_id" "text",
    "customer_phone" "text",
    "customer_name" "text",
    "duration_seconds" integer,
    "transcript" "text",
    "summary" "text",
    "sentiment" "text",
    "status" "text",
    "recording_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "elevenlabs_call_id" "text",
    "caller_phone" "text",
    "sentiment_score" integer,
    "classification" "text",
    "cost_usd" numeric,
    "audio_url" "text",
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."voice_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "report_text" "text",
    "voice_id" "text",
    "audio_base64" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events_processed" (
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webhook_events_processed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "waba_id" "text" NOT NULL,
    "phone_number_id" "text" NOT NULL,
    "display_phone_number" "text",
    "verified_name" "text",
    "quality_rating" "text",
    "messaging_tier" "text",
    "access_token_encrypted" "text" NOT NULL,
    "webhook_subscribed" boolean DEFAULT false,
    "pin_configured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "wa_message_id" "text",
    "phone_number_id" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "message_type" "text",
    "body" "text",
    "media_url" "text",
    "template_name" "text",
    "status" "text",
    "error" "text",
    "conversation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "whatsapp_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "url_checked" "text",
    "widget_found" boolean DEFAULT false NOT NULL,
    "widget_visible" boolean DEFAULT false NOT NULL,
    "error" "text",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alerted_at" timestamp with time zone
);


ALTER TABLE "public"."widget_health" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."slack_debug_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."slack_debug_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."academy_courses"
    ADD CONSTRAINT "academy_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_courses"
    ADD CONSTRAINT "academy_courses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."academy_enrollments"
    ADD CONSTRAINT "academy_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_enrollments"
    ADD CONSTRAINT "academy_enrollments_user_email_course_id_key" UNIQUE ("user_email", "course_id");



ALTER TABLE ONLY "public"."academy_modules"
    ADD CONSTRAINT "academy_modules_course_id_slug_key" UNIQUE ("course_id", "slug");



ALTER TABLE ONLY "public"."academy_modules"
    ADD CONSTRAINT "academy_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_action_logs"
    ADD CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_alert_rules"
    ADD CONSTRAINT "admin_alert_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_client_notes"
    ADD CONSTRAINT "admin_client_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_impersonation_tokens"
    ADD CONSTRAINT "admin_impersonation_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_impersonation_tokens"
    ADD CONSTRAINT "admin_impersonation_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."agent_action_logs"
    ADD CONSTRAINT "agent_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_recommendations"
    ADD CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassador_applications"
    ADD CONSTRAINT "ambassador_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassador_commission_events"
    ADD CONSTRAINT "ambassador_commission_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassador_commissions"
    ADD CONSTRAINT "ambassador_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassador_lead_events"
    ADD CONSTRAINT "ambassador_lead_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassador_leads"
    ADD CONSTRAINT "ambassador_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_ambassador_code_key" UNIQUE ("ambassador_code");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_events"
    ADD CONSTRAINT "automation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_notes"
    ADD CONSTRAINT "call_notes_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."call_notes"
    ADD CONSTRAINT "call_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."churn_predictions"
    ADD CONSTRAINT "churn_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_achievements"
    ADD CONSTRAINT "client_achievements_client_id_achievement_key_key" UNIQUE ("client_id", "achievement_key");



ALTER TABLE ONLY "public"."client_achievements"
    ADD CONSTRAINT "client_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_api_keys"
    ADD CONSTRAINT "client_api_keys_key_value_key" UNIQUE ("key_value");



ALTER TABLE ONLY "public"."client_api_keys"
    ADD CONSTRAINT "client_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_credits"
    ADD CONSTRAINT "client_credits_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."client_entitlements"
    ADD CONSTRAINT "client_entitlements_client_id_feature_key_key" UNIQUE ("client_id", "feature_key");



ALTER TABLE ONLY "public"."client_entitlements"
    ADD CONSTRAINT "client_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_escalation_thresholds"
    ADD CONSTRAINT "client_escalation_thresholds_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_escalation_thresholds"
    ADD CONSTRAINT "client_escalation_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_guardrails"
    ADD CONSTRAINT "client_guardrails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_client_id_provider_key" UNIQUE ("client_id", "provider");



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_knowledge_base"
    ADD CONSTRAINT "client_knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_n8n_workflows"
    ADD CONSTRAINT "client_n8n_workflows_client_id_n8n_workflow_id_key" UNIQUE ("client_id", "n8n_workflow_id");



ALTER TABLE ONLY "public"."client_n8n_workflows"
    ADD CONSTRAINT "client_n8n_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notification_preferences"
    ADD CONSTRAINT "client_notification_preferences_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_notification_preferences"
    ADD CONSTRAINT "client_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notifications_log"
    ADD CONSTRAINT "client_notifications_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_response_templates"
    ADD CONSTRAINT "client_response_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_settings"
    ADD CONSTRAINT "client_settings_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."client_settings"
    ADD CONSTRAINT "client_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_shopify_connections"
    ADD CONSTRAINT "client_shopify_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_shopify_connections"
    ADD CONSTRAINT "client_shopify_connections_shop_domain_key" UNIQUE ("shop_domain");



ALTER TABLE ONLY "public"."client_upsells"
    ADD CONSTRAINT "client_upsells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_pkey" PRIMARY KEY ("client_id", "user_id");



ALTER TABLE ONLY "public"."client_webhook_deliveries"
    ADD CONSTRAINT "client_webhook_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_webhooks"
    ADD CONSTRAINT "client_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_owner_user_id_unique" UNIQUE ("owner_user_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_portal_custom_domain_key" UNIQUE ("portal_custom_domain");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_stripe_customer_id_unique" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."conversation_feedback"
    ADD CONSTRAINT "conversation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_calculator_leads"
    ADD CONSTRAINT "cost_calculator_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_memories"
    ADD CONSTRAINT "customer_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deployment_requests"
    ADD CONSTRAINT "deployment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."e2b_jobs"
    ADD CONSTRAINT "e2b_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_codes"
    ADD CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_action_claims"
    ADD CONSTRAINT "engine_action_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_client_playbooks"
    ADD CONSTRAINT "engine_client_playbooks_client_id_playbook_id_key" UNIQUE ("client_id", "playbook_id");



ALTER TABLE ONLY "public"."engine_client_playbooks"
    ADD CONSTRAINT "engine_client_playbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_conversation_threads"
    ADD CONSTRAINT "engine_conversation_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_events"
    ADD CONSTRAINT "engine_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_messages"
    ADD CONSTRAINT "engine_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_playbooks"
    ADD CONSTRAINT "engine_playbooks_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."engine_playbooks"
    ADD CONSTRAINT "engine_playbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_responses"
    ADD CONSTRAINT "engine_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_reviews_v2"
    ADD CONSTRAINT "engine_reviews_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_run_tags"
    ADD CONSTRAINT "engine_run_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_runs_v2"
    ADD CONSTRAINT "engine_runs_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_reports"
    ADD CONSTRAINT "error_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalation_tickets"
    ADD CONSTRAINT "escalation_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funnel_clients"
    ADD CONSTRAINT "funnel_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funnel_clients"
    ADD CONSTRAINT "funnel_clients_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_installs"
    ADD CONSTRAINT "marketplace_installs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_ratings"
    ADD CONSTRAINT "marketplace_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_ratings"
    ADD CONSTRAINT "marketplace_ratings_template_id_client_id_key" UNIQUE ("template_id", "client_id");



ALTER TABLE ONLY "public"."marketplace_templates"
    ADD CONSTRAINT "marketplace_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_templates"
    ADD CONSTRAINT "marketplace_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."mcp_auth_codes"
    ADD CONSTRAINT "mcp_auth_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."mcp_auth_codes"
    ADD CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metrics_daily"
    ADD CONSTRAINT "metrics_daily_client_date_unique" UNIQUE ("client_id", "date");



ALTER TABLE ONLY "public"."metrics_daily"
    ADD CONSTRAINT "metrics_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_access_tokens"
    ADD CONSTRAINT "partner_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_access_tokens"
    ADD CONSTRAINT "partner_access_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."partner_applications"
    ADD CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_commissions"
    ADD CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."portal_action_logs"
    ADD CONSTRAINT "portal_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_sessions"
    ADD CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proactive_events"
    ADD CONSTRAINT "proactive_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proactive_rules"
    ADD CONSTRAINT "proactive_rules_client_id_rule_name_key" UNIQUE ("client_id", "rule_name");



ALTER TABLE ONLY "public"."proactive_rules"
    ADD CONSTRAINT "proactive_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_injection_logs"
    ADD CONSTRAINT "prompt_injection_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sentiment_logs"
    ADD CONSTRAINT "sentiment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_gdpr_log"
    ADD CONSTRAINT "shopify_gdpr_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_debug_logs"
    ADD CONSTRAINT "slack_debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slack_events_seen"
    ADD CONSTRAINT "slack_events_seen_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."startup_applications"
    ADD CONSTRAINT "startup_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_backtests"
    ADD CONSTRAINT "ticket_backtests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_client_id_period_key" UNIQUE ("client_id", "period");



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vision_analyses"
    ADD CONSTRAINT "vision_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_agent_config"
    ADD CONSTRAINT "voice_agent_config_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."voice_agent_config"
    ADD CONSTRAINT "voice_agent_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_calls"
    ADD CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_reports"
    ADD CONSTRAINT "voice_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events_processed"
    ADD CONSTRAINT "webhook_events_processed_pkey" PRIMARY KEY ("provider", "event_id");



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_client_id_waba_id_key" UNIQUE ("client_id", "waba_id");



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_phone_number_id_key" UNIQUE ("phone_number_id");



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_wa_message_id_key" UNIQUE ("wa_message_id");



ALTER TABLE ONLY "public"."widget_health"
    ADD CONSTRAINT "widget_health_pkey" PRIMARY KEY ("id");



CREATE INDEX "agent_action_logs_decision_idx" ON "public"."agent_action_logs" USING "btree" ("merchant_id", "decision", "created_at" DESC);



CREATE INDEX "agent_action_logs_failures_idx" ON "public"."agent_action_logs" USING "btree" ("action_type", "created_at" DESC) WHERE ("success" = false);



CREATE INDEX "agent_action_logs_merchant_created_idx" ON "public"."agent_action_logs" USING "btree" ("merchant_id", "created_at" DESC);



CREATE UNIQUE INDEX "ai_conversations_client_email_message_uniq" ON "public"."ai_conversations" USING "btree" ("client_id", "email_message_id") WHERE (("client_id" IS NOT NULL) AND ("email_message_id" IS NOT NULL));



CREATE UNIQUE INDEX "ai_recommendations_unique_idx" ON "public"."ai_recommendations" USING "btree" ("client_id", "fingerprint");



CREATE INDEX "automation_events_source_channel_idx" ON "public"."automation_events" USING "btree" ("client_id", "source_channel", "created_at" DESC);



CREATE INDEX "clients_deletion_requested_at_idx" ON "public"."clients" USING "btree" ("deletion_requested_at") WHERE ("deletion_requested_at" IS NOT NULL);



CREATE INDEX "clients_shopify_subscription_id_idx" ON "public"."clients" USING "btree" ("shopify_subscription_id") WHERE ("shopify_subscription_id" IS NOT NULL);



CREATE INDEX "cost_calculator_leads_created_idx" ON "public"."cost_calculator_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "cost_calculator_leads_email_created_idx" ON "public"."cost_calculator_leads" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "e2b_jobs_client_idx" ON "public"."e2b_jobs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "e2b_jobs_status_idx" ON "public"."e2b_jobs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE INDEX "e2b_jobs_type_idx" ON "public"."e2b_jobs" USING "btree" ("job_type", "created_at" DESC);



CREATE INDEX "engine_action_claims_client_created_idx" ON "public"."engine_action_claims" USING "btree" ("client_id", "created_at" DESC);



CREATE UNIQUE INDEX "engine_action_claims_event_action_uniq" ON "public"."engine_action_claims" USING "btree" ("event_id", "action");



CREATE INDEX "idx_academy_courses_category" ON "public"."academy_courses" USING "btree" ("category");



CREATE INDEX "idx_academy_courses_published" ON "public"."academy_courses" USING "btree" ("is_published");



CREATE INDEX "idx_academy_enrollments_course_id" ON "public"."academy_enrollments" USING "btree" ("course_id");



CREATE INDEX "idx_academy_enrollments_email" ON "public"."academy_enrollments" USING "btree" ("user_email");



CREATE INDEX "idx_academy_modules_course" ON "public"."academy_modules" USING "btree" ("course_id", "order_index");



CREATE INDEX "idx_admin_action_logs_actor_created" ON "public"."admin_action_logs" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "idx_admin_action_logs_client_created" ON "public"."admin_action_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_admin_action_logs_target" ON "public"."admin_action_logs" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_admin_alert_rules_created_by" ON "public"."admin_alert_rules" USING "btree" ("created_by");



CREATE INDEX "idx_admin_alert_rules_enabled" ON "public"."admin_alert_rules" USING "btree" ("enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_admin_audit_log_action" ON "public"."admin_audit_log" USING "btree" ("action");



CREATE INDEX "idx_admin_audit_log_admin_email" ON "public"."admin_audit_log" USING "btree" ("admin_email");



CREATE INDEX "idx_admin_audit_log_admin_user_id" ON "public"."admin_audit_log" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_audit_log_created_at" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_audit_log_target" ON "public"."admin_audit_log" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_admin_client_notes_author_id" ON "public"."admin_client_notes" USING "btree" ("author_id");



CREATE INDEX "idx_admin_client_notes_client_created" ON "public"."admin_client_notes" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_admin_impersonation_tokens_admin_id" ON "public"."admin_impersonation_tokens" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_impersonation_tokens_client_id" ON "public"."admin_impersonation_tokens" USING "btree" ("client_id");



CREATE INDEX "idx_admin_impersonation_tokens_token" ON "public"."admin_impersonation_tokens" USING "btree" ("token") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_ae_client_category_created" ON "public"."automation_events" USING "btree" ("client_id", "event_category", "created_at" DESC);



CREATE INDEX "idx_ae_client_created" ON "public"."automation_events" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_ae_client_id" ON "public"."automation_events" USING "btree" ("client_id");



CREATE INDEX "idx_ae_client_ticket_created" ON "public"."automation_events" USING "btree" ("client_id", "ticket_type", "created_at" DESC);



CREATE INDEX "idx_ae_uncounted_created" ON "public"."automation_events" USING "btree" ("created_at" DESC) WHERE ("metrics_counted" = false);



CREATE INDEX "idx_ai_conv_client" ON "public"."ai_conversations" USING "btree" ("client_id");



CREATE INDEX "idx_ai_conv_status" ON "public"."ai_conversations" USING "btree" ("client_id", "status");



CREATE INDEX "idx_ai_conversations_customer_email" ON "public"."ai_conversations" USING "btree" ("customer_email") WHERE ("customer_email" IS NOT NULL);



CREATE INDEX "idx_ai_conversations_email_message_id" ON "public"."ai_conversations" USING "btree" ("email_message_id") WHERE ("email_message_id" IS NOT NULL);



CREATE INDEX "idx_ai_conversations_session" ON "public"."ai_conversations" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_airec_client_created" ON "public"."ai_recommendations" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_airec_client_impact" ON "public"."ai_recommendations" USING "btree" ("client_id", "impact_score" DESC);



CREATE INDEX "idx_airec_client_status_created" ON "public"."ai_recommendations" USING "btree" ("client_id", "status", "created_at" DESC);



CREATE INDEX "idx_airec_status_created" ON "public"."ai_recommendations" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_ambassador_commissions_ambassador_id" ON "public"."ambassador_commissions" USING "btree" ("ambassador_id");



CREATE INDEX "idx_ambassador_commissions_client_id" ON "public"."ambassador_commissions" USING "btree" ("client_id");



CREATE INDEX "idx_ambassador_commissions_lead_id" ON "public"."ambassador_commissions" USING "btree" ("lead_id");



CREATE INDEX "idx_ambassador_leads_ambassador_id" ON "public"."ambassador_leads" USING "btree" ("ambassador_id");



CREATE INDEX "idx_ambassador_leads_client_id" ON "public"."ambassador_leads" USING "btree" ("client_id");



CREATE INDEX "idx_ambassadors_user_id" ON "public"."ambassadors" USING "btree" ("user_id");



CREATE INDEX "idx_call_notes_filled_by" ON "public"."call_notes" USING "btree" ("filled_by");



CREATE INDEX "idx_churn_client_risk" ON "public"."churn_predictions" USING "btree" ("client_id", "churn_risk" DESC);



CREATE INDEX "idx_churn_email" ON "public"."churn_predictions" USING "btree" ("client_id", "customer_email");



CREATE INDEX "idx_ckb_needs_review" ON "public"."client_knowledge_base" USING "btree" ("client_id") WHERE ("needs_review" = true);



CREATE INDEX "idx_client_achievements_client" ON "public"."client_achievements" USING "btree" ("client_id", "unlocked_at" DESC);



CREATE INDEX "idx_client_api_keys_client" ON "public"."client_api_keys" USING "btree" ("client_id");



CREATE INDEX "idx_client_api_keys_value" ON "public"."client_api_keys" USING "btree" ("key_value") WHERE ("is_active" = true);



CREATE INDEX "idx_client_integrations_client" ON "public"."client_integrations" USING "btree" ("client_id");



CREATE INDEX "idx_client_integrations_provider" ON "public"."client_integrations" USING "btree" ("client_id", "provider");



CREATE INDEX "idx_client_settings_widget_api_key" ON "public"."client_settings" USING "btree" ("widget_api_key") WHERE ("widget_api_key" IS NOT NULL);



CREATE INDEX "idx_client_shopify_connections_client_id" ON "public"."client_shopify_connections" USING "btree" ("client_id");



CREATE INDEX "idx_client_upsells_client_id" ON "public"."client_upsells" USING "btree" ("client_id");



CREATE INDEX "idx_client_upsells_stripe_session" ON "public"."client_upsells" USING "btree" ("stripe_checkout_session_id");



CREATE INDEX "idx_client_upsells_stripe_sub" ON "public"."client_upsells" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_client_users_client" ON "public"."client_users" USING "btree" ("client_id");



CREATE INDEX "idx_client_users_user" ON "public"."client_users" USING "btree" ("user_id");



CREATE INDEX "idx_client_webhook_deliveries_client_id" ON "public"."client_webhook_deliveries" USING "btree" ("client_id");



CREATE INDEX "idx_client_webhooks_client" ON "public"."client_webhooks" USING "btree" ("client_id") WHERE ("is_active" = true);



CREATE INDEX "idx_client_webhooks_created_by" ON "public"."client_webhooks" USING "btree" ("created_by");



CREATE INDEX "idx_clients_acquisition_campaign" ON "public"."clients" USING "btree" ((("acquisition_source" ->> 'campaign'::"text")));



CREATE INDEX "idx_clients_acquisition_source" ON "public"."clients" USING "btree" ((("acquisition_source" ->> 'source'::"text")));



CREATE INDEX "idx_clients_owner_user_id" ON "public"."clients" USING "btree" ("owner_user_id");



CREATE INDEX "idx_clients_referred_by_client_id" ON "public"."clients" USING "btree" ("referred_by_client_id");



CREATE INDEX "idx_clients_type" ON "public"."clients" USING "btree" ("client_type");



CREATE INDEX "idx_commission_events_commission_id" ON "public"."ambassador_commission_events" USING "btree" ("commission_id");



CREATE INDEX "idx_commission_events_created_at" ON "public"."ambassador_commission_events" USING "btree" ("created_at");



CREATE INDEX "idx_conversation_feedback_client" ON "public"."conversation_feedback" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_credit_tx_client" ON "public"."credit_transactions" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_deployment_requests_client_id" ON "public"."deployment_requests" USING "btree" ("client_id");



CREATE INDEX "idx_deployments_client_id" ON "public"."deployments" USING "btree" ("client_id");



CREATE INDEX "idx_ecp_active" ON "public"."engine_client_playbooks" USING "btree" ("client_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_ecp_client" ON "public"."engine_client_playbooks" USING "btree" ("client_id");



CREATE INDEX "idx_email_verif_email" ON "public"."email_verification_codes" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "idx_engine_client_playbooks_playbook_id" ON "public"."engine_client_playbooks" USING "btree" ("playbook_id");



CREATE INDEX "idx_engine_events_client" ON "public"."engine_events" USING "btree" ("client_id");



CREATE INDEX "idx_engine_events_playbook_id" ON "public"."engine_events" USING "btree" ("playbook_id");



CREATE INDEX "idx_engine_events_status" ON "public"."engine_events" USING "btree" ("status");



CREATE INDEX "idx_engine_events_status_received" ON "public"."engine_events" USING "btree" ("status", "received_at");



CREATE INDEX "idx_engine_events_type" ON "public"."engine_events" USING "btree" ("client_id", "event_type");



CREATE INDEX "idx_engine_messages_client_created" ON "public"."engine_messages" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_engine_messages_client_id" ON "public"."engine_messages" USING "btree" ("client_id");



CREATE INDEX "idx_engine_messages_external_ticket" ON "public"."engine_messages" USING "btree" ("external_ticket_id");



CREATE INDEX "idx_engine_messages_status" ON "public"."engine_messages" USING "btree" ("status");



CREATE INDEX "idx_engine_responses_client_id" ON "public"."engine_responses" USING "btree" ("client_id");



CREATE INDEX "idx_engine_responses_message_id" ON "public"."engine_responses" USING "btree" ("message_id");



CREATE INDEX "idx_engine_reviews_v2_client" ON "public"."engine_reviews_v2" USING "btree" ("client_id");



CREATE INDEX "idx_engine_reviews_v2_event_id" ON "public"."engine_reviews_v2" USING "btree" ("event_id");



CREATE INDEX "idx_engine_reviews_v2_run_id" ON "public"."engine_reviews_v2" USING "btree" ("run_id");



CREATE INDEX "idx_engine_reviews_v2_status" ON "public"."engine_reviews_v2" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_engine_run_tags_flagged_by" ON "public"."engine_run_tags" USING "btree" ("flagged_by");



CREATE INDEX "idx_engine_run_tags_run" ON "public"."engine_run_tags" USING "btree" ("run_id");



CREATE INDEX "idx_engine_run_tags_tag_created" ON "public"."engine_run_tags" USING "btree" ("tag", "created_at" DESC);



CREATE INDEX "idx_engine_runs_v2_agent_used" ON "public"."engine_runs_v2" USING "btree" ("agent_used", "created_at" DESC);



CREATE INDEX "idx_engine_runs_v2_client" ON "public"."engine_runs_v2" USING "btree" ("client_id");



CREATE INDEX "idx_engine_runs_v2_client_created" ON "public"."engine_runs_v2" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_engine_runs_v2_cost" ON "public"."engine_runs_v2" USING "btree" ("client_id", "created_at" DESC) WHERE ("cost_usd" IS NOT NULL);



CREATE INDEX "idx_engine_runs_v2_created" ON "public"."engine_runs_v2" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_engine_runs_v2_event_id" ON "public"."engine_runs_v2" USING "btree" ("event_id");



CREATE INDEX "idx_engine_runs_v2_playbook_id" ON "public"."engine_runs_v2" USING "btree" ("playbook_id");



CREATE INDEX "idx_engine_runs_v2_rag_flagged" ON "public"."engine_runs_v2" USING "btree" ("rag_check_flagged", "created_at" DESC) WHERE ("rag_check_flagged" = true);



CREATE INDEX "idx_engine_runs_v2_status" ON "public"."engine_runs_v2" USING "btree" ("status");



CREATE INDEX "idx_engine_threads_client_active" ON "public"."engine_conversation_threads" USING "btree" ("client_id", "status") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "idx_engine_threads_lookup" ON "public"."engine_conversation_threads" USING "btree" ("client_id", "customer_email", "external_ticket_id") WHERE ("external_ticket_id" IS NOT NULL);



CREATE INDEX "idx_entitlements_client" ON "public"."client_entitlements" USING "btree" ("client_id");



CREATE INDEX "idx_error_reports_client" ON "public"."error_reports" USING "btree" ("client_id");



CREATE INDEX "idx_error_reports_created" ON "public"."error_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_error_reports_resolved_by" ON "public"."error_reports" USING "btree" ("resolved_by");



CREATE INDEX "idx_error_reports_status" ON "public"."error_reports" USING "btree" ("status");



CREATE INDEX "idx_error_reports_user_id" ON "public"."error_reports" USING "btree" ("user_id");



CREATE INDEX "idx_escalation_tickets_client_status" ON "public"."escalation_tickets" USING "btree" ("client_id", "status");



CREATE INDEX "idx_events_feedback" ON "public"."automation_events" USING "btree" ("client_id", "feedback") WHERE ("feedback" IS NOT NULL);



CREATE INDEX "idx_funnel_clients_onboarded_client_id" ON "public"."funnel_clients" USING "btree" ("onboarded_client_id");



CREATE INDEX "idx_funnel_clients_slug" ON "public"."funnel_clients" USING "btree" ("slug");



CREATE INDEX "idx_funnel_clients_type" ON "public"."funnel_clients" USING "btree" ("client_type");



CREATE INDEX "idx_guardrails_client" ON "public"."client_guardrails" USING "btree" ("client_id");



CREATE INDEX "idx_installs_client" ON "public"."marketplace_installs" USING "btree" ("client_id");



CREATE INDEX "idx_installs_template" ON "public"."marketplace_installs" USING "btree" ("template_id");



CREATE INDEX "idx_kb_category" ON "public"."client_knowledge_base" USING "btree" ("client_id", "category");



CREATE INDEX "idx_kb_client_id" ON "public"."client_knowledge_base" USING "btree" ("client_id");



CREATE UNIQUE INDEX "idx_kb_external" ON "public"."client_knowledge_base" USING "btree" ("client_id", "source", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_kb_source" ON "public"."client_knowledge_base" USING "btree" ("client_id", "source") WHERE ("source" IS NOT NULL);



CREATE INDEX "idx_lead_events_created_at" ON "public"."ambassador_lead_events" USING "btree" ("created_at");



CREATE INDEX "idx_lead_events_lead_id" ON "public"."ambassador_lead_events" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_source" ON "public"."leads" USING "btree" ("source");



CREATE INDEX "idx_marketplace_creator" ON "public"."marketplace_templates" USING "btree" ("creator_client_id");



CREATE INDEX "idx_marketplace_published" ON "public"."marketplace_templates" USING "btree" ("is_published", "category");



CREATE INDEX "idx_marketplace_ratings_client_id" ON "public"."marketplace_ratings" USING "btree" ("client_id");



CREATE INDEX "idx_marketplace_templates_actero_pick" ON "public"."marketplace_templates" USING "btree" ("is_actero_pick") WHERE ("is_actero_pick" = true);



CREATE INDEX "idx_mcp_auth_codes_code" ON "public"."mcp_auth_codes" USING "btree" ("code") WHERE ("used" = false);



CREATE INDEX "idx_memories_client_email" ON "public"."customer_memories" USING "btree" ("client_id", "customer_email");



CREATE INDEX "idx_memories_embedding" ON "public"."customer_memories" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_metrics_daily_client_id_date" ON "public"."metrics_daily" USING "btree" ("client_id", "date" DESC);



CREATE INDEX "idx_notif_log_client" ON "public"."client_notifications_log" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_partner_access_tokens_created_by" ON "public"."partner_access_tokens" USING "btree" ("created_by");



CREATE INDEX "idx_partner_applications_user_id" ON "public"."partner_applications" USING "btree" ("user_id");



CREATE INDEX "idx_partner_commissions_client_id" ON "public"."partner_commissions" USING "btree" ("client_id");



CREATE INDEX "idx_partner_commissions_partner_id" ON "public"."partner_commissions" USING "btree" ("partner_id");



CREATE INDEX "idx_partner_tokens_token" ON "public"."partner_access_tokens" USING "btree" ("token") WHERE ("is_active" = true);



CREATE INDEX "idx_partners_application_id" ON "public"."partners" USING "btree" ("application_id");



CREATE INDEX "idx_partners_referral_code" ON "public"."partners" USING "btree" ("referral_code");



CREATE INDEX "idx_partners_slug" ON "public"."partners" USING "btree" ("slug");



CREATE INDEX "idx_proactive_events_client_date" ON "public"."proactive_events" USING "btree" ("client_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_proactive_events_detection" ON "public"."proactive_events" USING "btree" ("client_id", "rule_name", "detection_key");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_prompt_injection_logs_client_id" ON "public"."prompt_injection_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_referral_rewards_client" ON "public"."referral_rewards" USING "btree" ("client_id");



CREATE INDEX "idx_referral_rewards_referral" ON "public"."referral_rewards" USING "btree" ("referral_id");



CREATE INDEX "idx_referrals_code" ON "public"."referrals" USING "btree" ("referral_code");



CREATE INDEX "idx_referrals_referee_client_id" ON "public"."referrals" USING "btree" ("referee_client_id");



CREATE INDEX "idx_referrals_referrer" ON "public"."referrals" USING "btree" ("referrer_client_id");



CREATE INDEX "idx_referrals_status" ON "public"."referrals" USING "btree" ("status");



CREATE INDEX "idx_requests_client_created" ON "public"."requests" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_requests_client_id" ON "public"."requests" USING "btree" ("client_id");



CREATE INDEX "idx_requests_created_at" ON "public"."requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_requests_status_created" ON "public"."requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_sentiment_logs_client_id" ON "public"."sentiment_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_slack_events_seen_at" ON "public"."slack_events_seen" USING "btree" ("seen_at");



CREATE INDEX "idx_slack_events_seen_client_id" ON "public"."slack_events_seen" USING "btree" ("client_id");



CREATE INDEX "idx_startup_applications_email" ON "public"."startup_applications" USING "btree" ("email");



CREATE INDEX "idx_startup_applications_reviewed_by" ON "public"."startup_applications" USING "btree" ("reviewed_by");



CREATE INDEX "idx_startup_applications_status" ON "public"."startup_applications" USING "btree" ("status");



CREATE INDEX "idx_templates_client" ON "public"."client_response_templates" USING "btree" ("client_id", "usage_count" DESC);



CREATE INDEX "idx_widget_health_client_checked" ON "public"."widget_health" USING "btree" ("client_id", "checked_at" DESC);



CREATE INDEX "idx_ticket_backtests_client" ON "public"."ticket_backtests" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_usage_counters_client_period" ON "public"."usage_counters" USING "btree" ("client_id", "period");



CREATE INDEX "idx_voice_calls_client_created" ON "public"."voice_calls" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_voice_reports_client_id" ON "public"."voice_reports" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_webhook_deliveries_webhook" ON "public"."client_webhook_deliveries" USING "btree" ("webhook_id", "created_at" DESC);



CREATE INDEX "idx_webhook_events_processed_at" ON "public"."webhook_events_processed" USING "btree" ("processed_at");



CREATE INDEX "idx_whatsapp_accounts_client" ON "public"."whatsapp_accounts" USING "btree" ("client_id");



CREATE INDEX "idx_whatsapp_accounts_phone_number_id" ON "public"."whatsapp_accounts" USING "btree" ("phone_number_id");



CREATE INDEX "idx_whatsapp_messages_client_created" ON "public"."whatsapp_messages" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_whatsapp_messages_customer_phone" ON "public"."whatsapp_messages" USING "btree" ("customer_phone", "created_at" DESC);



CREATE INDEX "idx_whatsapp_messages_phone_number_id" ON "public"."whatsapp_messages" USING "btree" ("phone_number_id", "created_at" DESC);



CREATE INDEX "idx_widget_health_client" ON "public"."widget_health" USING "btree" ("client_id", "checked_at" DESC);



CREATE UNIQUE INDEX "partner_applications_email_unique" ON "public"."partner_applications" USING "btree" ("email");



CREATE INDEX "partner_applications_status_idx" ON "public"."partner_applications" USING "btree" ("status");



CREATE INDEX "portal_action_logs_customer_idx" ON "public"."portal_action_logs" USING "btree" ("client_id", "lower"("customer_email"), "created_at" DESC);



CREATE INDEX "portal_sessions_client_email_idx" ON "public"."portal_sessions" USING "btree" ("client_id", "lower"("customer_email"));



CREATE INDEX "portal_sessions_expires_idx" ON "public"."portal_sessions" USING "btree" ("expires_at");



CREATE INDEX "portal_sessions_token_idx" ON "public"."portal_sessions" USING "btree" ("token_hash");



CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "public"."rate_limit_buckets" USING "btree" ("reset_at");



CREATE INDEX "shopify_gdpr_log_processed_at_idx" ON "public"."shopify_gdpr_log" USING "btree" ("processed_at" DESC);



CREATE INDEX "shopify_gdpr_log_shop_domain_idx" ON "public"."shopify_gdpr_log" USING "btree" ("shop_domain");



CREATE INDEX "shopify_gdpr_log_webhook_type_idx" ON "public"."shopify_gdpr_log" USING "btree" ("webhook_type");



CREATE UNIQUE INDEX "uidx_requests_intelligence_source_id" ON "public"."requests" USING "btree" ("source_id") WHERE ("source" = 'intelligence'::"text");



CREATE UNIQUE INDEX "uniq_reco_fingerprint" ON "public"."ai_recommendations" USING "btree" ("client_id", (("evidence" ->> 'fingerprint'::"text")));



CREATE INDEX "vision_analyses_client_period_idx" ON "public"."vision_analyses" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "vision_analyses_ticket_idx" ON "public"."vision_analyses" USING "btree" ("ticket_id") WHERE ("ticket_id" IS NOT NULL);



CREATE UNIQUE INDEX "voice_calls_elevenlabs_call_id_key" ON "public"."voice_calls" USING "btree" ("elevenlabs_call_id") WHERE ("elevenlabs_call_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "ai_conversations_followup_timestamp" BEFORE UPDATE ON "public"."ai_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_customer_follow_up_at"();



CREATE OR REPLACE TRIGGER "call_notes_updated_at" BEFORE UPDATE ON "public"."call_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_call_notes_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_rec_updated_at" BEFORE UPDATE ON "public"."ai_recommendations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_reco_implemented" AFTER UPDATE ON "public"."ai_recommendations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_ai_reco_implemented"();



CREATE OR REPLACE TRIGGER "trg_client_settings_updated_at" BEFORE UPDATE ON "public"."client_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fill_actero_monthly_price" BEFORE INSERT OR UPDATE OF "actero_monthly_price" ON "public"."client_settings" FOR EACH ROW EXECUTE FUNCTION "public"."fill_actero_monthly_price"();



CREATE OR REPLACE TRIGGER "trg_referrals_updated_at" BEFORE UPDATE ON "public"."referrals" FOR EACH ROW EXECUTE FUNCTION "public"."update_referrals_updated_at"();



CREATE OR REPLACE TRIGGER "trg_requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_ambassador_commissions_updated_at" BEFORE UPDATE ON "public"."ambassador_commissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ambassador_leads_updated_at" BEFORE UPDATE ON "public"."ambassador_leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ambassadors_updated_at" BEFORE UPDATE ON "public"."ambassadors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_upsells_updated_at" BEFORE UPDATE ON "public"."client_upsells" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."academy_enrollments"
    ADD CONSTRAINT "academy_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_modules"
    ADD CONSTRAINT "academy_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_action_logs"
    ADD CONSTRAINT "admin_action_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_action_logs"
    ADD CONSTRAINT "admin_action_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."admin_alert_rules"
    ADD CONSTRAINT "admin_alert_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_client_notes"
    ADD CONSTRAINT "admin_client_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_client_notes"
    ADD CONSTRAINT "admin_client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_impersonation_tokens"
    ADD CONSTRAINT "admin_impersonation_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_impersonation_tokens"
    ADD CONSTRAINT "admin_impersonation_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_recommendations"
    ADD CONSTRAINT "ai_recommendations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ambassador_commission_events"
    ADD CONSTRAINT "ambassador_commission_events_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."ambassador_commissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ambassador_commissions"
    ADD CONSTRAINT "ambassador_commissions_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ambassadors"("id");



ALTER TABLE ONLY "public"."ambassador_commissions"
    ADD CONSTRAINT "ambassador_commissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ambassador_commissions"
    ADD CONSTRAINT "ambassador_commissions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."ambassador_leads"("id");



ALTER TABLE ONLY "public"."ambassador_lead_events"
    ADD CONSTRAINT "ambassador_lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."ambassador_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ambassador_leads"
    ADD CONSTRAINT "ambassador_leads_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ambassadors"("id");



ALTER TABLE ONLY "public"."ambassador_leads"
    ADD CONSTRAINT "ambassador_leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."automation_events"
    ADD CONSTRAINT "automation_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_notes"
    ADD CONSTRAINT "call_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."call_notes"
    ADD CONSTRAINT "call_notes_filled_by_fkey" FOREIGN KEY ("filled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."churn_predictions"
    ADD CONSTRAINT "churn_predictions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_achievements"
    ADD CONSTRAINT "client_achievements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_api_keys"
    ADD CONSTRAINT "client_api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_credits"
    ADD CONSTRAINT "client_credits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_entitlements"
    ADD CONSTRAINT "client_entitlements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_escalation_thresholds"
    ADD CONSTRAINT "client_escalation_thresholds_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_guardrails"
    ADD CONSTRAINT "client_guardrails_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_integrations"
    ADD CONSTRAINT "client_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_knowledge_base"
    ADD CONSTRAINT "client_knowledge_base_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_n8n_workflows"
    ADD CONSTRAINT "client_n8n_workflows_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notification_preferences"
    ADD CONSTRAINT "client_notification_preferences_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notifications_log"
    ADD CONSTRAINT "client_notifications_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_response_templates"
    ADD CONSTRAINT "client_response_templates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_settings"
    ADD CONSTRAINT "client_settings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_shopify_connections"
    ADD CONSTRAINT "client_shopify_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."client_upsells"
    ADD CONSTRAINT "client_upsells_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_webhook_deliveries"
    ADD CONSTRAINT "client_webhook_deliveries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_webhook_deliveries"
    ADD CONSTRAINT "client_webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."client_webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_webhooks"
    ADD CONSTRAINT "client_webhooks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_webhooks"
    ADD CONSTRAINT "client_webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_referred_by_client_id_fkey" FOREIGN KEY ("referred_by_client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_memories"
    ADD CONSTRAINT "customer_memories_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployment_requests"
    ADD CONSTRAINT "deployment_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."e2b_jobs"
    ADD CONSTRAINT "e2b_jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_action_claims"
    ADD CONSTRAINT "engine_action_claims_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_client_playbooks"
    ADD CONSTRAINT "engine_client_playbooks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_client_playbooks"
    ADD CONSTRAINT "engine_client_playbooks_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."engine_playbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_conversation_threads"
    ADD CONSTRAINT "engine_conversation_threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_events"
    ADD CONSTRAINT "engine_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_events"
    ADD CONSTRAINT "engine_events_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."engine_playbooks"("id");



ALTER TABLE ONLY "public"."engine_messages"
    ADD CONSTRAINT "engine_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_responses"
    ADD CONSTRAINT "engine_responses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_responses"
    ADD CONSTRAINT "engine_responses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."engine_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_reviews_v2"
    ADD CONSTRAINT "engine_reviews_v2_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_reviews_v2"
    ADD CONSTRAINT "engine_reviews_v2_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."engine_events"("id");



ALTER TABLE ONLY "public"."engine_reviews_v2"
    ADD CONSTRAINT "engine_reviews_v2_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."engine_runs_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_run_tags"
    ADD CONSTRAINT "engine_run_tags_flagged_by_fkey" FOREIGN KEY ("flagged_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."engine_run_tags"
    ADD CONSTRAINT "engine_run_tags_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."engine_runs_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_runs_v2"
    ADD CONSTRAINT "engine_runs_v2_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_runs_v2"
    ADD CONSTRAINT "engine_runs_v2_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."engine_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_runs_v2"
    ADD CONSTRAINT "engine_runs_v2_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."engine_playbooks"("id");



ALTER TABLE ONLY "public"."error_reports"
    ADD CONSTRAINT "error_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."error_reports"
    ADD CONSTRAINT "error_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."error_reports"
    ADD CONSTRAINT "error_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."escalation_tickets"
    ADD CONSTRAINT "escalation_tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."funnel_clients"
    ADD CONSTRAINT "funnel_clients_onboarded_client_id_fkey" FOREIGN KEY ("onboarded_client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."marketplace_installs"
    ADD CONSTRAINT "marketplace_installs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_installs"
    ADD CONSTRAINT "marketplace_installs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketplace_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_ratings"
    ADD CONSTRAINT "marketplace_ratings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_ratings"
    ADD CONSTRAINT "marketplace_ratings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketplace_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_templates"
    ADD CONSTRAINT "marketplace_templates_creator_client_id_fkey" FOREIGN KEY ("creator_client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metrics_daily"
    ADD CONSTRAINT "metrics_daily_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_access_tokens"
    ADD CONSTRAINT "partner_access_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."partner_applications"
    ADD CONSTRAINT "partner_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_commissions"
    ADD CONSTRAINT "partner_commissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_commissions"
    ADD CONSTRAINT "partner_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."partner_applications"("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_action_logs"
    ADD CONSTRAINT "portal_action_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_sessions"
    ADD CONSTRAINT "portal_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proactive_events"
    ADD CONSTRAINT "proactive_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proactive_rules"
    ADD CONSTRAINT "proactive_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_injection_logs"
    ADD CONSTRAINT "prompt_injection_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_client_id_fkey" FOREIGN KEY ("referee_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_client_id_fkey" FOREIGN KEY ("referrer_client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sentiment_logs"
    ADD CONSTRAINT "sentiment_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopify_gdpr_log"
    ADD CONSTRAINT "shopify_gdpr_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."slack_events_seen"
    ADD CONSTRAINT "slack_events_seen_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."startup_applications"
    ADD CONSTRAINT "startup_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ticket_backtests"
    ADD CONSTRAINT "ticket_backtests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vision_analyses"
    ADD CONSTRAINT "vision_analyses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vision_analyses"
    ADD CONSTRAINT "vision_analyses_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."ai_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."voice_agent_config"
    ADD CONSTRAINT "voice_agent_config_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_calls"
    ADD CONSTRAINT "voice_calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_reports"
    ADD CONSTRAINT "voice_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widget_health"
    ADD CONSTRAINT "widget_health_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage call notes" ON "public"."call_notes" USING ((("auth"."uid"() IN ( SELECT "clients"."owner_user_id"
   FROM "public"."clients"
  WHERE ("clients"."client_type" = 'admin'::"text"))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "auth"."users"
  WHERE (("users"."raw_user_meta_data" ->> 'is_admin'::"text") = 'true'::"text")))));



CREATE POLICY "Admins can manage workflow mappings" ON "public"."client_n8n_workflows" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins have full access to startup_applications" ON "public"."startup_applications" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage funnel_clients" ON "public"."funnel_clients" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Clients can delete own integrations" ON "public"."client_integrations" FOR DELETE USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients can insert own integrations" ON "public"."client_integrations" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients can update own integrations" ON "public"."client_integrations" FOR UPDATE USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view own integrations" ON "public"."client_integrations" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view their own workflow mappings" ON "public"."client_n8n_workflows" FOR SELECT USING ((("client_id" IN ( SELECT "cu"."client_id"
   FROM "public"."client_users" "cu"
  WHERE ("cu"."user_id" = "auth"."uid"()))) OR ("client_id" IN ( SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))));



CREATE POLICY "Clients insert own notification prefs" ON "public"."client_notification_preferences" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients update own notification prefs" ON "public"."client_notification_preferences" FOR UPDATE USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients view own jobs" ON "public"."e2b_jobs" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients view own notification prefs" ON "public"."client_notification_preferences" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Clients view own vision analyses" ON "public"."vision_analyses" FOR SELECT USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Service role all access funnel_clients" ON "public"."funnel_clients" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access conversations" ON "public"."ai_conversations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access guardrails" ON "public"."client_guardrails" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access integrations" ON "public"."client_integrations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access notif prefs" ON "public"."client_notification_preferences" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access thresholds" ON "public"."client_escalation_thresholds" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages vision analyses" ON "public"."vision_analyses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users manage own guardrails" ON "public"."client_guardrails" USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage own thresholds" ON "public"."client_escalation_thresholds" USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Users update own client conversations" ON "public"."ai_conversations" FOR UPDATE USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))) OR ("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own client conversations" ON "public"."ai_conversations" FOR SELECT USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))) OR ("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."_deleted_test_accounts_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academy_modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin read all" ON "public"."profiles" FOR SELECT USING (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."admin_action_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_alert_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_client_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_impersonation_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_sees_usage" ON "public"."usage_counters" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_read_own" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "admins insert audit log" ON "public"."admin_audit_log" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))) AND ("admin_user_id" = "auth"."uid"())));



CREATE POLICY "admins read action_logs" ON "public"."admin_action_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read alert_rules" ON "public"."admin_alert_rules" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read audit log" ON "public"."admin_audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "admins read run_tags" ON "public"."engine_run_tags" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read+write client_notes" ON "public"."admin_client_notes" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins_all_error_reports" ON "public"."error_reports" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admins_manage_partner_tokens" ON "public"."partner_access_tokens" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "ae_delete_admin" ON "public"."automation_events" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "ae_insert_admin" ON "public"."automation_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "ae_select_admin" ON "public"."automation_events" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "ae_select_client" ON "public"."automation_events" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "ae_select_member" ON "public"."automation_events" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "ae_update_admin" ON "public"."automation_events" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."agent_action_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_conversations_admin_select" ON "public"."ai_conversations" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."ai_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "air_select_member" ON "public"."ai_recommendations" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "airec_delete_admin" ON "public"."ai_recommendations" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "airec_insert_admin" ON "public"."ai_recommendations" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "airec_select_admin" ON "public"."ai_recommendations" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "airec_select_client" ON "public"."ai_recommendations" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "airec_update_admin" ON "public"."ai_recommendations" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."ambassador_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ambassador_applications_admin_select" ON "public"."ambassador_applications" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ambassador_applications_admin_update" ON "public"."ambassador_applications" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ambassador_applications_insert_anon" ON "public"."ambassador_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("email" IS NOT NULL) AND (("length"("email") >= 5) AND ("length"("email") <= 254)) AND ("first_name" IS NOT NULL) AND (("length"("first_name") >= 1) AND ("length"("first_name") <= 100)) AND ("last_name" IS NOT NULL) AND (("length"("last_name") >= 1) AND ("length"("last_name") <= 100))));



ALTER TABLE "public"."ambassador_commission_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ambassador_commissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ambassador_commissions_admin_all" ON "public"."ambassador_commissions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ambassador_commissions_select_own" ON "public"."ambassador_commissions" FOR SELECT USING (("ambassador_id" IN ( SELECT "ambassadors"."id"
   FROM "public"."ambassadors"
  WHERE ("ambassadors"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ambassador_lead_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ambassador_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ambassador_leads_admin_all" ON "public"."ambassador_leads" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ambassador_leads_insert_own" ON "public"."ambassador_leads" FOR INSERT WITH CHECK (("ambassador_id" IN ( SELECT "ambassadors"."id"
   FROM "public"."ambassadors"
  WHERE ("ambassadors"."user_id" = "auth"."uid"()))));



CREATE POLICY "ambassador_leads_select_own" ON "public"."ambassador_leads" FOR SELECT USING (("ambassador_id" IN ( SELECT "ambassadors"."id"
   FROM "public"."ambassadors"
  WHERE ("ambassadors"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ambassadors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ambassadors_admin_all" ON "public"."ambassadors" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ambassadors_select_own" ON "public"."ambassadors" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "applications_insert_public" ON "public"."partner_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("email" IS NOT NULL) AND (("length"("email") >= 5) AND ("length"("email") <= 254))));



CREATE POLICY "applications_self" ON "public"."partner_applications" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."automation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cf_select_client" ON "public"."conversation_feedback" FOR SELECT USING ((("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")) OR ("public"."get_my_role"() = 'admin'::"text")));



CREATE POLICY "churn_owner" ON "public"."churn_predictions" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."churn_predictions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "churn_service" ON "public"."churn_predictions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "client members read own usage" ON "public"."usage_counters" FOR SELECT TO "authenticated" USING ((("client_id" IN ( SELECT "cu"."client_id"
   FROM "public"."client_users" "cu"
  WHERE ("cu"."user_id" = "auth"."uid"())
UNION
 SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_user_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "client members read own voice_calls" ON "public"."voice_calls" FOR SELECT TO "authenticated" USING ((("client_id" IN ( SELECT "cu"."client_id"
   FROM "public"."client_users" "cu"
  WHERE ("cu"."user_id" = "auth"."uid"())
UNION
 SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_user_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "client members read+insert own achievements" ON "public"."client_achievements" TO "authenticated" USING ((("client_id" IN ( SELECT "cu"."client_id"
   FROM "public"."client_users" "cu"
  WHERE ("cu"."user_id" = "auth"."uid"())
UNION
 SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_user_id" = "auth"."uid"()))) OR "public"."is_admin"())) WITH CHECK ((("client_id" IN ( SELECT "cu"."client_id"
   FROM "public"."client_users" "cu"
  WHERE ("cu"."user_id" = "auth"."uid"())
UNION
 SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."owner_user_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "client sees own achievements" ON "public"."client_achievements" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "client sees own voice calls" ON "public"."voice_calls" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "client sees own whatsapp accounts" ON "public"."whatsapp_accounts" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "client sees own whatsapp messages" ON "public"."whatsapp_messages" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."client_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_escalation_thresholds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_guardrails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_injection_logs" ON "public"."prompt_injection_logs" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."client_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_n8n_workflows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notifications_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_playbooks_access" ON "public"."engine_client_playbooks" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."client_response_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_sees_own_api_keys" ON "public"."client_api_keys" USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "client_sees_own_usage" ON "public"."usage_counters" FOR SELECT USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "client_sentiment_logs" ON "public"."sentiment_logs" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."client_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_shopify_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_upsells" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_upsells_select" ON "public"."client_upsells" FOR SELECT USING ((("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))) OR ("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "client_upsells_service" ON "public"."client_upsells" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."client_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_users_own_deliveries" ON "public"."client_webhook_deliveries" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."client_users"
  WHERE (("client_users"."client_id" = "client_webhook_deliveries"."client_id") AND ("client_users"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "client_users_own_webhooks" ON "public"."client_webhooks" USING (((EXISTS ( SELECT 1
   FROM "public"."client_users"
  WHERE (("client_users"."client_id" = "client_webhooks"."client_id") AND ("client_users"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "client_voice_agent_config" ON "public"."voice_agent_config" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "client_voice_reports" ON "public"."voice_reports" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."client_webhook_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete" ON "public"."clients" FOR DELETE USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "clients_insert" ON "public"."clients" FOR INSERT WITH CHECK ((("public"."get_my_role"() = 'admin'::"text") OR ("owner_user_id" = "auth"."uid"())));



CREATE POLICY "clients_insert_own" ON "public"."error_reports" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "clients_read_own" ON "public"."error_reports" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT USING ((("public"."get_my_role"() = 'admin'::"text") OR ("owner_user_id" = "auth"."uid"())));



CREATE POLICY "clients_select_member" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("id"));



CREATE POLICY "clients_update" ON "public"."clients" FOR UPDATE USING ((("public"."get_my_role"() = 'admin'::"text") OR ("owner_user_id" = "auth"."uid"())));



CREATE POLICY "commissions_partner_read" ON "public"."partner_commissions" FOR SELECT USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "commissions_service" ON "public"."partner_commissions" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."conversation_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_calculator_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses_public_read" ON "public"."academy_courses" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cs_delete_admin" ON "public"."client_settings" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "cs_insert_client" ON "public"."client_settings" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "cs_select_admin" ON "public"."client_settings" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "cs_select_client" ON "public"."client_settings" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "cs_select_member" ON "public"."client_settings" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "cs_update_admin" ON "public"."client_settings" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "cs_update_client" ON "public"."client_settings" FOR UPDATE USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "cs_upsert_admin" ON "public"."client_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "cu_del" ON "public"."client_users" FOR DELETE USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "cu_ins" ON "public"."client_users" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "cu_sel" ON "public"."client_users" FOR SELECT USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "cu_srv" ON "public"."client_users" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "cu_upd" ON "public"."client_users" FOR UPDATE USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."customer_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deployment_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deployment_requests_service_only" ON "public"."deployment_requests" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."deployments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deployments_service_only" ON "public"."deployments" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."e2b_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verification_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_action_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_action_claims_service_role" ON "public"."engine_action_claims" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."engine_client_playbooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_conversation_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_messages_client" ON "public"."engine_messages" FOR SELECT USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."engine_playbooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_responses_client" ON "public"."engine_responses" FOR SELECT USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."engine_reviews_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_run_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_runs_v2" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_threads_client" ON "public"."engine_conversation_threads" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."error_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalation_admin_select" ON "public"."escalation_tickets" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."escalation_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalation_tickets_service" ON "public"."escalation_tickets" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "events_admin_select" ON "public"."engine_events" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "events_client" ON "public"."engine_events" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."funnel_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "installs_client_read" ON "public"."marketplace_installs" FOR SELECT USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "installs_service" ON "public"."marketplace_installs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "integrations_admin_select_v2" ON "public"."client_integrations" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "kb_client_access" ON "public"."client_knowledge_base" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_insert_public" ON "public"."leads" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("email" IS NOT NULL) AND (("length"("email") >= 5) AND ("length"("email") <= 254)) AND ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")));



CREATE POLICY "leads_select_admin" ON "public"."leads" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."marketplace_installs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_auth_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mcp_auth_codes_service_all" ON "public"."mcp_auth_codes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "memories_owner" ON "public"."customer_memories" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "memories_service" ON "public"."customer_memories" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."metrics_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metrics_daily_delete" ON "public"."metrics_daily" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "metrics_daily_insert" ON "public"."metrics_daily" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "metrics_daily_update" ON "public"."metrics_daily" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "metrics_select_admin" ON "public"."metrics_daily" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "metrics_select_client" ON "public"."metrics_daily" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "metrics_daily"."client_id") AND ("clients"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "metrics_select_member" ON "public"."metrics_daily" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "modules_public_read" ON "public"."academy_modules" FOR SELECT USING (("course_id" IN ( SELECT "academy_courses"."id"
   FROM "public"."academy_courses"
  WHERE ("academy_courses"."is_published" = true))));



ALTER TABLE "public"."partner_access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partners_public_read" ON "public"."partners" FOR SELECT USING (("is_public" = true));



CREATE POLICY "partners_self_manage" ON "public"."partners" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "playbooks_read" ON "public"."engine_playbooks" FOR SELECT USING (true);



ALTER TABLE "public"."portal_action_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_action_logs admin read" ON "public"."portal_action_logs" FOR SELECT TO "authenticated" USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "portal_action_logs service role only" ON "public"."portal_action_logs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."portal_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_sessions service role only" ON "public"."portal_sessions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."proactive_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proactive_events_client_read" ON "public"."proactive_events" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "proactive_events_service_role" ON "public"."proactive_events" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."proactive_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proactive_rules_client_read" ON "public"."proactive_rules" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"())
UNION
 SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "proactive_rules_service_role" ON "public"."proactive_rules" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_injection_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_client_write" ON "public"."marketplace_ratings" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "ratings_public_read" ON "public"."marketplace_ratings" FOR SELECT USING (true);



CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."referral_rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referral_rewards_insert" ON "public"."referral_rewards" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "referral_rewards_select_own" ON "public"."referral_rewards" FOR SELECT USING ((("client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))) OR ("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referrals_insert" ON "public"."referrals" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("referral_code" IS NOT NULL) AND (("length"("referral_code") >= 3) AND ("length"("referral_code") <= 32))));



CREATE POLICY "referrals_select_own" ON "public"."referrals" FOR SELECT USING ((("referrer_client_id" IN ( SELECT "client_users"."client_id"
   FROM "public"."client_users"
  WHERE ("client_users"."user_id" = "auth"."uid"()))) OR ("referrer_client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "referrals_update" ON "public"."referrals" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "req_delete_admin" ON "public"."requests" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "req_insert_admin" ON "public"."requests" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "req_insert_client" ON "public"."requests" FOR INSERT TO "authenticated" WITH CHECK ((("request_type" = 'manual'::"text") AND ("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "req_insert_member" ON "public"."requests" FOR INSERT TO "authenticated" WITH CHECK ((("request_type" = 'manual'::"text") AND "public"."is_member_of_client"("client_id")));



CREATE POLICY "req_select_admin" ON "public"."requests" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "req_select_client" ON "public"."requests" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "req_update_admin" ON "public"."requests" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "requests_select_member" ON "public"."requests" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "reviews_v2_admin_select" ON "public"."engine_reviews_v2" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "reviews_v2_client" ON "public"."engine_reviews_v2" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "run_tags_admin_insert" ON "public"."engine_run_tags" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "run_tags_admin_select" ON "public"."engine_run_tags" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "runs_v2_admin_select" ON "public"."engine_runs_v2" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "runs_v2_client" ON "public"."engine_runs_v2" USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



ALTER TABLE "public"."sentiment_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role only email_verification_codes" ON "public"."email_verification_codes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role only webhook_events_processed" ON "public"."webhook_events_processed" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only commission_events" ON "public"."ambassador_commission_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only impersonation_tokens" ON "public"."admin_impersonation_tokens" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only lead_events" ON "public"."ambassador_lead_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only notifications_log" ON "public"."client_notifications_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only partner_applications" ON "public"."partner_applications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only whatsapp_accounts" ON "public"."whatsapp_accounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role only whatsapp_messages" ON "public"."whatsapp_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes achievements" ON "public"."client_achievements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes action_logs" ON "public"."admin_action_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes alert_rules" ON "public"."admin_alert_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes client_notes" ON "public"."admin_client_notes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes enrollments" ON "public"."academy_enrollments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes run_tags" ON "public"."engine_run_tags" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes usage_counters" ON "public"."usage_counters" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role writes voice_calls" ON "public"."voice_calls" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."cost_calculator_leads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_agent_action_logs" ON "public"."agent_action_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "settings_admin_select" ON "public"."client_settings" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "shopify_delete_admin" ON "public"."client_shopify_connections" FOR DELETE USING (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."shopify_gdpr_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shopify_gdpr_log_no_public_access" ON "public"."shopify_gdpr_log" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "shopify_insert_admin" ON "public"."client_shopify_connections" FOR INSERT WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "shopify_select_client" ON "public"."client_shopify_connections" FOR SELECT USING (("client_id" IN ( SELECT "public"."get_my_client_ids"() AS "get_my_client_ids")));



CREATE POLICY "shopify_update_admin" ON "public"."client_shopify_connections" FOR UPDATE USING (("public"."get_my_role"() = 'admin'::"text"));



ALTER TABLE "public"."slack_debug_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "slack_debug_logs_service_role" ON "public"."slack_debug_logs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."slack_events_seen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "slack_events_seen_service_role" ON "public"."slack_events_seen" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."startup_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "startup_applications_service_role" ON "public"."startup_applications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "templates_creator_all" ON "public"."marketplace_templates" USING (("creator_client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "templates_owner" ON "public"."client_response_templates" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "templates_public_read" ON "public"."marketplace_templates" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."ticket_backtests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_backtests_admin_read" ON "public"."ticket_backtests" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "ticket_backtests_client_read" ON "public"."ticket_backtests" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "ticket_backtests_member_read" ON "public"."ticket_backtests" FOR SELECT TO "authenticated" USING ("public"."is_member_of_client"("client_id"));



CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."usage_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users read+upsert own enrollments" ON "public"."academy_enrollments" TO "authenticated" USING ((("user_email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") OR "public"."is_admin"())) WITH CHECK ((("user_email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") OR "public"."is_admin"()));



CREATE POLICY "users_view_own_credits" ON "public"."client_credits" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."client_users"
  WHERE (("client_users"."client_id" = "client_credits"."client_id") AND ("client_users"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "users_view_own_entitlements" ON "public"."client_entitlements" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."client_users"
  WHERE (("client_users"."client_id" = "client_entitlements"."client_id") AND ("client_users"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "users_view_own_tx" ON "public"."credit_transactions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."client_users"
  WHERE (("client_users"."client_id" = "credit_transactions"."client_id") AND ("client_users"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."vision_analyses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_agent_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_calls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voice_calls_owner" ON "public"."voice_calls" FOR SELECT USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "voice_calls_service" ON "public"."voice_calls" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."voice_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events_processed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."widget_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "widget_health_admin_read" ON "public"."widget_health" FOR SELECT TO "authenticated" USING ("public"."is_admin"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."automation_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."metrics_daily";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";















































































































































































































REVOKE ALL ON FUNCTION "public"."admin_get_onboarding_status"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_onboarding_status"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_onboard_client"("p_brand_name" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_onboard_client"("p_brand_name" "text", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_resend_magic_link"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_resend_magic_link"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_client_deletion"("p_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_client_deletion"("p_client_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_credits"("p_client_id" "uuid", "p_amount" integer, "p_description" "text", "p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_credits"("p_client_id" "uuid", "p_amount" integer, "p_description" "text", "p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_client_data"("p_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_client_data"("p_client_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_ai_execution_from_reco"("p_reco_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_ai_execution_from_reco"("p_reco_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fill_actero_monthly_price"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fill_actero_monthly_price"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_funnel_client_public"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_funnel_client_public"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_funnel_client_public"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_client_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_client_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_client_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_metrics"("client_uuid" "uuid", "tasks_inc" integer, "minutes_inc" integer, "roi_inc" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_metrics"("client_uuid" "uuid", "tasks_inc" integer, "minutes_inc" integer, "roi_inc" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_ticket_usage"("p_client_id" "uuid", "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_ticket_usage"("p_client_id" "uuid", "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_client"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_client"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_client"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_automation_event"("p_client_id" "uuid", "p_event_category" "text", "p_ticket_type" "text", "p_time_saved_seconds" integer, "p_revenue_amount" numeric, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_automation_event"("p_client_id" "uuid", "p_event_category" "text", "p_ticket_type" "text", "p_time_saved_seconds" integer, "p_revenue_amount" numeric, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_ai_recommendation"("p_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_ai_recommendation"("p_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_ai_recommendation"("p_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_customer_memories"("p_client_id" "uuid", "p_customer_email" "text", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_customer_memories"("p_client_id" "uuid", "p_customer_email" "text", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_customer_memories"("p_client_id" "uuid", "p_customer_email" "text", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_client_metrics"("p_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_client_metrics"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_client_metrics"("p_client_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_client_deletion"("p_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_client_deletion"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_customer_follow_up_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_customer_follow_up_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_customer_follow_up_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_fn_ai_reco_implemented"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_fn_ai_reco_implemented"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_call_notes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_call_notes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_call_notes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_referrals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_referrals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_referrals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."_deleted_test_accounts_backup" TO "service_role";



GRANT ALL ON TABLE "public"."academy_courses" TO "anon";
GRANT ALL ON TABLE "public"."academy_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_courses" TO "service_role";



GRANT ALL ON TABLE "public"."academy_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."academy_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."academy_modules" TO "anon";
GRANT ALL ON TABLE "public"."academy_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_modules" TO "service_role";



GRANT ALL ON TABLE "public"."admin_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_alert_rules" TO "anon";
GRANT ALL ON TABLE "public"."admin_alert_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_alert_rules" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admin_client_notes" TO "anon";
GRANT ALL ON TABLE "public"."admin_client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."admin_impersonation_tokens" TO "anon";
GRANT ALL ON TABLE "public"."admin_impersonation_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_impersonation_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."agent_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."ai_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."ambassador_applications" TO "anon";
GRANT ALL ON TABLE "public"."ambassador_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassador_applications" TO "service_role";



GRANT ALL ON TABLE "public"."ambassador_commission_events" TO "anon";
GRANT ALL ON TABLE "public"."ambassador_commission_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassador_commission_events" TO "service_role";



GRANT ALL ON TABLE "public"."ambassador_commissions" TO "anon";
GRANT ALL ON TABLE "public"."ambassador_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassador_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."ambassador_lead_events" TO "anon";
GRANT ALL ON TABLE "public"."ambassador_lead_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassador_lead_events" TO "service_role";



GRANT ALL ON TABLE "public"."ambassador_leads" TO "anon";
GRANT ALL ON TABLE "public"."ambassador_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassador_leads" TO "service_role";



GRANT ALL ON TABLE "public"."ambassadors" TO "anon";
GRANT ALL ON TABLE "public"."ambassadors" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassadors" TO "service_role";



GRANT ALL ON TABLE "public"."automation_events" TO "anon";
GRANT ALL ON TABLE "public"."automation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_events" TO "service_role";



GRANT ALL ON TABLE "public"."call_notes" TO "anon";
GRANT ALL ON TABLE "public"."call_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."call_notes" TO "service_role";



GRANT ALL ON TABLE "public"."churn_predictions" TO "anon";
GRANT ALL ON TABLE "public"."churn_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."churn_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."client_achievements" TO "anon";
GRANT ALL ON TABLE "public"."client_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."client_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."client_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."client_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."client_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."client_credits" TO "anon";
GRANT ALL ON TABLE "public"."client_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."client_credits" TO "service_role";



GRANT ALL ON TABLE "public"."client_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."client_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."client_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."client_escalation_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."client_escalation_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."client_escalation_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."client_guardrails" TO "anon";
GRANT ALL ON TABLE "public"."client_guardrails" TO "authenticated";
GRANT ALL ON TABLE "public"."client_guardrails" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_integrations" TO "anon";
GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_integrations" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("client_id") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("provider") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("provider_label") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("auth_type") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("extra_config") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("scopes") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("status"),UPDATE("status") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("status_message"),UPDATE("status_message") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("connected_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("expires_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("last_checked_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("last_used_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT SELECT("updated_at"),UPDATE("updated_at") ON TABLE "public"."client_integrations" TO "authenticated";



GRANT ALL ON TABLE "public"."metrics_daily" TO "anon";
GRANT ALL ON TABLE "public"."metrics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."metrics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."client_metrics_latest" TO "anon";
GRANT ALL ON TABLE "public"."client_metrics_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."client_metrics_latest" TO "service_role";



GRANT ALL ON TABLE "public"."client_intelligence_context_30d" TO "service_role";



GRANT ALL ON TABLE "public"."client_knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."client_knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."client_knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."client_n8n_workflows" TO "anon";
GRANT ALL ON TABLE "public"."client_n8n_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."client_n8n_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."client_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."client_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."client_notifications_log" TO "anon";
GRANT ALL ON TABLE "public"."client_notifications_log" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notifications_log" TO "service_role";



GRANT ALL ON TABLE "public"."client_response_templates" TO "anon";
GRANT ALL ON TABLE "public"."client_response_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."client_response_templates" TO "service_role";



GRANT ALL ON TABLE "public"."client_settings" TO "anon";
GRANT ALL ON TABLE "public"."client_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."client_settings" TO "service_role";



GRANT ALL ON TABLE "public"."client_shopify_connections" TO "anon";
GRANT ALL ON TABLE "public"."client_shopify_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."client_shopify_connections" TO "service_role";



GRANT ALL ON TABLE "public"."client_upsells" TO "anon";
GRANT ALL ON TABLE "public"."client_upsells" TO "authenticated";
GRANT ALL ON TABLE "public"."client_upsells" TO "service_role";



GRANT ALL ON TABLE "public"."client_users" TO "anon";
GRANT ALL ON TABLE "public"."client_users" TO "authenticated";
GRANT ALL ON TABLE "public"."client_users" TO "service_role";



GRANT ALL ON TABLE "public"."client_webhook_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."client_webhook_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."client_webhook_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."client_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."client_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."client_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."conversation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."cost_calculator_leads" TO "anon";
GRANT ALL ON TABLE "public"."cost_calculator_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_calculator_leads" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_memories" TO "anon";
GRANT ALL ON TABLE "public"."customer_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_memories" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_summary" TO "service_role";



GRANT ALL ON TABLE "public"."deployment_requests" TO "anon";
GRANT ALL ON TABLE "public"."deployment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deployment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."deployments" TO "anon";
GRANT ALL ON TABLE "public"."deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."deployments" TO "service_role";



GRANT ALL ON TABLE "public"."e2b_jobs" TO "anon";
GRANT ALL ON TABLE "public"."e2b_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."e2b_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."email_verification_codes" TO "anon";
GRANT ALL ON TABLE "public"."email_verification_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verification_codes" TO "service_role";



GRANT ALL ON TABLE "public"."engine_action_claims" TO "service_role";



GRANT ALL ON TABLE "public"."engine_client_playbooks" TO "anon";
GRANT ALL ON TABLE "public"."engine_client_playbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_client_playbooks" TO "service_role";



GRANT ALL ON TABLE "public"."engine_conversation_threads" TO "anon";
GRANT ALL ON TABLE "public"."engine_conversation_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_conversation_threads" TO "service_role";



GRANT ALL ON TABLE "public"."engine_events" TO "anon";
GRANT ALL ON TABLE "public"."engine_events" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_events" TO "service_role";



GRANT ALL ON TABLE "public"."engine_messages" TO "anon";
GRANT ALL ON TABLE "public"."engine_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_messages" TO "service_role";



GRANT ALL ON TABLE "public"."engine_playbooks" TO "anon";
GRANT ALL ON TABLE "public"."engine_playbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_playbooks" TO "service_role";



GRANT ALL ON TABLE "public"."engine_responses" TO "anon";
GRANT ALL ON TABLE "public"."engine_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_responses" TO "service_role";



GRANT ALL ON TABLE "public"."engine_reviews_v2" TO "anon";
GRANT ALL ON TABLE "public"."engine_reviews_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_reviews_v2" TO "service_role";



GRANT ALL ON TABLE "public"."engine_run_tags" TO "anon";
GRANT ALL ON TABLE "public"."engine_run_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_run_tags" TO "service_role";



GRANT ALL ON TABLE "public"."engine_runs_v2" TO "anon";
GRANT ALL ON TABLE "public"."engine_runs_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_runs_v2" TO "service_role";



GRANT ALL ON TABLE "public"."error_reports" TO "anon";
GRANT ALL ON TABLE "public"."error_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."error_reports" TO "service_role";



GRANT ALL ON TABLE "public"."escalation_tickets" TO "anon";
GRANT ALL ON TABLE "public"."escalation_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."escalation_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."funnel_clients" TO "anon";
GRANT ALL ON TABLE "public"."funnel_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."funnel_clients" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_installs" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_installs" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_installs" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_ratings" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_templates" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_templates" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_auth_codes" TO "anon";
GRANT ALL ON TABLE "public"."mcp_auth_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_auth_codes" TO "service_role";



GRANT ALL ON TABLE "public"."partner_access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."partner_access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."partner_applications" TO "anon";
GRANT ALL ON TABLE "public"."partner_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_applications" TO "service_role";



GRANT ALL ON TABLE "public"."partner_commissions" TO "anon";
GRANT ALL ON TABLE "public"."partner_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."partners" TO "anon";
GRANT ALL ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";



GRANT ALL ON TABLE "public"."poc_funnel_report" TO "service_role";



GRANT ALL ON TABLE "public"."poc_funnel_report_by_source" TO "service_role";



GRANT ALL ON TABLE "public"."portal_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."portal_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."portal_sessions" TO "anon";
GRANT ALL ON TABLE "public"."portal_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."proactive_events" TO "anon";
GRANT ALL ON TABLE "public"."proactive_events" TO "authenticated";
GRANT ALL ON TABLE "public"."proactive_events" TO "service_role";



GRANT ALL ON TABLE "public"."proactive_rules" TO "anon";
GRANT ALL ON TABLE "public"."proactive_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."proactive_rules" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_injection_logs" TO "anon";
GRANT ALL ON TABLE "public"."prompt_injection_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_injection_logs" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "service_role";



GRANT ALL ON TABLE "public"."referral_rewards" TO "anon";
GRANT ALL ON TABLE "public"."referral_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."requests" TO "anon";
GRANT ALL ON TABLE "public"."requests" TO "authenticated";
GRANT ALL ON TABLE "public"."requests" TO "service_role";



GRANT ALL ON TABLE "public"."sentiment_logs" TO "anon";
GRANT ALL ON TABLE "public"."sentiment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sentiment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_gdpr_log" TO "anon";
GRANT ALL ON TABLE "public"."shopify_gdpr_log" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_gdpr_log" TO "service_role";



GRANT ALL ON TABLE "public"."slack_debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."slack_debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_debug_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."slack_debug_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."slack_debug_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."slack_debug_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."slack_events_seen" TO "anon";
GRANT ALL ON TABLE "public"."slack_events_seen" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_events_seen" TO "service_role";



GRANT ALL ON TABLE "public"."startup_applications" TO "anon";
GRANT ALL ON TABLE "public"."startup_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."startup_applications" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_backtests" TO "anon";
GRANT ALL ON TABLE "public"."ticket_backtests" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_backtests" TO "service_role";



GRANT ALL ON TABLE "public"."usage_counters" TO "anon";
GRANT ALL ON TABLE "public"."usage_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_counters" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_mrr_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."vision_analyses" TO "anon";
GRANT ALL ON TABLE "public"."vision_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."vision_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."voice_agent_config" TO "anon";
GRANT ALL ON TABLE "public"."voice_agent_config" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_agent_config" TO "service_role";



GRANT ALL ON TABLE "public"."voice_calls" TO "anon";
GRANT ALL ON TABLE "public"."voice_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_calls" TO "service_role";



GRANT ALL ON TABLE "public"."voice_reports" TO "anon";
GRANT ALL ON TABLE "public"."voice_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_reports" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events_processed" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events_processed" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events_processed" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";



GRANT ALL ON TABLE "public"."widget_health" TO "anon";
GRANT ALL ON TABLE "public"."widget_health" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_health" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































