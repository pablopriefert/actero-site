import * as Sentry from '@sentry/node'

const dsn =
  process.env.SENTRY_DSN ||
  'https://b067fdab863ea736082ad783c5c4b25a@o4510908479832064.ingest.de.sentry.io/4511217974181968'

/**
 * Ce qui part chez Sentry ne contient ni le corps des requêtes (mots de
 * passe, IBAN, SIRET, adresses), ni les cookies, ni les jetons :
 *
 * - `httpIntegration({ maxIncomingRequestBodySize: 'none' })` : le corps des
 *   requêtes entrantes n'est jamais joint (cette intégration remplace celle
 *   par défaut, qui porte le même nom) ;
 * - `sendDefaultPii: false` : ni IP, ni cookies, ni utilisateur ajoutés
 *   d'office ;
 * - `nettoyerEvenement`, filet de sécurité sur les erreurs comme sur les
 *   transactions : retire ce qui passerait quand même.
 */
const estEnteteSecrete = (nom) => {
  const n = String(nom).toLowerCase()
  // Authorization porte les jetons Supabase et le secret des crons ; plusieurs
  // routes lisent un secret partagé dans un en-tête x-…-secret.
  return n === 'authorization' || n === 'proxy-authorization' || n === 'cookie' || n.includes('secret')
}

export function nettoyerEvenement(event) {
  const requete = event?.request
  if (!requete) return event
  delete requete.data
  delete requete.cookies
  if (requete.headers && typeof requete.headers === 'object') {
    requete.headers = Object.fromEntries(Object.entries(requete.headers).filter(([nom]) => !estEnteteSecrete(nom)))
  }
  return event
}

if (!globalThis.__acteroSentryInitialized) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: 'none' })],
    beforeSend: nettoyerEvenement,
    beforeSendTransaction: nettoyerEvenement,
  })
  globalThis.__acteroSentryInitialized = true
}

export { Sentry }
