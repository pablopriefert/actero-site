/**
 * Actero Engine — Claude Pricing
 * Model prices in USD per 1M tokens. Used to compute cost_usd per run.
 *
 * Keep this in sync with https://www.anthropic.com/pricing
 * If a model isn't listed, we fall back to Sonnet pricing as a safe default.
 */

// Prices in USD per 1M tokens
export const CLAUDE_PRICING = {
  'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-latest': { input: 0.80, output: 4.00 },
  'claude-3-opus-latest': { input: 15.00, output: 75.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-sonnet-5': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-opus-4-8': { input: 15.00, output: 75.00 },
}

/**
 * Compute total cost in USD from token counts.
 * Returns a number rounded to 6 decimals.
 */
export function calculateCost(modelId, tokensIn, tokensOut) {
  const prices = CLAUDE_PRICING[modelId] || CLAUDE_PRICING['claude-3-5-sonnet-latest']
  const safeIn = Number(tokensIn) || 0
  const safeOut = Number(tokensOut) || 0
  const cost = (safeIn / 1_000_000) * prices.input + (safeOut / 1_000_000) * prices.output
  return Math.round(cost * 1e6) / 1e6 // 6 decimals
}
