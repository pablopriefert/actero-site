import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { SEO } from '../../components/SEO'
import { Logo } from '../../components/layout/Logo'
import { appelCloser } from '../../lib/espace-closer'
import { Chargement, ErreurChargement } from '../../components/closer/ui'
import { AccueilCloser } from '../../components/closer/AccueilCloser'
import { ClientsCloser } from '../../components/closer/ClientsCloser'
import { CommissionsCloser } from '../../components/closer/CommissionsCloser'
import { ProfilCloser } from '../../components/closer/ProfilCloser'
import { DevenirCloser } from '../../components/closer/DevenirCloser'

const ONGLETS = [
  { route: '/closer', libelle: 'Accueil' },
  { route: '/closer/clients', libelle: 'Clients' },
  { route: '/closer/commissions', libelle: 'Commissions' },
  { route: '/closer/profil', libelle: 'Profil et paiement' },
]

/**
 * /closer — l'espace closer : accueil, clients, commissions, profil et paiement.
 *
 * Tout passe par /api/closer/* ; sans session, retour à /closer/connexion ; un
 * compte sans fiche voit « Devenir closer ».
 */
export function CloserEspacePage({ currentRoute, onNavigate, onLogout }) {
  const moi = useQuery({ queryKey: ['closer-moi'], queryFn: () => appelCloser('moi'), retry: false, staleTime: 30_000 })
  const statut = moi.error?.status

  useEffect(() => {
    if (statut === 401) onNavigate('/closer/connexion')
  }, [statut, onNavigate])

  const route = ONGLETS.some((o) => o.route === currentRoute) ? currentRoute : '/closer'
  const fiche = moi.data?.fiche

  let contenu
  if (moi.isPending || statut === 401) contenu = <Chargement />
  else if (statut === 404) contenu = <DevenirCloser />
  else if (moi.error || !fiche) contenu = <ErreurChargement erreur={moi.error} onReessayer={moi.refetch} />
  else if (route === '/closer/clients') contenu = <ClientsCloser />
  else if (route === '/closer/commissions') contenu = <CommissionsCloser />
  else if (route === '/closer/profil') contenu = <ProfilCloser key={fiche.code} fiche={fiche} />
  else contenu = <AccueilCloser fiche={fiche} totaux={moi.data.totaux} onNavigate={onNavigate} />

  return (
    <>
      <SEO title="Espace closer — Actero" description="Votre espace closer Actero." noindex />
      <div className="min-h-screen bg-white font-sans text-ink">
        <header className="border-b border-border-cream">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-7 h-7 text-ink" />
              <span className="text-[15px] text-ink">Espace closer</span>
            </div>
            <div className="flex items-center gap-4">
              {fiche && <span className="hidden sm:inline text-[14px] text-ink-3">{fiche.prenom} {fiche.nom}</span>}
              <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
                <LogOut className="w-4 h-4" aria-hidden="true" /> Déconnexion
              </button>
            </div>
          </div>
          {fiche && (
            <nav aria-label="Espace closer" className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto">
              {ONGLETS.map((o) => (
                <button
                  key={o.route}
                  type="button"
                  onClick={() => onNavigate(o.route)}
                  aria-current={route === o.route ? 'page' : undefined}
                  className={`h-11 text-[14px] border-b-2 whitespace-nowrap ${route === o.route ? 'border-cta text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}
                >
                  {o.libelle}
                </button>
              ))}
            </nav>
          )}
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{contenu}</main>
      </div>
    </>
  )
}
