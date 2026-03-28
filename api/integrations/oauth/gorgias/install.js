import crypto from 'crypto';

export default async function handler(req, res) {
  const clientId = process.env.GORGIAS_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GORGIAS_CLIENT_ID non configuré' });
  }

  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain requis (ex: ma-boutique)' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${nonce}:${token}`;

  const redirectUri = process.env.GORGIAS_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/gorgias/callback';
  const scopes = 'openid email profile offline write:all';

  const authUrl = `https://${subdomain}.gorgias.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&nonce=${nonce}`;

  res.redirect(302, authUrl);
}
