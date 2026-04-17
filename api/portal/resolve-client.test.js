import { describe, it, expect, vi } from 'vitest';
import handler from './resolve-client.js';

function makeReqRes({ hostname }) {
  const req = { method: 'GET', query: { hostname } };
  const res = { statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; } };
  return { req, res };
}

vi.mock('./lib/supabase.js', () => ({
  getServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        or: () => ({
          maybeSingle: () => Promise.resolve({
            data: { id: 'client-horace', slug: 'horace', portal_enabled: true, portal_logo_url: 'x', portal_primary_color: '#000', portal_display_name: 'Horace', name: 'Horace', logo_url: null },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('resolve-client', () => {
  it('returns branding for valid subdomain', async () => {
    const { req, res } = makeReqRes({ hostname: 'horace.portal.actero.fr' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe('horace');
    expect(res.body.branding.displayName).toBe('Horace');
  });
});
