import { withSentry } from '../../../lib/sentry.js'
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

async function handler(req, res) {
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
  // Scopes for full Slack Copilot:
  //   - incoming-webhook, chat:write        (post messages)
  //   - channels:read, team:read            (list channels / team info)
  //   - app_mentions:read                   (receive @Actero mentions)
  //   - commands                            (slash /actero)
  //   - im:history, im:read, im:write       (DMs with the bot)
  //   - chat:write.public                   (post to channels without being invited)
  //   - canvases:write, canvases:read       (Live Ops Canvas — refreshed by cron)
  const scopes = 'incoming-webhook,chat:write,chat:write.public,channels:read,team:read,app_mentions:read,commands,im:history,im:read,im:write,canvases:write,canvases:read';

  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
