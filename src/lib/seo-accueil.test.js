import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Garde SEO de l'accueil — audit du 16 septembre 2026.
 *
 * Cinq oublis relevés par l'audit, chacun avec sa raison d'être ici :
 *
 *  - `index.html` chargeait la feuille de style Mona Sans depuis jsDelivr :
 *    le lien répond 404, et aucune règle du site ne s'en sert (la police
 *    réelle est Inter Tight, voir typographie.test.js). Un <link> mort reste
 *    une requête réseau pour rien.
 *  - Le JSON-LD `Organization` pointait `sameAs` vers
 *    linkedin.com/company/actero, qui est « ActeRO », une société roumaine
 *    sans rapport. Un moteur qui suit ce lien associe Actero à la mauvaise
 *    entité.
 *  - `<meta name="keywords">` n'a plus d'effet sur aucun moteur depuis des
 *    années ; il ne fait plus que documenter les mots visés à qui lit la
 *    source.
 *  - Le script Amplitude externe n'avait pas `defer` : il bloquait le
 *    parsing HTML pour un outil d'analytics.
 *  - `LandingPage.jsx` réinjectait un second bloc `Organization` + `WebSite`
 *    (avec un `SearchAction` vers une recherche qui n'existe pas sur le
 *    site) en plus de celui d'`index.html` — deux schémas concurrents pour
 *    la même entité, dont un mensonger.
 *
 * Et deux fautes qui traînaient dans le premier écran : « Soutenu par
 * [Station F] » (Actero travaille à Station F mais n'est accompagné par
 * aucun programme) et « Demarrer gratuitement » sans accent dans l'en-tête.
 *
 * Plus une absence : sur mobile, le premier bouton d'inscription
 * n'apparaissait qu'à 58 % de la page (le CTA de la démo du hero ne
 * s'affiche qu'après une réponse, et le menu mobile n'en proposait pas).
 *
 * Comme couleurs.test.js et typographie.test.js, ce test lit les sources
 * BRUTES et ignore les commentaires : un commentaire qui raconte pourquoi
 * une formule a été retirée ne doit pas faire échouer la garde qui vérifie
 * qu'elle a bien été retirée.
 */

const INDEX_HTML_PATH = 'index.html'
const GLASS_HERO_PATH = 'src/components/ui/glass-hero.jsx'
const LANDING_PAGE_PATH = 'src/pages/LandingPage.jsx'
const NAVBAR_PATH = 'src/components/layout/Navbar.jsx'

// index.html ne connaît que les commentaires <!-- -->.
function sansCommentairesHTML(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '')
}

// Même méthode que typographie.test.js / couleurs.test.js : suit l'état des
// blocs /* … */ dont les lignes de continuation ne portent aucun marqueur,
// et retire les lignes // et /* * */.
function sansCommentairesJS(src) {
  const lignes = []
  let dansBloc = false
  for (const ligne of src.split('\n')) {
    const nu = ligne.trim()
    const ouvre = ligne.lastIndexOf('/*')
    const ferme = ligne.lastIndexOf('*/')
    const etaitDansBloc = dansBloc
    if (!dansBloc && ouvre !== -1 && ferme < ouvre) dansBloc = true
    else if (dansBloc && ferme !== -1 && ferme > ouvre) dansBloc = false

    if (etaitDansBloc || dansBloc) continue
    if (nu.startsWith('//') || nu.startsWith('/*') || nu.startsWith('*')) continue
    lignes.push(ligne)
  }
  return lignes.join('\n')
}

const indexHtml = sansCommentairesHTML(readFileSync(INDEX_HTML_PATH, 'utf8'))
const glassHero = sansCommentairesJS(readFileSync(GLASS_HERO_PATH, 'utf8'))
const landingPage = sansCommentairesJS(readFileSync(LANDING_PAGE_PATH, 'utf8'))
const navbar = sansCommentairesJS(readFileSync(NAVBAR_PATH, 'utf8'))

describe('SEO accueil — audit du 16 septembre', () => {
  it('index.html ne charge plus la police Mona Sans (lien mort, 404)', () => {
    expect(indexHtml.toLowerCase()).not.toMatch(/mona-sans/)
  })

  it("index.html ne pointe plus vers le LinkedIn roumain (ActeRO)", () => {
    expect(indexHtml.toLowerCase()).not.toMatch(/linkedin\.com\/company\/actero/)
  })

  it('index.html ne déclare plus de balise meta keywords', () => {
    expect(indexHtml).not.toMatch(/name="keywords"/)
  })

  it('le script Amplitude externe est chargé en defer', () => {
    const balise = indexHtml.match(
      /<script[^>]*src="https:\/\/cdn\.eu\.amplitude\.com\/script\/[^"]*"[^>]*>/,
    )
    expect(balise, 'balise <script> Amplitude introuvable dans index.html').toBeTruthy()
    expect(balise[0]).toMatch(/\bdefer\b/)
  })

  it("glass-hero.jsx ne dit plus « Soutenu par » (Actero n'est accompagné par aucun programme)", () => {
    expect(glassHero).not.toMatch(/Soutenu par/)
  })

  it('aucun fichier autorisé ne contient la faute « Demarrer » sans accent', () => {
    const fichiers = {
      [INDEX_HTML_PATH]: indexHtml,
      [GLASS_HERO_PATH]: glassHero,
      [LANDING_PAGE_PATH]: landingPage,
      [NAVBAR_PATH]: navbar,
    }
    const fautifs = Object.entries(fichiers)
      .filter(([, src]) => /Demarrer/.test(src))
      .map(([nom]) => nom)
    expect(fautifs, `"Demarrer" sans accent trouvé dans : ${fautifs.join(', ')}`).toEqual([])
  })

  it("LandingPage.jsx ne réinjecte plus de schéma WebSite (doublon d'index.html)", () => {
    expect(landingPage).not.toMatch(/['"]@type['"]\s*:\s*['"]WebSite['"]/)
  })

  it('le haut de l\'accueil propose un bouton « Démarrer gratuitement »', () => {
    expect(glassHero).toMatch(/Démarrer gratuitement/)
  })
})
