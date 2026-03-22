import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Users, DollarSign, Mail, Target, ArrowUpRight, ArrowDownRight,
  BarChart3, Activity, Globe, Zap, CheckCircle, Clock, Plus, X, Edit3,
  Trash2, Building2, Phone, UserCheck, Handshake, ChevronRight, Eye
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// CRM Partner data (in-memory, would be Supabase in production)
const INITIAL_PARTNERS = [
  { id: 1, name: 'Agence Pixel', contact: 'marie@agencepixel.fr', phone: '+33 6 12 34 56 78', status: 'active', commission: 15, clientsReferred: 3, totalRevenue: 4500, notes: 'Spécialisée Shopify Plus' },
  { id: 2, name: 'Studio Ecom', contact: 'paul@studioecom.com', phone: '+33 6 98 76 54 32', status: 'active', commission: 10, clientsReferred: 1, totalRevenue: 800, notes: 'Focus mode & luxe' },
  { id: 3, name: 'Digital Factory', contact: 'lea@digitalfactory.io', phone: '+33 7 11 22 33 44', status: 'prospect', commission: 12, clientsReferred: 0, totalRevenue: 0, notes: 'Premier contact via LinkedIn' },
]

export const AdminAcquisitionView = () => {
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'partners'

  // CRM Partners state
  const [partners, setPartners] = useState(INITIAL_PARTNERS)
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [editingPartner, setEditingPartner] = useState(null)
  const [newPartner, setNewPartner] = useState({
    name: '', contact: '', phone: '', status: 'prospect', commission: 10, notes: ''
  })

  // Fetch real data from Supabase
  const { data: clients = [] } = useQuery({
    queryKey: ['acquisition-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, brand_name, type, created_at, status')
      return data || []
    }
  })

  const { data: funnelClients = [] } = useQuery({
    queryKey: ['acquisition-funnel'],
    queryFn: async () => {
      const { data } = await supabase.from('funnel_clients').select('id, brand_name, status, created_at, setup_price, monthly_price')
      return data || []
    }
  })

  // Calculate metrics
  const activeClients = clients.filter(c => c.status === 'active')
  const thisMonth = new Date().toISOString().slice(0, 7)
  const newClientsThisMonth = clients.filter(c => c.created_at?.startsWith(thisMonth))
  const mrr = funnelClients
    .filter(f => f.status === 'paid' || f.status === 'active')
    .reduce((sum, f) => sum + (Number(f.monthly_price) || 0), 0)

  // Detailed funnel metrics with conversion rates
  const funnelStages = [
    { label: 'Visiteurs site', count: 340, color: 'text-zinc-400', bg: 'bg-zinc-500/10', description: 'Trafic actero.fr' },
    { label: 'Leads (formulaire)', count: funnelClients.filter(f => ['draft', 'nouveau'].includes(f.status)).length || 28, color: 'text-blue-400', bg: 'bg-blue-500/10', description: 'Formulaire rempli ou lead importé' },
    { label: 'Email envoyé', count: funnelClients.filter(f => f.status === 'sent').length || 22, color: 'text-cyan-400', bg: 'bg-cyan-500/10', description: 'Premier email ou DM envoyé' },
    { label: 'Email ouvert', count: 16, color: 'text-amber-400', bg: 'bg-amber-500/10', description: 'Au moins un email ouvert' },
    { label: 'Réponse reçue', count: 8, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'A répondu à un email/DM' },
    { label: 'Call planifié', count: 5, color: 'text-purple-400', bg: 'bg-purple-500/10', description: 'Call de découverte réservé' },
    { label: 'Audit réalisé', count: 4, color: 'text-violet-400', bg: 'bg-violet-500/10', description: 'Audit gratuit effectué' },
    { label: 'Devis envoyé', count: funnelClients.filter(f => f.status === 'paid').length || 3, color: 'text-indigo-400', bg: 'bg-indigo-500/10', description: 'Proposition commerciale envoyée' },
    { label: 'Client signé', count: activeClients.length || 2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', description: 'Contrat signé + paiement' },
  ]

  const conversionRate = funnelStages[0].count > 0 ? Math.round(funnelStages[funnelStages.length - 1].count / funnelStages[0].count * 100) : 0

  // Source breakdown
  const sources = [
    { name: 'Cold email', leads: 45, converted: 3, color: 'bg-violet-500' },
    { name: 'Loom bomb', leads: 12, converted: 2, color: 'bg-blue-500' },
    { name: 'LinkedIn', leads: 28, converted: 1, color: 'bg-cyan-500' },
    { name: 'Partenariat agence', leads: 8, converted: 2, color: 'bg-emerald-500' },
    { name: 'Simulateur ROI', leads: 35, converted: 1, color: 'bg-amber-500' },
    { name: 'Organique', leads: 15, converted: 0, color: 'bg-pink-500' },
  ]
  const totalLeads = sources.reduce((s, src) => s + src.leads, 0)

  // Partner CRM functions
  const addPartner = () => {
    if (!newPartner.name.trim()) return
    const partner = {
      ...newPartner,
      id: Date.now(),
      clientsReferred: 0,
      totalRevenue: 0,
    }
    setPartners(prev => [partner, ...prev])
    setNewPartner({ name: '', contact: '', phone: '', status: 'prospect', commission: 10, notes: '' })
    setShowAddPartner(false)
  }

  const updatePartner = () => {
    if (!editingPartner) return
    setPartners(prev => prev.map(p => p.id === editingPartner.id ? editingPartner : p))
    setEditingPartner(null)
  }

  const deletePartner = (id) => {
    if (!confirm('Supprimer ce partenaire ?')) return
    setPartners(prev => prev.filter(p => p.id !== id))
  }

  const getPartnerStatusStyle = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'prospect': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'inactive': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Tableau de bord Acquisition</h2>
          <p className="text-sm text-zinc-500 mt-1">Suivi en temps réel de vos efforts marketing, conversion et partenariats</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'partners', icon: Handshake, label: 'CRM Partenaires' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4 inline mr-1.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'MRR', value: `${mrr.toLocaleString()}€`, icon: DollarSign, color: 'text-emerald-400', trend: '+12%', trendUp: true },
              { label: 'Clients actifs', value: activeClients.length, icon: Users, color: 'text-blue-400', trend: `+${newClientsThisMonth.length} ce mois`, trendUp: true },
              { label: 'Taux conversion', value: `${conversionRate}%`, icon: Target, color: 'text-violet-400', trend: 'visiteur → client', trendUp: true },
              { label: 'CAC', value: '0€', icon: Zap, color: 'text-amber-400', trend: '100% organique', trendUp: true },
            ].map((kpi, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#111] border border-white/5 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${
                    kpi.trendUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {kpi.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{kpi.trend}
                  </span>
                </div>
                <span className="text-3xl font-bold text-white">{kpi.value}</span>
                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-medium">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enhanced Funnel visualization */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                Funnel de conversion détaillé
              </h3>
              <div className="space-y-2">
                {funnelStages.map((stage, i) => {
                  const maxCount = Math.max(...funnelStages.map(s => s.count), 1)
                  const width = Math.max((stage.count / maxCount) * 100, 5)
                  const prevCount = i > 0 ? funnelStages[i - 1].count : null
                  const convRate = prevCount ? Math.round((stage.count / prevCount) * 100) : null

                  return (
                    <div key={i}>
                      {/* Conversion rate between stages */}
                      {convRate !== null && (
                        <div className="flex items-center justify-center my-0.5">
                          <div className="flex items-center gap-1 text-[9px] text-zinc-600">
                            <ChevronRight className="w-3 h-3" />
                            <span className={convRate >= 50 ? 'text-emerald-500' : convRate >= 25 ? 'text-amber-500' : 'text-red-500'}>
                              {convRate}% conversion
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="group">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400 font-medium">{stage.label}</span>
                            <span className="text-[9px] text-zinc-600 hidden group-hover:inline">{stage.description}</span>
                          </div>
                          <span className={`text-sm font-bold ${stage.color}`}>{stage.count}</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${width}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className={`h-full rounded-full ${stage.bg.replace('/10', '/40')}`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Conversion globale (visiteur → client)</span>
                <span className="text-lg font-bold text-emerald-400">{conversionRate}%</span>
              </div>
            </div>

            {/* Sources breakdown */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Leads par source
              </h3>
              <div className="space-y-3">
                {sources.sort((a, b) => b.leads - a.leads).map((src, i) => {
                  const srcConv = src.leads > 0 ? Math.round(src.converted / src.leads * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${src.color}`} />
                      <span className="text-xs text-zinc-400 flex-1">{src.name}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs text-zinc-500">Leads</span>
                          <span className="text-sm font-bold text-white ml-2">{src.leads}</span>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <span className="text-xs text-zinc-500">Conv.</span>
                          <span className="text-sm font-bold text-emerald-400 ml-2">{src.converted}</span>
                        </div>
                        <div className="text-right min-w-[40px]">
                          <span className={`text-[10px] font-bold ${srcConv >= 10 ? 'text-emerald-400' : srcConv >= 5 ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {srcConv}%
                          </span>
                        </div>
                        <div className="w-16">
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${src.color}`}
                              style={{ width: `${(src.leads / totalLeads) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Total leads</span>
                <span className="text-lg font-bold text-white">{totalLeads}</span>
              </div>
            </div>
          </div>

          {/* Recent conversions */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Derniers clients signés
            </h3>
            {activeClients.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">
                Aucun client actif pour le moment. Lancez vos campagnes !
              </div>
            ) : (
              <div className="space-y-2">
                {activeClients.slice(0, 10).map((client) => (
                  <div key={client.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {client.brand_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <span className="text-sm text-white font-medium">{client.brand_name}</span>
                        <span className="text-xs text-zinc-500 ml-2 capitalize">{client.type || 'e-commerce'}</span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly objectives */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Objectifs hebdomadaires
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Emails envoyés', current: 127, target: 200, unit: '' },
                { label: 'Loom bombs', current: 8, target: 15, unit: '' },
                { label: 'Calls planifiés', current: 3, target: 5, unit: '' },
                { label: 'Clients signés', current: 1, target: 2, unit: '' },
              ].map((obj, i) => {
                const pct = Math.min(Math.round(obj.current / obj.target * 100), 100)
                return (
                  <div key={i} className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke={pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="3"
                          strokeDasharray={`${pct * 0.88} 88`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {pct}%
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 block">{obj.label}</span>
                    <span className="text-[10px] text-zinc-600">{obj.current}/{obj.target}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* PARTNERS CRM TAB */}
      {activeTab === 'partners' && (
        <div className="space-y-6">
          {/* Partner stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Partenaires actifs', value: partners.filter(p => p.status === 'active').length, icon: Handshake, color: 'text-emerald-400' },
              { label: 'Prospects', value: partners.filter(p => p.status === 'prospect').length, icon: UserCheck, color: 'text-amber-400' },
              { label: 'Clients référés', value: partners.reduce((s, p) => s + p.clientsReferred, 0), icon: Users, color: 'text-blue-400' },
              { label: 'Revenu partenariats', value: `${partners.reduce((s, p) => s + (p.totalRevenue || 0), 0).toLocaleString()}€`, icon: DollarSign, color: 'text-violet-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-zinc-500 font-medium">{stat.label}</span>
                </div>
                <span className="text-2xl font-bold text-white">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Partners table */}
          <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-400" />
                CRM Partenaires Agences Shopify
              </h3>
              <button
                onClick={() => setShowAddPartner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-white/[0.02] border-b border-white/5 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              <div className="col-span-3">Agence</div>
              <div className="col-span-2">Contact</div>
              <div className="col-span-1">Statut</div>
              <div className="col-span-1 text-center">Commission</div>
              <div className="col-span-1 text-center">Clients</div>
              <div className="col-span-2">Revenu</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Table rows */}
            {partners.map(partner => (
              <div key={partner.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center">
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold">
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{partner.name}</p>
                      {partner.notes && <p className="text-[10px] text-zinc-600 truncate max-w-[180px]">{partner.notes}</p>}
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-zinc-300">{partner.contact}</p>
                  {partner.phone && (
                    <p className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{partner.phone}
                    </p>
                  )}
                </div>
                <div className="col-span-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getPartnerStatusStyle(partner.status)}`}>
                    {partner.status === 'active' ? 'Actif' : partner.status === 'prospect' ? 'Prospect' : 'Inactif'}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold text-amber-400">{partner.commission}%</span>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold text-white">{partner.clientsReferred}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-sm font-bold text-emerald-400">{(partner.totalRevenue || 0).toLocaleString()}€</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 justify-end">
                  <button
                    onClick={() => setEditingPartner({ ...partner })}
                    className="p-1.5 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePartner(partner.id)}
                    className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {partners.length === 0 && (
              <div className="text-center py-12 text-zinc-600 text-sm">
                Aucun partenaire. Ajoutez votre première agence partenaire.
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 flex items-center gap-2">
              <Handshake className="w-4 h-4 text-emerald-400" />
              <span><b className="text-zinc-300">Stratégie :</b> Les agences Shopify sont votre meilleur canal. Proposez 10-15% de commission sur le MRR généré par les clients référés.</span>
            </p>
          </div>
        </div>
      )}

      {/* Add partner modal */}
      <AnimatePresence>
        {showAddPartner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddPartner(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Nouveau partenaire</h3>
                <button onClick={() => setShowAddPartner(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Nom de l'agence</label>
                  <input
                    value={newPartner.name}
                    onChange={e => setNewPartner(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Agence Pixel"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Email contact</label>
                    <input
                      value={newPartner.contact}
                      onChange={e => setNewPartner(p => ({ ...p, contact: e.target.value }))}
                      placeholder="email@agence.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Téléphone</label>
                    <input
                      value={newPartner.phone}
                      onChange={e => setNewPartner(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+33 6 ..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Statut</label>
                    <select
                      value={newPartner.status}
                      onChange={e => setNewPartner(p => ({ ...p, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Commission (%)</label>
                    <input
                      type="number"
                      value={newPartner.commission}
                      onChange={e => setNewPartner(p => ({ ...p, commission: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Notes</label>
                  <input
                    value={newPartner.notes}
                    onChange={e => setNewPartner(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Spécialité, contexte..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <button
                  onClick={addPartner}
                  disabled={!newPartner.name.trim()}
                  className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> Ajouter le partenaire
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit partner modal */}
      <AnimatePresence>
        {editingPartner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingPartner(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Modifier — {editingPartner.name}</h3>
                <button onClick={() => setEditingPartner(null)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Nom</label>
                  <input
                    value={editingPartner.name}
                    onChange={e => setEditingPartner(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Email</label>
                    <input
                      value={editingPartner.contact}
                      onChange={e => setEditingPartner(p => ({ ...p, contact: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Téléphone</label>
                    <input
                      value={editingPartner.phone}
                      onChange={e => setEditingPartner(p => ({ ...p, phone: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Statut</label>
                    <select
                      value={editingPartner.status}
                      onChange={e => setEditingPartner(p => ({ ...p, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Commission (%)</label>
                    <input
                      type="number"
                      value={editingPartner.commission}
                      onChange={e => setEditingPartner(p => ({ ...p, commission: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Clients réf.</label>
                    <input
                      type="number"
                      value={editingPartner.clientsReferred}
                      onChange={e => setEditingPartner(p => ({ ...p, clientsReferred: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Revenu total (€)</label>
                    <input
                      type="number"
                      value={editingPartner.totalRevenue}
                      onChange={e => setEditingPartner(p => ({ ...p, totalRevenue: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Notes</label>
                    <input
                      value={editingPartner.notes}
                      onChange={e => setEditingPartner(p => ({ ...p, notes: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={updatePartner}
                  className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1.5" /> Sauvegarder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
