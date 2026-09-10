import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { construireRapportPdf, sansCaracteresExotiques } from './rapport-pdf.js'
import { PLAN_FEATURES } from './plan-limits.js'

/**
 * ACT-36 — le rapport PDF mensuel existe vraiment.
 *
 * « Rapport PDF mensuel auto-envoyé » était vendu sur Pro et « Rapport ROI
 * sur mesure » sur Enterprise. Au 10 septembre 2026, **aucune librairie PDF
 * n'existait dans le projet** et le cron envoyait le même email HTML à tous
 * les clients actifs, sans distinction de plan.
 */

const CRON = readFileSync('api/cron/monthly-report.js', 'utf8')

const STATS = {
  tickets_resolved: 412, hours_saved: 38.5, roi: 1155, tasks_executed: 690,
  top_problems: [
    { type: 'tracking', count: 180, pct: 44 },
    { type: 'return', count: 96, pct: 23 },
  ],
}

describe('construction du PDF', () => {
  it('produit un vrai PDF', async () => {
    const pdf = await construireRapportPdf({
      brandName: 'BoutiqueMode.fr', periodLabel: 'août 2026', current: STATS, previous: STATS,
    })
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(800)
  })

  it('ne lève pas sur un nom de marque hostile', async () => {
    // Les polices standard PDF encodent en WinAnsi. Une flèche, un emoji, une
    // espace insécable ou un guillemet courbe font LEVER `drawText`. Le nom de
    // marque vient de la base, donc du marchand : il peut contenir n'importe
    // quoi. Un cron mensuel qui casse ne se remarque qu'un mois plus tard.
    const pdf = await construireRapportPdf({
      brandName: 'Boutique ▲ « Éthique » 🌿 — prêt-à-porter chic',
      periodLabel: 'août 2026',
      current: STATS,
      previous: {},
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('supporte des statistiques vides ou absentes', async () => {
    const pdf = await construireRapportPdf({
      brandName: 'X', periodLabel: 'août 2026', current: {}, previous: undefined,
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('le filtre ne laisse passer que ce que WinAnsi sait encoder', () => {
    // Latin-1 imprimable = 0x20-0x7E et 0xA1-0xFF. Tout le reste doit avoir
    // disparu ou avoir été remplacé.
    // Fleche et emoji disparaissent, le tiret cadratin devient un tiret, les
    // points de suspension s'ecrivent en trois points, l'apostrophe courbe
    // devient droite — et l'apostrophe droite, elle, est encodable : on la garde.
    expect(sansCaracteresExotiques('a\u25B2b\u{1F33F}c\u2014d\u2026e f\u2019g')).toBe("abc-d...e f'g")
    for (const c of sansCaracteresExotiques('Éthique ▲ 🌿 — … « »  ')) {
      const code = c.charCodeAt(0)
      expect(code >= 0x20 && code <= 0x7e || code >= 0xa1 && code <= 0xff,
        `caractère non encodable laissé passer : ${JSON.stringify(c)} (${code})`).toBe(true)
    }
  })
})

describe('envoi du rapport', () => {
  it('le PDF est réservé aux plans qui le vendent', () => {
    expect(PLAN_FEATURES.free.pdf_report).toBe(false)
    expect(PLAN_FEATURES.starter.pdf_report).toBe(false)
    expect(PLAN_FEATURES.pro.pdf_report).toBe(true)
    expect(PLAN_FEATURES.enterprise.pdf_report).toBe(true)
    expect(CRON, 'le cron ne vérifie pas le droit au PDF')
      .toMatch(/canAccessFeature\([^)]*'pdf_report'\)/)
  })

  it('la pièce jointe part sur les DEUX chemins d\'envoi', () => {
    // Le cron envoie via le SMTP du marchand quand il en a un, sinon via
    // Resend. N'en câbler qu'un donnerait un PDF qui arrive chez certains
    // clients et pas chez d'autres — sans erreur, et sans que rien ne le
    // signale. Même piège que le fournisseur de webhooks et ses deux blocs.
    const smtp = CRON.match(/async function sendViaSMTP[\s\S]*?^}/m)?.[0] || ''
    expect(smtp, 'sendViaSMTP ne reçoit pas les pièces jointes').toMatch(/attachments/)
    expect(smtp, 'sendMail ne transmet pas les pièces jointes').toMatch(/sendMail\([^)]*attachments/)

    const resendBloc = CRON.match(/resend\.emails\.send\(\{[\s\S]*?\}\)/)?.[0] || ''
    expect(resendBloc, 'l\'envoi Resend ne transmet pas les pièces jointes').toMatch(/attachments/)
  })

  it('un PDF qui échoue ne prive pas le marchand de son rapport', () => {
    // Le rapport HTML est le produit ; le PDF est la pièce jointe. Laisser une
    // exception de génération remonter ferait sauter l'email entier — et pour
    // tous les clients suivants de la boucle.
    const bloc = CRON.match(/if \(aDroitAuPdf\) \{[\s\S]*?\n {8}\}/)?.[0] || ''
    expect(bloc, 'la génération du PDF n\'est pas protégée').toMatch(/try \{/)
    expect(bloc, 'l\'échec doit être bruyant').toMatch(/console\.error/)
  })
})

describe('promesses retirées', () => {
  // Le SMS n'existe dans aucun flux de relance (le cron n'envoie que par
  // SMTP ; Twilio n'est câblé que pour l'agent vocal), et aucune remise
  // conditionnelle n'est générée nulle part. Les deux phrases ont été
  // retirées le 10 septembre plutôt que construites.
  const INTERDITS = [
    /email \+ SMS/i,
    // « remise » ET « réduction » : la première version de cette garde ne
    // cherchait que « remise conditionnelle », et une page de comparaison a
    // gardé « réduction conditionnelle » pendant une demi-journée. Une garde
    // qui ne connaît qu'un seul mot pour la même promesse ne garde rien.
    /(remises?|réductions?) conditionnelles?/i,
    /SMS automatiquement/i,
  ]

  function fichiersSources(dir, acc = []) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e.startsWith('.')) continue
      const p = join(dir, e)
      if (statSync(p).isDirectory()) fichiersSources(p, acc)
      else if (/\.(jsx?|tsx?)$/.test(e) && !e.includes('.test.')) acc.push(p)
    }
    return acc
  }

  it('ni le SMS ni les remises conditionnelles ne réapparaissent dans les pages publiques', () => {
    const fautifs = []
    for (const f of fichiersSources('src')) {
      const src = readFileSync(f, 'utf8')
      for (const motif of INTERDITS) {
        if (motif.test(src)) fautifs.push(`${f} → ${motif}`)
      }
    }
    expect(fautifs, `Promesse retirée réintroduite :\n${fautifs.join('\n')}`).toEqual([])
  })
})
