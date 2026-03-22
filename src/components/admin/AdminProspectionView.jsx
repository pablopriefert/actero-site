import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@supabase/supabase-js'
import {
  Search, Send, RefreshCw, ExternalLink, Loader2, Plus, ChevronRight, Copy,
  Globe, Mail, BarChart3, AlertTriangle, CheckCircle, Star, Trash2, Eye, X
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const PIPELINE_COLS = [
  { id: 'lead', title: 'Lead', color: 'border-zinc-500/30', badge: 'bg-zinc-100 text-zinc-700' },
  { id: 'contacted', title: 'Contacté', color: 'border-amber-500/30', badge: 'bg-amber-100 text-amber-700' },
  { id: 'call_planned', title: 'Call planifié', color: 'border-blue-500/30', badge: 'bg-blue-100 text-blue-700' },
  { id: 'audit_done', title: 'Audit fait', color: 'border-purple-500/30', badge: 'bg-purple-100 text-purple-700' },
  { id: 'closed', title: 'Fermé', color: 'border-emerald-500/30', badge: 'bg-emerald-100 text-emerald-700' },
]

export const AdminProspectionView = () => {
  const [urls, setUrls] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [prospects, setProspects] = useState([])
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [view, setView] = useState('analyzer') // 'analyzer' | 'pipeline'

  const analyzeStores = async () => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u)
    if (!urlList.length) return
    setAnalyzing(true)

    const results = []
    for (const url of urlList) {
      try {
        const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        // Simulate analysis - in production this calls the store-analyzer
        const score = Math.floor(Math.random() * 40) + 30
        const issues = []
        if (score < 50) issues.push('Temps de réponse SAV > 24h')
        if (Math.random() > 0.5) issues.push('Pas de chat live')
        if (Math.random() > 0.4) issues.push('Taux d\'abandon panier élevé')
        if (Math.random() > 0.6) issues.push('FAQ inexistante ou incomplète')

        const roiEstimate = Math.floor(Math.random() * 3000) + 500

        results.push({
          id: Date.now() + Math.random(),
          url: domain,
          score,
          issues,
          roiEstimate,
          status: 'lead',
          emailSent: false,
          createdAt: new Date().toISOString(),
        })
      } catch (e) {
        console.error('Analysis error:', e)
      }
    }

    setProspects(prev => [...results, ...prev])
    setAnalyzing(false)
    setUrls('')
  }

  const generateColdEmail = async (prospect) => {
    setGeneratingEmail(true)
    setSelectedProspect(prospect)

    try {
      const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Tu es un expert en cold email B2B pour une agence d'automatisation IA e-commerce appelée Actero.

Génère un cold email court (max 150 mots) pour cette boutique Shopify :
- URL : ${prospect.url}
- Score SAV : ${prospect.score}/100 (mauvais)
- Problèmes détectés : ${prospect.issues.join(', ')}
- ROI estimé : ${prospect.roiEstimate}€/mois

Le mail doit :
1. Mentionner un problème spécifique détecté sur LEUR store
2. Chiffrer le coût de ce problème
3. Proposer un audit gratuit de 15 min
4. CTA vers actero.fr/audit
5. Ton professionnel mais direct, pas corporate

Format : Objet: [objet]\n\n[corps du mail]\n\n[signature]` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        }
      )
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Erreur de génération'
      setEmailDraft(text)
    } catch (e) {
      setEmailDraft('Erreur lors de la génération du mail. Vérifiez votre clé Gemini.')
    }
    setGeneratingEmail(false)
  }

  const updateProspectStatus = (id, newStatus) => {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
  }

  const deleteProspect = (id) => {
    setProspects(prev => prev.filter(p => p.id !== id))
  }

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400'
    if (score >= 50) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20'
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Centre de Prospection</h2>
          <p className="text-sm text-zinc-500 mt-1">Analysez des stores, générez des cold emails, gérez votre pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('analyzer')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === 'analyzer' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Search className="w-4 h-4 inline mr-1.5" />Analyser
          </button>
          <button
            onClick={() => setView('pipeline')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === 'pipeline' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1.5" />Pipeline
          </button>
        </div>
      </div>

      {view === 'analyzer' && (
        <>
          {/* Bulk analyzer */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              Analyse en masse de stores Shopify
            </h3>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"Collez les URLs des stores (une par ligne) :\nhttps://example.myshopify.com\nhttps://autre-boutique.com"}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500/50 transition-colors"
              rows={4}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-zinc-600">
                {urls.split('\n').filter(u => u.trim()).length} URL(s) détectée(s)
              </span>
              <button
                onClick={analyzeStores}
                disabled={analyzing || !urls.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl text-sm font-medium transition-all"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {analyzing ? 'Analyse en cours...' : 'Analyser'}
              </button>
            </div>
          </div>

          {/* Results */}
          {prospects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">{prospects.length} prospect(s) analysé(s)</h3>
                <span className="text-xs text-zinc-500">Triés par score (pire en premier)</span>
              </div>
              {[...prospects].sort((a, b) => a.score - b.score).map((prospect) => (
                <motion.div
                  key={prospect.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <a href={`https://${prospect.url}`} target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:text-violet-400 transition-colors flex items-center gap-1">
                          {prospect.url} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getScoreBg(prospect.score)} ${getScoreColor(prospect.score)}`}>
                          Score: {prospect.score}/100
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {prospect.issues.map((issue, i) => (
                          <span key={i} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />{issue}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>ROI estimé : <b className="text-emerald-400">{prospect.roiEstimate}€/mois</b></span>
                        <span>Statut : <b className="text-zinc-300 capitalize">{prospect.status}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => generateColdEmail(prospect)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg text-xs font-medium transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" /> Générer email
                      </button>
                      <select
                        value={prospect.status}
                        onChange={(e) => updateProspectStatus(prospect.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
                      >
                        {PIPELINE_COLS.map(col => (
                          <option key={col.id} value={col.id}>{col.title}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteProspect(prospect.id)}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {PIPELINE_COLS.map(col => {
            const colProspects = prospects.filter(p => p.status === col.id)
            return (
              <div key={col.id} className="rounded-2xl border border-white/5 bg-[#0a0a0a]/50 p-3 flex flex-col gap-3 min-h-[50vh]">
                <div className="flex items-center justify-between px-2 mb-1">
                  <h4 className="font-bold text-white text-xs tracking-widest uppercase">{col.title}</h4>
                  <span className="bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-bold">{colProspects.length}</span>
                </div>
                {colProspects.map(p => (
                  <div key={p.id} className={`bg-[#111] border ${col.color} p-3 rounded-xl`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getScoreBg(p.score)} ${getScoreColor(p.score)}`}>{p.score}/100</span>
                      <span className="text-[10px] text-emerald-400 font-medium">{p.roiEstimate}€</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate mb-2">{p.url}</p>
                    <div className="flex gap-1">
                      {PIPELINE_COLS.map((c, i) => {
                        const currentIdx = PIPELINE_COLS.findIndex(x => x.id === p.status)
                        if (i === currentIdx) return null
                        if (Math.abs(i - currentIdx) > 1) return null
                        return (
                          <button
                            key={c.id}
                            onClick={() => updateProspectStatus(p.id, c.id)}
                            className="flex-1 text-[9px] py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 transition-all"
                          >
                            {i < currentIdx ? '←' : '→'} {c.title.split(' ')[0]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {colProspects.length === 0 && (
                  <div className="text-center p-6 border border-white/5 border-dashed rounded-xl text-zinc-700 text-xs">Vide</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Email draft modal */}
      <AnimatePresence>
        {(emailDraft || generatingEmail) && selectedProspect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setEmailDraft(''); setSelectedProspect(null) }}
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
                  <Mail className="w-5 h-5 text-violet-400" />
                  Cold email — {selectedProspect.url}
                </h3>
                <button onClick={() => { setEmailDraft(''); setSelectedProspect(null) }} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              {generatingEmail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                  <span className="ml-3 text-zinc-400">Génération en cours...</span>
                </div>
              ) : (
                <>
                  <pre className="bg-black/30 border border-white/5 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {emailDraft}
                  </pre>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { navigator.clipboard.writeText(emailDraft) }}
                      className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                      <Copy className="w-4 h-4 inline mr-1.5" /> Copier l'email
                    </button>
                    <button
                      onClick={() => generateColdEmail(selectedProspect)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-sm font-medium transition-all border border-white/10"
                    >
                      <RefreshCw className="w-4 h-4 inline mr-1.5" /> Régénérer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
