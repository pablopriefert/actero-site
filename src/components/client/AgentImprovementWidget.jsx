import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AgentImprovementWidget = ({ clientId, theme: _theme }) => {
  const queryClient = useQueryClient()
  const [edits, setEdits] = useState({})   // reco_id -> { title, content }

  const { data: recos = [], isLoading } = useQuery({
    queryKey: ['improvement-loop', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('id, title, description, evidence, estimated_time_gain_minutes, created_at')
        .eq('client_id', clientId)
        .eq('source_version', 'improvement-loop-v1')
        .eq('status', 'active')
        .order('impact_score', { ascending: false })
        .limit(5)
      return data || []
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  const act = useMutation({
    mutationFn: async ({ recoId, action, title, content }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/apply-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ reco_id: recoId, action, title, content }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['improvement-loop', clientId] })
    },
  })

  if (isLoading || recos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a]">L&apos;agent s&apos;améliore</p>
            <p className="text-[10px] text-[#71717a]">{recos.length} amélioration(s) détectée(s) — basé sur tes escalades</p>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {recos.map((r) => {
              const draft = r.evidence || {}
              const edit = edits[r.id] || { title: draft.kb_title || '', content: draft.kb_content || '' }
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  className="p-3 bg-white rounded-xl border border-gray-100"
                >
                  <p className="text-sm font-medium text-[#1a1a1a]">{r.title}</p>
                  <p className="text-xs text-[#71717a] mt-0.5">{r.description}</p>

                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">Entrée proposée pour ta base</p>
                    <input
                      className="w-full bg-transparent text-sm font-medium text-[#1a1a1a] outline-none border-b border-emerald-200 pb-1 mb-2"
                      value={edit.title}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...edit, title: e.target.value } }))}
                    />
                    <textarea
                      className="w-full bg-transparent text-xs text-[#3a3a3a] outline-none resize-none"
                      rows={3}
                      value={edit.content}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...edit, content: e.target.value } }))}
                    />
                  </div>

                  {r.estimated_time_gain_minutes > 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> ~{r.estimated_time_gain_minutes} min économisées / mois
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ recoId: r.id, action: 'apply', title: edit.title, content: edit.content })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0E653A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {act.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Ajouter à ma base
                    </button>
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ recoId: r.id, action: 'dismiss' })}
                      className="rounded-full px-3 py-2 text-sm text-[#9ca3af] hover:text-[#71717a]"
                    >
                      Ignorer
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {act.isSuccess && (
          <p className="mt-3 text-[11px] text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mis à jour — l&apos;agent utilisera cette réponse.
          </p>
        )}
        {act.isError && <p className="mt-3 text-[11px] text-red-500">{act.error.message}</p>}
      </div>
    </motion.div>
  )
}
