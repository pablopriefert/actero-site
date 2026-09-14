# Shopify App Store Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the Actero Shopify app pass App Store review so it can be published, fixing every blocker surfaced by the official `shopify-app-store-review` self-check.

**Architecture:** Dual-channel by acquisition source. Merchants who install via the Shopify App Store are billed through **Shopify Managed Pricing** (fastest compliant path, near-zero billing code); direct `actero.fr` signups keep **Stripe**. All Shopify Admin data access moves from REST to **GraphQL**. The chat widget installs **only** via the existing theme app extension (`actero-widget`) — the Asset API injection is removed. The app stays **non-embedded** (no App Bridge); the "intégrée" capability is removed in the Partner Dashboard.

**Tech Stack:** Vercel serverless (Node), Supabase, Shopify Admin GraphQL API (2025-01), Shopify Managed Pricing, theme app extension, Shopify CLI (`npx @shopify/cli app deploy`).

**Legend:** 🧑‍💻 CODE (Claude does it) · 🙋 USER (Partner Dashboard / CLI auth — only Pablo can do it).

---

## Task 1 — Billing: Shopify Managed Pricing for the App Store channel (🧑‍💻 + 🙋)

Blocker 1.2.1/1.2.2/1.2.3. Managed Pricing = Shopify hosts the plan-selection + charge UI; the app only links to it and reads state from the `app_subscriptions/update` webhook (already declared in the toml).

**Files:**
- Modify: `api/billing/upgrade.js` (route Shopify-sourced clients to Managed Pricing instead of Stripe)
- Modify: `api/shopify/webhooks/app/subscriptions-update.js` (map Shopify subscription → `clients.plan`)
- Create: `api/lib/billing-channel.js` (single source deciding Stripe vs Shopify)
- Test: `api/lib/billing-channel.test.js`

- [ ] **Step 1.1 (🙋 USER — Partner Dashboard):** In the Shopify Partner Dashboard → Actero → Distribution → Pricing, enable **Managed Pricing** and recreate the plans: Free (0), Starter (99€/mo, 79€ annual), Pro (399€/mo, 319€ annual), Enterprise (contact). Note the app handle in the managed-pricing URL: `https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans`.

- [ ] **Step 1.2 (🧑‍💻): Write the failing test** — `api/lib/billing-channel.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { resolveBillingChannel, managedPricingUrl } from './billing-channel.js'

describe('billing-channel', () => {
  it('routes shopify-sourced clients to shopify managed pricing', () => {
    expect(resolveBillingChannel({ shopDomain: 'demo.myshopify.com' })).toBe('shopify')
  })
  it('routes direct signups to stripe', () => {
    expect(resolveBillingChannel({ shopDomain: null })).toBe('stripe')
  })
  it('builds the managed pricing url from the store handle', () => {
    expect(managedPricingUrl('demo.myshopify.com')).toBe(
      'https://admin.shopify.com/store/demo/charges/actero/pricing_plans'
    )
  })
})
```

- [ ] **Step 1.3 (🧑‍💻): Run it — expect FAIL** (`npx vitest run api/lib/billing-channel.test.js`).

- [ ] **Step 1.4 (🧑‍💻): Implement** — `api/lib/billing-channel.js`:
```js
// Decide how a client is billed. Shopify App Store installs MUST use Shopify
// Managed Pricing (policy 1.2); direct actero.fr signups keep Stripe.
const APP_HANDLE = process.env.SHOPIFY_APP_HANDLE || 'actero'

export function resolveBillingChannel(client) {
  return client?.shopDomain ? 'shopify' : 'stripe'
}

export function managedPricingUrl(shopDomain) {
  const handle = String(shopDomain || '').replace(/\.myshopify\.com$/, '')
  return `https://admin.shopify.com/store/${handle}/charges/${APP_HANDLE}/pricing_plans`
}
```

- [ ] **Step 1.5 (🧑‍💻): Run it — expect PASS.**

- [ ] **Step 1.6 (🧑‍💻): Wire `api/billing/upgrade.js`** — at the top of the handler, after loading the client + its `client_shopify_connections.shop_domain`, short-circuit Shopify clients before any Stripe call:
```js
import { resolveBillingChannel, managedPricingUrl } from '../lib/billing-channel.js'
// ... after resolving `client` and its shopDomain:
if (resolveBillingChannel({ shopDomain }) === 'shopify') {
  return res.status(200).json({ url: managedPricingUrl(shopDomain), channel: 'shopify' })
}
// ...existing Stripe flow unchanged for direct clients...
```

- [ ] **Step 1.7 (🧑‍💻): Confirm `app/subscriptions-update.js` maps plan** — verify it reads the AppSubscription name/status and updates `clients.plan` + `clients.status`. If it only logs, add the mapping (subscription name → plan id; `ACTIVE`→plan, `CANCELLED`/`FROZEN`→`free`). Show the exact patch when the file is read during execution.

- [ ] **Step 1.8 (🧑‍💻): Commit** — `git commit -m "feat(billing): Shopify Managed Pricing for App Store channel, Stripe for direct"`

---

## Task 2 — REST → GraphQL: order lookup (🧑‍💻)

Blocker 2.2.4. Migrate `lookupOrder` to the GraphQL Admin API. Output shape of `formatOrder` stays identical so `shopify-client.js` consumers + the widget order card are untouched.

**Files:**
- Modify: `api/engine/lib/shopify-client.js` (lines 30-59 lookup + `formatOrder`)
- Test: `api/engine/lib/shopify-client.test.js`

- [ ] **Step 2.1: Write the failing test** — mock `fetch` returning a GraphQL `orders.edges` payload; assert `lookupOrder` returns `[{ orderName, fulfillmentStatus, items, trackingInfo }]` with the mapped fields. (Full mock written at execution time from the real GraphQL shape.)

- [ ] **Step 2.2: Run — expect FAIL.**

- [ ] **Step 2.3: Implement** — replace the two REST `fetch(.../orders.json?...)` calls with a single POST to `${baseUrl}/graphql.json` (baseUrl already `/admin/api/2025-01`), query:
```graphql
query($q: String!) {
  orders(first: 3, query: $q, sortKey: CREATED_AT, reverse: true) {
    edges { node {
      name email createdAt displayFinancialStatus displayFulfillmentStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 20) { edges { node { title quantity variantTitle
        originalUnitPriceSet { shopMoney { amount } } } } }
      fulfillments(first: 5) { status trackingInfo { number url company } }
      shippingAddress { city country }
    } }
  }
}
```
Build `$q` as `name:#1234` (order id path) or `email:foo@bar.com` (fallback), and map the GraphQL node into the existing `formatOrder` output object (orderName, fulfillmentStatus, items[{name,variant,quantity,price}], trackingInfo[{trackingNumber,trackingUrl,carrier}], contextText). Keep `contextText` builder as-is.

- [ ] **Step 2.4: Run — expect PASS.**

- [ ] **Step 2.5: Commit** — `git commit -m "refactor(shopify): order lookup via GraphQL Admin API (App Store 2.2.4)"`

---

## Task 3 — Widget install via theme app extension only; remove Asset API injection (🧑‍💻 + 🙋)

Blocker 5.1.1. The theme app extension (`extensions/actero-widget`) is the compliant install path; the Asset API injection into `assets.json` must go.

**Files:**
- Modify: `api/engine/shopify-widget.js` (remove the `assets.json` read/write injection — Task 3.2)
- Modify: `api/engine/shopify-vocal-widget.js` (same; vocal is off anyway — remove injection)
- Modify: `src/components/client/WidgetSetupView.jsx` (add theme-editor deep link + app-embed instructions)
- Modify: `extensions/actero-widget/blocks/widget.liquid` (ensure it reads the client key; no manual-key dead path)

- [ ] **Step 3.1 (🧑‍💻): Neutralize the Asset API injection** — in `shopify-widget.js`, replace the theme `assets.json` write with a no-op that returns `{ injected: false, method: 'theme_app_extension' }` and logs a deprecation note. Remove any caller that treated Asset injection as the install method (e.g. in `callback.js` if present).

- [ ] **Step 3.2 (🧑‍💻): Add the theme-editor deep link** in `WidgetSetupView.jsx` — a button "Activer dans mon thème" linking to `https://{shop}/admin/themes/current/editor?context=apps&template=index&activateAppId={THEME_APP_EXTENSION_UUID}/actero-widget`. Keep the manual `<script>` snippet as the "autre site (hors Shopify)" fallback only.

- [ ] **Step 3.3 (🙋 USER):** Confirm the theme app extension `actero-widget` is published (`npx @shopify/cli app deploy`) and note its extension UUID for the deep link in Step 3.2.

- [ ] **Step 3.4 (🧑‍💻): Commit** — `git commit -m "fix(widget): install via theme app extension, drop Asset API injection (5.1.1)"`

---

## Task 4 — Refund compliance (🧑‍💻)

Blocker 1.1.15 + 2.2.4. `api/engine/agent-actions/refund-with-rules.js` issues refunds via REST `/orders/{id}/refunds.json` — non-compliant AND unusable (no `write_orders` scope). Safest + fastest: disable direct refund execution; the agent drafts a refund for merchant approval (existing dashboard flow).

**Files:**
- Modify: `api/engine/agent-actions/refund-with-rules.js`
- Modify: `api/engine/execute-agent-action.mjs` (unregister `refund_with_rules` execution)
- Modify: `api/engine/copilot-drafts.js:90` (keep `refund`/`store_credit` as *draft* intents, not executed actions)

- [ ] **Step 4.1 (🧑‍💻):** Make `refund_with_rules` a **draft-only** action: instead of calling the Shopify refunds endpoint, it records a proposed refund on the escalation/review (merchant approves in Shopify Admin natively). Remove the REST refund `fetch`.

- [ ] **Step 4.2 (🧑‍💻): Commit** — `git commit -m "fix(engine): refunds are merchant-approved drafts, no direct REST refund (1.1.15)"`

---

## Task 5 — Install flow: no manual shop-domain entry on the App Store path (🧑‍💻)

Blocker 2.3.1. `app.js` (App Store entry) already derives `shop` from Shopify — good. Ensure the SetupWizard manual domain prompt is reachable **only** from the direct-dashboard "connect Shopify" flow, never as the App-Store install entry point.

**Files:**
- Modify: `src/components/client/SetupWizard.jsx` (gate the manual domain input behind a `source !== 'shopify_install'` check; when the client arrived via Shopify OAuth, show "Boutique connectée" instead of the domain prompt)

- [ ] **Step 5.1 (🧑‍💻):** If `progress.shopify` is already connected (OAuth done), never render the domain input. Confirm the App-Store install never lands the merchant on the manual-entry screen.

- [ ] **Step 5.2 (🧑‍💻): Commit** — `git commit -m "fix(onboarding): no manual myshopify entry on App Store install path (2.3.1)"`

---

## Task 6 — App config + capability alignment (🧑‍💻 + 🙋)

Blocker 1.1.1 / 2.2.3 (embedded) + scope minimization.

**Files:**
- Modify: `shopify.app.actero.toml`

- [ ] **Step 6.1 (🧑‍💻):** In `shopify.app.actero.toml`, keep `embedded = false`. Remove `read_themes,write_themes` from `scopes` (no longer needed — the widget installs via the theme app extension, not the Asset API). Resulting scopes: `read_orders,read_customers,read_products,read_fulfillments,read_checkouts,read_inventory,read_returns`.

- [ ] **Step 6.2 (🙋 USER):** In the Partner Dashboard, **remove the "intégrée" (embedded) capability** from the app so the declared capability matches `embedded = false` (non-embedded, opens on actero.fr).

- [ ] **Step 6.3 (🙋 USER):** Deploy the config: `npx @shopify/cli@latest app deploy` (requires Partner login). This pushes scopes + webhooks + the theme app extension.

- [ ] **Step 6.4 (🧑‍💻): Commit** — `git commit -m "chore(shopify): drop theme scopes, keep non-embedded (App Store alignment)"`

---

## Task 7 — Verify + resubmit (🧑‍💻 + 🙋)

- [ ] **Step 7.1 (🧑‍💻):** Re-run the local checks: `npm run lint`, `npx vitest run`, `npm run build`. All green.
- [ ] **Step 7.2 (🙋 USER):** Re-run the Shopify self-review (`/shopify-app-store-review`) in a fresh Claude session, confirm the ❌ are cleared.
- [ ] **Step 7.3 (🙋 USER):** In Partner Dashboard → Distribution → "Soumettre des corrections", resubmit for review.

---

## CODE vs USER summary
- **🧑‍💻 Claude (this session):** Tasks 1.2-1.8, 2, 3.1-3.2 + 3.4, 4, 5, 6.1 + 6.4, 7.1.
- **🙋 Pablo (Partner Dashboard / CLI):** 1.1 (Managed Pricing plans), 3.3 (extension UUID + deploy), 6.2 (remove "intégrée"), 6.3 (`app deploy`), 7.2 (self-review), 7.3 (resubmit).
