import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, Plus, Trash2, Loader2, CheckCircle2, GripVertical,
  ToggleLeft, ToggleRight, AlertTriangle, Sliders, Save,
  Zap, ArrowRight, X, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const EXAMPLES = [
  "Ne jamais proposer de remboursement sans escalade humaine",
  "Ne jamais mentionner la concurrence",
  "Toujours rediriger les questions sur les prix vers l'equipe commerciale",
  "Ne jamais partager de donnees personnelles d'autres clients",
  "Toujours demander le numero de commande avant de traiter un retour",
  "Ne jamais promettre un delai de livraison specifique",
]

export const GuardrailsEditor = ({ clientId, theme }) => {
  const toast = useToast();
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
      toast.error('Erreur: ' + err.message)
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
            <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Règles d'exclusion</h2>
            <p className="text-sm text-[#9ca3af]">
              {activeCount} règle{activeCount !== 1 ? 's' : ''} active{activeCount !== 1 ? 's' : ''} — appliquée{activeCount !== 1 ? 's' : ''} avant chaque réponse IA
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Ces regles sont des règles & limites. L'agent IA les verifie <strong>avant chaque reponse</strong>.
          Definissez ce que l'agent ne doit <strong>jamais</strong> faire.
        </p>
      </div>

      {/* Add rule */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-5">
        <p className="text-xs font-bold text-[#9ca3af] uppercase tracking-widest mb-3">Ajouter une regle</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Ex: Ne jamais proposer de remboursement sans escalade humaine"
            className="flex-1 px-4 py-3 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20 placeholder-gray-400"
          />
          <button
            onClick={addRule}
            disabled={!newRule.trim() || adding}
            className="flex items-center gap-2 px-5 py-3 bg-cta text-white rounded-lg text-[12px] font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>

        {/* Example suggestions */}
        {guardrails.length === 0 && (
          <div className="mt-4">
            <p className="text-xs text-[#9ca3af] mb-2">Exemples :</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 3).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setNewRule(ex)}
                  className="text-xs px-3 py-1.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[#9ca3af] hover:border-gray-300 hover:text-[#1a1a1a] transition-colors"
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
          <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
        </div>
      ) : guardrails.length === 0 ? (
        <div className="text-center py-12 text-[#9ca3af]">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune règle définie. Ajoutez votre première règle ci-dessus.</p>
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
                    ? 'bg-white border-[#ebebeb]'
                    : 'bg-[#fafafa] border-[#f0f0f0] opacity-50'
                }`}
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.id, rule.is_enabled)}
                  className="flex-shrink-0"
                  title={rule.is_enabled ? 'Desactiver' : 'Activer'}
                >
                  {rule.is_enabled ? (
                    <ToggleRight className="w-6 h-6 text-cta" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-[#e5e5e5]" />
                  )}
                </button>

                {/* Rule text */}
                <p className={`flex-1 text-sm ${rule.is_enabled ? 'text-[#1a1a1a]' : 'text-[#9ca3af] line-through'}`}>
                  {rule.rule_text}
                </p>

                {/* Delete */}
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded-lg text-[#e5e5e5] hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Visual Rule Builder */}
      <VisualRuleBuilder clientId={clientId} onRuleCreated={() => queryClient.invalidateQueries({ queryKey: ['guardrails', clientId] })} />

      {/* Escalation Thresholds */}
      <EscalationThresholds clientId={clientId} />
    </div>
  )
}

const CONDITIONS = [
  { id: 'order_value', label: 'Valeur commande', type: 'number', unit: '€', operators: ['>', '<', '>=', '<=', '='] },
  { id: 'customer_type', label: 'Type de client', type: 'select', options: ['Nouveau', 'Fidele', 'VIP', 'Tous'] },
  { id: 'contact_count', label: 'Nb contacts (7j)', type: 'number', unit: '', operators: ['>', '>=', '='] },
  { id: 'keyword', label: 'Mot-cle detecte', type: 'text', placeholder: 'avocat, procès, arnaque...' },
  { id: 'sentiment', label: 'Sentiment', type: 'select', options: ['Tres negatif', 'Negatif', 'Neutre'] },
  { id: 'topic', label: 'Sujet', type: 'select', options: ['Remboursement', 'Retour', 'Livraison', 'Reclamation', 'Autre'] },
]

const ACTIONS = [
  { id: 'escalate', label: 'Escalader vers un humain', icon: '🧑‍💼', color: 'bg-red-50 border-red-200 text-red-700' },
  { id: 'promo', label: 'Proposer un code promo', icon: '🎁', color: 'bg-violet-50 border-violet-200 text-violet-700' },
  { id: 'template', label: 'Reponse standard', icon: '📋', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'notify', label: 'Notifier l\'equipe', icon: '🔔', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'tag', label: 'Ajouter un tag', icon: '🏷️', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
]

const VisualRuleBuilder = ({ clientId, onRuleCreated }) => {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [conditions, setConditions] = useState([{ conditionId: '', operator: '>', value: '' }])
  const [action, setAction] = useState('')
  const [actionValue, setActionValue] = useState('')
  const [saving, setSaving] = useState(false)

  const addCondition = () => {
    setConditions(prev => [...prev, { conditionId: '', operator: '>', value: '' }])
  }

  const removeCondition = (index) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const updateCondition = (index, field, value) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const buildRuleText = () => {
    const parts = conditions
      .filter(c => c.conditionId && c.value)
      .map(c => {
        const cond = CONDITIONS.find(x => x.id === c.conditionId)
        if (!cond) return ''
        if (cond.type === 'select') return `${cond.label} = ${c.value}`
        if (cond.type === 'text') return `Mot-cle "${c.value}" detecte`
        return `${cond.label} ${c.operator} ${c.value}${cond.unit}`
      })
      .filter(Boolean)

    const act = ACTIONS.find(a => a.id === action)
    if (parts.length === 0 || !act) return ''

    const actionText = actionValue ? `${act.label} (${actionValue})` : act.label
    return `SI ${parts.join(' ET ')} → ${actionText}`
  }

  const handleSave = async () => {
    const ruleText = buildRuleText()
    if (!ruleText) {
      toast.error('Completez au moins une condition et une action')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('client_guardrails').insert({
        client_id: clientId,
        rule_text: ruleText,
        is_enabled: true,
        priority: 0,
      })
      if (error) throw error
      toast.success('Regle creee')
      setConditions([{ conditionId: '', operator: '>', value: '' }])
      setAction('')
      setActionValue('')
      setExpanded(false)
      onRuleCreated()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setSaving(false)
  }

  const rulePreview = buildRuleText()

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-sm text-[#1a1a1a]">Créer une règle visuelle</p>
            <p className="text-xs text-[#9ca3af]">SI [condition] → ALORS [action] — sans code</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-[#9ca3af] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-[#f0f0f0]"
        >
          <div className="p-5 space-y-5">
            {/* Conditions */}
            <div>
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                SI (conditions)
              </p>
              <div className="space-y-2">
                {conditions.map((cond, i) => {
                  const condConfig = CONDITIONS.find(c => c.id === cond.conditionId)
                  return (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      {i > 0 && (
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">ET</span>
                      )}
                      <select
                        value={cond.conditionId}
                        onChange={(e) => updateCondition(i, 'conditionId', e.target.value)}
                        className="px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none"
                      >
                        <option value="">Choisir...</option>
                        {CONDITIONS.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>

                      {condConfig?.type === 'number' && (
                        <>
                          <select
                            value={cond.operator}
                            onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                            className="px-2 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none w-16"
                          >
                            {(condConfig.operators || ['>']).map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={cond.value}
                            onChange={(e) => updateCondition(i, 'value', e.target.value)}
                            placeholder="0"
                            className="px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none w-24"
                          />
                          {condConfig.unit && <span className="text-xs text-[#9ca3af]">{condConfig.unit}</span>}
                        </>
                      )}

                      {condConfig?.type === 'select' && (
                        <select
                          value={cond.value}
                          onChange={(e) => updateCondition(i, 'value', e.target.value)}
                          className="px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none"
                        >
                          <option value="">Choisir...</option>
                          {condConfig.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {condConfig?.type === 'text' && (
                        <input
                          type="text"
                          value={cond.value}
                          onChange={(e) => updateCondition(i, 'value', e.target.value)}
                          placeholder={condConfig.placeholder || 'Valeur...'}
                          className="px-3 py-2 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none flex-1 min-w-[140px]"
                        />
                      )}

                      {conditions.length > 1 && (
                        <button onClick={() => removeCondition(i)} className="p-1 text-[#e5e5e5] hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                onClick={addCondition}
                className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Ajouter une condition
              </button>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <ArrowRight className="w-5 h-5 text-[#9ca3af]" />
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Actions */}
            <div>
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                ALORS (action)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACTIONS.map(act => (
                  <button
                    key={act.id}
                    onClick={() => setAction(act.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      action === act.id ? 'border-cta ring-1 ring-cta/20' : 'border-[#f0f0f0] hover:border-[#ebebeb]'
                    }`}
                  >
                    <span className="text-lg">{act.icon}</span>
                    <p className="text-xs font-bold text-[#1a1a1a] mt-1">{act.label}</p>
                  </button>
                ))}
              </div>

              {(action === 'promo' || action === 'template' || action === 'tag') && (
                <input
                  type="text"
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder={action === 'promo' ? 'Code: SORRY10' : action === 'tag' ? 'Nom du tag' : 'Texte de la reponse'}
                  className="mt-3 w-full px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20"
                />
              )}
            </div>

            {/* Preview */}
            {rulePreview && (
              <div className="p-3 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Apercu de la regle</p>
                <p className="text-sm text-[#1a1a1a] font-medium">{rulePreview}</p>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!rulePreview || saving}
              className="w-full py-3 bg-cta text-white text-sm font-bold rounded-xl hover:bg-[#003725] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Créer la règle
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

const EscalationThresholds = ({ clientId }) => {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: thresholds, isLoading } = useQuery({
    queryKey: ['escalation-thresholds', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_escalation_thresholds')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      if (!data) {
        // Auto-create defaults
        const { data: created } = await supabase
          .from('client_escalation_thresholds')
          .insert({ client_id: clientId })
          .select()
          .single()
        return created
      }
      return data
    },
    enabled: !!clientId,
  })

  const [form, setForm] = useState(null)

  React.useEffect(() => {
    if (thresholds && !form) {
      setForm({
        order_value_threshold: thresholds.order_value_threshold || 0,
        repeat_customer_orders: thresholds.repeat_customer_orders || 0,
        aggressive_tone_enabled: thresholds.aggressive_tone_enabled ?? true,
        low_confidence_threshold: thresholds.low_confidence_threshold || 60,
        keywords: (thresholds.keywords || []).join(', '),
      })
    }
  }, [thresholds])

  const handleSave = async () => {
    if (!form || !thresholds?.id) return
    setSaving(true)
    setSaved(false)
    try {
      await supabase
        .from('client_escalation_thresholds')
        .update({
          order_value_threshold: parseFloat(form.order_value_threshold) || 0,
          repeat_customer_orders: parseInt(form.repeat_customer_orders) || 0,
          aggressive_tone_enabled: form.aggressive_tone_enabled,
          low_confidence_threshold: parseInt(form.low_confidence_threshold) || 60,
          keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', thresholds.id)
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['escalation-thresholds', clientId] })
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  if (isLoading || !form) return null

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6 space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Seuils d'escalade</h3>
          <p className="text-xs text-[#9ca3af]">Definissez quand l'IA doit passer la main a un humain</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Order value */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Montant de commande (EUR)
          </label>
          <p className="text-xs text-[#9ca3af] mb-2">Escalader si la commande depasse ce montant. 0 = desactive.</p>
          <input
            type="number"
            min="0"
            value={form.order_value_threshold}
            onChange={(e) => setForm(f => ({ ...f, order_value_threshold: e.target.value }))}
            className="w-full max-w-xs px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20"
            placeholder="Ex: 150"
          />
        </div>

        {/* Repeat customer */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Client fidele (nombre de commandes)
          </label>
          <p className="text-xs text-[#9ca3af] mb-2">Escalader si le client a passe plus de X commandes. 0 = desactive.</p>
          <input
            type="number"
            min="0"
            value={form.repeat_customer_orders}
            onChange={(e) => setForm(f => ({ ...f, repeat_customer_orders: e.target.value }))}
            className="w-full max-w-xs px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20"
            placeholder="Ex: 5"
          />
        </div>

        {/* Confidence threshold */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Seuil de confiance IA (%)
          </label>
          <p className="text-xs text-[#9ca3af] mb-2">Escalader si la confiance de l'IA est inferieure a ce pourcentage.</p>
          <div className="flex items-center gap-3 max-w-xs">
            <input
              type="range"
              min="10"
              max="95"
              step="5"
              value={form.low_confidence_threshold}
              onChange={(e) => setForm(f => ({ ...f, low_confidence_threshold: e.target.value }))}
              className="flex-1 accent-cta"
            />
            <span className="text-sm font-bold text-[#1a1a1a] w-12 text-center">{form.low_confidence_threshold}%</span>
          </div>
        </div>

        {/* Aggressive tone */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1a1a1a]">Ton agressif detecte</p>
            <p className="text-xs text-[#9ca3af]">Escalader automatiquement si le message est detecte comme agressif</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, aggressive_tone_enabled: !f.aggressive_tone_enabled }))}
            className="flex-shrink-0"
          >
            {form.aggressive_tone_enabled ? (
              <ToggleRight className="w-8 h-8 text-cta" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-[#e5e5e5]" />
            )}
          </button>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Mots-cles d'escalade
          </label>
          <p className="text-xs text-[#9ca3af] mb-2">Escalader si le message contient ces mots (separes par des virgules).</p>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => setForm(f => ({ ...f, keywords: e.target.value }))}
            className="w-full px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/20"
            placeholder="Ex: avocat, juridique, DGCCRF, plainte"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-cta text-white rounded-lg text-[12px] font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les seuils
        </button>
        {saved && (
          <span className="text-xs text-cta flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Enregistre
          </span>
        )}
      </div>
    </div>
  )
}
