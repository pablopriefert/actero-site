import React, { useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, LinkAuthenticationElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Check, Loader2, Lock, ShieldCheck, X } from 'lucide-react'
import { getStripe } from '../../lib/stripe-client'

const SERIF = { fontFamily: 'Instrument Serif, Georgia, serif' }

const APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0E653A',
    colorText: '#1A1A1A',
    colorTextSecondary: '#716D5C',
    colorDanger: '#EF4444',
    borderRadius: '10px',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    spacingUnit: '4px',
  },
}

function priceLabel(plan, billingPeriod) {
  const amount = billingPeriod === 'annual' ? plan?.price?.annual : plan?.price?.monthly
  if (amount == null) return null
  const suffix = billingPeriod === 'annual' ? '€/mois (facturé annuellement)' : '€/mois'
  return `${amount}${suffix}`
}

/**
 * Inner form — must live inside <Elements> so the Stripe hooks resolve.
 */
function CheckoutForm({ mode, plan, billingPeriod, onSuccess, onClose }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const trialDays = plan?.trial?.days || (mode === 'setup' ? 7 : null)
  const price = priceLabel(plan, billingPeriod)
  const ctaLabel = trialDays ? `Démarrer l'essai de ${trialDays} jours` : (price ? `Payer ${price.replace('/mois', '')}` : 'Payer')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)

    const confirmParams = {
      return_url: `${window.location.origin}/client/overview?upgrade=success&plan=${plan?.id}`,
    }
    const result = mode === 'setup'
      ? await stripe.confirmSetup({ elements, confirmParams, redirect: 'if_required' })
      : await stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' })

    if (result.error) {
      setError(result.error.message || 'Le paiement a échoué. Vérifiez vos informations et réessayez.')
      setSubmitting(false)
      return
    }
    // No redirect required (3DS not triggered) → success handled on-site.
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <LinkAuthenticationElement />
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 rounded-full text-sm font-semibold bg-cta text-white hover:bg-[#003725] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Traitement…</>) : (<><Lock className="w-4 h-4" /> {ctaLabel}</>)}
      </button>

      <button type="button" onClick={onClose} className="text-xs text-[#716D5C] hover:text-[#262626] transition-colors">
        Annuler
      </button>
    </form>
  )
}

/**
 * On-site Stripe payment modal (split-panel, Actero-light).
 *
 * Props:
 *   open, onClose
 *   plan            — PLANS[planId] object
 *   billingPeriod   — 'monthly' | 'annual'
 *   highlights      — string[] shown in the left recap
 *   clientId, token — for the create-subscription call
 *   promoCode       — optional
 *   onSuccess()     — called after the payment/setup is confirmed
 */
export function PaymentModal({ open, onClose, plan, billingPeriod = 'monthly', highlights = [], clientId, token, promoCode, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState(null)
  const [clientSecret, setClientSecret] = useState(null)
  const [mode, setMode] = useState('payment')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    ;(async () => {
      setLoading(true); setInitError(null); setClientSecret(null)
      try {
        const res = await fetch('/api/billing/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ client_id: clientId, target_plan: plan?.id, billing_period: billingPeriod, promo_code: promoCode || undefined }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (data.instant) { onSuccess?.(); return }
        if (!res.ok || !data.client_secret) {
          setInitError(data.message || data.error || 'Paiement indisponible pour le moment. Réessayez.')
          setLoading(false)
          return
        }
        setMode(data.mode || 'payment')
        setClientSecret(data.client_secret)
        setLoading(false)
      } catch {
        if (!cancelled) { setInitError('Erreur réseau. Réessayez.'); setLoading(false) }
      }
    })()

    return () => { cancelled = true }
  }, [open, clientId, token, plan?.id, billingPeriod, promoCode, onSuccess])

  const stripePromise = useMemo(() => getStripe(), [])
  const price = priceLabel(plan, billingPeriod)
  const trialDays = plan?.trial?.days || 7

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#716D5C]" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>

        {/* Left — recap */}
        <div className="bg-[#F9F7F1] p-8 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#8B7A50]">Passer à</span>
          <h2 className="mt-1 text-[#1A1A1A] text-3xl" style={SERIF}>{plan?.name}</h2>
          {price && <div className="mt-3 text-[#1A1A1A] text-2xl font-bold">{price}</div>}
          <div className="mt-2 inline-flex items-center gap-2 text-cta text-sm font-semibold">
            <Check className="w-4 h-4" /> {trialDays} jours gratuits, sans engagement
          </div>

          <ul className="mt-6 space-y-2.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#262626]">
                <Check className="w-4 h-4 text-cta mt-0.5 flex-shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6 flex items-center gap-2 text-[12px] text-[#716D5C]">
            <ShieldCheck className="w-4 h-4 text-cta" /> Paiement sécurisé par Stripe · Annulable à tout moment
          </div>
        </div>

        {/* Right — payment */}
        <div className="p-8 min-h-[380px] flex flex-col justify-center">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-[#716D5C]">
              <Loader2 className="w-6 h-6 animate-spin text-cta" />
              <span className="text-sm">Préparation du paiement sécurisé…</span>
            </div>
          )}

          {!loading && initError && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{initError}</div>
              <button onClick={onClose} className="text-sm text-[#716D5C] hover:text-[#262626]">Fermer</button>
            </div>
          )}

          {!loading && clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
              <CheckoutForm mode={mode} plan={plan} billingPeriod={billingPeriod} onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  )
}
