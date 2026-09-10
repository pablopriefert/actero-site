/**
 * Le rapport mensuel en PDF — ACT-36.
 *
 * « Rapport PDF mensuel auto-envoyé » est vendu sur le plan Pro et « Rapport
 * ROI sur mesure » sur Enterprise. Au 10 septembre 2026, **aucune librairie
 * PDF n'existait dans le projet** — jspdf, pdfkit, puppeteer, pdf-lib : zéro
 * résultat, y compris dans package.json. Le cron mensuel envoyait un email
 * HTML identique à tous les clients actifs, sans distinction de plan.
 *
 * POURQUOI pdf-lib ET PAS pdfkit
 * pdfkit lit ses métriques de police dans des fichiers `.afm` livrés avec le
 * paquet. En serverless, ces fichiers de données sont exactement ce qu'un
 * empaqueteur oublie d'embarquer — et l'échec n'arrive qu'à l'exécution, une
 * fois par mois, dans un cron que personne ne regarde. pdf-lib embarque les
 * métriques des 14 polices standard dans son code : rien à lire sur disque.
 *
 * PIÈGE D'ENCODAGE
 * Les polices standard PDF utilisent WinAnsi. Une flèche « ▲ », un tiret
 * cadratin ou une espace insécable font LEVER `drawText`. Les accents
 * français passent (Latin-1), le reste non. Tout texte est donc filtré par
 * `sansCaracteresExotiques()` avant d'être dessiné : un rapport laid vaut
 * mieux qu'un cron qui casse.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Le vert de marque et les gris de l'interface, pour que le PDF ressemble au
// produit et pas à un export de tableur.
const VERT = rgb(0x13 / 255, 0x80 / 255, 0x4a / 255)
const ENCRE = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255)
const ENCRE_3 = rgb(0x5a / 255, 0x5a / 255, 0x5a / 255)
const TRAIT = rgb(0xe3 / 255, 0xe6 / 255, 0xea / 255)
const ROUGE = rgb(0xdc / 255, 0x26 / 255, 0x26 / 255)

const A4 = { largeur: 595.28, hauteur: 841.89 }
const MARGE = 56

/**
 * Ne garde que ce que WinAnsi sait encoder. Les caractères hors jeu sont
 * remplacés, jamais laissés passer : `drawText` lèverait.
 */
export function sansCaracteresExotiques(texte) {
  return String(texte ?? '')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ | | /g, ' ')
    // Tout le reste hors Latin-1 imprimable disparaît (flèches, emoji…).
    .replace(/[^\x20-\x7E¡-ÿ]/g, '')
}

function variation(courant, precedent) {
  if (!precedent || precedent === 0) return courant > 0 ? 100 : 0
  return Math.round(((courant - precedent) / precedent) * 100)
}

// Pas de flèche : « + » et « - » sont dans WinAnsi, « ▲ » non.
function libelleVariation(v) {
  if (v === 0) return { texte: 'stable', couleur: ENCRE_3 }
  if (v > 0) return { texte: `+${v} % vs mois precedent`, couleur: VERT }
  return { texte: `${v} % vs mois precedent`, couleur: ROUGE }
}

const LIBELLES_TYPE = {
  tracking: 'Suivi de commande',
  address: "Changement d'adresse",
  return: 'Retours & remboursements',
  product: 'Questions produit',
  shipping: 'Livraison',
  refund: 'Remboursement',
  cancel: 'Annulation',
  other: 'Autres',
  autre: 'Autres',
}

/**
 * Construit le rapport mensuel d'un marchand.
 *
 * @returns {Promise<Buffer>} le PDF, prêt à être joint à un email.
 */
export async function construireRapportPdf({ brandName, periodLabel, current, previous = {} }) {
  const doc = await PDFDocument.create()
  doc.setTitle(sansCaracteresExotiques(`Rapport ${periodLabel} — ${brandName}`))
  doc.setCreator('Actero')
  doc.setProducer('Actero')

  const page = doc.addPage([A4.largeur, A4.hauteur])
  const normale = await doc.embedFont(StandardFonts.Helvetica)
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold)

  const ecrire = (texte, { x = MARGE, y, taille = 10, police = normale, couleur = ENCRE }) => {
    page.drawText(sansCaracteresExotiques(texte), { x, y, size: taille, font: police, color: couleur })
  }

  let y = A4.hauteur - MARGE

  // ── En-tête ────────────────────────────────────────────────────────────
  ecrire('ACTERO', { y, taille: 11, police: grasse, couleur: VERT })
  ecrire(sansCaracteresExotiques(periodLabel), {
    x: A4.largeur - MARGE - normale.widthOfTextAtSize(sansCaracteresExotiques(periodLabel), 10),
    y, taille: 10, couleur: ENCRE_3,
  })
  y -= 34

  ecrire(brandName, { y, taille: 22, police: grasse })
  y -= 20
  ecrire('Rapport mensuel', { y, taille: 13, couleur: ENCRE_3 })
  y -= 26

  page.drawLine({
    start: { x: MARGE, y }, end: { x: A4.largeur - MARGE, y },
    thickness: 1, color: TRAIT,
  })
  y -= 34

  // ── Les quatre chiffres ────────────────────────────────────────────────
  const cartes = [
    { titre: 'Tickets traites', valeur: String(current.tickets_resolved ?? 0), v: variation(current.tickets_resolved, previous.tickets_resolved) },
    { titre: 'Heures gagnees', valeur: `${current.hours_saved ?? 0} h`, v: variation(current.hours_saved, previous.hours_saved) },
    { titre: 'Valeur du temps gagne', valeur: `${current.roi ?? 0} EUR`, v: variation(current.roi, previous.roi) },
    { titre: 'Actions executees', valeur: String(current.tasks_executed ?? 0), v: variation(current.tasks_executed, previous.tasks_executed) },
  ]

  const largeurCarte = (A4.largeur - MARGE * 2 - 16) / 2
  cartes.forEach((carte, i) => {
    const colonne = i % 2
    const ligne = Math.floor(i / 2)
    const x = MARGE + colonne * (largeurCarte + 16)
    const hautCarte = y - ligne * 98

    page.drawRectangle({
      x, y: hautCarte - 78, width: largeurCarte, height: 78,
      borderColor: TRAIT, borderWidth: 1, color: rgb(1, 1, 1),
    })
    ecrire(carte.titre, { x: x + 16, y: hautCarte - 24, taille: 9, couleur: ENCRE_3 })
    ecrire(carte.valeur, { x: x + 16, y: hautCarte - 50, taille: 20, police: grasse })
    const v = libelleVariation(carte.v)
    ecrire(v.texte, { x: x + 16, y: hautCarte - 68, taille: 8.5, couleur: v.couleur })
  })
  y -= 98 * Math.ceil(cartes.length / 2) + 18

  // ── Ce qui occupe l'agent ──────────────────────────────────────────────
  const problemes = Array.isArray(current.top_problems) ? current.top_problems.slice(0, 5) : []
  if (problemes.length) {
    ecrire("Ce qui occupe l'agent", { y, taille: 12, police: grasse })
    y -= 20
    for (const p of problemes) {
      const libelle = LIBELLES_TYPE[p.type] || p.type || 'Autres'
      ecrire(libelle, { y, taille: 10 })
      const droite = `${p.count} (${p.pct} %)`
      ecrire(droite, {
        x: A4.largeur - MARGE - normale.widthOfTextAtSize(sansCaracteresExotiques(droite), 10),
        y, taille: 10, couleur: ENCRE_3,
      })
      y -= 16
    }
    y -= 10
  }

  // ── Pied de page ───────────────────────────────────────────────────────
  const basPage = MARGE + 10
  page.drawLine({
    start: { x: MARGE, y: basPage + 22 }, end: { x: A4.largeur - MARGE, y: basPage + 22 },
    thickness: 1, color: TRAIT,
  })
  ecrire('Genere automatiquement par Actero - actero.fr', {
    y: basPage, taille: 8.5, couleur: ENCRE_3,
  })

  return Buffer.from(await doc.save())
}
