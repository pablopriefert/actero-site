import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { dateCourte, LIBELLES_PLAN } from '../../../lib/affichage-closer'
import { Chargement, Champ, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'

/**
 * Attributions : chercher un client, rattacher, changer ou retirer son closer.
 * Décision d'Actero : les règles du lien ne s'appliquent pas ; les commissions
 * déjà créées ne bougent pas.
 */
export function Attributions() {
  const toast = useToast()
  const client = useQueryClient()
  const [saisie, setSaisie] = useState('')
  const [recherche, setRecherche] = useState('')
  const { data, isFetching, error } = useQuery({
    queryKey: ['admin-closer-attribution', recherche],
    queryFn: () => appelAdmin('closer-attribution', { query: { q: recherche } }),
  })

  const changer = async (clientId, closerId) => {
    try {
      await appelAdmin('closer-attribution', { methode: 'PATCH', corps: { client_id: clientId, closer_id: closerId || null } })
      toast.success(closerId ? 'Closer rattaché.' : 'Closer retiré.')
      await client.invalidateQueries({ queryKey: ['admin-closer-attribution'] })
      await client.invalidateQueries({ queryKey: ['admin-closers'] })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const closers = data?.closers ?? []
  const clients = data?.clients ?? []

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setRecherche(saisie.trim()) }} className="flex gap-2 items-end max-w-xl">
        <div className="flex-1">
          <Champ libelle="Boutique ou e-mail de contact" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </div>
        <button type="submit" className="h-11 px-4 rounded-full bg-cta hover:bg-cta-hover text-white text-[14px]">Chercher</button>
      </form>
      {error && <ErreurChargement erreur={error} />}
      {isFetching && <Chargement />}
      {!isFetching && recherche.length >= 2 && clients.length === 0 && <p className="text-[14px] text-ink-3">Aucun client trouvé.</p>}
      {clients.length > 0 && (
        <Tableau entetes={['Client', 'Plan', 'Closer', 'Depuis', '']}>
          {clients.map((c) => (
            <tr key={c.id} className="border-t border-border-cream align-top">
              <td className="px-4 py-3">
                <div className="text-ink">{c.boutique}</div>
                <div className="text-[12px] text-ink-3">{c.contact_email}</div>
              </td>
              <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[c.plan] ?? c.plan}</td>
              <td className="px-4 py-3">
                <select
                  value={c.closer_id ?? ''}
                  onChange={(e) => changer(c.id, e.target.value)}
                  aria-label={`Closer de ${c.boutique}`}
                  className="h-9 px-2 rounded-xl border border-border-cream bg-white text-[14px]"
                >
                  <option value="">Aucun</option>
                  {closers.map((k) => (
                    <option key={k.id} value={k.id}>{k.prenom} {k.nom} ({k.code}){k.statut === 'suspendu' ? ' — suspendu' : ''}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                {dateCourte(c.rattache_le)}{c.source ? ` · ${c.source === 'lien' ? 'lien' : 'manuel'}` : ''}
              </td>
              <td className="px-4 py-3 text-right">
                {c.closer_id && (
                  <button type="button" onClick={() => changer(c.id, null)} className="text-[13px] text-ink-3 hover:text-ink">Retirer</button>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      )}
    </div>
  )
}
