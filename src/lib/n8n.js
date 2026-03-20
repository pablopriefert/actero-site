// n8n API client
// Dev: uses Vite proxy at /n8n-proxy/* (avoids CORS, key injected server-side)
// Prod: uses Vercel serverless function at /api/n8n

const isDev = import.meta.env.DEV;

async function n8nFetch(path, options = {}) {
  const url = isDev
    ? `/n8n-proxy${path}`                           // Vite proxy → n8n
    : `/api/n8n?path=${encodeURIComponent(path)}`;   // Vercel serverless → n8n

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`n8n API error: ${res.status}`);
  return res.json();
}

// ── Workflows ──────────────────────────────────────────

export async function getWorkflows() {
  const data = await n8nFetch('/workflows?limit=50');
  return data.data || [];
}

export async function getWorkflow(id) {
  return n8nFetch(`/workflows/${id}`);
}

export async function activateWorkflow(id) {
  return n8nFetch(`/workflows/${id}/activate`, { method: 'POST' });
}

export async function deactivateWorkflow(id) {
  return n8nFetch(`/workflows/${id}/deactivate`, { method: 'POST' });
}

// ── Executions ─────────────────────────────────────────

export async function getExecutions({ workflowId, limit = 20, status } = {}) {
  let path = `/executions?limit=${limit}`;
  if (workflowId) path += `&workflowId=${workflowId}`;
  if (status) path += `&status=${status}`;
  const data = await n8nFetch(path);
  return data.data || [];
}

export async function getExecution(id) {
  return n8nFetch(`/executions/${id}`);
}

// ── Computed helpers ───────────────────────────────────

export function categorizeWorkflows(workflows) {
  const categories = {
    sav: [],          // SAV / Support client
    prospection: [],  // Cold email, lead gen
    metrics: [],      // Metrics, reconciliation
    intake: [],       // Onboarding, forms
    other: [],
  };

  workflows.forEach(w => {
    const name = w.name.toLowerCase();
    if (name.includes('sav') || name.includes('triage') || name.includes('ticket') || name.includes('execution engine'))
      categories.sav.push(w);
    else if (name.includes('prospection') || name.includes('cold email') || name.includes('lead') || name.includes('scrape') || name.includes('apify'))
      categories.prospection.push(w);
    else if (name.includes('metric') || name.includes('reconcile') || name.includes('increment') || name.includes('process automation') || name.includes('log'))
      categories.metrics.push(w);
    else if (name.includes('intake') || name.includes('tally') || name.includes('onboard') || name.includes('create_client'))
      categories.intake.push(w);
    else
      categories.other.push(w);
  });

  return categories;
}

export function computeWorkflowStats(executions) {
  const total = executions.length;
  const success = executions.filter(e => e.status === 'success').length;
  const error = executions.filter(e => e.status === 'error').length;
  const running = executions.filter(e => e.status === 'running').length;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;

  // Average execution time
  const withDuration = executions.filter(e => e.startedAt && e.stoppedAt);
  const avgDurationMs = withDuration.length > 0
    ? withDuration.reduce((sum, e) => sum + (new Date(e.stoppedAt) - new Date(e.startedAt)), 0) / withDuration.length
    : 0;

  return { total, success, error, running, successRate, avgDurationMs };
}
