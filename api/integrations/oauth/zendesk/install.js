import { withSentry } from '../../../lib/sentry.js'
import crypto from 'crypto';

/**
 * Zendesk OAuth — install.
 *
 * Construit l'URL d'autorisation vers `<subdomain>.zendesk.com/oauth/authorizations/new`
 * et injecte le `subdomain` dans le state pour que le callback puisse :
 *   1) faire le token exchange sur le bon subdomain (Zendesk exige l'appel
 *      sur le même subdomain que l'authorization)
 *   2) stocker le subdomain dans client_integrations.extra_config pour que
 *      le connector sortant puisse appeler la bonne API.
 */
async function handler(req, res) {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'ZENDESK_CLIENT_ID non configure' });
  }

  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain requis (ex: ma-boutique)' });
  }

  // Sanitize subdomain : lowercase + alphanum + hyphen only (Zendesk rules)
  const cleanSubdomain = String(subdomain).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!cleanSubdomain) {
    return res.status(400).json({ error: 'Subdomain invalide' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifie' });

  const nonce = crypto.randomBytes(16).toString('hex');
  // state format : nonce|subdomain|userToken — le callback réhydrate les 3
  const state = `${nonce}|${cleanSubdomain}|${token}`;

  const redirectUri = process.env.ZENDESK_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/zendesk/callback';
  const scopes = 'read write';

  const authUrl = `https://${cleanSubdomain}.zendesk.com/oauth/authorizations/new?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
