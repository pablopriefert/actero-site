/**
 * Les signaux d'une commission, montrés à l'admin dans la file de validation.
 *
 * Un signal ne bloque rien : il dit où regarder avant de valider ou de payer.
 *   meme_email       le closer a l'e-mail de contact du client (auto-parrainage)
 *   meme_domaine     même domaine d'e-mail professionnel (collègue, même société)
 *   iban_recent      l'IBAN du closer a changé il y a moins de 72 heures
 *                    (compte volé, virement détourné)
 *   closer_suspendu  un closer suspendu reçoit quand même ses commissions en
 *                    « à valider » : la décision revient à Actero (spec)
 *
 * Chaque signal suit sa seule définition : un même e-mail professionnel donne
 * `meme_email` ET `meme_domaine`. L'ordre du tableau est toujours celui de
 * SIGNAUX_COMMISSION.
 *
 * Aucune dépendance Node : le navigateur peut importer les libellés.
 */

export const SIGNAUX_COMMISSION = Object.freeze(['meme_email', 'meme_domaine', 'iban_recent', 'closer_suspendu'])

export const LIBELLES_SIGNAUX = Object.freeze({
  meme_email: 'Même e-mail que le client',
  meme_domaine: 'Même domaine d’e-mail que le client',
  iban_recent: 'IBAN modifié il y a moins de 72 h',
  closer_suspendu: 'Closer suspendu',
})

export const DELAI_IBAN_RECENT_HEURES = 72

/**
 * Messageries grand public : partager leur domaine ne dit rien. Un tableau
 * figé plutôt qu'un Set, que `Object.freeze` n'empêcherait pas de modifier.
 */
export const MESSAGERIES_GRAND_PUBLIC = Object.freeze([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com',
  'yahoo.com', 'yahoo.fr',
  'icloud.com', 'me.com',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net', 'bbox.fr', 'numericable.fr',
  'aol.com', 'gmx.fr', 'gmx.com',
  'protonmail.com', 'proton.me',
])

/** L'e-mail normalisé et son domaine, ou null s'il n'a pas la forme d'un e-mail. */
function email(valeur) {
  if (typeof valeur !== 'string') return null
  const texte = valeur.trim().toLowerCase()
  const arobase = texte.lastIndexOf('@')
  if (arobase < 1 || arobase === texte.length - 1) return null
  return { texte, domaine: texte.slice(arobase + 1) }
}

/**
 * @param {{
 *   closer: { email?: string|null, statut?: string, iban_modifie_le?: string|null } | null,
 *   client: { contact_email?: string|null } | null,
 *   maintenant?: Date,
 * }} p
 * @returns {string[]} des codes de SIGNAUX_COMMISSION, dans cet ordre
 */
export function signauxCommission({ closer, client, maintenant = new Date() }) {
  const signaux = []
  const duCloser = email(closer?.email)
  const duClient = email(client?.contact_email)

  if (duCloser && duClient && duCloser.texte === duClient.texte) signaux.push('meme_email')
  if (duCloser && duClient && duCloser.domaine === duClient.domaine && !MESSAGERIES_GRAND_PUBLIC.includes(duCloser.domaine)) {
    signaux.push('meme_domaine')
  }

  const modifieLe = closer?.iban_modifie_le ? Date.parse(closer.iban_modifie_le) : NaN
  if (!Number.isNaN(modifieLe) && maintenant.getTime() - modifieLe < DELAI_IBAN_RECENT_HEURES * 3_600_000) {
    signaux.push('iban_recent')
  }

  if (closer?.statut === 'suspendu') signaux.push('closer_suspendu')
  return signaux
}
