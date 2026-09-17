import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Le routeur et la séparation des espaces — spec closers, famille 7.
 * Le comportement de DashboardGate est vérifié en vrai par
 * src/components/auth/DashboardGate.test.js ; ce fichier garde le routeur,
 * qui ne se monte pas sans tout le site.
 */

const lire = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const APP = lire('src/App.jsx')

describe('routeur — les pages closer', () => {
  it.each([
    ['/closer/inscription', /currentRoute === "\/closer\/inscription"\) page = <CloserInscriptionPage/],
    ['/closer/connexion', /currentRoute === "\/closer\/connexion"\) page = <CloserConnexionPage/],
    ['/closer/callback', /currentRoute === "\/closer\/callback"\) page = <CloserCallbackPage/],
    ['/closer et ses onglets', /currentRoute === "\/closer" \|\| currentRoute\.startsWith\("\/closer\/"\)\) \{\s*page = <CloserEspacePage/],
    ['/c/:code', /currentRoute\.startsWith\("\/c\/"\)\) page = <LienCloserPage code=\{currentRoute\.slice\("\/c\/"\.length\)\}/],
  ])('%s a sa route', (_route, motif) => {
    expect(APP).toMatch(motif)
  })

  it('« /c/ » avec sa barre : ni /client, ni /cancel', () => {
    expect(APP).not.toMatch(/startsWith\("\/c"\)/)
  })

  it('le retour Google closer n’est pas détourné vers /auth/callback', () => {
    const closer = APP.indexOf('if (path === "/closer/callback") return "/closer/callback";')
    const marchand = APP.indexOf('if (path === "/auth/callback" || hash.includes("access_token=")) return "/auth/callback";')
    expect(closer).toBeGreaterThan(-1)
    expect(closer).toBeLessThan(marchand)
  })
})

describe('séparation des espaces — aucune boutique pour un compte closer', () => {
  it('DashboardGate interroge l’espace closer avant de rendre le tableau de bord marchand', () => {
    const gate = lire('src/components/auth/DashboardGate.jsx')
    expect(gate).toMatch(/else if \(await estCompteCloser\(activeSession\.access_token\)\) \{\s*if \(mounted\) onNavigate\("\/closer"\);\s*return;\s*\}/)
  })

  it('resolveOrCreateClientId refuse de créer une boutique pour un compte closer', () => {
    const resolve = lire('src/lib/resolve-client.js')
    const garde = resolve.indexOf('if (await estCompteCloser(session.access_token))')
    expect(garde).toBeGreaterThan(-1)
    expect(garde).toBeLessThan(resolve.indexOf(".from('clients')\n    .insert("))
  })

  it('aucune route de api/closer/ ne crée de client marchand', () => {
    for (const f of ['envoyer-code', 'verifier-code', 'devenir-closer', 'moi', 'clients', 'commissions', 'profil', 'attribuer']) {
      const route = lire(`api/closer/${f}.js`)
      expect(route, f).not.toMatch(/from\(\s*['"`](clients|client_users|client_settings)['"`]\s*\)\s*\.\s*(insert|upsert)\(/)
    }
  })
})
