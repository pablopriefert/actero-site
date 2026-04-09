import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, ArrowRight, ArrowLeft, CheckCircle2, Loader2, X,
  Mail, MessageSquare, FileText, Bell, AlertTriangle, Calendar,
  DollarSign, Clock, Plug, Table, HelpCircle, ExternalLink,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const STEPS = [
  { id: 'explain', title: 'Comment ca marche' },
  { id: 'tools', title: 'Vos outils' },
  { id: 'config', title: 'Configuration' },
  { id: 'channels', title: 'Canaux' },
  { id: 'activate', title: 'Activer' },
]

const COMPTA_TOOLS = [
  { id: 'axonaut', name: 'Axonaut', desc: 'CRM et facturation pour PME' },
  { id: 'pennylane', name: 'Pennylane', desc: 'Comptabilite automatisee' },
  { id: 'ipaidthat', name: 'iPaidThat', desc: 'Collecte de factures' },
  { id: 'none', name: 'Aucun pour le moment', desc: 'Je veux juste les alertes et relances par email' },
]

export const ComptabiliteWizard = ({ clientId, connectedProviders, onComplete, onCancel }) => {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [selectedTool, setSelectedTool] = useState('')
  const [relanceDelai, setRelanceDelai] = useState('7')
  const [alerteSeuil, setAlerteSeuil] = useState('1000')
  const [exportFrequency, setExportFrequency] = useState('mensuel')
  const [selectedChannels, setSelectedChannels] = useState({ email: true, slack: false, google_sheets: false })
  const [activating, setActivating] = useState(false)
  const [activated, setActivated] = useState(false)

  const currentStep = STEPS[step]
  const toolConnected = selectedTool === 'none' || connectedProviders.includes(selectedTool)

  const handleActivate = async () => {
    setActivating(true)
    try {
      // Save compta config in client_settings
      await supabase.from('client_settings').upsert({
        client_id: clientId,
        compta_tool: selectedTool,
        compta_relance_delai: parseInt(relanceDelai) || 7,
        compta_alerte_seuil: parseInt(alerteSeuil) || 1000,
        compta_export_frequency: exportFrequency,
        compta_channels: selectedChannels,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })

      setActivated(true)
      toast.success('Comptabilite automatisee activee !')
    } catch (err) {
      toast.error(err.message)
    }
    setActivating(false)
  }

  const canProceed = () => {
    if (step === 1) return !!selectedTool
    if (step === 2) return !!relanceDelai && !!alerteSeuil
    if (step === 3) return selectedChannels.email || selectedChannels.slack
    return true
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-[14px]">Comptabilite Automatisee</span>
            </div>
            <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
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

              {/* Step 1: Explain */}
              {step === 0 && (
                <div className="space-y-4">
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Qu'est-ce que ca fait ?</h3>
                  <div className="space-y-3">
                    {[
                      { icon: FileText, title: 'Relance de factures', desc: 'L\'IA detecte les factures impayees et envoie des relances automatiques a vos clients.' },
                      { icon: AlertTriangle, title: 'Alertes de tresorerie', desc: 'Recevez une alerte quand votre tresorerie passe sous un seuil que vous definissez.' },
                      { icon: Calendar, title: 'Exports comptables', desc: 'Recevez un export automatique de vos donnees comptables par email ou Google Sheets.' },
                      { icon: Table, title: 'Export Google Sheets', desc: 'Vos donnees comptables sont automatiquement exportees dans un Google Sheet partage.' },
                      { icon: Bell, title: 'Notifications', desc: 'Soyez prevenu par email ou Slack de chaque action comptable.' },
                    ].map(item => {
                      const Icon = item.icon
                      return (
                        <div key={item.title} className="flex items-start gap-3 p-3 bg-[#fafafa] rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#1a1a1a]">{item.title}</p>
                            <p className="text-[11px] text-[#9ca3af]">{item.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => window.open('/support', '_blank')}
                    className="flex items-center gap-1.5 text-[12px] text-indigo-600 hover:underline"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> En savoir plus dans notre guide detaille
                  </button>
                </div>
              )}

              {/* Step 2: Tools */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Quel outil comptable utilisez-vous ?</h3>
                  <p className="text-[12px] text-[#9ca3af]">Selectionnez votre outil pour que l'IA puisse se connecter a vos donnees.</p>
                  <div className="space-y-2">
                    {COMPTA_TOOLS.map(tool => {
                      const isConnected = tool.id === 'none' || connectedProviders.includes(tool.id)
                      return (
                        <button
                          key={tool.id}
                          onClick={() => setSelectedTool(tool.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            selectedTool === tool.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-[#f0f0f0] hover:border-[#e0e0e0]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-semibold text-[#1a1a1a]">{tool.name}</p>
                              {tool.id !== 'none' && isConnected && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Connecte</span>
                              )}
                              {tool.id !== 'none' && !isConnected && (
                                <span className="text-[9px] font-bold text-[#9ca3af] bg-[#f5f5f5] px-1.5 py-0.5 rounded-full">Non connecte</span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#9ca3af]">{tool.desc}</p>
                          </div>
                          {selectedTool === tool.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                        </button>
                      )
                    })}
                  </div>
                  {selectedTool && selectedTool !== 'none' && !connectedProviders.includes(selectedTool) && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-[11px] text-amber-700">
                        <Plug className="w-3 h-3 inline mr-1" />
                        Vous devrez connecter {selectedTool} dans Integrations pour que l'automatisation fonctionne pleinement.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Config */}
              {step === 2 && (
                <div className="space-y-5">
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Parametres</h3>

                  <div>
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Delai avant relance de facture</label>
                    <p className="text-[11px] text-[#c4c4c4] mb-1.5">Combien de jours apres l'echeance avant d'envoyer une relance ?</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={relanceDelai}
                        onChange={(e) => setRelanceDelai(e.target.value)}
                        className="w-24 px-3 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[14px] outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <span className="text-[13px] text-[#9ca3af]">jours</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Seuil d'alerte tresorerie</label>
                    <p className="text-[11px] text-[#c4c4c4] mb-1.5">Recevez une alerte quand votre solde passe sous ce montant.</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={alerteSeuil}
                        onChange={(e) => setAlerteSeuil(e.target.value)}
                        className="w-32 px-3 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[14px] outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <span className="text-[13px] text-[#9ca3af]">€</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Frequence des exports</label>
                    <div className="flex gap-2 mt-1.5">
                      {['hebdomadaire', 'mensuel', 'trimestriel'].map(freq => (
                        <button
                          key={freq}
                          onClick={() => setExportFrequency(freq)}
                          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                            exportFrequency === freq ? 'bg-indigo-600 text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
                          }`}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Channels */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Comment etre notifie ?</h3>
                  <p className="text-[12px] text-[#9ca3af]">Choisissez ou recevoir les alertes et relances.</p>

                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedChannels(c => ({ ...c, email: !c.email }))}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selectedChannels.email ? 'border-indigo-500 bg-indigo-50/50' : 'border-[#f0f0f0]'
                      }`}
                    >
                      <Mail className="w-5 h-5 text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">Email</p>
                        <p className="text-[11px] text-[#9ca3af]">Relances envoyees par email, alertes par email</p>
                      </div>
                      {selectedChannels.email && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                    </button>

                    <button
                      onClick={() => setSelectedChannels(c => ({ ...c, slack: !c.slack }))}
                      disabled={!connectedProviders.includes('slack')}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selectedChannels.slack ? 'border-indigo-500 bg-indigo-50/50' :
                        connectedProviders.includes('slack') ? 'border-[#f0f0f0] hover:border-[#e0e0e0]' :
                        'border-[#f0f0f0] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <MessageSquare className="w-5 h-5 text-[#4A154B]" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">Slack</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {connectedProviders.includes('slack') ? 'Alertes dans votre canal Slack' : 'Connectez Slack dans Integrations'}
                        </p>
                      </div>
                      {selectedChannels.slack && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                    </button>

                    <button
                      onClick={() => setSelectedChannels(c => ({ ...c, google_sheets: !c.google_sheets }))}
                      disabled={!connectedProviders.includes('google_sheets')}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selectedChannels.google_sheets ? 'border-indigo-500 bg-indigo-50/50' :
                        connectedProviders.includes('google_sheets') ? 'border-[#f0f0f0] hover:border-[#e0e0e0]' :
                        'border-[#f0f0f0] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Table className="w-5 h-5 text-[#0F9D58]" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">Google Sheets</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {connectedProviders.includes('google_sheets') ? 'Exports automatiques dans un Google Sheet' : 'Connectez Google Sheets dans Integrations'}
                        </p>
                      </div>
                      {selectedChannels.google_sheets && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Activate */}
              {step === 4 && (
                <div className="space-y-4 text-center py-4">
                  {!activated ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
                        <TrendingUp className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Pret a activer</h3>
                      <div className="p-4 bg-[#fafafa] rounded-xl text-left space-y-2">
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Outil : {COMPTA_TOOLS.find(t => t.id === selectedTool)?.name}</span></div>
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Relance apres {relanceDelai} jours</span></div>
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Alerte tresorerie sous {alerteSeuil}€</span></div>
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Exports {exportFrequency}s</span></div>
                        <div className="flex items-center gap-2 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Canaux : {[selectedChannels.email && 'Email', selectedChannels.slack && 'Slack', selectedChannels.google_sheets && 'Google Sheets'].filter(Boolean).join(', ')}</span></div>
                      </div>
                      <button
                        onClick={handleActivate}
                        disabled={activating}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F5F35] text-white text-[13px] font-semibold rounded-xl hover:bg-[#003725] disabled:opacity-50 transition-colors"
                      >
                        {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Activer la comptabilite automatisee
                      </button>
                    </>
                  ) : (
                    <>
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}
                        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </motion.div>
                      <h3 className="text-[16px] font-semibold text-[#1a1a1a]">Comptabilite automatisee activee !</h3>
                      <p className="text-[13px] text-[#9ca3af]">Les relances, alertes et exports sont maintenant actifs.</p>
                      <button onClick={onComplete}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white text-[13px] font-semibold rounded-xl hover:bg-[#003725]">
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
        {!activated && (
          <div className="px-6 py-4 border-t border-[#f0f0f0] flex items-center justify-between">
            <button onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
              className="flex items-center gap-1 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a]">
              <ArrowLeft className="w-4 h-4" /> {step === 0 ? 'Annuler' : 'Retour'}
            </button>
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(step + 1)} disabled={!canProceed()}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-[12px] font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
