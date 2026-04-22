// Scrape a website's key pages and generate brand context via Gemini
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only: generates brand context for clients
  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Missing required field: url' });
  }

  // Normalize base URL
  const baseUrl = url.replace(/\/+$/, '');

  // Common e-commerce policy/info pages to scrape
  const pagePaths = [
    '',
    '/pages/faq',
    '/policies/shipping-policy',
    '/policies/refund-policy',
    '/policies/terms-of-service',
  ];

  try {
    // 1. Fetch all pages in parallel
    const fetchResults = await Promise.allSettled(
      pagePaths.map(async (path) => {
        const pageUrl = `${baseUrl}${path}`;
        const response = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ActeroBot/1.0)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return null;
        const html = await response.text();
        return { path: path || '/', text: stripHtml(html) };
      })
    );

    // 2. Collect successfully fetched page content
    const pages = fetchResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (pages.length === 0) {
      return res.status(400).json({ error: 'Could not fetch any content from the provided URL' });
    }

    // 3. Build the content string for Gemini (cap at ~30k chars)
    const contentForAi = pages
      .map(p => `=== Page: ${p.path} ===\n${p.text.slice(0, 6000)}`)
      .join('\n\n');

    // 4. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Génère un brand_context pour un agent SAV IA. Analyse ces pages et extrais: ton de la marque, politique de retour, délais de livraison, FAQ courantes, politique de remboursement. Format: JSON structuré.\n\nContenu du site (${baseUrl}):\n\n${contentForAi}`,
          }],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini API error: ${geminiRes.status} — ${err}`);
    }

    const geminiData = await geminiRes.json();
    const brandContext = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      brandContext,
      pagesScraped: pages.map(p => p.path),
    });
  } catch (error) {
    console.error('generate-brand-context error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Strip HTML tags and collapse whitespace to extract readable text.
 */
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default withSentry(handler)
