import { withSentry } from '../lib/sentry.js'
import crypto from 'crypto';

// La fiche de l'app sur l'App Store — une surface appartenant à Shopify.
// C'est de là que doit partir toute installation (App Store 2.3.1).
const APP_HANDLE = process.env.SHOPIFY_APP_HANDLE || 'actero';
const FICHE_APP_STORE = `https://apps.shopify.com/${APP_HANDLE}`;

function handler(req, res) {
  const { shop, client, token } = req.query;

  const clientId = process.env.SHOPIFY_CLIENT_ID;

  // SANS `shop`, ON NE LE DEMANDE PLUS : ON ENVOIE SUR L'APP STORE.
  //
  // App Store 2.3.1 : « votre app ne doit pas demander la saisie manuelle
  // d'une URL myshopify.com ni du domaine d'une boutique pendant
  // l'installation ou la configuration ». Cette route renvoyait un 400 quand
  // le paramètre manquait, ce qui obligeait l'interface à le réclamer — et
  // deux écrans le réclamaient : l'assistant de démarrage et la page
  // Intégrations.
  //
  // Le paramètre `shop` reste accepté, mais il ne vient plus que de Shopify
  // lui-même : c'est Shopify qui le fournit à `application_url` quand un
  // marchand ouvre ou installe l'app depuis son admin. Fourni par Shopify,
  // il est légitime ; tapé par le marchand, il ne l'est pas.
  //
  // LE COMPTE RESTE RATTACHÉ. C'est le cookie `actero_token` posé ci-dessous,
  // et non le paramètre `shop`, qui permet à callback.js de retrouver le
  // client Actero du marchand déjà connecté. Le cookie est en SameSite=Lax et
  // le retour depuis Shopify est une navigation de premier niveau : il est
  // donc bien renvoyé. Un marchand déjà inscrit ne se retrouve pas avec un
  // second compte.
  if (!shop) {
    if (token) {
      res.setHeader(
        'Set-Cookie',
        `actero_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`,
      );
    }
    return res.redirect(302, FICHE_APP_STORE);
  }
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://actero.fr/api/shopify/callback';

  // Required scopes — every feature of the agent depends on these. Anything
  // here that the merchant declines will break install (Shopify enforces).
  //
  // - read_orders / read_fulfillments  → order tracking, shipping ETA replies
  // - read_customers                   → identify the customer asking
  // - read_products / read_inventory   → product Q&A, stock answers
  // - read_checkouts                   → abandoned-cart playbook
  // - read_returns                     → return-policy answers
  //
  // No theme scopes: the chat widget installs via the theme app extension
  // (extensions/actero-widget), not the Asset/Theme API (App Store 5.1.1).
  const requiredScopes = [
    'read_orders',
    'read_customers',
    'read_products',
    'read_fulfillments',
    'read_checkouts',
    'read_inventory',
    'read_returns',
  ].join(',');

  // Optional scopes — the merchant can decline these without breaking the
  // core agent. We deliberately do NOT request write_orders: the agent never
  // mutates orders directly. Refund drafts are surfaced in the dashboard
  // and the merchant approves them via Shopify's native admin flow.
  //
  // - read_draft_orders  → upsell context in conversations
  // - read_shipping      → live shipping-rate answers
  const optionalScopes = [
    'read_draft_orders',
    'read_shipping',
  ].join(',');

  // Generate a random nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store nonce + client slug + auth token in cookies for callback
  const cookies = [
    `shopify_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ];
  if (client) {
    cookies.push(`actero_client=${encodeURIComponent(client)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }
  // Store user's auth token to identify client_id in callback
  if (token) {
    cookies.push(`actero_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }
  res.setHeader('Set-Cookie', cookies);

  // Shopify accepts an `optional_scopes` query param alongside `scope`; scopes
  // declared as optional can be denied by the merchant without aborting the
  // install. Anything else stays in the required `scope` param.
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${requiredScopes}` +
    `&optional_scopes=${optionalScopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  res.redirect(302, authUrl);
}

export default withSentry(handler)
