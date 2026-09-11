/**
 * La version de l'API Shopify — une seule, écrite une fois.
 *
 * CE QUE CE FICHIER CORRIGE
 *
 * Le 11 septembre 2026, le Dev Dashboard de Shopify affichait deux alertes sur
 * l'app en cours d'examen : « appels effectués avec des jetons hors ligne
 * obsolètes » et un taux d'échec des webhooks de 33,3 %.
 *
 * La cause tenait dans un écart que personne ne pouvait voir d'un seul endroit :
 *
 *   shopify.app.actero.toml   api_version = "2026-04"   ← les webhooks arrivent
 *   le code                   2025-01, à douze endroits  ← les requêtes partent
 *   api/lib/revoke-integrations.js  2025-07              ← une exception isolée
 *
 * Shopify maintient chaque version douze mois. `2025-01` était donc hors
 * support depuis huit mois : les webhooks arrivaient au format 2026-04 pendant
 * que le code interrogeait l'API en 2025-01.
 *
 * POURQUOI ÇA NE SE VOYAIT PAS
 *
 * Rien n'échoue quand une version dérive. Les champs demandés existent encore,
 * les réponses arrivent, et l'écart ne se manifeste qu'au moment où Shopify
 * retire un champ — ou dans un tableau de bord que personne ne regarde.
 *
 * C'est la même forme que le reste de la semaine : une valeur qui doit
 * s'accorder avec une autre, et rien qui les tienne ensemble.
 *
 * COMMENT LA CHANGER
 *
 * Ici, et nulle part ailleurs. Une garde (api/lib/shopify-api-version.test.js)
 * refuse qu'une version soit réécrite en dur dans une route, et vérifie que
 * celle-ci reste accordée à l'`api_version` du TOML — c'est ce TOML qui décide
 * du format des webhooks entrants.
 *
 * Avant de monter de version : relire les requêtes GraphQL. Les champs
 * dépréciés (`fulfillmentStatus`, `financialStatus`, `totalPrice`) ne sont PAS
 * utilisés — vérifié le 11 septembre, les requêtes emploient déjà
 * `displayFulfillmentStatus`, `displayFinancialStatus` et `totalPriceSet`.
 */

export const SHOPIFY_API_VERSION = '2026-04'

/** L'endpoint GraphQL Admin d'une boutique, à la version courante. */
export function endpointGraphql(shopDomain) {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
}
