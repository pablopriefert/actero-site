import React, { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, Mail, Wand2, PlayCircle,
  CheckCircle2, ArrowRight, ArrowLeft, X,
  Sparkles, Loader2, Send,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { trackEvent } from '../../lib/analytics'

/**
 * SetupWizard — full-screen overlay qui guide un nouveau client à travers
 * les 4 étapes essentielles pour activer son agent en moins de 5 minutes.
 *
 * Différence clé avec SetupChecklist (liste plate cliquable) :
 * - Flow séquentiel (une étape à la fois) — pas de navigation entre onglets
 * - Chaque action (OAuth, form, test) se passe DANS l'overlay
 * - Progress bar + animation à la completion
 * - Dismissible (localStorage) → retombe sur SetupChecklist normal
 *
 * Props:
 *   clientId     — uuid du client
 *   onComplete   — callback quand les 4 essentielles sont done
 *   onDismiss    — callback quand user ferme (wizard-dismissed-{clientId})
 */
export function SetupWizard({ clientId, onComplete, onDismiss }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)

  // ── Progress data (same sources as SetupChecklist) ───────────────────
  const { data: progress } = useQuery({
    queryKey: ['setup-wizard', clientId],
    queryFn: async () => {
      const [shopifyRes, emailRes, settingsRes, runsRes] = await Promise.all([
        supabase.from('client_shopify_connections').select('id, shop_domain').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_integrations').select('id, provider').eq('client_id', clientId).eq('status', 'active').in('provider', ['smtp_imap', 'resend', 'gmail']),
        supabase.from('client_settings').select('brand_tone').eq('client_id', clientId).maybeSingle(),
        supabase.from('engine_runs_v2').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ])
      return {
        shopify: !!shopifyRes.data,
        shopifyDomain: shopifyRes.data?.shop_domain || null,
        email: (emailRes.data || []).length > 0,
        tone: !!(settingsRes.data?.brand_tone && settingsRes.data.brand_tone.trim().length > 10),
        tested: (runsRes.count || 0) > 0,
      }
    },
    enabled: !!clientId,
    refetchOnWindowFocus: true,
    refetchInterval: 8000, // refresh post-OAuth callbacks
  })

  const steps = useMemo(() => [
    { id: 'shopify', label: 'Boutique', icon: ShoppingBag, done: progress?.shopify },
    { id: 'tone', label: 'Ton de marque', icon: Wand2, done: progress?.tone },
    { id: 'tested', label: 'Premier test', icon: PlayCircle, done: progress?.tested },
  ], [progress])

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  // Auto-advance : si l'étape en cours devient done, avance à la suivante (+0.8s pour voir ✅)
  React.useEffect(() => {
    if (!progress) return
    if (steps[currentStep]?.done && currentStep < steps.length - 1) {
      const next = steps.findIndex((s, i) => i > currentStep && !s.done)
      if (next > -1) {
        const t = setTimeout(() => setCurrentStep(next), 800)
        return () => clearTimeout(t)
      }
    }
  }, [progress, currentStep, steps])

  // Auto-trigger onComplete quand tout est done
  React.useEffect(() => {
    if (allDone && onComplete) onComplete()
  }, [allDone, onComplete])

  const handleDismiss = () => {
    localStorage.setItem(`setup-wizard-dismissed-${clientId}`, 'true')
    // Analytics
    trackEvent('Setup Wizard Dismissed', { completed_steps: completedCount })
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#F9F7F1]/95 backdrop-blur-sm overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        <div className="min-h-full flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f0] bg-white/80 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cta flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 id="wizard-title" className="text-[15px] font-bold text-[#1a1a1a] tracking-tight">
                  Configurer mon agent
                </h1>
                <p className="text-[12px] text-[#71717a]">En moins de 5 minutes</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Fermer le wizard et continuer sans guide"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#fafafa] transition-colors"
            >
              Continuer sans guide <X className="w-4 h-4" />
            </button>
          </header>

          {/* Progress strip */}
          <div className="px-6 py-4 bg-white border-b border-[#f0f0f0]">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                {steps.map((step, i) => (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => setCurrentStep(i)}
                      aria-label={`Aller à l'étape ${i + 1} : ${step.label}`}
                      className={`flex flex-col items-center gap-1 transition-all ${i === currentStep ? 'scale-105' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        step.done
                          ? 'bg-cta border-cta text-white'
                          : i === currentStep
                            ? 'bg-white border-cta text-cta'
                            : 'bg-white border-[#e5e5e5] text-[#9ca3af]'
                      }`}>
                        {step.done ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                      </div>
                      <span className={`text-[11px] font-semibold ${i === currentStep ? 'text-[#1a1a1a]' : step.done ? 'text-cta' : 'text-[#9ca3af]'}`}>
                        {step.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${steps[i].done ? 'bg-cta' : 'bg-[#e5e5e5]'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-center text-[11px] text-[#9ca3af] font-medium">
                {completedCount}/{steps.length} étapes · {progressPct}% complété
              </p>
            </div>
          </div>

          {/* Step content */}
          <main className="flex-1 px-6 py-10 md:py-16">
            <div className="max-w-3xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {currentStep === 0 && <StepShopify progress={progress} />}
                  {currentStep === 1 && <StepTone clientId={clientId} progress={progress} queryClient={queryClient} toast={toast} />}
                  {currentStep === 2 && <StepTest clientId={clientId} progress={progress} queryClient={queryClient} toast={toast} />}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-10 max-w-3xl mx-auto">
                <button
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-[#71717a] hover:text-[#1a1a1a] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" /> Précédent
                </button>
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-cta text-white hover:bg-[#003725] transition-colors"
                  >
                    {steps[currentStep]?.done ? 'Suivant' : 'Passer pour plus tard'} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : allDone ? (
                  <button
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-cta text-white hover:bg-[#003725] transition-colors"
                  >
                    🎉 Terminé — aller au dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ───────── Step 1 : Shopify (OAuth direct) ─────────
function StepShopify({ progress }) {
  const [shopDomain, setShopDomain] = useState('')
  const [connecting, setConnecting] = useState(false)

  // /api/shopify/install exige ?shop= (400 sinon) et lit ?token= pour
  // retrouver le client_id au callback. On demande donc le domaine puis on
  // redirige avec le domaine normalisé + le token de session Supabase.
  const connectShopify = async () => {
    let shop = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!shop) return
    if (!shop.includes('.')) shop += '.myshopify.com'
    setConnecting(true)
    trackEvent('Setup Wizard Shopify Clicked')
    const { data: { session } } = await supabase.auth.getSession()
    window.location.href =
      `/api/shopify/install?shop=${encodeURIComponent(shop)}&token=${encodeURIComponent(session?.access_token || '')}`
  }

  if (progress?.shopify) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Boutique connectée ✅</h2>
        <p className="text-[#71717a]">
          <span className="font-mono text-[#1a1a1a]">{progress.shopifyDomain}</span> est liée à Actero.
        </p>
      </div>
    )
  }
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1a1a1a] mb-3 text-center tracking-tight">
        Connectez votre boutique
      </h2>
      <p className="text-[#71717a] text-center mb-10 max-w-lg mx-auto">
        L'agent IA va lire votre catalogue, vos politiques de retour et vos commandes pour répondre à vos clients — en lecture seule, 100% RGPD.
      </p>
      <div className="space-y-3 max-w-md mx-auto">
        <input
          type="text"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') connectShopify() }}
          placeholder="ma-boutique.myshopify.com"
          autoComplete="off"
          spellCheck={false}
          className="w-full px-4 py-3.5 rounded-2xl border border-[#e5e5e5] text-[15px] text-[#1a1a1a] placeholder:text-[#a1a1aa] focus:outline-none focus:border-cta focus:ring-2 focus:ring-cta/20 transition-all"
        />
        <p className="text-[12px] text-[#a1a1aa] px-1 -mt-1">
          Trouvez-le dans Shopify Admin → Paramètres → Domaines
        </p>
        <button
          type="button"
          onClick={connectShopify}
          disabled={!shopDomain.trim() || connecting}
          className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border-2 border-cta bg-cta text-white font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span>{connecting ? 'Redirection…' : 'Connecter Shopify (OAuth)'}</span>
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
        <a
          href="/client/integrations"
          className="flex items-center justify-center w-full px-5 py-3 rounded-2xl border border-[#f0f0f0] text-[#71717a] hover:text-[#1a1a1a] hover:bg-white transition-colors text-[13px]"
        >
          Utiliser WooCommerce, Webflow ou autre →
        </a>
      </div>
    </div>
  )
}

// ───────── Step : Tone ─────────
function StepTone({ clientId, progress, queryClient, toast }) {
  const [formality, setFormality] = useState('vous')
  const [emojiUse, setEmojiUse] = useState('parfois')
  const [signature, setSignature] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const tone = `Agent SAV ${formality === 'tu' ? 'tutoyant' : 'vouvoyant'}, émojis ${emojiUse}. ${signature ? `Signature : « ${signature} ».` : ''} Ton chaleureux, empathique, efficace. Réponses courtes et actionnables.`
    try {
      await supabase.from('client_settings').upsert({ client_id: clientId, brand_tone: tone }, { onConflict: 'client_id' })
      queryClient.invalidateQueries({ queryKey: ['setup-wizard', clientId] })
      // Analytics
      trackEvent('Setup Wizard Tone Saved', { formality, emoji: emojiUse })
      toast.success('Ton configuré ✓')
    } catch (err) {
      console.error('[SetupWizard] tone save failed:', err)
      toast.error("Impossible d'enregistrer le ton. Réessayez.")
    }
    setSaving(false)
  }

  if (progress?.tone) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Ton configuré ✅</h2>
        <p className="text-[#71717a]">Vous pourrez affiner dans <span className="font-mono">Configuration</span> plus tard.</p>
      </div>
    )
  }
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1a1a1a] mb-3 text-center tracking-tight">
        Comment l'agent doit-il parler à vos clients ?
      </h2>
      <p className="text-[#71717a] text-center mb-10 max-w-lg mx-auto">
        3 questions rapides. Vous pourrez toujours affiner dans le dashboard.
      </p>
      <div className="space-y-6 max-w-md mx-auto">
        {/* Tu/Vous */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1a1a1a] mb-2">Formalité</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'tu', l: 'Tutoyer' }, { v: 'vous', l: 'Vouvoyer' }].map(opt => (
              <button key={opt.v} onClick={() => setFormality(opt.v)}
                className={`px-4 py-3 rounded-xl border-2 text-[13px] font-semibold transition-colors ${formality === opt.v ? 'border-cta bg-cta/5 text-cta' : 'border-[#f0f0f0] text-[#71717a] hover:border-[#d4d4d4]'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        {/* Émojis */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1a1a1a] mb-2">Utilisation des émojis</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: 'jamais', l: 'Jamais' }, { v: 'parfois', l: 'Parfois' }, { v: 'souvent', l: 'Souvent' }].map(opt => (
              <button key={opt.v} onClick={() => setEmojiUse(opt.v)}
                className={`px-3 py-3 rounded-xl border-2 text-[13px] font-semibold transition-colors ${emojiUse === opt.v ? 'border-cta bg-cta/5 text-cta' : 'border-[#f0f0f0] text-[#71717a] hover:border-[#d4d4d4]'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        {/* Signature */}
        <div>
          <label htmlFor="signature" className="block text-[13px] font-semibold text-[#1a1a1a] mb-2">Signature de fin (optionnel)</label>
          <input id="signature" type="text" value={signature} onChange={e => setSignature(e.target.value)}
            placeholder="Ex : L'équipe Acme, à votre service."
            className="w-full px-4 py-3 rounded-xl border-2 border-[#f0f0f0] text-[14px] focus:border-cta focus:outline-none transition-colors" />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-cta text-white font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Enregistrer le ton
        </button>
      </div>
    </div>
  )
}

// ───────── Step 4 : Test ─────────
function StepTest({ clientId, progress, queryClient, toast }) {
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [aiResponse, setAiResponse] = useState(null)
  const [running, setRunning] = useState(false)

  const presetQuestions = [
    { id: 'wismo', q: 'Où est ma commande 4852 ? Je l\'ai commandée il y a 5 jours.' },
    { id: 'return', q: 'Comment retourner un produit ? La taille ne convient pas.' },
    { id: 'stock', q: 'Est-ce que vous avez ce t-shirt en taille M ?' },
  ]

  const runTest = async (question) => {
    if (running) return
    setSelectedQuestion(question)
    setAiResponse(null)
    setRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // Route via the real Engine Gateway (même contrat que le Simulateur).
      // Un run gateway écrit dans engine_runs_v2 → l'étape « Premier test »
      // se valide automatiquement. (/api/engine/simulate n'existe pas.)
      const res = await fetch('/api/engine/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          client_id: clientId,
          event_type: 'widget_message',
          source: 'widget_message',
          customer_email: 'test@actero-test.com',
          customer_name: 'Client Test',
          message: question.q,
          subject: 'Test agent (setup wizard)',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Simulation failed')
      setAiResponse(data.response || data.aiResponse || 'Réponse générée ✓')
      queryClient.invalidateQueries({ queryKey: ['setup-wizard', clientId] })
      // Analytics
      trackEvent('Setup Wizard Test Run', { question_id: question.id })
      toast.success('Test réussi ✓')
    } catch (err) {
      console.error('[SetupWizard] test failed:', err)
      toast.error(`Test échoué : ${err.message}`)
    }
    setRunning(false)
  }

  if (progress?.tested) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Agent testé ✅</h2>
        <p className="text-[#71717a]">Votre agent est prêt à traiter les vrais clients.</p>
      </div>
    )
  }
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1a1a1a] mb-3 text-center tracking-tight">
        Testez votre agent sur 1 vraie question
      </h2>
      <p className="text-[#71717a] text-center mb-10 max-w-lg mx-auto">
        Cliquez sur une question ci-dessous — l'agent y répondra comme s'il recevait ce message d'un vrai client.
      </p>
      <div className="space-y-3 max-w-xl mx-auto">
        {presetQuestions.map(q => (
          <button
            key={q.id}
            onClick={() => runTest(q)}
            disabled={running}
            className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all ${
              selectedQuestion?.id === q.id
                ? 'border-cta bg-cta/5'
                : 'border-[#f0f0f0] hover:border-cta/30 hover:bg-white'
            } disabled:opacity-50`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f0f0f0] flex items-center justify-center">
                <Send className="w-4 h-4 text-[#71717a]" />
              </div>
              <p className="text-[14px] text-[#1a1a1a] font-medium flex-1">{q.q}</p>
              {running && selectedQuestion?.id === q.id && <Loader2 className="w-4 h-4 animate-spin text-cta" />}
            </div>
          </button>
        ))}

        {/* AI Response */}
        {aiResponse && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 px-5 py-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cta flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-cta uppercase tracking-wider mb-1">Réponse de votre agent</p>
                <p className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
