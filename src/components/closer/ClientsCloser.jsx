import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { appelCloser } from '../../lib/espace-closer'
import { dateCourte, LIBELLES_ETAT_CLIENT, LIBELLES_FORMULE, LIBELLES_PLAN } from '../../lib/affichage-closer'
import { Chargement, ErreurChargement, Tableau } from './ui'

/** Les clients du closer, du plus récent au plus ancien. */
export function ClientsCloser() {
  const { data, isLoading, error } = useQuery({ queryKey: ['closer-clients'], queryFn: () => appelCloser('clients') })
  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const clients = data?.clients ?? []
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-normal">Vos clients</h1>
      {clients.length === 0 ? (
        <p className="text-[15px] text-ink-3">Aucun client pour l’instant. Chaque boutique qui s’inscrit par votre lien apparaîtra ici.</p>
      ) : (
        <Tableau entetes={['Boutique', 'Plan', 'Formule', 'Rattaché le', 'État']}>
          {clients.map((c) => (
            <tr key={c.id} className="border-t border-border-cream">
              <td className="px-4 py-3 text-ink">{c.boutique}</td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan] ?? '—'}</td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_FORMULE[c.formule] ?? '—'}</td>
              <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(c.rattache_le)}</td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_ETAT_CLIENT[c.etat] ?? '—'}</td>
            </tr>
          ))}
        </Tableau>
      )}
    </section>
  )
}
