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
import { resolveUpgrade } from '../../lib/billing-router'
import { SelecteurFormule } from '../billing/SelecteurFormule'
import { affichagePrix } from '../../lib/affichage-formules'
import { PERIODE_API, periodeDepuisApi } from '../../../api/lib/formules.js'
import { resolveOrCreateClientId } from '../../lib/resolve-client'
import { usePlan } from '../../hooks/usePlan'
import { SectionCard } from '../ui/SectionCard'
import { StatusPill } from '../ui/StatusPill'
import { CreditsPurchase } from './CreditsPurchase'
import { joursEssaiPour, peutAvoirUneOffreDeBienvenue } from '../../../api/lib/essai-gratuit.js'

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
    'Simulateur de conversation',
    'API + webhooks',
    'Support email 48h',
  ],
  pro: [
    '5 000 tickets / mois',
    'Workflows illimités',
    'Agent email',
    'Agents IA spécialisés',
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
    'bg-cta'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[#1a1a1a]">{label}</span>
        <span className="text-[12px] text-[#71717a] tabular-nums">
          {used.toLocaleString('fr-FR')}{unit} / {isUnlimited ? '\u221E' : limit.toLocaleString('fr-FR')}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${isUnlimited ? 0 : percent}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────
export const ClientBillingView = ({ theme: _theme }) => {
  const toast = useToast()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState(null)
  const [periode, setPeriode] = useState('mensuel')

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

  // Une boutique Shopify s'abonne chez Shopify (App Store 1.2.1), qui ne
  // propose pas le trimestriel.
  const { data: boutiqueShopify } = useQuery({
    queryKey: ['billing-shopify', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shopify_connections')
        .select('shop_domain')
        .eq('client_id', client.id)
        .maybeSingle()
      // Une lecture ratée ne vaut pas « pas de boutique Shopify » : React Query
      // laisse alors data à undefined, et rien qui dépend de Shopify n'est annoncé.
      if (error) throw error
      return !!data?.shop_domain
    },
  })
  const periodeEffective = boutiqueShopify ? 'mensuel' : periode
  // N'annoncer ni −50 % ni mois offert que Checkout refuserait : même règle que
  // le serveur (api/lib/essai-gratuit.js), qui vérifie en plus l'historique Stripe.
  const offreBienvenue = peutAvoirUneOffreDeBienvenue(client)

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

    setUpgradingPlan(targetPlan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Session expirée. Reconnectez-vous.')
        setUpgradingPlan(null)
        return
      }

      // Resolve the client_id — create it on the fly for a fresh direct signup
      // that reached billing without a clients row yet (otherwise the upgrade
      // would dead-end). Falls back to the already-loaded client when present.
      let clientId = client?.id
      if (!clientId) {
        try {
          clientId = await resolveOrCreateClientId(supabase, session)
        } catch {
          toast.error('Impossible de préparer votre compte. Contactez le support.')
          setUpgradingPlan(null)
          return
        }
      }

      // Shopify-installed merchants must be billed via Shopify Billing (App
      // Store policy 1.2); direct signups fall through to Stripe below.
      const routed = await resolveUpgrade({
        token: session?.access_token, clientId, targetPlan, billingPeriod: PERIODE_API[periodeEffective],
      })
      if (routed.channel === 'shopify') { window.location.assign(routed.url); return }
      if (routed.channel === 'error') { toast.error(routed.message); setUpgradingPlan(null); return }

      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          target_plan: targetPlan,
          billing_period: PERIODE_API[periodeEffective],
        }),
      })
      const data = await res.json()
      // Contrat de api/billing/upgrade.js (Task 5 bis) : chaque 200 porte un
      // `statut`, chaque erreur un code (`error`) et une phrase (`message`).
      if (data.statut === 'checkout') {
        window.location.assign(data.checkout_url)
        return
      } else if (data.statut === 'paiement_a_valider' || (data.error === 'paiement_refuse' && data.facture_url)) {
        // La différence se valide, ou se règle avec une autre carte, sur la
        // facture Stripe : le plan s'applique une fois payée.
        if (data.error) toast.error(data.message)
        else toast.info(data.message)
        window.location.assign(data.facture_url)
        return
      } else if (data.statut === 'change_applique') {
        toast.success(data.message)
        // La route n'écrit pas le plan : le webhook Stripe l'accorde une fois le
        // paiement confirmé. On l'attend quelques secondes avant de recharger.
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const { data: ligne } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
          if (ligne?.plan === targetPlan) break
        }
        window.location.reload()
        return
      } else if (data.statut === 'paiement_en_cours') {
        toast.info(data.message)
      } else if (data.error === 'enterprise_contact') {
        window.open(data.calendly_url || 'https://calendly.com/actero-fr/30min', '_blank')
      } else {
        // Jamais le code brut (`abonnement_en_cours`…) : la phrase prévue pour le marchand.
        toast.error(data.message || 'Paiement indisponible. Contactez le support.')
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
  // Le prix affiché pour le plan actuel est celui de SA formule, pas celle du
  // sélecteur.
  const periodeActuelle = periodeDepuisApi(client?.billing_period) || 'mensuel'
  const affichageActuel = ['starter', 'pro'].includes(plan.planId) ? affichagePrix(plan.planId, periodeActuelle, { offreBienvenue: false }) : null
  // Hard cap — no overage billing. Once the monthly quota is reached the agent
  // stops answering until the merchant buys credits or upgrades.
  const quotaReached = !!plan.isOverLimit

  const ticketsPct = plan.ticketsLimit === Infinity || plan.ticketsLimit === -1
    ? 0
    : plan.ticketsLimit > 0
      ? Math.min(Math.round((plan.ticketsUsed / plan.ticketsLimit) * 100), 100)
      : 0
  const usageState = ticketsPct >= 90 ? 'danger' : ticketsPct >= 70 ? 'warn' : 'ok'
  const PlanIconTop = PLAN_ICONS[plan.planId] || Zap

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ═══════ HEADER STRIP ═══════ */}
      <div className="bg-white border border-[#E6E8EC] rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-cta" />
              </div>
              <h1 className="text-lg font-bold text-[#1a1a1a]">Facturation</h1>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                plan.inTrial
                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-cta/10 text-cta'
              }`}>
                <PlanIconTop className="w-2.5 h-2.5" />
                Plan {plan.planName}
                {plan.inTrial && ` · J-${plan.trialDaysLeft}`}
              </span>
            </div>
            <p className="text-[12px] text-[#71717a]">
              Gérez votre abonnement, suivez votre consommation et comparez les plans.
            </p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Prix</span>
              <span className="text-lg font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {affichageActuel ? affichageActuel.principal : formatPrice(planConfig.price?.monthly)}
              </span>
              <span className="text-[10px] text-[#9ca3af]">
                {affichageActuel ? affichageActuel.suffixe.replace('/', '/ ') : ''}
              </span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Conso.</span>
              <span className={`text-lg font-bold tabular-nums leading-tight ${
                usageState === 'danger' ? 'text-red-500'
                : usageState === 'warn' ? 'text-amber-600'
                : 'text-cta'
              }`}>
                {plan.ticketsLimit === Infinity || plan.ticketsLimit === -1 ? '∞' : `${ticketsPct}%`}
              </span>
              <span className="text-[10px] text-[#9ca3af]">tickets</span>
            </div>
            {quotaReached && (
              <>
                <div className="w-px h-10 bg-gray-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Quota</span>
                  <span className="text-lg font-bold text-amber-600 leading-tight">Atteint</span>
                  <span className="text-[10px] text-[#9ca3af]">agent en pause</span>
                </div>
              </>
            )}
          </div>
        </div>
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
                  style={{ width: `${Math.max(5, 100 - (plan.trialDaysLeft / 30) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums">
              {affichageActuel ? affichageActuel.principal : formatPrice(planConfig.price?.monthly)}
            </p>
            {affichageActuel && (
              <p className="text-[11px] text-[#9ca3af]">
                {affichageActuel.suffixe.replace('/', 'par ')}{affichageActuel.detail ? ` · ${affichageActuel.detail}` : ''}
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
        <div className="mt-4 pt-4 border-t border-[#E6E8EC] flex items-center justify-between">
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
        subtitle={`Période : ${currentMonthLabel()}`}
        icon={TrendingUp}
      >
        <div className="space-y-4">
          <UsageBar
            used={plan.ticketsUsed}
            limit={plan.ticketsLimit}
            label="Tickets utilises"
          />

          {quotaReached && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-800">
                Quota mensuel atteint \u2014 l&apos;agent ne r\u00E9pond plus. Achetez des cr\u00E9dits ci-dessous
                ou passez au plan sup\u00E9rieur pour le r\u00E9activer.
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
          {!boutiqueShopify && (
            <SelecteurFormule periode={periode} onChange={setPeriode} taille="petite" offreBienvenue={offreBienvenue} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['starter', 'pro', 'enterprise'].map((planKey) => {
            const p = PLANS[planKey]
            if (!p) return null
            const isCurrent = plan.planId === planKey
            const isDowngrade = PLAN_ORDER.indexOf(planKey) <= PLAN_ORDER.indexOf(plan.planId)
            const isEnterprise = planKey === 'enterprise'
            const affichage = isEnterprise ? null : affichagePrix(planKey, periodeEffective, { offreBienvenue })
            const PlanIcon = PLAN_ICONS[planKey] || Zap
            const features = PLAN_FEATURES_SHORT[planKey] || []

            // CTA text
            let ctaText = ''
            if (isCurrent) {
              ctaText = 'Plan actuel'
            } else if (isEnterprise) {
              ctaText = 'Contacter l\'équipe'
            } else if (isDowngrade) {
              ctaText = 'Rétrograder'
            } else {
              // La durée affichée doit être celle qui sera réellement
              // accordée : joursEssaiPour est la seule source (ACT-33). Un
              // bouton qui annonce sept jours à quelqu'un qui en aura trente
              // est un mensonge dans le sens gentil — celui qui annoncerait
              // trente pour sept est un remboursement.
              // Shopify facture et gère lui-même l'abonnement : aucun mois offert à
              // annoncer, ni tant qu'on ne sait pas encore si la boutique est sur Shopify.
              const jours = periodeEffective === 'mensuel' && offreBienvenue && boutiqueShopify === false ? joursEssaiPour(client) : undefined
              ctaText = jours
                ? `Passer au ${p.name} — ${jours} jours gratuits`
                : `Passer au ${p.name}`
            }

            return (
              <div
                key={planKey}
                className={`relative rounded-2xl border overflow-hidden transition-all ${
                  isCurrent
                    ? 'border-cta/30 bg-cta/5'
                    : p.popular
                    ? 'border-cta shadow-md'
                    : 'border-[#E6E8EC] bg-white'
                }`}
              >
                {p.popular && !isCurrent && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-cta text-white text-[10px] font-bold uppercase rounded-bl-lg">
                    Populaire
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-cta/10' : 'bg-surface'
                    }`}>
                      <PlanIcon className={`w-4 h-4 ${isCurrent ? 'text-cta' : 'text-[#71717a]'}`} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#1a1a1a]">{p.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">{p.tagline}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-[24px] font-bold text-[#1a1a1a] tabular-nums">
                      {affichage ? affichage.principal : formatPrice(p.price?.monthly)}
                    </span>
                    {affichage && (
                      <span className="text-[11px] text-[#9ca3af] ml-1">{affichage.suffixe}</span>
                    )}
                    {affichage?.detail && (
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{affichage.detail}</p>
                    )}
                  </div>

                  <div className="space-y-2 mb-5">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px] text-[#71717a]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cta mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      if (isCurrent) return
                      // Downgrade / cancel is handled in Stripe's Customer Portal
                      // (native proration + period-end change). Upgrades + the
                      // Enterprise "contact" case go through handleUpgrade.
                      if (isDowngrade) { openStripePortal(); return }
                      handleUpgrade(planKey)
                    }}
                    disabled={isCurrent || !!upgradingPlan || (isDowngrade && loadingPortal)}
                    className={`w-full py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-surface text-[#9ca3af] cursor-default'
                        : isDowngrade
                        ? 'bg-white border border-[#E6E8EC] text-[#71717a] hover:bg-surface hover:text-[#1a1a1a]'
                        : isEnterprise
                        ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                        : 'bg-cta text-white hover:bg-[#0a4528]'
                    }`}
                  >
                    {(upgradingPlan === planKey || (isDowngrade && loadingPortal)) ? (
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
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E6E8EC] text-[#1a1a1a] text-[12px] font-semibold rounded-lg hover:bg-surface transition-colors"
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
