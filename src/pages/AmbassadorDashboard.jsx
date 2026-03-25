import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Link2,
  Users,
  DollarSign,
  BookOpen,
  User,
  Copy,
  Share2,
  Plus,
  X,
  Check,
  Menu,
  LogOut,
  TrendingUp,
  Clock,
  Gift,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Timer,
  Lightbulb,
  Send,
  Target,
  Award,
  CheckCircle,
  Landmark,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/layout/Logo'
import { Sidebar } from '../components/layout/Sidebar'
import {
  LEAD_STATUS_MAP,
  COMMISSION_STATUS_MAP,
  LEAD_EVENT_LABELS,
  LEAD_PIPELINE,
  getJ30Countdown,
} from '../lib/ambassador-helpers'

// ─── Status badge ───
const StatusBadge = ({ status, config }) => {
  const s = config[status] || { label: status, color: 'bg-gray-500/20 text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot || 'bg-gray-400'}`} />
      {s.label}
    </span>
  )
}

// ─── KPI card with icon ───
const KPICard = ({ label, value, icon: Icon, accent = 'emerald', subtitle }) => (
  <div className="p-5 rounded-2xl bg-[#111] border border-white/10 hover:border-white/20 transition-all group">
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      {Icon && <Icon className={`w-4 h-4 text-${accent}-400 opacity-60 group-hover:opacity-100 transition-opacity`} />}
    </div>
    <p className={`text-3xl font-bold text-${accent}-400`}>{value ?? '\u2014'}</p>
    {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
  </div>
)

// ─── Copy button ───
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300 hover:bg-white/10 transition-all"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  )
}

// ─── J+30 Countdown Badge ───
const J30Badge = ({ eligibilityDate }) => {
  const { daysLeft, isEligible, label } = getJ30Countdown(eligibilityDate)
  if (daysLeft === null) return <span className="text-xs text-gray-600">\u2014</span>
  if (isEligible) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">Éligible</span>
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Timer className="w-3 h-3" />
      {label}
    </span>
  )
}

// ─── Lead Pipeline Progress ───
const LeadPipeline = ({ status }) => {
  const idx = LEAD_PIPELINE.indexOf(status)
  const progress = status === 'lost' ? -1 : idx
  return (
    <div className="flex items-center gap-1">
      {LEAD_PIPELINE.map((step, i) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            progress === -1
              ? 'bg-red-500/30'
              : i <= progress
                ? 'bg-emerald-500'
                : 'bg-white/10'
          }`}
          title={LEAD_STATUS_MAP[step]?.label || step}
        />
      ))}
    </div>
  )
}

// ─── Timeline component ───
const LeadTimeline = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-6">
        <Clock className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Aucun événement pour ce lead.</p>
      </div>
    )
  }
  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
      {events.map((ev, i) => (
        <div key={ev.id || i} className="relative flex items-start gap-3">
          <div className={`absolute left-[-18px] w-2 h-2 rounded-full mt-2 ${
            LEAD_STATUS_MAP[ev.event_type]?.dot || 'bg-gray-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              {LEAD_EVENT_LABELS[ev.event_type] || ev.event_type}
            </p>
            {ev.note && <p className="text-xs text-gray-500 mt-0.5">{ev.note}</p>}
            <p className="text-[10px] text-gray-600 mt-1">
              {new Date(ev.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───
export const AmbassadorDashboard = ({ onNavigate, currentRoute }) => {
  const [ambassador, setAmbassador] = useState(null)
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [commissions, setCommissions] = useState([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Lead modal
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadForm, setLeadForm] = useState({
    prospect_name: '', company_name: '', company_niche: '', prospect_email: '', prospect_phone: '', message: '',
  })
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadSuccess, setLeadSuccess] = useState(false)
  const [leadError, setLeadError] = useState('')

  // Lead timeline
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState(null)
  const [timelineEvents, setTimelineEvents] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Profile edit
  const [profileForm, setProfileForm] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const getTabFromRoute = (route) => {
    if (route === '/ambassador/link') return 'link'
    if (route === '/ambassador/leads') return 'leads'
    if (route === '/ambassador/commissions') return 'commissions'
    if (route === '/ambassador/rules') return 'rules'
    if (route === '/ambassador/profile') return 'profile'
    return 'overview'
  }

  const activeTab = getTabFromRoute(currentRoute)
  const setActiveTab = (tab) => {
    const route = tab === 'overview' ? '/ambassador' : `/ambassador/${tab}`
    onNavigate(route)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onNavigate('/')
  }

  // Fetch ambassador data
  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          onNavigate('/ambassador/login')
          return
        }

        const { data: amb, error: ambErr } = await supabase
          .from('ambassadors')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (ambErr || !amb) {
          onNavigate('/ambassador/login')
          return
        }

        if (mounted) {
          setAmbassador(amb)
          setProfileForm({
            first_name: amb.first_name || '',
            last_name: amb.last_name || '',
            phone: amb.phone || '',
            siret: amb.siret || '',
            iban: amb.iban || '',
            bic: amb.bic || '',
            iban_holder: amb.iban_holder || '',
          })
        }

        const { data: leadsData } = await supabase
          .from('ambassador_leads')
          .select('*')
          .eq('ambassador_id', amb.id)
          .order('created_at', { ascending: false })

        if (mounted && leadsData) setLeads(leadsData)

        const { data: commissionsData } = await supabase
          .from('ambassador_commissions')
          .select('*')
          .eq('ambassador_id', amb.id)
          .order('created_at', { ascending: false })

        if (mounted && commissionsData) setCommissions(commissionsData)
      } catch (_err) {
        // silent
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [onNavigate])

  // Fetch lead timeline
  const fetchTimeline = async (leadId) => {
    setTimelineLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/ambassador/lead-events.js?lead_id=${leadId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTimelineEvents(data.events || [])
      }
    } catch (_err) {
      setTimelineEvents([])
    } finally {
      setTimelineLoading(false)
    }
  }

  // Submit lead
  const handleLeadSubmit = async (e) => {
    e.preventDefault()
    setLeadSubmitting(true)
    setLeadError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ambassador/submit-lead.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(leadForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setLeadError(data.error || 'Erreur lors de l\u2019envoi.')
        return
      }
      setLeads((prev) => [data, ...prev])

      // Send email to prospect if email is provided
      if (leadForm.prospect_email) {
        try {
          await fetch('/api/ambassador/send-prospect-email.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              prospect_name: leadForm.prospect_name,
              prospect_email: leadForm.prospect_email,
              company_name: leadForm.company_name,
              ambassador_code: ambassador?.ambassador_code || ambassador?.code,
            }),
          })
        } catch (_) { /* non-blocking */ }
      }

      setLeadSuccess(true)
      setTimeout(() => {
        setShowLeadModal(false)
        setLeadSuccess(false)
        setLeadError('')
        setLeadForm({ prospect_name: '', company_name: '', company_niche: '', prospect_email: '', prospect_phone: '', message: '' })
      }, 1500)
    } catch (_err) {
      setLeadError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setLeadSubmitting(false)
    }
  }

  // Save profile
  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    try {
      await supabase
        .from('ambassadors')
        .update({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone,
          siret: profileForm.siret,
          iban: profileForm.iban?.replace(/\s/g, '') || null,
          bic: profileForm.bic || null,
          iban_holder: profileForm.iban_holder || null,
        })
        .eq('id', ambassador.id)

      setAmbassador((prev) => ({ ...prev, ...profileForm }))
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (_err) {
      // silent
    } finally {
      setProfileSaving(false)
    }
  }

  const sidebarItems = [
    { type: 'section', label: 'Navigation' },
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'link', label: 'Mon Lien', icon: Link2 },
    { id: 'leads', label: 'Mes Recommandations', icon: Users },
    { id: 'commissions', label: 'Mes Commissions', icon: DollarSign },
    { id: 'rules', label: 'Règles', icon: BookOpen },
    { id: 'profile', label: 'Mon Profil', icon: User },
  ]

  const ambassadorLink = ambassador?.code
    ? `https://actero.fr/audit?ref=${ambassador.code}`
    : ambassador?.ambassador_code
      ? `https://actero.fr/audit?ref=${ambassador.ambassador_code}`
      : ''

  const ambCode = ambassador?.code || ambassador?.ambassador_code || ''

  const totalLeads = leads.length
  const leadsInProgress = leads.filter((l) => !['won', 'lost'].includes(l.status)).length
  const leadsWon = leads.filter((l) => l.status === 'won').length
  const totalEarned = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  const commissionsPending = commissions.filter((c) => ['pending', 'waiting_30_days', 'eligible'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsValidated = commissions.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsPaid = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsTotal = commissions.filter((c) => !['cancelled'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0)

  // Next potential reward estimate
  const nextRewardEstimate = commissions
    .filter(c => ['pending', 'waiting_30_days', 'eligible', 'approved'].includes(c.status))
    .reduce((s, c) => s + (c.amount || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Actero', text: 'Découvrez Actero, la plateforme IA pour automatiser votre business.', url: ambassadorLink })
      } catch (_e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(ambassadorLink)
    }
  }

  // ─── RENDER TABS ───
  const renderContent = () => {
    switch (activeTab) {
      // ═══════════════════════════════════════
      // OVERVIEW
      // ═══════════════════════════════════════
      case 'overview':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Bonjour, {ambassador?.first_name || 'Ambassadeur'} <span className="inline-block animate-pulse">&#x1f44b;</span>
              </h1>
              <p className="text-gray-400 font-medium">Votre tableau de bord ambassadeur.</p>
            </div>

            {/* Quick explainer card */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Comment ça marche</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong className="text-gray-300">1.</strong> Partagez votre lien unique &rarr;{' '}
                    <strong className="text-gray-300">2.</strong> On s’occupe de la vente &rarr;{' '}
                    <strong className="text-gray-300">3.</strong> Vous êtes récompensé 30j après le paiement client.
                  </p>
                </div>
              </div>
            </div>

            {/* Link */}
            <div className="p-6 rounded-2xl bg-[#111] border border-white/10">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Votre lien de parrainage</p>
              {ambassadorLink && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-4">
                  <span className="text-sm text-emerald-400 font-mono truncate flex-1">{ambassadorLink}</span>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {ambassadorLink && <CopyButton text={ambassadorLink} />}
                {ambassadorLink && (
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    <Share2 className="w-4 h-4" /> Partager
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-3">Code : {ambCode}</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard label="Leads envoyés" value={totalLeads} icon={Send} />
              <KPICard label="En cours" value={leadsInProgress} icon={Target} accent="blue" />
              <KPICard label="Leads signés" value={leadsWon} icon={Award} accent="green" />
              <KPICard label="Total gagné" value={`${totalEarned.toLocaleString('fr-FR')} \u20AC`} icon={DollarSign} />
              <KPICard
                label="Prochaine récompense"
                value={nextRewardEstimate > 0 ? `${nextRewardEstimate.toLocaleString('fr-FR')} \u20AC` : '\u2014'}
                icon={Gift}
                accent="amber"
                subtitle={nextRewardEstimate > 0 ? 'En attente de validation' : 'Recommandez pour gagner'}
              />
              <KPICard
                label="Taux de conversion"
                value={totalLeads > 0 ? `${Math.round((leadsWon / totalLeads) * 100)}%` : '\u2014'}
                icon={TrendingUp}
                accent="cyan"
                subtitle={totalLeads > 0 ? `${leadsWon} sur ${totalLeads}` : undefined}
              />
            </div>

            {/* Quick actions */}
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => setShowLeadModal(true)}
                className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Recommander un prospect</p>
                      <p className="text-xs text-gray-500">Soumettez un nouveau lead</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
              <button
                onClick={() => setActiveTab('commissions')}
                className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Mes commissions</p>
                      <p className="text-xs text-gray-500">Suivez vos récompenses</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                </div>
              </button>
            </div>
          </div>
        )

      // ═══════════════════════════════════════
      // MON LIEN
      // ═══════════════════════════════════════
      case 'link':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Mon Lien</h1>
              <p className="text-gray-400 font-medium">Partagez ce lien pour attribuer automatiquement vos recommandations.</p>
            </div>

            <div className="p-8 rounded-2xl bg-[#111] border border-white/10 space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Code ambassadeur</p>
                <p className="text-4xl font-bold text-emerald-400 font-mono">{ambCode || '\u2014'}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lien de parrainage</p>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 flex-wrap">
                  <code className="text-sm text-white font-mono break-all flex-1">{ambassadorLink || '\u2014'}</code>
                  {ambassadorLink && <CopyButton text={ambassadorLink} />}
                  {ambassadorLink && (
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
                    >
                      <Share2 className="w-4 h-4" /> Partager
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-sm text-gray-300 font-medium leading-relaxed">
                  Partagez ce lien à vos contacts professionnels. Dès qu’ils prennent rendez-vous via ce lien, le lead vous est automatiquement attribué.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Conditions de commission</p>
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                  La récompense est versée 30 jours après le paiement effectif du client. Le montant dépend de la valeur du contrat signé.
                </p>
              </div>
            </div>
          </div>
        )

      // ═══════════════════════════════════════
      // MES RECOMMANDATIONS
      // ═══════════════════════════════════════
      case 'leads':
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Mes Recommandations</h1>
                <p className="text-gray-400 font-medium">{leads.length} recommandation{leads.length > 1 ? 's' : ''} au total</p>
              </div>
              <button
                onClick={() => { setShowLeadModal(true); setLeadError('') }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" /> Recommander un prospect
              </button>
            </div>

            {/* Empty state */}
            {leads.length === 0 ? (
              <div className="rounded-2xl bg-[#111] border border-white/10 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-emerald-400/50" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Aucune recommandation</h3>
                <p className="text-gray-500 font-medium max-w-sm mx-auto mb-6">
                  Commencez par recommander un prospect en cliquant sur le bouton ci-dessus.
                </p>
                <button
                  onClick={() => { setShowLeadModal(true); setLeadError('') }}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Recommander un prospect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <div key={lead.id} className="rounded-2xl bg-[#111] border border-white/10 hover:border-white/20 transition-all p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-bold text-white">{lead.prospect_name}</p>
                          <StatusBadge status={lead.status} config={LEAD_STATUS_MAP} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {lead.company_name}
                          {lead.company_niche && <span className="ml-2 px-2 py-0.5 rounded-full bg-white/5 text-gray-400 text-[10px] font-bold">{lead.company_niche}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-600">
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                        </span>
                        <button
                          onClick={() => {
                            if (selectedLeadForTimeline === lead.id) {
                              setSelectedLeadForTimeline(null)
                            } else {
                              setSelectedLeadForTimeline(lead.id)
                              fetchTimeline(lead.id)
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-white"
                          title="Voir la timeline"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Pipeline progress */}
                    <LeadPipeline status={lead.status} />

                    {lead.status_note && (
                      <p className="text-xs text-gray-500 mt-2 italic">{lead.status_note}</p>
                    )}

                    {/* Timeline expandable */}
                    <AnimatePresence>
                      {selectedLeadForTimeline === lead.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-white/5">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
                            {timelineLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                              </div>
                            ) : (
                              <LeadTimeline events={timelineEvents} />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}

            {/* Lead submission modal */}
            <AnimatePresence>
              {showLeadModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                  onClick={() => setShowLeadModal(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl p-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {leadSuccess ? (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                          <Check className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Recommandation envoyée !</h3>
                        <p className="text-sm text-gray-500">Notre équipe va traiter votre lead.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-white">Recommander un prospect</h3>
                          <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {leadError && (
                          <div className="p-3 mb-4 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 text-center">
                            {leadError}
                          </div>
                        )}

                        <form onSubmit={handleLeadSubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-1.5">Nom du prospect *</label>
                            <input
                              type="text" required
                              value={leadForm.prospect_name}
                              onChange={(e) => setLeadForm((p) => ({ ...p, prospect_name: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                              placeholder="Jean Dupont"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-1.5">Entreprise *</label>
                            <input
                              type="text" required
                              value={leadForm.company_name}
                              onChange={(e) => setLeadForm((p) => ({ ...p, company_name: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                              placeholder="Nom de l’entreprise"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-1.5">Niche</label>
                            <select
                              value={leadForm.company_niche}
                              onChange={(e) => setLeadForm((p) => ({ ...p, company_niche: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none"
                            >
                              <option value="" className="bg-[#111]">Sélectionner</option>
                              <option value="E-commerce" className="bg-[#111]">E-commerce</option>
                              <option value="Immobilier" className="bg-[#111]">Immobilier</option>
                              <option value="SaaS" className="bg-[#111]">SaaS</option>
                              <option value="Finance" className="bg-[#111]">Finance</option>
                              <option value="Santé" className="bg-[#111]">Santé</option>
                              <option value="Autre" className="bg-[#111]">Autre</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-gray-300 mb-1.5">Email</label>
                              <input
                                type="email"
                                value={leadForm.prospect_email}
                                onChange={(e) => setLeadForm((p) => ({ ...p, prospect_email: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                                placeholder="email@exemple.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-gray-300 mb-1.5">Téléphone</label>
                              <input
                                type="tel"
                                value={leadForm.prospect_phone}
                                onChange={(e) => setLeadForm((p) => ({ ...p, prospect_phone: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                                placeholder="+33 6 ..."
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-300 mb-1.5">Message</label>
                            <textarea
                              value={leadForm.message}
                              onChange={(e) => setLeadForm((p) => ({ ...p, message: e.target.value }))}
                              rows={3}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                              placeholder="Contexte ou informations utiles..."
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={leadSubmitting}
                            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all"
                          >
                            {leadSubmitting ? (
                              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mx-auto" />
                            ) : 'Envoyer la recommandation'}
                          </button>
                        </form>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )

      // ═══════════════════════════════════════
      // COMMISSIONS
      // ═══════════════════════════════════════
      case 'commissions':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Mes Commissions</h1>
              <p className="text-gray-400 font-medium">Suivi de vos récompenses.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="En attente" value={`${commissionsPending.toLocaleString('fr-FR')} \u20AC`} icon={Clock} accent="amber" />
              <KPICard label="Validées" value={`${commissionsValidated.toLocaleString('fr-FR')} \u20AC`} icon={Check} accent="green" />
              <KPICard label="Payées" value={`${commissionsPaid.toLocaleString('fr-FR')} \u20AC`} icon={DollarSign} />
              <KPICard label="Total cumulé" value={`${commissionsTotal.toLocaleString('fr-FR')} \u20AC`} icon={TrendingUp} accent="cyan" />
            </div>

            {commissions.length === 0 ? (
              <div className="rounded-2xl bg-[#111] border border-white/10 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-8 h-8 text-amber-400/50" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Aucune commission</h3>
                <p className="text-gray-500 font-medium max-w-sm mx-auto">
                  Les commissions apparaissent ici lorsqu’un de vos leads est signé.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {commissions.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-[#111] border border-white/10 hover:border-white/20 transition-all p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-bold text-white">{c.prospect_name || c.ambassador_leads?.prospect_name || '\u2014'}</p>
                          <StatusBadge status={c.status} config={COMMISSION_STATUS_MAP} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{c.company_name || c.ambassador_leads?.company_name || ''}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <J30Badge eligibilityDate={c.eligibility_date} />
                        <p className="text-lg font-bold font-mono text-white">
                          {c.amount ? `${Number(c.amount).toLocaleString('fr-FR')} \u20AC` : '\u2014'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                      {c.client_payment_date && (
                        <span>Paiement client : {new Date(c.client_payment_date).toLocaleDateString('fr-FR')}</span>
                      )}
                      {c.eligibility_date && (
                        <span>Éligibilité : {new Date(c.eligibility_date).toLocaleDateString('fr-FR')}</span>
                      )}
                      {c.paid_at && (
                        <span className="text-emerald-400/80">Payé le : {new Date(c.paid_at).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      // ═══════════════════════════════════════
      // R\u00c8GLES
      // ═══════════════════════════════════════
      case 'rules':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Règles du programme</h1>
              <p className="text-gray-400 font-medium">Tout ce que vous devez savoir.</p>
            </div>

            <div className="space-y-6">
              {[
                {
                  title: 'Attribution',
                  content: "Les leads sont attribués via votre lien ou code unique, ou par recommandation manuelle validée par Actero. Chaque lead est vérifié avant attribution définitive.",
                },
                {
                  title: "Quand la récompense est due",
                  content: "La récompense est due uniquement si le prospect recommandé devient client ET effectue un paiement. La simple recommandation ne suffit pas.",
                },
                {
                  title: "Délai de paiement (J+30)",
                  content: "La récompense est versée 30 jours après l\u2019encaissement effectif du paiement client. Ce délai permet de couvrir les éventuelles périodes de rétractation.",
                },
                {
                  title: "Cas où aucune récompense n\u2019est due",
                  content: "Aucune commission n\u2019est versée si : le client ne paie pas, le client est remboursé intégralement, le lead n\u2019est pas validé par Actero, ou le lead a déjà été soumis par un autre ambassadeur.",
                },
                {
                  title: "Règle du premier arrivé",
                  content: "Un lead ne peut être attribué qu\u2019à un seul ambassadeur. En cas de doublon, c\u2019est le premier ambassadeur ayant soumis le lead qui est retenu (premier arrivé, premier servi).",
                },
              ].map((rule, i) => (
                <div key={i} className="p-6 rounded-2xl bg-[#111] border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-3">{rule.title}</h3>
                  <p className="text-gray-400 font-medium leading-relaxed">{rule.content}</p>
                </div>
              ))}

              {/* Engagements que vous avez acceptés */}
              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-400 mb-4">Engagements acceptés lors de votre inscription</h3>
                <div className="space-y-3">
                  {[
                    "Mon rôle est uniquement de recommander Actero, pas de vendre ni de closer.",
                    "Je ne peux faire aucune promesse au nom d\u2019Actero, ni annoncer des prix ou des résultats non validés.",
                    "Une récompense est versée uniquement si le client signe, paie effectivement, et 30 jours après l\u2019encaissement.",
                    "Un lead peut être refusé s\u2019il est non qualifié, abusif, ou déjà connu d\u2019Actero.",
                    "Tout abus, spam ou comportement nuisible peut entraîner la désactivation de mon compte.",
                  ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-zinc-300 leading-relaxed">{rule}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      // ═══════════════════════════════════════
      // PROFIL
      // ═══════════════════════════════════════
      case 'profile':
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Mon Profil</h1>
              <p className="text-gray-400 font-medium">Gérez vos informations personnelles.</p>
            </div>

            {profileForm && (
              <form onSubmit={handleProfileSave} className="max-w-xl space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Nom</label>
                    <input
                      type="text"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={ambassador?.email || ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-600 mt-1">L'email ne peut pas être modifié.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">SIRET (optionnel)</label>
                  <input
                    type="text"
                    value={profileForm.siret}
                    onChange={(e) => setProfileForm((p) => ({ ...p, siret: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="123 456 789 00012"
                  />
                </div>

                {/* IBAN Section */}
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-400" /> Informations bancaires
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Titulaire du compte</label>
                      <input
                        type="text"
                        value={profileForm.iban_holder}
                        onChange={(e) => setProfileForm((p) => ({ ...p, iban_holder: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                        placeholder="Prénom Nom ou Raison sociale"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">IBAN</label>
                      <input
                        type="text"
                        value={profileForm.iban}
                        onChange={(e) => setProfileForm((p) => ({ ...p, iban: e.target.value.toUpperCase() }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                        placeholder="FR76 1234 5678 9012 3456 7890 123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">BIC / SWIFT (optionnel)</label>
                      <input
                        type="text"
                        value={profileForm.bic}
                        onChange={(e) => setProfileForm((p) => ({ ...p, bic: e.target.value.toUpperCase() }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                        placeholder="BNPAFRPP"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Date d'inscription</label>
                    <p className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
                      {ambassador?.created_at ? new Date(ambassador.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Statut du compte</label>
                    <div className="px-4 py-3">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        ambassador?.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : ambassador?.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {ambassador?.status === 'active' ? 'Actif' : ambassador?.status === 'pending' ? 'En attente' : (ambassador?.status || 'Inconnu')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all"
                  >
                    {profileSaving ? 'Enregistrement...' : profileSaved ? 'Enregistré !' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
                  >
                    <LogOut className="w-4 h-4" /> Déconnexion
                  </button>
                </div>
              </form>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] font-sans text-white flex">
      {/* Mobile menu toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center"
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed md:static z-50 h-screen transition-transform md:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar
          title="Ambassadeur"
          items={sidebarItems}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab)
            setIsMobileMenuOpen(false)
          }}
          onLogout={handleLogout}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 md:py-14">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
