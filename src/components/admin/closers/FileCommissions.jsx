import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { dateCourte, LIBELLES_FORMULE, LIBELLES_PLAN, LIBELLES_TYPE, montant } from '../../../lib/affichage-closer'
import { Chargement, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'

/**
 * À valider : la file des commissions `a_valider`, avec leur contexte.
 * « Remboursable jusqu'au » est une information ; valider reste une décision.
 */
export function FileCommissions() {
  const toast = useToast()
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-closer-commissions', 'a_valider'],
    queryFn: () => appelAdmin('closer-commissions', { query: { statut: 'a_valider' } }),
  })
  const decision = useMutation({
    mutationFn: (corps) => appelAdmin('closer-commissions', { methode: 'PATCH', corps }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-closer-commissions'] })
      client.invalidateQueries({ queryKey: ['admin-closers'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const refuser = (id) => {
    const note = window.prompt('Motif du refus (visible par le closer) :')
    if (note && note.trim()) decision.mutate({ id, action: 'refuser', note })
  }

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const commissions = data?.commissions ?? []
  if (commissions.length === 0) return <p className="text-[14px] text-ink-3">Aucune commission à valider.</p>

  return (
    <Tableau entetes={['Client', 'Closer', 'Offre', 'Encaissé le', 'Remboursable jusqu’au', 'Montant', '']}>
      {commissions.map((c) => (
        <tr key={c.id} className="border-t border-border-cream align-top">
          <td className="px-4 py-3">
            <div className="text-ink">{c.boutique}</div>
            <div className="text-[12px] text-ink-3">{c.source === 'stripe' ? 'Stripe' : 'Saisie manuelle'}{c.note ? ` · ${c.note}` : ''}</div>
          </td>
          <td className="px-4 py-3 text-ink-2">
            {c.closer ? `${c.closer.prenom} ${c.closer.nom}` : '—'}
            {c.closer?.statut === 'suspendu' && <span className="block text-[12px] text-ink-3">suspendu</span>}
          </td>
          <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan]} · {LIBELLES_FORMULE[c.formule]} · {LIBELLES_TYPE[c.type]}</td>
          <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.payee_par_client_le)}</td>
          <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.remboursable_jusqu_au)}</td>
          <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{montant(c.montant_centimes)}</td>
          <td className="px-4 py-3">
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={decision.isPending}
                onClick={() => decision.mutate({ id: c.id, action: 'valider' })}
                className="h-8 px-3 rounded-full bg-cta hover:bg-cta-hover text-white text-[13px] disabled:opacity-50"
              >
                Valider
              </button>
              <button
                type="button"
                disabled={decision.isPending}
                onClick={() => refuser(c.id)}
                className="h-8 px-3 rounded-full border border-border-cream text-[13px] text-ink hover:border-ink-4 disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
          </td>
        </tr>
      ))}
    </Tableau>
  )
}
