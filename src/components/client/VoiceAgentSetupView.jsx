import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mic, Copy, Check, ExternalLink, Loader2,
  Sparkles, Power, PlayCircle, Smartphone, Building2, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { VoiceTestModal } from './VoiceTestModal'

const API_BASE = ''

const apiCall = async (path, body) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = json?.error || `Erreur ${res.status}`
    const hint = json?.hint ? ` — ${json.hint}` : ''
    throw new Error(base + hint)
  }
  return json
}

export const VoiceAgentSetupView = ({ clientId }) => {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activating, setActivating] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [voiceIdInput, setVoiceIdInput] = useState('')
  const [savingVoice, setSavingVoice] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [greetingSaving, setGreetingSaving] = useState(false)
  const [phoneType, setPhoneType] = useState('mobile')
  const [provisioning, setProvisioning] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const greetingTimer = useRef(null)
  const didInitGreeting = useRef(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['voice-agent-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('voice_agent_enabled, elevenlabs_agent_id, elevenlabs_voice_id, voice_phone_number, voice_greeting, voice_phone_provider, voice_phone_country, voice_phone_type, voice_phone_provisioned_at')
        .eq('client_id', clientId)
        .maybeSingle()
      return data || {}
    },
    enabled: !!clientId,
  })

  useEffect(() => {
    if (settings && !didInitGreeting.current) {
      setGreeting(settings.voice_greeting || '')
      setVoiceIdInput(settings.elevenlabs_voice_id || '')
      didInitGreeting.current = true
    }
  }, [settings])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['voice-agent-settings', clientId] })

  // ---- Actions ----
  const handleActivate = async () => {
    setActivating(true)
    try {
      await apiCall('/api/voice/setup-agent', { client_id: clientId })
      toast.success('Agent vocal cree avec succes')
      refresh()
    } catch (e) {
      toast.error(e.message || 'Impossible de creer l\'agent')
    } finally {
      setActivating(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('Desactiver l\'agent vocal ? Le numero sera detache et l\'agent supprime.')) return
    try {
      await apiCall('/api/voice/delete-agent', { client_id: clientId })
      toast.success('Agent vocal desactive')
      didInitGreeting.current = false
      refresh()
    } catch (e) {
      toast.error(e.message || 'Echec de la desactivation')
    }
  }

  const handleSaveVoice = async () => {
    if (!voiceIdInput.trim()) {
      toast.error('Veuillez coller un Voice ID')
      return
    }
    setSavingVoice(true)
    try {
      await apiCall('/api/voice/update-agent', {
        client_id: clientId,
        elevenlabs_voice_id: voiceIdInput.trim(),
      })
      toast.success('Voix mise a jour')
      refresh()
    } catch (e) {
      toast.error(e.message || 'Impossible de mettre a jour la voix')
    } finally {
      setSavingVoice(false)
    }
  }

  // Debounced greeting autosave
  const handleGreetingChange = (val) => {
    if (val.length > 200) return
    setGreeting(val)
    if (greetingTimer.current) clearTimeout(greetingTimer.current)
    greetingTimer.current = setTimeout(async () => {
      setGreetingSaving(true)
      try {
        await apiCall('/api/voice/update-agent', {
          client_id: clientId,
          voice_greeting: val,
        })
      } catch (e) {
        toast.error('Sauvegarde du message echouee')
      } finally {
        setGreetingSaving(false)
      }
    }, 800)
  }

  const handleCopyNumber = () => {
    if (!settings?.voice_phone_number) return
    navigator.clipboard.writeText(settings.voice_phone_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleProvision = async () => {
    setProvisioning(true)
    try {
      const r = await apiCall('/api/voice/provision-twilio-number', {
        client_id: clientId,
        country: 'FR',
        type: phoneType,
      })
      toast.success(`Numero attribue : ${r.phone_number}`)
      refresh()
    } catch (e) {
      toast.error(e.message || 'Impossible d\'obtenir un numero')
    } finally {
      setProvisioning(false)
    }
  }

  const handleRelease = async () => {
    if (!window.confirm('Liberer ce numero ? Vos clients ne pourront plus appeler.')) return
    setReleasing(true)
    try {
      await apiCall('/api/voice/release-twilio-number', { client_id: clientId })
      toast.success('Numero libere')
      refresh()
    } catch (e) {
      toast.error(e.message || 'Echec de la liberation')
    } finally {
      setReleasing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
      </div>
    )
  }

  const enabled = !!settings?.voice_agent_enabled

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Agent vocal telephonique</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">
          Vos clients appellent un vrai numero et parlent a votre agent IA en temps reel.
        </p>
      </div>

      {!enabled ? (
        <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[#0F5F35]/10 flex items-center justify-center mx-auto mb-5">
            <Phone className="w-8 h-8 text-[#0F5F35]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#1a1a1a]">Activez votre agent vocal</h3>
          <p className="text-[13px] text-[#9ca3af] mt-2 max-w-md mx-auto">
            En un clic, nous creons un agent vocal IA personnalise pour votre boutique, pret a recevoir les appels clients.
          </p>
          <button
            onClick={handleActivate}
            disabled={activating}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#0F5F35] hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[14px] font-semibold rounded-full transition-colors"
          >
            {activating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creation en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Activer mon agent vocal
              </>
            )}
          </button>
          <p className="text-[11px] text-[#9ca3af] mt-4">
            Inclus dans votre abonnement - aucun frais supplementaire.
          </p>
        </div>
      ) : (
        <>
          {/* Card 1 - Phone number */}
          <Card title="Numero de telephone" icon={Phone}>
            {settings?.voice_phone_number ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[24px] font-semibold text-[#1a1a1a] tracking-tight font-mono">
                      {settings.voice_phone_number}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Actif via Twilio
                      </span>
                      {settings.voice_phone_type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fafafa] text-[#71717a] text-[10px] font-semibold border border-[#f0f0f0]">
                          {settings.voice_phone_type === 'mobile' ? <Smartphone className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                          {settings.voice_phone_type === 'mobile' ? 'Mobile' : 'Fixe'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyNumber}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#f0f0f0] text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copie' : 'Copier'}
                  </button>
                </div>
                {settings.voice_phone_provisioned_at && (
                  <p className="text-[11px] text-[#9ca3af]">
                    Provisionne le {new Date(settings.voice_phone_provisioned_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
                <button
                  onClick={handleRelease}
                  disabled={releasing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-[11px] font-semibold transition-colors"
                >
                  {releasing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Liberer ce numero
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[14px] font-medium text-[#1a1a1a]">Aucun numero attribue</p>
                  <p className="text-[12px] text-[#9ca3af] mt-1">
                    Obtenez votre numero francais en 30 secondes — inclus dans votre abonnement.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPhoneType('mobile')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                      phoneType === 'mobile'
                        ? 'border-[#0F5F35] bg-[#0F5F35]/5 text-[#0F5F35]'
                        : 'border-[#f0f0f0] bg-[#fafafa] text-[#71717a] hover:bg-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Mobile (06 / 07)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneType('local')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                      phoneType === 'local'
                        ? 'border-[#0F5F35] bg-[#0F5F35]/5 text-[#0F5F35]'
                        : 'border-[#f0f0f0] bg-[#fafafa] text-[#71717a] hover:bg-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Fixe (01 a 05)
                  </button>
                </div>

                <button
                  onClick={handleProvision}
                  disabled={provisioning}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#0F5F35] hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[13px] font-semibold transition-colors"
                >
                  {provisioning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Provisioning en cours, ~30s...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Obtenir mon numero automatiquement
                    </>
                  )}
                </button>
                <p className="text-[11px] text-[#9ca3af] text-center">
                  Numero francais Twilio attribue automatiquement, integre a ElevenLabs et lie a votre agent en 1 clic.
                </p>
              </div>
            )}
          </Card>

          {/* Card 2 - Voice */}
          <Card title="Voix de l'agent" icon={Mic}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[13px] text-[#1a1a1a]">
                  Voix actuelle :{' '}
                  <span className="font-mono text-[12px] bg-[#fafafa] px-2 py-0.5 rounded border border-[#f0f0f0]">
                    {settings?.elevenlabs_voice_id || 'Voix par defaut FR'}
                  </span>
                </p>
              </div>

              <a
                href="https://elevenlabs.io/app/voice-library"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0F5F35] hover:underline"
              >
                Parcourir la bibliotheque de voix
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={voiceIdInput}
                  onChange={(e) => setVoiceIdInput(e.target.value)}
                  placeholder="Coller un Voice ID (ex: 21m00Tcm4TlvDq8ikWAM)"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30"
                />
                <button
                  onClick={handleSaveVoice}
                  disabled={savingVoice}
                  className="px-4 py-2 rounded-full bg-[#0F5F35] hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[12px] font-semibold transition-colors"
                >
                  {savingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sauvegarder'}
                </button>
              </div>

              <p className="text-[11px] text-[#9ca3af] italic">
                Astuce - pour cloner votre propre voix, creez-la sur ElevenLabs et collez le Voice ID ici.
              </p>
            </div>
          </Card>

          {/* Card 3 - Greeting */}
          <Card title="Message d'accueil" icon={Sparkles}>
            <div className="space-y-2">
              <textarea
                value={greeting}
                onChange={(e) => handleGreetingChange(e.target.value)}
                rows={3}
                placeholder="Bonjour, merci d'appeler [votre boutique]. Comment puis-je vous aider ?"
                className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35]/30 resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9ca3af]">
                <span>{greeting.length}/200 caracteres</span>
                <span className="flex items-center gap-1">
                  {greetingSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...
                    </>
                  ) : (
                    'Auto-enregistrement'
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* Card 4 - Test + Disable */}
          <Card title="Tester l'agent" icon={PlayCircle}>
            <div className="space-y-3">
              <button
                onClick={() => setShowTestModal(true)}
                disabled={!settings?.elevenlabs_agent_id}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#0F5F35] hover:bg-[#0c4e2b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
              >
                <Mic className="w-4 h-4" />
                Tester l'agent vocal en navigateur
              </button>
              <button
                onClick={handleDeactivate}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-semibold transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
                Desactiver l'agent vocal
              </button>
            </div>
          </Card>
        </>
      )}

      {/* Test Modal */}
      <AnimatePresence>
        {showTestModal && (
          <VoiceTestModal
            clientId={clientId}
            agentId={settings?.elevenlabs_agent_id}
            onClose={() => setShowTestModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
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

