import React, { useEffect, useRef, useState } from 'react'
import { SEO } from '../../components/SEO'
import { INITIAL_URL, supabase } from '../../lib/supabase'
import { lireIntentionGoogle, oublierIntentionGoogle, terminerRetourGoogleCloser } from '../../lib/espace-closer'
import { CadreCloser } from '../../components/closer/ui'

/**
 * Le refus de Google (connexion annulée, accès refusé) revient dans l'adresse
 * de retour : `?error=` ou `#error=`. INITIAL_URL, parce que le client
 * Supabase lit le fragment avant que la page ne se monte.
 */
function refusDansLUrl() {
  if (INITIAL_URL.path !== '/closer/callback') return null
  const requete = new URLSearchParams(INITIAL_URL.search)
  const fragment = new URLSearchParams(INITIAL_URL.hash.replace(/^#/, ''))
  return requete.get('error') || fragment.get('error')
}

/**
 * /closer/callback — le retour de Google pour l'espace closer.
 *
 * Après une inscription, crée la fiche closer (api/closer/devenir-closer.js,
 * par terminerRetourGoogleCloser, que /auth/callback partage) ; puis mène à
 * /closer, qui propose « Devenir closer » à un compte sans fiche.
 * Ne crée JAMAIS de client marchand : ni resolveOrCreateClientId, ni écriture
 * dans `clients` (spec closers, garde src/lib/pages-closer.test.js).
 *
 * Un refus de Google s'affiche tout de suite : aucune session n'arrivera, et
 * la page attendait quinze secondes pour le dire.
 *
 * L'aiguillage est lancé depuis deux endroits (session déjà là, ou résolue
 * ensuite) et deux fois en développement (StrictMode) : une référence garantit
 * qu'il ne tourne qu'une fois.
 */
export function CloserCallbackPage({ onNavigate }) {
  const [refus] = useState(refusDansLUrl)
  // Lue avant d'être oubliée : un départ d'inscription raté ramène à l'inscription.
  const [retour] = useState(() => (lireIntentionGoogle() === 'inscription' ? '/closer/inscription' : '/closer/connexion'))
  const [erreur, setErreur] = useState(() => (refus ? 'La connexion Google a été refusée ou annulée. Réessayez.' : null))
  const lance = useRef(false)

  useEffect(() => {
    if (refus) {
      // L'intention d'un départ raté ne doit pas détourner la prochaine connexion.
      oublierIntentionGoogle()
      return undefined
    }
    let vivant = true

    const poursuivre = async (session) => {
      if (!session || lance.current) return
      lance.current = true
      onNavigate(await terminerRetourGoogleCloser())
    }

    supabase.auth.getSession().then(({ data }) => poursuivre(data?.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evenement, session) => {
      poursuivre(session)
    })
    const delai = setTimeout(() => {
      if (vivant && !lance.current) setErreur('La connexion Google n’a pas abouti. Réessayez.')
    }, 15000)

    return () => {
      vivant = false
      subscription.unsubscribe()
      clearTimeout(delai)
    }
  }, [onNavigate, refus])

  return (
    <>
      <SEO title="Connexion en cours — Actero" description="Validation de votre session." noindex />
      <CadreCloser titre={erreur ? 'Connexion interrompue' : 'Connexion en cours…'}>
        {erreur ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-[14px] text-red-700">{erreur}</p>
            <button type="button" onClick={() => onNavigate(retour)} className="text-[14px] text-cta hover:underline">
              {retour === '/closer/inscription' ? 'Revenir à l’inscription' : 'Revenir à la connexion'}
            </button>
          </div>
        ) : (
          <p className="text-center text-[14px] text-ink-3">Nous préparons votre espace closer.</p>
        )}
      </CadreCloser>
    </>
  )
}
