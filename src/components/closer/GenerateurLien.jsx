import React, { useState } from 'react'
import { LienACopier } from './ui'
import { commissionAnnoncee, lienDAbonnement, LIBELLES_FORMULE, LIBELLES_PLAN } from '../../lib/affichage-closer'

const PLANS = ['starter', 'pro']
const FORMULES = ['mensuel', 'trimestriel', 'annuel']

function Choix({ libelle, valeurs, libelles, valeur, onChange }) {
  return (
    <fieldset>
      <legend className="text-[13px] text-ink-3 mb-1.5">{libelle}</legend>
      <div className="inline-flex rounded-full border border-border-cream p-1">
        {valeurs.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={valeur === v}
            className={`h-8 px-3.5 rounded-full text-[14px] ${valeur === v ? 'bg-cta text-white' : 'text-ink-2 hover:text-ink'}`}
          >
            {libelles[v]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Le générateur : plan × formule → le lien à envoyer, et ce qu'il rapporte. */
export function GenerateurLien({ code, origine }) {
  const [plan, setPlan] = useState('pro')
  const [formule, setFormule] = useState('mensuel')
  return (
    <div className="border border-border-cream rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap gap-4">
        <Choix libelle="Plan" valeurs={PLANS} libelles={LIBELLES_PLAN} valeur={plan} onChange={setPlan} />
        <Choix libelle="Formule" valeurs={FORMULES} libelles={LIBELLES_FORMULE} valeur={formule} onChange={setFormule} />
      </div>
      <LienACopier lien={lienDAbonnement(origine, code, { plan, formule })} />
      <p className="text-[14px] text-ink-3">
        Votre commission : <span className="font-mono text-ink">{commissionAnnoncee(plan, formule)}</span>. Chaque commission est validée par Actero avant d’être payée.
      </p>
    </div>
  )
}
