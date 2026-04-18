import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mic, MessageSquare, Shield, Play, Pause,
  CheckCircle2, ArrowRight, ArrowLeft, Loader2, X,
  Volume2, BookOpen, Zap,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const VOICES = [
  { id: 'jUHQdLfy668sllNiNTSW', name: 'Clement', gender: 'Homme', desc: 'Calme, clair, narratif', accent: 'Parisien', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/jUHQdLfy668sllNiNTSW/manifest.json' },
  { id: 'uyCFY7D8n0oaM5Smchqu', name: 'Chloe', gender: 'Femme', desc: 'Commerciale, impactante', accent: 'Standard', previewUrl: null },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'Femme', desc: 'Mature, rassurante', accent: 'International', previewUrl: null },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'Homme', desc: 'Chaleureux, captivant', accent: 'International', previewUrl: null },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'Femme', desc: 'Professionnelle, claire', accent: 'International', previewUrl: null },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'Homme', desc: 'Posé, broadcaster', accent: 'International', previewUrl: null },
]

const STEPS = [
  { id: 'voice', title: 'Choisir la voix', icon: Mic },
  { id: 'greeting', title: 'Message d\'accueil', icon: MessageSquare },
  { id: 'knowledge', title: 'Connaissances', icon: BookOpen },
  { id: 'rules', title: 'Regles', icon: Shield },
  { id: 'test', title: 'Tester', icon: Play },
  { id: 'install', title: 'Installer', icon: Zap },
]

export const VocalAgentWizard = ({ clientId, onComplete, onCancel }) => {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [selectedVoice, setSelectedVoice] = useState('jUHQdLfy668sllNiNTSW')
  const [greeting, setGreeting] = useState('Bonjour et bienvenue ! Comment puis-je vous aider aujourd\'hui ?')
  const [knowledge, setKnowledge] = useState('')
  const [transferNumber, setTransferNumber] = useState('')
  const [maxAmount, setMaxAmount] = useState('100')
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(null)
  const audioRef = useRef(null)

  // Load existing config if any
  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      const { data } = await supabase
        .from('voice_agent_config')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (data) {
        if (data.voice_id) setSelectedVoice(data.voice_id)
        if (data.greeting_message) setGreeting(data.greeting_message)
        if (data.knowledge_base) setKnowledge(data.knowledge_base)
        if (data.transfer_number) setTransferNumber(data.transfer_number)
        if (data.max_amount_before_escalation != null) setMaxAmount(String(data.max_amount_before_escalation))
      }
    })()
  }, [clientId])

  const handlePreviewVoice = async (voiceId) => {
    if (previewPlaying === voiceId) {
      audioRef.current?.pause()
      setPreviewPlaying(null)
      return
    }

    setPreviewPlaying(voiceId)
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': 'sk_dd61baedbaccf891e7379e1b77d1269d32a3dd8cc88678be',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: greeting || 'Bonjour et bienvenue ! Comment puis-je vous aider ?',
          model_id: 'eleven_flash_v2_5',
        }),
      })
      if (!res.ok) throw new Error('Erreur preview')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setPreviewPlaying(null)
      audio.play()
    } catch {
      setPreviewPlaying(null)
      toast.error('Impossible de jouer l\'apercu')
    }
  }

  const handleInstall = async () => {
    setInstalling(true)
    try {
      // Save voice config (full)
      await supabase.from('voice_agent_config').upsert({
        client_id: clientId,
        is_active: true,
        voice_id: selectedVoice,
        greeting_message: greeting,
        knowledge_base: knowledge || null,
        transfer_number: transferNumber || null,
        max_amount_before_escalation: maxAmount ? Number(maxAmount) : null,
        escalation_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })

      // Install on Shopify
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/engine/shopify-vocal-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'install', client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur installation')

      setInstalled(true)
      toast.success('Agent vocal installe sur votre boutique !')
    } catch (err) {
      toast.error(err.message)
    }
    setInstalling(false)
  }

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause() }
  }, [])

  const currentStep = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-[14px]">Configurer votre agent vocal</span>
            </div>
            <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {/* Progress */}
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-white' : 'bg-white/20'}`} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-white/80 text-[12px]">{currentStep.title}</p>
            <span className="text-white/40 text-[11px]">{step + 1}/{STEPS.length}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

              {/* Step 1: Voice */}
              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-[13px] text-[#9ca3af] mb-4">Choisissez la voix de votre agent. Cliquez sur une voix pour l'ecouter.</p>
                  {VOICES.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        selectedVoice === voice.id ? 'border-violet-500 bg-violet-50/50' : 'border-[#f0f0f0] hover:border-[#e0e0e0]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        voice.gender === 'Homme' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                      }`}>
                        {voice.name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">{voice.name}</p>
                        <p className="text-[11px] text-[#9ca3af]">{voice.gender} · {voice.desc} · {voice.accent}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice.id) }}
                        className="p-2 rounded-lg bg-[#f5f5f5] hover:bg-[#ebebeb] transition-colors"
                      >
                        {previewPlaying === voice.id ? <Pause className="w-4 h-4 text-violet-600" /> : <Play className="w-4 h-4 text-[#9ca3af]" />}
                      </button>
                      {selectedVoice === voice.id && <CheckCircle2 className="w-5 h-5 text-violet-600" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Greeting */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-[13px] text-[#9ca3af]">C'est la premiere phrase que votre agent dira quand un client commence une conversation.</p>
                  <textarea
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#fafafa] border border-[#ebebeb] rounded-xl text-[13px] text-[#1a1a1a] outline-none resize-none focus:ring-1 focus:ring-violet-300"
                    placeholder="Bonjour et bienvenue ! Comment puis-je vous aider ?"
                  />
                  <button
                    onClick={() => handlePreviewVoice(selectedVoice)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 text-[12px] font-semibold rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {previewPlaying ? 'Ecouter...' : 'Ecouter le message'}
                  </button>
                </div>
              )}

              {/* Step 3: Knowledge */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-[13px] text-[#9ca3af]">Ajoutez les informations cles que votre agent doit connaitre. Plus il en sait, mieux il repond.</p>
                  <textarea
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 bg-[#fafafa] border border-[#ebebeb] rounded-xl text-[13px] text-[#1a1a1a] outline-none resize-y focus:ring-1 focus:ring-violet-300"
                    placeholder="Ex: Livraison gratuite a partir de 50€. Retour sous 30 jours. Le serum hydratant convient aux peaux sensibles..."
                  />
                  <p className="text-[11px] text-[#9ca3af]">L'agent utilise aussi la base de connaissances que vous avez configuree dans "Mon Agent".</p>
                </div>
              )}

              {/* Step 4: Rules */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-[13px] text-[#9ca3af]">Definissez quand votre agent doit transferer vers un humain.</p>

                  <div>
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Numero de transfert</label>
                    <input
                      type="tel"
                      value={transferNumber}
                      onChange={(e) => setTransferNumber(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="mt-1 w-full px-4 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-violet-300"
                    />
                    <p className="text-[10px] text-[#9ca3af] mt-1">L'agent transferera l'appel a ce numero si besoin.</p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Montant max avant escalade</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="w-24 px-3 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-violet-300"
                      />
                      <span className="text-[13px] text-[#9ca3af]">€ — au-dessus, l'agent transfere vers un humain</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#fafafa] rounded-xl">
                    <p className="text-[11px] text-[#9ca3af]">L'agent transfere aussi automatiquement si :</p>
                    <ul className="mt-1 space-y-1 text-[11px] text-[#1a1a1a]">
                      <li>• Le client demande explicitement a parler a un humain</li>
                      <li>• Le client est tres agressif</li>
                      <li>• Le client mentionne un avocat ou une plainte</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 5: Test */}
              {step === 4 && (
                <div className="space-y-4 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
                    <Phone className="w-8 h-8 text-violet-600" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Testez votre agent</h3>
                  <p className="text-[13px] text-[#9ca3af]">Verifiez que tout fonctionne avant d'installer sur votre site.</p>
                  <a
                    href="https://elevenlabs.io/app/conversational-ai/agents/agent_6901kns1pd7yfxz9nk6cq0f7gaq4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-violet-600 text-white text-[13px] font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                  >
                    <Play className="w-4 h-4" /> Lancer un appel test
                  </a>
                  <p className="text-[11px] text-[#9ca3af]">L'appel test s'ouvre dans un nouvel onglet.</p>
                </div>
              )}

              {/* Step 6: Install */}
              {step === 5 && (
                <div className="space-y-4 text-center py-4">
                  {!installed ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <Zap className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Pret a installer</h3>
                      <p className="text-[13px] text-[#9ca3af]">Un bouton d'appel vocal apparaitra sur votre boutique Shopify.</p>
                      <div className="p-4 bg-[#fafafa] rounded-xl text-left space-y-2">
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> <span>Voix : {VOICES.find(v => v.id === selectedVoice)?.name}</span></div>
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> <span>Message : "{greeting.substring(0, 40)}..."</span></div>
                        {transferNumber && <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> <span>Transfert : {transferNumber}</span></div>}
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> <span>Escalade auto au-dessus de {maxAmount}€</span></div>
                      </div>
                      <button
                        onClick={handleInstall}
                        disabled={installing}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-cta text-white text-[13px] font-semibold rounded-xl hover:bg-[#003725] disabled:opacity-50 transition-colors"
                      >
                        {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {installing ? 'Installation...' : 'Installer sur ma boutique'}
                      </button>
                    </>
                  ) : (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5 }}
                        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </motion.div>
                      <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Agent vocal installe !</h3>
                      <p className="text-[13px] text-[#9ca3af]">Vos clients peuvent maintenant parler a votre agent directement sur votre site.</p>
                      <button
                        onClick={onComplete}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-cta text-white text-[13px] font-semibold rounded-xl hover:bg-[#003725] transition-colors"
                      >
                        Terminer
                      </button>
                    </>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!installed && (
          <div className="px-6 py-4 border-t border-[#f0f0f0] flex items-center justify-between">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
              className="flex items-center gap-1 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {step === 0 ? 'Annuler' : 'Retour'}
            </button>
            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white text-[12px] font-semibold rounded-lg hover:bg-violet-700 transition-colors"
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
