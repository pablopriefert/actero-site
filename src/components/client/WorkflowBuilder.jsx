import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, Trash2, CheckCircle2, Loader2,
  ArrowDown, Mail, ShoppingBag, Headphones, MessageSquare,
  AlertTriangle, Heart, Search, Tag, Bell, Gift,
  FileText, User, Clock, Sparkles, Play, Pause,
  Settings, ChevronDown, X, Copy, Eye, Globe,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

/* ═══════════ DATA ═══════════ */

const TRIGGERS = [
  { id: 'email_received', label: 'Email recu', icon: Mail, color: 'from-red-500 to-red-600',
    config: [
      { key: 'filter_subject', label: 'Filtrer par sujet (optionnel)', type: 'text', placeholder: 'remboursement, retour...' },
      { key: 'filter_sender', label: 'Filtrer par expediteur (optionnel)', type: 'text', placeholder: '@domain.com' },
    ]},
  { id: 'ticket_gorgias', label: 'Ticket Gorgias', icon: Headphones, color: 'from-gray-700 to-gray-900', config: [] },
  { id: 'ticket_zendesk', label: 'Ticket Zendesk', icon: MessageSquare, color: 'from-teal-600 to-teal-800', config: [] },
  { id: 'widget_message', label: 'Message widget', icon: Globe, color: 'from-blue-500 to-blue-700', config: [] },
  { id: 'shopify_order', label: 'Commande Shopify', icon: ShoppingBag, color: 'from-green-500 to-green-700',
    config: [
      { key: 'min_amount', label: 'Montant minimum (optionnel)', type: 'number', placeholder: '50', unit: '€' },
    ]},
  { id: 'abandoned_cart', label: 'Panier abandonne', icon: ShoppingBag, color: 'from-amber-500 to-amber-700',
    config: [
      { key: 'delay_minutes', label: 'Delai avant declenchement', type: 'select', options: ['30 min', '1 heure', '2 heures', '4 heures', '24 heures'] },
    ]},
  { id: 'keyword_detected', label: 'Mot-cle detecte', icon: Search, color: 'from-violet-500 to-violet-700',
    config: [
      { key: 'keywords', label: 'Mots-cles (separes par des virgules)', type: 'text', placeholder: 'remboursement, avocat, plainte', required: true },
    ]},
  { id: 'negative_sentiment', label: 'Sentiment negatif', icon: Heart, color: 'from-pink-500 to-pink-700',
    config: [
      { key: 'threshold', label: 'Seuil de sentiment', type: 'select', options: ['Tres negatif (< 2/10)', 'Negatif (< 4/10)', 'Neutre ou moins (< 6/10)'] },
    ]},
  { id: 'schedule', label: 'Planifie (cron)', icon: Clock, color: 'from-indigo-500 to-indigo-700',
    config: [
      { key: 'frequency', label: 'Frequence', type: 'select', options: ['Toutes les heures', 'Tous les jours a 9h', 'Tous les lundis', 'Le 1er du mois'], required: true },
    ]},
]

const CONDITIONS = [
  { id: 'order_value', label: 'Valeur commande', icon: ShoppingBag,
    config: [
      { key: 'operator', type: 'select', options: ['>', '<', '>=', '<=', '='] },
      { key: 'value', type: 'number', placeholder: '200', unit: '€' },
    ]},
  { id: 'customer_type', label: 'Type de client', icon: User,
    config: [
      { key: 'type', type: 'select', options: ['Nouveau (1ere commande)', 'Regulier (2-5 commandes)', 'Fidele (5+ commandes)', 'VIP (10+ commandes)'] },
    ]},
  { id: 'sentiment', label: 'Score sentiment', icon: Heart,
    config: [
      { key: 'operator', type: 'select', options: ['<', '<=', '>', '>='] },
      { key: 'value', type: 'number', placeholder: '3', unit: '/10' },
    ]},
  { id: 'keyword', label: 'Message contient', icon: Search,
    config: [
      { key: 'keywords', type: 'text', placeholder: 'urgent, plainte, avocat' },
    ]},
  { id: 'time_range', label: 'Plage horaire', icon: Clock,
    config: [
      { key: 'start', type: 'select', options: ['0h', '6h', '7h', '8h', '9h', '10h', '12h', '14h', '18h', '20h', '22h'] },
      { key: 'end', type: 'select', options: ['6h', '7h', '8h', '9h', '12h', '14h', '18h', '19h', '20h', '22h', '23h59'] },
    ]},
  { id: 'language', label: 'Langue du message', icon: Globe,
    config: [
      { key: 'lang', type: 'select', options: ['Francais', 'Anglais', 'Espagnol', 'Allemand', 'Autre'] },
    ]},
  { id: 'channel', label: 'Canal d\'origine', icon: MessageSquare,
    config: [
      { key: 'source', type: 'select', options: ['Email', 'Widget', 'Gorgias', 'Zendesk', 'WhatsApp'] },
    ]},
]

const ACTIONS = [
  { id: 'ai_respond', label: 'Repondre avec l\'IA', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    config: [
      { key: 'tone_override', label: 'Ton specifique (optionnel)', type: 'select', options: ['Utiliser le ton par defaut', 'Formel', 'Chaleureux', 'Empathique', 'Urgent'] },
      { key: 'max_length', label: 'Longueur max de la reponse', type: 'select', options: ['Courte (1-2 phrases)', 'Moyenne (3-4 phrases)', 'Detaillee (5+ phrases)'] },
      { key: 'include_order_data', label: 'Inclure les donnees Shopify', type: 'toggle' },
    ]},
  { id: 'escalate', label: 'Escalader vers humain', icon: User, color: 'bg-red-50 text-red-600 border-red-200',
    config: [
      { key: 'priority', label: 'Priorite', type: 'select', options: ['Normale', 'Haute', 'Urgente'] },
      { key: 'assign_to', label: 'Assigner a (optionnel)', type: 'text', placeholder: 'email@equipe.com' },
      { key: 'include_summary', label: 'Inclure un resume IA du probleme', type: 'toggle' },
    ]},
  { id: 'send_email', label: 'Envoyer un email', icon: Mail, color: 'bg-blue-50 text-blue-600 border-blue-200',
    config: [
      { key: 'subject', label: 'Objet de l\'email', type: 'text', placeholder: 'Merci pour votre commande {{order_id}}' },
      { key: 'body', label: 'Contenu', type: 'textarea', placeholder: 'Bonjour {{customer_name}},\n\nMerci pour votre achat...' },
      { key: 'delay', label: 'Delai avant envoi', type: 'select', options: ['Immediat', 'Apres 30 min', 'Apres 1h', 'Apres 2h', 'Apres 24h', 'Apres 3 jours', 'Apres 7 jours'] },
    ]},
  { id: 'notify_slack', label: 'Notifier sur Slack', icon: Bell, color: 'bg-violet-50 text-violet-600 border-violet-200',
    config: [
      { key: 'message', label: 'Message personnalise (optionnel)', type: 'text', placeholder: 'Nouveau ticket VIP de {{customer_name}}' },
      { key: 'mention', label: 'Mentionner', type: 'select', options: ['Personne', '@channel', '@here', 'Utilisateur specifique'] },
    ]},
  { id: 'add_tag', label: 'Ajouter un tag', icon: Tag, color: 'bg-amber-50 text-amber-600 border-amber-200',
    config: [
      { key: 'tag_name', label: 'Nom du tag', type: 'text', placeholder: 'vip, urgent, a-relancer', required: true },
    ]},
  { id: 'offer_promo', label: 'Proposer un code promo', icon: Gift, color: 'bg-pink-50 text-pink-600 border-pink-200',
    config: [
      { key: 'code', label: 'Code promo', type: 'text', placeholder: 'SORRY10', required: true },
      { key: 'discount', label: 'Reduction', type: 'text', placeholder: '-10%, -5€, livraison gratuite' },
      { key: 'message', label: 'Message accompagnant', type: 'textarea', placeholder: 'En compensation, voici un code promo...' },
    ]},
  { id: 'wait', label: 'Attendre', icon: Clock, color: 'bg-gray-50 text-gray-600 border-gray-200',
    config: [
      { key: 'duration', label: 'Duree d\'attente', type: 'select', options: ['5 min', '15 min', '30 min', '1 heure', '2 heures', '4 heures', '12 heures', '24 heures', '3 jours', '7 jours'], required: true },
    ]},
  { id: 'add_to_kb', label: 'Ajouter a la base de savoir', icon: FileText, color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    config: [
      { key: 'auto', label: 'Ajout automatique apres reponse humaine', type: 'toggle' },
    ]},
  { id: 'send_survey', label: 'Envoyer un sondage', icon: CheckCircle2, color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    config: [
      { key: 'question', label: 'Question', type: 'text', placeholder: 'Comment evaluez-vous notre service ? (1-5)' },
      { key: 'delay', label: 'Delai apres resolution', type: 'select', options: ['Immediat', 'Apres 1h', 'Apres 24h'] },
    ]},
]

const VARIABLES = [
  { tag: '{{customer_name}}', label: 'Nom du client' },
  { tag: '{{customer_email}}', label: 'Email du client' },
  { tag: '{{order_id}}', label: 'Numero de commande' },
  { tag: '{{order_status}}', label: 'Statut commande' },
  { tag: '{{order_total}}', label: 'Montant commande' },
  { tag: '{{brand_name}}', label: 'Nom de votre marque' },
  { tag: '{{agent_name}}', label: 'Nom de l\'agent' },
  { tag: '{{ticket_id}}', label: 'ID du ticket' },
]

const TEMPLATES = [
  {
    id: 'sav_autopilot', name: 'SAV Auto-Pilot',
    desc: 'L\'IA repond automatiquement. Si pas assez confiant, escalade avec contexte.',
    trigger: { type: 'email_received', config: {} },
    conditions: [],
    actions: [
      { type: 'ai_respond', config: { include_order_data: true, tone_override: 'Utiliser le ton par defaut', max_length: 'Moyenne (3-4 phrases)' } },
    ],
  },
  {
    id: 'abandoned_cart', name: 'Relance panier abandonne',
    desc: 'Email de relance personnalise 1h apres un panier abandonne.',
    trigger: { type: 'abandoned_cart', config: { delay_minutes: '1 heure' } },
    conditions: [],
    actions: [
      { type: 'wait', config: { duration: '1 heure' } },
      { type: 'send_email', config: { subject: 'Vous avez oublie quelque chose !', body: 'Bonjour {{customer_name}},\n\nVous avez laisse des articles dans votre panier. Finalisez votre commande avant qu\'ils ne soient plus disponibles !', delay: 'Immediat' } },
    ],
  },
  {
    id: 'vip_alert', name: 'Alerte client VIP',
    desc: 'Notifie Slack et repond en priorite pour les grosses commandes.',
    trigger: { type: 'email_received', config: {} },
    conditions: [{ type: 'order_value', config: { operator: '>', value: '200' } }],
    actions: [
      { type: 'notify_slack', config: { message: 'Client VIP : {{customer_name}} ({{order_total}})', mention: '@channel' } },
      { type: 'ai_respond', config: { tone_override: 'Empathique', include_order_data: true } },
    ],
  },
  {
    id: 'anti_crise', name: 'Anti-crise',
    desc: 'Escalade immediate + notification si un client est tres mecontent.',
    trigger: { type: 'negative_sentiment', config: { threshold: 'Tres negatif (< 2/10)' } },
    conditions: [],
    actions: [
      { type: 'escalate', config: { priority: 'Urgente', include_summary: true } },
      { type: 'notify_slack', config: { message: 'URGENT: Client tres mecontent — {{customer_name}}', mention: '@channel' } },
    ],
  },
  {
    id: 'suivi_commande', name: 'Suivi commande auto',
    desc: 'Detecte les questions de suivi et repond avec les donnees Shopify.',
    trigger: { type: 'keyword_detected', config: { keywords: 'commande, suivi, colis, livraison, expedition, tracking' } },
    conditions: [],
    actions: [
      { type: 'ai_respond', config: { include_order_data: true, max_length: 'Detaillee (5+ phrases)' } },
    ],
  },
]

/* ═══════════ MAIN COMPONENT ═══════════ */

export const WorkflowBuilder = ({ clientId, theme }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['client-workflows', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_workflows')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!clientId,
  })

  const handleCreateFromTemplate = async (template) => {
    await supabase.from('client_workflows').insert({
      client_id: clientId,
      name: template.name,
      is_active: true,
      trigger_type: template.trigger.type,
      trigger_config: template.trigger.config,
      conditions: template.conditions,
      actions: template.actions,
      template_id: template.id,
    })
    queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
    toast.success(`"${template.name}" cree et active`)
  }

  const handleToggle = async (id, active) => {
    await supabase.from('client_workflows').update({ is_active: !active, updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
  }

  const handleDelete = async (id) => {
    await supabase.from('client_workflows').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
    toast.success('Workflow supprime')
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#262626]">Workflows</h2>
        <p className="text-sm text-[#716D5C] mt-1">Creez des automatisations pour que votre agent IA agisse au bon moment.</p>
      </div>

      {/* Templates */}
      <div>
        <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">Demarrer avec un modele</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map(tpl => {
            const trigger = TRIGGERS.find(t => t.id === tpl.trigger.type)
            const TIcon = trigger?.icon || Zap
            const exists = workflows.some(w => w.template_id === tpl.id)
            return (
              <button
                key={tpl.id}
                onClick={() => !exists && handleCreateFromTemplate(tpl)}
                disabled={exists}
                className={`p-4 rounded-xl border-2 text-left transition-all ${exists ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 hover:border-[#0F5F35] hover:shadow-sm'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br ${trigger?.color || 'from-gray-400 to-gray-600'}`}>
                    <TIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-sm text-[#262626]">{tpl.name}</span>
                  {exists && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
                </div>
                <p className="text-xs text-[#716D5C] mb-2">{tpl.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {tpl.actions.map((a, i) => {
                    const act = ACTIONS.find(ac => ac.id === a.type)
                    return act ? (
                      <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${act.color}`}>{act.label}</span>
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
          <p className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">Mes workflows ({workflows.length})</p>
          <div className="space-y-2">
            {workflows.map(wf => {
              const trigger = TRIGGERS.find(t => t.id === wf.trigger_type)
              const TIcon = trigger?.icon || Zap
              return (
                <div key={wf.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${trigger?.color || 'from-gray-400 to-gray-600'}`}>
                    <TIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[#262626]">{wf.name}</p>
                      {wf.is_active && <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full"><Play className="w-3 h-3" /> Actif</span>}
                    </div>
                    <p className="text-xs text-[#716D5C]">
                      {trigger?.label}
                      {wf.conditions?.length > 0 && ` + ${wf.conditions.length} condition${wf.conditions.length > 1 ? 's' : ''}`}
                      → {(wf.actions || []).map(a => ACTIONS.find(ac => ac.id === a.type)?.label || a.type).join(' → ')}
                    </p>
                  </div>
                  {wf.executions_count > 0 && <span className="text-xs text-[#716D5C] bg-[#F9F7F1] px-2 py-1 rounded-lg">{wf.executions_count}x</span>}
                  <button onClick={() => handleToggle(wf.id, wf.is_active)} className={`relative w-11 h-6 rounded-full transition-colors ${wf.is_active ? 'bg-[#0F5F35]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wf.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => handleDelete(wf.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom builder */}
      <div>
        {!creating ? (
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 text-sm font-bold text-[#0F5F35] hover:underline">
            <Plus className="w-4 h-4" /> Creer un workflow personnalise
          </button>
        ) : (
          <AdvancedWorkflowForm
            clientId={clientId}
            onSave={() => {
              setCreating(false)
              queryClient.invalidateQueries({ queryKey: ['client-workflows', clientId] })
              toast.success('Workflow cree')
            }}
            onCancel={() => setCreating(false)}
          />
        )}
      </div>

      {workflows.length === 0 && !isLoading && !creating && (
        <div className="text-center py-8 text-[#716D5C]">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun workflow actif. Choisissez un modele ou creez le votre.</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════ ADVANCED FORM ═══════════ */

const AdvancedWorkflowForm = ({ clientId, onSave, onCancel }) => {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState(null)
  const [triggerConfig, setTriggerConfig] = useState({})
  const [conditions, setConditions] = useState([])
  const [actions, setActions] = useState([])
  const [showVars, setShowVars] = useState(false)
  const [saving, setSaving] = useState(false)

  const addCondition = () => setConditions(c => [...c, { type: '', config: {} }])
  const removeCondition = (i) => setConditions(c => c.filter((_, idx) => idx !== i))
  const updateCondition = (i, field, val) => {
    setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, [field]: val } : cond))
  }
  const updateConditionConfig = (i, key, val) => {
    setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, config: { ...cond.config, [key]: val } } : cond))
  }

  const addAction = () => setActions(a => [...a, { type: '', config: {} }])
  const removeAction = (i) => setActions(a => a.filter((_, idx) => idx !== i))
  const updateAction = (i, field, val) => {
    setActions(a => a.map((act, idx) => idx === i ? { ...act, [field]: val } : act))
  }
  const updateActionConfig = (i, key, val) => {
    setActions(a => a.map((act, idx) => idx === i ? { ...act, config: { ...act.config, [key]: val } } : act))
  }

  const handleSave = async () => {
    if (!name.trim() || !trigger || actions.length === 0) return
    setSaving(true)
    await supabase.from('client_workflows').insert({
      client_id: clientId,
      name: name.trim(),
      is_active: true,
      trigger_type: trigger,
      trigger_config: triggerConfig,
      conditions: conditions.filter(c => c.type),
      actions: actions.filter(a => a.type),
    })
    setSaving(false)
    onSave()
  }

  const selectedTrigger = TRIGGERS.find(t => t.id === trigger)
  const inputCls = "w-full px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm text-[#262626] outline-none focus:ring-1 focus:ring-[#0F5F35]/30"
  const selectCls = "px-3 py-2 bg-[#F9F7F1] border border-gray-200 rounded-lg text-sm text-[#262626] outline-none"

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-5 bg-gradient-to-r from-[#003725] to-[#0F5F35]">
        <h3 className="text-white font-bold">Nouveau workflow</h3>
        <p className="text-white/60 text-xs mt-0.5">Configurez chaque etape de votre automatisation</p>
      </div>

      <div className="p-5 space-y-6">
        {/* Name */}
        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">Nom</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon workflow" className={`mt-1 ${inputCls}`} />
        </div>

        {/* Variables helper */}
        <div>
          <button onClick={() => setShowVars(!showVars)} className="text-xs text-[#0F5F35] font-bold flex items-center gap-1 hover:underline">
            <Copy className="w-3 h-3" /> Variables disponibles
          </button>
          {showVars && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button key={v.tag} onClick={() => navigator.clipboard.writeText(v.tag)} className="px-2 py-1 bg-[#F9F7F1] rounded text-[10px] font-mono text-[#262626] hover:bg-gray-200 transition-colors" title={v.label}>
                  {v.tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ TRIGGER ═══ */}
        <div>
          <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3" /> Declencheur
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {TRIGGERS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => { setTrigger(t.id); setTriggerConfig({}) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${trigger === t.id ? 'border-[#0F5F35] bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br ${t.color} mb-1.5`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-xs font-bold text-[#262626]">{t.label}</p>
                </button>
              )
            })}
          </div>
          {/* Trigger config */}
          {selectedTrigger?.config?.length > 0 && (
            <div className="mt-3 p-3 bg-[#F9F7F1] rounded-xl space-y-2">
              {selectedTrigger.config.map(field => (
                <ConfigField key={field.key} field={field} value={triggerConfig[field.key] || ''} onChange={(val) => setTriggerConfig(c => ({ ...c, [field.key]: val }))} />
              ))}
            </div>
          )}
        </div>

        {/* ═══ Arrow ═══ */}
        {trigger && (
          <div className="flex justify-center"><ArrowDown className="w-5 h-5 text-[#716D5C]" /></div>
        )}

        {/* ═══ CONDITIONS ═══ */}
        {trigger && (
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3 h-3" /> Conditions (optionnel)
            </label>
            {conditions.map((cond, i) => {
              const condDef = CONDITIONS.find(c => c.id === cond.type)
              return (
                <div key={i} className="mt-2 p-3 bg-[#F9F7F1] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {i > 0 && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">ET</span>}
                    <select value={cond.type} onChange={(e) => updateCondition(i, 'type', e.target.value)} className={`flex-1 ${selectCls}`}>
                      <option value="">Choisir une condition...</option>
                      {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button onClick={() => removeCondition(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                  {condDef?.config && (
                    <div className="flex flex-wrap gap-2">
                      {condDef.config.map(f => (
                        <ConfigField key={f.key} field={f} value={cond.config?.[f.key] || ''} onChange={(val) => updateConditionConfig(i, f.key, val)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={addCondition} className="mt-2 text-xs font-bold text-violet-600 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ajouter une condition
            </button>
          </div>
        )}

        {/* ═══ Arrow ═══ */}
        {trigger && (
          <div className="flex justify-center"><ArrowDown className="w-5 h-5 text-[#716D5C]" /></div>
        )}

        {/* ═══ ACTIONS ═══ */}
        {trigger && (
          <div>
            <label className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Actions (dans l'ordre)
            </label>
            {actions.map((act, i) => {
              const actDef = ACTIONS.find(a => a.id === act.type)
              const ActIcon = actDef?.icon || Zap
              return (
                <div key={i} className="mt-2">
                  {i > 0 && <div className="flex justify-center my-1"><ArrowDown className="w-4 h-4 text-gray-300" /></div>}
                  <div className={`p-3 rounded-xl border ${actDef ? actDef.color : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-[#716D5C] bg-white/80 px-2 py-0.5 rounded-full">Etape {i + 1}</span>
                      <select value={act.type} onChange={(e) => updateAction(i, 'type', e.target.value)} className={`flex-1 ${selectCls}`}>
                        <option value="">Choisir une action...</option>
                        {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                      <button onClick={() => removeAction(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                    {actDef?.config && (
                      <div className="space-y-2">
                        {actDef.config.map(f => (
                          <ConfigField key={f.key} field={f} value={act.config?.[f.key] || ''} onChange={(val) => updateActionConfig(i, f.key, val)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <button onClick={addAction} className="mt-2 text-xs font-bold text-[#0F5F35] hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ajouter une action
            </button>
          </div>
        )}

        {/* Save */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={!name.trim() || !trigger || actions.filter(a => a.type).length === 0 || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white text-sm font-bold rounded-xl hover:bg-[#003725] disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Creer le workflow
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 text-sm text-[#716D5C] hover:text-[#262626]">Annuler</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════ CONFIG FIELD ═══════════ */

const ConfigField = ({ field, value, onChange }) => {
  const baseCls = "px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#262626] outline-none focus:ring-1 focus:ring-[#0F5F35]/30"

  if (field.type === 'select') {
    return (
      <div className="flex-1 min-w-[120px]">
        {field.label && <label className="text-[10px] text-[#716D5C] block mb-0.5">{field.label}</label>}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full ${baseCls}`}>
          <option value="">Choisir...</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="w-full">
        {field.label && <label className="text-[10px] text-[#716D5C] block mb-0.5">{field.label}</label>}
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder}
          className={`w-full ${baseCls} resize-y`} />
      </div>
    )
  }

  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between w-full">
        <label className="text-xs text-[#262626]">{field.label}</label>
        <button onClick={() => onChange(!value)}
          className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[#0F5F35]' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-[120px]">
      {field.label && <label className="text-[10px] text-[#716D5C] block mb-0.5">{field.label}</label>}
      <div className="flex items-center gap-1">
        <input type={field.type || 'text'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder} className={`flex-1 ${baseCls}`} />
        {field.unit && <span className="text-xs text-[#716D5C]">{field.unit}</span>}
      </div>
    </div>
  )
}
