import React, { useState } from 'react'
import { LienACopier, RegleRattachement } from './ui'
import { GenerateurLien } from './GenerateurLien'
import { lienDAbonnement, montant } from '../../lib/affichage-closer'

function Chiffre({ libelle, valeur }) {
  return (
    <div className="border border-border-cream rounded-2xl p-5">
      <div className="text-[13px] text-ink-3">{libelle}</div>
      <div className="mt-2 font-mono text-[28px] text-ink tabular-nums">{montant(valeur)}</div>
    </div>
  )
}

/** Accueil : le lien, le générateur, trois chiffres, et ce qui manque au profil. */
export function AccueilCloser({ fiche, totaux, onNavigate }) {
  const [origine] = useState(() => window.location.origin)
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[28px] font-normal">Bonjour {fiche.prenom}</h1>
        <RegleRattachement debut="Une boutique vous est rattachée quand elle s’inscrit" className="mt-1 text-[15px] text-ink-3" />
      </section>

      {fiche.statut === 'suspendu' && (
        <div role="alert" className="p-4 rounded-2xl bg-warn-bg text-[14px] text-ink">
          Votre lien est suspendu : il ne rattache plus de nouveaux clients. Écrivez à{' '}
          <a href="mailto:contact@actero.fr" className="text-cta hover:underline">contact@actero.fr</a>.
        </div>
      )}

      {!fiche.profil_complet && (
        <div className="p-4 rounded-2xl border border-border-cream flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-2">Complétez votre profil de paiement (téléphone, SIRET, IBAN) : il est requis avant votre premier virement.</p>
          <button type="button" onClick={() => onNavigate('/closer/profil')} className="h-9 px-4 rounded-full bg-cta hover:bg-cta-hover text-white text-[14px]">
            Compléter
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-[20px] font-normal">Votre lien</h2>
        <LienACopier lien={lienDAbonnement(origine, fiche.code)} />
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <Chiffre libelle="À valider" valeur={totaux?.a_valider ?? 0} />
        <Chiffre libelle="Validées, à payer" valeur={totaux?.validee ?? 0} />
        <Chiffre libelle="Payées" valeur={totaux?.payee ?? 0} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[20px] font-normal">Un lien pour l’offre convenue</h2>
        <GenerateurLien code={fiche.code} origine={origine} />
      </section>
    </div>
  )
}
