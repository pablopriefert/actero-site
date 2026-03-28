import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'SLACK_CLIENT_ID non configuré' });
  }

  // Get the authenticated user to pass client context
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${nonce}:${token}`;

  const redirectUri = process.env.SLACK_REDIRECT_URI || 'https://actero.fr/api/integrations/oauth/slack/callback';
  const scopes = 'incoming-webhook,chat:write,channels:read,team:read';

  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.redirect(302, authUrl);
}
