import React, { useEffect } from 'react'
import { SEO } from '../components/SEO'
import { destinationDuLien, formuleDuLien, memoriserCodeCloser, signalerOuvertureDuLien } from '../lib/code-closer'
import { memoriserFormuleChoisie } from '../lib/affichage-formules'

/**
 * /c/:code — le lien d'abonnement d'un closer.
 *
 * Mémorise le code (cookie de 60 jours, avec l'identifiant de visite) et,
 * s'il y en a, le plan et la formule convenus ; signale l'ouverture au fil du
 * closer, sans l'attendre ; puis mène à l'inscription marchand. Le code sera
 * présenté au serveur une fois le compte créé (src/lib/code-closer.js). La
 * page n'est ni listée ni indexée.
 */
export function LienCloserPage({ code }) {
  useEffect(() => {
    let brut = ''
    try {
      brut = decodeURIComponent(code || '')
    } catch {
      // segment mal encodé : aucun code à mémoriser
    }
    memoriserCodeCloser(brut)
    // Ne lève pas et n'attend rien : la redirection part quoi qu'il arrive.
    signalerOuvertureDuLien(brut)
    const formule = formuleDuLien(new URLSearchParams(window.location.search))
    if (formule) memoriserFormuleChoisie(formule)
    // `replace` : le retour arrière ne ramène pas sur ce lien.
    window.location.replace(destinationDuLien(formule))
  }, [code])

  return (
    <>
      <SEO title="Actero" description="Redirection vers l’inscription Actero." noindex />
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <p className="text-[14px] text-ink-3">Redirection…</p>
      </div>
    </>
  )
}
