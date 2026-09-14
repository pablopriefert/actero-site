/**
 * Rattachement d'une boutique installée depuis l'App Store.
 *
 * Un marchand qui installe Actero depuis l'App Store Shopify n'a pas encore de
 * compte : `api/shopify/callback.js` crée donc le client, puis redirige vers
 * /shopify-success avec un jeton `claim` signé. Ce jeton est ce qui rattache la
 * boutique au compte — sans lui, le client reste orphelin (`owner_user_id` nul,
 * aucun `client_users`), et le marchand arrive sur un dashboard vide auquel il
 * n'a même pas accès.
 *
 * Le jeton doit survivre à l'aller-retour par l'inscription, d'où le passage par
 * sessionStorage : on le pose en arrivant sur /shopify-success, et on le
 * consomme dès qu'une session existe — soit tout de suite si le marchand était
 * déjà connecté, soit au premier chargement du dashboard après son inscription.
 *
 * `api/shopify/claim.js` est idempotent et refuse qu'un second utilisateur
 * s'approprie une boutique déjà rattachée, donc réessayer est sans danger.
 */

const KEY = 'actero.shopifyClaim'

/** Mémorise le jeton le temps que le marchand crée son compte. */
export function storeShopifyClaim(token) {
  if (!token) return
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    /* navigation privée ou stockage bloqué : on continue sans mémoriser */
  }
}

/** Le jeton en attente, s'il y en a un. */
export function peekShopifyClaim() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

function forgetShopifyClaim() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* rien à faire */
  }
}

/**
 * Consomme le jeton en attente si une session existe.
 *
 * @returns {Promise<{status: 'done'|'needs-account'|'none'|'failed', data?: object}>}
 *   `needs-account` : un jeton attend mais le marchand n'est pas encore connecté.
 *   `none` : rien à rattacher.
 */
export async function consumeShopifyClaim(supabase) {
  const token = peekShopifyClaim()
  if (!token) return { status: 'none' }

  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  if (!accessToken) return { status: 'needs-account' }

  try {
    const res = await fetch('/api/shopify/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    })
    const body = await res.json().catch(() => ({}))

    // 409 (déjà rattachée à un autre compte) et 410 (jeton expiré) sont
    // définitifs : réessayer ne changera rien, on oublie le jeton.
    if (res.ok || res.status === 409 || res.status === 410) forgetShopifyClaim()

    return res.ok ? { status: 'done', data: body } : { status: 'failed', data: body }
  } catch {
    // Réseau : on garde le jeton pour la prochaine occasion.
    return { status: 'failed' }
  }
}
