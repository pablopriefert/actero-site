/**
 * Révocation des accès chez les fournisseurs, avant effacement (ACT-25).
 *
 * Supprimer notre copie d'un secret suffit pour qu'on ne puisse plus s'en
 * servir. Ça ne suffit pas pour le marchand : une autorisation OAuth accordée
 * à Actero reste active côté Slack, Zendesk ou Shopify, et il continuera de
 * voir Actero dans ses applications connectées. On efface l'adresse du coffre
 * sans rendre la clé.
 *
 * Règle de ce module : **ne jamais annoncer une révocation qui n'a pas eu
 * lieu.** Chaque fournisseur renvoie l'un de trois résultats :
 *
 *   revoque  le fournisseur a confirmé
 *   echec    on a essayé, ça a échoué — avec la raison
 *   manuel   aucune API ne le permet — avec ce que le marchand doit faire
 *
 * Un échec de révocation ne doit jamais empêcher l'effacement : le RGPD impose
 * de supprimer, et un fournisseur injoignable n'est pas une excuse. Le rapport
 * part dans le journal admin pour qu'un humain finisse le travail.
 */
import { decryptToken } from './crypto.js'
import { SHOPIFY_API_VERSION } from './shopify-api-version.js'

// `appUninstall` n'existe qu'à partir de 2025-07. Le reste du code appelle
// l'API Shopify en 2025-01 : on ne change pas cette version globalement pour
// un seul appel, on la fixe ici.
const dechiffre = (v) => (v ? decryptToken(v) || v : null)

function resultat(fournisseur, etat, detail) {
  return { fournisseur, resultat: etat, detail }
}

/* -------------------------------------------------------------------------- */
/*  Shopify                                                                   */
/* -------------------------------------------------------------------------- */

async function revoquerShopify(supabase, clientId) {
  const { data: cx } = await supabase
    .from('client_shopify_connections')
    .select('shop_domain, access_token')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!cx?.shop_domain) return null

  const token = dechiffre(cx.access_token)
  if (!token) {
    return resultat('shopify', 'manuel',
      `Aucun jeton exploitable pour ${cx.shop_domain}. Le marchand doit désinstaller Actero depuis son admin Shopify.`)
  }

  try {
    const r = await fetch(
      `https://${cx.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: 'mutation { appUninstall { userErrors { message } } }' }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!r.ok) {
      return resultat('shopify', 'echec',
        `HTTP ${r.status} sur ${cx.shop_domain}. Faire désinstaller l'app depuis l'admin Shopify.`)
    }
    const data = await r.json().catch(() => ({}))
    const erreurs = data?.data?.appUninstall?.userErrors || data?.errors
    if (erreurs?.length) {
      return resultat('shopify', 'echec',
        `${cx.shop_domain} : ${erreurs.map((e) => e.message).join(' · ')}`)
    }
    return resultat('shopify', 'revoque', `App désinstallée de ${cx.shop_domain} — le jeton est invalidé.`)
  } catch (err) {
    return resultat('shopify', 'echec', `${cx.shop_domain} : ${err.message}`)
  }
}

/* -------------------------------------------------------------------------- */
/*  Intégrations                                                              */
/* -------------------------------------------------------------------------- */

async function revoquerSlack(integration) {
  const token = dechiffre(integration.access_token)
  if (!token) return resultat('slack', 'manuel', 'Aucun jeton stocké. À retirer depuis les applications Slack de l\'espace.')
  try {
    const r = await fetch('https://slack.com/api/auth.revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await r.json().catch(() => ({}))
    // Slack répond 200 même en cas d'échec : c'est `ok` qui fait foi.
    if (data?.ok && data?.revoked) return resultat('slack', 'revoque', 'Jeton révoqué par Slack.')
    return resultat('slack', 'echec',
      `Slack a refusé (${data?.error || 'raison inconnue'}). À retirer depuis les applications de l'espace Slack.`)
  } catch (err) {
    return resultat('slack', 'echec', `${err.message}. À retirer manuellement dans Slack.`)
  }
}

async function revoquerZendesk(integration) {
  const token = dechiffre(integration.access_token)
  const sousDomaine = integration.extra_config?.subdomain
  if (!token || !sousDomaine) {
    return resultat('zendesk', 'manuel', 'Jeton ou sous-domaine manquant. À retirer dans Zendesk → Applications OAuth.')
  }
  try {
    const r = await fetch(`https://${sousDomaine}.zendesk.com/api/v2/oauth/tokens/current.json`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (r.ok || r.status === 204) return resultat('zendesk', 'revoque', `Jeton révoqué sur ${sousDomaine}.zendesk.com.`)
    return resultat('zendesk', 'echec',
      `HTTP ${r.status} sur ${sousDomaine}.zendesk.com. À retirer dans Zendesk → Applications OAuth.`)
  } catch (err) {
    return resultat('zendesk', 'echec', `${err.message}. À retirer manuellement dans Zendesk.`)
  }
}

// Ces fournisseurs n'exposent pas de révocation utilisable par l'application :
// soit le secret appartient au marchand (il l'a créé chez lui), soit le
// fournisseur ne permet le retrait que depuis son interface. On le dit, on ne
// fait pas semblant.
const MANUELS = {
  notion: "Notion n'expose pas de révocation par API. Le marchand doit retirer Actero dans Paramètres → Mes connexions.",
  resend: 'La clé API appartient au compte Resend du marchand. Il doit la supprimer dans Resend → API Keys.',
  smtp_imap: 'Nous détenions le mot de passe de sa boîte email. Il doit le CHANGER — un mot de passe qui a séjourné ailleurs ne se range pas, il se remplace.',
  google_docs: 'À retirer dans le compte Google du marchand → Sécurité → Applications tierces.',
  gmail: 'À retirer dans le compte Google du marchand → Sécurité → Applications tierces.',
}

/**
 * Révoque tout ce qui peut l'être pour un client, et décrit le reste.
 * N'échoue jamais : le rapport est la valeur de retour.
 *
 * @returns {Promise<Array<{fournisseur: string, resultat: 'revoque'|'echec'|'manuel', detail: string}>>}
 */
export async function revokeClientAccess(supabase, clientId) {
  const rapport = []

  try {
    const shopify = await revoquerShopify(supabase, clientId)
    if (shopify) rapport.push(shopify)
  } catch (err) {
    rapport.push(resultat('shopify', 'echec', err.message))
  }

  const { data: integrations } = await supabase
    .from('client_integrations')
    .select('provider, auth_type, access_token, api_key, extra_config')
    .eq('client_id', clientId)

  for (const i of integrations || []) {
    try {
      if (i.provider === 'slack') rapport.push(await revoquerSlack(i))
      else if (i.provider === 'zendesk') rapport.push(await revoquerZendesk(i))
      else if (MANUELS[i.provider]) rapport.push(resultat(i.provider, 'manuel', MANUELS[i.provider]))
      else {
        rapport.push(resultat(i.provider, 'manuel',
          'Fournisseur sans procédure de révocation connue — à vérifier à la main.'))
      }
    } catch (err) {
      rapport.push(resultat(i.provider, 'echec', err.message))
    }
  }

  return rapport
}
