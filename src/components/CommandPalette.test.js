import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * La palette admin mène aux vues de la barre latérale de l'admin.
 *
 * « Liens partenaires » (`partner-tokens`) avait disparu de la palette avec
 * le retrait des ambassadeurs (4152f9d) : son entrée s'appelait
 * « Ambassadors » et a été remplacée par « Closers », alors que la vue
 * existe toujours dans l'admin.
 */

const palette = readFileSync('src/components/CommandPalette.jsx', 'utf8')
const admin = readFileSync('src/pages/AdminDashboard.jsx', 'utf8')

describe('CommandPalette — entrées admin', () => {
  it('« Liens partenaires » est proposée, sous le libellé de la barre latérale', () => {
    expect(admin).toMatch(/\{ id: 'partner-tokens', label: 'Liens partenaires', icon: Handshake \}/)
    expect(admin).toMatch(/if \(route === "\/admin\/partner-tokens"\) return "partner-tokens";/)
    expect(palette).toMatch(/\{ id: 'partner-tokens',\s+label: 'Liens partenaires',\s+icon: Handshake \}/)
  })

  it('les closers restent proposés à côté', () => {
    expect(palette).toMatch(/\{ id: 'closers',\s+label: 'Closers',\s+icon: Handshake \}/)
  })
})
