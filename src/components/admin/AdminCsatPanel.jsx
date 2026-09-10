import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ThumbsUp, ThumbsDown, MessageSquareQuote, Smile } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'

/**
 * AdminCsatPanel — satisfaction client mesurée depuis la bulle SAV.
 *
 * La bulle collecte déjà un vote 👍/👎 (+ commentaire) dans `conversation_feedback`,
 * mais cette donnée n'était affichée nulle part : signal perdu. Ce panneau la
 * remonte côté admin (toutes boutiques confondues).
 *
 * Aucune donnée simulée : si la table est vide, on affiche un état vide explicite.
 */
const RANGE_DAYS = 30

function timeAgo(iso, now) {
  const diff = now - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export function AdminCsatPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-csat', RANGE_DAYS],
    queryFn: async () => {
      const since = new Date(Date.now() - RANGE_DAYS * 86400000).toISOString()
      const [{ data: rows, error: rowsError }, { data: clients }] = await Promise.all([
        supabase
          .from('conversation_feedback')
          .select('id, client_id, rating, comment, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('clients').select('id, brand_name'),
      ])
      if (rowsError) throw rowsError
      const names = Object.fromEntries((clients || []).map((c) => [c.id, c.brand_name]))
      return { rows: rows || [], names, fetchedAt: Date.now() }
    },
    staleTime: 60_000,
  })

  const rows = data?.rows || []
  const up = rows.filter((r) => r.rating === 'up').length
  const down = rows.filter((r) => r.rating === 'down').length
  const total = up + down
  const rate = total > 0 ? Math.round((up / total) * 100) : null
  const comments = rows.filter((r) => r.comment && r.comment.trim()).slice(0, 5)

  return (
    <SectionCard title="Satisfaction client (bulle SAV)" icon={Smile}>
      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-14 rounded-xl bg-surface animate-pulse" />
          <div className="h-14 rounded-xl bg-surface animate-pulse" />
        </div>
      )}

      {!isLoading && error && (
        <p className="text-[13px] text-red-600">
          Impossible de charger les avis pour le moment.
        </p>
      )}

      {!isLoading && !error && total === 0 && (
        <div className="text-center py-6">
          <MessageSquareQuote className="w-6 h-6 text-[#d4d4d8] mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-[#1a1a1a]">Pas encore d&apos;avis clients</p>
          <p className="text-[12px] text-[#9ca3af] mt-1 max-w-sm mx-auto">
            Les avis apparaîtront ici dès que les clients noteront les réponses de
            l&apos;agent (👍 / 👎) dans la bulle SAV.
          </p>
        </div>
      )}

      {!isLoading && !error && total > 0 && (
        <div className="space-y-5">
          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-xl border border-[#f0f0f0] bg-white px-4 py-3">
              <div className="text-[11px] font-medium text-[#716D5C]">Satisfaction</div>
              <div className="text-[26px] font-bold text-[#1a1a1a] tabular-nums leading-tight">
                {rate}%
              </div>
              <div className="text-[11px] text-[#9ca3af]">
                sur {total} avis · {RANGE_DAYS} derniers jours
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-[#f0f0f0] bg-white px-4 py-3">
              <div className="text-[11px] font-medium text-[#716D5C]">Répartition</div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-cta tabular-nums">
                  <ThumbsUp className="w-4 h-4" /> {up}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-red-500 tabular-nums">
                  <ThumbsDown className="w-4 h-4" /> {down}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-cta rounded-full" style={{ width: `${rate}%` }} />
              </div>
            </div>
          </div>

          {comments.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-2">
                Derniers commentaires
              </div>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2.5 rounded-xl border border-[#f0f0f0] bg-white px-3.5 py-2.5"
                  >
                    {c.rating === 'up' ? (
                      <ThumbsUp className="w-3.5 h-3.5 text-cta mt-0.5 shrink-0" />
                    ) : (
                      <ThumbsDown className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#1a1a1a] leading-snug">{c.comment}</p>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">
                        {data.names[c.client_id] || 'Client inconnu'} · {timeAgo(c.created_at, data.fetchedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
