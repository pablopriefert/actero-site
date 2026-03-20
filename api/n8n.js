// Vercel Serverless Function — Proxy to n8n API
// Keeps N8N_API_KEY server-side, never exposed to the browser

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const N8N_URL = process.env.N8N_API_URL;
  const N8N_KEY = process.env.N8N_API_KEY;

  if (!N8N_URL || !N8N_KEY) {
    return res.status(500).json({ error: 'n8n configuration missing' });
  }

  // Extract the path from query param: /api/n8n?path=/workflows
  const path = req.query.path || '/workflows';
  const targetUrl = `${N8N_URL}/api/v1${path}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Failed to reach n8n', details: error.message });
  }
}
