/**
 * Actero Dynamic Upsell Pricing
 *
 * Calculates monthly price per upsell based on client data.
 * Each function returns a price in EUR (integer).
 */

// ============================================================
// E-COMMERCE PRICING
// ============================================================

function priceEmailSequences(client, metrics) {
  // Base: 149€/mois
  // + 50€ si > 5000 profils estimés (tasks_executed as proxy for volume)
  // + 30€ si ROI > 2000€ (high-value client)
  const base = 149;
  const volumeBonus = (metrics?.tasks_executed || 0) > 500 ? 50 : 0;
  const roiBonus = (metrics?.estimated_roi || 0) > 2000 ? 30 : 0;
  return base + volumeBonus + roiBonus;
}

function priceReportingEcom(client, metrics) {
  // Base: 99€/mois
  // + 30€ si volume d'automations élevé (> 3 active)
  // + 20€ si ROI significatif (> 1500€)
  const base = 99;
  const automationBonus = (metrics?.active_automations || 0) > 3 ? 30 : 0;
  const roiBonus = (metrics?.estimated_roi || 0) > 1500 ? 20 : 0;
  return base + automationBonus + roiBonus;
}

// ============================================================
// IMMOBILIER PRICING
// ============================================================

function priceSmsRelance(client, metrics) {
  // Base: 129€/mois
  // + 40€ si volume de leads élevé (> 200 tasks/mois proxy)
  // + 20€ si temps économisé significatif (> 600 min)
  const base = 129;
  const volumeBonus = (metrics?.tasks_executed || 0) > 200 ? 40 : 0;
  const timeBonus = (metrics?.time_saved_minutes || 0) > 600 ? 20 : 0;
  return base + volumeBonus + timeBonus;
}

function pricePriseRdv(client, metrics) {
  // Base: 179€/mois
  // + 50€ si volume élevé
  // + 30€ si ROI > 1500€
  const base = 179;
  const volumeBonus = (metrics?.tasks_executed || 0) > 300 ? 50 : 0;
  const roiBonus = (metrics?.estimated_roi || 0) > 1500 ? 30 : 0;
  return base + volumeBonus + roiBonus;
}

function priceScoringLeads(client, metrics) {
  // Base: 119€/mois
  // + 30€ si > 3 automations actives
  // + 20€ si volume significatif
  const base = 119;
  const automationBonus = (metrics?.active_automations || 0) > 3 ? 30 : 0;
  const volumeBonus = (metrics?.tasks_executed || 0) > 200 ? 20 : 0;
  return base + automationBonus + volumeBonus;
}

function priceReportingImmo(client, metrics) {
  // Base: 99€/mois
  // + 30€ si > 3 automations
  // + 20€ si ROI > 1500€
  const base = 99;
  const automationBonus = (metrics?.active_automations || 0) > 3 ? 30 : 0;
  const roiBonus = (metrics?.estimated_roi || 0) > 1500 ? 20 : 0;
  return base + automationBonus + roiBonus;
}

// ============================================================
// MAIN PRICING FUNCTION
// ============================================================

const PRICING_MAP = {
  email_sequences_customerio: priceEmailSequences,
  reporting_premium_ecom: priceReportingEcom,
  sms_relance_leads: priceSmsRelance,
  prise_rdv_auto: pricePriseRdv,
  scoring_leads: priceScoringLeads,
  reporting_premium_immo: priceReportingImmo,
};

/**
 * Calculate dynamic price for a given upsell
 * @param {Object} client - Client object { id, brand_name, client_type, ... }
 * @param {Object} metrics - Client metrics { tasks_executed, estimated_roi, active_automations, time_saved_minutes }
 * @param {string} upsellType - The upsell ID from catalog
 * @returns {number} Price in EUR
 */
export function calculateUpsellPrice(client, metrics, upsellType) {
  const pricingFn = PRICING_MAP[upsellType];
  if (!pricingFn) return 99; // fallback
  return pricingFn(client, metrics);
}

/**
 * Server-side version (same logic, for API route)
 * Can be imported in Vercel serverless functions
 */
export const calculateUpsellPriceServer = calculateUpsellPrice;
