import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { appelCloser, lireActivite } from '../../lib/espace-closer'
import { dateCourte, dateRelative, LIBELLES_ETAT_CLIENT, LIBELLES_FORMULE, LIBELLES_PLAN } from '../../lib/affichage-closer'
import { BadgeEtape, Chargement, ErreurChargement, LigneEtape, RegleRattachement, Tableau } from './ui'

const ENTETES = ['Boutique', 'Plan', 'Formule', 'Rattaché le', 'État']

/** Le parcours d'un client, de sa première étape à la plus récente. */
function Parcours({ requete }) {
  if (requete.isPending) return <Chargement />
  if (requete.isError) return <ErreurChargement erreur={requete.error} onReessayer={requete.refetch} />
  const etapes = [...(requete.data?.evenements ?? [])].reverse()
  if (etapes.length === 0) {
    return <p className="text-[14px] text-ink-3">Aucune étape enregistrée : le suivi a commencé le 17 septembre 2026.</p>
  }
  const maintenant = new Date()
  return (
    <div className="space-y-2">
      {requete.data?.suivant && <p className="text-[13px] text-ink-3">Ses {etapes.length} dernières étapes :</p>}
      <ol className="border border-border-cream rounded-2xl divide-y divide-border-cream bg-white">
        {etapes.map((e) => (
          <LigneEtape key={e.id} evenement={e} moment={dateRelative(e.survenu_le, maintenant)} avecBoutique={false} />
        ))}
      </ol>
    </div>
  )
}

/**
 * Une ligne de client, qui se déplie sur son parcours. Le parcours n'est lu
 * qu'à la première ouverture ; le badge de la dernière étape apparaît alors,
 * et reste une fois la ligne repliée.
 */
function LigneClient({ client }) {
  const [ouvert, setOuvert] = useState(false)
  const parcours = useQuery({
    queryKey: ['closer-parcours', client.id],
    queryFn: () => lireActivite({ client: client.id }),
    enabled: ouvert,
  })
  const derniere = parcours.data?.evenements?.[0]
  const idParcours = `parcours-${client.id}`
  return (
    <>
      <tr className="border-t border-border-cream">
        <td className="px-4 py-3 text-ink">
          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={idParcours}
            onClick={() => setOuvert((o) => !o)}
            className="inline-flex items-center gap-1.5 text-left hover:text-cta"
          >
            <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${ouvert ? 'rotate-90' : ''}`} aria-hidden="true" />
            {client.boutique || 'Boutique sans nom'}
          </button>
          {derniere && (
            <div className="mt-1.5 pl-5.5">
              <span className="sr-only">Dernière étape : </span>
              <BadgeEtape evenement={derniere} />
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-ink-2">{LIBELLES_PLAN[client.plan] ?? '—'}</td>
        <td className="px-4 py-3 text-ink-2">{LIBELLES_FORMULE[client.formule] ?? '—'}</td>
        <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{dateCourte(client.rattache_le)}</td>
        <td className="px-4 py-3 text-ink-2">{LIBELLES_ETAT_CLIENT[client.etat] ?? '—'}</td>
      </tr>
      <tr id={idParcours} hidden={!ouvert}>
        <td colSpan={ENTETES.length} className="px-4 pb-4">
          {ouvert && <Parcours requete={parcours} />}
        </td>
      </tr>
    </>
  )
}

/** Les clients du closer, du plus récent au plus ancien. */
export function ClientsCloser() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['closer-clients'], queryFn: () => appelCloser('clients') })
  if (isLoading) return <Chargement />
  if (error) return <ErreurChargement erreur={error} onReessayer={refetch} />
  const clients = data?.clients ?? []
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-normal">Vos clients</h1>
      {/* Toujours affichée : un client absent de la liste se réclame par e-mail. */}
      <RegleRattachement debut="Une boutique apparaît ici quand elle s’inscrit" className="text-[15px] text-ink-3" />
      {clients.length === 0 ? (
        <p className="text-[15px] text-ink-3">Aucun client pour l’instant.</p>
      ) : (
        <>
          <p className="text-[14px] text-ink-3">Ouvrez une boutique pour voir son parcours, étape par étape.</p>
          <Tableau entetes={ENTETES}>
            {clients.map((c) => <LigneClient key={c.id} client={c} />)}
          </Tableau>
        </>
      )}
    </section>
  )
}
