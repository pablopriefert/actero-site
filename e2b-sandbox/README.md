# Actero — E2B Sandbox Scripts

These Python scripts run inside ephemeral E2B sandboxes spawned by
`api/lib/e2b-runner.js`. They handle long-running, heavy-CPU work that
would exceed Vercel's 60s function limit.

## Architecture

```
[Vercel function]                       [E2B sandbox]
api/jobs/shopify-onboard.js                shopify_onboard.py
api/jobs/migrate-tickets.js                migrate_gorgias.py
                                           migrate_zendesk.py
                                           migrate_intercom.py
```

All scripts share `lib_actero.py` for:
- `job_progress(percent, message, …)` — updates the `e2b_jobs` row
- `supabase_request(method, path, …)` — proxy to Supabase REST
- `safe_main(fn)` — wraps the entry-point so uncaught errors mark the job as failed
- `load_payload()` — reads the JSON `JOB_PAYLOAD` env var

## Required env (passed by `e2b-runner.js`)

| Var                       | Source                                  | Used by         |
| ------------------------- | --------------------------------------- | --------------- |
| `JOB_ID`                  | `e2b_jobs.id` for this run              | all scripts     |
| `JOB_TYPE`                | e.g. `shopify_onboard`                  | all scripts     |
| `JOB_PAYLOAD`             | JSON-encoded options                    | all scripts     |
| `SUPABASE_URL`            | env                                     | all scripts     |
| `SUPABASE_SERVICE_KEY`    | env                                     | all scripts     |
| `CLIENT_ID`               | UUID of the Actero client               | all scripts     |
| `SHOPIFY_ACCESS_TOKEN`    | decrypted from `client_shopify_connections.access_token` | onboard |
| `SHOPIFY_SHOP_DOMAIN`     | e.g. `myshop.myshopify.com`             | onboard         |
| `GORGIAS_SUBDOMAIN`       | from migration form                     | gorgias         |
| `GORGIAS_EMAIL`           | from migration form                     | gorgias         |
| `GORGIAS_API_KEY`         | from migration form                     | gorgias         |
| `ZENDESK_SUBDOMAIN`       | from migration form                     | zendesk         |
| `ZENDESK_EMAIL`           | from migration form                     | zendesk         |
| `ZENDESK_API_TOKEN`       | from migration form                     | zendesk         |
| `INTERCOM_TOKEN`          | from migration form                     | intercom        |

> ⚠️ Helpdesk credentials are NEVER persisted to the database — they live
> only in the sandbox env for the lifetime of the sandbox.

## Local dev / debugging

To run a script locally (without spawning a real sandbox), set the env
vars manually and execute:

```bash
JOB_ID=00000000-0000-0000-0000-000000000000 \
JOB_TYPE=shopify_onboard \
JOB_PAYLOAD='{"shop_domain":"…","sync_range":"30d"}' \
SUPABASE_URL=… \
SUPABASE_SERVICE_KEY=… \
CLIENT_ID=… \
SHOPIFY_ACCESS_TOKEN=… \
SHOPIFY_SHOP_DOMAIN=… \
python e2b-sandbox/scripts/shopify_onboard.py
```

## Deploying script changes

The scripts are read from disk at sandbox-spawn time by
`api/lib/e2b-runner.js`, so a Vercel deploy ships any updates. There is
no separate "build" step — `package.json` references to `actero-shopify-sav`
were experiments that never shipped and can be safely removed.

## Cost guardrails

- Each sandbox auto-kills at the timeout passed by the spawning endpoint
  (default 30 min for onboarding, 4h for migrations).
- The `process-e2b-jobs` cron (every 5 min) sweeps:
  - jobs whose `expires_at` has passed → `status='timeout'` + sandbox kill
  - sandboxes whose job is already `completed/failed/cancelled` → kill
  - orphan sandboxes with no matching job row → kill
- Typical cost: $0.05–$0.30 per onboarding, $0.50–$3 per full migration.

## Adding a new sandbox script

1. Create `e2b-sandbox/scripts/your_script.py` and import `lib_actero`.
2. Add a Vercel endpoint in `api/jobs/` that calls
   `spawnJob({ scriptName: 'your_script.py', … })`.
3. Add a `job_type` value (and optionally a CHECK constraint) so the
   watchdog cron knows about it.
