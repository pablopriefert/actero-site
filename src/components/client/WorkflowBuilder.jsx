import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, Trash2, CheckCircle2, XCircle, Loader2,
  ArrowRight, Mail, ShoppingBag, Headphones, MessageSquare,
  AlertTriangle, Heart, Search, Tag, Bell, Gift,
  FileText, User, Clock, Sparkles, Play, Pause,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const TRIGGERS = [
  { id: 'email_received', label: 'Email recu', icon: Mail, desc: 'Un email client arrive dans Gmail' },
  { id: 'ticket_gorgias', label: 'Ticket Gorgias', icon: Headphones, desc: 'Un nouveau ticket est cree dans Gorgias' },
  { id: 'ticket_zendesk', label: 'Ticket Zendesk', icon: MessageSquare, desc: 'Un nouveau ticket arrive dans Zendesk' },
  { id: 'widget_message', label: 'Message widget', icon: Zap, desc: 'Un visiteur envoie un message via le chat' },
  { id: 'shopify_order', label: 'Commande Shopify', icon: ShoppingBag, desc: 'Une nouvelle commande est creee' },
  { id: 'abandoned_cart', label: 'Panier abandonne', icon: ShoppingBag, desc: 'Un panier est abandonne depuis plus d\'1h' },
  { id: 'keyword_detected', label: 'Mot-cle detecte', icon: Search, desc: 'Un mot-cle specifique est detecte dans un message' },
  { id: 'negative_sentiment', label: 'Sentiment negatif', icon: Heart, desc: 'Un message avec un sentiment tres negatif est detecte' },
]

const CONDITIONS = [
  { id: 'order_value', label: 'Valeur commande', operators: ['>', '<', '>='], unit: '€' },
  { id: 'customer_type', label: 'Type de client', options: ['Nouveau', 'Fidele', 'VIP'] },
  { id: 'sentiment_score', label: 'Score sentiment', operators: ['<', '<='], unit: '/10' },
  { id: 'keyword', label: 'Contient le mot', placeholder: 'remboursement, avocat...' },
  { id: 'time_range', label: 'Horaire', placeholder: '9h-18h' },
]

const ACTIONS = [
  { id: 'ai_respond', label: 'Repondre avec l\'IA', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'escalate', label: 'Escalader vers humain', icon: User, color: 'bg-red-50 text-red-600' },
  { id: 'send_email', label: 'Envoyer un email', icon: Mail, color: 'bg-blue-50 text-blue-600' },
  { id: 'notify_slack', label: 'Notifier sur Slack', icon: Bell, color: 'bg-violet-50 text-violet-600' },
  { id: 'add_tag', label: 'Ajouter un tag', icon: Tag, color: 'bg-amber-50 text-amber-600' },
  { id: 'offer_promo', label: 'Proposer un code promo', icon: Gift, color: 'bg-pink-50 text-pink-600' },
  { id: 'create_ticket', label: 'Creer un ticket', icon: FileText, color: 'bg-cyan-50 text-cyan-600' },
]

const TEMPLATES = [
  {
    id: 'sav_autopilot',
    name: 'SAV Auto-Pilot',
    desc: 'L\'IA repond automatiquement. Si pas assez confiant, escalade vers un humain.',
    trigger: 'email_received',
    conditions: [],
    actions: [{ type: 'ai_respond' }, { type: 'escalate', config: { condition: 'confidence < 70%' } }],
  },
  {
    id: 'abandoned_cart',
    name: 'Relance panier abandonne',
    desc: 'Envoie un email de relance 1h apres un panier abandonne.',
    trigger: 'abandoned_cart',
    conditions: [],
    actions: [{ type: 'send_email', config: { delay: '1h', template: 'relance' } }],
  },
  {
    id: 'vip_alert',
    name: 'Alerte client VIP',
    desc: 'Notifie Slack et repond en priorite pour les grosses commandes.',
    trigger: 'email_received',
    conditions: [{ type: 'order_value', operator: '>', value: '200' }],
    actions: [{ type: 'notify_slack' }, { type: 'ai_respond' }],
  },
  {
    id: 'anti_crise',
    name: 'Anti-crise',
    desc: 'Escalade immediate et notification si un client est tres mecontent.',
    trigger: 'negative_sentiment',
    conditions: [{ type: 'sentiment_score', operator: '<', value: '3' }],
    actions: [{ type: 'escalate' }, { type: 'notify_slack' }],
  },
  {
    id: 'suivi_commande',
    name: 'Suivi commande auto',
    desc: 'Detecte "commande" ou "suivi" et repond avec le statut Shopify.',
    trigger: 'keyword_detected',
    conditions: [{ type: 'keyword', value: 'commande, suivi, colis, livraison' }],
    actions: [{ type: 'ai_respond' }],
  },
]

export const WorkflowBuilder = ({ clientId, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Fetch workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['client-workflows', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_workflows')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const handleCreateFromTemplate = async (template) => {
    try {
      await supabase.from('client_workflows').insert({
        client_id: clientId,
        name: template.name,
        is_active: true,
        trigger_type: template.trigger,
        trigger_config: {},
        conditions: template.conditions,
        actions: template.actions,
        template_id: template.id,
      })
      queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
      toast.success(`Workflow "${template.name}" cree et active`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggle = async (id, currentActive) => {
    await supabase.from('client_workflows').update({
      is_active: !currentActive,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
    toast.success(!currentActive ? 'Workflow active' : 'Workflow desactive')
  }

  const handleDelete = async (id) => {
    await supabase.from('client_workflows').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
    toast.success('Workflow supprime')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#262626]">Workflows</h2>
        <p className="text-sm text-[#716D5C] mt-1">Creez des automatisations pour que votre agent IA agisse au bon moment.</p>
      </div>

      {/* Templates */}
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Demarrer avec un modele
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map(template => {
            const trigger = TRIGGERS.find(t => t.id === template.trigger)
            const TriggerIcon = trigger?.icon || Zap
            const alreadyCreated = workflows.some(w => w.template_id === template.id)
            return (
              <button
                key={template.id}
                onClick={() => !alreadyCreated && handleCreateFromTemplate(template)}
                disabled={alreadyCreated}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  alreadyCreated
                    ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                    : 'border-gray-100 hover:border-[#0F5F35] hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TriggerIcon className="w-4 h-4 text-[#0F5F35]" />
                  <span className="font-bold text-sm text-[#262626]">{template.name}</span>
                  {alreadyCreated && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
                </div>
                <p className="text-xs text-[#716D5C]">{template.desc}</p>
                <div className="flex gap-1 mt-2">
                  {template.actions.map((a, i) => {
                    const action = ACTIONS.find(ac => ac.id === a.type)
                    return action ? (
                      <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${action.color}`}>
                        {action.label}
                      </span>
                    ) : null
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active workflows */}
      {workflows.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
            Mes workflows ({workflows.length})
          </p>
          <div className="space-y-2">
            {workflows.map(wf => {
              const trigger = TRIGGERS.find(t => t.id === wf.trigger_type)
              const TriggerIcon = trigger?.icon || Zap
              return (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wf.is_active ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    <TriggerIcon className={`w-5 h-5 ${wf.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm ${wf.is_active ? 'text-[#262626]' : 'text-[#716D5C]'}`}>{wf.name}</p>
                      {wf.is_active && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">
                          <Play className="w-3 h-3" /> Actif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#716D5C]">
                      {trigger?.label || wf.trigger_type}
                      {wf.actions?.length > 0 && ` → ${wf.actions.map(a => ACTIONS.find(ac => ac.id === a.type)?.label || a.type).join(', ')}`}
                    </p>
                  </div>
                  {wf.executions_count > 0 && (
                    <span className="text-xs text-[#716D5C] bg-[#F9F7F1] px-2 py-1 rounded-lg">
                      {wf.executions_count}x
                    </span>
                  )}
                  <button
                    onClick={() => handleToggle(wf.id, wf.is_active)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${wf.is_active ? 'bg-[#0F5F35]' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wf.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(wf.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom workflow builder */}
      <div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 text-sm font-bold text-[#0F5F35] hover:underline"
        >
          <Plus className="w-4 h-4" />
          Creer un workflow personnalise
        </button>

        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <CustomWorkflowForm
                clientId={clientId}
                onSave={() => {
                  setCreating(false)
                  queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
                  toast.success('Workflow cree')
                }}
                onCancel={() => setCreating(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {workflows.length === 0 && !isLoading && (
        <div className="text-center py-8 text-[#716D5C]">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun workflow actif. Choisissez un modele ci-dessus pour demarrer.</p>
        </div>
      )}
    </div>
  )
}

const CustomWorkflowForm = ({ clientId, onSave, onCancel }) => {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [selectedActions, setSelectedActions] = useState([])
  const [saving, setSaving] = useState(false)

  const toggleAction = (actionId) => {
    setSelectedActions(prev =>
      prev.includes(actionId) ? prev.filter(a => a !== actionId) : [...prev, actionId]
    )
  }

  const handleSave = async () => {
    if (!name.trim() || !trigger || selectedActions.length === 0) return
    setSaving(true)
    try {
      await supabase.from('client_workflows').insert({
        client_id: clientId,
        name: name.trim(),
        is_active: true,
        trigger_type: trigger,
        conditions: [],
        actions: selectedActions.map(a => ({ type: a })),
      })
      onSave()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
      {/* Name */}
      <div>
        <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">Nom du workflow</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mon workflow personnalise"
          className="mt-1 w-full px-4 py-2.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm outline-none"
        />
      </div>

      {/* Trigger */}
      <div>
        <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">Declencheur</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {TRIGGERS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTrigger(t.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  trigger === t.id ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 text-[#0F5F35] mb-1" />
                <p className="text-xs font-bold text-[#262626]">{t.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Arrow */}
      {trigger && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-200" />
          <ArrowRight className="w-5 h-5 text-[#716D5C]" />
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Actions */}
      {trigger && (
        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">Actions (choisir 1 ou plus)</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {ACTIONS.map(a => {
              const Icon = a.icon
              const selected = selectedActions.includes(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAction(a.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selected ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <p className="text-xs font-bold text-[#262626]">{a.label}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!name.trim() || !trigger || selectedActions.length === 0 || saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white text-sm font-bold rounded-xl hover:bg-[#003725] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Creer le workflow
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 text-sm text-[#716D5C] hover:text-[#262626]">Annuler</button>
      </div>
    </div>
  )
}
