import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Plus, Play, Pause, Trash2, Clock, Send, CheckCircle, Eye,
  Loader2, ChevronRight, BarChart3, X, AlertCircle, RefreshCw,
  Calendar, FileText, Sparkles, Copy, ChevronLeft, MessageSquare,
  TrendingUp, Award, Zap, BookOpen
} from 'lucide-react'

const DEMO_SEQUENCES = [
  {
    id: 1,
    name: 'SAV E-commerce — Cold outreach',
    status: 'active',
    steps: [
      { day: 0, subject: 'Votre SAV perd des clients', openRate: 42, replyRate: 6 },
      { day: 3, subject: 'Relance — Les chiffres parlent', openRate: 38, replyRate: 4 },
      { day: 7, subject: 'Dernière chance — audit gratuit', openRate: 35, replyRate: 8 },
    ],
    totalSent: 127,
    totalOpened: 52,
    totalReplied: 8,
    createdAt: '2026-03-15',
  }
]

const POST_TEMPLATES = [
  { id: 'case_study', label: 'Étude de cas', icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/10', description: 'Résultats client avec avant/après et chiffres clés' },
  { id: 'tip', label: 'Tip actionnable', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', description: 'Conseil pratique que le lecteur peut appliquer immédiatement' },
  { id: 'before_after', label: 'Avant / Après', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', description: 'Transformation concrète avec screenshots ou métriques' },
  { id: 'stats', label: 'Statistique choc', icon: BarChart3, color: 'text-violet-400', bg: 'bg-violet-500/10', description: 'Chiffre marquant + analyse + CTA' },
  { id: 'story', label: 'Storytelling', icon: BookOpen, color: 'text-pink-400', bg: 'bg-pink-500/10', description: 'Narration personnelle avec leçon business' },
  { id: 'contrarian', label: 'Opinion trenchée', icon: MessageSquare, color: 'text-red-400', bg: 'bg-red-500/10', description: 'Point de vue à contre-courant pour créer le débat' },
]

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

const WEEKLY_SCHEDULE_DEFAULT = [
  { day: 'Lun', type: 'tip', topic: '' },
  { day: 'Mar', type: 'case_study', topic: '' },
  { day: 'Mer', type: 'stats', topic: '' },
  { day: 'Jeu', type: 'before_after', topic: '' },
  { day: 'Ven', type: 'story', topic: '' },
]

export const AdminCampaignView = () => {
  const [campaigns, setCampaigns] = useState(DEMO_SEQUENCES)
  const [showCreate, setShowCreate] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', steps: [{ day: 0, subject: '' }, { day: 3, subject: '' }, { day: 7, subject: '' }] })
  const [generating, setGenerating] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  // Tabs
  const [activeTab, setActiveTab] = useState('emails') // 'emails' | 'linkedin' | 'templates'

  // LinkedIn content calendar state
  const [weekOffset, setWeekOffset] = useState(0)
  const [weeklySchedule, setWeeklySchedule] = useState(WEEKLY_SCHEDULE_DEFAULT)
  const [generatingPost, setGeneratingPost] = useState(null) // day string or null
  const [generatedPosts, setGeneratedPosts] = useState({}) // { day: content }
  const [showPostPreview, setShowPostPreview] = useState(null) // day string

  // Template generation
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateTopic, setTemplateTopic] = useState('')
  const [generatingTemplate, setGeneratingTemplate] = useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState('')

  const callGemini = async (prompt) => {
    const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      }
    )
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Erreur de génération'
  }

  const generateSequence = async () => {
    if (!newCampaign.name.trim()) return
    setGenerating(true)

    try {
      const res = await callGemini(`Tu es un expert en cold email B2B pour Actero, agence d'automatisation IA e-commerce.

Génère une séquence de 3 emails pour la campagne "${newCampaign.name}".

Pour chaque email, donne :
- Jour d'envoi (J+0, J+3, J+7)
- Objet du mail (max 60 caractères)
- Corps du mail (max 120 mots, ton direct, pas corporate)

Format JSON strict :
[
  {"day": 0, "subject": "...", "body": "..."},
  {"day": 3, "subject": "...", "body": "..."},
  {"day": 7, "subject": "...", "body": "..."}
]

Réponds UNIQUEMENT avec le JSON, rien d'autre.`)

      const cleaned = res.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const steps = JSON.parse(cleaned)

      const campaign = {
        id: Date.now(),
        name: newCampaign.name,
        status: 'draft',
        steps: steps.map(s => ({ ...s, openRate: 0, replyRate: 0 })),
        totalSent: 0,
        totalOpened: 0,
        totalReplied: 0,
        createdAt: new Date().toISOString().split('T')[0],
      }

      setCampaigns(prev => [campaign, ...prev])
      setShowCreate(false)
      setNewCampaign({ name: '', steps: [{ day: 0, subject: '' }, { day: 3, subject: '' }, { day: 7, subject: '' }] })
      setSelectedCampaign(campaign)
    } catch (e) {
      console.error('Campaign generation error:', e)
      alert('Erreur lors de la génération. Vérifiez votre clé Gemini.')
    }
    setGenerating(false)
  }

  const toggleCampaignStatus = (id) => {
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c
    ))
  }

  const deleteCampaign = (id) => {
    if (!confirm('Supprimer cette campagne ?')) return
    setCampaigns(prev => prev.filter(c => c.id !== id))
    if (selectedCampaign?.id === id) setSelectedCampaign(null)
  }

  // LinkedIn calendar functions
  const getWeekDates = () => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
    return DAYS_OF_WEEK.map((_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const generateLinkedInPost = async (dayIndex) => {
    const schedule = weeklySchedule[dayIndex]
    const template = POST_TEMPLATES.find(t => t.id === schedule.type)
    setGeneratingPost(schedule.day)

    try {
      const text = await callGemini(`Tu es un expert en personal branding LinkedIn pour Actero, agence d'automatisation IA pour e-commerce.

Génère un post LinkedIn engageant de type "${template.label}" (${template.description}).

${schedule.topic ? `Sujet spécifique : ${schedule.topic}` : 'Sujet : au choix parmi tes connaissances sur le SAV e-commerce, l\'IA, l\'automatisation'}

Règles :
- Max 200 mots
- Commence par un hook percutant (première ligne qui donne envie de cliquer "voir plus")
- Utilise des sauts de ligne courts pour la lisibilité
- Termine par un CTA engageant (question ou invitation à commenter)
- Ton : expert accessible, pas corporate
- Inclus 3-5 hashtags pertinents à la fin
- Utilise des emojis avec parcimonie (3-4 max)

Réponds UNIQUEMENT avec le post, rien d'autre.`)

      setGeneratedPosts(prev => ({ ...prev, [schedule.day]: text }))
    } catch (e) {
      console.error('Post generation error:', e)
    }
    setGeneratingPost(null)
  }

  const generateFromTemplate = async () => {
    if (!selectedTemplate) return
    setGeneratingTemplate(true)

    const template = POST_TEMPLATES.find(t => t.id === selectedTemplate)

    try {
      const text = await callGemini(`Tu es un expert en personal branding LinkedIn pour Actero, agence d'automatisation IA pour e-commerce.

Génère un post LinkedIn de type "${template.label}".
Description du format : ${template.description}

${templateTopic ? `Sujet demandé : ${templateTopic}` : 'Sujet : libre, en lien avec le SAV e-commerce ou l\'automatisation IA'}

Règles :
- Max 200 mots
- Hook percutant en première ligne
- Sauts de ligne courts
- CTA engageant à la fin
- Ton expert accessible
- 3-5 hashtags
- Emojis avec parcimonie

Réponds UNIQUEMENT avec le post.`)

      setGeneratedTemplate(text)
    } catch (e) {
      setGeneratedTemplate('Erreur de génération.')
    }
    setGeneratingTemplate(false)
  }

  const weekDates = getWeekDates()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Campagnes & Contenu</h2>
          <p className="text-sm text-zinc-500 mt-1">Séquences email, calendrier LinkedIn, templates de posts IA</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'emails' && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" /> Nouvelle campagne
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0">
        {[
          { id: 'emails', icon: Mail, label: 'Campagnes Email' },
          { id: 'linkedin', icon: Calendar, label: 'Calendrier LinkedIn' },
          { id: 'templates', icon: FileText, label: 'Templates Posts' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all border border-b-0 ${
              activeTab === tab.id
                ? 'bg-[#111] text-white border-white/10'
                : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* EMAIL CAMPAIGNS TAB */}
      {activeTab === 'emails' && (
        <>
          {/* Stats overview */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Campagnes actives', value: campaigns.filter(c => c.status === 'active').length, icon: Play, color: 'text-emerald-400' },
              { label: 'Emails envoyés', value: campaigns.reduce((s, c) => s + c.totalSent, 0), icon: Send, color: 'text-blue-400' },
              { label: "Taux d'ouverture", value: (() => { const t = campaigns.reduce((s, c) => s + c.totalSent, 0); return t ? Math.round(campaigns.reduce((s, c) => s + c.totalOpened, 0) / t * 100) : 0 })() + '%', icon: Eye, color: 'text-amber-400' },
              { label: 'Taux de réponse', value: (() => { const t = campaigns.reduce((s, c) => s + c.totalSent, 0); return t ? Math.round(campaigns.reduce((s, c) => s + c.totalReplied, 0) / t * 100) : 0 })() + '%', icon: Mail, color: 'text-violet-400' },
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

          {/* Campaigns list */}
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <motion.div
                key={campaign.id}
                layout
                className="bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                      campaign.status === 'draft' ? 'bg-zinc-500/10 text-zinc-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {campaign.status === 'active' ? <Play className="w-5 h-5" /> :
                       campaign.status === 'draft' ? <Clock className="w-5 h-5" /> :
                       <Pause className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{campaign.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span>{campaign.steps.length} emails</span>
                        <span>{campaign.totalSent} envoyés</span>
                        <span>Créée le {campaign.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {campaign.totalSent > 0 && (
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <span className="text-zinc-500 block">Ouvert</span>
                          <span className="text-blue-400 font-bold">{Math.round(campaign.totalOpened / campaign.totalSent * 100)}%</span>
                        </div>
                        <div className="text-center">
                          <span className="text-zinc-500 block">Répondu</span>
                          <span className="text-emerald-400 font-bold">{Math.round(campaign.totalReplied / campaign.totalSent * 100)}%</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedCampaign(selectedCampaign?.id === campaign.id ? null : campaign)}
                        className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleCampaignStatus(campaign.id)}
                        className={`p-2 hover:bg-white/5 rounded-lg transition-all ${
                          campaign.status === 'active' ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedCampaign?.id === campaign.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        {campaign.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                i === 0 ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-zinc-400'
                              }`}>
                                J+{step.day}
                              </div>
                              {i < campaign.steps.length - 1 && (
                                <div className="w-px h-8 bg-white/10 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                              <p className="text-sm text-white font-medium">{step.subject}</p>
                              {step.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{step.body}</p>}
                              {step.openRate > 0 && (
                                <div className="flex gap-3 mt-2 text-[10px]">
                                  <span className="text-blue-400">Ouverture: {step.openRate}%</span>
                                  <span className="text-emerald-400">Réponse: {step.replyRate}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* LINKEDIN CALENDAR TAB */}
      {activeTab === 'linkedin' && (
        <div className="space-y-6">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-white font-bold text-sm">
                Semaine du {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {weekDates[4].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1 rounded-lg hover:bg-white/5 transition-all"
            >
              Aujourd'hui
            </button>
          </div>

          {/* Weekly calendar grid */}
          <div className="grid grid-cols-5 gap-3">
            {weeklySchedule.map((slot, i) => {
              const template = POST_TEMPLATES.find(t => t.id === slot.type)
              const hasGenerated = generatedPosts[slot.day]
              const isGenerating = generatingPost === slot.day
              const date = weekDates[i]
              const isToday = new Date().toDateString() === date.toDateString()

              return (
                <div
                  key={slot.day}
                  className={`bg-[#111] border rounded-2xl p-4 flex flex-col min-h-[280px] transition-all ${
                    isToday ? 'border-violet-500/30' : 'border-white/5'
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-violet-400' : 'text-zinc-500'}`}>
                        {slot.day}
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-2">
                        {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {isToday && <span className="text-[9px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                  </div>

                  {/* Post type selector */}
                  <select
                    value={slot.type}
                    onChange={(e) => setWeeklySchedule(prev => prev.map((s, j) => j === i ? { ...s, type: e.target.value } : s))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none mb-2"
                  >
                    {POST_TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>

                  {/* Type badge */}
                  {template && (
                    <div className={`flex items-center gap-1.5 mb-2 ${template.color}`}>
                      <template.icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">{template.label}</span>
                    </div>
                  )}

                  {/* Topic input */}
                  <input
                    value={slot.topic}
                    onChange={(e) => setWeeklySchedule(prev => prev.map((s, j) => j === i ? { ...s, topic: e.target.value } : s))}
                    placeholder="Sujet (optionnel)..."
                    className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-white/10 mb-3"
                  />

                  {/* Generated content preview or generate button */}
                  <div className="flex-1 flex flex-col justify-end">
                    {hasGenerated ? (
                      <div
                        className="bg-white/[0.02] border border-white/5 rounded-lg p-2 cursor-pointer hover:border-white/10 transition-all mb-2"
                        onClick={() => setShowPostPreview(slot.day)}
                      >
                        <p className="text-[10px] text-zinc-400 line-clamp-4 leading-relaxed">{generatedPosts[slot.day]}</p>
                        <span className="text-[9px] text-violet-400 mt-1 block">Cliquer pour voir</span>
                      </div>
                    ) : null}
                    <button
                      onClick={() => generateLinkedInPost(i)}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {isGenerating ? 'Génération...' : hasGenerated ? 'Régénérer' : 'Générer'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tips */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span><b className="text-zinc-300">Conseil :</b> Variez les formats pour maximiser l'engagement. Alternez entre case studies (confiance), tips (valeur), et opinions (débat).</span>
            </p>
          </div>
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Template grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {POST_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => { setSelectedTemplate(template.id); setGeneratedTemplate('') }}
                className={`bg-[#111] border rounded-2xl p-5 text-left transition-all hover:border-white/15 ${
                  selectedTemplate === template.id ? 'border-violet-500/30 ring-1 ring-violet-500/20' : 'border-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${template.bg} flex items-center justify-center mb-3`}>
                  <template.icon className={`w-5 h-5 ${template.color}`} />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">{template.label}</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{template.description}</p>
              </button>
            ))}
          </div>

          {/* Generation area */}
          {selectedTemplate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] border border-white/5 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const t = POST_TEMPLATES.find(t => t.id === selectedTemplate)
                  return (
                    <>
                      <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center`}>
                        <t.icon className={`w-4 h-4 ${t.color}`} />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm">{t.label}</h4>
                        <p className="text-[10px] text-zinc-500">{t.description}</p>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div className="flex gap-3 mb-4">
                <input
                  value={templateTopic}
                  onChange={(e) => setTemplateTopic(e.target.value)}
                  placeholder="Sujet du post (optionnel, ex: Réduction du temps de réponse SAV de 24h à 2min)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  onKeyDown={e => e.key === 'Enter' && generateFromTemplate()}
                />
                <button
                  onClick={generateFromTemplate}
                  disabled={generatingTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {generatingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generatingTemplate ? 'Génération...' : 'Générer'}
                </button>
              </div>

              {generatedTemplate && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <pre className="bg-black/30 border border-white/5 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed mb-3">
                    {generatedTemplate}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedTemplate)}
                      className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                      <Copy className="w-4 h-4 inline mr-1.5" /> Copier le post
                    </button>
                    <button
                      onClick={generateFromTemplate}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-sm font-medium transition-all border border-white/10"
                    >
                      <RefreshCw className="w-4 h-4 inline mr-1.5" /> Régénérer
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Create campaign modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Nouvelle campagne</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Nom de la campagne</label>
                  <input
                    value={newCampaign.name}
                    onChange={e => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: SAV E-commerce — Boutiques Shopify FR"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  L'IA va générer une séquence de 3 emails (J+0, J+3, J+7) optimisée pour la conversion.
                </p>
                <button
                  onClick={generateSequence}
                  disabled={generating || !newCampaign.name.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération IA en cours...</> : <><RefreshCw className="w-4 h-4" /> Générer la séquence avec l'IA</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post preview modal */}
      <AnimatePresence>
        {showPostPreview && generatedPosts[showPostPreview] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPostPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-400" />
                  Post LinkedIn — {showPostPreview}
                </h3>
                <button onClick={() => setShowPostPreview(null)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <pre className="bg-black/30 border border-white/5 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                {generatedPosts[showPostPreview]}
              </pre>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPosts[showPostPreview])}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <Copy className="w-4 h-4 inline mr-1.5" /> Copier
                </button>
                <button
                  onClick={() => setShowPostPreview(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-sm font-medium transition-all border border-white/10"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
