// Marketplace — dynamic route alias for GET /api/marketplace/template/:slug
// Delegates to the existing get.js handler which already reads ?slug from query.
import getHandler from '../get.js';

export default async function handler(req, res) {
  // Vercel populates req.query.slug from the [slug] route param automatically.
  // get.js expects req.query.slug, so we simply forward.
  return getHandler(req, res);
}
