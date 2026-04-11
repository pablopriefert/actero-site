import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SectionCard } from '../ui/SectionCard'
import { EmptyState } from '../ui/EmptyState'

/**
 * Extract @mentions from a markdown body.
 * Matches @word (letters, numbers, dot, underscore, dash) after start or whitespace.
 */
function extractMentions(text) {
  if (!text) return []
  const re = /(^|\s)@([A-Za-z0-9_.-]{2,})/g
  const out = new Set()
  let m
  while ((m = re.exec(text)) !== null) out.add(m[2])
  return Array.from(out)
}

/** Relative time in fr. */
function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - d)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const j = Math.floor(h / 24)
  if (j < 30) return `il y a ${j}j`
  const mo = Math.floor(j / 30)
  return `il y a ${mo}mo`
}

/** Minimal markdown: **bold**, \n\n -> paragraphs, @mention highlight. */
function renderMarkdown(text) {
  if (!text) return null
  const paragraphs = text.split(/\n{2,}/)
  return paragraphs.map((p, i) => (
    <p key={i} className="text-[13px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
      {renderInline(p)}
    </p>
  ))
}

function renderInline(text) {
  // Split bold first, then mentions in each chunk.
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[#1a1a1a]">
          {renderMentions(part.slice(2, -2))}
        </strong>
      )
    }
    return <React.Fragment key={idx}>{renderMentions(part)}</React.Fragment>
  })
}

function renderMentions(chunk) {
  const parts = chunk.split(/(@[A-Za-z0-9_.-]{2,})/g)
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      return (
        <span
          key={i}
          className="text-[#0F5F35] font-semibold bg-[#0F5F35]/10 rounded px-1"
        >
          {p}
        </span>
      )
    }
    return <React.Fragment key={i}>{p}</React.Fragment>
  })
}

function initialsFromEmail(email) {
  if (!email) return '??'
  const base = email.split('@')[0]
  const parts = base.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

/**
 * AdminClientNotesPanel — CRM-lite notes panel for a given client.
 *
 * @param {{ clientId: string }} props
 */
export function AdminClientNotesPanel({ clientId }) {
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || null)
    })
  }, [])

  const {
    data: notes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-client-notes', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const authFetch = useCallback(async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      ...(init.headers || {}),
    }
    const resp = await fetch(url, { ...init, headers })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${resp.status}`)
    }
    return resp.json()
  }, [])

  const handleCreate = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await authFetch('/api/admin/client-notes', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          body: draft.trim(),
          mentions: extractMentions(draft),
        }),
      })
      setDraft('')
      setComposing(false)
      await refetch()
    } catch (err) {
      console.error('[notes] create failed:', err.message)
      alert(`Erreur: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditSave = async (noteId) => {
    if (!editDraft.trim()) return
    setSaving(true)
    try {
      await authFetch('/api/admin/client-notes', {
        method: 'PATCH',
        body: JSON.stringify({
          note_id: noteId,
          body: editDraft.trim(),
          mentions: extractMentions(editDraft),
        }),
      })
      setEditingId(null)
      setEditDraft('')
      await refetch()
    } catch (err) {
      console.error('[notes] update failed:', err.message)
      alert(`Erreur: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId) => {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await authFetch(`/api/admin/client-notes?note_id=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      })
      await refetch()
    } catch (err) {
      console.error('[notes] delete failed:', err.message)
      alert(`Erreur: ${err.message}`)
    }
  }

  const action = (
    <button
      type="button"
      onClick={() => {
        setComposing((v) => !v)
        setDraft('')
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold hover:bg-[#0d5030] transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      Nouvelle note
    </button>
  )

  return (
    <SectionCard title="Notes internes" icon={MessageSquare} action={action}>
      {composing && (
        <div className="mb-4 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Note... utilise @username pour tagger un collègue (supporte **gras**)"
            className="w-full resize-none bg-white rounded-lg border border-[#f0f0f0] px-3 py-2 font-mono text-[12px] text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#0F5F35]/40"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11px] text-[#9ca3af]">
              {extractMentions(draft).length > 0
                ? `Mentions: ${extractMentions(draft).map((m) => `@${m}`).join(', ')}`
                : 'Aucune mention'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposing(false)
                  setDraft('')
                }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#71717a] hover:bg-white"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!draft.trim() || saving}
                onClick={handleCreate}
                className="px-3 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-[#0d5030]"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-[12px] text-[#9ca3af] py-6 text-center">Chargement…</div>
      )}

      {!isLoading && notes.length === 0 && !composing && (
        <EmptyState
          icon={MessageSquare}
          title="Aucune note interne"
          description="Ajoute une note pour garder trace du contexte client, taguer des collègues et construire un mini-CRM partagé."
        />
      )}

      {!isLoading && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => {
            const isOwn = currentUserId && note.author_id === currentUserId
            const isEditing = editingId === note.id
            return (
              <div
                key={note.id}
                className="rounded-xl border border-[#f0f0f0] bg-white p-3 hover:border-[#0F5F35]/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0F5F35]/10 text-[#0F5F35] flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                    {initialsFromEmail(note.author_email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#1a1a1a] truncate">
                          {note.author_email || 'Admin'}
                        </div>
                        <div className="text-[11px] text-[#9ca3af]">
                          {timeAgo(note.created_at)}
                          {note.updated_at && note.updated_at !== note.created_at && ' · modifié'}
                        </div>
                      </div>
                      {isOwn && !isEditing && (
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setMenuOpenId((id) => (id === note.id ? null : note.id))
                            }
                            className="p-1 rounded-md hover:bg-[#fafafa] text-[#9ca3af]"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpenId === note.id && (
                            <div className="absolute right-0 top-7 z-10 w-36 rounded-lg border border-[#f0f0f0] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(note.id)
                                  setEditDraft(note.body || '')
                                  setMenuOpenId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#fafafa]"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Éditer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(note.id)
                                  setMenuOpenId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#ef4444] hover:bg-[#fafafa]"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={4}
                          className="w-full resize-none bg-[#fafafa] rounded-lg border border-[#f0f0f0] px-3 py-2 font-mono text-[12px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setEditDraft('')
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#71717a] hover:bg-[#fafafa]"
                          >
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button
                            type="button"
                            disabled={!editDraft.trim() || saving}
                            onClick={() => handleEditSave(note.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0F5F35] text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> {saving ? '…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">{renderMarkdown(note.body)}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

export default AdminClientNotesPanel
