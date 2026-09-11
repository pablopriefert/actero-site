import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { doitAlerterWidget } from './widget-alerte.js'

/**
 * La bulle de chat disparaît d'une boutique, et rien ne le dit.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * Une mise à jour de thème Shopify retire le script Actero de la vitrine. Les
 * messages laissés sur le site du marchand ne nous parviennent plus. Il n'y a
 * aucune erreur à voir — juste un silence qui ressemble à une boutique calme,
 * et un marchand qui se demande pourquoi son agent ne sert plus à rien.
 *
 * `widget_qa.py` sait le détecter depuis le 9 septembre. Il ne partait que
 * d'un clic dans un écran d'administration : il fallait qu'un humain de chez
 * nous y pense, pour le bon client, le bon jour.
 *
 * POURQUOI UNE TABLE DE VÉRITÉ, ET PAS UNE GARDE QUI LIT LE CRON
 *
 * La décision tient en trois lignes et elle est entièrement faite de cas
 * limites. Un test qui grep le cron confirmerait que le code EXISTE, pas
 * qu'il décide juste. Les deux erreurs possibles coûtent en sens inverse :
 *
 *   alerter trop  → tous les jours, à des boutiques qui n'ont jamais posé la
 *                   bulle. Le marchand apprend à ignorer nos emails, et il les
 *                   ignorera aussi le jour où ça compte.
 *   alerter trop peu → le défaut d'origine, intact.
 */

describe('quand prévenir que la bulle a disparu', () => {
  const presente = { widget_found: true }
  const absente = { widget_found: false }

  it('ALERTE : elle était là au contrôle précédent, elle n’y est plus', () => {
    // Le seul cas qui déclenche, et la raison d'être de tout le mécanisme.
    expect(doitAlerterWidget(absente, presente)).toBe(true)
  })

  it('silence : première vérification de cette boutique', () => {
    // Pas de « avant », donc rien à comparer. Une boutique qui n'a jamais posé
    // la bulle ne doit pas recevoir d'alerte le jour où on la découvre.
    expect(doitAlerterWidget(absente, null)).toBe(false)
    expect(doitAlerterWidget(absente, undefined)).toBe(false)
  })

  it('silence : la panne était déjà connue au contrôle précédent', () => {
    // Sinon l'alerte repart à chaque passage du cron, tant que la bulle est
    // absente. C'est ce qui transforme une alerte utile en spam.
    expect(doitAlerterWidget(absente, absente)).toBe(false)
  })

  it('silence : la bulle est présente — même avec un passé chaotique', () => {
    // Défensif. L'appelant ne devrait interroger que des échecs, mais une
    // alerte envoyée pour une bulle bien en place est pire qu'une alerte
    // manquée : elle décrédibilise toutes les suivantes.
    expect(doitAlerterWidget(presente, presente)).toBe(false)
    expect(doitAlerterWidget(presente, absente)).toBe(false)
    expect(doitAlerterWidget(presente, null)).toBe(false)
  })

  it('silence : une vérification sans verdict n’en est pas un', () => {
    // `widget_found` absent ou null = le contrôle n'a pas abouti (site
    // injoignable, timeout). Ce n'est pas « la bulle a disparu ».
    expect(doitAlerterWidget({}, presente)).toBe(false)
    expect(doitAlerterWidget({ widget_found: null }, presente)).toBe(false)
    expect(doitAlerterWidget(null, presente)).toBe(false)
    expect(doitAlerterWidget(absente, {})).toBe(false)
    expect(doitAlerterWidget(absente, { widget_found: null })).toBe(false)
  })
})

/**
 * L'autre moitié du défaut : un contrôle que rien ne déclenche ne contrôle
 * rien. Même famille qu'ACT-40 (Intercom se connectait et ne recevait jamais).
 */
const CRON = readFileSync('api/cron/process-e2b-jobs.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('le contrôle part vraiment tout seul', () => {
  it('le cron appelle la route de contrôle du widget', () => {
    expect(CRON, 'plus rien ne déclenche widget_qa — il redevient un bouton '
      + 'dans un écran d’administration auquel il faut penser')
      .toMatch(/api\/jobs\/widget-qa/)
  })

  it('il ne relance pas un contrôle déjà en vol', () => {
    // Chaque contrôle ouvre un bac à sable E2B facturé à la minute. Un cron
    // toutes les 5 minutes qui ne regarde pas ce qui tourne déjà paierait
    // douze fois le même contrôle par heure.
    expect(CRON, 'le cron ne vérifie pas les travaux widget_qa en vol')
      .toMatch(/widget_qa[\s\S]{0,200}\[.queued., .running.\]/)
  })

  it('la ligne est réclamée AVANT l’envoi, pas après', () => {
    // L'ordre est l'idempotence. Réclamer après l'envoi laisse deux passages
    // simultanés du cron envoyer deux fois. Même motif que quota-alerts.js.
    const posReclame = CRON.indexOf('alerted_at: new Date().toISOString()')
    // `sendClientEmail(` avec la parenthèse : sans elle on trouve la ligne
    // d'import, qui est en haut du fichier et fait toujours passer le test.
    // C'est le défaut corrigé le même jour dans tenant-guard.test.js, reproduit
    // ici en l'écrivant — chercher un nom n'est pas chercher un appel.
    const posEnvoi = CRON.indexOf('sendClientEmail(')
    expect(posReclame, 'la réclamation de alerted_at a disparu').toBeGreaterThan(0)
    expect(posEnvoi, 'l’envoi au marchand a disparu').toBeGreaterThan(0)
    expect(posReclame, 'l’envoi précède la réclamation : deux crons simultanés '
      + 'enverront deux alertes').toBeLessThan(posEnvoi)
  })
})
