/**
 * Credits pricing — volume discount.
 *
 * Base rate: 0.069€ per credit (69€ for 1000 credits)
 *
 * Tiers:
 *   1-999      → 0.09€/credit (premium rate)
 *   1000-4999  → 0.069€/credit (base rate: 1000 = 69€)
 *   5000-9999  → 0.060€/credit (pack: 5000 = 299€)
 *   10000+     → 0.055€/credit (pack: 10000 = 549€)
 *
 * All prices in EUR, returned in centimes for Stripe compatibility.
 */

export const CREDIT_TIERS = [
  { min: 10000, rate_cents: 5.5, label: '10 000+ crédits' },
  { min: 5000, rate_cents: 6.0, label: '5 000 — 9 999' },
  { min: 1000, rate_cents: 6.9, label: '1 000 — 4 999' },
  { min: 1, rate_cents: 9.0, label: 'Moins de 1 000' },
]

export function getRateForAmount(amount) {
  const tier = CREDIT_TIERS.find(t => amount >= t.min)
  return tier ? tier.rate_cents : 9.0
}

/**
 * Compute total price in centimes for a given credit amount.
 * @returns {number} price in centimes (integer)
 */
export function computeCreditPrice(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const rate = getRateForAmount(n)
  return Math.round(n * rate)
}

/**
 * Format a credit amount with thousand separators.
 */
export function formatCredits(amount) {
  return new Intl.NumberFormat('fr-FR').format(Math.floor(amount || 0))
}

/**
 * Format price in centimes to "XX,XX €"
 */
export function formatPriceEUR(centimes) {
  const euros = (centimes || 0) / 100
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(euros)
}

export const SUGGESTED_PACKS = [
  { amount: 500, popular: false },
  { amount: 1000, popular: true, label: 'Populaire' },
  { amount: 2500, popular: false },
  { amount: 5000, popular: false, label: 'Meilleur rapport' },
  { amount: 10000, popular: false },
]

/**
 * Minimum and maximum purchasable credits in one transaction.
 */
export const MIN_CREDITS = 100
export const MAX_CREDITS = 50000
