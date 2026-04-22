export async function listOrdersByCustomerEmail({ shopDomain, accessToken, email }) {
  const query = `query($q: String!) {
    orders(first: 20, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id name totalPriceSet { presentmentMoney { amount currencyCode } }
        displayFinancialStatus displayFulfillmentStatus createdAt
        lineItems(first: 10) { nodes { id title quantity image { url } } }
      }
    }
  }`;
  const r = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { q: `email:${email}` } }),
  });
  if (!r.ok) throw new Error(`shopify_${r.status}`);
  const j = await r.json();
  return (j.data?.orders?.nodes || []).map((o) => ({
    id: o.id,
    name: o.name,
    total: o.totalPriceSet.presentmentMoney.amount,
    currency: o.totalPriceSet.presentmentMoney.currencyCode,
    financial_status: o.displayFinancialStatus?.toLowerCase(),
    fulfillment_status: o.displayFulfillmentStatus?.toLowerCase(),
    created_at: o.createdAt,
    lineItems: o.lineItems.nodes,
  }));
}
