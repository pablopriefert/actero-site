function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export default function handler(req, res) {
  const { shop } = req.query;

  // Validate shop domain format
  if (shop && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return res.status(400).json({ error: 'Invalid shop domain' });
  }

  const safeShop = shop ? escapeHtml(shop) : 'votre boutique';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Actero — Installation réussie</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #030303;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          background: #0a0a0a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 48px;
          max-width: 480px;
          text-align: center;
        }
        .check {
          width: 64px;
          height: 64px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 32px;
        }
        h1 { font-size: 24px; margin-bottom: 12px; }
        p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
        .shop { color: #10b981; font-weight: bold; }
        .close-note { margin-top: 24px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">✓</div>
        <h1>Installation réussie !</h1>
        <p>
          L'app Actero a été installée sur<br>
          <span class="shop">${safeShop}</span>
        </p>
        <p style="margin-top: 16px;">
          Vos workflows d'automatisation SAV seront opérationnels sous 24h.
          L'équipe Actero configure tout pour vous.
        </p>
        <p class="close-note">Vous pouvez fermer cette page.</p>
      </div>
    </body>
    </html>
  `);
}
