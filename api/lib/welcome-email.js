/**
 * Send a welcome email to a newly signed-up client.
 *
 * Non-blocking: failures are logged but never thrown.
 */
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendWelcomeEmail({ email, brand_name, has_referral }) {
  if (!resend || !email) {
    console.log('[welcome-email] Skipped (no Resend key or email)')
    return { sent: false }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: 'Pablo de Actero <contact@actero.fr>',
      to: email,
      subject: `Bienvenue chez Actero, ${brand_name || ''} 👋`.trim(),
      html: renderWelcomeHtml({ brand_name, has_referral }),
      replyTo: 'contact@actero.fr',
    })
    if (error) {
      console.error('[welcome-email] Resend error:', error.message)
      return { sent: false, error: error.message }
    }
    return { sent: true, id: data?.id }
  } catch (err) {
    console.error('[welcome-email] Exception:', err.message)
    return { sent: false, error: err.message }
  }
}

function renderWelcomeHtml({ brand_name, has_referral }) {
  const greeting = brand_name ? `Bonjour ${brand_name},` : 'Bonjour,'
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bienvenue chez Actero</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafafa;margin:0;padding:40px 20px;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div style="width:48px;height:48px;background:#0E653A;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;margin-bottom:24px">A</div>

    <h1 style="font-size:22px;font-weight:700;margin:0 0 14px;color:#1a1a1a">${greeting}</h1>

    <p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px">
      Bienvenue chez Actero 🎉 Ravi de vous compter parmi nos utilisateurs.
    </p>

    <p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 16px">
      Actero, c'est une plateforme d'automatisation IA pour e-commerce qui transforme votre support client en avantage concurrentiel — tickets résolus en quelques secondes, relances panier automatisées, agent vocal disponible 24h/24.
    </p>

    ${has_referral ? `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:0 0 20px">
      <p style="margin:0;font-size:13px;color:#0E653A;font-weight:600">🎁 Votre premier mois est offert grâce à votre parrain.</p>
      <p style="margin:4px 0 0;font-size:12px;color:#166534">30 jours gratuits sur n'importe quel plan payant.</p>
    </div>
    ` : ''}

    <h2 style="font-size:16px;font-weight:700;margin:28px 0 12px;color:#1a1a1a">Vos prochaines étapes</h2>

    <div style="margin:0 0 24px">
      <div style="display:flex;align-items:start;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">
        <div style="width:24px;height:24px;background:#0E653A;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px">1</div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a">Connectez votre boutique</p>
          <p style="margin:2px 0 0;font-size:13px;color:#71717a">Shopify, WooCommerce ou Webflow — 1 clic en OAuth.</p>
        </div>
      </div>

      <div style="display:flex;align-items:start;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">
        <div style="width:24px;height:24px;background:#0E653A;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px">2</div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a">Définissez le ton de votre agent</p>
          <p style="margin:2px 0 0;font-size:13px;color:#71717a">Chaleureux, professionnel, décontracté — l'IA apprend votre style.</p>
        </div>
      </div>

      <div style="display:flex;align-items:start;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">
        <div style="width:24px;height:24px;background:#0E653A;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px">3</div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a">Activez le playbook SAV</p>
          <p style="margin:2px 0 0;font-size:13px;color:#71717a">Votre agent IA traite les tickets dès qu'il est activé.</p>
        </div>
      </div>

      <div style="display:flex;align-items:start;gap:12px;padding:12px 0">
        <div style="width:24px;height:24px;background:#0E653A;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px">4</div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a">Testez dans le simulateur</p>
          <p style="margin:2px 0 0;font-size:13px;color:#71717a">Vérifiez les réponses avant la mise en production.</p>
        </div>
      </div>
    </div>

    <a href="https://actero.fr/client/overview" style="display:inline-block;padding:12px 24px;background:#0E653A;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;margin:0 0 24px">
      Ouvrir mon dashboard →
    </a>

    <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:24px 0 16px">
      <strong>Besoin d'aide ?</strong> Répondez simplement à cet email — je lis chaque message personnellement.
    </p>

    <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:0">
      À très vite,<br/>
      <strong>Pablo Priefert</strong><br/>
      <span style="color:#71717a;font-size:13px">Fondateur, Actero</span>
    </p>

    <hr style="border:none;border-top:1px solid #f0f0f0;margin:32px 0 20px">

    <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.6">
      Vous recevez cet email parce que vous venez de créer un compte sur <a href="https://actero.fr" style="color:#9ca3af">actero.fr</a>.<br/>
      Actero — ${new Date().getFullYear()}
    </p>
  </div>
</body>
</html>`
}
