import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS } from './plans.js'
import { PLAN_FEATURES, PLAN_LIMITS } from '../../api/lib/plan-limits.js'

/**
 * L'agent vocal a été retiré le 10 septembre 2026.
 *
 * Il était vendu — « Agent vocal téléphonique », un onglet, une carte de
 * canal, une ligne dans les comparatifs concurrents — et le drapeau
 * `voice_agent` valait `false` sur les quatre formules. Vérifié en base
 * avant de supprimer quoi que ce soit :
 *
 *   voice_calls          0 ligne
 *   numéros provisionnés 0
 *   minutes consommées   0
 *   réponses avec audio  0
 *
 * Zéro appel depuis la création. La fonctionnalité n'a jamais servi, et la
 * maintenir coûtait un fournisseur de synthèse vocale, des numéros de
 * téléphone et une promesse à tenir.
 *
 * Ce test existe parce qu'une suppression de cette taille — une soixantaine
 * de fichiers — se défait par un seul copier-coller distrait.
 */

const RACINE_SRC = 'src'
const RACINE_API = 'api'

function fichiers(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiers(p, acc)
    else if (/\.(jsx?|tsx?)$/.test(e) && !e.includes('.test.')) acc.push(p)
  }
  return acc
}

const TOUS = [...fichiers(RACINE_SRC), ...fichiers(RACINE_API)]

describe('agent vocal retiré', () => {
  it('les fichiers dédiés ne reviennent pas', () => {
    const revenus = [
      'api/voice',
      'api/elevenlabs',
      'api/tts',
      'api/text-to-speech.js',
      'api/lib/tts.js',
      'api/engine/shopify-vocal-widget.js',
      'api/engine/webhooks/elevenlabs-postcall.js',
      'src/hooks/useTTS.js',
      'src/components/ui/TTSButton.jsx',
      'src/components/client/VoiceCallsView.jsx',
      'src/components/client/VoiceAgentSetupView.jsx',
      'src/components/client/VocalAgentWizard.jsx',
      'src/components/client/VoiceTestModal.jsx',
    ].filter((p) => existsSync(p))
    expect(revenus, `Fichiers de l'agent vocal réapparus : ${revenus.join(', ')}`).toEqual([])
  })

  it('aucun plan ne redéclare la voix', () => {
    // Le drapeau et le quota sont partis des deux fichiers de plans. S'ils
    // reviennent, la page tarifs les affichera — et on revend une chose qui
    // n'existe plus.
    for (const plan of ['free', 'starter', 'pro', 'enterprise']) {
      expect(PLANS[plan].features, `voice_agent de retour sur ${plan}`).not.toHaveProperty('voice_agent')
      expect(PLANS[plan].limits, `voice_minutes de retour sur ${plan}`).not.toHaveProperty('voice_minutes')
      expect(PLAN_FEATURES[plan], `voice_agent de retour côté serveur sur ${plan}`).not.toHaveProperty('voice_agent')
      expect(PLAN_LIMITS[plan], `voice_minutes de retour côté serveur sur ${plan}`).not.toHaveProperty('voice_minutes')
    }
  })

  it('plus une ligne de code ne parle de la voix comme d\'une capacité', () => {
    // Deux exceptions assumées, et une seule raison pour chacune :
    //
    //  - les webhooks de purge RGPD effacent encore la table `voice_calls`.
    //    Elle est vide et n'est pas supprimée : tant qu'elle existe, une
    //    demande d'effacement doit continuer de la vider. Le jour où la table
    //    part, ces lignes partent avec — pas avant.
    //  - `competitor-pricing.js` décrit les tarifs des CONCURRENTS. Que
    //    Gorgias facture la voix en supplément reste vrai, et c'est
    //    exactement l'argument.
    const EXEMPTS = [
      'api/shopify/webhooks/shop/redact.js',
      'api/shopify/webhooks/customers/redact.js',
      'src/lib/competitor-pricing.js',
      // Les badges « ElevenLabs Startup Grants » sont une bourse réellement
      // obtenue, pas une capacité du produit. Retirer l'agent vocal n'efface
      // pas le fait d'avoir été soutenu — ces badges restent, et cette garde
      // ne doit pas pousser à les supprimer par excès de zèle.
      'src/components/layout/Footer.jsx',
      'src/components/ui/PartnersMarquee.jsx',
      'src/pages/CompanyPage.jsx',
      // Le calculateur compare le PRIX de Gorgias : « voice et SMS en add-on
      // payant » décrit leur grille, et c'est l'argument de la page.
      'src/components/landing/GorgiasCostCalculator.jsx',
      // La bibliothèque de prompts montre des workflows que le marchand peut
      // bâtir avec des outils TIERS (Make, Twilio, Bland.ai). Ce n'est pas une
      // capacité d'Actero, c'est un exemple d'automatisation.
      'src/components/ui/prompt-library-page.jsx',
    ]
    // Les pages de comparaison décrivent aussi l'offre des CONCURRENTS. Que
    // Gorgias ou Intercom facturent la voix en supplément reste vrai, et c'est
    // l'argument même de ces pages. Distinguer automatiquement « nous le
    // faisons » de « eux le font » n'est pas possible en lisant une ligne, et
    // une garde qui se trompe est une garde qu'on désactive. Ces pages sont
    // donc exclues ici ; ce qui compte est que le PRODUIT ne reparle plus de
    // voix — et c'est exactement ce que le reste de ce test vérifie.
    const COMPARATIFS = /^src\/pages\/(Alternative|.*VsActero|SupportGuidePage|CalculateurGorgiasPage)/
    // « tone of voice » et « brand voice » sont des tournures anglaises sur le
    // ton de marque, sans rapport avec le téléphone.
    const TOURNURES = /(tone of voice|brand voice)/i

    const fautifs = []
    for (const f of TOUS) {
      if (EXEMPTS.includes(f) || COMPARATIFS.test(f)) continue
      const src = readFileSync(f, 'utf8')
      for (const ligne of src.split('\n')) {
        if (TOURNURES.test(ligne)) continue
        // `invoice` contient `voice` : c'est le faux positif qui rend ce
        // genre de garde inutilisable si on l'oublie.
        const nu = ligne.replace(/invoice/gi, '')
        if (/\bvoice\b|voice_|vocal|elevenlabs|\btts\b/i.test(nu)) {
          fautifs.push(`${f} → ${ligne.trim().slice(0, 90)}`)
        }
      }
    }
    expect(fautifs, `L'agent vocal est de retour :\n${fautifs.join('\n')}`).toEqual([])
  })
})
