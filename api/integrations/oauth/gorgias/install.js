import { withSentry } from '../../../lib/sentry.js'
import crypto from 'crypto';

/**
 * Gorgias OAuth — install.
 *
 * Construit l'URL d'autorisation vers `<subdomain>.gorgias.com/oauth/authorize`
 * et injecte le subdomain dans le state pour que le callback puisse :
 *   1) faire le token exchange sur le bon subdomain
 *   2) stocker le subdomain dans extra_config.subdomain (consommé par
 *      connectors/gorgias.js qui construit
 *      https://<subdomain>.gorgias.com/api/... )
 */
async function handler(req, res) {
  const clientId = process.env.GORGIAS_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GORGIAS_CLIENT_ID non configuré' });
  }

  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain requis (ex: ma-boutique)' });
  }

  const cleanSubdomain = String(subdomain).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!cleanSubdomain) {
    return res.status(400).json({ error: 'Subdomain invalide' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const nonce = crypto.randomBytes(16).toString('hex');
  // state format : nonce|subdomain|userToken — le callback réhydrate les 3
  const state = `${nonce}|${cleanSubdomain}|${token}`;

  const redirectUri = process.env.GORGIAS_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/gorgias/callback';
  const scopes = 'openid email profile offline write:all';

  const authUrl = `https://${cleanSubdomain}.gorgias.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&nonce=${nonce}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
