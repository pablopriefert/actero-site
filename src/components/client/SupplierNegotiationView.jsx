import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Handshake, FileText, TrendingUp, CheckCircle2, Clock,
  AlertTriangle, Mail, ChevronRight, Edit3, Send, Shield,
  ToggleLeft, ToggleRight, Euro, Package, Truck, Receipt
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const MOCK_DISPUTES = [
  {
    id: 1,
    supplier: 'TransExpress',
    issue: 'Retard livraison',
    issueIcon: Truck,
    status: 'En cours',
    statusColor: 'bg-amber-100 text-amber-700',
    amount: 1250,
    action: 'Email de reclamation envoye le 03/04',
    step: 2,
    date: '2026-04-02',
  },
  {
    id: 2,
    supplier: 'PackagePro',
    issue: 'Produit endommage',
    issueIcon: Package,
    status: 'Brouillon envoye',
    statusColor: 'bg-blue-100 text-blue-700',
    amount: 890,
    action: 'Relance prevue le 08/04',
    step: 1,
    date: '2026-04-01',
  },
  {
    id: 3,
    supplier: 'LogiStock',
    issue: 'Surfacturation',
    issueIcon: Receipt,
    status: 'Reponse recue',
    statusColor: 'bg-purple-100 text-purple-700',
    amount: 620,
    action: 'Avoir partiel propose — en attente de validation',
    step: 3,
    date: '2026-03-28',
  },
  {
    id: 4,
    supplier: 'ExpediPlus',
    issue: 'Rupture stock',
    issueIcon: AlertTriangle,
    status: 'Resolu',
    statusColor: 'bg-green-100 text-green-700',
    amount: 1490,
    action: 'Avoir de 1 490 € obtenu le 05/04',
    step: 4,
    date: '2026-03-25',
  },
  {
    id: 5,
    supplier: 'FourniRapid',
    issue: 'Retard livraison',
    issueIcon: Truck,
    status: 'En cours',
    statusColor: 'bg-amber-100 text-amber-700',
    amount: 340,
    action: 'Premiere relance envoyee le 06/04',
    step: 2,
    date: '2026-04-05',
  },
]

const STEPS = ['Detection', 'Reclamation', 'Negociation', 'Resolution']

const TEMPLATES = [
  { id: 1, title: 'Reclamation standard', description: 'Signalement initial d\'un litige fournisseur' },
  { id: 2, title: 'Relance apres silence', description: 'Suivi sans reponse sous 5 jours' },
  { id: 3, title: 'Demande d\'avoir', description: 'Demande formelle de credit ou remboursement' },
]

const STATS = [
  { label: 'Litiges en cours', value: '8', icon: AlertTriangle, color: 'text-amber-600' },
  { label: 'Resolus ce mois', value: '23', icon: CheckCircle2, color: 'text-green-600' },
  { label: 'Economies realisees', value: '4 250 €', icon: Euro, color: 'text-[#0F5F35]' },
  { label: 'Taux de succes', value: '87%', icon: TrendingUp, color: 'text-[#0F5F35]' },
]

const ProgressSteps = ({ currentStep }) => (
  <div className="flex items-center gap-1 mt-3">
    {STEPS.map((step, i) => (
      <React.Fragment key={step}>
        <div className="flex flex-col items-center">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
              i < currentStep
                ? 'bg-[#0F5F35] text-white'
                : i === currentStep
                ? 'bg-[#0F5F35]/20 text-[#0F5F35] ring-2 ring-[#0F5F35]'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i < currentStep ? '✓' : i + 1}
          </div>
          <span className="text-[9px] text-[#716D5C] mt-1 whitespace-nowrap">{step}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div
            className={`flex-1 h-0.5 mb-4 ${
              i < currentStep ? 'bg-[#0F5F35]' : 'bg-gray-200'
            }`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
)

export function SupplierNegotiationView({ clientId, theme }) {
  const toast = useToast()
  const [autoDetect, setAutoDetect] = useState(true)
  const [autoSend, setAutoSend] = useState(false)
  const [tone, setTone] = useState('Diplomatique')
  const [expandedDispute, setExpandedDispute] = useState(null)

  // Fetch real disputes from Supabase
  const { data: realDisputes = [] } = useQuery({
    queryKey: ['supplier-disputes', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_disputes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const tones = ['Ferme', 'Diplomatique', 'Escalade']

  const handleToggleAutoDetect = () => {
    setAutoDetect(!autoDetect)
    toast.success(!autoDetect ? 'Detection automatique activee' : 'Detection automatique desactivee')
  }

  const handleToggleAutoSend = () => {
    setAutoSend(!autoSend)
    toast.success(!autoSend
        ? 'Envoi automatique active'
        : 'Envoi automatique desactive'
    )
  }

  const handleToneChange = (newTone) => {
    setTone(newTone)
    toast.success(`Ton des emails : ${newTone}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
          <Handshake className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#262626]">
            Agent de Negociation Fournisseur
          </h2>
          <p className="text-sm text-[#716D5C]">
            Gestion automatisee des litiges et reclamations
          </p>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#262626]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Active Disputes */}
      <div>
        <h3 className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Litiges actifs
        </h3>
        <div className="space-y-3">
          <AnimatePresence>
            {MOCK_DISPUTES.map((dispute, i) => (
              <motion.div
                key={dispute.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  setExpandedDispute(expandedDispute === dispute.id ? null : dispute.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F5F0] flex items-center justify-center mt-0.5">
                      <dispute.issueIcon className="w-4 h-4 text-[#716D5C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#262626] text-sm">
                          {dispute.supplier}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dispute.statusColor}`}
                        >
                          {dispute.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#716D5C] mt-0.5">{dispute.issue}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-semibold text-[#262626]">
                          {dispute.amount.toLocaleString('fr-FR')} €
                        </span>
                        <span className="text-[10px] text-[#716D5C]">
                          en litige
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-[#716D5C] transition-transform ${
                      expandedDispute === dispute.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                <AnimatePresence>
                  {expandedDispute === dispute.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-start gap-2 mb-3">
                          <Mail className="w-3.5 h-3.5 text-[#0F5F35] mt-0.5" />
                          <p className="text-xs text-[#262626]">{dispute.action}</p>
                        </div>
                        <ProgressSteps currentStep={dispute.step} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Configuration */}
      <div>
        <h3 className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Configuration
        </h3>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          {/* Auto detect toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#262626]">
                Detection automatique des anomalies
              </p>
              <p className="text-xs text-[#716D5C] mt-0.5">
                L'IA detecte les ecarts de facturation et retards
              </p>
            </div>
            <button
              onClick={handleToggleAutoDetect}
              className="text-[#0F5F35] hover:opacity-80 transition-opacity"
            >
              {autoDetect ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-300" />
              )}
            </button>
          </div>

          {/* Auto send toggle */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm font-medium text-[#262626]">
                Envoi automatique des reclamations
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3 h-3 text-amber-500" />
                <p className="text-xs text-amber-600">
                  L'IA redige, vous validez avant envoi
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleAutoSend}
              className="text-[#0F5F35] hover:opacity-80 transition-opacity"
            >
              {autoSend ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-300" />
              )}
            </button>
          </div>

          {/* Tone selector */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-[#262626] mb-2">
              Ton des emails
            </p>
            <div className="flex gap-2">
              {tones.map((t) => (
                <button
                  key={t}
                  onClick={() => handleToneChange(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    tone === t
                      ? 'bg-[#0F5F35] text-white shadow-sm'
                      : 'bg-[#F5F5F0] text-[#716D5C] hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div>
        <h3 className="text-[10px] font-bold text-[#716D5C] uppercase tracking-wider mb-3">
          Modeles d'emails
        </h3>
        <div className="space-y-2">
          {TEMPLATES.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex items-center justify-between group hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F5F5F0] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#716D5C]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#262626]">{template.title}</p>
                  <p className="text-xs text-[#716D5C]">{template.description}</p>
                </div>
              </div>
              <button
                className="w-8 h-8 rounded-xl bg-[#F5F5F0] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#0F5F35]/10"
                onClick={() =>
                  toast.info(`Edition du modele : ${template.title}`)
                }
              >
                <Edit3 className="w-3.5 h-3.5 text-[#716D5C]" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
