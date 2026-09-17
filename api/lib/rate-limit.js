/**
 * Rate limiting partagé entre instances (ACT-20).
 *
 * Ce helper comptait dans une `Map` de process. Sur Vercel chaque instance a
 * sa propre mémoire, donc deux requêtes qui atterrissent sur deux instances
 * voient chacune un compteur à zéro : la limite annoncée n'était jamais la
 * limite appliquée. L'ancien en-tête de ce fichier le disait à demi-mot
 * (« still a useful first line of defense ») — ce qui est vrai contre un
 * script naïf, et faux contre tout le reste.
 *
 * Le compteur vit maintenant en base (`consume_rate_limit`), donc toutes les
 * instances voient le même. Le UPSERT est atomique : pas de fenêtre de
 * lire-puis-écrire par laquelle une requête de trop passerait sous charge.
 *
 * `checkRateLimit` est désormais **asynchrone**. Un appel sans `await` renvoie
 * une Promise, dont `.allowed` vaut `undefined` — l'endpoint refuserait alors
 * tout le trafic. api/lib/rate-limit.test.js échoue si un appel oublie le
 * `await`.
 */
import { isIPv6 } from 'node:net'
import { createClient } from '@supabase/supabase-js'

/* -------------------------------------------------------------------------- */
/*  Repli local                                                               */
/* -------------------------------------------------------------------------- */

// Si la base est injoignable, refuser tout le trafic transformerait un
// incident de base en panne totale du site. On retombe donc sur l'ancien
// compteur de process : imparfait, mais strictement meilleur que rien, et
// c'est exactement le niveau de protection d'avant cette migration.
const seauxLocaux = new Map()
const INTERVALLE_BALAYAGE_MS = 5 * 60 * 1000
let dernierBalayage = Date.now()

function balayerSiNecessaire(maintenant) {
  if (maintenant - dernierBalayage < INTERVALLE_BALAYAGE_MS) return
  dernierBalayage = maintenant
  for (const [cle, seau] of seauxLocaux.entries()) {
    if (seau.resetAt <= maintenant) seauxLocaux.delete(cle)
  }
}

function consommerEnMemoire(key, limit, windowMs) {
  const maintenant = Date.now()
  balayerSiNecessaire(maintenant)

  let seau = seauxLocaux.get(key)
  if (!seau || maintenant > seau.resetAt) {
    seau = { hits: 0, resetAt: maintenant + windowMs }
  }
  seau.hits += 1
  seauxLocaux.set(key, seau)

  return {
    allowed: seau.hits <= limit,
    remaining: Math.max(0, limit - seau.hits),
    resetAt: seau.resetAt,
    durable: false,
  }
}

/* -------------------------------------------------------------------------- */
/*  Compteur partagé                                                          */
/* -------------------------------------------------------------------------- */

let _supabase = null
function admin() {
  if (_supabase) return _supabase
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _supabase = createClient(url, key, { auth: { persistSession: false } })
  return _supabase
}

/**
 * Consomme un jeton pour `key` et dit si la requête passe.
 *
 * @param {string} key      identifiant du seau (ex. `signup:1.2.3.4`)
 * @param {number} limit    requêtes autorisées par fenêtre
 * @param {number} windowMs taille de la fenêtre en millisecondes
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number, durable: boolean }>}
 *          `durable: false` signale un repli sur le compteur de process.
 */
export async function checkRateLimit(key, limit = 10, windowMs = 60_000) {
  const db = admin()
  if (!db) return consommerEnMemoire(key, limit, windowMs)

  try {
    const { data, error } = await db.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_ms: Math.round(windowMs),
    })
    if (error) throw new Error(error.message)

    // La fonction renvoie une table : une seule ligne.
    const ligne = Array.isArray(data) ? data[0] : data
    if (!ligne || typeof ligne.allowed !== 'boolean') {
      throw new Error('consume_rate_limit: réponse inattendue')
    }

    return {
      allowed: ligne.allowed,
      remaining: Number(ligne.remaining) || 0,
      resetAt: ligne.reset_at ? new Date(ligne.reset_at).getTime() : Date.now() + windowMs,
      durable: true,
    }
  } catch (err) {
    // Bruyant volontairement : un repli silencieux redonnerait la fausse
    // protection qu'on vient de retirer.
    console.error('[rate-limit] compteur partagé indisponible, repli local:', err.message)
    return consommerEnMemoire(key, limit, windowMs)
  }
}

/* -------------------------------------------------------------------------- */
/*  Adresse du client                                                         */
/* -------------------------------------------------------------------------- */

/** Les huit groupes de 16 bits d'une IPv6 déjà validée. */
function groupesIPv6(adresse) {
  let texte = adresse
  // Queue IPv4 (::ffff:1.2.3.4) : deux groupes de plus.
  const queue = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(texte)
  if (queue) {
    const [a, b, c, d] = queue.slice(1).map(Number)
    texte = `${texte.slice(0, queue.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [tete, fin] = texte.split('::')
  const gauche = tete ? tete.split(':') : []
  const droite = fin ? fin.split(':') : []
  const zeros = fin === undefined ? [] : Array(8 - gauche.length - droite.length).fill('0')
  return [...gauche, ...zeros, ...droite].map((g) => parseInt(g, 16))
}

/**
 * La clé de limitation d'une adresse. Une IPv4 reste telle quelle. Une IPv6
 * est ramenée à son préfixe /64 : un fournisseur attribue au moins un /64 à
 * chaque abonné, qui peut donc changer d'adresse à volonté — compter par
 * adresse lui donnait 2^64 quotas. Une IPv4 écrite en IPv6 (::ffff:a.b.c.d,
 * fréquent côté socket) redevient une IPv4 : sinon toutes partageraient la
 * même clé. Ce qui n'est pas une IP est rendu tel quel.
 */
function cleDAdresse(ip) {
  let brute = String(ip).trim()
  const entreCrochets = /^\[([^\]]+)\](?::\d+)?$/.exec(brute)
  if (entreCrochets) brute = entreCrochets[1]
  brute = brute.replace(/%.*$/, '') // identifiant de zone : fe80::1%eth0
  if (!isIPv6(brute)) return ip

  const groupes = groupesIPv6(brute.toLowerCase())
  if (groupes.slice(0, 5).every((g) => g === 0) && groupes[5] === 0xffff) {
    return [groupes[6] >> 8, groupes[6] & 0xff, groupes[7] >> 8, groupes[7] & 0xff].join('.')
  }
  return `${groupes.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`
}

/**
 * IP du client, au mieux, derrière les proxys — sous la forme d'une clé de
 * limitation : une IPv6 est ramenée à son /64 (voir `cleDAdresse`).
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return cleDAdresse(xff.split(',')[0].trim())
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return cleDAdresse(String(xff[0]).split(',')[0].trim())
  }
  return cleDAdresse(
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  )
}
