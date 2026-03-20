import { useEffect } from 'react'

/**
 * Widget Zendesk — Support client dashboard uniquement.
 *
 * Ce composant charge le widget Zendesk CLIENT (instance séparée)
 * au mount et le supprime proprement au unmount.
 *
 * Usage : intégré uniquement dans DashboardGate.jsx pour les clients.
 * NE PAS ajouter sur la landing page, l'admin ou globalement.
 *
 * Note : La landing page utilise un widget Zendesk PUBLIC séparé
 * (ZendeskWidget.jsx) avec une clé différente.
 */
const ZENDESK_CLIENT_KEY = 'e80cafd5-3a27-4211-bad2-bbfcb94c9a78'
const SCRIPT_ID = 'ze-snippet-client'

function cleanupZendesk() {
  // Supprimer le script
  const el = document.getElementById(SCRIPT_ID)
  if (el) el.remove()

  // Supprimer toutes les iframes et éléments injectés par Zendesk
  document.querySelectorAll(
    'iframe[title*="Zendesk"], iframe[id*="launcher"], [id*="webWidget"], [id*="Zendesk"], .zEWidget-launcher'
  ).forEach(node => node.remove())

  // Nettoyer les globals Zendesk pour éviter les conflits avec l'autre widget
  try { if (window.zE) window.zE('webWidget', 'hide') } catch {}
  delete window.zE
  delete window.zESettings
  delete window.$zopim
  delete window.zEmbed
}

export const ZendeskClientWidget = () => {
  useEffect(() => {
    // Éviter les doublons si la page rerender
    if (document.getElementById(SCRIPT_ID)) return
    // S'assurer qu'aucun autre widget Zendesk n'est chargé
    cleanupZendesk()

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${ZENDESK_CLIENT_KEY}`
    script.async = true
    document.body.appendChild(script)

    return () => {
      cleanupZendesk()
    }
  }, [])

  return null
}
