import { useEffect } from 'react'

/**
 * Widget Zendesk — Support public landing page uniquement.
 *
 * Ce composant charge le widget Zendesk au mount et le supprime
 * proprement au unmount pour éviter qu'il apparaisse sur les
 * dashboards clients ou l'admin.
 *
 * Usage : intégré uniquement dans LandingPage.jsx
 * NE PAS ajouter dans App.jsx, index.html ou les dashboards.
 */
const ZENDESK_KEY = '72f9b12e-ca6d-4912-af9c-8d0b1bb92e36'
const SCRIPT_ID = 'ze-snippet'

export const ZendeskWidget = () => {
  useEffect(() => {
    // Éviter les doublons si la page rerender
    if (document.getElementById(SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${ZENDESK_KEY}`
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup au unmount (navigation vers dashboard, login, etc.)
      const el = document.getElementById(SCRIPT_ID)
      if (el) el.remove()

      // Supprimer l'iframe et les éléments injectés par Zendesk
      document.querySelectorAll('iframe[title*="Zendesk"], iframe[id*="launcher"], [id*="webWidget"]').forEach(el => el.remove())

      // Reset le global Zendesk si présent
      if (window.zE) {
        try { window.zE('webWidget', 'hide') } catch {}
      }
    }
  }, [])

  return null
}
