/**
 * MCP OAuth — Authorization endpoint
 *
 * GET /api/mcp/authorize?response_type=code&client_id=xxx&redirect_uri=xxx&state=xxx&code_challenge=xxx&code_challenge_method=S256
 *
 * Shows a login page. On submit, authenticates the user and redirects back
 * with an authorization code.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Service role for DB writes
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Anon client for signInWithPassword (service role can't do password auth properly)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const siteUrl = process.env.PUBLIC_API_URL || 'https://actero.fr'

  // GET — show login form
  if (req.method === 'GET') {
    const { redirect_uri, state, code_challenge, code_challenge_method, client_id } = req.query

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autoriser Actero — MCP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #f0f0f0; max-width: 420px; width: 100%; padding: 40px; }
    .logo { width: 48px; height: 48px; background: #0F5F35; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .logo svg { width: 24px; height: 24px; fill: white; }
    h1 { font-size: 22px; font-weight: 700; text-align: center; color: #1a1a1a; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #71717a; font-size: 14px; margin-bottom: 28px; }
    .permissions { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .permissions h3 { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .perm { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1a1a1a; padding: 4px 0; }
    .perm .dot { width: 6px; height: 6px; border-radius: 50%; background: #0F5F35; flex-shrink: 0; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 12px; font-weight: 600; color: #71717a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
    .field input { width: 100%; padding: 10px 14px; border: 1px solid #f0f0f0; border-radius: 10px; font-size: 14px; background: #fafafa; outline: none; transition: border-color 0.2s; }
    .field input:focus { border-color: #0F5F35; background: white; }
    .btn { width: 100%; padding: 12px; background: #0F5F35; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #003725; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ef4444; font-size: 13px; margin-bottom: 12px; text-align: center; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1>Autoriser Actero</h1>
    <p class="subtitle">Connectez votre compte Actero a Claude Desktop</p>

    <div class="permissions">
      <h3>Claude pourra :</h3>
      <div class="perm"><span class="dot"></span> Envoyer des messages a votre agent IA</div>
      <div class="perm"><span class="dot"></span> Consulter vos statistiques d'usage</div>
      <div class="perm"><span class="dot"></span> Lister vos escalades en attente</div>
      <div class="perm"><span class="dot"></span> Voir les conversations recentes</div>
    </div>

    <div id="error" class="error" style="display:none"></div>

    <form id="authForm">
      <input type="hidden" name="redirect_uri" value="${(redirect_uri || '').replace(/"/g, '&quot;')}" />
      <input type="hidden" name="state" value="${(state || '').replace(/"/g, '&quot;')}" />
      <input type="hidden" name="code_challenge" value="${(code_challenge || '').replace(/"/g, '&quot;')}" />
      <input type="hidden" name="code_challenge_method" value="${(code_challenge_method || '').replace(/"/g, '&quot;')}" />
      <input type="hidden" name="client_id" value="${(client_id || '').replace(/"/g, '&quot;')}" />

      <div class="field">
        <label>Email</label>
        <input type="email" name="email" required placeholder="vous@votreboutique.com" />
      </div>
      <div class="field">
        <label>Mot de passe</label>
        <input type="password" name="password" required placeholder="••••••••" />
      </div>

      <button type="submit" class="btn" id="submitBtn">Autoriser l'acces</button>
    </form>

    <p class="footer">Actero ne partagera jamais vos identifiants avec Claude.</p>
  </div>

  <script>
    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const errEl = document.getElementById('error');
      btn.disabled = true;
      btn.textContent = 'Connexion...';
      errEl.style.display = 'none';

      const form = new FormData(e.target);
      const body = Object.fromEntries(form.entries());

      try {
        const res = await fetch('/api/mcp/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          errEl.textContent = data.error || 'Erreur de connexion';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Autoriser l\\'acces';
        }
      } catch (err) {
        errEl.textContent = 'Erreur reseau';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Autoriser l\\'acces';
      }
    });
  </script>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).send(html)
  }

  // POST — authenticate and redirect with code
  if (req.method === 'POST') {
    const { email, password, redirect_uri, state, code_challenge, code_challenge_method, client_id } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' })
    }

    // Authenticate with Supabase (anon client, not service role)
    let authData, authError
    try {
      const result = await supabaseAuth.auth.signInWithPassword({ email, password })
      authData = result.data
      authError = result.error
    } catch (err) {
      console.error('[mcp/authorize] signInWithPassword exception:', err.message)
      return res.status(500).json({ error: 'Erreur d\'authentification: ' + err.message })
    }

    if (authError || !authData?.session) {
      console.error('[mcp/authorize] Auth failed:', authError?.message)
      return res.status(401).json({ error: authError?.message || 'Email ou mot de passe incorrect' })
    }

    console.log('[mcp/authorize] Auth success for:', email)

    // Generate a short-lived authorization code
    const code = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min

    // Store the code using admin client (service role bypasses RLS)
    const { error: insertErr } = await supabaseAdmin.from('mcp_auth_codes').insert({
      code,
      user_id: authData.user.id,
      access_token: authData.session.access_token,
      code_challenge: code_challenge || null,
      code_challenge_method: code_challenge_method || null,
      expires_at: expiresAt.toISOString(),
      used: false,
    })

    if (insertErr) {
      console.error('[mcp/authorize] Failed to store auth code:', insertErr.message)
      return res.status(500).json({ error: 'Erreur serveur: impossible de stocker le code' })
    }

    // Build redirect URL
    if (redirect_uri) {
      const url = new URL(redirect_uri)
      url.searchParams.set('code', code)
      if (state) url.searchParams.set('state', state)
      return res.status(200).json({ redirect_url: url.toString() })
    }

    return res.status(200).json({ code })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
