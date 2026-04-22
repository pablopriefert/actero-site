// Marketplace — dynamic route alias for GET /api/marketplace/template/:slug
// Delegates to the existing get.js handler which already reads ?slug from query.
import { withSentry } from '../../lib/sentry.js'
import getHandler from '../get.js';

async function handler(req, res) {
  // Vercel populates req.query.slug from the [slug] route param automatically.
  // get.js expects req.query.slug, so we simply forward.
  return getHandler(req, res);
}

export default withSentry(handler)
