import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { dateCourte, montant } from '../../../lib/affichage-closer'
import { Chargement, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'

/** Closers : nom, e-mail, code, statut, clients, totaux ; suspendre ou réactiver. */
export function ListeClosers() {
  const toast = useToast()
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-closers'], queryFn: () => appelAdmin('closers') })
  const statut = useMutation({
    mutationFn: ({ id, action }) => appelAdmin('closers', { methode: 'PATCH', corps: { closer_id: id, action } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-closers'] }),
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const closers = data?.closers ?? []
  if (closers.length === 0) return <p className="text-[14px] text-ink-3">Aucun closer inscrit.</p>

  return (
    <Tableau entetes={['Closer', 'Code', 'Clients', 'À valider', 'Validées', 'Payées', 'Profil', 'Statut', '']}>
      {closers.map((k) => (
        <tr key={k.id} className="border-t border-border-cream align-top">
          <td className="px-4 py-3">
            <div className="text-ink">{k.prenom} {k.nom}</div>
            <div className="text-[12px] text-ink-3">{k.email} · inscrit le {dateCourte(k.inscrit_le)}</div>
          </td>
          <td className="px-4 py-3 font-mono text-ink">{k.code}</td>
          <td className="px-4 py-3 font-mono text-ink">{k.nb_clients}</td>
          <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{montant(k.totaux.a_valider)}</td>
          <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{montant(k.totaux.validee)}</td>
          <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{montant(k.totaux.payee)}</td>
          <td className="px-4 py-3 text-ink-2">{k.profil_complet ? `Complet (${k.iban_masque})` : 'Incomplet'}</td>
          <td className="px-4 py-3 text-ink-2">{k.statut === 'actif' ? 'Actif' : 'Suspendu'}</td>
          <td className="px-4 py-3 text-right">
            <button
              type="button"
              disabled={statut.isPending}
              onClick={() => statut.mutate({ id: k.id, action: k.statut === 'actif' ? 'suspendre' : 'reactiver' })}
              className="h-8 px-3 rounded-full border border-border-cream text-[13px] text-ink hover:border-ink-4 disabled:opacity-50"
            >
              {k.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
            </button>
          </td>
        </tr>
      ))}
    </Tableau>
  )
}
