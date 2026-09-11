/**
 * Fabrique le sous-domaine du portail client — ACT-35.
 *
 * Le portail d'un marchand vit à `https://<slug>.portal.actero.fr`. Ce slug
 * est une colonne `clients.slug`, unique, et **rien dans le code ne l'écrivait
 * jamais** : sur 5 comptes en base le 10 septembre, 2 en avaient un, tous deux
 * posés à la main. Un marchand qui activait son portail tombait donc sur
 * « Aucun slug configuré. Contactez le support. » — c'est-à-dire sur Pablo.
 *
 * Ouvrir le portail sans ça, c'était livrer une fonctionnalité qui n'a pas
 * d'adresse.
 */

// Ces sous-domaines-là ne doivent appartenir à personne : ils ressemblent à
// des adresses de service, et un marchand nommé « API » ou « Admin » ne doit
// pas hériter de `api.portal.actero.fr`.
const RESERVES = new Set([
  'www', 'api', 'app', 'admin', 'portal', 'portail', 'mail', 'smtp', 'ftp',
  'dashboard', 'support', 'help', 'status', 'cdn', 'static', 'assets',
  'actero', 'login', 'auth', 'test', 'staging', 'preview', 'demo',
])

const LONGUEUR_MAX = 40

/**
 * Transforme un nom de marque en fragment d'URL.
 * Renvoie '' si le nom ne laisse rien d'utilisable (idéogrammes, emoji seuls…).
 */
export function slugifier(nom) {
  if (!nom || typeof nom !== 'string') return ''
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // les accents partent, pas les lettres
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGUEUR_MAX)
    .replace(/-+$/, '')                  // la coupe peut laisser un tiret final
}

/**
 * Trouve un slug libre pour ce client, et l'écrit.
 *
 * Ne lève jamais : un slug indisponible ne doit pas empêcher l'activation du
 * portail, il doit la signaler. Renvoie `{ slug }` ou `{ erreur }`.
 *
 * @param {object} supabase — client service_role
 * @param {string} clientId
 * @param {string} brandName
 */
export async function assurerSlugPortail(supabase, clientId, brandName) {
  const { data: existant } = await supabase
    .from('clients').select('slug').eq('id', clientId).maybeSingle()
  if (existant?.slug) return { slug: existant.slug }

  const base = slugifier(brandName)
  // Repli sur l'identifiant quand le nom de marque ne donne rien d'utilisable,
  // ou tombe sur un nom réservé.
  const racine = (!base || RESERVES.has(base))
    ? `boutique-${String(clientId).slice(0, 8)}`
    : base

  // La colonne porte une contrainte UNIQUE : c'est elle qui tranche en cas de
  // course entre deux activations simultanées. La recherche ci-dessous évite
  // seulement d'échouer bêtement au premier essai.
  for (let i = 0; i < 25; i++) {
    const candidat = i === 0 ? racine : `${racine}-${i + 1}`
    const { data: pris } = await supabase
      .from('clients').select('id').eq('slug', candidat).maybeSingle()
    if (pris) continue

    const { error } = await supabase
      .from('clients').update({ slug: candidat }).eq('id', clientId)
    if (!error) return { slug: candidat }
    // 23505 = violation d'unicité : quelqu'un a pris le nom entre-temps.
    if (error.code !== '23505') return { erreur: error.message }
  }
  return { erreur: 'aucun sous-domaine libre trouvé pour ce nom de marque' }
}
