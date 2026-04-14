import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard, ExternalLink, Loader2, CheckCircle2,
  Calendar, FileText, ArrowUpRight, Zap, Clock,
  TrendingUp, AlertTriangle, Crown, Rocket, Building2,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { PLANS, PLAN_ORDER, getPlanConfig } from '../../lib/plans'
import { usePlan } from '../../hooks/usePlan'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'
import { CreditsPurchase } from './CreditsPurchase'

// ─── Helpers ────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]
const currentMonthLabel = () => {
  const d = new Date()
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

const formatPrice = (price) => {
  if (price === null || price === undefined) return 'Sur devis'
  if (price === 0) return 'Gratuit'
  return `${price}\u202F\u20AC`
}

const PLAN_BADGE_COLORS = {
  free: 'neutral',
  starter: 'info',
  pro: 'brand',
  enterprise: 'warning',
}

const PLAN_ICONS = {
  free: Zap,
  starter: Rocket,
  pro: Crown,
  enterprise: Building2,
}

const PLAN_FEATURES_SHORT = {
  starter: [
    '1 000 tickets / mois',
    '3 workflows actifs',
    'Éditeur de marque',
    'Dashboard ROI complet',
    'Support email 48h',
  ],
  pro: [
    '5 000 tickets / mois',
    'Workflows illimités',
    'Guardrails & règles métier',
    'Agents IA spécialisés',
    'API + webhooks',
    'Support prioritaire 24h',
  ],
  enterprise: [
    'Tickets illimités',
    'Multi-boutique',
    'White-label',
    'Account manager dédié',
    'SLA garanti',
    'Intégrations sur mesure',
  ],
}

// ─── Progress bar with color thresholds ─────────────────────────
function UsageBar({ used, limit, label, unit = '' }) {
  const isUnlimited = limit === Infinity || limit === -1
  const percent = isUnlimited ? 0 : limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0
  const color =
    percent >= 90 ? 'bg-red-500' :
    percent >= 70 ? 'bg-amber-500' :
    'bg-[#0F5F35]'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[#1a1a1a]">{label}</span>
        <span className="text-[12px] text-[#71717a] tabular-nums">
          {used.toLocaleString('fr-FR')}{unit} / {isUnlimited ? '\u221E' : limit.toLocaleString('fr-FR')}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#f0f0f0] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${isUnlimited ? 0 : percent}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────
export const ClientBillingView = ({ theme }) => {
  const toast = useToast()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState(null)
  const [billingPeriod, setBillingPeriod] = useState('monthly')

  // ── Fetch client record ───────────────────────────────────────
  const { data: client, isLoading } = useQuery({
    queryKey: ['billing-client'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const { data: link } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const clientId = link?.client_id
      let query = supabase.from('clients').select('*')
      if (clientId) {
        query = query.eq('id', clientId)
      } else {
        query = query.eq('owner_user_id', session.user.id)
      }
      const { data } = await query.maybeSingle()
      return data || null
    },
  })

  // ── Use plan hook ─────────────────────────────────────────────
  const plan = usePlan(client?.id)

  // ── Stripe Portal ─────────────────────────────────────────────
  const openStripePortal = async () => {
    setLoadingPortal(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ client_id: client?.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        toast.error('Impossible d\'ouvrir le portail de facturation')
      }
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setLoadingPortal(false)
  }

  // ── Upgrade handler ───────────────────────────────────────────
  const handleUpgrade = async (targetPlan) => {
    if (targetPlan === 'enterprise') {
      window.open('https://calendly.com/actero-fr/30min', '_blank')
      return
    }

    if (!client?.id) {
      toast.error('Chargement en cours, réessayez dans un instant.')
      return
    }

    setUpgradingPlan(targetPlan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: client?.id,
          target_plan: targetPlan,
          billing_period: billingPeriod,
        }),
      })
      const data = await res.json()
      if (data.instant && data.success) {
        // Instant upgrade — no redirect needed, plan switched server-side
        toast.success(data.message || `Plan mis a jour vers ${targetPlan} !`)
        // Refresh plan data
        window.location.reload()
      } else if (data.checkout_url) {
        // New subscription — redirect to Stripe Checkout
        window.location.href = data.checkout_url
      } else if (data.error === 'Stripe not configured') {
        toast.error('Paiement indisponible. Contactez le support.')
      } else if (data.error === 'enterprise_contact') {
        window.open(data.calendly_url || 'https://calendly.com/actero-fr/30min', '_blank')
      } else {
        toast.error(data.message || data.error || 'Erreur lors de la mise a niveau')
      }
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setUpgradingPlan(null)
  }

  // ── Loading state ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  const planConfig = plan.config || getPlanConfig('free')
  const currentPrice = planConfig.price?.[billingPeriod]
  const hasVoice = plan.voiceMinutesLimit > 0
  const overageTickets = plan.usage?.overage_tickets || 0
  const overageCost = overageTickets * (planConfig.overage_per_ticket || 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Facturation</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          Gerez votre abonnement, suivez votre consommation et comparez les plans.
        </p>
      </div>

      {/* ━━━ Section 1 — Plan actuel ━━━ */}
      <SectionCard
        title="Plan actuel"
        icon={PLAN_ICONS[plan.planId] || Zap}
        action={
          <StatusPill variant={PLAN_BADGE_COLORS[plan.planId] || 'neutral'} size="md" dot>
            {plan.planName}
          </StatusPill>
        }
      >
        {/* Trial banner */}
        {plan.inTrial && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-amber-800">
                Essai gratuit — J-{plan.trialDaysLeft} restant{plan.trialDaysLeft > 1 ? 's' : ''}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-amber-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.max(5, 100 - (plan.trialDaysLeft / 7) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">
              {formatPrice(currentPrice)}
            </p>
            {currentPrice > 0 && (
              <p className="text-[11px] text-[#9ca3af]">
                par mois{billingPeriod === 'annual' ? ' (facturé annuellement)' : ''}
              </p>
            )}
          </div>
          <div className="text-right space-y-1">
            {client?.payment_received_at && (
              <p className="text-[11px] text-[#9ca3af] flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3" />
                Depuis {new Date(client.payment_received_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Manage subscription button */}
        <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
          <p className="text-[12px] text-[#9ca3af]">Gerez votre abonnement via Stripe</p>
          <button
            onClick={openStripePortal}
            disabled={loadingPortal || !client?.stripe_customer_id}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-[12px] font-semibold rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {loadingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            Gerer mon abonnement
          </button>
        </div>
      </SectionCard>

      {/* ━━━ Section 2 — Consommation du mois ━━━ */}
      <SectionCard
        title="Consommation du mois"
        subtitle={`Periode : ${currentMonthLabel()}`}
        icon={TrendingUp}
      >
        <div className="space-y-4">
          <UsageBar
            used={plan.ticketsUsed}
            limit={plan.ticketsLimit}
            label="Tickets utilises"
          />

          {hasVoice && (
            <UsageBar
              used={plan.voiceMinutesUsed}
              limit={plan.voiceMinutesLimit}
              label="Minutes vocales"
              unit=" min"
            />
          )}

          {overageTickets > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-700">
                Tickets en depassement : <span className="font-bold">{overageTickets}</span> x {planConfig.overage_per_ticket?.toFixed(2) || '0,10'}{'\u202F'}\u20AC = <span className="font-bold">{overageCost.toFixed(2)}{'\u202F'}\u20AC</span>
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ━━━ Section 3 — Comparaison plans / Upgrade ━━━ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Changer de plan</h3>
            <p className="text-[12px] text-[#9ca3af] mt-0.5">Comparez les options et passez au niveau superieur</p>
          </div>
          {/* Billing period toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f0f0f0]">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-[#1a1a1a] shadow-sm'
                  : 'text-[#71717a] hover:text-[#1a1a1a]'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-white text-[#1a1a1a] shadow-sm'
                  : 'text-[#71717a] hover:text-[#1a1a1a]'
              }`}
            >
              Annuel
              <span className="ml-1 text-[10px] text-[#0F5F35]">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['starter', 'pro', 'enterprise'].map((planKey) => {
            const p = PLANS[planKey]
            if (!p) return null
            const isCurrent = plan.planId === planKey
            const isDowngrade = PLAN_ORDER.indexOf(planKey) <= PLAN_ORDER.indexOf(plan.planId)
            const isEnterprise = planKey === 'enterprise'
            const price = p.price?.[billingPeriod]
            const PlanIcon = PLAN_ICONS[planKey] || Zap
            const features = PLAN_FEATURES_SHORT[planKey] || []

            // CTA text
            let ctaText = ''
            if (isCurrent) {
              ctaText = 'Plan actuel'
            } else if (isEnterprise) {
              ctaText = 'Contacter l\'equipe'
            } else if (isDowngrade) {
              ctaText = 'Inclus dans votre plan'
            } else {
              const isReferred = client?.referral_first_month_free
              ctaText = isReferred
                ? `Passer au ${p.name} — 30 jours gratuits`
                : `Passer au ${p.name} — Essai 7j gratuit`
            }

            return (
              <div
                key={planKey}
                className={`relative rounded-2xl border overflow-hidden transition-all ${
                  isCurrent
                    ? 'border-[#0F5F35]/30 bg-[#0F5F35]/5'
                    : p.popular
                    ? 'border-[#0F5F35] shadow-md'
                    : 'border-[#f0f0f0] bg-white'
                }`}
              >
                {p.popular && !isCurrent && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-[#0F5F35] text-white text-[10px] font-bold uppercase rounded-bl-lg">
                    Populaire
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-[#0F5F35]/10' : 'bg-[#fafafa]'
                    }`}>
                      <PlanIcon className={`w-4 h-4 ${isCurrent ? 'text-[#0F5F35]' : 'text-[#71717a]'}`} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#1a1a1a]">{p.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">{p.tagline}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-[24px] font-bold text-[#1a1a1a] tabular-nums">
                      {formatPrice(price)}
                    </span>
                    {price > 0 && (
                      <span className="text-[11px] text-[#9ca3af] ml-1">/mois</span>
                    )}
                  </div>

                  <div className="space-y-2 mb-5">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px] text-[#71717a]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5F35] mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => !isCurrent && !isDowngrade && handleUpgrade(planKey)}
                    disabled={isCurrent || isDowngrade || upgradingPlan === planKey}
                    className={`w-full py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-[#f0f0f0] text-[#9ca3af] cursor-default'
                        : isDowngrade
                        ? 'bg-[#fafafa] text-[#9ca3af] cursor-default'
                        : isEnterprise
                        ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                        : 'bg-[#0F5F35] text-white hover:bg-[#0a4528]'
                    }`}
                  >
                    {upgradingPlan === planKey ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      ctaText
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ━━━ Section — Crédits à la demande ━━━ */}
      {client?.id && (
        <div>
          <CreditsPurchase clientId={client.id} />
        </div>
      )}

      {/* ━━━ Section 4 — Historique de facturation ━━━ */}
      <SectionCard title="Historique de facturation" icon={FileText}>
        {client?.stripe_customer_id ? (
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[#71717a]">
              Consultez vos factures et paiements passes sur le portail Stripe.
            </p>
            <button
              onClick={openStripePortal}
              disabled={loadingPortal}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#f0f0f0] text-[#1a1a1a] text-[12px] font-semibold rounded-lg hover:bg-[#fafafa] transition-colors"
            >
              {loadingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Voir mes factures
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[13px] text-[#9ca3af]">Aucune facture — plan gratuit</p>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              Les factures apparaitront ici apres votre premier paiement.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
