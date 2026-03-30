import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FileText, Mail, CreditCard, Download, Rocket, CheckCircle2,
  ArrowRight, Clock, User
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STAGES = [
  { id: 'draft', label: 'Brouillon', icon: FileText, iconClass: 'text-gray-400', bgClass: 'bg-gray-500/10 border-gray-500/20', badgeClass: 'bg-gray-500/10 text-gray-400' },
  { id: 'sent', label: 'Email envoyé', icon: Mail, iconClass: 'text-blue-400', bgClass: 'bg-blue-500/10 border-blue-500/20', badgeClass: 'bg-blue-500/10 text-blue-400' },
  { id: 'paid', label: 'Payé', icon: CreditCard, iconClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20', badgeClass: 'bg-emerald-500/10 text-emerald-400' },
  { id: 'app_installed', label: 'App installée', icon: Download, iconClass: 'text-violet-400', bgClass: 'bg-violet-500/10 border-violet-500/20', badgeClass: 'bg-violet-500/10 text-violet-400' },
  { id: 'deployed', label: 'Workflow déployé', icon: Rocket, iconClass: 'text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/20', badgeClass: 'bg-amber-500/10 text-amber-400' },
  { id: 'live', label: 'Live', icon: CheckCircle2, iconClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20', badgeClass: 'bg-emerald-500/10 text-emerald-400' },
]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

export const AdminPipelineView = () => {
  const { data: funnelClients = [] } = useQuery({
    queryKey: ['pipeline-funnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_clients')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['pipeline-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, brand_name, status, created_at, client_type')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: shopifyConnections = [] } = useQuery({
    queryKey: ['pipeline-shopify'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shopify_connections')
        .select('client_id, shop_domain, created_at')
      if (error) throw error
      return data || []
    },
  })

  const { data: deployments = [] } = useQuery({
    queryKey: ['pipeline-deployments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployment_requests')
        .select('client_id, status, created_at')
      if (error) throw error
      return data || []
    },
  })

  // Build pipeline entries
  const pipelineEntries = funnelClients.map(fc => {
    const client = clients.find(c => c.id === fc.onboarded_client_id)
    const hasShopify = client ? shopifyConnections.some(s => s.client_id === client.id) : false
    const deployment = client ? deployments.find(d => d.client_id === client.id) : null

    let stage = fc.status || 'draft'
    if (stage === 'paid' && client) {
      if (deployment?.status === 'deployed') stage = 'live'
      else if (deployment) stage = 'deployed'
      else if (hasShopify) stage = 'app_installed'
    }

    return {
      id: fc.id,
      company_name: fc.company_name,
      email: fc.email,
      client_type: fc.client_type,
      stage,
      created_at: fc.created_at,
      setup_price: fc.setup_price,
      monthly_price: fc.monthly_price,
      client,
    }
  })

  // Group by stage
  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.id] = pipelineEntries.filter(e => e.stage === stage.id)
    return acc
  }, {})

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-white">Pipeline Onboarding</h2>
        <p className="text-sm text-gray-500 mt-1">Suivez chaque client de la prospection au go-live</p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STAGES.map((stage, i) => {
          const count = grouped[stage.id]?.length || 0
          const StageIcon = stage.icon
          return (
            <React.Fragment key={stage.id}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap ${stage.bgClass}`}>
                <StageIcon className={`w-3.5 h-3.5 ${stage.iconClass}`} />
                <span className={`text-xs font-bold ${stage.iconClass}`}>{count}</span>
                <span className="text-[10px] text-gray-400">{stage.label}</span>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map(stage => {
          const items = grouped[stage.id] || []
          const StageIcon = stage.icon
          return (
            <div key={stage.id} className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <StageIcon className={`w-4 h-4 ${stage.iconClass}`} />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stage.label}</span>
                {items.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stage.badgeClass}`}>
                    {items.length}
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <div className="bg-[#0E1424] rounded-xl border border-white/5 p-4 text-center">
                  <p className="text-[10px] text-gray-600">Aucun</p>
                </div>
              ) : (
                items.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-[#0E1424] rounded-xl border border-white/10 p-3 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-3 h-3 text-gray-500" />
                      <p className="text-xs font-bold text-white truncate">{entry.company_name}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{entry.email}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-600 capitalize">{entry.client_type || 'ecommerce'}</span>
                      <span className="text-[10px] text-gray-600">{timeAgo(entry.created_at)}</span>
                    </div>
                    {entry.monthly_price && (
                      <div className="mt-2 text-[10px] text-gray-500">
                        {entry.setup_price}€ + {entry.monthly_price}€/mois
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
