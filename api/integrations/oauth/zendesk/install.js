import crypto from 'crypto';

export default async function handler(req, res) {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'ZENDESK_CLIENT_ID non configure' });
  }

  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain requis (ex: ma-boutique)' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifie' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${nonce}:${token}`;

  const redirectUri = process.env.ZENDESK_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/zendesk/callback';
  const scopes = 'read write';

  const authUrl = `https://${subdomain}.zendesk.com/oauth/authorizations/new?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  res.redirect(302, authUrl);
}
