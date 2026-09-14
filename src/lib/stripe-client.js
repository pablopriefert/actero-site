import { loadStripe } from '@stripe/stripe-js'

/**
 * Lazily-loaded Stripe.js singleton for the on-site Payment Element flow.
 *
 * The publishable key is a build-time Vite env (VITE_STRIPE_PUBLISHABLE_KEY).
 * When it's absent — e.g. before it's set on Vercel — getStripe() returns null
 * and callers fall back to the hosted Checkout redirect (api/billing/upgrade).
 */
let _promise = null

export function hasStripeElements() {
  return !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
}

export function getStripe() {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  if (!_promise) _promise = loadStripe(key)
  return _promise
}
