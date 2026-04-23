# Claude Vision for Actero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multimodal image understanding to the Actero SAV agent so customers can attach photos of broken products, receipts, shipping labels, checkout errors etc. and get a contextual answer in under 10 seconds.

**Architecture:** A standalone `/api/vision/analyze` endpoint that runs a two-pass Claude call (Haiku 4.5 sensitivity pre-check → Sonnet 4.6 main analysis). Each ingress webhook (email/Gorgias/Zendesk/WhatsApp/widget) extracts image attachments, uploads them to Supabase Storage `ticket-attachments`, and forwards the signed URLs through `normalizeEvent`. `brain.js` detects `normalized.images[]` and injects the vision result into the LLM context before routing to the specialized agent. Usage is metered in a new `vision_analyses` table and gated by a new `vision_analyses_per_month` plan limit. Sensitive documents (ID card, credit card, passport) are **never stored or analyzed** — a short Haiku pre-check flags them and the ticket auto-escalates to a human.

**Tech Stack:** Anthropic Messages API (vision), Supabase Storage (`ticket-attachments` bucket), Supabase Postgres (`vision_analyses`), React 19 + Vite (dashboard + portal), Vercel Functions ESM.

**Phasing (execute in order, ship each milestone independently):**
- **Milestone A — MVP (Tasks 1-5):** DB migration + endpoint + plan limits + engine integration + email-only ingress. Ship-able to prod, provable value.
- **Milestone B — Multi-channel (Task 6):** Add ingress support for Gorgias, Zendesk, WhatsApp, widget.
- **Milestone C — Polish (Tasks 7-8):** Portal upload UI, dashboard widget, pricing page line, tests, docs.

---

## Code style & conventions

- **Language:** JavaScript ESM (`.js`) for `api/` and `.jsx` for React. No TypeScript except existing TSX files.
- **Logging:** Never `console.log` in prod code paths — use `console.warn`/`console.error` for non-fatal, `captureException` from `api/lib/sentry.js` for errors.
- **Supabase client:** Reuse existing `createClient(...)` from `@supabase/supabase-js`. Service-role key from env.
- **Claude model IDs:** `claude-sonnet-4-6` (latest alias) for main vision, `claude-haiku-4-5` for sensitivity pre-check. If Anthropic rejects either alias, fall back to the newest dated variant from their current models list.
- **Commits:** Conventional commits (`feat(vision): ...`, `test(vision): ...`). Co-Authored-By trailer on every commit.
- **ESLint:** Must pass `npm run lint` before commit.

---

## Environment variables needed (add to Vercel)

| Name | Scope | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | already set | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | already set | existing |
| `VISION_ENABLED` | new, optional | `true` globally; individual clients still gated via `client_settings.vision_enabled` |

No new secrets. No new npm deps (Claude vision is native via Messages API).

---

## File map

**New files (9):**

- `supabase/migrations/20260423120000_vision_analyses.sql` — table + bucket + RLS + indexes + purge cron
- `api/vision/analyze.js` — main endpoint
- `api/vision/lib/sensitive-check.js` — Haiku pre-check
- `api/vision/lib/main-analysis.js` — Sonnet structured analysis
- `api/vision/lib/use-cases.js` — prompt templates per use-case (7 cases)
- `api/cron/purge-vision-images.js` — daily purge cron (90d retention)
- `api/portal/upload-attachment.js` — portal image upload endpoint
- `src/components/portal/AttachmentUploader.jsx` — React upload widget
- `src/components/client/overview/VisionUsageWidget.jsx` — dashboard widget

**Modified files (13):**

- `api/lib/plan-limits.js` + `src/lib/plans.js` — add `vision_analyses_per_month`
- `api/engine/lib/claude-client.js` — accept `images[]` in `messages` (passthrough to Anthropic)
- `api/engine/lib/normalizer.js` — add `images: []` to the output shape
- `api/engine/brain.js` — detect `normalized.images[]`, call vision, inject summary
- `api/engine/agents/_shared.js` — add `VISION_CONTEXT_INSTRUCTION` exported string
- `api/engine/agents/return-agent.js` — append vision context to system prompt
- `api/engine/agents/product-agent.js` — same
- `api/engine/webhooks/inbound-email.js` — parse multipart attachments → Storage
- `api/engine/webhooks/gorgias.js` — read ticket `message.attachments[]`
- `api/engine/webhooks/zendesk.js` — read `comment.attachments[]` via API
- `api/engine/webhooks/whatsapp.js` — download media via Meta Graph
- `api/engine/webhooks/widget.js` — accept `images[]` in POST body
- `api/lib/email-poller.js` — parse MIME attachments during IMAP/Gmail polling
- `vercel.json` — add `/api/cron/purge-vision-images` schedule
- `src/pages/portal/PortalApp.jsx` + `src/pages/portal/PortalTicketDetailPage.jsx` — wire uploader
- `src/components/client/overview/OverviewHome.jsx` — add VisionUsageWidget
- `src/pages/PricingPage.jsx` — add "Vision : X/mois" line to each plan card
- `src/components/client/AgentControlCenterView.jsx` — add `vision_enabled` toggle

---

## Task 1: DB migration + Storage bucket

**Files:**
- Create: `supabase/migrations/20260423120000_vision_analyses.sql`

**Goal:** Add `vision_analyses` table, `ticket-attachments` storage bucket, RLS, indexes, and a `vision_enabled` toggle column in `client_settings`.

- [ ] **Step 1: Write the migration**

```sql
-- 20260423120000_vision_analyses.sql
-- Claude Vision feature — persistent layer.
--
-- Adds:
--   (1) vision_analyses — one row per image analyzed, for audit + billing
--   (2) ticket-attachments storage bucket — PRIVATE, signed URLs only
--   (3) client_settings.vision_enabled toggle

-- ===== 1. vision_analyses table =====

CREATE TABLE IF NOT EXISTS vision_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  image_path TEXT NOT NULL,         -- Storage path under ticket-attachments bucket
  image_bytes INTEGER,              -- Original size for quota tracking
  result_json JSONB NOT NULL,       -- Structured analysis output
  use_case TEXT,                    -- 'broken_product' | 'checkout_error' | 'shipping_label' | 'invoice' | 'product_received' | 'other'
  is_sensitive_detected BOOLEAN NOT NULL DEFAULT false,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_eur NUMERIC(8, 5) NOT NULL DEFAULT 0,
  model_id TEXT,                    -- 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  processing_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vision_analyses_client_period_idx
  ON vision_analyses (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vision_analyses_ticket_idx
  ON vision_analyses (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE vision_analyses ENABLE ROW LEVEL SECURITY;

-- Client can read only their own analyses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vision_analyses' AND policyname = 'Clients view own vision analyses'
  ) THEN
    CREATE POLICY "Clients view own vision analyses" ON vision_analyses FOR SELECT
      USING (client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid()));
  END IF;
END $$;

-- Service role only for INSERT/UPDATE/DELETE (endpoint writes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vision_analyses' AND policyname = 'Service role manages vision analyses'
  ) THEN
    CREATE POLICY "Service role manages vision analyses" ON vision_analyses
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ===== 2. Storage bucket =====

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,                             -- PRIVATE: never public URLs, only signed
  5242880,                           -- 5 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- Storage RLS: service role has full access, authenticated owners read signed URLs of their tenant only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'ticket_attachments_service_role'
  ) THEN
    CREATE POLICY "ticket_attachments_service_role" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'ticket-attachments')
      WITH CHECK (bucket_id = 'ticket-attachments');
  END IF;
END $$;

-- Paths are namespaced: ticket-attachments/<client_id>/<ticket_id>/<uuid>.jpg
-- An authenticated owner can read only their client_id prefix.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'ticket_attachments_owner_read'
  ) THEN
    CREATE POLICY "ticket_attachments_owner_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'ticket-attachments'
        AND (string_to_array(name, '/'))[1] IN (
          SELECT id::text FROM clients WHERE owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ===== 3. client_settings toggle =====

ALTER TABLE client_settings
  ADD COLUMN IF NOT EXISTS vision_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN client_settings.vision_enabled IS 'Enable Claude Vision analysis on inbound ticket attachments';
```

- [ ] **Step 2: Apply locally (if supabase CLI available) OR on staging**

Run: `supabase db push` (if supabase CLI linked) OR apply via Supabase Dashboard → SQL Editor.

Expected: No errors. Verify with:
```sql
SELECT count(*) FROM vision_analyses; -- 0
SELECT id FROM storage.buckets WHERE id = 'ticket-attachments'; -- 1 row
SELECT column_name FROM information_schema.columns WHERE table_name='client_settings' AND column_name='vision_enabled'; -- 1 row
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260423120000_vision_analyses.sql
git commit -m "feat(vision): add vision_analyses table + ticket-attachments bucket

Private Supabase Storage bucket (5MB limit, image/* only) namespaced by
client_id/ticket_id, signed URLs only. vision_analyses table tracks
per-image cost + use_case + sensitivity flag. client_settings gains a
vision_enabled toggle (default off).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Sensitive-document pre-check (Haiku 4.5)

**Files:**
- Create: `api/vision/lib/sensitive-check.js`
- Test: `api/vision/lib/sensitive-check.test.js`

**Goal:** A small helper that asks Claude Haiku "does this image contain any of [ID card, passport, credit card, driving license, social-security document]? yes/no, one token" and returns a boolean + token usage.

- [ ] **Step 1: Write the failing test**

```js
// api/vision/lib/sensitive-check.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkSensitive } from './sensitive-check.js'

describe('checkSensitive', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('returns is_sensitive=true when Haiku answers "yes"', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'yes' }],
        usage: { input_tokens: 320, output_tokens: 1 },
        model: 'claude-haiku-4-5',
      }),
    })

    const out = await checkSensitive({ imageUrl: 'https://example.com/cb.jpg' })
    expect(out.is_sensitive).toBe(true)
    expect(out.tokens_in).toBe(320)
    expect(out.tokens_out).toBe(1)
  })

  it('returns is_sensitive=false when Haiku answers "no"', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'no' }],
        usage: { input_tokens: 310, output_tokens: 1 },
        model: 'claude-haiku-4-5',
      }),
    })

    const out = await checkSensitive({ imageUrl: 'https://example.com/product.jpg' })
    expect(out.is_sensitive).toBe(false)
  })

  it('defaults to is_sensitive=true if Haiku returns unrecognized text (fail-safe)', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '…' }], usage: { input_tokens: 300, output_tokens: 1 } }),
    })

    const out = await checkSensitive({ imageUrl: 'https://example.com/x.jpg' })
    expect(out.is_sensitive).toBe(true)  // conservative
  })

  it('throws when API returns non-ok', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    await expect(checkSensitive({ imageUrl: 'x' })).rejects.toThrow(/500/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/vision/lib/sensitive-check.test.js`
Expected: FAIL with `Cannot find module './sensitive-check.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// api/vision/lib/sensitive-check.js
/**
 * Haiku 4.5 binary classifier that flags images containing sensitive documents
 * (ID card, passport, credit/debit card, driving licence). When flagged, the
 * caller MUST NOT persist the image nor send it through the main analysis —
 * instead escalate the ticket to a human.
 *
 * Input: { imageUrl } — signed public URL (5 min TTL is enough)
 * Output: { is_sensitive, tokens_in, tokens_out, model_id, processing_ms }
 */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5'
const TIMEOUT_MS = 6000

const PROMPT = `You classify whether a single image contains a SENSITIVE identity or payment document.

Return exactly one lowercase token — no punctuation, no explanation:
- "yes" if the image contains: national ID card, passport, residence permit, driving licence, credit/debit card (front OR back), cheque, social security card, or similar government/financial document.
- "no" otherwise (product photo, screenshot, receipt, shipping label, any other content).

Your answer is ONE WORD. Nothing else.`

export async function checkSensitive({ imageUrl }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!imageUrl) throw new Error('imageUrl required')

  const startTime = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Haiku ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = (data?.content?.[0]?.text || '').trim().toLowerCase()

    // Fail-safe: if we don't get a clear "no", assume sensitive
    const is_sensitive = raw === 'yes' || (raw !== 'no')

    return {
      is_sensitive,
      tokens_in: data?.usage?.input_tokens || 0,
      tokens_out: data?.usage?.output_tokens || 0,
      model_id: data?.model || MODEL,
      processing_ms: Date.now() - startTime,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Haiku timeout (6s)')
    throw err
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/vision/lib/sensitive-check.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/vision/lib/sensitive-check.js api/vision/lib/sensitive-check.test.js
git commit -m "feat(vision): Haiku 4.5 sensitive-document pre-check

Binary classifier asking 'does this image contain an ID card / passport
/ credit card?'. Fail-safe default = is_sensitive=true on unclear output.
Used by /api/vision/analyze to short-circuit before main analysis and
trigger human escalation instead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Use-case prompts + main analysis (Sonnet 4.6)

**Files:**
- Create: `api/vision/lib/use-cases.js`
- Create: `api/vision/lib/main-analysis.js`
- Test: `api/vision/lib/main-analysis.test.js`

**Goal:** A library of prompt templates (one per use-case) + a `analyzeImage({ imageUrl, useCase, contextText })` function that returns structured JSON.

- [ ] **Step 1: Write use-cases.js**

```js
// api/vision/lib/use-cases.js
/**
 * Prompt library for the 6 primary e-commerce vision use-cases.
 * Each template returns a strict JSON contract that brain.js injects
 * into the LLM context when composing the final customer reply.
 */

const JSON_SHAPE = `{
  "description": "short neutral description of what is visible (max 40 words)",
  "detected_issue": "what is wrong if anything, null otherwise",
  "extracted_data": { "key1": "value1", "...": "..." },
  "recommended_action": "one of: create_return | create_exchange | escalate_tech | lookup_order | request_more_info | answer_directly",
  "confidence": 0.0 to 1.0
}`

export const USE_CASES = {
  broken_product: {
    prompt: `The customer sent this photo claiming their product is BROKEN or DEFECTIVE. Analyze the visible damage (cracks, dents, missing parts, stains, malfunction). Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include if visible: product_name, visible_damage, damage_severity (minor|moderate|severe).`,
    default_action: 'create_return',
  },
  checkout_error: {
    prompt: `The customer sent a screenshot of a CHECKOUT or PAYMENT ERROR on the merchant's Shopify store. Identify the error shown. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: error_message, step (cart|checkout|payment|shipping|other), browser_if_visible.`,
    default_action: 'escalate_tech',
  },
  shipping_label: {
    prompt: `The customer sent a photo of a SHIPPING LABEL or tracking barcode. Extract the tracking number and carrier. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: carrier (colissimo|dhl|ups|mondial_relay|chronopost|other), tracking_number, destination_if_visible.`,
    default_action: 'lookup_order',
  },
  invoice_receipt: {
    prompt: `The customer sent a photo of an INVOICE or ORDER RECEIPT (maybe from our store, maybe physical). Extract the order number. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: order_number, order_date_if_visible, total_amount_if_visible, currency.`,
    default_action: 'lookup_order',
  },
  product_received: {
    prompt: `The customer sent a photo of a product they RECEIVED but something is wrong (wrong size, wrong color, wrong item, not what was ordered). Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: product_name, visible_issue (wrong_size|wrong_color|wrong_item|other), received_details.`,
    default_action: 'create_exchange',
  },
  other: {
    prompt: `Analyze this customer-support image and describe what you see. Output JSON:\n${JSON_SHAPE}\n\nextracted_data can include any relevant fields you identify.`,
    default_action: 'request_more_info',
  },
}

/**
 * If the caller doesn't pass a hint, we let Claude auto-detect using all
 * prompts concatenated. In practice, we'll route by use-case once the
 * context_text gives hints (see brain.js heuristics).
 */
export function buildPromptFor(useCase, contextText) {
  const uc = USE_CASES[useCase] || USE_CASES.other
  const ctx = contextText ? `\n\nCUSTOMER MESSAGE CONTEXT (may help interpret the image):\n"${contextText.slice(0, 500)}"` : ''
  return uc.prompt + ctx
}

export function defaultActionFor(useCase) {
  return USE_CASES[useCase]?.default_action || 'request_more_info'
}
```

- [ ] **Step 2: Write failing test for main-analysis**

```js
// api/vision/lib/main-analysis.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeImage } from './main-analysis.js'

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('returns structured JSON for a broken product photo', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify({
          description: 'A broken ceramic mug with visible cracks.',
          detected_issue: 'cracked_handle',
          extracted_data: { product_name: 'mug', visible_damage: 'cracked handle', damage_severity: 'moderate' },
          recommended_action: 'create_return',
          confidence: 0.9,
        })}],
        usage: { input_tokens: 1600, output_tokens: 150 },
        model: 'claude-sonnet-4-6',
      }),
    })

    const out = await analyzeImage({
      imageUrl: 'https://x.io/mug.jpg',
      useCase: 'broken_product',
      contextText: 'My mug arrived cracked',
    })

    expect(out.analysis.recommended_action).toBe('create_return')
    expect(out.analysis.extracted_data.visible_damage).toBe('cracked handle')
    expect(out.tokens_in).toBe(1600)
    expect(out.tokens_out).toBe(150)
    expect(out.model_id).toBe('claude-sonnet-4-6')
  })

  it('falls back to request_more_info if Claude returns non-JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'I cannot analyze this clearly.' }],
        usage: { input_tokens: 1500, output_tokens: 20 },
      }),
    })

    const out = await analyzeImage({ imageUrl: 'x', useCase: 'other' })
    expect(out.analysis.recommended_action).toBe('request_more_info')
    expect(out.analysis.confidence).toBeLessThan(0.5)
  })

  it('throws on API error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limit' })
    await expect(analyzeImage({ imageUrl: 'x', useCase: 'other' })).rejects.toThrow(/429/)
  })
})
```

- [ ] **Step 3: Run the test — expect FAIL**

Run: `npx vitest run api/vision/lib/main-analysis.test.js`
Expected: FAIL with `Cannot find module './main-analysis.js'`.

- [ ] **Step 4: Implement main-analysis.js**

```js
// api/vision/lib/main-analysis.js
/**
 * Sonnet 4.6 structured vision analysis.
 * Input:  { imageUrl, useCase, contextText? }
 * Output: { analysis, tokens_in, tokens_out, model_id, processing_ms }
 *
 * `analysis` is the JSON contract documented in use-cases.js. If Claude
 * returns non-JSON or malformed JSON, we fall back to a request_more_info
 * envelope with low confidence so brain.js can escalate gracefully.
 */
import { buildPromptFor, defaultActionFor } from './use-cases.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'
const TIMEOUT_MS = 15000   // 15s — vision calls are slower than text
const MAX_TOKENS = 600

function safeJson(raw) {
  try { return JSON.parse(raw) } catch {}
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return null
}

export async function analyzeImage({ imageUrl, useCase = 'other', contextText = '' }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!imageUrl) throw new Error('imageUrl required')

  const startTime = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: buildPromptFor(useCase, contextText) },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Sonnet ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
    const parsed = safeJson(raw)

    const analysis = parsed || {
      description: raw.slice(0, 240),
      detected_issue: null,
      extracted_data: {},
      recommended_action: defaultActionFor(useCase),
      confidence: 0.3,
    }

    return {
      analysis,
      tokens_in: data?.usage?.input_tokens || 0,
      tokens_out: data?.usage?.output_tokens || 0,
      model_id: data?.model || MODEL,
      processing_ms: Date.now() - startTime,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Sonnet timeout (15s)')
    throw err
  }
}
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npx vitest run api/vision/lib/main-analysis.test.js`
Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/vision/lib/use-cases.js api/vision/lib/main-analysis.js api/vision/lib/main-analysis.test.js
git commit -m "feat(vision): Sonnet 4.6 structured analysis + use-case prompts

6 use-case templates (broken_product, checkout_error, shipping_label,
invoice_receipt, product_received, other) each returning the same JSON
shape for downstream agents. Fallback wrapper catches non-JSON output
so brain.js can escalate instead of crashing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Vision endpoint (wires it all together)

**Files:**
- Create: `api/vision/analyze.js`
- Test: `api/vision/analyze.test.js`

**Goal:** Public internal endpoint called by brain.js. Input: `{ client_id, ticket_id, image_paths[], use_case_hint?, context_text? }`. Output: `{ analyses[], total_cost_eur, over_quota }`. Enforces plan quota, generates signed URLs, calls sensitivity pre-check then main analysis, logs each to `vision_analyses`.

- [ ] **Step 1: Write the failing test**

```js
// api/vision/analyze.test.js
// High-level integration-style test. We mock Supabase + the two Claude
// libs so we don't hit external services. The endpoint orchestration
// logic is what we care about.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from './analyze.js'

vi.mock('./lib/sensitive-check.js', () => ({
  checkSensitive: vi.fn(),
}))
vi.mock('./lib/main-analysis.js', () => ({
  analyzeImage: vi.fn(),
}))

import { checkSensitive } from './lib/sensitive-check.js'
import { analyzeImage } from './lib/main-analysis.js'

function makeReqRes(body, headers = {}) {
  const req = { method: 'POST', body, headers: { 'x-internal-secret': 'test-secret', ...headers }, query: {} }
  const res = {
    statusCode: 200, body: null,
    status(n) { this.statusCode = n; return this },
    json(b) { this.body = b; return this },
  }
  return { req, res }
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.INTERNAL_API_SECRET = 'test-secret'
})

describe('POST /api/vision/analyze', () => {
  it('rejects non-POST', async () => {
    const { req, res } = makeReqRes({})
    req.method = 'GET'
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects without secret', async () => {
    const { req, res } = makeReqRes({ client_id: 'x', image_paths: ['a.jpg'] }, { 'x-internal-secret': 'wrong' })
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('short-circuits when image is sensitive (does not call main analysis)', async () => {
    checkSensitive.mockResolvedValue({ is_sensitive: true, tokens_in: 300, tokens_out: 1, model_id: 'claude-haiku-4-5', processing_ms: 400 })
    // analyzeImage must NOT be called
    const { req, res } = makeReqRes({ client_id: '00000000-0000-0000-0000-000000000001', image_paths: ['tenant/ticket/a.jpg'] })
    await handler(req, res)
    expect(analyzeImage).not.toHaveBeenCalled()
    expect(res.body.analyses[0].is_sensitive).toBe(true)
    expect(res.body.analyses[0].recommended_action).toBe('escalate_sensitive')
  })

  it('calls main analysis when not sensitive', async () => {
    checkSensitive.mockResolvedValue({ is_sensitive: false, tokens_in: 300, tokens_out: 1, model_id: 'claude-haiku-4-5', processing_ms: 400 })
    analyzeImage.mockResolvedValue({
      analysis: { description: 'broken mug', recommended_action: 'create_return', confidence: 0.9, extracted_data: {}, detected_issue: 'broken' },
      tokens_in: 1600, tokens_out: 150, model_id: 'claude-sonnet-4-6', processing_ms: 2800,
    })
    const { req, res } = makeReqRes({ client_id: '00000000-0000-0000-0000-000000000001', image_paths: ['t/a.jpg'], use_case_hint: 'broken_product' })
    await handler(req, res)
    expect(analyzeImage).toHaveBeenCalled()
    expect(res.body.analyses[0].is_sensitive).toBe(false)
    expect(res.body.analyses[0].recommended_action).toBe('create_return')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run api/vision/analyze.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the endpoint**

```js
// api/vision/analyze.js
/**
 * POST /api/vision/analyze
 * Internal endpoint called by brain.js. Analyzes up to 5 images in parallel.
 *
 * Auth: x-internal-secret header OR x-engine-secret.
 *
 * Body:
 *   {
 *     client_id: UUID (required)
 *     ticket_id: UUID (optional — links result to ai_conversations row)
 *     image_paths: string[] (required, max 5, each is a storage path under ticket-attachments)
 *     use_case_hint?: 'broken_product' | 'checkout_error' | 'shipping_label' | 'invoice_receipt' | 'product_received' | 'other'
 *     context_text?: string — customer message snippet to help Claude interpret
 *   }
 *
 * Response:
 *   {
 *     analyses: Array<{
 *       image_path: string,
 *       is_sensitive: boolean,
 *       description?: string,
 *       extracted_data?: object,
 *       recommended_action: string,
 *       confidence?: number,
 *       error?: string
 *     }>,
 *     total_cost_eur: number,
 *     over_quota: boolean  // true if this run pushed the client over plan limit
 *   }
 */
import { withSentry, captureError } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkSensitive } from './lib/sensitive-check.js'
import { analyzeImage } from './lib/main-analysis.js'
import { getLimits } from '../lib/plan-limits.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Indicative $/€ pricing — update if Anthropic changes their rates
const PRICE_PER_M_INPUT  = { 'claude-sonnet-4-6': 2.8, 'claude-haiku-4-5': 0.25 }   // EUR per 1M input tokens
const PRICE_PER_M_OUTPUT = { 'claude-sonnet-4-6': 14,  'claude-haiku-4-5': 1.25 }

function costEur(model, tin, tout) {
  const pin = PRICE_PER_M_INPUT[model] || 3
  const pout = PRICE_PER_M_OUTPUT[model] || 15
  return (tin * pin + tout * pout) / 1_000_000
}

async function createSignedUrl(path, ttlSeconds = 300) {
  const { data, error } = await supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}

async function currentMonthUsage(clientId) {
  const period = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
  const start = `${period}-01T00:00:00Z`
  const { count } = await supabase
    .from('vision_analyses')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', start)
  return count || 0
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const secret = req.headers['x-internal-secret'] || req.headers['x-engine-secret']
  const ok = secret && (secret === process.env.INTERNAL_API_SECRET || secret === process.env.ENGINE_WEBHOOK_SECRET)
  if (!ok) return res.status(401).json({ error: 'unauthorized' })

  const { client_id, ticket_id, image_paths, use_case_hint, context_text } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id required' })
  if (!Array.isArray(image_paths) || image_paths.length === 0) return res.status(400).json({ error: 'image_paths required' })
  if (image_paths.length > 5) return res.status(400).json({ error: 'max 5 images per call' })

  // ----- Plan quota check -----
  const { data: client } = await supabase
    .from('clients').select('plan').eq('id', client_id).maybeSingle()
  if (!client) return res.status(404).json({ error: 'client_not_found' })

  const limits = getLimits(client.plan || 'free')
  const already = await currentMonthUsage(client_id)
  const remaining = (limits.vision_analyses_per_month ?? 0) - already

  if (remaining <= 0 && limits.overage === null) {
    return res.status(429).json({ error: 'vision_quota_exceeded', quota: limits.vision_analyses_per_month, used: already })
  }

  // ----- Per-image pipeline (parallel) -----
  const analyses = []
  let totalCost = 0

  await Promise.all(image_paths.map(async (path) => {
    const rowBase = { client_id, ticket_id: ticket_id || null, image_path: path, use_case: use_case_hint || null }
    try {
      const signed = await createSignedUrl(path)

      // 1. Sensitivity pre-check
      const sens = await checkSensitive({ imageUrl: signed })
      const sensCost = costEur(sens.model_id, sens.tokens_in, sens.tokens_out)
      totalCost += sensCost

      if (sens.is_sensitive) {
        await supabase.from('vision_analyses').insert({
          ...rowBase,
          is_sensitive_detected: true,
          tokens_in: sens.tokens_in,
          tokens_out: sens.tokens_out,
          cost_eur: sensCost,
          model_id: sens.model_id,
          processing_ms: sens.processing_ms,
          result_json: { short_circuited: 'sensitive_document' },
        })
        // Delete the stored file immediately
        await supabase.storage.from('ticket-attachments').remove([path]).catch(() => {})

        analyses.push({
          image_path: path,
          is_sensitive: true,
          recommended_action: 'escalate_sensitive',
        })
        return
      }

      // 2. Main analysis
      const main = await analyzeImage({ imageUrl: signed, useCase: use_case_hint, contextText: context_text })
      const mainCost = costEur(main.model_id, main.tokens_in, main.tokens_out)
      totalCost += mainCost

      await supabase.from('vision_analyses').insert({
        ...rowBase,
        is_sensitive_detected: false,
        tokens_in: sens.tokens_in + main.tokens_in,
        tokens_out: sens.tokens_out + main.tokens_out,
        cost_eur: sensCost + mainCost,
        model_id: main.model_id,
        processing_ms: sens.processing_ms + main.processing_ms,
        result_json: main.analysis,
      })

      analyses.push({
        image_path: path,
        is_sensitive: false,
        ...main.analysis,
      })
    } catch (err) {
      captureError(err, { tags: { feature: 'vision', client_id, image_path: path } })
      analyses.push({ image_path: path, is_sensitive: false, error: String(err.message || err), recommended_action: 'request_more_info' })
    }
  }))

  return res.status(200).json({
    analyses,
    total_cost_eur: Number(totalCost.toFixed(5)),
    over_quota: remaining <= 0,
  })
}

export default withSentry(handler)
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run api/vision/analyze.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/vision/analyze.js api/vision/analyze.test.js
git commit -m "feat(vision): /api/vision/analyze orchestration endpoint

Signed-URL + sensitivity-check-first + main-analysis pipeline, up to 5
images in parallel. Sensitive docs trigger immediate storage purge and
escalate_sensitive action. Plan quota enforced via vision_analyses_per_month.
Every call logged in vision_analyses with cost_eur for billing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Plan limits + engine integration

**Files:**
- Modify: `api/lib/plan-limits.js`
- Modify: `src/lib/plans.js`
- Modify: `api/engine/lib/normalizer.js`
- Modify: `api/engine/brain.js`
- Modify: `api/engine/agents/_shared.js`
- Modify: `api/engine/agents/return-agent.js`
- Modify: `api/engine/agents/product-agent.js`

- [ ] **Step 1: Add `vision_analyses_per_month` to plan-limits (back)**

In `api/lib/plan-limits.js`, extend each plan object:

```js
free:       { ..., vision_analyses_per_month: 10 },
starter:    { ..., vision_analyses_per_month: 200 },
pro:        { ..., vision_analyses_per_month: 2000 },
enterprise: { ..., vision_analyses_per_month: Infinity },
```

Overage rate in the same file:

```js
export const VISION_OVERAGE_EUR = 0.05  // per analysis past quota (starter/pro only)
```

- [ ] **Step 2: Mirror in `src/lib/plans.js`**

Add the same `vision_analyses_per_month` numbers to each plan in `PLANS` (or whichever export the frontend reads). Keep zero behaviour change if the key was missing — components must coalesce with `?? 0`.

- [ ] **Step 3: Normalizer — add `images[]` to output shape**

In `api/engine/lib/normalizer.js`, extend the `normalizeEvent` return object:

```js
return {
  customer_email: ...,
  // ...
  images: normalized.images || payload.images || [],    // NEW
  channel: source,
  metadata: ...,
}
```

And each `normalizeXxx()` function must pass `images` through if present in the payload. Default empty array.

- [ ] **Step 4: Add `VISION_CONTEXT_INSTRUCTION` to `_shared.js`**

Append to `api/engine/agents/_shared.js`:

```js
export const VISION_CONTEXT_INSTRUCTION = `\n\nVISION CONTEXT:\nLe client a joint une ou plusieurs images. Leur analyse automatique est fournie ci-dessous dans le champ "vision_context". Utilise ces informations pour repondre precisement au client (identifier le probleme, le produit, le numero de commande, etc.) au lieu de demander des details qu'on a deja extraits de l'image.`
```

- [ ] **Step 5: brain.js — call vision before routing**

In `api/engine/brain.js`, inside `runBrain(...)`, right after `clientConfig = await loadClientConfig(...)` but before classification:

```js
// ---- Vision pre-analysis ----
let visionContext = null
if (Array.isArray(normalized?.images) && normalized.images.length > 0 && clientConfig?.settings?.vision_enabled) {
  try {
    const resp = await fetch(`${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET },
      body: JSON.stringify({
        client_id: clientId,
        ticket_id: normalized.ticket_id || null,
        image_paths: normalized.images.slice(0, 5),
        use_case_hint: normalized.vision_use_case_hint,
        context_text: normalized.message || '',
      }),
    })
    if (resp.ok) {
      const json = await resp.json()
      visionContext = json.analyses

      // Any sensitive image → hard escalate, skip normal flow
      if (visionContext.some(a => a.is_sensitive)) {
        return {
          classification: 'other',
          confidence: 1,
          aiResponse: 'Photo sensible detectee, escaladee a un humain pour traitement securise.',
          needsReview: true,
          reviewReason: 'sensitive_document_detected',
          agentUsed: 'escalation',
          visionContext,
        }
      }
    }
  } catch (err) {
    console.warn('[brain] vision analyze failed, continuing without:', err.message)
  }
}
```

Then pass `visionContext` into the agent call by adding it to whatever object `_shared.js` agents already receive (e.g. `buildSystemPrompt` or `callClaude` arguments). In the system prompt, append:

```js
const finalSystemPrompt = basePrompt + (visionContext ? VISION_CONTEXT_INSTRUCTION + '\n\nvision_context = ' + JSON.stringify(visionContext) : '')
```

- [ ] **Step 6: return-agent.js and product-agent.js**

Each of these two agent files already builds its own system prompt. Append the `VISION_CONTEXT_INSTRUCTION` and inject `visionContext` the same way brain.js does. Exactly one-line change in each — add an `import` + an `+=` on the system prompt string.

- [ ] **Step 7: Commit**

```bash
git add api/lib/plan-limits.js src/lib/plans.js api/engine/lib/normalizer.js api/engine/brain.js api/engine/agents/_shared.js api/engine/agents/return-agent.js api/engine/agents/product-agent.js
git commit -m "feat(vision): wire vision analysis into brain + return/product agents

- Add vision_analyses_per_month quota to all 4 plans (10/200/2000/inf)
- Normalizer carries images[] through to brain
- brain.js calls /api/vision/analyze when images present AND client has
  vision_enabled, injects summary into the agent system prompt
- Sensitive-document short-circuit escalates without spending more tokens
- Return/product agents surface the vision extraction in replies

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Ingress — all 5 channels

Each channel must (1) extract image attachments, (2) upload them to Storage under `<clientId>/<ticketId-or-uuid>/<uuid>.<ext>`, (3) pass the storage paths to `normalizeEvent` in `images[]`.

Helper first, then one sub-task per channel.

**Files created:**
- `api/vision/lib/ingress.js` — shared upload helper

```js
// api/vision/lib/ingress.js
/**
 * Upload remote images (URLs or Buffer) to ticket-attachments bucket.
 * Returns array of storage paths.
 *
 *   uploadToStorage({ supabase, clientId, ticketId, images })
 *     images: Array<{ buffer: Buffer, mime: string, ext: string } | { url: string }>
 */
import crypto from 'crypto'

const BUCKET = 'ticket-attachments'
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_BYTES = 5 * 1024 * 1024    // 5 MB
const MIN_BYTES = 10 * 1024          // 10 KB — drop tiny email-signature logos

export async function uploadToStorage({ supabase, clientId, ticketId, images }) {
  const paths = []
  const idPart = ticketId || crypto.randomUUID()

  for (const img of images.slice(0, 5)) {
    let buf, mime, ext
    if (img.url) {
      const res = await fetch(img.url)
      if (!res.ok) continue
      mime = res.headers.get('content-type') || 'image/jpeg'
      if (!ALLOWED_MIME.has(mime)) continue
      buf = Buffer.from(await res.arrayBuffer())
      ext = mime.split('/')[1].replace('jpeg', 'jpg')
    } else if (img.buffer) {
      buf = img.buffer
      mime = img.mime
      if (!ALLOWED_MIME.has(mime)) continue
      ext = img.ext || 'jpg'
    } else {
      continue
    }

    if (buf.length < MIN_BYTES) continue   // signature logos
    if (buf.length > MAX_BYTES) continue   // too big

    const path = `${clientId}/${idPart}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (!error) paths.push(path)
  }
  return paths
}
```

Commit this helper first:

```bash
git add api/vision/lib/ingress.js
git commit -m "feat(vision): shared ingress upload helper for ticket-attachments bucket"
```

- [ ] **Step 6.1 — email webhook** (`api/engine/webhooks/inbound-email.js`)

Parse multipart. Resend/SendGrid deliver attachments as `attachments: [{ filename, content: base64 | url, content_type }]`. Before calling `normalizeEvent`:

```js
import { uploadToStorage } from '../../vision/lib/ingress.js'

// ... after parsing payload, before normalizeEvent:
const rawAttachments = body.attachments || []
const imgs = rawAttachments
  .filter(a => a.content_type?.startsWith('image/'))
  .map(a => a.content?.startsWith('http')
    ? { url: a.content }
    : { buffer: Buffer.from(a.content, 'base64'), mime: a.content_type, ext: a.filename?.split('.').pop() || 'jpg' })

const imagePaths = imgs.length
  ? await uploadToStorage({ supabase, clientId: resolvedClientId, ticketId: null, images: imgs })
  : []
payload.images = imagePaths
```

- [ ] **Step 6.2 — IMAP/Gmail polling** (`api/lib/email-poller.js`)

When reading each message:
- IMAP (`imapflow`): iterate `msg.parts` for parts where `type === 'image/*'`, read Buffer.
- Gmail (`messages.get full`): iterate `payload.parts[].body.attachmentId`, fetch `users.messages.attachments.get`, base64-decode.

For both, call `uploadToStorage(...)`, add `images` to the payload forwarded to `/api/engine/gateway`.

- [ ] **Step 6.3 — Gorgias webhook** (`api/engine/webhooks/gorgias.js`)

Gorgias delivers `message.attachments: [{ url, content_type, size }]`. Filter image/*, pass URLs straight:

```js
const imgs = (lastCustomerMessage.attachments || [])
  .filter(a => a.content_type?.startsWith('image/'))
  .map(a => ({ url: a.url }))
```

Then `uploadToStorage` + add to `images`.

- [ ] **Step 6.4 — Zendesk webhook** (`api/engine/webhooks/zendesk.js`)

Zendesk `comment.attachments: [{ content_url, content_type }]`. Same pattern. Requires Bearer token in fetch (add `Authorization` header from the integration token).

- [ ] **Step 6.5 — WhatsApp webhook** (`api/engine/webhooks/whatsapp.js`)

For `message.type === 'image'`, download via Meta Graph:
1. `GET https://graph.facebook.com/v21.0/{media.id}` → returns media URL
2. `GET <media_url>` with `Authorization: Bearer <access_token>` → binary Buffer
3. Pass `{ buffer, mime: media.mime_type, ext }` to `uploadToStorage`.

- [ ] **Step 6.6 — Widget webhook** (`api/engine/webhooks/widget.js`)

Already JSON. Accept `images: string[]` (already-uploaded storage paths or data URLs — decode data URLs to Buffer).

- [ ] **Step 6.7 — Tests**

For each channel, add a unit test in `api/engine/webhooks/<channel>.test.js` that feeds a fixture payload with a base64 image and asserts `uploadToStorage` is called with the right shape. Mock Supabase storage.

- [ ] **Step 6.8 — Commit (one per channel, logical batches)**

```bash
git commit -m "feat(vision): extract image attachments in email ingress (webhook + polling)"
git commit -m "feat(vision): extract image attachments in Gorgias + Zendesk ingress"
git commit -m "feat(vision): download WhatsApp media via Meta Graph"
git commit -m "feat(vision): accept images[] in widget webhook"
```

---

## Task 7: Frontend — portal upload + dashboard widget + pricing

**Files:**
- Create: `src/components/portal/AttachmentUploader.jsx`
- Create: `api/portal/upload-attachment.js`
- Create: `src/components/client/overview/VisionUsageWidget.jsx`
- Modify: `src/pages/portal/PortalTicketDetailPage.jsx`
- Modify: `src/pages/portal/PortalApp.jsx` (if ticket creation form lives here)
- Modify: `src/components/client/overview/OverviewHome.jsx`
- Modify: `src/pages/PricingPage.jsx`
- Modify: `src/components/client/AgentControlCenterView.jsx`

- [ ] **Step 7.1 — Portal upload endpoint**

`api/portal/upload-attachment.js`:

```js
import { withSentry } from '../lib/sentry.js'
import { getServiceRoleClient } from './lib/supabase.js'
import { requirePortalSession } from './lib/session.js'
import crypto from 'crypto'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX = 5 * 1024 * 1024

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  let session
  try { session = await requirePortalSession(req) }
  catch (e) { return res.status(e.status).json({ error: e.code }) }

  const { data_url, filename } = req.body || {}
  if (!data_url?.startsWith('data:image/')) return res.status(400).json({ error: 'invalid_data_url' })

  const [header, b64] = data_url.split(',')
  const mime = header.match(/data:(image\/[a-z+]+);base64/i)?.[1]
  if (!ALLOWED.has(mime)) return res.status(400).json({ error: 'mime_not_allowed' })

  const buf = Buffer.from(b64, 'base64')
  if (buf.length > MAX) return res.status(413).json({ error: 'too_large' })

  const ext = mime.split('/')[1].replace('jpeg', 'jpg')
  const path = `${session.clientId}/portal/${crypto.randomUUID()}.${ext}`

  const supabase = getServiceRoleClient()
  const { error } = await supabase.storage.from('ticket-attachments').upload(path, buf, {
    contentType: mime, upsert: false,
  })
  if (error) return res.status(500).json({ error: 'upload_failed' })

  return res.status(200).json({ path })
}

export default withSentry(handler)
```

- [ ] **Step 7.2 — `AttachmentUploader.jsx`**

Drag-and-drop React component, limit 5 × 5MB, calls `/api/portal/upload-attachment` and returns an array of paths to parent form.

```jsx
// src/components/portal/AttachmentUploader.jsx
import { useState } from 'react'

const MAX = 5
const MAX_SIZE = 5 * 1024 * 1024

export default function AttachmentUploader({ onChange }) {
  const [paths, setPaths] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function handleFiles(files) {
    if (paths.length + files.length > MAX) return setErr(`Max ${MAX} images`)
    setBusy(true); setErr(null)

    const newPaths = [...paths]
    for (const file of files) {
      if (file.size > MAX_SIZE) { setErr(`"${file.name}" depasse 5 Mo`); continue }
      if (!file.type.startsWith('image/')) { setErr(`"${file.name}" n'est pas une image`); continue }
      const dataUrl = await new Promise(r => {
        const reader = new FileReader()
        reader.onload = () => r(reader.result)
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/portal/upload-attachment', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data_url: dataUrl, filename: file.name }),
      })
      if (resp.ok) {
        const { path } = await resp.json()
        newPaths.push(path)
      } else {
        setErr('Upload echoue')
      }
    }
    setPaths(newPaths); onChange?.(newPaths); setBusy(false)
  }

  return (
    <div>
      <label className="block text-sm mb-2">Photos (optionnel, max 5 × 5 Mo)</label>
      <input type="file" multiple accept="image/*" disabled={busy}
        onChange={e => handleFiles([...e.target.files])}
        className="block text-sm" />
      {paths.length > 0 && (
        <ul className="mt-2 text-xs text-[#5A5A5A]">
          {paths.map(p => <li key={p}>✓ {p.split('/').pop()}</li>)}
        </ul>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}
```

- [ ] **Step 7.3 — Wire `AttachmentUploader` into `PortalTicketDetailPage.jsx`**

Import + render above `<textarea>`. Include paths in POST body:

```jsx
import AttachmentUploader from '../../components/portal/AttachmentUploader'
// ...
const [imagePaths, setImagePaths] = useState([])
// ...
<AttachmentUploader onChange={setImagePaths} />
// ...
body: JSON.stringify({ ticketId, message: reply, image_paths: imagePaths }),
```

Also in `api/portal/ticket-reply.js`, store `image_paths` into the ai_conversations row metadata and pass to gateway if an agent re-run is triggered (here we only store; the next engine run will pick them up).

- [ ] **Step 7.4 — Dashboard widget**

`src/components/client/overview/VisionUsageWidget.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

export default function VisionUsageWidget({ clientId, planLimit }) {
  const period = new Date().toISOString().slice(0, 7)
  const start = `${period}-01T00:00:00Z`
  const { data } = useQuery({
    queryKey: ['vision-usage', clientId, period],
    queryFn: async () => {
      const { count } = await supabase
        .from('vision_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', start)
      return count || 0
    },
    staleTime: 60_000,
  })
  const used = data ?? 0
  const limit = planLimit ?? 0
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0

  return (
    <div className="rounded-2xl border border-gray-200 p-5 bg-white">
      <h3 className="text-sm font-semibold text-[#262626]">Analyses vision — ce mois</h3>
      <p className="text-3xl font-bold mt-1">{used} <span className="text-sm text-[#999]">/ {limit === Infinity ? '∞' : limit}</span></p>
      <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
        <div className="h-full bg-[#14A85C] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7.5 — Insert widget in `OverviewHome.jsx`**

Add `<VisionUsageWidget clientId={currentClient?.id} planLimit={limits.vision_analyses_per_month} />` in the widgets grid.

- [ ] **Step 7.6 — PricingPage.jsx**

In each plan card, add a line `Vision : 10/mois` (Free) / `200/mois` (Starter) / `2 000/mois` (Pro) / `illimité` (Enterprise) with the same list-item styling as the other features.

- [ ] **Step 7.7 — Toggle in `AgentControlCenterView.jsx`**

Add a toggle bound to `client_settings.vision_enabled` with an UPDATE via Supabase. Label: "Analyse des images envoyees par le client (Claude Vision)".

- [ ] **Step 7.8 — Commit**

```bash
git commit -m "feat(vision): portal uploader + dashboard usage widget + pricing line + agent toggle"
```

---

## Task 8: Purge cron + documentation + tests

**Files:**
- Create: `api/cron/purge-vision-images.js`
- Modify: `vercel.json` (add cron schedule)
- Create: `docs/essentials/vision.mdx` (user-facing doc)
- Create: `tests/e2e/vision.spec.js` (Playwright)

- [ ] **Step 8.1 — Purge cron**

```js
// api/cron/purge-vision-images.js
import { withCronMonitor } from '../lib/cron-monitor.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
export const maxDuration = 60

async function handler(req, res) {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()

  const { data: old } = await supabase
    .from('vision_analyses')
    .select('image_path')
    .lt('created_at', cutoff)
    .limit(500)

  if (!old?.length) return res.status(200).json({ deleted: 0 })

  const paths = old.map(r => r.image_path).filter(Boolean)
  await supabase.storage.from('ticket-attachments').remove(paths).catch(() => {})

  // We keep the DB row for audit but null the path (analysis result still readable)
  await supabase.from('vision_analyses')
    .update({ image_path: '[purged]' })
    .lt('created_at', cutoff)

  return res.status(200).json({ deleted: paths.length })
}

export default withCronMonitor('purge-vision-images', '0 3 * * *', handler)
```

- [ ] **Step 8.2 — Add to `vercel.json`**

```json
{
  "path": "/api/cron/purge-vision-images",
  "schedule": "0 3 * * *"
}
```

- [ ] **Step 8.3 — Documentation**

`docs/essentials/vision.mdx` — user-facing doc listing the 6 use-cases, plan limits, RGPD promise, example request/response. Cross-link from `docs/essentials/escalades.mdx` (sensitive-doc escalation) and from `docs/essentials/facturation.mdx` (overage 0,05 €).

- [ ] **Step 8.4 — E2E test**

`tests/e2e/vision.spec.js` — Playwright script:
1. Login as test portal user
2. Open a ticket, attach a broken-mug fixture from `tests/fixtures/vision/broken-mug.jpg`
3. Submit
4. Wait up to 15 s for agent response
5. Assert response mentions "casse" or "retour" and doesn't contain "je n'ai pas d'image"

- [ ] **Step 8.5 — Unit tests for sensitivity (extend Task 2 file)**

Add 10 more test cases with fixture images covering: real ID card photo, CB photo, passport photo, driving licence, **and** 5 benign images (product, receipt, shipping label, screenshot, selfie of package). Mock Claude to return the expected "yes/no" for each.

- [ ] **Step 8.6 — Commit**

```bash
git commit -m "feat(vision): daily purge cron + docs + E2E test + sensitivity fixtures"
```

---

## Rollout sequence (prod)

1. Deploy Milestone A (Tasks 1-5): migration runs → endpoint live → plan limits in effect. Feature gated by `client_settings.vision_enabled=false` by default so no client sees any behaviour change.
2. Manually enable on one beta client (`UPDATE client_settings SET vision_enabled=true WHERE client_id=...`) and watch logs + Sentry.
3. After 48 h without error, deploy Milestone B (Task 6).
4. Deploy Milestone C (Tasks 7-8) once UX design is validated.
5. Flip the default `vision_enabled=true` in a later migration once confidence is high.

---

## Success criteria checklist (to verify after rollout)

- [ ] A customer uploading a broken-mug photo via the portal gets a reply in < 10 s referencing the visible damage
- [ ] A customer uploading a CB photo triggers immediate human escalation, the storage object is deleted, and `vision_analyses.is_sensitive_detected=true`
- [ ] `vision_analyses_per_month` quota enforced: Free client's 11th analysis returns `429 vision_quota_exceeded`
- [ ] Dashboard widget shows accurate "used / limit"
- [ ] `purge-vision-images` cron runs nightly and image paths older than 90 days are nulled
- [ ] Sentry has zero unhandled exceptions tagged `feature:vision` after 48 h
- [ ] Every vision call is a row in `vision_analyses` with non-zero `cost_eur`
