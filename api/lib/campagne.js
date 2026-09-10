/**
 * Le code de campagne publicitaire — une seule définition, deux chemins d'entrée.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 10 septembre 2026, le mois offert par la campagne a été branché sur la
 * route d'inscription email/mot de passe. Un marchand arrivé par la publicité
 * et inscrit **avec Google** repartait quand même avec sept jours : son compte
 * n'est pas créé par cette route du tout, mais côté navigateur après le retour
 * d'OAuth. Un chemin sur deux — le neuvième « code écrit qui n'est appelé que
 * la moitié du temps » de la semaine.
 *
 * La validation vit donc ici, et les deux chemins l'appellent.
 *
 * CE QU'ON NE FAIT JAMAIS
 *
 * Le drapeau n'est jamais posé par le navigateur. `resolveOrCreateClientId`
 * crée le client côté client, sous RLS : lui laisser écrire
 * `campaign_first_month_free` reviendrait à laisser n'importe qui s'offrir un
 * mois d'abonnement en modifiant une requête. Le navigateur ne fait que
 * TRANSPORTER le code ; c'est ce fichier, côté serveur, qui décide.
 */

/**
 * Le code proposé correspond-il à un code de campagne actif ?
 *
 * Sans `CAMPAIGN_TRIAL_CODES` en environnement, aucun code n'est valide et
 * tout le monde garde l'essai standard : le défaut est fermé.
 */
export function codeCampagneValide(code) {
  if (!code) return false
  const actifs = (process.env.CAMPAIGN_TRIAL_CODES || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
  if (actifs.length === 0) return false
  return actifs.includes(String(code).trim().toUpperCase())
}

/**
 * Accorde le mois de campagne à ce client, si le code est bon.
 *
 * @returns {Promise<{ applique: boolean, raison?: string }>}
 */
export async function appliquerCampagne(supabase, clientId, code) {
  if (!clientId) return { applique: false, raison: 'client_inconnu' }
  if (!codeCampagneValide(code)) return { applique: false, raison: 'code_invalide' }

  const { data: client } = await supabase
    .from('clients')
    .select('trial_ends_at, campaign_first_month_free')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return { applique: false, raison: 'client_introuvable' }
  if (client.campaign_first_month_free) return { applique: true, raison: 'deja_applique' }

  // Un essai déjà consommé ferme la porte, même avec un bon code : sinon il
  // suffirait de résilier, de repasser par le lien de la pub et de repartir
  // pour un mois. C'est la même règle que pour le parrainage.
  if (client.trial_ends_at) return { applique: false, raison: 'essai_deja_utilise' }

  const { error } = await supabase
    .from('clients')
    .update({ campaign_first_month_free: true })
    .eq('id', clientId)

  if (error) return { applique: false, raison: error.message }
  return { applique: true }
}
