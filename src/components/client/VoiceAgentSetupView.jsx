import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mic, Copy, Check, ExternalLink, Loader2,
  Sparkles, Power, PlayCircle, Smartphone, Building2, Trash2,
  Server, Shield, AlertCircle,
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
  const [releasing, setReleasing] = useState(false)

  // SIP trunk form
  const [sipForm, setSipForm] = useState({
    phone_number: '',
    sip_server: '',
    sip_username: '',
    sip_password: '',
    transport: 'UDP',
  })
  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState(null)
  const greetingTimer = useRef(null)
  const didInitGreeting = useRef(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['voice-agent-settings', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_settings')
        .select('voice_agent_enabled, elevenlabs_agent_id, elevenlabs_voice_id, voice_phone_number, voice_greeting, voice_phone_provider, voice_phone_country, voice_phone_type, voice_phone_provisioned_at, voice_sip_phone_number, voice_sip_server, voice_sip_username, voice_sip_transport, voice_sip_attached_at')
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

  const handleAttachSip = async () => {
    setAttaching(true)
    setAttachError(null)
    try {
      await apiCall('/api/voice/attach-sip-trunk', {
        client_id: clientId,
        ...sipForm,
      })
      toast.success('SIP trunk connecté avec succès')
      setSipForm({ phone_number: '', sip_server: '', sip_username: '', sip_password: '', transport: 'UDP' })
      refresh()
    } catch (e) {
      setAttachError(e.message || 'Impossible de connecter le SIP trunk')
    } finally {
      setAttaching(false)
    }
  }

  const handleRelease = async () => {
    if (!window.confirm('Déconnecter votre SIP trunk ? Les appels entrants ne seront plus routés vers l\'agent IA.')) return
    setReleasing(true)
    try {
      await apiCall('/api/voice/detach-sip-trunk', { client_id: clientId })
      toast.success('SIP trunk déconnecté')
      refresh()
    } catch (e) {
      toast.error(e.message || 'Échec de la déconnexion')
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
          <div className="w-16 h-16 rounded-full bg-cta/10 flex items-center justify-center mx-auto mb-5">
            <Phone className="w-8 h-8 text-cta" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#1a1a1a]">Activez votre agent vocal</h3>
          <p className="text-[13px] text-[#9ca3af] mt-2 max-w-md mx-auto">
            En un clic, nous créons un agent vocal IA personnalisé pour votre boutique, prêt à recevoir les appels clients.
          </p>
          <button
            onClick={handleActivate}
            disabled={activating}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-cta hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[14px] font-semibold rounded-full transition-colors"
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
                  <p className="text-[14px] font-medium text-[#1a1a1a]">Connectez votre numéro existant (SIP)</p>
                  <p className="text-[12px] text-[#9ca3af] mt-1">
                    Utilisez votre standard actuel (OVH, Bouygues Pro, Orange Pro, 3CX…) — aucun nouveau numéro à acheter.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={sipForm.phone_number}
                      onChange={(e) => setSipForm({ ...sipForm, phone_number: e.target.value })}
                      placeholder="+33 1 23 45 67 89"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] font-mono focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Serveur SIP</label>
                    <input
                      type="text"
                      value={sipForm.sip_server}
                      onChange={(e) => setSipForm({ ...sipForm, sip_server: e.target.value })}
                      placeholder="sip.votre-operateur.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] font-mono focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Identifiant SIP</label>
                      <input
                        type="text"
                        value={sipForm.sip_username}
                        onChange={(e) => setSipForm({ ...sipForm, sip_username: e.target.value })}
                        placeholder="username"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] font-mono focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Mot de passe</label>
                      <input
                        type="password"
                        value={sipForm.sip_password}
                        onChange={(e) => setSipForm({ ...sipForm, sip_password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] font-mono focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">Transport</label>
                    <div className="flex gap-2">
                      {['UDP', 'TCP', 'TLS'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSipForm({ ...sipForm, transport: t })}
                          className={`flex-1 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors ${
                            sipForm.transport === t
                              ? 'border-cta bg-cta/5 text-cta'
                              : 'border-[#f0f0f0] bg-[#fafafa] text-[#71717a] hover:bg-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {attachError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-red-700">{attachError}</p>
                  </div>
                )}

                <button
                  onClick={handleAttachSip}
                  disabled={attaching || !sipForm.phone_number || !sipForm.sip_server || !sipForm.sip_username || !sipForm.sip_password}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-cta hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[13px] font-semibold transition-colors"
                >
                  {attaching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connexion en cours…
                    </>
                  ) : (
                    <>
                      <Server className="w-4 h-4" />
                      Connecter mon SIP trunk
                    </>
                  )}
                </button>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-blue-700 leading-relaxed">
                    Vos identifiants SIP sont chiffrés (AES-256) avant stockage. ElevenLabs établit la connexion de manière sécurisée.
                  </div>
                </div>
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
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cta hover:underline"
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
                  className="flex-1 px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
                />
                <button
                  onClick={handleSaveVoice}
                  disabled={savingVoice}
                  className="px-4 py-2 rounded-full bg-cta hover:bg-[#0c4e2b] disabled:opacity-60 text-white text-[12px] font-semibold transition-colors"
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
                className="w-full px-3 py-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30 resize-none"
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
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-cta hover:bg-[#0c4e2b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
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
      <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-cta" />
      </div>
      <h3 className="text-[14px] font-semibold text-[#1a1a1a]">{title}</h3>
    </div>
    {children}
  </div>
)

