import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWelcomeHtml({ courseTitle, courseSlug }) {
  const siteUrl = process.env.SITE_URL || 'https://actero.fr';
  const courseUrl = courseSlug ? `${siteUrl}/academy/${courseSlug}` : `${siteUrl}/academy`;
  const safeTitle = escapeHtml(courseTitle || "l'Actero Academy");
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f8f8f8;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px 40px 0 40px;">
          <div style="font-size:22px;font-weight:700;color:#003725;letter-spacing:-0.5px;">Actero Academy</div>
        </td></tr>
        <tr><td style="padding:24px 40px 32px 40px;">
          <h1 style="font-size:22px;font-weight:700;color:#000000;margin:0 0 16px 0;line-height:1.3;">Bienvenue dans l'Academy</h1>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">Votre inscription au cours <strong>${safeTitle}</strong> est confirmee. Vous avez maintenant acces gratuitement a tous les modules de l'Actero Academy.</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px 0;">Reprenez votre cours des maintenant :</p>
          <p style="margin:0 0 32px 0;">
            <a href="${courseUrl}" style="display:inline-block;background:#003725;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px;font-size:14px;">Continuer le cours</a>
          </p>
          <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Vous recevrez egalement des conseils hebdomadaires pour automatiser votre SAV et votre e-commerce. Vous pouvez vous desinscrire a tout moment.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { email, course_id } = req.body || {};
    if (!email || !course_id) {
      return res.status(400).json({ error: 'email and course_id required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid email' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Load course for welcome email
    const { data: course } = await supabase
      .from('academy_courses')
      .select('id, slug, title, is_published')
      .eq('id', course_id)
      .maybeSingle();

    if (!course || !course.is_published) {
      return res.status(404).json({ error: 'course not found' });
    }

    // Upsert enrollment
    const { error: upsertError } = await supabase
      .from('academy_enrollments')
      .upsert(
        { user_email: normalizedEmail, course_id: course.id },
        { onConflict: 'user_email,course_id' }
      );

    if (upsertError) {
      console.error('[academy/enroll] upsert error', upsertError);
      return res.status(500).json({ error: 'enrollment failed' });
    }

    // Send welcome email (non-blocking failure)
    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Actero Academy <academy@actero.fr>',
          to: normalizedEmail,
          subject: `Bienvenue dans Actero Academy - ${course.title}`,
          html: buildWelcomeHtml({ courseTitle: course.title, courseSlug: course.slug }),
        });
      } catch (emailErr) {
        console.warn('[academy/enroll] email send failed', emailErr?.message);
      }
    } else {
      console.log('[academy/enroll] welcome email skipped (no RESEND_API_KEY)', {
        email: normalizedEmail,
        course: course.slug,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[academy/enroll] fatal', err);
    return res.status(500).json({ error: 'server error' });
  }
}

export default withSentry(handler)
