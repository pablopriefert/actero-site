import { withSentry } from '../lib/sentry.js'
import { requirePortalSession } from './lib/session.js';

async function handler(req, res) {
  try {
    const payload = await requirePortalSession(req);
    return res.status(200).json({ customerEmail: payload.customerEmail, clientId: payload.clientId });
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.code || 'unauthorized' });
  }
}

export default withSentry(handler)
