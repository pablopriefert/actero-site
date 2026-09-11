/**
 * Shared AES-256-GCM token encryption.
 *
 * Use for OAuth access/refresh tokens, API keys, credentials at rest.
 * Pattern: enc:v1:<base64(iv|tag|ciphertext)>.
 * Legacy plain values pass through decryptToken untouched so that rows
 * written before encryption was introduced keep working.
 *
 * CLÉ D'ÉCRITURE ET CLÉS DE LECTURE — CE N'EST PLUS LA MÊME LISTE
 *
 * Constaté le 11 septembre 2026, en auditant les variables d'environnement.
 * La résolution de clé avait quatre niveaux, et les deux derniers posaient
 * chacun un problème distinct :
 *
 *   3. SUPABASE_SERVICE_ROLE_KEY — « better than nothing », mais ACT-26 demande
 *      justement de faire TOURNER cette clé. Le jour où elle tourne, tout ce
 *      qui a été chiffré avec devient illisible pour toujours, et `decryptToken`
 *      renvoie `null` avec un simple console.error. Les intégrations d'un
 *      marchand s'éteindraient sans que rien ne le dise.
 *
 *   4. une clé ÉCRITE EN DUR, dans un dépôt public. Son nom l'admet. Si aucune
 *      des trois variables n'est posée, les identifiants Shopify — dont des
 *      jetons `write_orders` — sont chiffrés avec un secret que n'importe qui
 *      peut lire sur GitHub.
 *
 * D'où la séparation ci-dessous. Écrire exige une vraie clé ; lire accepte
 * toutes celles qui ont pu servir, pour que rien de déjà écrit ne soit perdu.
 * C'est ce qui rend la migration possible sans connaître la clé actuellement
 * en usage — et il n'y avait aucun moyen de la connaître.
 */
import crypto from 'crypto'

/** La clé publiée. Jamais acceptée en écriture ; tolérée en lecture. */
const CLE_PUBLIEE = 'actero-fallback-insecure-key-please-set-ENCRYPTION_KEY'

const dur = (raw) => crypto.createHash('sha256').update(String(raw)).digest()

/**
 * La clé avec laquelle on ÉCRIT.
 * @throws si aucune clé digne de ce nom n'est configurée — mieux vaut une
 *   erreur au branchement d'une intégration qu'un secret chiffré sous une clé
 *   que tout le monde peut lire.
 */
function cleDEcriture() {
  const raw =
    process.env.ENCRYPTION_KEY ||
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY absente : refus de chiffrer un secret client avec la clé '
      + 'de repli, qui est publiée dans le dépôt. Posez ENCRYPTION_KEY.',
    )
  }
  return dur(raw)
}

/**
 * Toutes les clés sous lesquelles une valeur a PU être écrite, dans l'ordre où
 * il faut les essayer. Une valeur chiffrée hier reste lisible demain, même
 * après qu'on a posé une vraie ENCRYPTION_KEY.
 */
function clesDeLecture() {
  return [
    process.env.ENCRYPTION_KEY,
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLE_PUBLIEE,
  ].filter(Boolean).map(dur)
}

export function encryptToken(plain) {
  if (plain == null) return null
  const key = cleDEcriture()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const blob = Buffer.concat([iv, tag, enc]).toString('base64')
  return `enc:v1:${blob}`
}

export function decryptToken(cipher) {
  if (!cipher) return null
  if (typeof cipher !== 'string') return String(cipher)
  if (!cipher.startsWith('enc:v1:')) return cipher
  let blob, iv, tag, enc
  try {
    blob = Buffer.from(cipher.slice('enc:v1:'.length), 'base64')
    iv = blob.subarray(0, 12)
    tag = blob.subarray(12, 28)
    enc = blob.subarray(28)
  } catch (err) {
    console.error('[lib/crypto] blob illisible :', err.message)
    return null
  }

  // On essaie chaque clé qui a pu servir. L'étiquette d'authentification de
  // GCM tranche sans ambiguïté : la mauvaise clé lève, la bonne rend le clair.
  // C'est ce qui permet de poser une vraie ENCRYPTION_KEY sans rendre illisible
  // ce qui a été écrit avant elle.
  for (const key of clesDeLecture()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
    } catch {
      // clé suivante
    }
  }

  // Aucune clé ne convient. Le cas le plus probable n'est pas une attaque :
  // c'est une clé qui a tourné sans que les valeurs soient rechiffrées avant.
  console.error(
    '[lib/crypto] aucune clé connue ne déchiffre cette valeur — '
    + 'une clé a-t-elle tourné sans rechiffrement préalable ?',
  )
  return null
}

// `hashToken` vivait ici et n'était importé par personne : 39 fichiers lisent ce
// module, aucun ne le nommait. Le portail a le sien, dans api/portal/lib/auth.js.
// Retiré le 11 septembre 2026 — il portait un troisième secret de repli écrit en
// dur (`'actero-pepper'`), pour une fonction que rien n'appelait.
