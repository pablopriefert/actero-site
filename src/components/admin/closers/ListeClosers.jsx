import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appelAdmin } from '../../../lib/admin-closers'
import { dateCourte, montant } from '../../../lib/affichage-closer'
import { Chargement, ErreurChargement, Tableau } from '../../closer/ui'
import { useToast } from '../../ui/Toast'
import { useActionEnCours } from './useActionEnCours'

/** Les cinq totaux par statut que renvoie l'API (totauxParStatut), en centimes. */
const TOTAUX = [
  ['a_valider', 'À valider'],
  ['validee', 'Validées'],
  ['payee', 'Payées'],
  ['refusee', 'Refusées'],
  ['annulee', 'Annulées'],
]

/**
 * Closers : nom, contact, code, statut, clients, totaux ; suspendre (après
 * confirmation) ou réactiver. Suspendu, un closer ne rattache plus de client
 * par son lien ; ses commissions arrivent toujours dans « À valider ».
 */
export function ListeClosers() {
  const toast = useToast()
  const client = useQueryClient()
  const { enCours, lancer } = useActionEnCours()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-closers'], queryFn: () => appelAdmin('closers') })

  const changerStatut = (k) => {
    const suspendre = k.statut === 'actif'
    return lancer(k.id, async () => {
      try {
        await appelAdmin('closers', { methode: 'PATCH', corps: { closer_id: k.id, action: suspendre ? 'suspendre' : 'reactiver' } })
        toast.success(suspendre ? 'Closer suspendu.' : 'Closer réactivé.')
        await client.invalidateQueries({ queryKey: ['admin-closers'] })
      } catch (err) {
        toast.error(err.message)
      }
    }, {
      confirmation: suspendre
        ? `Suspendre ${k.prenom} ${k.nom} ?\nSon lien ne rattachera plus de nouveaux clients. Ses commissions continuent d’arriver dans « À valider », où vous décidez.`
        : undefined,
    })
  }

  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} />
  const closers = data?.closers ?? []
  if (closers.length === 0) return <p className="text-[14px] text-ink-3">Aucun closer inscrit.</p>

  return (
    <Tableau entetes={['Closer', 'Code', 'Clients', ...TOTAUX.map(([, libelle]) => libelle), 'Profil', 'Statut', '']}>
      {closers.map((k) => {
        const actif = k.statut === 'actif'
        const coordonnees = [k.telephone, k.siret ? `SIRET ${k.siret}` : null].filter(Boolean).join(' · ')
        return (
          <tr key={k.id} className="border-t border-border-cream align-top">
            <td className="px-4 py-3">
              <div className="text-ink">{k.prenom} {k.nom}</div>
              <div className="text-[12px] text-ink-3">{k.email} · inscrit le {dateCourte(k.inscrit_le)}</div>
              {coordonnees && <div className="text-[12px] text-ink-3">{coordonnees}</div>}
            </td>
            <td className="px-4 py-3 font-mono text-ink">{k.code}</td>
            <td className="px-4 py-3 font-mono text-ink">{k.nb_clients}</td>
            {TOTAUX.map(([statut]) => (
              <td key={statut} className="px-4 py-3 font-mono text-ink whitespace-nowrap">{montant(k.totaux?.[statut])}</td>
            ))}
            <td className="px-4 py-3 text-ink-2">{k.profil_complet ? `Complet (${k.iban_masque})` : 'Incomplet'}</td>
            <td className="px-4 py-3 text-ink-2">{actif ? 'Actif' : 'Suspendu'}</td>
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => changerStatut(k)}
                className="h-8 px-3 rounded-full border border-border-cream text-[13px] text-ink whitespace-nowrap hover:border-ink-4 disabled:opacity-50"
              >
                {enCours === k.id ? (actif ? 'Suspension…' : 'Réactivation…') : (actif ? 'Suspendre' : 'Réactiver')}
              </button>
            </td>
          </tr>
        )
      })}
    </Tableau>
  )
}
