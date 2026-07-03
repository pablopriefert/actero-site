# La Boucle — Lot 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the self-improving loop MVP — a weekly miner that turns recurring, non-auto-resolved tickets into ready-to-use knowledge-base entries the merchant approves in one click, so the agent escalates less over time.

**Architecture:** A weekly cron (`improvement-loop`) gathers each client's last 30 days of escalated / low-confidence / negatively-rated cases plus their current KB, sends one structured LLM call that clusters recurring themes and drafts a KB entry per theme, and upserts each as an `ai_recommendations` row (`category='kb_gap'`, draft in `evidence`, deduped by `fingerprint`). A dashboard widget lists the pending suggestions with an editable draft; a one-click `apply-recommendation` endpoint inserts the entry into `client_knowledge_base` and marks the recommendation implemented. Pure logic (prompt building, parsing, fingerprint) is isolated in a core module for unit testing; the cron and endpoint stay thin.

**Tech Stack:** Node serverless (Vercel), Supabase JS (service role), the shared `api/lib/llm.js` `chatComplete` helper, `withCronMonitor`, Vitest + `vi.mock`.

---

## File Structure

- Create `api/lib/improvement-loop-core.js` — pure helpers: `computeFingerprint`, `buildMinerPrompt`, `parseSuggestions`. No I/O. Unit-tested.
- Create `api/lib/improvement-loop-core.test.js` — Vitest unit tests for the core.
- Create `api/cron/improvement-loop.js` — weekly cron orchestration (fetch → chatComplete → upsert `ai_recommendations`). Thin.
- Create `api/client/apply-recommendation.js` — POST endpoint: apply (insert KB + mark implemented) or dismiss a recommendation, with auth + ownership.
- Create `api/client/apply-recommendation.test.js` — Vitest handler tests (mocked Supabase).
- Modify `vercel.json` — register the new cron (`*/… weekly`).
- Modify `src/components/client/AgentImprovementWidget.jsx` — read persisted `ai_recommendations` (kb_gap, pending), show editable draft + Apply / Dismiss.

No DB migration: `ai_recommendations` (has `evidence` jsonb, `fingerprint`, `status`, `expires_at`, `impact_score`, `estimated_time_gain_minutes`) and `client_knowledge_base` (has `source`, `needs_review`) already exist, and the `mark_ai_recommendation(p_id uuid, p_status text)` RPC is granted to `authenticated` + `service_role`.

---

## Task 1: Core helpers (fingerprint, prompt, parsing)

**Files:**
- Create: `api/lib/improvement-loop-core.js`
- Test: `api/lib/improvement-loop-core.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it, expect } from 'vitest'
import { computeFingerprint, buildMinerPrompt, parseSuggestions } from './improvement-loop-core.js'

describe('computeFingerprint', () => {
  it('is stable and case/space-insensitive for the same theme', () => {
    expect(computeFingerprint('Assurance colis perdu'))
      .toBe(computeFingerprint('  assurance   COLIS perdu '))
  })
  it('differs for different themes', () => {
    expect(computeFingerprint('assurance colis')).not.toBe(computeFingerprint('délais belgique'))
  })
})

describe('buildMinerPrompt', () => {
  it('includes the cases and the existing KB titles', () => {
    const p = buildMinerPrompt({
      cases: [{ question: 'Mes colis sont-ils assurés ?', humanReply: 'Oui, assurés.' }],
      existingTitles: ['Politique de retour'],
    })
    expect(p).toContain('Mes colis sont-ils assurés ?')
    expect(p).toContain('Oui, assurés.')
    expect(p).toContain('Politique de retour')
    expect(p.toLowerCase()).toContain('json')
  })
})

describe('parseSuggestions', () => {
  it('parses a clean {suggestions:[...]} object', () => {
    const raw = JSON.stringify({ suggestions: [
      { theme: 'Assurance colis', kb_title: 'Assurance et colis perdus', kb_content: 'Tous nos envois sont assurés.', occurrences: 8, evidence_conversation_ids: ['a', 'b'], estimated_time_gain_minutes: 40 },
    ] })
    const out = parseSuggestions(raw)
    expect(out).toHaveLength(1)
    expect(out[0].kb_title).toBe('Assurance et colis perdus')
    expect(out[0].occurrences).toBe(8)
  })
  it('extracts JSON even when wrapped in prose/code fences', () => {
    const raw = 'Voici:\n```json\n{"suggestions":[{"theme":"X","kb_title":"T","kb_content":"C","occurrences":3,"evidence_conversation_ids":[],"estimated_time_gain_minutes":15}]}\n```'
    expect(parseSuggestions(raw)).toHaveLength(1)
  })
  it('returns [] on garbage', () => {
    expect(parseSuggestions('not json at all')).toEqual([])
  })
  it('drops malformed entries (missing kb_title/kb_content)', () => {
    const raw = JSON.stringify({ suggestions: [{ theme: 'X', occurrences: 5 }] })
    expect(parseSuggestions(raw)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/lib/improvement-loop-core.test.js`
Expected: FAIL — "does not provide an export named 'computeFingerprint'".

- [ ] **Step 3: Write the implementation**

```javascript
import { createHash } from 'crypto'

/**
 * Pure helpers for the improvement loop. No I/O — unit-testable.
 */

export function computeFingerprint(theme) {
  const norm = String(theme || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(norm).digest('hex').slice(0, 16)
}

export function buildMinerPrompt({ cases = [], existingTitles = [] } = {}) {
  const casesBlock = cases
    .map((c, i) => `${i + 1}. Question client : ${c.question || '(vide)'}${c.humanReply ? `\n   Réponse donnée par le marchand : ${c.humanReply}` : ''}`)
    .join('\n')
  const kbBlock = existingTitles.length
    ? existingTitles.map((t) => `- ${t}`).join('\n')
    : '(base de connaissances vide)'

  return `Tu es un analyste qui améliore un agent IA de support client e-commerce.

Voici des demandes clients que l'agent n'a PAS su résoudre seul (escalades, faible confiance, ou notées négativement) sur les 30 derniers jours :
${casesBlock}

Voici les titres DÉJÀ présents dans la base de connaissances du marchand — n'invente rien qui existe déjà :
${kbBlock}

Regroupe ces demandes par THÈME récurrent. Pour chaque thème qui revient au moins 3 fois ET qui n'est pas déjà couvert par la base, rédige une entrée de base de connaissances prête à l'emploi qui aurait permis à l'agent de répondre seul. Appuie-toi sur les réponses du marchand quand elles existent. Contenu factuel, concis, en français, sans markdown.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "suggestions": [
    {
      "theme": "libellé court du thème",
      "kb_title": "titre de l'entrée",
      "kb_content": "contenu de la réponse",
      "occurrences": nombre entier,
      "evidence_conversation_ids": ["id1", "id2"],
      "estimated_time_gain_minutes": nombre entier
    }
  ]
}
Si rien ne mérite une entrée, renvoie {"suggestions": []}.`
}

export function parseSuggestions(rawText) {
  if (!rawText) return []
  let obj = null
  try {
    obj = JSON.parse(rawText)
  } catch {
    const fence = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    const candidate = fence ? fence[1] : (rawText.match(/\{[\s\S]*\}/) || [null])[0]
    if (candidate) {
      try { obj = JSON.parse(candidate) } catch { obj = null }
    }
  }
  const list = Array.isArray(obj?.suggestions) ? obj.suggestions : []
  return list
    .filter((s) => s && typeof s.kb_title === 'string' && s.kb_title.trim() && typeof s.kb_content === 'string' && s.kb_content.trim())
    .map((s) => ({
      theme: String(s.theme || s.kb_title).trim(),
      kb_title: s.kb_title.trim(),
      kb_content: s.kb_content.trim(),
      occurrences: Number(s.occurrences) || 0,
      evidence_conversation_ids: Array.isArray(s.evidence_conversation_ids) ? s.evidence_conversation_ids.slice(0, 20) : [],
      estimated_time_gain_minutes: Number(s.estimated_time_gain_minutes) || 0,
    }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/lib/improvement-loop-core.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/lib/improvement-loop-core.js api/lib/improvement-loop-core.test.js
git commit -m "feat(loop): improvement-loop core helpers (fingerprint, prompt, parse)"
```

---

## Task 2: The miner cron

**Files:**
- Create: `api/cron/improvement-loop.js`
- Modify: `vercel.json` (register cron)

- [ ] **Step 1: Write the cron**

```javascript
/**
 * Vercel Cron — Improvement Loop (weekly)
 *
 * For each active client: gather the last 30 days of cases the agent did NOT
 * auto-resolve (escalated / low-confidence / negative feedback) + the current
 * KB, ask the LLM to cluster recurring themes and draft a ready-to-use KB
 * entry per theme, and upsert each as a pending `ai_recommendations` row
 * (category='kb_gap', deduped by fingerprint). The merchant approves in the
 * dashboard (see api/client/apply-recommendation.js).
 *
 * Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
 */
import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { chatComplete } from '../lib/llm.js'
import { buildMinerPrompt, parseSuggestions, computeFingerprint } from '../lib/improvement-loop-core.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const maxDuration = 60

const MIN_OCCURRENCES = 3
const LOOKBACK_DAYS = 30
const RECO_TTL_DAYS = 14

async function gatherCases(clientId, sinceIso) {
  // Escalated + negatively-rated events carry the customer question in metadata.
  const { data: events } = await supabase
    .from('automation_events')
    .select('event_category, event_title, metadata, created_at')
    .eq('client_id', clientId)
    .or('event_category.eq.ticket_escalated,feedback.eq.negative')
    .gte('created_at', sinceIso)
    .limit(200)

  return (events || []).map((e) => ({
    question: e.metadata?.customer_message || e.event_title || '',
    humanReply: e.metadata?.human_reply || '',
    id: e.metadata?.event_id || null,
  })).filter((c) => c.question)
}

async function processClient(client, sinceIso) {
  const cases = await gatherCases(client.id, sinceIso)
  if (cases.length < MIN_OCCURRENCES) return { client_id: client.id, skipped: 'not_enough_cases' }

  const { data: kb } = await supabase
    .from('client_knowledge_base')
    .select('title')
    .eq('client_id', client.id)
    .eq('is_active', true)
    .limit(200)
  const existingTitles = (kb || []).map((k) => k.title).filter(Boolean)

  const { text } = await chatComplete({
    system: buildMinerPrompt({ cases, existingTitles }),
    messages: [{ role: 'user', content: 'Analyse les demandes ci-dessus et renvoie les suggestions en JSON.' }],
    maxTokens: 1500,
    json: true,
  })
  const suggestions = parseSuggestions(text).filter((s) => s.occurrences >= MIN_OCCURRENCES)

  const expiresAt = new Date(Date.now() + RECO_TTL_DAYS * 86400_000).toISOString()
  let upserted = 0
  for (const s of suggestions) {
    const fingerprint = computeFingerprint(s.theme)
    // Skip if an open or already-implemented reco exists for this theme.
    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('id, status')
      .eq('client_id', client.id)
      .eq('fingerprint', fingerprint)
      .in('status', ['pending', 'implemented'])
      .maybeSingle()
    if (existing) continue

    const { error } = await supabase.from('ai_recommendations').insert({
      client_id: client.id,
      category: 'kb_gap',
      title: s.kb_title,
      description: `${s.occurrences} demandes similaires que l'agent n'a pas su traiter — voici l'entrée à ajouter à ta base.`,
      impact_score: Math.min(100, s.occurrences * 10),
      estimated_time_gain_minutes: s.estimated_time_gain_minutes,
      evidence: {
        kb_title: s.kb_title,
        kb_content: s.kb_content,
        occurrences: s.occurrences,
        conversation_ids: s.evidence_conversation_ids,
      },
      status: 'pending',
      fingerprint,
      expires_at: expiresAt,
      source_version: 'improvement-loop-v1',
    })
    if (!error) upserted++
  }
  return { client_id: client.id, cases: cases.length, suggestions: suggestions.length, upserted }
}

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()
  const { data: clients } = await supabase.from('clients').select('id').limit(500)

  const results = []
  for (const client of clients || []) {
    try {
      results.push(await processClient(client, sinceIso))
    } catch (err) {
      results.push({ client_id: client.id, error: err.message })
    }
  }
  return res.status(200).json({ ok: true, processed: results.length, results })
}

export default withCronMonitor('cron-improvement-loop', '0 6 * * 1', handler)
```

- [ ] **Step 2: Register the cron in vercel.json**

Add this object to the `crons` array (after the `agent-healthcheck` entry):

```json
        {
            "path": "/api/cron/improvement-loop",
            "schedule": "0 6 * * 1"
        },
```

- [ ] **Step 3: Verify it parses (lint + syntax + valid JSON)**

Run: `npx eslint api/cron/improvement-loop.js && node --check api/cron/improvement-loop.js && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json ok')"`
Expected: no eslint output, no syntax error, "vercel.json ok".

- [ ] **Step 4: Commit**

```bash
git add api/cron/improvement-loop.js vercel.json
git commit -m "feat(loop): weekly improvement-loop miner cron"
```

---

## Task 3: The one-click apply / dismiss endpoint

**Files:**
- Create: `api/client/apply-recommendation.js`
- Test: `api/client/apply-recommendation.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {}
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (table) => {
      if (table === 'ai_recommendations') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.reco, error: null }) }) }),
        }
      }
      if (table === 'client_users') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.membership, error: null }) }) }) }) }
      }
      if (table === 'clients') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }
      }
      if (table === 'client_knowledge_base') {
        return { insert: (row) => { state.kbInsert = row; return Promise.resolve({ error: null }) } }
      }
      if (table === 'automation_events') {
        return { insert: () => Promise.resolve({ error: null }) }
      }
      return {}
    },
    rpc: (name, args) => { state.rpc = { name, args }; return Promise.resolve({ error: null }) },
  }),
}))

const { default: handler } = await import('./apply-recommendation.js')

function mockRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
}

beforeEach(() => {
  state.reco = { id: 'reco-1', client_id: 'client-1', status: 'pending', evidence: { kb_title: 'Assurance', kb_content: 'Assurés.' } }
  state.membership = { client_id: 'client-1' }
  state.kbInsert = null
  state.rpc = null
})

describe('apply-recommendation', () => {
  it('applies: inserts the KB entry and marks the reco implemented', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'apply' } }, res)
    expect(res.statusCode).toBe(200)
    expect(state.kbInsert.title).toBe('Assurance')
    expect(state.kbInsert.source).toBe('improvement_loop')
    expect(state.rpc).toEqual({ name: 'mark_ai_recommendation', args: { p_id: 'reco-1', p_status: 'implemented' } })
  })

  it('dismiss: marks dismissed and does NOT touch the KB', async () => {
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'dismiss' } }, res)
    expect(state.kbInsert).toBeNull()
    expect(state.rpc.args.p_status).toBe('dismissed')
  })

  it('403 when the caller does not own the client', async () => {
    state.membership = null
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { reco_id: 'reco-1', action: 'apply' } }, res)
    expect(res.statusCode).toBe(403)
    expect(state.kbInsert).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/client/apply-recommendation.test.js`
Expected: FAIL — cannot find module `./apply-recommendation.js`.

- [ ] **Step 3: Write the implementation**

```javascript
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { reco_id, action = 'apply', title, content } = req.body || {}
  if (!reco_id) return res.status(400).json({ error: 'reco_id requis' })
  if (!['apply', 'dismiss'].includes(action)) return res.status(400).json({ error: 'action invalide' })

  const { data: reco } = await supabase
    .from('ai_recommendations')
    .select('id, client_id, status, evidence')
    .eq('id', reco_id)
    .maybeSingle()
  if (!reco) return res.status(404).json({ error: 'Recommandation introuvable' })

  // Ownership: service-role bypasses RLS, so verify the caller belongs to the client.
  const [{ data: membership }, { data: owned }] = await Promise.all([
    supabase.from('client_users').select('client_id').eq('user_id', user.id).eq('client_id', reco.client_id).maybeSingle(),
    supabase.from('clients').select('id').eq('id', reco.client_id).eq('owner_user_id', user.id).maybeSingle(),
  ])
  if (!membership && !owned) return res.status(403).json({ error: 'Accès refusé' })

  if (action === 'dismiss') {
    await supabase.rpc('mark_ai_recommendation', { p_id: reco_id, p_status: 'dismissed' })
    return res.status(200).json({ ok: true, status: 'dismissed' })
  }

  if (reco.status !== 'pending') return res.status(409).json({ error: 'Déjà traitée' })
  const draft = reco.evidence || {}
  // The merchant may have edited the draft in the widget; use their values if present.
  const kbTitle = (typeof title === 'string' && title.trim()) ? title.trim() : draft.kb_title
  const kbContent = (typeof content === 'string' && content.trim()) ? content.trim() : draft.kb_content
  if (!kbTitle || !kbContent) return res.status(422).json({ error: 'Brouillon KB manquant' })

  const { error: kbError } = await supabase.from('client_knowledge_base').insert({
    client_id: reco.client_id,
    category: 'faq',
    title: kbTitle,
    content: kbContent,
    is_active: true,
    needs_review: false,
    source: 'improvement_loop',
  })
  if (kbError) return res.status(500).json({ error: kbError.message })

  await supabase.rpc('mark_ai_recommendation', { p_id: reco_id, p_status: 'implemented' })
  await supabase.from('automation_events').insert({
    client_id: reco.client_id,
    event_category: 'generic',
    event_type: 'kb_gap_applied',
    event_title: `Entrée ajoutée à la base : ${draft.kb_title}`,
    description: '[Boucle] suggestion appliquée en 1 clic',
    metadata: { reco_id, source: 'improvement_loop' },
  }).then(() => {}).catch(() => {})

  return res.status(200).json({ ok: true, status: 'implemented' })
}

export default withSentry(handler)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/client/apply-recommendation.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/client/apply-recommendation.js api/client/apply-recommendation.test.js
git commit -m "feat(loop): 1-click apply/dismiss recommendation endpoint"
```

---

## Task 4: Upgrade AgentImprovementWidget to the persisted loop

**Files:**
- Modify: `src/components/client/AgentImprovementWidget.jsx` (full replace of the component body)

- [ ] **Step 1: Replace the component with the persisted-reco version**

Replace the entire contents of `src/components/client/AgentImprovementWidget.jsx` with:

```jsx
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Plus, Pencil, X, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AgentImprovementWidget = ({ clientId, theme: _theme }) => {
  const queryClient = useQueryClient()
  const [edits, setEdits] = useState({})   // reco_id -> { title, content }

  const { data: recos = [], isLoading } = useQuery({
    queryKey: ['improvement-loop', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('id, title, description, evidence, estimated_time_gain_minutes, created_at')
        .eq('client_id', clientId)
        .eq('category', 'kb_gap')
        .eq('status', 'pending')
        .order('impact_score', { ascending: false })
        .limit(5)
      return data || []
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  const act = useMutation({
    mutationFn: async ({ recoId, action, title, content }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/apply-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ reco_id: recoId, action, title, content }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['improvement-loop', clientId] })
    },
  })

  if (isLoading || recos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a]">L'agent s'améliore</p>
            <p className="text-[10px] text-[#71717a]">{recos.length} amélioration(s) détectée(s) — basé sur tes escalades</p>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {recos.map((r) => {
              const draft = r.evidence || {}
              const edit = edits[r.id] || { title: draft.kb_title || '', content: draft.kb_content || '' }
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  className="p-3 bg-white rounded-xl border border-gray-100"
                >
                  <p className="text-sm font-medium text-[#1a1a1a]">{r.title}</p>
                  <p className="text-xs text-[#71717a] mt-0.5">{r.description}</p>

                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">Entrée proposée pour ta base</p>
                    <input
                      className="w-full bg-transparent text-sm font-medium text-[#1a1a1a] outline-none border-b border-emerald-200 pb-1 mb-2"
                      value={edit.title}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...edit, title: e.target.value } }))}
                    />
                    <textarea
                      className="w-full bg-transparent text-xs text-[#3a3a3a] outline-none resize-none"
                      rows={3}
                      value={edit.content}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...edit, content: e.target.value } }))}
                    />
                  </div>

                  {r.estimated_time_gain_minutes > 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> ~{r.estimated_time_gain_minutes} min économisées / mois
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ recoId: r.id, action: 'apply', title: edit.title, content: edit.content })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0E653A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {act.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Ajouter à ma base
                    </button>
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ recoId: r.id, action: 'dismiss' })}
                      className="rounded-full px-3 py-2 text-sm text-[#9ca3af] hover:text-[#71717a]"
                    >
                      Ignorer
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {act.isSuccess && (
          <p className="mt-3 text-[11px] text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mis à jour — l'agent utilisera cette réponse.
          </p>
        )}
        {act.isError && <p className="mt-3 text-[11px] text-red-500">{act.error.message}</p>}
      </div>
    </motion.div>
  )
}
```

Note: `Pencil` is imported for a future inline-edit affordance but the fields are already inline-editable; keep the import list matching what's used — remove `Pencil` and `X` if eslint flags them unused in Step 2.

- [ ] **Step 2: Verify it builds (lint + prod build)**

Run: `npx eslint src/components/client/AgentImprovementWidget.jsx && npm run build`
Expected: eslint clean (fix any unused-import by trimming the lucide import line), build completes ("Prerender complete").

- [ ] **Step 3: Commit**

```bash
git add src/components/client/AgentImprovementWidget.jsx
git commit -m "feat(loop): AgentImprovementWidget reads persisted recos + 1-click apply"
```

---

## Task 5: End-to-end smoke via seeded recommendation

**Files:** none (verification only, against the seeded test tenant `e0f35f36-8c16-4cca-8ea4-b8f46798080e`).

- [ ] **Step 1: Insert a fake pending reco (SQL via Supabase MCP)**

```sql
insert into ai_recommendations (client_id, category, title, description, impact_score, estimated_time_gain_minutes, evidence, status, fingerprint, expires_at, source_version)
values ('e0f35f36-8c16-4cca-8ea4-b8f46798080e','kb_gap','Assurance et colis perdus',
  '8 demandes similaires que l''agent n''a pas su traiter.', 80, 40,
  '{"kb_title":"Assurance et colis perdus","kb_content":"Tous nos envois sont assurés. En cas de perte, renvoi gratuit ou remboursement sous 48h.","occurrences":8,"conversation_ids":[]}'::jsonb,
  'pending','smoke-'||substr(md5(random()::text),1,8), now() + interval '14 days','improvement-loop-v1');
```

- [ ] **Step 2: Verify the widget shows it and apply works**

In the dashboard (test tenant), open the Overview: the "L'agent s'améliore" card shows the seeded suggestion with an editable draft. Click "Ajouter à ma base".
Expected: the card disappears; a new `client_knowledge_base` row exists with `source='improvement_loop'`; the reco's `status='implemented'`.

Verify via SQL:
```sql
select status from ai_recommendations where source_version='improvement-loop-v1' and client_id='e0f35f36-8c16-4cca-8ea4-b8f46798080e';
select title, source from client_knowledge_base where source='improvement_loop' and client_id='e0f35f36-8c16-4cca-8ea4-b8f46798080e';
```

- [ ] **Step 3: Clean up the smoke data**

```sql
delete from client_knowledge_base where source='improvement_loop' and client_id='e0f35f36-8c16-4cca-8ea4-b8f46798080e';
delete from ai_recommendations where source_version='improvement-loop-v1' and client_id='e0f35f36-8c16-4cca-8ea4-b8f46798080e' and title='Assurance et colis perdus';
```

---

## Notes & assumptions to verify during Task 2

- `automation_events` metadata keys: the miner reads `metadata.customer_message` / `metadata.human_reply` / `metadata.event_id`, falling back to `event_title` for the question. If the engine logger doesn't populate `customer_message`, the miner still works off `event_title` (which holds the "Escalade : <snippet>" text). A follow-up (Lot 2) can enrich the logger to store the full customer message + human reply for higher-quality drafts.
- `ai_recommendations.category` / `status` are free-text (`text`) columns — no enum constraint — so `'kb_gap'`, `'pending'`, `'implemented'`, `'dismissed'` insert cleanly.
- `client_knowledge_base.category` uses `'faq'` for applied entries (a safe default in the existing category set).
