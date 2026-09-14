import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prices are read at module-eval into the PRICES const → must exist before import.
vi.hoisted(() => {
  process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter_m';
  process.env.STRIPE_PRICE_STARTER_ANNUAL = 'price_starter_a';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
  process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_a';
});

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@ex.com' },
  clientRow: null,
  existingSub: null,
  customerCards: [],
  stripe: null,
}));

vi.mock('../lib/sentry.js', () => ({ withSentry: (fn) => fn, captureError: () => {} }));
vi.mock('../lib/admin-auth.js', () => ({ isActeroAdmin: () => Promise.resolve(false) }));

vi.mock('@supabase/supabase-js', () => {
  function builder(table) {
    const b = {
      select: () => b, eq: () => b, not: () => b, limit: () => b, update: () => b,
      maybeSingle: async () => {
        if (table === 'client_users') return { data: { client_id: 'c1' }, error: null };
        if (table === 'funnel_clients') return { data: null, error: null };
        if (table === 'clients') return { data: h.clientRow, error: null };
        return { data: null, error: null };
      },
      single: async () => ({ data: h.clientRow, error: null }),
    };
    return b;
  }
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
      from: (t) => builder(t),
    }),
  };
});

vi.mock('stripe', () => ({ default: function Stripe() { return h.stripe; } }));

import handler from './create-subscription.js';

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function baseStripe() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: 'cus_1' })),
      retrieve: vi.fn(async () => ({ id: 'cus_1', deleted: false })),
    },
    subscriptions: {
      retrieve: vi.fn(async () => h.existingSub),
      update: vi.fn(async () => ({})),
      create: vi.fn(async (params) => {
        if (params.trial_period_days) {
          return { id: 'sub_1', status: 'trialing', pending_setup_intent: { client_secret: 'seti_secret' }, latest_invoice: null };
        }
        return { id: 'sub_1', status: 'incomplete', pending_setup_intent: null, latest_invoice: { payment_intent: { client_secret: 'pi_secret' } } };
      }),
    },
    promotionCodes: { list: vi.fn(async () => ({ data: [] })) },
    paymentMethods: { list: vi.fn(async () => ({ data: h.customerCards })) },
    setupIntents: { create: vi.fn(async () => ({ client_secret: 'seti_new' })) },
  };
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  h.clientRow = { id: 'c1', plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: null, contact_email: 'u@ex.com', brand_name: 'Shop', trial_ends_at: null, referral_first_month_free: false, referred_by_client_id: null };
  h.existingSub = null;
  h.customerCards = [];
  h.stripe = baseStripe();
});

const body = { client_id: 'c1', target_plan: 'starter', billing_period: 'monthly' };
const post = (b = body) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body: b });

describe('create-subscription', () => {
  it('401 without token', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body }, res);
    expect(res.statusCode).toBe(401);
  });

  it('400 on downgrade (target <= current)', async () => {
    h.clientRow.plan = 'pro';
    const res = makeRes();
    await handler(post({ ...body, target_plan: 'starter' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('503 when STRIPE_SECRET_KEY missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = makeRes();
    await handler(post(), res);
    expect(res.statusCode).toBe(503);
  });

  it('trial (no prior trial) → mode setup with setup-intent secret', async () => {
    const res = makeRes();
    await handler(post(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.mode).toBe('setup');
    expect(res.body.client_secret).toBe('seti_secret');
    // subscription must carry client_id for the webhook to map the plan
    const params = h.stripe.subscriptions.create.mock.calls[0][0];
    expect(params.metadata.client_id).toBe('c1');
    expect(params.trial_period_days).toBe(7);
  });

  it('no trial (already had one) → mode payment with payment-intent secret', async () => {
    h.clientRow.trial_ends_at = '2026-01-01T00:00:00Z';
    const res = makeRes();
    await handler(post(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.mode).toBe('payment');
    expect(res.body.client_secret).toBe('pi_secret');
  });

  it('existing active subscription with a card → instant swap, no client_secret', async () => {
    h.clientRow.stripe_subscription_id = 'sub_old';
    h.existingSub = { status: 'active', default_payment_method: 'pm_1', items: { data: [{ id: 'si_1' }] } };
    const res = makeRes();
    await handler(post({ ...body, target_plan: 'pro' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.instant).toBe(true);
    expect(h.stripe.subscriptions.update).toHaveBeenCalled();
    // the resolved card is pinned so the next renewal has something to charge
    expect(h.stripe.subscriptions.update.mock.calls[0][1].default_payment_method).toBe('pm_1');
  });

  // Regression: an abandoned checkout persists stripe_subscription_id before the
  // card is confirmed, leaving a trialing/incomplete subscription. Swapping on
  // that handed out a paid plan with no card — visible on the annual toggle,
  // where the current plan no longer matches so the button stays clickable.
  it('trialing subscription with no card anywhere → asks for the card, does NOT swap', async () => {
    h.clientRow.stripe_subscription_id = 'sub_old';
    h.existingSub = { id: 'sub_old', status: 'trialing', items: { data: [{ id: 'si_1' }] } };
    h.customerCards = [];
    const res = makeRes();
    await handler(post({ ...body, target_plan: 'pro', billing_period: 'annual' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.requires_card_first).toBe(true);
    expect(res.body.mode).toBe('setup');
    expect(res.body.client_secret).toBe('seti_new');
    expect(res.body.instant).toBeUndefined();
    expect(h.stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('trialing subscription reuses its pending setup-intent rather than making a new one', async () => {
    h.clientRow.stripe_subscription_id = 'sub_old';
    h.existingSub = {
      id: 'sub_old', status: 'trialing', items: { data: [{ id: 'si_1' }] },
      pending_setup_intent: { client_secret: 'seti_pending' },
    };
    const res = makeRes();
    await handler(post({ ...body, target_plan: 'pro', billing_period: 'annual' }), res);
    expect(res.body.client_secret).toBe('seti_pending');
    expect(h.stripe.setupIntents.create).not.toHaveBeenCalled();
  });

  it('card attached to the customer only → swap proceeds and pins it', async () => {
    h.clientRow.stripe_subscription_id = 'sub_old';
    h.existingSub = { id: 'sub_old', status: 'trialing', items: { data: [{ id: 'si_1' }] } };
    h.customerCards = [{ id: 'pm_from_customer' }];
    const res = makeRes();
    await handler(post({ ...body, target_plan: 'pro', billing_period: 'annual' }), res);
    expect(res.body.instant).toBe(true);
    expect(h.stripe.subscriptions.update.mock.calls[0][1].default_payment_method).toBe('pm_from_customer');
  });
});
