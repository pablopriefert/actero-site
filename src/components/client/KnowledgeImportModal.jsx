import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  X, FileText, CheckSquare, Square, Loader2, ExternalLink,
  Upload, Check, AlertCircle, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Modal to import documents from Google Docs / Notion into the knowledge base.
 *
 * Props:
 *  - clientId
 *  - provider: 'google_docs' | 'notion'
 *  - onClose
 *  - onSuccess: (importedCount) => void
 */
export const KnowledgeImportModal = ({ clientId, provider, onClose, onSuccess }) => {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(new Set())

  const providerLabel = provider === 'google_docs' ? 'Google Docs' : 'Notion'

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['kb-import-list', provider, clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/integrations/knowledge-import?provider=${provider}&action=list`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      return data.documents || []
    },
    enabled: !!clientId,
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/integrations/knowledge-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider,
          action: 'import',
          doc_ids: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-knowledge-base'] })
      // If everything failed, show the first error instead of a misleading "0 imported"
      if (data.count === 0 && data.errors?.length > 0) {
        const firstErr = data.errors[0]?.error || 'Erreur inconnue'
        throw new Error(`Aucun document importé. Cause : ${firstErr}`)
      }
      onSuccess?.(data.count)
    },
  })

  const toggle = (id) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === documents.length) setSelected(new Set())
    else setSelected(new Set(documents.map((d) => d.id)))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1a1a1a]">Importer depuis {providerLabel}</h3>
              <p className="text-xs text-[#71717a]">
                Sélectionnez les documents à ajouter à votre base de connaissances
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-[#71717a]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 text-[#0F5F35] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#71717a]">Chargement de vos documents…</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1a1a1a]">Impossible de charger</p>
              <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">{error.message}</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center max-w-md mx-auto">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-[#1a1a1a]">Aucun document trouvé</p>
              {provider === 'notion' ? (
                <div className="text-xs text-[#71717a] mt-3 space-y-2 text-left bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <p className="font-semibold text-amber-700">Pour voir vos pages Notion ici :</p>
                  <ol className="list-decimal pl-4 space-y-1 text-amber-700">
                    <li>Ouvrez la page Notion à importer</li>
                    <li>Cliquez sur <strong>« •••»</strong> en haut à droite</li>
                    <li>Sélectionnez <strong>« Connexions »</strong> → <strong>« Actero »</strong></li>
                    <li>Confirmez l'accès</li>
                    <li>Revenez ici et rechargez la liste</li>
                  </ol>
                  <p className="text-[10px] text-amber-600 mt-2 italic">
                    Notion ne partage que les pages explicitement connectées à l'intégration.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#71717a] mt-1">
                  Assurez-vous d'avoir accordé l'accès aux bons documents.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs font-semibold text-[#0F5F35] hover:bg-[#0F5F35]/5 px-2 py-1.5 rounded-md transition-colors"
                >
                  {selected.size === documents.length && documents.length > 0 ? (
                    <><CheckSquare className="w-3.5 h-3.5" /> Tout désélectionner</>
                  ) : (
                    <><Square className="w-3.5 h-3.5" /> Tout sélectionner</>
                  )}
                </button>
                <span className="text-xs text-[#71717a]">
                  {selected.size} / {documents.length} sélectionné{selected.size > 1 ? 's' : ''}
                </span>
              </div>

              {/* Documents list */}
              <div className="space-y-1">
                {documents.map((doc) => {
                  const isSelected = selected.has(doc.id)
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggle(doc.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'border-[#0F5F35] bg-[#0F5F35]/5'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-[#0F5F35]' : 'border-2 border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <FileText className="w-4 h-4 text-[#71717a] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{doc.title}</p>
                        {doc.modified && (
                          <p className="text-[10px] text-[#9ca3af]">
                            Modifié {new Date(doc.modified).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-gray-100 text-[#9ca3af]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </button>
                  )
                })}
              </div>

              {importMutation.isError && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {importMutation.error.message}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-[#9ca3af]">
            {selected.size > 0 && `${selected.size} document${selected.size > 1 ? 's' : ''} à importer`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-[#71717a] hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => importMutation.mutate()}
              disabled={selected.size === 0 || importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F5F35] text-white text-sm font-semibold hover:bg-[#003725] disabled:opacity-40 transition-colors"
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Import…</>
              ) : (
                <>Importer <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
