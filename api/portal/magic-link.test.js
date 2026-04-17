import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './magic-link.js';

let insertCall, resendCall;

vi.mock('./lib/supabase.js', () => ({
  getServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ gte: () => Promise.resolve({ count: 0, error: null }) }),
          }),
        }),
      }),
      insert: (row) => { insertCall = row; return Promise.resolve({ error: null }); },
    }),
  }),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn(async (args) => { resendCall = args; return { id: 'r_1' }; }) };
  },
}));

function makeReqRes(body) {
  return {
    req: { method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'test' } },
    res: { statusCode: 200, body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; } },
  };
}

describe('magic-link', () => {
  beforeEach(() => {
    insertCall = null; resendCall = null;
    process.env.PORTAL_BASE_DOMAIN = 'portal.actero.fr';
    process.env.RESEND_API_KEY = 'test';
  });

  it('sends magic link email', async () => {
    const { req, res } = makeReqRes({ clientId: 'c1', email: 'Paul@Ex.com', slug: 'horace' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(insertCall.customer_email).toBe('paul@ex.com');
    expect(insertCall.purpose).toBe('magic_link');
    expect(resendCall.to).toContain('paul@ex.com');
    expect(resendCall.html).toMatch(/horace\.portal\.actero\.fr\/portal\/verify\?token=/);
  });

  it('rejects missing fields', async () => {
    const { req, res } = makeReqRes({ email: 'a@b.c' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
