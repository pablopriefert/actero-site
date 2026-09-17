import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js'
import { encryptToken } from '../lib/crypto.js'
import {
  genererCodeVerification, empreinteCode, TYPE_CODE_CLOSER, DUREE_CODE_MS,
  UNE_HEURE_MS, ENVOIS_PAR_ADRESSE, cleEnvoisParAdresse,
} from '../lib/code-verification.js'
import { nettoyerNom } from '../lib/fiche-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TROP_DE_DEMANDES = { error: 'trop_de_demandes', message: 'Trop de demandes. Réessayez dans une heure.' }

/**
 * POST /api/closer/envoyer-code — inscription closer, étape 1 : le code par e-mail.
 *
 * Corps : { prenom, nom, email, password }
 *
 * Le mot de passe est chiffré pendant les 15 minutes de validité du code
 * (même règle que l'inscription marchand). La route ne dit jamais si
 * l'adresse a déjà un compte : ce serait un annuaire des comptes Actero. C'est
 * la vérification du code, une fois la boîte prouvée, qui le dit (409).
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })

  const limite = await checkRateLimit(`closer-envoyer-code:${getClientIp(req)}`, 5, UNE_HEURE_MS)
  if (!limite.allowed) return res.status(429).json(TROP_DE_DEMANDES)

  const { prenom, nom, email, password } = req.body || {}
  const prenomPropre = nettoyerNom(prenom)
  const nomPropre = nettoyerNom(nom)
  const adresse = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!prenomPropre || !nomPropre) return res.status(400).json({ error: 'nom_requis', message: 'Prénom et nom sont requis.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) return res.status(400).json({ error: 'email_invalide', message: 'Adresse e-mail invalide.' })
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'mot_de_passe_court', message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  }

  // Le même quota pour une adresse, d'où que viennent les demandes.
  const limiteAdresse = await checkRateLimit(cleEnvoisParAdresse(adresse), ENVOIS_PAR_ADRESSE, UNE_HEURE_MS)
  if (!limiteAdresse.allowed) return res.status(429).json(TROP_DE_DEMANDES)

  if (!process.env.RESEND_API_KEY) {
    // Jamais le code ni l'adresse dans les journaux.
    console.warn('[closer/envoyer-code] RESEND_API_KEY absente : aucun e-mail envoyé')
    return res.status(503).json({ error: 'email_indisponible', message: 'Envoi d’e-mail indisponible. Réessayez plus tard.' })
  }

  const code = genererCodeVerification()
  const { error } = await supabase.from('email_verification_codes').insert({
    email: adresse,
    code_hash: empreinteCode(code),
    payload: { kind: TYPE_CODE_CLOSER, prenom: prenomPropre, nom: nomPropre, password_enc: encryptToken(password) },
    expires_at: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
  })
  if (error) {
    console.error('[closer/envoyer-code] code non enregistré :', error.message)
    return res.status(500).json({ error: 'erreur_interne', message: 'Erreur serveur, réessayez.' })
  }

  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Actero <contact@actero.fr>',
      to: adresse,
      subject: `${code} — votre code closer Actero`,
      html: courriel(code),
      replyTo: 'contact@actero.fr',
    })
  } catch (err) {
    console.error('[closer/envoyer-code] Resend :', err.message)
    return res.status(502).json({ error: 'email_non_envoye', message: 'L’e-mail n’a pas pu partir. Réessayez.' })
  }
  return res.status(200).json({ ok: true, expires_in: DUREE_CODE_MS / 1000 })
}

function courriel(code) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;background:#ffffff;font-family:'Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1A1A1A">
  <div style="max-width:480px;margin:0 auto">
    <p style="font-size:15px;margin:0 0 24px">Actero</p>
    <h1 style="font-size:24px;font-weight:400;margin:0 0 12px">Votre code closer</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3A3A;margin:0 0 24px">Saisissez ce code pour créer votre espace closer Actero.</p>
    <p style="font-family:'DM Mono',ui-monospace,monospace;font-size:34px;letter-spacing:8px;margin:0 0 24px;color:#13804A">${code}</p>
    <p style="font-size:13px;line-height:1.6;color:#8B8070;margin:0">Ce code expire dans 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>
  </div>
</body>
</html>`
}

export default withSentry(handler)
