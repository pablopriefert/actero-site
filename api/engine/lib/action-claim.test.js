import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { doitEtreReservee, peutExecuter } from './action-claim.js'

/**
 * Une action irréversible ne doit partir qu'une fois.
 *
 * Le 9 septembre 2026, on a découvert qu'un même email pouvait produire DEUX
 * réponses au client : deux mécanismes relevaient les boîtes et rien ne les
 * empêchait de traiter le même message. Le correctif de l'époque était local
 * au chemin email. L'exécuteur, point de passage commun de TOUS les chemins,
 * restait sans protection.
 */

describe('quelles actions méritent une réservation', () => {
  it('protège les envois irréversibles vers l’extérieur', () => {
    expect(doitEtreReservee('send_reply')).toBe(true)
    expect(doitEtreReservee('send_email')).toBe(true)
    expect(doitEtreReservee('send_invoice_reminder')).toBe(true)
    expect(doitEtreReservee('notify_slack')).toBe(true)
    expect(doitEtreReservee('escalate')).toBe(true)
  })

  it('ne réserve pas ce qui est sans conséquence à rejouer', () => {
    // Chaque réservation coûte deux requêtes. La payer pour un compteur
    // interne serait du gaspillage, pas de la prudence.
    expect(doitEtreReservee('log_metric')).toBe(false)
    expect(doitEtreReservee('tag_contact')).toBe(false)
    expect(doitEtreReservee('create_ticket')).toBe(false)
    expect(doitEtreReservee('wait_then')).toBe(false)
  })

  it('ne réserve pas une lecture externe', () => {
    // lookup_order appelle Shopify mais ne change rien.
    expect(doitEtreReservee('lookup_order')).toBe(false)
    expect(doitEtreReservee('check_treasury')).toBe(false)
  })

  it('ne réserve pas une action inconnue du registre', () => {
    expect(doitEtreReservee('action_inexistante')).toBe(false)
  })
})

describe('peutExecuter — les quatre cas, et un cinquième par prudence', () => {
  it('première exécution : on y va', () => {
    expect(peutExecuter(null)).toEqual({ autorise: true, raison: 'premiere_execution' })
  })

  it('déjà partie : on s’abstient — c’est tout l’objet du mécanisme', () => {
    expect(peutExecuter({ status: 'done' })).toEqual({ autorise: false, raison: 'deja_executee' })
  })

  it('une autre exécution est en vol : on s’abstient', () => {
    // Deux invocations concurrentes du même événement : la seconde ne doit pas
    // envoyer « au cas où ». Si la première échoue, un retry trouvera `failed`.
    expect(peutExecuter({ status: 'running' })).toEqual({ autorise: false, raison: 'execution_en_cours' })
  })

  it('tentative précédente échouée : réessayer est légitime', () => {
    // L'interdire signifierait qu'une erreur réseau fait perdre
    // définitivement la réponse au client.
    expect(peutExecuter({ status: 'failed' })).toEqual({
      autorise: true, raison: 'nouvelle_tentative_apres_echec',
    })
  })

  it('statut inconnu : le doute profite à l’inaction', () => {
    const r = peutExecuter({ status: 'bizarre' })
    expect(r.autorise).toBe(false)
    expect(r.raison).toContain('statut_inconnu')
  })
})

describe('l’exécuteur réserve bien avant d’exécuter', () => {
  const source = readFileSync(new URL('../executor.js', import.meta.url), 'utf8')

  it('la réservation précède le bloc d’exécution', () => {
    // Réserver après avoir exécuté ne protégerait de rien.
    const iReservation = source.indexOf('reserverAction(supabase')
    const iSwitch = source.indexOf("switch (action)")
    expect(iReservation).toBeGreaterThan(-1)
    expect(iReservation).toBeLessThan(iSwitch)
  })

  it('une action non autorisée saute le tour sans rien exécuter', () => {
    expect(source).toMatch(/skipped_duplicate/)
    expect(source).toMatch(/if \(!reservation\.autorise\)[\s\S]{0,300}continue/)
  })

  it('l’événement n’est plus ignoré', () => {
    // Il était déstructuré en `event: _event`, donc volontairement inutilisé —
    // alors qu'il portait le seul identifiant stable du travail en cours.
    expect(source).not.toMatch(/event:\s*_event/)
    expect(source).toMatch(/eventId: event\?\.id/)
  })
})
