import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, Plus, Trash2, Loader2, CheckCircle2, GripVertical,
  ToggleLeft, ToggleRight, AlertTriangle, Sliders, Save,
  Zap, ArrowRight, X, ChevronDown, ChevronRight, Shield, FlaskConical, AlertCircle,
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
            <h2
              className="text-2xl italic tracking-tight text-[#1a1a1a]"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
            >
              Règles d'exclusion
            </h2>
            <p className="text-[15px] text-[#5A5A5A]">
              {activeCount} règle{activeCount !== 1 ? 's' : ''} active{activeCount !== 1 ? 's' : ''} — appliquée{activeCount !== 1 ? 's' : ''} avant chaque réponse de ton agent.
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
          <p className="text-sm">Aucune règle définie. Ajoute ta première règle ci-dessus.</p>
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

      {/* Escalation Thresholds — for SAV / agent escalation */}
      <EscalationThresholds clientId={clientId} />

      {/* Discount Policy — for cart abandonment / commercial gestures */}
      <DiscountPolicyPanel clientId={clientId} />
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
  const toast = useToast()
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
    } catch (err) {
      // User-initiated form save — MUST surface failure or data loss happens silently.
      console.error('[GuardrailsEditor] threshold save failed:', err)
      toast.error('Échec de la sauvegarde des seuils. Réessayez ou contactez le support.')
    }
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

/* ───────── Discount Policy panel — moved from Agent Control Center ─────────
 * Lives in the Restrictions tab next to the SAV escalation thresholds. The
 * SAV thresholds answer "quand un humain prend le relais"; this panel
 * answers "quand l'agent doit lâcher une remise, combien". Two sister
 * controls in the same place.
 *
 * Pattern is unchanged from AgentControlCenterView — same Supabase columns,
 * same /api/engine/test-discount-policy endpoint, same E2B sandbox audit
 * trail in agent_action_logs. */
const DiscountPolicyPanel = ({ clientId }) => {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: settings } = useQuery({
    queryKey: ['discount-policy-settings', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data } = await supabase
        .from('client_settings')
        .select('discount_policy_enabled, discount_policy_code, discount_policy_max_pct, discount_policy_updated_at')
        .eq('client_id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!clientId,
  })

  const DEFAULT_POLICY = `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))
    if orders == 0 and cart_value < 50:
        return {'discount_pct': 0, 'reason': 'first_order_low_cart_no_discount'}
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'vip_high_cart'}
    if orders >= 1 and cart_value >= 80:
        return {'discount_pct': 10, 'reason': 'repeat_customer_above_80'}
    return {'discount_pct': 5, 'reason': 'standard_default'}
`

  const POLICY_TEMPLATES = [
    { id: 'conservative', name: 'Conservatrice', tag: 'Marge protégée', maxPct: 10,
      description: 'Pas de remise sur petits paniers, modeste sur gros paniers, généreuse seulement pour les VIP.',
      code: `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))
    if cart_value < 50:
        return {'discount_pct': 0, 'reason': 'panier_trop_petit'}
    if clv >= 500:
        return {'discount_pct': 10, 'reason': 'client_vip'}
    if orders >= 2:
        return {'discount_pct': 5, 'reason': 'client_fidele'}
    return {'discount_pct': 0, 'reason': 'pas_de_remise_par_defaut'}
` },
    { id: 'balanced', name: 'Équilibrée', tag: 'Recommandée', maxPct: 15,
      description: 'Pas de remise sur tout 1ère commande petit panier, 5/10/15% selon profil et taille du panier.',
      code: DEFAULT_POLICY },
    { id: 'aggressive', name: 'Agressive', tag: 'Croissance / acquisition', maxPct: 20,
      description: 'Remise systématique pour convertir les paniers abandonnés, plus forte pour les VIP.',
      code: `def decide_discount(cart, customer, policy_caps):
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 20, 'reason': 'vip_gros_panier'}
    if cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'gros_panier'}
    if cart_value >= 50:
        return {'discount_pct': 10, 'reason': 'panier_moyen'}
    return {'discount_pct': 5, 'reason': 'remise_minimale'}
` },
  ]

  const POLICY_SCENARIOS = [
    { id: 'new_visitor', name: 'Nouveau visiteur', description: '1ère visite, panier 35€, aucune commande passée', cart: 35, clv: 0, orders: 0 },
    { id: 'returning', name: 'Client qui revient', description: '1 commande passée (89€ moyen), panier actuel 89€', cart: 89, clv: 89, orders: 1 },
    { id: 'loyal', name: 'Client fidèle', description: '4 commandes passées, dépensé 320€ au total, panier 110€', cart: 110, clv: 320, orders: 4 },
    { id: 'vip', name: 'Client VIP', description: '12 commandes, dépensé 850€ au total, gros panier 180€', cart: 180, clv: 850, orders: 12 },
  ]

  const [policyCode, setPolicyCode] = useState('')
  const [policyMaxPct, setPolicyMaxPct] = useState(15)
  const [policyMockCart, setPolicyMockCart] = useState(89)
  const [policyMockClv, setPolicyMockClv] = useState(250)
  const [policyMockOrders, setPolicyMockOrders] = useState(1)
  const [policyTestState, setPolicyTestState] = useState('idle')
  const [policyTestResult, setPolicyTestResult] = useState(null)
  const [policyDirty, setPolicyDirty] = useState(false)
  const [policyShowCode, setPolicyShowCode] = useState(false)
  const [policyScenarioId, setPolicyScenarioId] = useState('returning')

  React.useEffect(() => {
    if (!settings) return
    if (!policyCode && !policyDirty) {
      setPolicyCode(settings.discount_policy_code || DEFAULT_POLICY)
    }
    if (settings.discount_policy_max_pct != null) {
      setPolicyMaxPct(settings.discount_policy_max_pct)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const loadTemplate = (t) => {
    setPolicyCode(t.code)
    setPolicyMaxPct(t.maxPct)
    setPolicyDirty(true)
  }

  const applyScenario = (s) => {
    setPolicyScenarioId(s.id)
    setPolicyMockCart(s.cart)
    setPolicyMockClv(s.clv)
    setPolicyMockOrders(s.orders)
  }

  async function runDiscountTest({ persist = false } = {}) {
    if (policyTestState === 'running') return
    setPolicyTestState('running')
    setPolicyTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPolicyTestState('error')
        setPolicyTestResult({ error: 'Session expirée — reconnectez-vous.' })
        return
      }
      const resp = await fetch('/api/engine/test-discount-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          client_id: clientId,
          policy_code: policyCode,
          max_pct: Number(policyMaxPct) || 15,
          mock_cart: { total_value: Number(policyMockCart) || 0, currency: 'EUR' },
          mock_customer: { clv: Number(policyMockClv) || 0, orders_count: Number(policyMockOrders) || 0 },
          persist,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        setPolicyTestState('error')
        setPolicyTestResult(data)
        return
      }
      setPolicyTestState('success')
      setPolicyTestResult(data)
      if (persist) {
        setPolicyDirty(false)
        queryClient.invalidateQueries({ queryKey: ['discount-policy-settings', clientId] })
      }
    } catch (err) {
      setPolicyTestState('error')
      setPolicyTestResult({ error: err.message })
    }
  }

  async function toggleDiscountPolicy() {
    if (!clientId) return
    const next = !Boolean(settings?.discount_policy_enabled)
    queryClient.setQueryData(['discount-policy-settings', clientId], (prev) => ({ ...(prev || {}), discount_policy_enabled: next }))
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, discount_policy_enabled: next }, { onConflict: 'client_id' })
    if (error) {
      queryClient.setQueryData(['discount-policy-settings', clientId], (prev) => ({ ...(prev || {}), discount_policy_enabled: !next }))
    } else {
      queryClient.invalidateQueries({ queryKey: ['discount-policy-settings', clientId] })
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
      {/* Header + master toggle */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-cta" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Règles de remise automatiques</h3>
              {settings?.discount_policy_enabled && (
                <span className="text-[10px] font-bold text-cta uppercase tracking-wider">Activées</span>
              )}
            </div>
            <p className="text-[12px] text-[#71717a] leading-relaxed mt-1">
              Quand l'agent doit proposer une remise (relance panier abandonné, geste commercial dans le chat, demande de réduction), ces règles décident automatiquement le pourcentage. Tu peux choisir un modèle ci-dessous ou personnaliser.
            </p>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              <strong className="text-[#71717a]">Garantie marge :</strong> aucune remise ne peut dépasser le plafond ({policyMaxPct}%) — même si la règle se trompe.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDiscountPolicy}
          role="switch"
          aria-checked={Boolean(settings?.discount_policy_enabled)}
          className={`relative w-[42px] h-[22px] rounded-full transition-colors flex-shrink-0 ${
            settings?.discount_policy_enabled ? 'bg-cta' : 'bg-[#d4d4d8] hover:bg-[#a1a1aa]'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] transition-transform duration-200 ease-out ${settings?.discount_policy_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Step 1 — Templates */}
      <div className="mb-5">
        <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">1. Choisis une stratégie</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {POLICY_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => loadTemplate(t)}
              className="text-left p-3 rounded-xl border border-[#E5E2D7] bg-[#fafaf7] hover:border-cta/40 hover:bg-cta/5 transition"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-[#1a1a1a]">{t.name}</span>
                <span className="text-[10px] text-cta font-semibold">{t.tag}</span>
              </div>
              <p className="text-[11px] text-[#71717a] leading-snug">{t.description}</p>
              <p className="text-[10px] text-[#9ca3af] mt-1">Plafond : {t.maxPct}%</p>
            </button>
          ))}
        </div>
      </div>

      {/* Plafond */}
      <div className="mb-5 p-3 rounded-xl bg-[#fafaf7] border border-[#E5E2D7]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#1a1a1a]">Plafond max de remise</p>
            <p className="text-[11px] text-[#71717a]">Aucune remise ne pourra dépasser ce pourcentage, quoi qu'il arrive.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" max="100" step="0.5"
              value={policyMaxPct}
              onChange={(e) => { setPolicyMaxPct(e.target.value); setPolicyDirty(true) }}
              className="w-20 text-[13px] rounded-lg border border-[#E5E2D7] bg-white px-3 py-1.5 text-[#1a1a1a] text-right focus:outline-none focus:ring-2 focus:ring-cta/30"
            />
            <span className="text-[13px] text-[#71717a]">%</span>
          </div>
        </div>
      </div>

      {/* Step 2 — Scenarios */}
      <div className="mb-4">
        <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-2">2. Simule un client pour voir la décision</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {POLICY_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applyScenario(s)}
              className={`text-left p-2 rounded-lg border transition ${
                policyScenarioId === s.id ? 'border-cta/40 bg-cta/5' : 'border-[#E5E2D7] bg-white hover:border-cta/30'
              }`}
            >
              <p className="text-[12px] font-semibold text-[#1a1a1a]">{s.name}</p>
              <p className="text-[10px] text-[#71717a] leading-snug">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <button
          type="button"
          onClick={() => runDiscountTest({ persist: false })}
          disabled={policyTestState === 'running' || !clientId}
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E5E2D7] px-4 py-2 text-[13px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] disabled:opacity-50"
        >
          {policyTestState === 'running'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Test en cours…</>
            : <><FlaskConical className="w-4 h-4" /> Tester ce scénario</>}
        </button>
        <button
          type="button"
          onClick={() => runDiscountTest({ persist: true })}
          disabled={policyTestState === 'running' || !clientId}
          className="inline-flex items-center gap-2 rounded-xl bg-cta px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0a4a29] disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" /> Sauvegarder ces règles
        </button>
        {settings?.discount_policy_updated_at && (
          <span className="text-[11px] text-[#9ca3af] ml-auto">
            Dernière sauvegarde {new Date(settings.discount_policy_updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <AnimatePresence>
        {policyTestState === 'success' && policyTestResult && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 p-4 rounded-xl bg-cta/5 border border-cta/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-cta flex-shrink-0" />
              <span className="text-[14px] font-bold text-[#1a1a1a]">
                L'agent proposera <span className="text-cta">{policyTestResult.decision?.discount_pct ?? 0}% de remise</span>
              </span>
            </div>
            <p className="text-[12px] text-[#71717a] leading-relaxed pl-6">
              Pour ce scénario (panier {policyMockCart}€, CLV {policyMockClv}€, {policyMockOrders} commande{policyMockOrders > 1 ? 's' : ''}), la règle <span className="font-mono text-[#1a1a1a]">{policyTestResult.decision?.reason || '—'}</span> s'applique.
            </p>
            {policyTestResult.decision?.capped_at != null && policyTestResult.decision.discount_pct === policyTestResult.decision.capped_at && policyTestResult.decision.discount_pct > 0 && (
              <p className="text-[11px] text-amber-700 pl-6 mt-1">
                ⚠️ Plafond {policyTestResult.decision.capped_at}% atteint — la règle voulait peut-être plus mais on protège ta marge.
              </p>
            )}
            <p className="text-[10px] text-[#9ca3af] pl-6 mt-2">
              Décision calculée en {policyTestResult.duration_ms} ms · trace dans agent_action_logs · sandbox {(policyTestResult.sandbox_id || '—').slice(0, 12)}
            </p>
          </motion.div>
        )}
        {policyTestState === 'error' && policyTestResult && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 p-4 rounded-xl bg-red-50/60 border border-red-100">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-[13px] font-semibold text-red-800">La règle a échoué</span>
            </div>
            <div className="text-[12px] text-red-700 leading-relaxed pl-6">
              {policyTestResult.decision?.detail || policyTestResult.error || 'Erreur inconnue.'}
            </div>
            {policyTestResult.decision?.trace && (
              <div className="text-[11px] text-red-600/80 mt-2 pl-6 font-mono whitespace-pre-wrap">
                {policyTestResult.decision.trace.join('\n')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 pt-4 border-t border-[#f3f3ed]">
        <button
          type="button"
          onClick={() => setPolicyShowCode((v) => !v)}
          className="flex items-center gap-2 text-[12px] font-semibold text-[#71717a] hover:text-[#1a1a1a]"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${policyShowCode ? 'rotate-90' : ''}`} />
          Mode avancé — édition du code Python (CTO / dev)
        </button>
        {policyShowCode && (
          <div className="mt-3">
            <p className="text-[11px] text-[#71717a] mb-2">
              La règle est une fonction <code className="px-1 py-0.5 rounded bg-[#f5f5f5] font-mono text-[10px]">decide_discount(cart, customer, policy_caps)</code> exécutée dans un sandbox isolé E2B à chaque appel. Tu peux y mettre n'importe quelle logique conditionnelle Python. Le plafond ci-dessus s'applique <em>après</em> ton retour, donc une coquille ne peut jamais dépasser ta marge.
            </p>
            <textarea
              value={policyCode}
              onChange={(e) => { setPolicyCode(e.target.value); setPolicyDirty(true) }}
              spellCheck={false}
              rows={14}
              className="w-full font-mono text-[12px] leading-relaxed rounded-xl border border-[#E5E2D7] bg-[#fafaf7] p-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta/40"
            />
            {policyDirty && (
              <div className="mt-1 text-[11px] text-amber-700">
                Modifications non sauvegardées — clique sur « Sauvegarder ces règles » plus haut.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
