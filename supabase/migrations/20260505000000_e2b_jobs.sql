-- E2B background jobs — track sandbox executions for heavy onboarding /
-- migration / data-processing tasks that exceed Vercel's 60s function limit.
--
-- Design:
--   - Vercel function creates a row with status='queued' and immediately
--     spawns an E2B sandbox that runs autonomously.
--   - The sandbox script writes progress updates back to this table via
--     Supabase REST (using SUPABASE_SERVICE_ROLE_KEY passed as env).
--   - The frontend polls /api/jobs/:id every 5s for progress + status.
--   - The watchdog cron (api/cron/process-e2b-jobs.js) kills sandboxes
--     that finished and marks stuck jobs as 'timeout' after 60 min.
--
-- Job types currently supported:
--   - 'shopify_onboard'   — pull products / customers / orders post-OAuth
--   - 'migrate_gorgias'   — bulk import historical tickets from Gorgias
--   - 'migrate_zendesk'   — bulk import historical tickets from Zendesk
--   - 'migrate_intercom'  — bulk import historical tickets from Intercom

CREATE TABLE IF NOT EXISTS public.e2b_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
  sandbox_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  progress_message TEXT,
  cost_usd NUMERIC(10, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS e2b_jobs_status_idx
  ON public.e2b_jobs(status)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS e2b_jobs_client_idx
  ON public.e2b_jobs(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS e2b_jobs_type_idx
  ON public.e2b_jobs(job_type, created_at DESC);

-- RLS — clients can read their own jobs, service role can do everything.
ALTER TABLE public.e2b_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own jobs" ON public.e2b_jobs;
CREATE POLICY "Clients view own jobs" ON public.e2b_jobs
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_users WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.clients WHERE owner_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.e2b_jobs IS
  'Background jobs running in E2B sandboxes. See api/lib/e2b-runner.js.';

COMMENT ON COLUMN public.e2b_jobs.progress IS
  '0-100. The sandbox script writes incremental progress while running.';

COMMENT ON COLUMN public.e2b_jobs.expires_at IS
  'After this timestamp the watchdog cron will mark the job as timeout and kill its sandbox.';
