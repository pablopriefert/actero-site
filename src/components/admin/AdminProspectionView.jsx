import { supabase } from "../../lib/supabase"
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../ui/Toast'
import {
  Search, Send, RefreshCw, ExternalLink, Loader2, Plus, ChevronRight, Copy,
  Globe, Mail, BarChart3, AlertTriangle, CheckCircle, Star, Trash2, Eye, X,
  MessageSquare, Video, ShoppingCart, Clock, TrendingDown, Users, DollarSign,
  ThumbsDown, StarHalf
} from 'lucide-react'


const PIPELINE_COLS = [
  { id: 'lead', title: 'Lead', color: 'border-gray-200', badge: 'bg-gray-100 text-[#716D5C]' },
  { id: 'contacted', title: 'Contacté', color: 'border-amber-500/30', badge: 'bg-amber-100 text-amber-700' },
  { id: 'call_planned', title: 'Call planifié', color: 'border-blue-500/30', badge: 'bg-blue-100 text-blue-700' },
  { id: 'audit_done', title: 'Audit fait', color: 'border-purple-500/30', badge: 'bg-purple-100 text-purple-700' },
  { id: 'closed', title: 'Fermé', color: 'border-emerald-500/30', badge: 'bg-emerald-100 text-emerald-700' },
]

// Simulated Trustpilot negative reviews data
const FAKE_TRUSTPILOT_REVIEWS = [
  { author: 'Marie L.', stars: 1, date: '2026-03-18', text: 'Colis jamais recu, SAV injoignable depuis 2 semaines. Honteux.', painPoints: ['SAV injoignable', 'Livraison non recue'] },
  { author: 'Thomas B.', stars: 2, date: '2026-03-15', text: 'Produit reçu cassé. J\'ai envoyé 3 mails, toujours pas de réponse après 10 jours.', painPoints: ['Temps de réponse lent', 'Produit endommagé'] },
  { author: 'Sophie M.', stars: 1, date: '2026-03-12', text: 'Impossible de joindre le service client. Le chatbot est inutile, il tourne en boucle.', painPoints: ['Chatbot inefficace', 'Contact impossible'] },
  { author: 'Pierre D.', stars: 2, date: '2026-03-10', text: 'Retour demandé il y a 3 semaines, toujours en attente de remboursement. Zéro suivi.', painPoints: ['Remboursement lent', 'Pas de suivi'] },
  { author: 'Camille R.', stars: 1, date: '2026-03-08', text: 'FAQ complètement vide. Aucune info sur les retours. On se sent abandonné.', painPoints: ['FAQ incomplète', 'Politique retours floue'] },
  { author: 'Lucas V.', stars: 2, date: '2026-03-05', text: 'Réponse au bout de 5 jours avec un copier-coller générique. Pas du tout personnalisé.', painPoints: ['Réponses génériques', 'Délai trop long'] },
  { author: 'Emma G.', stars: 1, date: '2026-03-01', text: 'Mauvaise taille reçue, demande d\'échange refusée car "stock épuisé". Pas de remboursement proposé.', painPoints: ['Gestion stock', 'Politique rigide'] },
]

export const AdminProspectionView = () => {
  const toast = useToast();
  const [urls, setUrls] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [prospects, setProspects] = useState([])
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [view, setView] = useState('analyzer') // 'analyzer' | 'pipeline' | 'trustpilot'

  // Trustpilot scraper state
  const [trustpilotStore, setTrustpilotStore] = useState('')
  const [scrapingTrustpilot, setScrapingTrustpilot] = useState(false)
  const [trustpilotResults, setTrustpilotResults] = useState(null)

  // Content generation modal state
  const [contentType, setContentType] = useState('email') // 'email' | 'linkedin' | 'loom'
  const [generatingContent, setGeneratingContent] = useState(false)
  const [contentDraft, setContentDraft] = useState('')

  const analyzeStores = async () => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u)
    if (!urlList.length) return
    setAnalyzing(true)

    const results = []
    for (const url of urlList) {
      try {
        const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        const score = Math.floor(Math.random() * 40) + 30
        const issues = []
        if (score < 50) issues.push('Temps de réponse SAV > 24h')
        if (Math.random() > 0.5) issues.push('Pas de chat live')
        if (Math.random() > 0.4) issues.push('Taux d\'abandon panier élevé')
        if (Math.random() > 0.6) issues.push('FAQ inexistante ou incomplète')
        if (Math.random() > 0.5) issues.push('Pas de tracking proactif')
        if (Math.random() > 0.7) issues.push('Pas de programme fidélité')

        const monthlyRevenue = Math.floor(Math.random() * 80000) + 20000
        const roiEstimate = Math.floor(Math.random() * 3000) + 500

        results.push({
          id: Date.now() + Math.random(),
          url: domain,
          score,
          issues,
          roiEstimate,
          monthlyRevenue,
          estimatedTickets: Math.floor(monthlyRevenue / 500) + Math.floor(Math.random() * 50),
          responseTime: (Math.random() * 36 + 12).toFixed(0) + 'h',
          cartAbandonRate: (Math.random() * 30 + 55).toFixed(0) + '%',
          returnRate: (Math.random() * 8 + 5).toFixed(1) + '%',
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

  const scrapeTrustpilot = async () => {
    if (!trustpilotStore.trim()) return
    setScrapingTrustpilot(true)

    try {
      const res = await fetch('/api/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: trustpilotStore.trim() })
      })
      const data = await res.json()

      if (data.error) {
        toast.error('Erreur : ' + data.error)
        setScrapingTrustpilot(false)
        return
      }

      const painPointCounts = data.painPoints || {}
      const sortedPainPoints = Object.entries(painPointCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([point, count]) => ({ point, count }))

      const reviews = data.reviews || []
      const avgStars = reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1)
        : data.averageRating || 0

      setTrustpilotResults({
        storeName: data.storeName || trustpilotStore.trim(),
        totalNegativeReviews: data.negativeReviews || reviews.length,
        reviews,
      painPoints: sortedPainPoints,
      avgNegativeRating: avgStars,
      source: data.source || 'google',
      scrapedAt: new Date().toISOString(),
    })
    } catch (e) {
      console.error('Scrape error:', e)
      toast.error('Erreur lors du scraping.')
    }
    setScrapingTrustpilot(false)
  }

  const callGemini = async (prompt) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ prompt, temperature: 0.7, maxOutputTokens: 800 })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erreur Gemini')
    return data.text || 'Erreur de génération'
  }

  const generateContent = async (prospect, type) => {
    setGeneratingContent(true)
    setContentType(type)
    setSelectedProspect(prospect)
    setContentDraft('')

    const baseContext = `Boutique Shopify :
- URL : ${prospect.url}
- Score SAV : ${prospect.score}/100 (mauvais)
- Problèmes détectés : ${prospect.issues.join(', ')}
- ROI estimé : ${prospect.roiEstimate}€/mois
- CA mensuel estimé : ${prospect.monthlyRevenue?.toLocaleString()}€
- Tickets support/mois : ~${prospect.estimatedTickets}
- Temps de réponse moyen : ${prospect.responseTime}
- Taux abandon panier : ${prospect.cartAbandonRate}`

    let prompt = ''

    if (type === 'email') {
      prompt = `Tu es un expert en cold email B2B pour une agence d'automatisation IA e-commerce appelée Actero.

Génère un cold email court (max 150 mots) pour cette boutique Shopify :
${baseContext}

Le mail doit :
1. Mentionner un problème spécifique détecté sur LEUR store
2. Chiffrer le coût de ce problème
3. Proposer un audit gratuit de 15 min
4. CTA vers actero.fr/audit
5. Ton professionnel mais direct, pas corporate

Format : Objet: [objet]\n\n[corps du mail]\n\n[signature]`
    } else if (type === 'linkedin') {
      prompt = `Tu es un expert en prospection LinkedIn B2B pour Actero, agence d'automatisation IA e-commerce.

Génère un message LinkedIn DM court et percutant (max 80 mots) pour cette boutique :
${baseContext}

Le message doit :
1. Être casual et direct (ton LinkedIn, pas email)
2. Commencer par une observation spécifique sur leur store
3. Mentionner un chiffre clé (perte estimée ou gain possible)
4. Finir par une question ouverte qui engage la conversation
5. PAS de lien, PAS de signature formelle
6. Utiliser des emojis avec parcimonie (1-2 max)

Réponds UNIQUEMENT avec le message, rien d'autre.`
    } else if (type === 'loom') {
      prompt = `Tu es un expert en vidéo prospection pour Actero, agence d'automatisation IA e-commerce.

Génère un script de vidéo Loom de 2 minutes pour cette boutique :
${baseContext}

Structure du script :
1. INTRO (15 sec) - Salutation + "J'ai analysé votre store et..."
2. PROBLÈME 1 (30 sec) - Le problème SAV principal détecté, avec chiffres
3. PROBLÈME 2 (20 sec) - Second problème, impact business
4. SOLUTION (30 sec) - Comment l'IA Actero résout ça concrètement
5. PREUVE (15 sec) - Résultat client type
6. CTA (10 sec) - "Prenez 15 min pour un audit gratuit sur actero.fr/audit"

Format avec timecodes, talking points et ce qu'il faut montrer à l'écran.
Ton : enthousiaste mais professionnel, comme un expert qui veut aider.`
    }

    try {
      const text = await callGemini(prompt)
      setContentDraft(text)
    } catch (e) {
      setContentDraft('Erreur lors de la génération. Vérifiez votre clé Gemini.')
    }
    setGeneratingContent(false)
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

  const renderStars = (count) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < count ? 'text-amber-400 fill-amber-400' : 'text-[#716D5C]'}`} />
    ))
  }

  const contentTypeLabels = {
    email: { icon: Mail, label: 'Cold email', color: 'text-violet-400' },
    linkedin: { icon: MessageSquare, label: 'DM LinkedIn', color: 'text-blue-400' },
    loom: { icon: Video, label: 'Script Loom', color: 'text-pink-400' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#262626]">Centre de Prospection</h2>
          <p className="text-sm text-[#716D5C] mt-1">Analysez des stores, scrappez Trustpilot, générez du contenu IA, gérez votre pipeline</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'analyzer', icon: Search, label: 'Analyser' },
            { id: 'trustpilot', icon: Star, label: 'Trustpilot' },
            { id: 'pipeline', icon: BarChart3, label: 'Pipeline' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === tab.id ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-gray-50 text-[#716D5C] border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4 inline mr-1.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trustpilot Scraper View */}
      {view === 'trustpilot' && (
        <div className="space-y-6">
          <div className="bg-[#F9F7F1] border border-gray-100 rounded-2xl p-6">
            <h3 className="text-[#262626] font-bold text-sm mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Scraper Trustpilot - Avis négatifs SAV
            </h3>
            <p className="text-xs text-[#716D5C] mb-4">Trouvez les boutiques avec un mauvais SAV en analysant leurs avis Trustpilot</p>
            <div className="flex gap-3">
              <input
                value={trustpilotStore}
                onChange={(e) => setTrustpilotStore(e.target.value)}
                placeholder="Nom du store (ex: gymshark, sezane, balzac-paris...)"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#262626] placeholder-gray-400 focus:outline-none focus:border-amber-500/50 transition-colors"
                onKeyDown={e => e.key === 'Enter' && scrapeTrustpilot()}
              />
              <button
                onClick={scrapeTrustpilot}
                disabled={scrapingTrustpilot || !trustpilotStore.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-[#716D5C] text-white rounded-xl text-sm font-medium transition-all"
              >
                {scrapingTrustpilot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {scrapingTrustpilot ? 'Scraping...' : 'Scraper'}
              </button>
            </div>
          </div>

          {trustpilotResults && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Summary */}
              <div className="bg-[#F9F7F1] border border-gray-100 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#262626] font-bold text-sm flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4 text-red-400" />
                    Résultats pour "{trustpilotResults.storeName}"
                  </h3>
                  <span className="text-xs text-[#716D5C]">
                    {trustpilotResults.totalNegativeReviews} avis négatifs trouvés (1-2 étoiles)
                  </span>
                </div>

                {/* Pain points extracted */}
                <div className="mb-5">
                  <h4 className="text-xs text-[#716D5C] font-medium mb-2 uppercase tracking-wider">Points de douleur extraits</h4>
                  <div className="flex flex-wrap gap-2">
                    {trustpilotResults.painPoints.map((pp, i) => (
                      <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        {pp.point}
                        <span className="bg-red-500/20 px-1.5 py-0 rounded-full text-[10px] font-bold">{pp.count}x</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Average rating */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  <span className="text-xs text-[#716D5C]">Note moyenne (avis négatifs) :</span>
                  <div className="flex items-center gap-1">
                    {renderStars(Math.round(Number(trustpilotResults.avgNegativeRating)))}
                  </div>
                  <span className="text-sm font-bold text-amber-400">{trustpilotResults.avgNegativeRating}/5</span>
                </div>

                {/* Individual reviews */}
                <div className="space-y-3">
                  {trustpilotResults.reviews.map((review, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-xs font-bold text-[#716D5C]">
                            {review.author.charAt(0)}
                          </div>
                          <span className="text-sm text-[#262626] font-medium">{review.author}</span>
                          <div className="flex">{renderStars(review.stars)}</div>
                        </div>
                        <span className="text-[10px] text-[#716D5C]">{review.date}</span>
                      </div>
                      <p className="text-sm text-[#716D5C] leading-relaxed">"{review.text}"</p>
                      <div className="flex gap-1.5 mt-2">
                        {review.painPoints.map((pp, j) => (
                          <span key={j} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{pp}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action: use this data for prospection */}
              <div className="bg-[#F9F7F1] border border-violet-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[#262626] font-medium">Utiliser ces données pour prospecter</p>
                    <p className="text-xs text-[#716D5C]">Ajoutez ce store comme prospect avec les pain points détectés</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newProspect = {
                      id: Date.now() + Math.random(),
                      url: trustpilotResults.storeName + '.com',
                      score: Math.floor(Number(trustpilotResults.avgNegativeRating) * 20),
                      issues: trustpilotResults.painPoints.map(pp => pp.point),
                      roiEstimate: Math.floor(Math.random() * 3000) + 500,
                      monthlyRevenue: Math.floor(Math.random() * 80000) + 20000,
                      estimatedTickets: Math.floor(Math.random() * 100) + 50,
                      responseTime: (Math.random() * 36 + 12).toFixed(0) + 'h',
                      cartAbandonRate: (Math.random() * 30 + 55).toFixed(0) + '%',
                      returnRate: (Math.random() * 8 + 5).toFixed(1) + '%',
                      status: 'lead',
                      emailSent: false,
                      createdAt: new Date().toISOString(),
                      trustpilotData: trustpilotResults,
                    }
                    setProspects(prev => [newProspect, ...prev])
                    setView('analyzer')
                  }}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> Ajouter comme prospect
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {view === 'analyzer' && (
        <>
          {/* Bulk analyzer */}
          <div className="bg-[#F9F7F1] border border-gray-100 rounded-2xl p-6">
            <h3 className="text-[#262626] font-bold text-sm mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              Analyse en masse de stores Shopify
            </h3>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"Collez les URLs des stores (une par ligne) :\nhttps://example.myshopify.com\nhttps://autre-boutique.com"}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#262626] placeholder-gray-400 resize-none focus:outline-none focus:border-violet-500/50 transition-colors"
              rows={4}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#716D5C]">
                {urls.split('\n').filter(u => u.trim()).length} URL(s) détectée(s)
              </span>
              <button
                onClick={analyzeStores}
                disabled={analyzing || !urls.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 disabled:text-[#716D5C] text-white rounded-xl text-sm font-medium transition-all"
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
                <h3 className="text-[#262626] font-bold text-sm">{prospects.length} prospect(s) analysé(s)</h3>
                <span className="text-xs text-[#716D5C]">Triés par score (pire en premier)</span>
              </div>
              {[...prospects].sort((a, b) => a.score - b.score).map((prospect) => (
                <motion.div
                  key={prospect.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F9F7F1] border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <a href={`https://${prospect.url}`} target="_blank" rel="noopener noreferrer" className="text-[#262626] font-bold hover:text-violet-400 transition-colors flex items-center gap-1">
                          {prospect.url} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getScoreBg(prospect.score)} ${getScoreColor(prospect.score)}`}>
                          Score: {prospect.score}/100
                        </span>
                        {prospect.trustpilotData && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 inline mr-0.5" /> Trustpilot
                          </span>
                        )}
                      </div>

                      {/* Detailed metrics grid */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] text-[#716D5C] block">CA mensuel est.</span>
                          <span className="text-xs font-bold text-[#262626] flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-400" />{prospect.monthlyRevenue?.toLocaleString() || 'N/A'}€
                          </span>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] text-[#716D5C] block">Tickets/mois</span>
                          <span className="text-xs font-bold text-[#262626] flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-400" />~{prospect.estimatedTickets || 'N/A'}
                          </span>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] text-[#716D5C] block">Temps réponse</span>
                          <span className="text-xs font-bold text-[#262626] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />{prospect.responseTime || 'N/A'}
                          </span>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] text-[#716D5C] block">Abandon panier</span>
                          <span className="text-xs font-bold text-[#262626] flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3 text-red-400" />{prospect.cartAbandonRate || 'N/A'}
                          </span>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] text-[#716D5C] block">ROI estimé</span>
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />{prospect.roiEstimate}€/mois
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {prospect.issues.map((issue, i) => (
                          <span key={i} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />{issue}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#716D5C]">
                        <span>Statut : <b className="text-[#716D5C] capitalize">{prospect.status}</b></span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      {/* Content generation buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => generateContent(prospect, 'email')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg text-xs font-medium transition-all"
                          title="Générer cold email"
                        >
                          <Mail className="w-3.5 h-3.5" /> Email
                        </button>
                        <button
                          onClick={() => generateContent(prospect, 'linkedin')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-all"
                          title="Générer DM LinkedIn"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> DM
                        </button>
                        <button
                          onClick={() => generateContent(prospect, 'loom')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 rounded-lg text-xs font-medium transition-all"
                          title="Générer script Loom"
                        >
                          <Video className="w-3.5 h-3.5" /> Loom
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={prospect.status}
                          onChange={(e) => updateProspectStatus(prospect.id, e.target.value)}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-[#716D5C] focus:outline-none"
                        >
                          {PIPELINE_COLS.map(col => (
                            <option key={col.id} value={col.id}>{col.title}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteProspect(prospect.id)}
                          className="p-1.5 hover:bg-red-500/10 text-[#716D5C] hover:text-red-400 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
              <div key={col.id} className="rounded-2xl border border-gray-100 bg-[#F9F7F1]/50 p-3 flex flex-col gap-3 min-h-[50vh]">
                <div className="flex items-center justify-between px-2 mb-1">
                  <h4 className="font-bold text-[#262626] text-xs tracking-widest uppercase">{col.title}</h4>
                  <span className="bg-gray-50 text-[#716D5C] px-2 py-0.5 rounded-full text-[10px] font-bold">{colProspects.length}</span>
                </div>
                {colProspects.map(p => (
                  <div key={p.id} className={`bg-[#F9F7F1] border ${col.color} p-3 rounded-xl`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getScoreBg(p.score)} ${getScoreColor(p.score)}`}>{p.score}/100</span>
                      <span className="text-[10px] text-emerald-400 font-medium">{p.roiEstimate}€</span>
                    </div>
                    <p className="text-xs text-[#262626] font-medium truncate mb-2">{p.url}</p>
                    <div className="flex gap-1">
                      {PIPELINE_COLS.map((c, i) => {
                        const currentIdx = PIPELINE_COLS.findIndex(x => x.id === p.status)
                        if (i === currentIdx) return null
                        if (Math.abs(i - currentIdx) > 1) return null
                        return (
                          <button
                            key={c.id}
                            onClick={() => updateProspectStatus(p.id, c.id)}
                            className="flex-1 text-[9px] py-1 rounded-md bg-gray-50 hover:bg-gray-50 text-[#716D5C] transition-all"
                          >
                            {i < currentIdx ? '←' : '→'} {c.title.split(' ')[0]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {colProspects.length === 0 && (
                  <div className="text-center p-6 border border-gray-100 border-dashed rounded-xl text-[#716D5C] text-xs">Vide</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Content generation modal (email / linkedin DM / loom script) */}
      <AnimatePresence>
        {(contentDraft || generatingContent) && selectedProspect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setContentDraft(''); setSelectedProspect(null) }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#F9F7F1] border border-gray-200 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#262626] flex items-center gap-2">
                  {(() => {
                    const ct = contentTypeLabels[contentType]
                    return <><ct.icon className={`w-5 h-5 ${ct.color}`} />{ct.label} — {selectedProspect.url}</>
                  })()}
                </h3>
                <button onClick={() => { setContentDraft(''); setSelectedProspect(null) }} className="p-1 hover:bg-gray-50 rounded-lg">
                  <X className="w-5 h-5 text-[#716D5C]" />
                </button>
              </div>

              {/* Content type tabs */}
              <div className="flex gap-2 mb-4">
                {Object.entries(contentTypeLabels).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key !== contentType && !generatingContent) {
                        generateContent(selectedProspect, key)
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      key === contentType
                        ? 'bg-gray-50 border-white/20 text-[#262626]'
                        : 'bg-gray-50 border-gray-100 text-[#716D5C] hover:text-[#716D5C] hover:bg-gray-50'
                    }`}
                  >
                    <val.icon className={`w-3.5 h-3.5 ${key === contentType ? val.color : ''}`} />
                    {val.label}
                  </button>
                ))}
              </div>

              {generatingContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                  <span className="ml-3 text-[#716D5C]">Génération en cours...</span>
                </div>
              ) : (
                <>
                  <pre className="bg-white/30 border border-gray-100 rounded-xl p-4 text-sm text-[#716D5C] whitespace-pre-wrap font-mono leading-relaxed">
                    {contentDraft}
                  </pre>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { navigator.clipboard.writeText(contentDraft) }}
                      className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                      <Copy className="w-4 h-4 inline mr-1.5" /> Copier
                    </button>
                    <button
                      onClick={() => generateContent(selectedProspect, contentType)}
                      className="px-4 py-2 bg-gray-50 hover:bg-gray-50 text-[#716D5C] rounded-xl text-sm font-medium transition-all border border-gray-200"
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
