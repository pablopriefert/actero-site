import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Loader2, Check, AlertCircle, Sparkles, Send,
  Power, RefreshCw, ShieldCheck, Facebook, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const API_BASE = ''

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

const apiPost = async (path, body) => {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = json?.error || `Erreur ${res.status}`
    const hint = json?.hint ? ` — ${json.hint}` : ''
    throw new Error(base + hint)
  }
  return json
}

const apiGet = async (path) => {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = json?.error || `Erreur ${res.status}`
    throw new Error(base)
  }
  return json
}

const apiPatch = async (path, body) => {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = json?.error || `Erreur ${res.status}`
    throw new Error(base)
  }
  return json
}

// Load Facebook JS SDK dynamically for WhatsApp Embedded Signup
function loadFacebookSDK(appId) {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.FB) return Promise.resolve()
  return new Promise((resolve) => {
    window.fbAsyncInit = function () {
      try {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: 'v21.0',
        })
      } catch (e) {
        // no-op
      }
      resolve()
    }
    if (document.getElementById('facebook-jssdk')) {
      resolve()
      return
    }
    const js = document.createElement('script')
    js.id = 'facebook-jssdk'
    js.src = 'https://connect.facebook.net/en_US/sdk.js'
    js.async = true
    js.defer = true
    js.crossOrigin = 'anonymous'
    document.body.appendChild(js)
  })
}

export const WhatsAppAgentSetupView = ({ clientId }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [loadingFb, setLoadingFb] = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [greeting, setGreeting] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [activating, setActivating] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const promptTimer = useRef(null)
  const greetingTimer = useRef(null)
  const didInit = useRef(false)

  // Fetch WhatsApp config (app_id, config_id) — fallback gracefully if endpoint missing
  const { data: waConfig, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      try {
        return await apiGet('/api/integrations/whatsapp/config')
      } catch (e) {
        return { available: false, error: e.message }
      }
    },
    retry: false,
    staleTime: 60_000,
  })

  // Fetch client_settings for WhatsApp
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['whatsapp-agent-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('whatsapp_agent_enabled, whatsapp_custom_prompt, whatsapp_greeting')
        .eq('client_id', clientId)
        .maybeSingle()
      return data || {}
    },
    enabled: !!clientId,
  })

  // Fetch connected WhatsApp account
  const { data: waAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['whatsapp-account', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      return data || null
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (settings && !didInit.current) {
      setCustomPrompt(settings.whatsapp_custom_prompt || '')
      setGreeting(
        settings.whatsapp_greeting ||
          'Bonjour ! Je suis l\'assistant de votre boutique. Comment puis-je vous aider aujourd\'hui ?'
      )
      didInit.current = true
    }
  }, [settings])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-agent-settings', clientId] })
    queryClient.invalidateQueries({ queryKey: ['whatsapp-account', clientId] })
  }

  // ---------- Wizard actions ----------

  const handleFacebookLogin = async () => {
    if (!waConfig?.available || !waConfig?.app_id || !waConfig?.config_id) {
      toast.error('Integration Meta non disponible pour le moment')
      return
    }
    setLoadingFb(true)
    try {
      await loadFacebookSDK(waConfig.app_id)
      if (!window.FB) {
        throw new Error('Facebook SDK indisponible')
      }
      window.FB.login(
        async (response) => {
          if (response?.authResponse?.code) {
            setExchanging(true)
            try {
              const res = await apiPost('/api/integrations/whatsapp/exchange-code', {
                client_id: clientId,
                code: response.authResponse.code,
              })
              if (res?.success) {
                toast.success('WhatsApp connecte avec succes')
                refresh()
                setStep(2)
              } else {
                throw new Error(res?.error || 'Echec de la connexion')
              }
            } catch (err) {
              toast.error(err.message || 'Impossible de finaliser la connexion')
            } finally {
              setExchanging(false)
            }
          } else {
            toast.error('Connexion annulee')
          }
        },
        {
          config_id: waConfig.config_id,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            version: 'v3',
            feature: 'whatsapp_embedded_signup',
          },
        }
      )
    } catch (e) {
      toast.error(e.message || 'Impossible de charger Facebook SDK')
    } finally {
      setLoadingFb(false)
    }
  }

  const handleSaveCustomPrompt = (val) => {
    setCustomPrompt(val)
    if (promptTimer.current) clearTimeout(promptTimer.current)
    promptTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from('client_settings')
          .update({ whatsapp_custom_prompt: val })
          .eq('client_id', clientId)
      } catch (e) {
        toast.error('Sauvegarde des instructions echouee')
      }
    }, 700)
  }

  const handleSaveGreeting = (val) => {
    if (val.length > 200) return
    setGreeting(val)
    if (greetingTimer.current) clearTimeout(greetingTimer.current)
    greetingTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from('client_settings')
          .update({ whatsapp_greeting: val })
          .eq('client_id', clientId)
      } catch (e) {
        toast.error('Sauvegarde du message d\'accueil echouee')
      }
    }, 700)
  }

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Veuillez saisir un numero de telephone')
      return
    }
    setSendingTest(true)
    setTestResult(null)
    try {
      const res = await apiPost('/api/integrations/whatsapp/send-test', {
        client_id: clientId,
        to: testPhone.trim(),
      })
      if (res?.success) {
        setTestResult({ ok: true, msg: 'Message envoye ! Verifiez votre WhatsApp' })
        toast.success('Message test envoye')
      } else {
        throw new Error(res?.error || 'Echec de l\'envoi')
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Impossible d\'envoyer le message' })
      toast.error(e.message || 'Impossible d\'envoyer le message test')
    } finally {
      setSendingTest(false)
    }
  }

  const handleActivate = async () => {
    setActivating(true)
    try {
      await supabase
        .from('client_settings')
        .update({ whatsapp_agent_enabled: true })
        .eq('client_id', clientId)
      toast.success('Agent WhatsApp active')
      refresh()
    } catch (e) {
      toast.error('Impossible d\'activer l\'agent')
    } finally {
      setActivating(false)
    }
  }

  const handleRefreshStatus = async () => {
    setRefreshing(true)
    try {
      await apiGet('/api/integrations/whatsapp/status')
      refresh()
      toast.success('Statut rafraichi')
    } catch (e) {
      toast.error(e.message || 'Impossible de rafraichir le statut')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Deconnecter WhatsApp ? Votre agent ne pourra plus repondre aux messages clients.')) return
    setDisconnecting(true)
    try {
      await apiPost('/api/integrations/whatsapp/disconnect', { client_id: clientId })
      toast.success('WhatsApp deconnecte')
      didInit.current = false
      refresh()
    } catch (e) {
      toast.error(e.message || 'Echec de la deconnexion')
    } finally {
      setDisconnecting(false)
    }
  }

  const isLoading = settingsLoading || accountLoading
  const isConnected = !!waAccount?.id || !!settings?.whatsapp_agent_enabled

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Agent WhatsApp</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          Vos clients vous envoient un message WhatsApp, votre agent IA repond automatiquement 24/7.
        </p>
      </div>

      {!isConnected ? (
        <WizardView
          step={step}
          setStep={setStep}
          waConfig={waConfig}
          configLoading={configLoading}
          configError={configError}
          onFacebookLogin={handleFacebookLogin}
          loadingFb={loadingFb}
          exchanging={exchanging}
          customPrompt={customPrompt}
          onChangeCustomPrompt={handleSaveCustomPrompt}
          greeting={greeting}
          onChangeGreeting={handleSaveGreeting}
          testPhone={testPhone}
          setTestPhone={setTestPhone}
          onSendTest={handleSendTest}
          sendingTest={sendingTest}
          testResult={testResult}
          onActivate={handleActivate}
          activating={activating}
        />
      ) : (
        <ConnectedView
          waAccount={waAccount}
          customPrompt={customPrompt}
          onChangeCustomPrompt={handleSaveCustomPrompt}
          greeting={greeting}
          onChangeGreeting={handleSaveGreeting}
          testPhone={testPhone}
          setTestPhone={setTestPhone}
          onSendTest={handleSendTest}
          sendingTest={sendingTest}
          testResult={testResult}
          onRefresh={handleRefreshStatus}
          refreshing={refreshing}
          onDisconnect={handleDisconnect}
          disconnecting={disconnecting}
        />
      )}
    </div>
  )
}

// ============ Wizard View ============

const WizardView = ({
  step, setStep, waConfig, configLoading, configError,
  onFacebookLogin, loadingFb, exchanging,
  customPrompt, onChangeCustomPrompt,
  greeting, onChangeGreeting,
  testPhone, setTestPhone, onSendTest, sendingTest, testResult,
  onActivate, activating,
}) => {
  return (
    <>
      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Step1Connect
              waConfig={waConfig}
              configLoading={configLoading}
              configError={configError}
              onFacebookLogin={onFacebookLogin}
              loadingFb={loadingFb}
              exchanging={exchanging}
            />
          </motion.div>
        )}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Step2Personality
              customPrompt={customPrompt}
              onChangeCustomPrompt={onChangeCustomPrompt}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Step3Greeting
              greeting={greeting}
              onChangeGreeting={onChangeGreeting}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          </motion.div>
        )}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Step4TestActivate
              testPhone={testPhone}
              setTestPhone={setTestPhone}
              onSendTest={onSendTest}
              sendingTest={sendingTest}
              testResult={testResult}
              onActivate={onActivate}
              activating={activating}
              onBack={() => setStep(3)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const StepIndicator = ({ current }) => {
  const steps = [
    { n: 1, label: 'Connexion' },
    { n: 2, label: 'Personnalite' },
    { n: 3, label: 'Accueil' },
    { n: 4, label: 'Test' },
  ]
  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-3">
      {steps.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  done
                    ? 'bg-[#0F5F35] text-white'
                    : active
                    ? 'bg-[#0F5F35]/10 text-[#0F5F35] border border-[#0F5F35]/30'
                    : 'bg-[#fafafa] text-[#9ca3af] border border-[#f0f0f0]'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </div>
              <span
                className={`text-[12px] font-semibold ${
                  active ? 'text-[#1a1a1a]' : 'text-[#9ca3af]'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-6 h-px bg-[#f0f0f0]" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const Step1Connect = ({ waConfig, configLoading, configError, onFacebookLogin, loadingFb, exchanging }) => {
  const unavailable = !configLoading && (configError || !waConfig?.available || !waConfig?.app_id || !waConfig?.config_id)

  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
      <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-5">
        <MessageCircle className="w-8 h-8 text-[#25D366]" />
      </div>
      <h3 className="text-[18px] font-semibold text-[#1a1a1a]">Connectez votre WhatsApp Business</h3>
      <p className="text-[13px] text-[#9ca3af] mt-2 max-w-md mx-auto">
        Un seul clic. Pas d'API a copier. Vos clients vous contactent, votre agent repond automatiquement.
      </p>

      {configLoading ? (
        <div className="mt-6 inline-flex items-center gap-2 text-[#9ca3af] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      ) : unavailable ? (
        <div className="mt-6 max-w-md mx-auto p-4 rounded-xl bg-amber-50 border border-amber-200 text-left">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-amber-900">En cours de mise en place</p>
              <p className="text-[12px] text-amber-800 mt-1 leading-relaxed">
                Notre equipe finalise l'integration Meta officielle. Contactez le support pour plus d'infos.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={onFacebookLogin}
          disabled={loadingFb || exchanging}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#1FB855] disabled:opacity-60 text-white text-[14px] font-semibold rounded-full transition-colors shadow-sm"
        >
          {loadingFb || exchanging ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {exchanging ? 'Finalisation...' : 'Chargement...'}
            </>
          ) : (
            <>
              <Facebook className="w-4 h-4" />
              Continuer avec Facebook
            </>
          )}
        </button>
      )}

      <div className="mt-5 max-w-md mx-auto flex items-start gap-2 text-left">
        <ShieldCheck className="w-3.5 h-3.5 text-[#9ca3af] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-[#9ca3af] leading-relaxed">
          Actero ne stocke jamais votre mot de passe Facebook. La connexion utilise le flow officiel Meta Embedded Signup.
        </p>
      </div>
    </div>
  )
}

const Step2Personality = ({ customPrompt, onChangeCustomPrompt, onNext, onBack }) => {
  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Personnalite de l'agent WhatsApp</h3>
          <p className="text-[12px] text-[#9ca3af] mt-0.5">
            Votre agent utilisera le meme prompt que votre agent general. Ajoutez des instructions specifiques a WhatsApp si vous le souhaitez.
          </p>
        </div>
      </div>

      <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-2">
        Instructions supplementaires pour WhatsApp (optionnel)
      </label>
      <textarea
        value={customPrompt}
        onChange={(e) => onChangeCustomPrompt(e.target.value)}
        rows={5}
        placeholder="Exemples : Reponds plus brievement qu'en email&#10;Utilise un ton plus direct&#10;Propose toujours d'appeler le service client"
        className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 resize-none"
      />
      <p className="text-[11px] text-[#9ca3af] mt-2">
        Sauvegarde automatique
      </p>

      <div className="flex items-center justify-between gap-2 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-[#f0f0f0] text-[#71717a] hover:bg-[#fafafa] text-[12px] font-semibold transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] hover:bg-[#0c4e2b] text-white text-[13px] font-semibold rounded-full transition-colors"
        >
          Etape suivante
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

const Step3Greeting = ({ greeting, onChangeGreeting, onNext, onBack }) => {
  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Message d'accueil</h3>
          <p className="text-[12px] text-[#9ca3af] mt-0.5">
            Le premier message envoye a un nouveau client qui vous ecrit sur WhatsApp.
          </p>
        </div>
      </div>

      <textarea
        value={greeting}
        onChange={(e) => onChangeGreeting(e.target.value)}
        rows={3}
        maxLength={200}
        placeholder="Bonjour ! Je suis l'assistant de votre boutique. Comment puis-je vous aider aujourd'hui ?"
        className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 resize-none"
      />
      <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mt-1">
        <span>{greeting.length}/200 caracteres</span>
        <span>Auto-enregistrement</span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-[#f0f0f0] text-[#71717a] hover:bg-[#fafafa] text-[12px] font-semibold transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] hover:bg-[#0c4e2b] text-white text-[13px] font-semibold rounded-full transition-colors"
        >
          Etape suivante
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

const Step4TestActivate = ({
  testPhone, setTestPhone, onSendTest, sendingTest, testResult, onActivate, activating, onBack,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0F5F35]/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-[#0F5F35]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Test & activation</h3>
          <p className="text-[12px] text-[#9ca3af] mt-0.5">
            Envoyez-vous un message test pour verifier que tout fonctionne.
          </p>
        </div>
      </div>

      <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-2">
        Votre numero de telephone (format international)
      </label>
      <div className="flex gap-2">
        <input
          type="tel"
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="+33612345678"
          className="flex-1 px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30"
        />
        <button
          onClick={onSendTest}
          disabled={sendingTest || !testPhone}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1FB855] disabled:opacity-50 text-white text-[12px] font-semibold rounded-full transition-colors"
        >
          {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Envoyer test
        </button>
      </div>

      {testResult && (
        <div
          className={`mt-3 p-3 rounded-xl border text-[12px] ${
            testResult.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {testResult.ok ? '[OK] ' : '[!] '}{testResult.msg}
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl bg-[#fafafa] border border-[#f0f0f0]">
        <p className="text-[12px] text-[#1a1a1a] font-semibold mb-1">Prêt à activer ?</p>
        <p className="text-[11px] text-[#9ca3af] leading-relaxed">
          Une fois active, votre agent WhatsApp repondra automatiquement aux messages de vos clients. Vous pourrez le desactiver a tout moment.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-[#f0f0f0] text-[#71717a] hover:bg-[#fafafa] text-[12px] font-semibold transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onActivate}
          disabled={activating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[13px] font-semibold rounded-full transition-colors"
        >
          {activating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Activation...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Terminer et activer
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============ Connected View ============

const ConnectedView = ({
  waAccount, customPrompt, onChangeCustomPrompt, greeting, onChangeGreeting,
  testPhone, setTestPhone, onSendTest, sendingTest, testResult,
  onRefresh, refreshing, onDisconnect, disconnecting,
}) => {
  return (
    <>
      {/* Card 1 - Status */}
      <Card title="Statut de la connexion" icon={MessageCircle}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[20px] font-semibold text-[#1a1a1a] font-mono tracking-tight">
              {waAccount?.display_phone_number || waAccount?.phone_number || '—'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Actif
              </span>
              {waAccount?.quality_rating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fafafa] text-[#71717a] text-[10px] font-semibold border border-[#f0f0f0]">
                  Qualite : {waAccount.quality_rating}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#f0f0f0] text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] disabled:opacity-60 transition-colors"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Rafraichir
          </button>
        </div>
      </Card>

      {/* Card 2 - Personality */}
      <Card title="Personnalite" icon={Sparkles}>
        <p className="text-[12px] text-[#9ca3af] mb-3">
          Instructions supplementaires pour WhatsApp (optionnel). Sauvegarde automatique.
        </p>
        <textarea
          value={customPrompt}
          onChange={(e) => onChangeCustomPrompt(e.target.value)}
          rows={4}
          placeholder="Exemples : Reponds plus brievement qu'en email, utilise un ton plus direct..."
          className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 resize-none"
        />
      </Card>

      {/* Card 3 - Greeting */}
      <Card title="Message d'accueil" icon={MessageCircle}>
        <textarea
          value={greeting}
          onChange={(e) => onChangeGreeting(e.target.value)}
          rows={3}
          maxLength={200}
          className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 resize-none"
        />
        <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mt-1">
          <span>{greeting.length}/200 caracteres</span>
          <span>Auto-enregistrement</span>
        </div>
      </Card>

      {/* Card 4 - Test + disconnect */}
      <Card title="Test & deconnexion" icon={Send}>
        <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-2">
          Numero test
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+33612345678"
            className="flex-1 px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30"
          />
          <button
            onClick={onSendTest}
            disabled={sendingTest || !testPhone}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1FB855] disabled:opacity-50 text-white text-[12px] font-semibold rounded-full transition-colors"
          >
            {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Envoyer
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-3 p-3 rounded-xl border text-[12px] ${
              testResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {testResult.ok ? '[OK] ' : '[!] '}{testResult.msg}
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-[12px] font-semibold transition-colors"
          >
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            Deconnecter WhatsApp
          </button>
        </div>
      </Card>
    </>
  )
}

const Card = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-[#0F5F35]/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#0F5F35]" />
      </div>
      <h3 className="text-[14px] font-semibold text-[#1a1a1a]">{title}</h3>
    </div>
    {children}
  </div>
)
