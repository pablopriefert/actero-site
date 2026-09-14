import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { encryptToken, decryptToken } from './crypto.js'

/**
 * ACT-7 — les identifiants clients ne doivent jamais être stockés en clair.
 *
 * Contexte : le formulaire SMTP/IMAP du dashboard écrivait le mot de passe
 * email du marchand directement dans `client_integrations.api_key`, en clair,
 * depuis le navigateur — alors que docs/integrations/smtp-imap.mdx lui promet
 * un chiffrement AES-256. Le repli du formulaire « clé API » faisait la même
 * chose dès qu'un appel réseau échouait.
 *
 * AJOUT DU 11 SEPTEMBRE 2026 — LA CLÉ ELLE-MÊME
 *
 * L'audit des variables d'environnement a montré que la résolution de clé avait
 * quatre niveaux, et que les deux derniers posaient chacun un problème :
 *
 *   3. SUPABASE_SERVICE_ROLE_KEY — ACT-26 demande précisément de faire TOURNER
 *      cette clé. Le jour où elle tourne, tout ce qui a été chiffré avec
 *      devient illisible, et decryptToken renvoyait `null` avec un simple
 *      console.error. Les intégrations d'un marchand s'éteignent sans bruit.
 *
 *   4. une clé écrite en dur, dans un dépôt PUBLIC. Son propre nom l'admettait.
 *      Sans aucune variable posée, les jetons Shopify — dont des `write_orders`
 *      — étaient chiffrés avec un secret lisible par n'importe qui.
 *
 * Écrire exige désormais une vraie clé ; lire accepte toutes celles qui ont pu
 * servir. Cette asymétrie est le cœur du correctif : elle permet de poser une
 * vraie clé sans connaître celle en usage — et il n'existait aucun moyen de la
 * connaître.
 */

const VARIABLES = ['ENCRYPTION_KEY', 'WHATSAPP_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY']

/** Repart d'un environnement nu, et le rend tel qu'il était. */
function environnementNu() {
  let sauvegarde
  beforeEach(() => {
    sauvegarde = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]))
    for (const v of VARIABLES) delete process.env[v]
  })
  afterEach(() => {
    for (const [v, val] of Object.entries(sauvegarde)) {
      if (val === undefined) delete process.env[v]
      else process.env[v] = val
    }
  })
}

describe('chiffrement des secrets au repos', () => {
  environnementNu()
  // Ces quatre tests chiffrent : il leur faut donc une clé, depuis que la clé
  // de repli publiée n'est plus acceptée en écriture.
  beforeEach(() => { process.env.ENCRYPTION_KEY = 'clé-de-test-suffisamment-longue-0123456789' })

  it('un aller-retour rend la valeur d’origine', () => {
    const secret = 'mot-de-passe-smtp-du-marchand'
    const stored = encryptToken(secret)
    expect(stored).not.toContain(secret)
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(decryptToken(stored)).toBe(secret)
  })

  it('deux chiffrements du même secret donnent des blobs différents', () => {
    // IV aléatoire : sans ça, deux marchands avec le même mot de passe
    // seraient reconnaissables l'un de l'autre en base.
    expect(encryptToken('identique')).not.toBe(encryptToken('identique'))
  })

  it('laisse passer les valeurs écrites avant le chiffrement', () => {
    // Les lecteurs font `decryptToken(x) || x`. Les lignes historiques en clair
    // doivent continuer de fonctionner, sinon la migration casse la production.
    // Il en reste : 1 jeton Shopify, 2 clés d'API, 1 secret de webhook et
    // 1 jeton partenaire, relevés en base le 11 septembre 2026.
    expect(decryptToken('ancienne-valeur-en-clair')).toBe('ancienne-valeur-en-clair')
  })

  it('renvoie null sur un blob corrompu plutôt que de lever', () => {
    expect(decryptToken('enc:v1:pas-du-base64-valide')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */

describe('la clé de chiffrement', () => {
  environnementNu()

  it('refuse de chiffrer quand aucune clé n’est configurée', () => {
    // LA garde. Sans elle, un secret marchand part en base chiffré sous une clé
    // que ce dépôt public contient en toutes lettres — et rien ne le signale,
    // puisque tout « fonctionne ».
    expect(() => encryptToken('jeton-shopify-write-orders')).toThrow(/ENCRYPTION_KEY/)
  })

  it('lit encore ce qui a été écrit sous une clé historique', () => {
    // Le scénario de migration réel : des valeurs existent, écrites sous la clé
    // Supabase faute de mieux. On pose enfin une vraie ENCRYPTION_KEY. Ces
    // valeurs doivent rester lisibles, sinon poser la clé casse la production.
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'ancienne-clé-de-service'
    const chiffreAvant = encryptToken('jeton-écrit-hier')

    process.env.ENCRYPTION_KEY = 'la-vraie-clé-posée-aujourd-hui'
    expect(decryptToken(chiffreAvant), 'poser ENCRYPTION_KEY rend illisible l’existant')
      .toBe('jeton-écrit-hier')

    // Et ce qu’on écrit maintenant part sous la nouvelle.
    expect(decryptToken(encryptToken('jeton-écrit-aujourd-hui'))).toBe('jeton-écrit-aujourd-hui')
  })

  it('rend null, sans lever, quand aucune clé ne convient', () => {
    process.env.ENCRYPTION_KEY = 'clé-a'
    const chiffre = encryptToken('secret')
    process.env.ENCRYPTION_KEY = 'clé-b-sans-rapport'
    // Un appelant ne doit pas planter sur une valeur illisible : il doit
    // pouvoir traiter l’intégration comme non configurée.
    expect(decryptToken(chiffre)).toBeNull()
  })

  it('la clé publiée n’est jamais une clé d’écriture', () => {
    // Garde de source : quelqu’un pourrait la remettre dans la chaîne
    // d’écriture « pour que ça marche en local », et republier le problème.
    const src = readFileSync('api/lib/crypto.js', 'utf8')
    const ecriture = src.slice(src.indexOf('function cleDEcriture'), src.indexOf('function clesDeLecture'))
    expect(ecriture, 'la clé de repli publiée est revenue dans le chemin d’écriture')
      .not.toMatch(/CLE_PUBLIEE/)
  })

  it('ENCRYPTION_KEY est documentée, avec l’avertissement de rotation', () => {
    // Elle ne l’était pas : 80 variables sur 110 étaient lues sans qu’aucun
    // fichier ne dise à un déploiement qu’elles doivent exister.
    const exemple = readFileSync('.env.example', 'utf8')
    expect(exemple, 'ENCRYPTION_KEY absente de .env.example').toMatch(/^ENCRYPTION_KEY=/m)
    expect(exemple, 'rien n’avertit qu’une rotation sans rechiffrement perd les données')
      .toMatch(/RECHIFFRER/i)
  })
})

/* -------------------------------------------------------------------------- */

function jsxFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) jsxFiles(full, acc)
    else if (/\.(jsx?|tsx?)$/.test(entry)) acc.push(full)
  }
  return acc
}

describe('le navigateur n’écrit aucun secret en base', () => {
  it('aucun fichier de src/ n’écrit api_key / access_token / refresh_token dans client_integrations', () => {
    const coupables = []

    for (const file of jsxFiles('src')) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes("from('client_integrations')")) continue

      // On isole chaque écriture et on regarde les 25 lignes qui la suivent :
      // c'est là que vivent les colonnes de l'objet inséré.
      const lines = source.split('\n')
      lines.forEach((line, i) => {
        if (!/from\('client_integrations'\)[\s\S]{0,40}(upsert|insert|update)\(/.test(line)) return
        const bloc = lines.slice(i, i + 25).join('\n')
        if (/^\s*(api_key|access_token|refresh_token)\s*:/m.test(bloc)) {
          coupables.push(`${file}:${i + 1}`)
        }
      })
    }

    expect(
      coupables,
      `Ces écritures déposeraient un secret en clair. Passez par /api/integrations/connect, ` +
      `qui chiffre avant insertion :\n  ${coupables.join('\n  ')}`,
    ).toEqual([])
  })
})
