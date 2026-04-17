import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './verify-token.js';
import { hashToken } from './lib/auth.js';

let dbState;
vi.mock('./lib/supabase.js', () => ({
  getServiceRoleClient: () => ({
    from: (table) => {
      if (table === 'portal_sessions') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ is: () => ({ gte: () => ({ maybeSingle: () => Promise.resolve({ data: dbState.row, error: null }) }) }) }) }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    },
  }),
}));

function makeReqRes(body) {
  const res = { statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(n, v) { if (n.toLowerCase() === 'set-cookie') this.cookies = v; return this; } };
  return { req: { method: 'POST', body, headers: {} }, res };
}

describe('verify-token', () => {
  beforeEach(async () => {
    process.env.PORTAL_JWT_SECRET = 'test-secret-never-used-in-prod-0000000000000000';
    const hash = await hashToken('abc123');
    dbState = {
      row: {
        id: 's1', client_id: 'c1', customer_email: 'paul@ex.com', token_hash: hash,
        purpose: 'magic_link', expires_at: new Date(Date.now() + 60000).toISOString(), used_at: null,
      },
    };
  });

  it('issues session JWT for valid token', async () => {
    const { req, res } = makeReqRes({ token: 'abc123', clientId: 'c1' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    const cookie = Array.isArray(res.cookies) ? res.cookies[0] : res.cookies;
    expect(cookie).toMatch(/portal_session=/);
  });

  it('rejects invalid token', async () => {
    const { req, res } = makeReqRes({ token: 'wrong', clientId: 'c1' });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
