import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ACTIONS, NIVEAUX_DE_RISQUE, risqueDuPlan, actionsIrreversibles, actionConnue } from './action-registry.js'

/**
 * Le registre doit rester synchronisé avec l'exécuteur.
 *
 * Une action implémentée mais non classée serait exécutée sans que personne
 * sache ce qu'on risque en la lançant à tort. Ce test rend cet oubli
 * impossible : ajouter un `case` dans l'exécuteur sans l'inscrire ici échoue.
 *
 * C'est le même motif que la garde d'isolation multi-tenant, et pour la même
 * raison : les cinq trous d'autorisation du 9 septembre venaient tous d'un
 * oubli dans du code par ailleurs soigné.
 */

function actionsDeLExecuteur() {
  const source = readFileSync(new URL('../executor.js', import.meta.url), 'utf8')
  return [...source.matchAll(/^\s+case '([a-z_]+)':/gm)].map((m) => m[1])
}

describe('registre et exécuteur restent d’accord', () => {
  it('toute action implémentée est classée', () => {
    const nonClassees = actionsDeLExecuteur().filter((a) => !actionConnue(a))
    expect(
      nonClassees,
      'Ces actions existent dans executor.js mais ne sont pas dans le registre. ' +
      'Classez-les (risk / external / reversible) avant de les exécuter :\n  ' +
      nonClassees.join('\n  '),
    ).toEqual([])
  })

  it('toute action classée est implémentée', () => {
    // Une entrée orpheline décrit un risque que plus rien ne court.
    const implementees = new Set(actionsDeLExecuteur())
    const orphelines = Object.keys(ACTIONS).filter((a) => !implementees.has(a))
    expect(orphelines, 'entrées à retirer du registre').toEqual([])
  })

  it('chaque définition est complète et cohérente', () => {
    for (const [nom, d] of Object.entries(ACTIONS)) {
      expect(NIVEAUX_DE_RISQUE, `${nom}: risk inconnu`).toContain(d.risk)
      expect(typeof d.external, `${nom}: external manquant`).toBe('boolean')
      expect(typeof d.reversible, `${nom}: reversible manquant`).toBe('boolean')
      expect(d.effet?.length, `${nom}: effet non décrit`).toBeGreaterThan(15)
    }
  })

  it('une action interne n’est jamais irréversible', () => {
    // Si ça ne sort pas du système, on peut toujours défaire. Le contraire
    // signalerait une classification faite à la légère.
    for (const [nom, d] of Object.entries(ACTIONS)) {
      if (!d.external) expect(d.reversible, `${nom}`).toBe(true)
    }
  })
})

describe('risqueDuPlan — un plan vaut son maillon le plus dangereux', () => {
  it('retient le maximum, pas une moyenne', () => {
    expect(risqueDuPlan(['log_metric', 'send_reply'])).toBe('HIGH')
    expect(risqueDuPlan(['log_metric', 'tag_contact'])).toBe('LOW')
    expect(risqueDuPlan(['escalate', 'log_metric'])).toBe('MEDIUM')
  })

  it('les plans réels des playbooks sont correctement notés', () => {
    // Relevé en base le 9 septembre.
    expect(risqueDuPlan(['send_reply', 'escalate'])).toBe('HIGH')          // remboursement
    expect(risqueDuPlan(['send_reply', 'notify_slack', 'tag_contact'])).toBe('HIGH') // réclamation
    expect(risqueDuPlan(['lookup_order', 'send_reply'])).toBe('HIGH')      // suivi commande
    expect(risqueDuPlan(['log_metric'])).toBe('LOW')                        // comptabilité
  })

  it('ne se laisse pas piéger par un plan vide ou inconnu', () => {
    expect(risqueDuPlan([])).toBeNull()
    expect(risqueDuPlan(null)).toBeNull()
    expect(risqueDuPlan(['action_qui_nexiste_pas'])).toBeNull()
  })
})

describe('actionsIrreversibles — ce qu’on ne pourra pas rattraper', () => {
  it('liste les envois, pas les écritures internes', () => {
    expect(actionsIrreversibles(['send_reply', 'log_metric', 'notify_slack']))
      .toEqual(['send_reply', 'notify_slack'])
  })

  it('un plan purement interne ne présente aucun risque irréversible', () => {
    expect(actionsIrreversibles(['log_metric', 'tag_contact', 'create_ticket'])).toEqual([])
  })

  it('une lecture externe n’est pas irréversible', () => {
    // lookup_order appelle Shopify mais ne change rien.
    expect(actionsIrreversibles(['lookup_order'])).toEqual([])
  })
})

describe('la réponse au client est bien l’action la plus risquée du système', () => {
  it('send_reply est HIGH, externe et irréversible', () => {
    // C'est aussi la plus fréquente : 41 occurrences dans les playbooks.
    // Le 9 septembre, une réponse tronquée est partie à un client sous cette
    // action. Le classement doit refléter ça, pas le minimiser.
    expect(ACTIONS.send_reply).toMatchObject({ risk: 'HIGH', external: true, reversible: false })
  })

  it('aucune action n’est classée au-dessus sans exister vraiment', () => {
    // CRITICAL est réservé aux actions qui déplacent de l'argent
    // (refund_order, à venir). Aujourd'hui, aucune ne devrait y prétendre.
    const critiques = Object.entries(ACTIONS).filter(([, d]) => d.risk === 'CRITICAL')
    expect(critiques.map(([n]) => n)).toEqual([])
  })
})
