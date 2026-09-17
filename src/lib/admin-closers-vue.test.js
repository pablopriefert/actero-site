import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * La section « Closers » de l'admin — branchée, et fidèle aux principes du
 * chantier C : lecture par les routes serveur, jamais par supabase.from().
 */

const lire = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const VUES = readdirSync('src/components/admin/closers').filter((f) => f.endsWith('.jsx')).map((f) => join('src/components/admin/closers', f))

describe('section Closers de l’admin', () => {
  it('ses six vues existent', () => {
    expect(VUES.map((f) => f.split('/').pop()).sort()).toEqual([
      'AdminClosersView.jsx', 'Attributions.jsx', 'CommissionsAPayer.jsx', 'FileCommissions.jsx', 'ListeClosers.jsx', 'SaisieManuelle.jsx',
    ])
  })

  it.each([...VUES, 'src/lib/admin-closers.js'])('%s ne lit rien directement en base', (fichier) => {
    expect(lire(fichier)).not.toMatch(/\.from\(\s*['"`]/)
  })

  it.each(VUES)('%s passe par les routes /api/admin/closer*', (fichier) => {
    const code = lire(fichier)
    if (fichier.endsWith('AdminClosersView.jsx')) return
    expect(code).toMatch(/appelAdmin\('closer(s|-commissions|-attribution|-iban)'/)
  })

  it('l’IBAN n’est lu qu’à la demande, par la route journalisée', () => {
    const code = lire('src/components/admin/closers/CommissionsAPayer.jsx')
    expect(code).toMatch(/appelAdmin\('closer-iban', \{ query: \{ closer_id: closerId \} \}\)/)
    for (const fichier of VUES.filter((f) => !f.endsWith('CommissionsAPayer.jsx'))) {
      expect(lire(fichier), fichier).not.toMatch(/closer-iban/)
    }
  })

  it('l’admin route /admin/closers et l’affiche dans la barre latérale', () => {
    const admin = lire('src/pages/AdminDashboard.jsx')
    expect(admin).toMatch(/if \(route === "\/admin\/closers"\) return "closers";/)
    expect(admin).toMatch(/\{ id: 'closers', label: 'Closers', icon: Handshake \}/)
    expect(admin).toMatch(/activeTab === "closers" && <div[^>]*><AdminClosersView \/><\/div>/)
  })

  it('la palette de commandes mène aux closers, plus aux ambassadeurs', () => {
    const palette = lire('src/components/CommandPalette.jsx')
    expect(palette).toMatch(/\{ id: 'closers',\s+label: 'Closers',\s+icon: Handshake \}/)
    expect(palette).not.toMatch(/Ambassador/i)
  })
})
