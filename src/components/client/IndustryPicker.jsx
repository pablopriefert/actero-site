import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { INDUSTRY_PRESETS } from '../../lib/industry-presets'

// IndustryPicker - Modal plein ecran pour choisir un preset industrie
// en 1 clic au premier login. Applique brand_tone, knowledge_base,
// guardrails et playbooks en une seule action.
export function IndustryPicker({ clientId, onClose, onApplied }) {
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)

  const handleSkip = async () => {
    try {
      await supabase
        .from('client_settings')
        .upsert(
          { client_id: clientId, industry_preset_applied: 'skipped' },
          { onConflict: 'client_id' }
        )
    } catch (e) {
      console.warn('[IndustryPicker] skip failed', e)
    }
    onClose?.()
  }

  const handleApply = async () => {
    if (!selected || applying) return
    setApplying(true)
    setError(null)

    try {
      // 1. Update client_settings: brand_tone + industry_preset_applied
      const { error: settingsErr } = await supabase
        .from('client_settings')
        .upsert(
          {
            client_id: clientId,
            brand_tone: selected.brand_tone || null,
            industry_preset_applied: selected.id,
          },
          { onConflict: 'client_id' }
        )
      if (settingsErr) {
        console.warn('[IndustryPicker] client_settings upsert failed', settingsErr)
      }

      // 2. Insert knowledge base entries (Q -> title, A -> content)
      if (Array.isArray(selected.knowledge) && selected.knowledge.length > 0) {
        const kbRows = selected.knowledge.map((entry, idx) => ({
          client_id: clientId,
          category: 'faq',
          title: entry.q,
          content: entry.a,
          is_active: true,
          sort_order: idx,
        }))
        const { error: kbErr } = await supabase.from('client_knowledge_base').insert(kbRows)
        if (kbErr) {
          console.warn('[IndustryPicker] client_knowledge_base insert failed', kbErr)
        }
      }

      // 3. Insert guardrails
      if (Array.isArray(selected.guardrails) && selected.guardrails.length > 0) {
        const gRows = selected.guardrails.map((rule, idx) => ({
          client_id: clientId,
          rule_text: rule,
          is_enabled: true,
          priority: idx,
        }))
        const { error: gErr } = await supabase.from('client_guardrails').insert(gRows)
        if (gErr) {
          console.warn('[IndustryPicker] client_guardrails insert failed', gErr)
        }
      }

      // 4. Activate playbooks - lookup by name in engine_playbooks
      if (Array.isArray(selected.playbooks) && selected.playbooks.length > 0) {
        const { data: pbs, error: pbErr } = await supabase
          .from('engine_playbooks')
          .select('id, name')
          .in('name', selected.playbooks)
        if (pbErr) {
          console.warn('[IndustryPicker] engine_playbooks lookup failed', pbErr)
        } else if (pbs && pbs.length > 0) {
          const cpbRows = pbs.map((pb) => ({
            client_id: clientId,
            playbook_id: pb.id,
            is_active: true,
            activated_at: new Date().toISOString(),
          }))
          const { error: cpbErr } = await supabase
            .from('engine_client_playbooks')
            .upsert(cpbRows, { onConflict: 'client_id,playbook_id' })
          if (cpbErr) {
            // Fallback: try plain insert if upsert constraint is not set
            const { error: insErr } = await supabase
              .from('engine_client_playbooks')
              .insert(cpbRows)
            if (insErr) {
              console.warn('[IndustryPicker] engine_client_playbooks insert failed', insErr)
            }
          }
        }
      }

      onApplied?.(selected)
    } catch (e) {
      console.error('[IndustryPicker] apply failed', e)
      setError("Une erreur s'est produite. Certaines parties du preset n'ont pas pu etre appliquees.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-5xl bg-[#fafafa] rounded-2xl shadow-2xl border border-gray-200 my-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 md:p-8 border-b border-gray-200">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F5F35]/10 text-[#0F5F35] text-xs font-bold uppercase tracking-wider mb-3">
              Setup en 3 minutes
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">
              Quelle est votre industrie ?
            </h2>
            <p className="text-sm text-[#71717a] mt-2 max-w-2xl">
              Choisissez votre secteur pour pre-configurer votre agent en un clic :
              ton de marque, 15 reponses types, 5 garde-fous et 3 playbooks actifs.
              Vous pourrez tout modifier ensuite.
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="flex-shrink-0 p-2 rounded-lg text-[#71717a] hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRY_PRESETS.map((preset) => {
              const Icon = preset.icon
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelected(preset)}
                  className="group relative text-left bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-[#0F5F35] hover:shadow-lg transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${preset.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: preset.color }} />
                  </div>
                  <h3 className="font-bold text-[#1a1a1a] text-base mb-1">{preset.name}</h3>
                  <p className="text-xs text-[#71717a] leading-relaxed">{preset.description}</p>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-[#0F5F35]" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 md:p-8 border-t border-gray-200 bg-white rounded-b-2xl">
          <button
            onClick={handleSkip}
            className="text-sm font-semibold text-[#71717a] hover:text-[#1a1a1a] transition-colors"
          >
            Passer cette etape
          </button>
          <p className="text-xs text-[#71717a] hidden md:block">
            Entierement personnalisable apres application
          </p>
        </div>
      </motion.div>

      {/* Sub-modal preview */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${selected.color}20` }}
                  >
                    <selected.icon className="w-6 h-6" style={{ color: selected.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1a1a1a] text-lg">{selected.name}</h3>
                    <p className="text-xs text-[#71717a]">{selected.description}</p>
                  </div>
                </div>

                <div className="bg-[#fafafa] rounded-xl p-4 mb-4">
                  <p className="text-sm text-[#1a1a1a] font-semibold mb-2">
                    Vous etes sur le point d appliquer ce preset :
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#71717a]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0F5F35]" />
                      Ton de marque : {selected.brand_tone || 'Aucun'}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0F5F35]" />
                      {selected.knowledge.length} questions/reponses pre-remplies
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0F5F35]" />
                      {selected.guardrails.length} garde-fous metier
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0F5F35]" />
                      {selected.playbooks.length} playbooks actives
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-[#71717a] mb-4">
                  Tout sera modifiable ensuite depuis votre dashboard.
                </p>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    disabled={applying}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-[#71717a] hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#0F5F35] text-white text-sm font-semibold hover:bg-[#0a4526] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {applying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Application...
                      </>
                    ) : (
                      <>Appliquer</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default IndustryPicker
