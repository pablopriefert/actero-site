import { describe, it, expect, vi } from 'vitest';
import handler from './resolve-client.js';

let mockRow;

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
          maybeSingle: () => Promise.resolve({ data: mockRow, error: null }),
        }),
      }),
    }),
  }),
}));

describe('resolve-client', () => {
  it('returns merchant branding for Pro client', async () => {
    mockRow = {
      id: 'client-horace', slug: 'horace', brand_name: 'Horace', plan: 'pro',
      trial_ends_at: null, portal_enabled: true,
      portal_logo_url: 'https://cdn/logo.png', portal_primary_color: '#111111', portal_display_name: 'Horace',
    };
    const { req, res } = makeReqRes({ hostname: 'horace.portal.actero.fr' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe('horace');
    expect(res.body.merchantName).toBe('Horace');
    expect(res.body.branding.source).toBe('merchant');
    expect(res.body.branding.displayName).toBe('Horace');
    expect(res.body.branding.primaryColor).toBe('#111111');
  });

  it('returns Actero-default (no merchant branding) for Starter client', async () => {
    mockRow = {
      id: 'c1', slug: 'boutique', brand_name: 'Boutique', plan: 'starter',
      trial_ends_at: null, portal_enabled: true,
      portal_logo_url: 'https://cdn/logo.png', portal_primary_color: '#111', portal_display_name: 'Boutique',
    };
    const { req, res } = makeReqRes({ hostname: 'boutique.portal.actero.fr' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.branding.source).toBe('actero');
    expect(res.body.branding.logoUrl).toBeNull();
    expect(res.body.branding.primaryColor).toBeNull();
  });

  it('returns 404 if portal_enabled=false', async () => {
    mockRow = { id: 'c1', slug: 'x', brand_name: 'X', plan: 'pro', portal_enabled: false };
    const { req, res } = makeReqRes({ hostname: 'x.portal.actero.fr' });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});
