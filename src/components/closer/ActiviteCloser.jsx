import React, { useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { lireActivite } from '../../lib/espace-closer'
import { FILTRES_ACTIVITE, grouperParJour, momentDuFil } from '../../lib/affichage-closer'
import { Chargement, ErreurChargement, LigneEtape } from './ui'

/** Le fil se relit toutes les minutes, tant que la page est visible. */
const RAFRAICHISSEMENT_MS = 60_000

function Compteur({ libelle, valeur }) {
  return (
    <div className="border border-border-cream rounded-2xl p-5">
      <div className="text-[13px] text-ink-3">{libelle}</div>
      <div className="mt-2 font-mono text-[28px] text-ink tabular-nums">{Number.isInteger(valeur) ? valeur : '—'}</div>
    </div>
  )
}

function Filtres({ famille, onChoisir }) {
  return (
    <div role="group" aria-label="Filtrer l’activité" className="flex flex-wrap gap-2">
      {FILTRES_ACTIVITE.map((f) => {
        const actif = famille === f.famille
        return (
          <button
            key={f.libelle}
            type="button"
            aria-pressed={actif}
            onClick={() => onChoisir(f.famille)}
            className={`h-9 px-4 rounded-full text-[14px] transition-colors ${actif ? 'bg-cta hover:bg-cta-hover text-white' : 'border border-border-cream bg-white hover:bg-cream text-ink'}`}
          >
            {f.libelle}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Onglet Activité : trois compteurs, puis le fil des boutiques venues par le
 * lien du closer, groupé par jour, filtrable par famille, page par page.
 * Spec : docs/superpowers/specs/2026-09-17-closers-fil-activite-design.md
 */
export function ActiviteCloser() {
  const [famille, setFamille] = useState(null)
  const fil = useInfiniteQuery({
    queryKey: ['closer-activite', famille ?? 'tout'],
    queryFn: ({ pageParam }) => lireActivite({ famille, avant: pageParam }),
    initialPageParam: null,
    getNextPageParam: (page) => page?.suivant ?? undefined,
    // Changer de filtre garde les compteurs et le fil affichés le temps de la lecture.
    placeholderData: keepPreviousData,
    refetchInterval: RAFRAICHISSEMENT_MS,
    refetchIntervalInBackground: false,
  })

  const pages = fil.data?.pages ?? []
  const resume = pages[0]?.resume
  const evenements = pages.flatMap((p) => p?.evenements ?? [])
  const maintenant = new Date()

  let contenu
  if (fil.isPending) contenu = <Chargement />
  else if (fil.isError && !fil.data) contenu = <ErreurChargement erreur={fil.error} onReessayer={fil.refetch} />
  else if (evenements.length === 0) {
    contenu = (
      <p className="text-[15px] text-ink-3">
        {famille
          ? 'Aucune étape de ce type pour l’instant.'
          : 'Rien pour l’instant : partagez votre lien pour voir l’activité de vos prospects ici.'}
      </p>
    )
  } else {
    contenu = (
      <div aria-busy={fil.isPlaceholderData || undefined} className={`space-y-6 transition-opacity ${fil.isPlaceholderData ? 'opacity-60' : ''}`}>
        {grouperParJour(evenements, maintenant).map((groupe) => (
          <section key={groupe.jour} className="space-y-2">
            <h2 className="text-[13px] font-normal text-ink-3">{groupe.jour}</h2>
            <ul className="border border-border-cream rounded-2xl divide-y divide-border-cream">
              {groupe.evenements.map((e) => (
                <LigneEtape key={e.id} evenement={e} moment={momentDuFil(e.survenu_le, maintenant)} />
              ))}
            </ul>
          </section>
        ))}
        {fil.isFetchNextPageError ? (
          <ErreurChargement erreur={fil.error} onReessayer={fil.fetchNextPage} />
        ) : (
          fil.hasNextPage && (
            <button
              type="button"
              onClick={() => fil.fetchNextPage()}
              disabled={fil.isFetchingNextPage}
              className="h-9 px-4 rounded-full border border-border-cream bg-white hover:bg-cream text-[14px] text-ink disabled:opacity-50"
            >
              {fil.isFetchingNextPage ? 'Chargement…' : 'Voir plus'}
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[28px] font-normal">Activité</h1>
        <p className="mt-1 text-[15px] text-ink-3">
          Les étapes des boutiques venues par votre lien, avec leur date. Vous ne voyez jamais leurs montants, leurs
          conversations ni les données de leur boutique.
        </p>
      </section>

      <section aria-label="En bref" className="grid sm:grid-cols-3 gap-4">
        <Compteur libelle="Visites de votre lien, sur 7 jours" valeur={resume?.visites_7j} />
        <Compteur libelle="Inscriptions, sur 30 jours" valeur={resume?.inscriptions_30j} />
        <Compteur libelle="Paiements en attente" valeur={resume?.paiements_en_attente} />
      </section>

      <section className="space-y-4">
        <Filtres famille={famille} onChoisir={setFamille} />
        {contenu}
      </section>
    </div>
  )
}
