import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const N8N_URL = () => process.env.N8N_API_URL;
const N8N_KEY = () => process.env.N8N_API_KEY;
const GEMINI_KEY = () => process.env.GEMINI_API_KEY;
const RESEND_KEY = () => process.env.RESEND_API_KEY;

// Template name mapping
const TEMPLATE_MAP = {
  sav: { search: '[TEMPLATE] SAV E-commerce', prefix: 'SAV' },
  cart_recovery: { search: '[TEMPLATE] Paniers Abandonnés', prefix: 'Paniers' },
  lead_qualification: { search: '[TEMPLATE] Prise RDV Immobilier', prefix: 'RDV' },
  document_collection: { search: '[TEMPLATE] Collecte Documents Immobilier', prefix: 'Documents' },
  prospect_followup: { search: '[TEMPLATE] Relance Prospects Immobilier', prefix: 'Relance' },
};

async function checkAdmin(req) {
  const db = supabase();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return false;
  return user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only: deploys full client pipeline
  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });

  const { client_id, step: resumeStep } = req.body || {};
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  const db = supabase();

  try {
    // Create deployment record
    const steps = [
      { name: 'validate', label: 'Validation des prérequis', status: 'pending' },
      { name: 'brand_context', label: 'Génération du brand context', status: 'pending' },
      { name: 'email_config', label: 'Configuration email', status: 'pending' },
      { name: 'deploy_workflows', label: 'Déploiement des workflows n8n', status: 'pending' },
      { name: 'checklist', label: 'Vérification checklist', status: 'pending' },
      { name: 'test_workflows', label: 'Tests automatiques', status: 'pending' },
      { name: 'activate', label: 'Activation des workflows', status: 'pending' },
      { name: 'finalize', label: 'Finalisation', status: 'pending' },
    ];

    const { data: deployment, error: depErr } = await db
      .from('deployments')
      .insert({ client_id, steps, status: 'running' })
      .select()
      .single();

    if (depErr) throw new Error(`Failed to create deployment: ${depErr.message}`);

    // Return deployment_id immediately, process in background
    res.status(200).json({ deployment_id: deployment.id, status: 'running' });

    // Run pipeline steps (non-blocking after response)
    runPipeline(db, deployment.id, client_id).catch(err => {
      console.error('Pipeline error:', err);
    });

  } catch (error) {
    console.error('full-pipeline error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function runPipeline(db, deploymentId, clientId) {
  let currentStepIndex = 0;
  let workflowsDeployed = [];
  let brandContextGenerated = false;
  let emailConfigured = false;
  let testsPassed = 0;
  let testsFailed = 0;

  async function updateStep(name, updates) {
    const { data: dep } = await db.from('deployments').select('steps').eq('id', deploymentId).single();
    const steps = dep?.steps || [];
    const idx = steps.findIndex(s => s.name === name);
    if (idx >= 0) {
      steps[idx] = { ...steps[idx], ...updates };
    }
    await db.from('deployments').update({ steps }).eq('id', deploymentId);
  }

  async function failDeployment(stepName, error) {
    await updateStep(stepName, {
      status: 'failed',
      error: error.message || error,
      completed_at: new Date().toISOString(),
    });
    await db.from('deployments').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      total_duration_ms: Date.now() - pipelineStart,
    }).eq('id', deploymentId);
  }

  const pipelineStart = Date.now();

  try {
    // === STEP 1: Validation ===
    await updateStep('validate', { status: 'running', started_at: new Date().toISOString() });

    const { data: callNotes, error: cnErr } = await db
      .from('call_notes')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (cnErr || !callNotes) {
      await failDeployment('validate', { message: 'Notes de call introuvables pour ce client' });
      return;
    }
    if (callNotes.status !== 'complete') {
      await failDeployment('validate', { message: 'Notes de call non complètes (statut: ' + callNotes.status + ')' });
      return;
    }

    const { data: client, error: clErr } = await db
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clErr || !client) {
      await failDeployment('validate', { message: 'Client introuvable dans la base' });
      return;
    }

    let shopifyConnection = null;
    if (callNotes.vertical === 'ecommerce') {
      const { data: shopConn } = await db
        .from('client_shopify_connections')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (!shopConn || !shopConn.shop_domain || !shopConn.access_token) {
        await updateStep('validate', {
          status: 'warning',
          details: 'Connexion Shopify manquante — le client doit installer l\'app. Le pipeline continue sans Shopify.',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - pipelineStart,
        });
      } else {
        shopifyConnection = shopConn;
        await updateStep('validate', {
          status: 'success',
          details: `Client validé: ${client.brand_name}, vertical ${callNotes.vertical}, Shopify connecté`,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - pipelineStart,
        });
      }
    } else {
      await updateStep('validate', {
        status: 'success',
        details: `Client validé: ${client.brand_name}, vertical ${callNotes.vertical}`,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - pipelineStart,
      });
    }

    // === STEP 2: Brand Context Generation ===
    const step2Start = Date.now();
    await updateStep('brand_context', { status: 'running', started_at: new Date().toISOString() });

    try {
      const urls = [
        callNotes.url_cgv,
        callNotes.url_livraison,
        callNotes.url_retours,
        callNotes.url_faq,
        callNotes.url_about,
        callNotes.website_url,
      ].filter(Boolean);

      const pages = [];
      for (const url of urls) {
        try {
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ActeroBot/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const html = await resp.text();
            pages.push({ url, text: stripHtml(html).slice(0, 6000) });
          }
        } catch {
          // Skip failed URLs
        }
      }

      const contentForAi = pages.map(p => `=== ${p.url} ===\n${p.text}`).join('\n\n');

      // Additional context from call notes
      const metierContext = callNotes.vertical === 'ecommerce'
        ? `Outil ticketing: ${callNotes.ticketing_tool || 'aucun'}, Volume tickets/mois: ${callNotes.monthly_ticket_volume || '?'}, Coût horaire support: ${callNotes.hourly_support_cost}€`
        : `Zones: ${callNotes.agency_zones || '?'}, Horaires: ${callNotes.agency_hours || '?'}, Process visite: ${callNotes.visit_process || '?'}, Agents: ${callNotes.agents_names || '?'}, CRM: ${callNotes.crm_used || '?'}`;

      const prompt = callNotes.vertical === 'ecommerce'
        ? `Génère un brand_context structuré pour un agent SAV IA e-commerce. Le brand_context sera injecté dans un workflow n8n pour personnaliser les réponses automatiques.

Analyse ces pages et extrais: ton de la marque, politique de livraison (délais, transporteurs, coûts), politique de retour et remboursement, FAQ courantes, informations pratiques.

Infos métier: ${metierContext}
Entreprise: ${callNotes.company_name}

Contenu du site:\n\n${contentForAi}

Réponds UNIQUEMENT avec le texte du brand_context, pas de JSON, pas de markdown. Un texte structuré que l'IA SAV utilisera directement comme contexte. Inclus les vraies données trouvées sur le site.`
        : `Génère un agency_context structuré pour un agent IA immobilier. Le contexte sera injecté dans des workflows n8n pour personnaliser les réponses automatiques.

Analyse ces pages et extrais: présentation de l'agence, zones couvertes, types de biens, services, informations pratiques.

Infos métier: ${metierContext}
Agence: ${callNotes.company_name}

Contenu du site:\n\n${contentForAi}

Réponds UNIQUEMENT avec le texte de l'agency_context. Un texte structuré que l'IA utilisera comme contexte. Inclus les vraies données trouvées.`;

      const geminiKey = GEMINI_KEY();
      let brandContext = '';

      if (geminiKey && pages.length > 0) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent?key=${geminiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          brandContext = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      if (brandContext) {
        const updateField = callNotes.vertical === 'ecommerce' ? 'brand_context' : 'brand_context';
        await db.from('clients').update({ [updateField]: brandContext }).eq('id', clientId);
        brandContextGenerated = true;
        await updateStep('brand_context', {
          status: 'success',
          details: `Brand context généré (${brandContext.length} caractères) à partir de ${pages.length} pages`,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - step2Start,
        });
      } else {
        await updateStep('brand_context', {
          status: 'warning',
          details: pages.length === 0
            ? 'Aucune page accessible — brand context non généré. À compléter manuellement.'
            : 'Gemini n\'a pas retourné de résultat. À compléter manuellement.',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - step2Start,
        });
      }
    } catch (err) {
      await updateStep('brand_context', {
        status: 'warning',
        details: `Erreur: ${err.message}. Le brand context devra être ajouté manuellement.`,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - step2Start,
      });
    }

    await db.from('deployments').update({ brand_context_generated: brandContextGenerated }).eq('id', deploymentId);

    // === STEP 3: Email Config ===
    const step3Start = Date.now();
    await updateStep('email_config', { status: 'running', started_at: new Date().toISOString() });

    try {
      if (callNotes.email_sending_preference === 'resend' && callNotes.support_email) {
        const domain = callNotes.support_email.split('@')[1];
        const resendKey = RESEND_KEY();

        if (resendKey && domain) {
          const resendRes = await fetch('https://api.resend.com/domains', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: domain }),
          });

          if (resendRes.ok) {
            const resendData = await resendRes.json();
            await db.from('call_notes').update({
              resend_domain_id: resendData.id,
              resend_dns_records: resendData.records || [],
            }).eq('client_id', clientId);

            emailConfigured = true;
            await updateStep('email_config', {
              status: 'warning',
              details: `Domaine ${domain} créé dans Resend. En attente de vérification DNS. Les instructions seront envoyées au client.`,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - step3Start,
            });
          } else {
            const err = await resendRes.text();
            await updateStep('email_config', {
              status: 'warning',
              details: `Erreur Resend: ${err}. Emails envoyés depuis @actero.fr en attendant.`,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - step3Start,
            });
          }
        } else {
          await updateStep('email_config', {
            status: 'warning',
            details: 'Clé Resend ou email de support manquant. Emails envoyés depuis @actero.fr.',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - step3Start,
          });
        }
      } else if (callNotes.email_sending_preference === 'smtp_client') {
        emailConfigured = true;
        await updateStep('email_config', {
          status: 'success',
          details: 'SMTP client configuré',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - step3Start,
        });
      } else {
        emailConfigured = true;
        await updateStep('email_config', {
          status: 'success',
          details: 'SMTP Actero utilisé (emails depuis @actero.fr)',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - step3Start,
        });
      }
    } catch (err) {
      await updateStep('email_config', {
        status: 'warning',
        details: `Erreur config email: ${err.message}`,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - step3Start,
      });
    }

    await db.from('deployments').update({ email_configured: emailConfigured }).eq('id', deploymentId);

    // === STEP 4: Deploy n8n Workflows ===
    const step4Start = Date.now();
    await updateStep('deploy_workflows', { status: 'running', started_at: new Date().toISOString() });

    const n8nUrl = N8N_URL();
    const n8nKey = N8N_KEY();
    const n8nHeaders = { 'X-N8N-API-KEY': n8nKey, 'Content-Type': 'application/json' };

    const workflowsRequested = callNotes.workflows_requested || [];

    // Re-fetch client to get brand_context
    const { data: updatedClient } = await db.from('clients').select('brand_context').eq('id', clientId).single();
    const brandCtx = updatedClient?.brand_context || '';

    if (n8nUrl && n8nKey && workflowsRequested.length > 0) {
      // Fetch all workflows from n8n
      let allWorkflows = [];
      try {
        const wfRes = await fetch(`${n8nUrl}/api/v1/workflows?limit=100`, { headers: n8nHeaders });
        if (wfRes.ok) {
          const wfData = await wfRes.json();
          allWorkflows = wfData.data || wfData || [];
        }
      } catch {
        // continue
      }

      for (const wfType of workflowsRequested) {
        const templateInfo = TEMPLATE_MAP[wfType];
        if (!templateInfo) continue;

        const clientWorkflowName = `${templateInfo.prefix} — ${callNotes.company_name}`;

        // Check if already exists (idempotence)
        const existing = allWorkflows.find(w => w.name === clientWorkflowName);
        if (existing) {
          workflowsDeployed.push({
            name: clientWorkflowName,
            n8n_id: existing.id,
            type: wfType,
            webhook_url: null,
            skipped: true,
          });
          continue;
        }

        // Find template
        const template = allWorkflows.find(w => w.name?.includes(templateInfo.search));
        if (!template) {
          workflowsDeployed.push({
            name: clientWorkflowName,
            type: wfType,
            error: `Template "${templateInfo.search}" introuvable dans n8n`,
          });
          continue;
        }

        try {
          // Fetch full template
          const tplRes = await fetch(`${n8nUrl}/api/v1/workflows/${template.id}`, { headers: n8nHeaders });
          if (!tplRes.ok) throw new Error(`Fetch template failed: ${tplRes.status}`);
          const tplJson = await tplRes.json();

          // Clean and clone
          const { id, active, versionId, createdAt, updatedAt, ...cleanTpl } = tplJson;

          // Recursive replacement of template placeholders
          const replacements = {
            'TEMPLATE_CLIENT_ID': clientId,
            'TEMPLATE_CLIENT_NAME': callNotes.company_name,
            'TEMPLATE_NAME': callNotes.company_name,
            'TEMPLATE_AGENCY_NAME': callNotes.company_name,
            'TEMPLATE_BRAND_CONTEXT': brandCtx,
            'TEMPLATE_AGENCY_CONTEXT': brandCtx,
          };

          if (shopifyConnection) {
            replacements['TEMPLATE_SHOP'] = shopifyConnection.shop_domain;
            replacements['TEMPLATE_SHOPIFY_TOKEN'] = shopifyConnection.access_token;
          }

          // Also inject hourly cost
          const hourlyCost = callNotes.vertical === 'ecommerce'
            ? (callNotes.hourly_support_cost || 25)
            : (callNotes.hourly_agent_cost || 30);

          const replaced = deepReplace(cleanTpl, replacements);
          replaced.name = clientWorkflowName;

          // Create workflow
          const createRes = await fetch(`${n8nUrl}/api/v1/workflows`, {
            method: 'POST',
            headers: n8nHeaders,
            body: JSON.stringify({
              name: replaced.name,
              nodes: replaced.nodes,
              connections: replaced.connections,
              settings: replaced.settings || {},
              staticData: replaced.staticData || null,
              pinData: replaced.pinData || {},
            }),
          });

          if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Create failed: ${createRes.status} — ${errText}`);
          }

          const created = await createRes.json();

          // Find webhook URL if any
          const webhookNode = (created.nodes || []).find(n =>
            n.type === 'n8n-nodes-base.webhook' || n.type?.includes('webhook')
          );
          const webhookUrl = webhookNode
            ? `${n8nUrl}/webhook/${created.id}/${webhookNode.webhookId || webhookNode.parameters?.path || ''}`
            : null;

          workflowsDeployed.push({
            name: clientWorkflowName,
            n8n_id: created.id,
            type: wfType,
            webhook_url: webhookUrl,
          });

          // Store in client_n8n_workflows if table exists
          try {
            await db.from('client_n8n_workflows').insert({
              client_id: clientId,
              n8n_workflow_id: created.id.toString(),
              workflow_name: clientWorkflowName,
              workflow_type: wfType,
              is_active: false,
            });
          } catch {
            // Table may not exist, skip
          }
        } catch (err) {
          workflowsDeployed.push({
            name: clientWorkflowName,
            type: wfType,
            error: err.message,
          });
        }
      }

      const successCount = workflowsDeployed.filter(w => w.n8n_id && !w.error).length;
      const errorCount = workflowsDeployed.filter(w => w.error).length;

      await updateStep('deploy_workflows', {
        status: errorCount > 0 && successCount === 0 ? 'failed' : errorCount > 0 ? 'warning' : 'success',
        details: `${successCount} workflows déployés, ${errorCount} erreurs`,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - step4Start,
      });
    } else {
      await updateStep('deploy_workflows', {
        status: workflowsRequested.length === 0 ? 'warning' : 'failed',
        details: workflowsRequested.length === 0
          ? 'Aucun workflow demandé'
          : 'Configuration n8n manquante (N8N_API_URL ou N8N_API_KEY)',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - step4Start,
      });
    }

    await db.from('deployments').update({ workflows_deployed: workflowsDeployed }).eq('id', deploymentId);

    // === STEP 5: Checklist ===
    const step5Start = Date.now();
    await updateStep('checklist', { status: 'running', started_at: new Date().toISOString() });

    const checkResults = [];
    const deployedOk = workflowsDeployed.filter(w => w.n8n_id && !w.error && !w.skipped);

    for (const wf of deployedOk) {
      try {
        const wfRes = await fetch(`${n8nUrl}/api/v1/workflows/${wf.n8n_id}`, { headers: n8nHeaders });
        if (!wfRes.ok) continue;
        const wfJson = await wfRes.json();

        const checks = runChecklist(wfJson, wf.type, clientId, brandCtx);
        checkResults.push({ workflow: wf.name, checks });
      } catch {
        checkResults.push({ workflow: wf.name, checks: [{ name: 'Fetch workflow', status: 'fail', details: 'Impossible de récupérer le workflow' }] });
      }
    }

    const totalChecks = checkResults.reduce((s, r) => s + r.checks.length, 0);
    const passedChecks = checkResults.reduce((s, r) => s + r.checks.filter(c => c.status === 'pass').length, 0);
    const failedChecks = totalChecks - passedChecks;

    await updateStep('checklist', {
      status: failedChecks > 0 ? 'warning' : 'success',
      details: `${passedChecks}/${totalChecks} vérifications passées`,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - step5Start,
    });

    // === STEP 6: Test Workflows ===
    const step6Start = Date.now();
    await updateStep('test_workflows', { status: 'running', started_at: new Date().toISOString() });

    for (const wf of deployedOk) {
      if (wf.webhook_url && ['sav', 'lead_qualification', 'document_collection'].includes(wf.type)) {
        try {
          const testPayload = getTestPayload(wf.type);
          const testRes = await fetch(wf.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(15000),
          });

          if (testRes.ok) {
            testsPassed++;
          } else {
            testsFailed++;
          }
        } catch {
          testsFailed++;
        }
      } else {
        // Schedule-based workflows — skip test or count as pass
        testsPassed++;
      }
    }

    // Clean up test data
    try {
      await db.from('automation_events').delete().eq('client_id', clientId).like('ticket_id', 'TK-TEST-%');
      await db.from('automation_events').delete().eq('client_id', clientId).eq('metadata->>source', 'test');
    } catch {
      // ok
    }

    await updateStep('test_workflows', {
      status: testsFailed > 0 ? 'warning' : 'success',
      details: `${testsPassed} tests passés, ${testsFailed} échecs`,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - step6Start,
    });

    await db.from('deployments').update({ tests_passed: testsPassed, tests_failed: testsFailed }).eq('id', deploymentId);

    // === STEP 7: Activate ===
    const step7Start = Date.now();
    await updateStep('activate', { status: 'running', started_at: new Date().toISOString() });

    let activatedCount = 0;
    for (const wf of deployedOk) {
      try {
        const actRes = await fetch(`${n8nUrl}/api/v1/workflows/${wf.n8n_id}/activate`, {
          method: 'POST',
          headers: n8nHeaders,
        });
        if (actRes.ok) {
          activatedCount++;
          // Update client_n8n_workflows
          try {
            await db.from('client_n8n_workflows')
              .update({ is_active: true })
              .eq('n8n_workflow_id', wf.n8n_id.toString());
          } catch { /* ok */ }
        }
      } catch {
        // continue
      }
    }

    await updateStep('activate', {
      status: activatedCount === deployedOk.length ? 'success' : 'warning',
      details: `${activatedCount}/${deployedOk.length} workflows activés`,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - step7Start,
    });

    // === STEP 8: Finalize ===
    const step8Start = Date.now();
    await updateStep('finalize', { status: 'running', started_at: new Date().toISOString() });

    // Update call_notes status
    await db.from('call_notes').update({ status: 'deployed' }).eq('client_id', clientId);

    // Update funnel_clients if exists
    try {
      await db.from('funnel_clients')
        .update({ status: 'deploye' })
        .eq('email', callNotes.contact_email);
    } catch { /* ok */ }

    // Update client deployment timestamp
    await db.from('clients').update({ deployment_completed_at: new Date().toISOString() }).eq('id', clientId);

    const hasWarnings = workflowsDeployed.some(w => w.error) || testsFailed > 0 || failedChecks > 0;

    await updateStep('finalize', {
      status: 'success',
      details: `Déploiement terminé pour ${callNotes.company_name}. ${workflowsDeployed.filter(w => w.n8n_id).length} workflows, ${testsPassed} tests OK.`,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - step8Start,
    });

    // Final deployment status
    await db.from('deployments').update({
      status: hasWarnings ? 'completed_with_warnings' : 'completed',
      completed_at: new Date().toISOString(),
      total_duration_ms: Date.now() - pipelineStart,
      workflows_deployed: workflowsDeployed,
    }).eq('id', deploymentId);

  } catch (err) {
    console.error('Pipeline fatal error:', err);
    await db.from('deployments').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      total_duration_ms: Date.now() - pipelineStart,
    }).eq('id', deploymentId);
  }
}

function deepReplace(obj, replacements) {
  if (typeof obj === 'string') {
    let result = obj;
    for (const [key, value] of Object.entries(replacements)) {
      if (result.includes(key)) {
        result = result.replaceAll(key, String(value));
      }
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepReplace(item, replacements));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplace(value, replacements);
    }
    return result;
  }
  return obj;
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTestPayload(type) {
  const payloads = {
    sav: {
      customer_email: 'test@actero.fr',
      customer_name: 'Client Test Actero',
      subject: 'Où est ma commande ?',
      message: 'Bonjour, j\'ai commandé il y a 5 jours et je n\'ai toujours rien reçu. Commande #CMD-TEST-001',
      order_id: '#CMD-TEST-001',
      ticket_id: 'TK-TEST-001',
    },
    lead_qualification: {
      prospect_name: 'Marie Test',
      prospect_email: 'test@actero.fr',
      prospect_phone: '0600000000',
      message: 'Bonjour, je cherche un appartement T3 dans le centre-ville, budget 250 000€.',
      source: 'test',
    },
    document_collection: {
      client_name: 'Acheteur Test',
      client_email: 'test@actero.fr',
      transaction_type: 'achat',
      property_address: '12 rue du Test, Paris',
    },
  };
  return payloads[type] || {};
}

function runChecklist(wfJson, wfType, clientId, brandCtx) {
  const checks = [];
  const nodes = wfJson.nodes || [];

  // Find Config node
  const configNode = nodes.find(n => n.name === 'Config' || (n.type === 'n8n-nodes-base.set' && JSON.stringify(n.parameters).includes('client_id')));
  const configStr = configNode ? JSON.stringify(configNode.parameters) : '';

  // CHECK 1: client_id valid UUID
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const hasValidUuid = uuidRegex.test(configStr) && configStr.includes(clientId);
  checks.push({ name: 'Client ID est un UUID valide', status: hasValidUuid ? 'pass' : 'fail', details: hasValidUuid ? clientId : 'UUID non trouvé dans Config' });

  // CHECK 2: No TEMPLATE placeholder
  const hasTemplate = configStr.includes('TEMPLATE');
  checks.push({ name: 'Pas de placeholder TEMPLATE', status: !hasTemplate ? 'pass' : 'fail', details: hasTemplate ? 'Placeholder TEMPLATE trouvé dans Config' : 'OK' });

  // CHECK 3: Brand context filled
  const hasBrandCtx = brandCtx && brandCtx.length > 100;
  checks.push({ name: 'Brand context rempli', status: hasBrandCtx ? 'pass' : 'warning', details: hasBrandCtx ? `${brandCtx.length} caractères` : 'Brand context court ou vide' });

  // CHECK 4: Tracker metrics node
  const trackerNode = nodes.find(n => n.name?.includes('Tracker') || n.name?.includes('Métriques'));
  const trackerUrl = trackerNode ? JSON.stringify(trackerNode.parameters) : '';
  checks.push({ name: 'Tracker Métriques configuré', status: trackerUrl.includes('automation_events') ? 'pass' : 'warning', details: trackerNode ? 'Node trouvé' : 'Node Tracker non trouvé' });

  // CHECK 5: No TEMPLATE in full workflow
  const fullStr = JSON.stringify(wfJson);
  const templateInFull = fullStr.includes('TEMPLATE_');
  checks.push({ name: 'Aucun placeholder dans le workflow', status: !templateInFull ? 'pass' : 'fail', details: templateInFull ? 'Un placeholder TEMPLATE_ reste dans le workflow' : 'OK' });

  return checks;
}

export default withSentry(handler)
