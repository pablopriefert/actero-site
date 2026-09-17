import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { dateCourte, LIBELLES_FORMULE, LIBELLES_PLAN, LIBELLES_TYPE } from '../../../lib/affichage-closer'
import { Alerte, Chargement, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'
import { MontantCommission, NoteCommission, SignauxCommission } from './commun'
import { useActionEnCours } from './useActionEnCours'

/**
 * À valider : la file des commissions `a_valider`, avec leur contexte.
 * « Remboursable jusqu'au » est une information ; valider reste une décision.
 */
export function FileCommissions() {
  const toast = useToast()
  const client = useQueryClient()
  const { enCours, lancer } = useActionEnCours()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-closer-commissions', 'a_valider'],
    queryFn: () => appelAdmin('closer-commissions', { query: { statut: 'a_valider' } }),
  })

  const decider = (id, corps) => lancer(id, async () => {
    try {
      await appelAdmin('closer-commissions', { methode: 'PATCH', corps: { id, ...corps } })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-closer-commissions'] }),
        client.invalidateQueries({ queryKey: ['admin-closers'] }),
      ])
    } catch (err) {
      toast.error(err.message)
    }
  })

  const refuser = (id) => {
    if (enCours !== null) return
    const note = window.prompt('Motif du refus (visible par le closer) :')
    if (note && note.trim()) decider(id, { action: 'refuser', note })
  }

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const commissions = data?.commissions ?? []
  if (commissions.length === 0) return <p className="text-[14px] text-ink-3">Aucune commission à valider.</p>

  return (
    <div className="space-y-3">
      {data?.tronque && (
        <Alerte ton="info">Plus de 500 commissions à valider : seules les 500 plus récentes sont affichées. Traitez-les, puis rechargez.</Alerte>
      )}
      <Tableau entetes={['Client', 'Closer', 'Offre', 'Encaissé le', 'Remboursable jusqu’au', 'Montant', '']}>
        {commissions.map((c) => (
          <tr key={c.id} className="border-t border-border-cream align-top">
            <td className="px-4 py-3 space-y-1.5">
              <div>
                <div className="text-ink">{c.boutique}</div>
                <div className="text-[12px] text-ink-3">{c.source === 'stripe' ? 'Stripe' : 'Saisie manuelle'}</div>
              </div>
              <NoteCommission note={c.note} />
              <SignauxCommission signaux={c.signaux} />
            </td>
            <td className="px-4 py-3 text-ink-2">{c.closer ? `${c.closer.prenom} ${c.closer.nom}` : '—'}</td>
            <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan]} · {LIBELLES_FORMULE[c.formule]} · {LIBELLES_TYPE[c.type]}</td>
            <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.payee_par_client_le)}</td>
            <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.remboursable_jusqu_au)}</td>
            <td className="px-4 py-3"><MontantCommission commission={c} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={enCours !== null}
                  onClick={() => decider(c.id, { action: 'valider' })}
                  className="h-8 px-3 rounded-full bg-cta hover:bg-cta-hover text-white text-[13px] whitespace-nowrap disabled:opacity-50"
                >
                  {enCours === c.id ? 'En cours…' : 'Valider'}
                </button>
                <button
                  type="button"
                  disabled={enCours !== null}
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
    </div>
  )
}
