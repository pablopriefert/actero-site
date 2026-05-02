/**
 * Actero — Données de pricing concurrents (mai 2026)
 *
 * Source de vérité pour tous les comparatifs / calculateurs / pages "vs X".
 * Mise à jour à chaque cycle de veille concurrentielle (cf. agent Theona
 * "Veille concurrentielle hebdo" qui pousse une page Notion chaque lundi).
 *
 * Convention :
 *   - Tarifs en USD pour les concurrents internationaux (Gorgias, Intercom,
 *     Zendesk, Tidio, Siena, eesel, Alhena), en EUR pour Crisp (FR).
 *   - Conversion USD→EUR via USD_TO_EUR (rolling 12-mois ≈ 0.93).
 *   - Le calcul du coût total tient compte de la base helpdesk + l'add-on IA
 *     (souvent à la résolution) + d'éventuels overages.
 *
 * Si tu touches ce fichier, mets à jour aussi :
 *   - src/pages/AlternativeEesel.jsx, EeselVsActero.jsx (chiffres en dur)
 *   - src/pages/AlternativeGorgias.jsx etc. (chiffres en dur — à refactorer
 *     pour pointer ici dans une vague ultérieure)
 */

export const USD_TO_EUR = 0.93

/**
 * Calcule le coût mensuel TOTAL d'un concurrent pour un volume donné.
 *
 * @param {string} competitorKey — clé dans COMPETITORS
 * @param {number} ticketsPerMonth — volume mensuel total (humain + auto)
 * @param {number} aiResolutionRate — % de résolution IA (0..1). Default 0.6
 * @returns {{ monthlyEur: number, breakdown: string, currency: 'EUR' }}
 */
export function calculateCompetitorMonthlyCost(competitorKey, ticketsPerMonth, aiResolutionRate = 0.6) {
  const c = COMPETITORS[competitorKey]
  if (!c) return { monthlyEur: 0, breakdown: 'Concurrent inconnu', currency: 'EUR' }
  return c.calculate(ticketsPerMonth, aiResolutionRate)
}

/**
 * Calcule le coût mensuel Actero pour un volume donné.
 * Plans : Free 0€ (50t) · Starter 99€ (1000t · 0,15€ overage) ·
 *         Pro 399€ (5000t · 0,10€ overage) · Enterprise 'custom'
 */
export function calculateActeroMonthlyCost(ticketsPerMonth) {
  if (ticketsPerMonth <= 50) {
    return { monthlyEur: 0, plan: 'Free', breakdown: 'Plan Free (jusqu\'à 50 tickets/mois)' }
  }
  if (ticketsPerMonth <= 1000) {
    return { monthlyEur: 99, plan: 'Starter', breakdown: 'Plan Starter à 99 € · 1 000 tickets inclus' }
  }
  if (ticketsPerMonth <= 5000) {
    return { monthlyEur: 399, plan: 'Pro', breakdown: 'Plan Pro à 399 € · 5 000 tickets inclus' }
  }
  // Au-delà de 5000 : Pro + overage 0,10 € / ticket supplémentaire
  const overage = (ticketsPerMonth - 5000) * 0.10
  return {
    monthlyEur: 399 + overage,
    plan: 'Pro + overage',
    breakdown: `Plan Pro 399 € + ${(ticketsPerMonth - 5000).toLocaleString('fr-FR')} tickets × 0,10 € = ${overage.toFixed(0)} €`,
  }
}

/**
 * Catalogue concurrents avec leur fonction de calcul propre.
 * Chaque calculate(ticketsPerMonth, aiRate) retourne { monthlyEur, breakdown, currency }.
 */
export const COMPETITORS = {
  gorgias: {
    name: 'Gorgias',
    pricingModel: 'Helpdesk + 0,90-1,00 $ par résolution IA',
    notes: 'Add-ons voice 0,40-1,20 $/ticket, SMS 0,41-0,80 $/ticket',
    calculate: (tickets, aiRate) => {
      // Plans publics avril 2026 : Starter 10$ (50t) · Basic 60$ (300t) ·
      // Pro 360$ (2k) · Advanced 900$ (5k). AI Agent : 0,95 $/résolution.
      let basePlanUsd = 0
      let baseLabel = ''
      if (tickets <= 50) { basePlanUsd = 10; baseLabel = 'Starter 10 $' }
      else if (tickets <= 300) { basePlanUsd = 60; baseLabel = 'Basic 60 $' }
      else if (tickets <= 2000) { basePlanUsd = 360; baseLabel = 'Pro 360 $' }
      else if (tickets <= 5000) { basePlanUsd = 900; baseLabel = 'Advanced 900 $' }
      else { basePlanUsd = 900 + Math.ceil((tickets - 5000) / 100) * 36; baseLabel = `Advanced 900 $ + ${Math.ceil((tickets - 5000) / 100) * 36} $ overage` }

      const aiResolutions = tickets * aiRate
      const aiCostUsd = aiResolutions * 0.95
      const totalUsd = basePlanUsd + aiCostUsd
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: `${baseLabel} + ${Math.round(aiResolutions).toLocaleString('fr-FR')} résolutions IA × 0,95 $`,
        currency: 'EUR',
      }
    },
  },

  intercom: {
    name: 'Intercom Fin',
    pricingModel: 'Sièges (29-139 $/siège) + Fin par outcome 0,99 $/résolution',
    notes: 'Minimum 49,50 $/mois. Lancement Intercom 2 le 1er mai 2026 avec Fin for Sales.',
    calculate: (tickets, aiRate) => {
      // Plan Essential supposé 39 $/siège × 1 siège = 39 $
      // Fin résout aiRate % des tickets à 0,99 $/résolution
      const seatCostUsd = 39
      const aiResolutions = tickets * aiRate
      const finCostUsd = Math.max(aiResolutions * 0.99, 49.50)
      const totalUsd = seatCostUsd + finCostUsd
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: `1 siège Essential 39 $ + ${Math.round(aiResolutions).toLocaleString('fr-FR')} résolutions Fin × 0,99 $ (min 49,50 $)`,
        currency: 'EUR',
      }
    },
  },

  zendesk: {
    name: 'Zendesk AI',
    pricingModel: 'Suite (55-115 $/agent) + Advanced AI 50 $/agent + Copilot 50 $/agent',
    notes: 'IA Suite Growth 89 $ + AI add-on 50 $ = 139 $/agent. Zendesk Relate 21 mai 2026.',
    calculate: (tickets, aiRate) => {
      // 1 agent Suite Growth + Advanced AI : 89 + 50 = 139 $/mois pour 1 agent
      // À partir de 1000 tickets/mois on suppose 2 agents, 3000 → 3 agents, etc.
      const seats = Math.max(1, Math.ceil(tickets / 1500))
      const perSeatUsd = 139
      const totalUsd = seats * perSeatUsd
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: `${seats} agent${seats > 1 ? 's' : ''} × 139 $ (Suite Growth + Advanced AI) — couvre IA et humain`,
        currency: 'EUR',
      }
    },
  },

  tidio: {
    name: 'Tidio',
    pricingModel: 'Plans + add-ons Lyro AI / Flows. Premium à 2 999 $/mois.',
    notes: 'Plan Premium = 2 999 $/mois avec garantie 50% résolution Lyro.',
    calculate: (tickets, aiRate) => {
      // Plan Starter ~25 $ + Lyro AI add-on ~32,50 $ + Flows 24 $ ≈ 81,50 $ pour 100 conv
      // Au-delà : pricing très opaque, on extrapole linéairement
      let totalUsd
      let label
      if (tickets <= 200) {
        totalUsd = 81.50; label = 'Starter + Lyro + Flows ≈ 81,50 $'
      } else if (tickets <= 1500) {
        totalUsd = 159; label = 'Growth + Lyro + Flows ≈ 159 $'
      } else if (tickets <= 4000) {
        totalUsd = 449; label = 'Plus + Lyro + Flows ≈ 449 $'
      } else {
        totalUsd = 2999; label = 'Premium 2 999 $ (garantie 50% résolution Lyro)'
      }
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: label,
        currency: 'EUR',
      }
    },
  },

  crisp: {
    name: 'Crisp Hugo AI',
    pricingModel: 'Free / Mini 45 € / Essentials 95 € / Plus 295 €. Hugo illimité = Plus.',
    notes: 'Hugo limité ~50 usages/mois sur Essentials. IA illimitée verrouillée Plus.',
    calculate: (tickets) => {
      // IA illimitée = Plus 295 €/mois dès qu'on dépasse 50 usages.
      let totalEur
      let label
      if (tickets <= 30) { totalEur = 0; label = 'Plan Free (sans Hugo IA)' }
      else if (tickets <= 50) { totalEur = 95; label = 'Essentials 95 € (Hugo limité ~50 usages)' }
      else { totalEur = 295; label = 'Plus 295 € (Hugo illimité requis)' }
      return {
        monthlyEur: totalEur,
        breakdown: label,
        currency: 'EUR',
      }
    },
  },

  siena: {
    name: 'Siena AI',
    pricingModel: '750 $/mois fixe + 0,90 $ par ticket automatisé.',
    notes: 'Connectivité 2 000+ transporteurs (rivalise lookup Shopify Actero).',
    calculate: (tickets, aiRate) => {
      const aiResolutions = tickets * aiRate
      const totalUsd = 750 + aiResolutions * 0.90
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: `Forfait 750 $ + ${Math.round(aiResolutions).toLocaleString('fr-FR')} tickets × 0,90 $`,
        currency: 'EUR',
      }
    },
  },

  eesel: {
    name: 'eesel AI',
    pricingModel: 'Pay-as-you-go 0,40 $/ticket régulier, sans abonnement fixe.',
    notes: 'Société US, hébergement US. Offensive SEO active sur ICP Actero (mai 2026).',
    calculate: (tickets) => {
      // PAYG pur : 0,40 $/ticket, pas de minimum
      const totalUsd = tickets * 0.40
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: `${tickets.toLocaleString('fr-FR')} tickets × 0,40 $ pay-as-you-go`,
        currency: 'EUR',
      }
    },
  },

  alhena: {
    name: 'Alhena',
    pricingModel: 'Credit-based : 199 $/200 conv → 999 $/1 200 conv. Overage 1,20 $/crédit.',
    notes: 'Bon AEO/GEO tracking ChatGPT/Perplexity. Anti grille tarifaire à la résolution.',
    calculate: (tickets) => {
      let totalUsd
      let label
      if (tickets <= 200) { totalUsd = 199; label = 'Plan 199 $ (200 crédits)' }
      else if (tickets <= 500) { totalUsd = 449; label = 'Plan 449 $ (500 crédits)' }
      else if (tickets <= 1200) { totalUsd = 999; label = 'Plan 999 $ (1 200 crédits)' }
      else { totalUsd = 999 + (tickets - 1200) * 1.20; label = `Plan 999 $ + ${(tickets - 1200).toLocaleString('fr-FR')} crédits × 1,20 $ overage` }
      return {
        monthlyEur: totalUsd * USD_TO_EUR,
        breakdown: label,
        currency: 'EUR',
      }
    },
  },
}

/**
 * Liste prête pour un dropdown UI.
 */
export const COMPETITOR_OPTIONS = Object.entries(COMPETITORS).map(([key, c]) => ({
  key,
  name: c.name,
  pricingModel: c.pricingModel,
}))
