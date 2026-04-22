// Proxy to n8n API — returns workflow list with status
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from './lib/admin-auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return await isActeroAdmin(user, supabase);
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only: exposes n8n workflow data
  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });

  const n8nUrl = process.env.N8N_API_URL;
  const n8nKey = process.env.N8N_API_KEY;

  if (!n8nUrl || !n8nKey) {
    return res.status(500).json({ error: 'N8N_API_URL or N8N_API_KEY not configured' });
  }

  try {
    // Fetch workflows
    const wfRes = await fetch(`${n8nUrl}/api/v1/workflows?limit=100`, {
      headers: { 'X-N8N-API-KEY': n8nKey },
    });
    if (!wfRes.ok) throw new Error(`n8n API error: ${wfRes.status}`);
    const wfData = await wfRes.json();

    // Fetch recent executions (last 50)
    const exRes = await fetch(`${n8nUrl}/api/v1/executions?limit=50`, {
      headers: { 'X-N8N-API-KEY': n8nKey },
    });
    const exData = exRes.ok ? await exRes.json() : { data: [] };

    // Map executions to workflows
    const execByWorkflow = {};
    (exData.data || []).forEach(ex => {
      const wfId = ex.workflowId;
      if (!execByWorkflow[wfId]) execByWorkflow[wfId] = [];
      execByWorkflow[wfId].push({
        id: ex.id,
        status: ex.status || (ex.finished ? (ex.stoppedAt ? 'success' : 'running') : 'error'),
        startedAt: ex.startedAt,
        stoppedAt: ex.stoppedAt,
      });
    });

    const workflows = (wfData.data || []).map(wf => {
      const execs = execByWorkflow[wf.id] || [];
      const lastExec = execs[0] || null;
      const errorCount = execs.filter(e => e.status === 'error').length;
      const successCount = execs.filter(e => e.status === 'success').length;

      return {
        id: wf.id,
        name: wf.name,
        active: wf.active,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        lastExecution: lastExec,
        recentErrorCount: errorCount,
        recentSuccessCount: successCount,
        recentTotal: execs.length,
      };
    });

    return res.status(200).json({ workflows });
  } catch (error) {
    console.error('n8n proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
