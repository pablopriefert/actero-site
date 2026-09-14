import { describe, it, expect } from 'vitest'
import { clientsEnSilence, alerteDejaEnvoyee } from './engine-silence.js'

/**
 * ACT-21 — détecter un ARRÊT du moteur, pas une absence de trafic.
 *
 * Le moteur n'a traité aucun message du 11 juillet au 8 septembre 2026 et
 * personne ne s'en est aperçu. Relevé en base au 9 septembre :
 *
 *   Actero               dernier événement 11 juillet   60 jours
 *   Boutique E-com Test  dernier événement 7 juillet    64 jours
 *   Pablo PRIEFERT       aucun événement
 *   uvszh1-m5            aucun événement
 *
 * Ces quatre lignes sont le jeu de test : deux vraies pannes, deux clients qui
 * n'ont jamais démarré. Un moniteur naïf sonnerait pour les quatre — et une
 * alerte qui sonne toujours est ce qui apprend à les ignorer.
 */

const MAINTENANT = new Date('2026-09-09T14:00:00Z')

const ETAT_REEL = [
  { clientId: 'a', brandName: 'Actero', playbookActif: true, dernierEvenement: '2026-07-11T10:00:00Z' },
  { clientId: 'b', brandName: 'Boutique E-com Test', playbookActif: true, dernierEvenement: '2026-07-07T10:00:00Z' },
  { clientId: 'c', brandName: 'Pablo PRIEFERT', playbookActif: false, dernierEvenement: null },
  { clientId: 'd', brandName: 'uvszh1-m5', playbookActif: true, dernierEvenement: null },
]

describe('ACT-21 — clientsEnSilence', () => {
  it('signale les deux vraies pannes, et elles seules', () => {
    const r = clientsEnSilence(ETAT_REEL, { maintenant: MAINTENANT })
    expect(r.map((x) => x.brandName)).toEqual(['Boutique E-com Test', 'Actero'])
  })

  it('classe le plus silencieux en premier', () => {
    // Celui qui saigne depuis le plus longtemps passe devant.
    const r = clientsEnSilence(ETAT_REEL, { maintenant: MAINTENANT })
    expect(r[0].heuresDeSilence).toBeGreaterThan(r[1].heuresDeSilence)
    expect(r[0].heuresDeSilence).toBe(1540) // 7 juillet 10h → 9 sept 14h
  })

  it('ne sonne pas pour un client qui n’a JAMAIS rien produit', () => {
    // uvszh1-m5 a un playbook actif mais zéro événement : le moteur n'a pas
    // chuté, il n'a pas démarré. C'est une information, pas une alarme.
    const r = clientsEnSilence(ETAT_REEL, { maintenant: MAINTENANT })
    expect(r.map((x) => x.clientId)).not.toContain('d')
  })

  it('ne sonne pas sans playbook actif', () => {
    const r = clientsEnSilence(
      [{ clientId: 'x', brandName: 'X', playbookActif: false, dernierEvenement: '2026-01-01T00:00:00Z' }],
      { maintenant: MAINTENANT },
    )
    expect(r).toEqual([])
  })

  it('ne sonne pas pour un client actif il y a une heure', () => {
    const r = clientsEnSilence(
      [{ clientId: 'x', brandName: 'X', playbookActif: true, dernierEvenement: '2026-09-09T13:00:00Z' }],
      { maintenant: MAINTENANT },
    )
    expect(r).toEqual([])
  })

  it('respecte le seuil qu’on lui donne', () => {
    const lignes = [{ clientId: 'x', brandName: 'X', playbookActif: true, dernierEvenement: '2026-09-09T08:00:00Z' }]
    expect(clientsEnSilence(lignes, { seuilHeures: 24, maintenant: MAINTENANT })).toEqual([])
    expect(clientsEnSilence(lignes, { seuilHeures: 4, maintenant: MAINTENANT })).toHaveLength(1)
  })

  it('ne plante pas sur une entrée absurde', () => {
    expect(clientsEnSilence(null)).toEqual([])
    expect(clientsEnSilence([null, undefined, {}], { maintenant: MAINTENANT })).toEqual([])
    expect(clientsEnSilence(
      [{ clientId: 'x', brandName: 'X', playbookActif: true, dernierEvenement: 'pas-une-date' }],
      { maintenant: MAINTENANT },
    )).toEqual([])
  })
})

describe('ACT-21 — une alerte par incident, pas une par passage du cron', () => {
  it('ne réalerte pas si l’alerte est postérieure au dernier événement', () => {
    // Sans ça, un cron aux 5 minutes répéterait la même alerte pendant 60 jours :
    // environ 17 000 notifications, et un canal auquel personne ne croit plus.
    expect(alerteDejaEnvoyee({
      dernierEvenement: '2026-07-11T10:00:00Z',
      derniereAlerte: '2026-07-12T10:00:00Z',
    })).toBe(true)
  })

  it('réalerte si du trafic est revenu puis reparti', () => {
    // L'alerte de juillet ne dit rien du silence de septembre.
    expect(alerteDejaEnvoyee({
      dernierEvenement: '2026-09-01T10:00:00Z',
      derniereAlerte: '2026-07-12T10:00:00Z',
    })).toBe(false)
  })

  it('alerte quand rien n’a jamais été envoyé', () => {
    expect(alerteDejaEnvoyee({ dernierEvenement: '2026-07-11T10:00:00Z', derniereAlerte: null })).toBe(false)
  })
})
