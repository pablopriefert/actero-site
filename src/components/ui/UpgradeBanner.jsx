import { Lock } from 'lucide-react'
import { getPlanConfig } from '../../lib/plans'

const FEATURE_LABELS = {
  simulator: 'Simulateur de conversation',
  voice_agent: 'Agent vocal telephonique',
  whatsapp_agent: 'Agent WhatsApp',
  brand_editor: 'Editeur de ton de marque',
  guardrails: 'Garde-fous & regles metier',
  api_webhooks: 'API & webhooks',
  specialized_agents: 'Agents IA specialises',
  pdf_report: 'Rapport PDF mensuel',
}

export const UpgradeBanner = ({ feature, requiredPlan, compact = false, onNavigate }) => {
  const planConfig = getPlanConfig(requiredPlan)
  const featureLabel = FEATURE_LABELS[feature] || feature
  const handleClick = () => {
    if (onNavigate) onNavigate('/pricing')
    else window.location.href = '/pricing'
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
        <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-[12px] text-amber-800 font-medium truncate">
          {featureLabel} — Plan {planConfig.name} requis
        </span>
        <button
          onClick={handleClick}
          className="ml-auto text-[11px] font-semibold text-[#0F5F35] hover:underline flex-shrink-0"
        >
          Upgrade
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-12">
      <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
        {/* Lock icon in amber circle */}
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-amber-600" />
        </div>

        <h2 className="text-[20px] font-semibold text-[#1a1a1a] mb-2">
          Fonctionnalite {planConfig.name} requise
        </h2>

        <p className="text-[14px] text-[#71717a] leading-relaxed max-w-sm mx-auto mb-6">
          {featureLabel ? (
            <>Le <strong>{featureLabel}</strong> est disponible a partir du plan <strong>{planConfig.name}</strong>.</>
          ) : (
            <>Cette fonctionnalite est disponible a partir du plan <strong>{planConfig.name}</strong>.</>
          )}
        </p>

        <button
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F5F35] text-white text-[14px] font-semibold hover:bg-[#0d5430] transition-colors shadow-sm"
        >
          Passer au plan {planConfig.name}
        </button>

        <p className="text-[11px] text-[#9ca3af] mt-4">
          Essai gratuit 7 jours, sans engagement
        </p>
      </div>
    </div>
  )
}
