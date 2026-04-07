import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, Plus, Trash2, Loader2, CheckCircle2, GripVertical,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const EXAMPLES = [
  "Ne jamais proposer de remboursement sans escalade humaine",
  "Ne jamais mentionner la concurrence",
  "Toujours rediriger les questions sur les prix vers l'equipe commerciale",
  "Ne jamais partager de donnees personnelles d'autres clients",
  "Toujours demander le numero de commande avant de traiter un retour",
  "Ne jamais promettre un delai de livraison specifique",
]

export const GuardrailsEditor = ({ clientId, theme }) => {
  const queryClient = useQueryClient()
  const [newRule, setNewRule] = useState('')
  const [adding, setAdding] = useState(false)

  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrails', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_guardrails')
        .select('*')
        .eq('client_id', clientId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const addRule = async () => {
    if (!newRule.trim()) return
    setAdding(true)
    try {
      const { error } = await supabase.from('client_guardrails').insert({
        client_id: clientId,
        rule_text: newRule.trim(),
        is_enabled: true,
        priority: guardrails.length,
      })
      if (error) throw error
      setNewRule('')
      queryClient.invalidateQueries({ queryKey: ['guardrails', clientId] })
    } catch (err) {
      alert('Erreur: ' + err.message)
    }
    setAdding(false)
  }

  const toggleRule = async (id, currentEnabled) => {
    await supabase.from('client_guardrails')
      .update({ is_enabled: !currentEnabled, updated_at: new Date().toISOString() })
      .eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['guardrails', clientId] })
  }

  const deleteRule = async (id) => {
    await supabase.from('client_guardrails').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['guardrails', clientId] })
  }

  const activeCount = guardrails.filter(g => g.is_enabled).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#262626]">Regles d'exclusion</h2>
            <p className="text-sm text-[#716D5C]">
              {activeCount} regle{activeCount !== 1 ? 's' : ''} active{activeCount !== 1 ? 's' : ''} — appliquee{activeCount !== 1 ? 's' : ''} avant chaque reponse IA
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Ces regles sont des garde-fous. L'agent IA les verifie <strong>avant chaque reponse</strong>.
          Definissez ce que l'agent ne doit <strong>jamais</strong> faire.
        </p>
      </div>

      {/* Add rule */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-3">Ajouter une regle</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Ex: Ne jamais proposer de remboursement sans escalade humaine"
            className="flex-1 px-4 py-3 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-400"
          />
          <button
            onClick={addRule}
            disabled={!newRule.trim() || adding}
            className="flex items-center gap-2 px-5 py-3 bg-[#0F5F35] text-white rounded-xl text-sm font-bold hover:bg-[#003725] transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>

        {/* Example suggestions */}
        {guardrails.length === 0 && (
          <div className="mt-4">
            <p className="text-xs text-[#716D5C] mb-2">Exemples :</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 3).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setNewRule(ex)}
                  className="text-xs px-3 py-1.5 bg-[#F9F7F1] border border-gray-200 rounded-lg text-[#716D5C] hover:border-gray-300 hover:text-[#262626] transition-colors"
                >
                  + {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#716D5C]" />
        </div>
      ) : guardrails.length === 0 ? (
        <div className="text-center py-12 text-[#716D5C]">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune regle definie. Ajoutez votre premiere regle ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {guardrails.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  rule.is_enabled
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-100 opacity-50'
                }`}
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.id, rule.is_enabled)}
                  className="flex-shrink-0"
                  title={rule.is_enabled ? 'Desactiver' : 'Activer'}
                >
                  {rule.is_enabled ? (
                    <ToggleRight className="w-6 h-6 text-[#0F5F35]" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-300" />
                  )}
                </button>

                {/* Rule text */}
                <p className={`flex-1 text-sm ${rule.is_enabled ? 'text-[#262626]' : 'text-[#716D5C] line-through'}`}>
                  {rule.rule_text}
                </p>

                {/* Delete */}
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
