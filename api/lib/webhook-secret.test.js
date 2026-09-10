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

// Retire les commentaires avant toute analyse : ces gardes se citent
// elles-mêmes dans leurs explications, et une garde qui échoue sur sa propre
// prose finit désactivée.
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

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

  it('un fichier qui lit une colonne de secret la sélectionne aussi', () => {
    // Le piège rencontré en écrivant le correctif ACT-25 : gorgias.js lisait
    // `integ.webhook_secret_encrypted` alors que son `.select()` ne ramenait
    // que `extra_config`. La valeur était donc toujours `undefined`, et le
    // code retombait **sans bruit** sur l'ancien chemin. Rien n'aurait
    // échoué : le webhook aurait continué de fonctionner sur le secret en
    // clair, et la migration aurait eu l'air faite.
    //
    // Généralisé à TOUTES les colonnes `*_encrypted` le 10 septembre (ACT-34),
    // quand WooCommerce a reçu la sienne : une garde qui ne couvre qu'un seul
    // secret laisse passer le suivant.
    //
    // Les commentaires sont retirés avant l'analyse — celui ci-dessus cite
    // `webhook_secret_encrypted` pour expliquer le piège, et faisait échouer
    // ce test. Un test qui lit du code doit lire du code, pas de la prose.
    const fautifs = []
    for (const f of API) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      for (const colonne of [...src.matchAll(/\.(\w+_encrypted)\b/g)].map((m) => m[1])) {
        // Un fichier qui ÉCRIT la colonne n'a pas à la sélectionner.
        if (new RegExp(`${colonne}:`).test(src)) continue
        const selectionne = new RegExp(`\\.select\\(\\s*['"][^'"]*${colonne}`).test(src)
        if (!selectionne) fautifs.push(`${f} (${colonne})`)
      }
    }
    expect(
      fautifs,
      `Lit une colonne de secret sans la sélectionner (vaudra toujours undefined) : ${fautifs.join(', ')}`,
    ).toEqual([])
  })

  it('aucun secret ne repart vivre dans extra_config', () => {
    // ACT-34 : le consumer secret WooCommerce y était rangé — chiffré, donc
    // pas une fuite, mais `extra_config` fait partie des colonnes que le
    // navigateur du marchand peut lire. Deux secrets de même nature, deux
    // traitements : c'est l'incohérence qui coûte, parce que le prochain qui
    // ajoute une plateforme copie l'exemple qu'il trouve.
    const fautifs = []
    for (const f of API) {
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      const blocs = src.matchAll(/extra_config:\s*\{([\s\S]*?)\n\s*\}/g)
      for (const bloc of blocs) {
        for (const cle of [...bloc[1].matchAll(/(\w*(?:secret|token|password|api_key)\w*)\s*:/gi)].map((m) => m[1])) {
          // `stripe_webhook_secret` est un booléen d'état, pas un secret ; et
          // `token_type` (« Bearer »), `token_expires_at`, `api_key_id` sont
          // des métadonnées OAuth publiques que le mot-clé attrape à tort.
          if (/^stripe_webhook_secret$/.test(cle)) continue
          if (/_(type|id|at|expires|expires_at|scope|scopes)$/i.test(cle)) continue
          fautifs.push(`${f} → extra_config.${cle}`)
        }
      }
    }
    expect(fautifs, `Secret rangé dans extra_config, lisible par le navigateur :\n${fautifs.join('\n')}`).toEqual([])
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
