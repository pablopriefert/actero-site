import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Un essai à blanc ne touche à rien. C'est la seule raison pour laquelle on
 * peut le pointer sur les vraies données d'un marchand.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER
 *
 * `api/engine/backtest-classify.js` rejoue les anciens tickets d'un marchand
 * dans le cerveau pour répondre « Actero en aurait réglé X % ». Son en-tête
 * promet :
 *
 *   « It runs ONLY inference (runBrain) — it NEVER invokes the executor,
 *     never sends email/Slack, never writes to Shopify, and never mutates
 *     ai_conversations. »
 *
 * C'est vrai le 11 septembre 2026. Vérifié à la main. Mais cette phrase
 * affirme une propriété d'un AUTRE fichier — `brain.js` — que rien ne tient.
 * Et `runBrain` n'est pas pur : il a deux effets de bord, tous deux corrects
 * aujourd'hui parce qu'ils sont derrière une seule condition.
 *
 *   brain.js:137   if (!normalized?._is_test) {
 *   brain.js:142     supabase.rpc('increment_ticket_usage', …)
 *   brain.js:145     maybeAlertQuota(supabase, { clientId })
 *
 * Si cet incrément sortait du bloc, rejouer 1 000 tickets historiques
 * consommerait 1 000 tickets du quota MENSUEL du marchand — sur un plan Free
 * qui en compte 50. Et `maybeAlertQuota` lui enverrait un email « vous avez
 * atteint 100 % de votre quota », déclenché par un essai à blanc qu'il vient
 * de lancer pour voir si Actero vaut le coup.
 *
 * Rien ne planterait. Le backtest afficherait son score, et la facture du
 * marchand serait fausse.
 *
 * POURQUOI MAINTENANT
 *
 * Tant que le backtest vivait dans un écran admin, le risque restait entre
 * nos mains. Il est ouvert au marchand : la promesse d'étanchéité devient une
 * promesse commerciale, et une promesse commerciale se garde.
 */

const CLASSIFY = readFileSync('api/engine/backtest-classify.js', 'utf8')
const BRAIN = readFileSync('api/engine/brain.js', 'utf8')

/** Retire les commentaires : une garde qui lit du code doit lire du code. */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Le corps du bloc `{ … }` qui suit `depuis`, par comptage d'accolades.
 *
 * Une fenêtre de N caractères aurait suffi à faire passer le test, et aurait
 * menti dès que le bloc grossit d'une ligne.
 */
function blocApres(src, depuis) {
  const debut = src.indexOf(depuis)
  if (debut === -1) return null
  let i = src.indexOf('{', debut)
  if (i === -1) return null
  let profondeur = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') profondeur++
    else if (src[j] === '}' && --profondeur === 0) return src.slice(i, j + 1)
  }
  return null
}

describe('étanchéité de l’essai à blanc', () => {
  it('le rejeu se déclare comme un test', () => {
    // Le drapeau d'où tout dépend. Sans lui, les deux effets de bord de
    // runBrain s'appliquent aux données réelles du marchand.
    expect(
      sansCommentaires(CLASSIFY),
      'backtest-classify ne marque plus l’événement `_is_test` — le rejeu '
      + 'consommera le quota réel du marchand',
    ).toMatch(/normalized\._is_test\s*=\s*true/)
  })

  it('la consommation de quota reste derrière ce drapeau', () => {
    const bloc = blocApres(sansCommentaires(BRAIN), 'if (!normalized?._is_test)')
    expect(bloc, 'le garde `if (!normalized?._is_test)` a disparu de brain.js').not.toBeNull()
    expect(
      bloc,
      'increment_ticket_usage est sorti du bloc de test : rejouer 1 000 tickets '
      + 'en consommerait 1 000 sur le quota mensuel du marchand',
    ).toMatch(/increment_ticket_usage/)
  })

  it('l’alerte de quota aussi — un essai à blanc n’envoie pas d’email', () => {
    // maybeAlertQuota écrit au marchand à 80 % et à 100 %. Déclenchée par un
    // rejeu, elle lui annonce qu'il a épuisé un quota qu'il n'a pas dépensé.
    const bloc = blocApres(sansCommentaires(BRAIN), 'if (!normalized?._is_test)')
    expect(
      bloc,
      'maybeAlertQuota est sorti du bloc de test : un essai à blanc enverra un '
      + 'email d’alerte de quota au marchand',
    ).toMatch(/maybeAlertQuota/)
  })

  it('le pare-feu n’appelle jamais l’exécuteur ni un envoyeur', () => {
    // runBrain classe, runExecutor agit. Tout le dry-run tient dans cette
    // séparation : importer le second ici suffirait à la rompre.
    const src = sansCommentaires(CLASSIFY)
    const interdits = ['runExecutor', 'sendVia', 'connector-registry', 'resend', 'nodemailer']
    const fautifs = interdits.filter((m) => new RegExp(m, 'i').test(src))
    expect(
      fautifs,
      'backtest-classify touche à un chemin d’ACTION, pas seulement '
      + 'd’inférence :\n  ' + fautifs.join('\n  '),
    ).toEqual([])
  })

  it('le pare-feu n’écrit rien en base', () => {
    // Pure lecture + classification. Un insert ici polluerait les vraies
    // conversations du marchand avec des rejeux.
    const src = sansCommentaires(CLASSIFY)
    const ecritures = [...src.matchAll(/\.(insert|update|upsert|delete)\(/g)].map((m) => m[1])
    expect(
      ecritures,
      'backtest-classify écrit en base — le rejeu doit rester en lecture seule :\n  '
      + ecritures.join('\n  '),
    ).toEqual([])
  })

  it('un échec d’inférence ne compte jamais comme une résolution', () => {
    // Fail closed. L'inverse gonflerait le score qu'on montre au marchand :
    // une panne de notre côté deviendrait un argument de vente.
    const bloc = blocApres(sansCommentaires(CLASSIFY), 'catch (err)')
    expect(bloc, 'le bloc catch a disparu').not.toBeNull()
    expect(bloc, 'le catch ne force pas would_resolve à false').toMatch(/would_resolve:\s*false/)
  })

  it('le pare-feu n’est ouvert qu’aux appels internes', () => {
    // Il tourne en service_role et classe pour n'importe quel client_id du
    // corps : sans le secret, ce serait un moyen de faire tourner le cerveau
    // d'un marchand tiers à ses frais.
    expect(sansCommentaires(CLASSIFY), 'plus de vérification de CRON_SECRET')
      .toMatch(/CRON_SECRET/)
  })
})
