import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ThumbsUp, ThumbsDown, TrendingUp, CheckCircle2,
  ArrowRight, Loader2, Lightbulb, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AgentImprovementWidget = ({ clientId, theme: _theme }) => {
  const [dismissed, setDismissed] = useState([])

  // Fetch negative feedback patterns from last 30 days
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['agent-improvements', clientId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Get events with negative feedback
      const { data: negativeEvents } = await supabase
        .from('automation_events')
        .select('event_category, description, metadata')
        .eq('client_id', clientId)
        .eq('feedback', 'negative')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50)

      // Get escalated events
      const { data: escalatedEvents } = await supabase
        .from('automation_events')
        .select('event_category, description, metadata')
        .eq('client_id', clientId)
        .in('event_category', ['ticket_escalated', 'lead_escalated'])
        .gte('created_at', thirtyDaysAgo)
        .limit(50)

      // Get positive feedback count
      const { count: positiveCount } = await supabase
        .from('automation_events')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('feedback', 'positive')
        .gte('created_at', thirtyDaysAgo)

      const negCount = negativeEvents?.length || 0
      const escCount = escalatedEvents?.length || 0
      const posCount = positiveCount || 0

      const results = []

      // Pattern 1: High escalation rate
      if (escCount > 10) {
        // Group escalations by reason
        const reasons = {}
        ;(escalatedEvents || []).forEach(e => {
          const reason = e.metadata?.reason || e.description || 'Non precise'
          const key = reason.toLowerCase().slice(0, 50)
          if (!reasons[key]) reasons[key] = { reason, count: 0 }
          reasons[key].count++
        })
        const topReason = Object.values(reasons).sort((a, b) => b.count - a.count)[0]
        if (topReason && topReason.count >= 3) {
          results.push({
            id: 'escalation_pattern',
            type: 'knowledge',
            title: `${topReason.count} escalades sur "${topReason.reason}"`,
            description: `L'agent escalade souvent sur ce sujet. Ajoutez une FAQ pour y repondre automatiquement.`,
            action: 'Ajouter a la base de savoir',
            actionTab: 'knowledge',
            impact: 'Pourrait reduire les escalades de ~30%',
          })
        }
      }

      // Pattern 2: Low positive ratio
      const total = posCount + negCount
      if (total >= 10 && posCount / total < 0.7) {
        results.push({
          id: 'low_satisfaction',
          type: 'tone',
          title: `Taux de satisfaction bas (${Math.round(posCount / total * 100)}%)`,
          description: 'Plus de 30% de reponses avec pouce bas. Verifiez le ton et les instructions.',
          action: 'Ajuster la configuration',
          actionTab: 'agent-config',
          impact: 'Ameliorer la satisfaction des reponses',
        })
      }

      // Pattern 3: Many negative feedbacks on same category
      if (negCount >= 5) {
        const categories = {}
        ;(negativeEvents || []).forEach(e => {
          const cat = e.event_category || 'general'
          categories[cat] = (categories[cat] || 0) + 1
        })
        const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]
        if (topCat && topCat[1] >= 3) {
          results.push({
            id: 'negative_category',
            type: 'rules',
            title: `${topCat[1]} retours négatifs sur "${topCat[0]}"`,
            description: 'Les clients notent mal les réponses sur ce sujet. Ajoutez une règle ou enrichissez la FAQ.',
            action: 'Créer une règle',
            actionTab: 'guardrails',
            impact: 'Améliorer la qualité sur ce sujet',
          })
        }
      }

      // Pattern 4: Always suggest testing if no recent tests
      if (results.length === 0 && total < 5) {
        results.push({
          id: 'test_agent',
          type: 'test',
          title: 'Testez votre agent avec des scenarios',
          description: 'Pas assez de donnees pour detecter des patterns. Testez votre agent avec les scenarios pre-faits.',
          action: 'Ouvrir le simulateur',
          actionTab: 'simulator',
          impact: 'Detecter les problemes avant vos clients',
        })
      }

      return results
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  const visibleSuggestions = suggestions.filter(s => !dismissed.includes(s.id))

  if (isLoading || visibleSuggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">Suggestions d'amelioration</p>
              <p className="text-[10px] text-[#71717a]">Basees sur les feedbacks et escalades des 30 derniers jours</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {visibleSuggestions.map(suggestion => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
              >
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a]">{suggestion.title}</p>
                  <p className="text-xs text-[#71717a] mt-0.5">{suggestion.description}</p>
                  <p className="text-[10px] text-violet-600 font-medium mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {suggestion.impact}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setDismissed(prev => [...prev, suggestion.id])}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-[#71717a] hover:bg-gray-50 transition-colors"
                    title="Ignorer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
