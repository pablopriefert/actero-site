import React, { useEffect, useRef, useState } from 'react'
import { SEO } from '../../components/SEO'
import { supabase } from '../../lib/supabase'
import { appelCloser, lireIntentionGoogle, oublierIntentionGoogle } from '../../lib/espace-closer'
import { CadreCloser } from '../../components/closer/ui'

/**
 * /closer/callback — le retour de Google pour l'espace closer.
 *
 * Après une inscription, crée la fiche closer (api/closer/devenir-closer.js) ;
 * puis mène à /closer, qui propose « Devenir closer » à un compte sans fiche.
 * Ne crée JAMAIS de client marchand : ni resolveOrCreateClientId, ni écriture
 * dans `clients` (spec closers, garde src/lib/pages-closer.test.js).
 *
 * L'aiguillage est lancé depuis deux endroits (session déjà là, ou résolue
 * ensuite) et deux fois en développement (StrictMode) : une référence garantit
 * qu'il ne tourne qu'une fois.
 */
export function CloserCallbackPage({ onNavigate }) {
  const [erreur, setErreur] = useState(null)
  const lance = useRef(false)

  useEffect(() => {
    let vivant = true

    const poursuivre = async (session) => {
      if (!session || lance.current) return
      lance.current = true
      if (lireIntentionGoogle() === 'inscription') {
        try {
          await appelCloser('devenir-closer', { methode: 'POST', corps: {} })
        } catch {
          // L'espace proposera « Devenir closer » : rien n'est perdu.
        }
      }
      oublierIntentionGoogle()
      onNavigate('/closer')
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
  }, [onNavigate])

  return (
    <>
      <SEO title="Connexion en cours — Actero" description="Validation de votre session." noindex />
      <CadreCloser titre={erreur ? 'Connexion interrompue' : 'Connexion en cours…'}>
        {erreur ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-[14px] text-red-700">{erreur}</p>
            <button type="button" onClick={() => onNavigate('/closer/connexion')} className="text-[14px] text-cta hover:underline">
              Revenir à la connexion
            </button>
          </div>
        ) : (
          <p className="text-center text-[14px] text-ink-3">Nous préparons votre espace closer.</p>
        )}
      </CadreCloser>
    </>
  )
}
