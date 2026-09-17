import { decryptToken } from './crypto.js'
import { genererCodeCloser } from './code-closer.js'
import { ibanMasque } from './iban.js'

/**
 * La fiche d'un closer : qui appelle, sa création, ce qu'il en voit.
 *
 * La fiche est TOUJOURS retrouvée par le compte du jeton (`closers.user_id`),
 * jamais par un identifiant reçu dans la requête : c'est ce qui rend l'espace
 * closer étanche. Aucune route de api/closer/ ne lit de `closer_id`.
 *
 * Aucune fonction ici n'écrit le rôle d'un compte (`app_metadata`, `profiles`) :
 * c'est exactement ce qui rendait api/ambassador/apply.js dangereux.
 */

/**
 * Statut d'un closer à son inscription. Décision 7 de la spec (confirmée par
 * Pablo le 16 septembre 2026) : actif tout de suite, son lien fonctionne dès
 * l'inscription ; le risque d'un inconnu est borné par la validation manuelle
 * de chaque commission. Mettre 'suspendu' pour valider chaque closer à la main
 * avant que son lien ne rattache quoi que ce soit (l'admin le réactive).
 */
export const STATUT_CLOSER_A_L_INSCRIPTION = 'actif'

export const COLONNES_FICHE = 'id, user_id, prenom, nom, email, telephone, siret, titulaire_iban, iban_chiffre, code, statut, created_at'

/** Un prénom ou un nom propre (1 à 80 caractères, contrainte SQL), ou null. */
export function nettoyerNom(brut) {
  const v = typeof brut === 'string' ? brut.trim().replace(/\s+/g, ' ') : ''
  return v.length >= 1 && v.length <= 80 ? v : null
}

/** Prénom et nom d'un compte (inscription par e-mail, ou profil Google). */
export function nomDuCompte(user) {
  const m = user?.user_metadata || {}
  let prenom = nettoyerNom(m.prenom) || nettoyerNom(m.given_name)
  let nom = nettoyerNom(m.nom) || nettoyerNom(m.family_name)
  const complet = nettoyerNom(m.full_name) || nettoyerNom(m.name)
  if ((!prenom || !nom) && complet) {
    const [premier, ...reste] = complet.split(' ')
    prenom = prenom || nettoyerNom(premier)
    nom = nom || nettoyerNom(reste.join(' '))
  }
  return { prenom, nom }
}

/** Téléphone, SIRET, titulaire et IBAN : requis avant le premier virement. */
export function profilComplet(fiche) {
  return !!(fiche?.telephone && fiche?.siret && fiche?.titulaire_iban && fiche?.iban_chiffre)
}

/** Ce qu'un closer voit de sa fiche : jamais l'IBAN, seulement sa fin. */
export function ficheVisible(fiche) {
  return {
    prenom: fiche.prenom,
    nom: fiche.nom,
    email: fiche.email,
    telephone: fiche.telephone ?? null,
    siret: fiche.siret ?? null,
    titulaire_iban: fiche.titulaire_iban ?? null,
    iban_masque: fiche.iban_chiffre ? ibanMasque(decryptToken(fiche.iban_chiffre)) : null,
    code: fiche.code,
    statut: fiche.statut,
    profil_complet: profilComplet(fiche),
    inscrit_le: fiche.created_at ?? null,
  }
}

/** Le compte du jeton `Authorization: Bearer`, ou null. */
export async function compteDuJeton(supabase, req) {
  const jeton = req.headers?.authorization?.replace('Bearer ', '')
  if (!jeton) return null
  const { data, error } = await supabase.auth.getUser(jeton)
  if (error || !data?.user) return null
  return data.user
}

/**
 * Le compte et sa fiche, ou la réponse déjà envoyée (401, 404, 503).
 *
 * @returns {Promise<{ user: any, closer: any } | null>} null = réponse envoyée
 */
export async function ficheDuCompte(supabase, req, res) {
  const user = await compteDuJeton(supabase, req)
  if (!user) {
    res.status(401).json({ error: 'non_authentifie', message: 'Connectez-vous pour continuer.' })
    return null
  }
  const { data: closer, error } = await supabase.from('closers').select(COLONNES_FICHE).eq('user_id', user.id).maybeSingle()
  if (error) {
    res.status(503).json({ error: 'indisponible', message: 'Espace momentanément indisponible. Réessayez.' })
    return null
  }
  if (!closer) {
    res.status(404).json({ error: 'pas_de_fiche', message: 'Ce compte n’a pas encore d’espace closer.' })
    return null
  }
  return { user, closer }
}

/**
 * Crée la fiche du compte, ou rend celle qui existe déjà (rejouable).
 *
 * Le code est tiré au hasard ; en cas de collision (une chance sur 33
 * millions par fiche), on retire. Une fiche créée en parallèle pour le même
 * compte est rendue telle quelle.
 *
 * @returns {Promise<{ fiche: any, creee: boolean }>}
 */
export async function creerFiche(supabase, { user, prenom, nom }) {
  const lire = async () => {
    const { data, error } = await supabase.from('closers').select(COLONNES_FICHE).eq('user_id', user.id).maybeSingle()
    if (error) throw new Error(`closers illisible : ${error.message}`)
    return data
  }
  const existante = await lire()
  if (existante) return { fiche: existante, creee: false }

  for (let essai = 0; essai < 5; essai += 1) {
    const { data, error } = await supabase
      .from('closers')
      .insert({
        user_id: user.id,
        prenom,
        nom,
        email: String(user.email || '').toLowerCase(),
        code: genererCodeCloser(),
        statut: STATUT_CLOSER_A_L_INSCRIPTION,
      })
      .select(COLONNES_FICHE)
      .single()
    if (!error) return { fiche: data, creee: true }
    if (error.code !== '23505') throw new Error(`fiche non créée : ${error.message}`)
    const entretemps = await lire()
    if (entretemps) return { fiche: entretemps, creee: false }
  }
  throw new Error('fiche non créée : aucun code libre après 5 essais')
}
