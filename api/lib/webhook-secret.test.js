import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ACT-25 — le secret de webhook, sorti du jsonb lisible par le navigateur.
 *
 * ACT-7 avait fermé `api_key` et `access_token` au navigateur. `extra_config`
 * est resté ouvert : il porte des champs d'affichage (email, hôte SMTP). Il
 * portait aussi `webhook_secret`, le secret partagé qui authentifie les
 * webhooks entrants de Zendesk et Gorgias.
 *
 * Vérifié en base le 10 septembre 2026 : `api_key` non lisible, `access_token`
 * non lisible, `extra_config` **lisible** — et il contenait le secret. Ce
 * n'est pas une fuite entre marchands, mais un secret qui transite par un
 * navigateur est un secret qu'on ne contrôle plus, et celui-ci permet de
 * forger des webhooks entrants.
 *
 * Deux pièges gardés ici.
 */

function fichiers(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiers(p, acc)
    else if (e.endsWith('.js') && !e.endsWith('.test.js')) acc.push(p)
  }
  return acc
}

const API = fichiers('api')

describe('secret de webhook', () => {
  it('plus personne n\'écrit le secret dans extra_config', () => {
    // Le remettre dans le jsonb le rendrait à nouveau lisible par le
    // navigateur, sans que rien ne le signale.
    const fautifs = API.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // `stripe_webhook_secret` est un booléen d'état sans rapport.
      return /(?<!stripe_)webhook_secret:\s/.test(src)
    })
    expect(fautifs, `webhook_secret réécrit dans extra_config : ${fautifs.join(', ')}`).toEqual([])
  })

  it('un fichier qui lit la colonne la sélectionne aussi', () => {
    // Le piège rencontré en écrivant ce correctif : gorgias.js lisait
    // `integ.webhook_secret_encrypted` alors que son `.select()` ne ramenait
    // que `extra_config`. La valeur était donc toujours `undefined`, et le
    // code retombait **sans bruit** sur l'ancien chemin. Rien n'aurait
    // échoué : le webhook aurait continué de fonctionner sur le secret en
    // clair, et la migration aurait eu l'air faite.
    const fautifs = []
    for (const f of API) {
      const src = readFileSync(f, 'utf8')
      const lit = src.includes('.webhook_secret_encrypted')
      const ecrit = /webhook_secret_encrypted:/.test(src)
      if (!lit || ecrit) continue
      const selectionne = /\.select\(\s*['"][^'"]*webhook_secret_encrypted/.test(src)
      if (!selectionne) fautifs.push(f)
    }
    expect(
      fautifs,
      `Lit webhook_secret_encrypted sans le sélectionner (vaudra toujours undefined) : ${fautifs.join(', ')}`,
    ).toEqual([])
  })

  it('le secret est chiffré à l\'écriture', () => {
    const src = readFileSync('api/integrations/lib/webhook-provisioner.js', 'utf8')
    expect(src).toMatch(/webhook_secret_encrypted:\s*encryptToken\(/)
  })

  it('la lecture déchiffre, avec un repli sur les lignes non migrées', () => {
    for (const f of ['api/engine/webhooks/zendesk.js', 'api/engine/webhooks/gorgias.js']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/decryptToken\(integ\?\.webhook_secret_encrypted\)/)
      expect(src, `${f} doit garder le repli sur extra_config`).toMatch(/extra_config\?\.webhook_secret/)
    }
  })
})
