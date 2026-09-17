import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { appelCloser } from '../../lib/espace-closer'
import { dateCourte, LIBELLES_FORMULE, LIBELLES_PLAN, LIBELLES_STATUT_COMMISSION, LIBELLES_TYPE, montant } from '../../lib/affichage-closer'
import { Chargement, ErreurChargement, Tableau } from './ui'

/** Les commissions du closer, de la plus récente à la plus ancienne. */
export function CommissionsCloser() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['closer-commissions'], queryFn: () => appelCloser('commissions') })
  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} onReessayer={refetch} />
  const commissions = data?.commissions ?? []
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-normal">Vos commissions</h1>
      <p className="text-[15px] text-ink-3">Actero valide chaque commission, puis la paie par virement.</p>
      {commissions.length === 0 ? (
        <p className="text-[15px] text-ink-3">Aucune commission pour l’instant.</p>
      ) : (
        <Tableau entetes={['Date', 'Boutique', 'Offre', 'Type', 'Montant', 'Statut']}>
          {commissions.map((c) => (
            <tr key={c.id} className="border-t border-border-cream align-top">
              <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.paye_par_client_le || c.cree_le)}</td>
              <td className="px-4 py-3 text-ink">{c.boutique}</td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan] ?? c.plan} · {LIBELLES_FORMULE[c.formule] ?? c.formule}</td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_TYPE[c.type] ?? c.type}</td>
              <td className="px-4 py-3 font-mono text-ink tabular-nums whitespace-nowrap">{montant(c.montant_centimes)}</td>
              <td className="px-4 py-3 text-ink-2">
                {LIBELLES_STATUT_COMMISSION[c.statut] ?? c.statut}
                {c.motif && <span className="block text-[12px] text-ink-3">{c.motif}</span>}
              </td>
            </tr>
          ))}
        </Tableau>
      )}
    </section>
  )
}
