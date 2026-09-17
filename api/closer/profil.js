import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../lib/crypto.js'
import { COLONNES_FICHE, ficheDuCompte, ficheVisible, memeIban, prevenirChangementIban } from '../lib/fiche-closer.js'
import { ibanValide, normaliserIban, normaliserSiret, siretValide, telephoneValide, titulaireValide } from '../lib/iban.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const NOMS_DES_CHAMPS = { telephone: 'téléphone', siret: 'SIRET', titulaire_iban: 'titulaire du compte', iban: 'IBAN' }

/**
 * PATCH /api/closer/profil — téléphone, SIRET, titulaire et IBAN du closer connecté.
 *
 * Corps : { telephone?, siret?, titulaire_iban?, iban? }
 *   - un champ absent ne change pas ; une chaîne vide efface (sauf l'IBAN) ;
 *   - l'IBAN n'est lu que s'il est saisi : le navigateur ne connaît que sa fin.
 *
 * L'IBAN est chiffré ici, avant toute écriture, et ne ressort jamais : la
 * réponse n'en montre que les quatre derniers caractères.
 *
 * Un IBAN différent de l'actuel (comparé en clair par memeIban) pose
 * `iban_modifie_le`, que l'admin voit avant de virer, et le closer en est
 * prévenu par e-mail. Le même IBAN ressaisi ne change rien.
 *
 * Réponses : 200 { fiche } (dont iban_masque et iban_modifie_le) ;
 * 400 champs_invalides { champs } ; 401 non_authentifie ; 404 pas_de_fiche ;
 * 405 ; 500 erreur_interne ; 503 indisponible.
 */
async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'methode_non_autorisee' })
  const appel = await ficheDuCompte(supabase, req, res)
  if (!appel) return
  const { closer } = appel

  const corps = req.body || {}
  const maj = {}
  const refuses = []
  const texte = (v) => (typeof v === 'string' ? v.trim() : '')

  if ('telephone' in corps) {
    const v = texte(corps.telephone)
    if (!v) maj.telephone = null
    else if (telephoneValide(v)) maj.telephone = v
    else refuses.push('telephone')
  }
  if ('siret' in corps) {
    const v = normaliserSiret(corps.siret)
    if (!v) maj.siret = null
    else if (siretValide(v)) maj.siret = v
    else refuses.push('siret')
  }
  if ('titulaire_iban' in corps) {
    const v = texte(corps.titulaire_iban)
    if (!v) maj.titulaire_iban = null
    else if (titulaireValide(v)) maj.titulaire_iban = v
    else refuses.push('titulaire_iban')
  }
  let ibanChange = null
  if (texte(corps.iban)) {
    const iban = normaliserIban(corps.iban)
    if (!ibanValide(iban)) refuses.push('iban')
    else if (!memeIban(closer.iban_chiffre, iban)) {
      try {
        maj.iban_chiffre = encryptToken(iban)
      } catch (err) {
        console.error('[closer/profil] chiffrement impossible :', err.message)
        return res.status(500).json({ error: 'erreur_interne', message: 'Enregistrement impossible pour le moment.' })
      }
      maj.iban_modifie_le = new Date().toISOString()
      ibanChange = { iban, premier: !closer.iban_chiffre }
    }
  }

  if (refuses.length) {
    return res.status(400).json({
      error: 'champs_invalides',
      champs: refuses,
      message: `À corriger : ${refuses.map((c) => NOMS_DES_CHAMPS[c]).join(', ')}.`,
    })
  }
  if (Object.keys(maj).length === 0) return res.status(200).json({ fiche: ficheVisible(closer) })

  const { data: ecrite, error } = await supabase
    .from('closers')
    .update({ ...maj, updated_at: new Date().toISOString() })
    .eq('id', closer.id)
    .select(COLONNES_FICHE)
    .single()
  if (error) {
    console.error('[closer/profil] écriture :', error.message)
    return res.status(500).json({ error: 'erreur_interne', message: 'Enregistrement impossible pour le moment.' })
  }
  // Après l'écriture, et sans la remettre en cause si l'e-mail ne part pas.
  if (ibanChange) {
    await prevenirChangementIban({ closerId: closer.id, email: ecrite.email, prenom: ecrite.prenom, ...ibanChange })
  }
  return res.status(200).json({ fiche: ficheVisible(ecrite) })
}

export default withSentry(handler)
