import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js'
import { decryptToken } from '../lib/crypto.js'
import {
  empreinteCode, estCodeCloser, ESSAIS_MAX,
  UNE_HEURE_MS, VERIFICATIONS_PAR_ADRESSE, cleVerificationsParAdresse,
} from '../lib/code-verification.js'
import { creerFiche, nettoyerNom } from '../lib/fiche-closer.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TROP_DE_TENTATIVES = { error: 'trop_de_demandes', message: 'Trop de tentatives. Réessayez plus tard.' }

/**
 * POST /api/closer/verifier-code — inscription closer, étape 2 : le compte et la fiche.
 *
 * Corps : { email, code }
 *
 * Crée un compte Supabase et une fiche `closers`. Rien d'autre : ni client
 * marchand, ni lien client_users, ni rôle (`app_metadata`, `profiles`).
 * N'accepte qu'un code envoyé par l'inscription closer (payload.kind).
 *
 * Réponses : 200 { ok } ; 400 code_invalide, code_expire, code_incorrect ;
 * 409 compte_existant (l'adresse a déjà un compte : se connecter, puis
 * « Devenir closer ») ; 429 ; 500 ; 503.
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' })

  const limite = await checkRateLimit(`closer-verifier-code:${getClientIp(req)}`, 15, UNE_HEURE_MS)
  if (!limite.allowed) return res.status(429).json(TROP_DE_TENTATIVES)

  const { email, code } = req.body || {}
  const adresse = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const saisi = String(code ?? '').replace(/\s/g, '')
  if (!adresse || !/^\d{6}$/.test(saisi)) return res.status(400).json({ error: 'code_invalide', message: 'Code invalide (6 chiffres).' })

  // Le même quota pour une adresse, d'où que viennent les essais.
  const limiteAdresse = await checkRateLimit(cleVerificationsParAdresse(adresse), VERIFICATIONS_PAR_ADRESSE, UNE_HEURE_MS)
  if (!limiteAdresse.allowed) return res.status(429).json(TROP_DE_TENTATIVES)

  const { data: lignes, error: erreurLecture } = await supabase
    .from('email_verification_codes')
    .select('id, code_hash, attempts, payload')
    .eq('email', adresse)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5)
  if (erreurLecture) return res.status(503).json({ error: 'indisponible', message: 'Service momentanément indisponible.' })

  // Seul un code envoyé par l'inscription CLOSER est accepté ici.
  const ligne = (lignes || []).find((l) => estCodeCloser(l.payload))
  if (!ligne) return res.status(400).json({ error: 'code_expire', message: 'Code expiré ou inexistant. Demandez un nouveau code.' })
  if (ligne.attempts >= ESSAIS_MAX) {
    return res.status(429).json({ error: 'trop_d_essais', message: 'Trop de tentatives incorrectes. Demandez un nouveau code.' })
  }

  if (empreinteCode(saisi) !== ligne.code_hash) {
    await supabase.from('email_verification_codes').update({ attempts: ligne.attempts + 1 }).eq('id', ligne.id)
    return res.status(400).json({
      error: 'code_incorrect',
      message: 'Code incorrect.',
      essais_restants: Math.max(0, ESSAIS_MAX - ligne.attempts - 1),
    })
  }

  const { error: erreurUsage } = await supabase
    .from('email_verification_codes').update({ used_at: new Date().toISOString() }).eq('id', ligne.id).is('used_at', null)
  if (erreurUsage) return res.status(503).json({ error: 'indisponible', message: 'Service momentanément indisponible.' })

  const prenom = nettoyerNom(ligne.payload.prenom)
  const nom = nettoyerNom(ligne.payload.nom)
  const password = ligne.payload.password_enc ? decryptToken(ligne.payload.password_enc) : null
  if (!prenom || !nom || !password) return res.status(400).json({ error: 'code_expire', message: 'Demandez un nouveau code.' })

  const { data: cree, error: erreurCompte } = await supabase.auth.admin.createUser({
    email: adresse,
    password,
    email_confirm: true,
    // Métadonnées que l'utilisateur peut modifier : jamais un rôle ici.
    user_metadata: { prenom, nom },
  })
  if (erreurCompte || !cree?.user) {
    if (erreurCompte?.code === 'email_exists' || erreurCompte?.status === 422 || /already/i.test(erreurCompte?.message || '')) {
      return res.status(409).json({
        error: 'compte_existant',
        message: 'Cette adresse a déjà un compte Actero. Connectez-vous, puis choisissez « Devenir closer ».',
      })
    }
    console.error('[closer/verifier-code] compte non créé :', erreurCompte?.message)
    return res.status(500).json({ error: 'erreur_interne', message: 'Erreur lors de la création du compte.' })
  }

  try {
    await creerFiche(supabase, { user: cree.user, prenom, nom })
  } catch (err) {
    console.error('[closer/verifier-code] fiche non créée :', err.message)
    // Un compte sans fiche serait un compte orphelin : on le retire.
    await supabase.auth.admin.deleteUser(cree.user.id).catch(() => {})
    return res.status(500).json({ error: 'erreur_interne', message: 'Erreur lors de la création de votre espace.' })
  }
  return res.status(200).json({ ok: true })
}

export default withSentry(handler)
