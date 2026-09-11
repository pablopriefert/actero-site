-- ACT-24 — `recompute_client_metrics` ne vérifiait pas à qui appartient le client.
--
-- La fonction prend `p_client_id` de l'appelant, est SECURITY DEFINER, et le
-- droit d'exécution a été accordé à `authenticated` en connaissance de cause
-- (20260527000000) parce que le dashboard l'appelle. Mais elle ne vérifie
-- jamais que l'appelant possède ce client.
--
-- Elle ne fait pas que lire. Elle :
--   • renvoie les métriques métier du client (tâches exécutées, temps gagné,
--     et le ROI estimé en euros) ;
--   • écrit dans `metrics_daily` ;
--   • et surtout marque `automation_events.metrics_counted = true`.
--
-- Ce dernier point est le plus nuisible : un appel sur le client d'un autre
-- marchand consomme ses événements non comptés, donc son propre recalcul
-- suivant ne trouve plus rien — et son tableau de bord cesse silencieusement
-- de compter. Une écriture inter-tenant qui casse le reporting d'un tiers.
--
-- Même famille que le défaut du gateway corrigé le 9 septembre : un
-- identifiant fourni par l'appelant, utilisé sans contrôle d'appartenance.
-- L'UUID n'est pas énumérable, ce qui limite la portée, mais le contrôle
-- manquait.
--
-- `mark_ai_recommendation`, elle, est correcte : elle ignore tout identifiant
-- de client et résout le sien depuis auth.uid(). C'est ce modèle qu'on
-- applique ici — en gardant le paramètre, puisque les appels internes en
-- service_role (crons, moteur) n'ont pas de session utilisateur.

create or replace function public.recompute_client_metrics(p_client_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_tasks_executed      bigint;
  v_time_saved_minutes  numeric;
  v_estimated_roi       numeric;
  v_active_automations  integer;
BEGIN
  -- Contrôle d'appartenance. auth.uid() est nul pour les appels internes en
  -- service_role, qui gardent donc l'accès complet ; un appel authentifié doit
  -- porter sur un client que l'appelant possède ou dont il est membre.
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

  -- 1. Agréger les events non comptés pour ce client
  SELECT
    COUNT(*)                                                  AS tasks_executed,
    COALESCE(SUM(GREATEST(ROUND(time_saved_seconds::numeric / 60), 1)), 0) AS time_saved_minutes,
    COALESCE(SUM(revenue_amount), 0)                          AS estimated_roi
  INTO v_tasks_executed, v_time_saved_minutes, v_estimated_roi
  FROM public.automation_events
  WHERE client_id = p_client_id
    AND metrics_counted = false;

  -- Si aucun event non compté, retourner les métriques actuelles sans modifier
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

  -- 2. Récupérer active_automations (dernière valeur ou 0)
  SELECT COALESCE(
    (SELECT active_automations FROM public.metrics_daily
     WHERE client_id = p_client_id
     ORDER BY date DESC LIMIT 1),
    0
  ) INTO v_active_automations;

  -- 3. UPSERT dans metrics_daily (aujourd'hui)
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

  -- 4. Marquer les events comme comptés
  UPDATE public.automation_events
  SET
    metrics_counted = true,
    counted_at      = now()
  WHERE client_id = p_client_id
    AND metrics_counted = false;

  -- 5. Retourner le résumé
  RETURN jsonb_build_object(
    'tasks_executed',     v_tasks_executed,
    'time_saved_minutes', v_time_saved_minutes,
    'estimated_roi',      v_estimated_roi,
    'active_automations', v_active_automations,
    'events_processed',   v_tasks_executed
  );
END;
$function$;

-- Les droits sont inchangés : le dashboard continue d'appeler la fonction.
revoke execute on function public.recompute_client_metrics(uuid) from public, anon;
grant  execute on function public.recompute_client_metrics(uuid) to authenticated, service_role;
