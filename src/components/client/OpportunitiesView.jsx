import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Target, DollarSign, Users, Zap, ArrowRight, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Opportunities — growth-oriented landing that highlights what the client
 * could gain (more revenue, more time, better CSAT) based on their current
 * usage. Mix of static best-practices + actionable metrics.
 */
export const OpportunitiesView = ({ clientId, onNavigate }) => {
  const { data: kbCount } = useQuery({
    queryKey: ['kb-count-opp', clientId],
    queryFn: async () => {
      if (!clientId) return 0
      const { count } = await supabase
        .from('client_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('is_active', true)
      return count || 0
    },
    enabled: !!clientId,
  })

  const { data: integrationsCount } = useQuery({
    queryKey: ['integrations-count-opp', clientId],
    queryFn: async () => {
      if (!clientId) return 0
      const { count } = await supabase
        .from('client_integrations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'active')
      return count || 0
    },
    enabled: !!clientId,
  })

  const opportunities = [
    {
      id: 'kb',
      title: 'Enrichir votre base de connaissances',
      description: (kbCount || 0) < 10
        ? `Vous avez ${kbCount || 0} entrées. Les marchands avec 15+ entrées ont un taux d'auto-résolution +30%.`
        : `${kbCount} entrées actives — bon niveau ! Continuez d'ajouter les nouvelles questions fréquentes.`,
      impact: '+30% auto-résolution',
      icon: Zap,
      action: 'Ajouter des entrées',
      target: 'knowledge',
      urgent: (kbCount || 0) < 5,
    },
    {
      id: 'integrations',
      title: 'Connecter plus d\'outils',
      description: (integrationsCount || 0) < 3
        ? 'Plus d\'intégrations = plus de contexte pour l\'agent. Shopify, Gmail, Gorgias…'
        : `${integrationsCount} intégrations actives — excellent.`,
      impact: 'Contexte enrichi',
      icon: Target,
      action: 'Voir les intégrations',
      target: 'integrations',
      urgent: (integrationsCount || 0) < 2,
    },
    {
      id: 'referral',
      title: 'Parrainer un marchand ami',
      description: 'Gagnez 1 mois offert pour chaque filleul qui s\'inscrit. Pas de limite.',
      impact: '1 mois offert × ∞',
      icon: Gift,
      action: 'Obtenir mon lien',
      target: 'referral',
      urgent: false,
    },
    {
      id: 'roi',
      title: 'Suivre le ROI de votre SAV',
      description: 'Configurez vos coûts support + valeur panier pour mesurer les économies réelles générées par Actero.',
      impact: 'Métriques précises',
      icon: DollarSign,
      action: 'Configurer',
      target: 'roi',
      urgent: false,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 pb-16 animate-fade-in-up">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-8"
      >
        <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight mb-1">Opportunités</h1>
        <p className="text-[13px] text-[#71717a] max-w-2xl">
          Les leviers concrets pour tirer plus de valeur d'Actero cette semaine.
        </p>
      </motion.div>

      {/* Opportunities cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {opportunities.map((opp, idx) => {
          const Icon = opp.icon
          return (
            <motion.div
              key={opp.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * idx }}
              className={`relative bg-white rounded-2xl border p-5 ${
                opp.urgent
                  ? 'border-amber-200 bg-gradient-to-br from-amber-50/40 to-white'
                  : 'border-[#f0f0f0]'
              }`}
            >
              {opp.urgent && (
                <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  Action recommandée
                </span>
              )}
              <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-cta" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{opp.title}</h3>
              <p className="text-[12px] text-[#71717a] leading-relaxed mb-3">{opp.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-cta">{opp.impact}</span>
                <button
                  onClick={() => onNavigate && onNavigate(opp.target)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-cta hover:text-[#003725] transition-colors"
                >
                  {opp.action} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
