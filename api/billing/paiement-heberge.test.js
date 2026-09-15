import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Gardes du chantier « formules + Checkout hébergé » (14 septembre 2026).
 * Chacune vise un défaut qui passait sans bruit.
 */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('le MRR de l’admin', () => {
  it('ne lit plus l’intervalle seul', () => {
    // `interval === 'month'` comptait un trimestriel de 297 € comme 297 € de MRR.
    const src = sansCommentaires(readFileSync('api/stripe-billing.js', 'utf8'))
    expect(src).not.toMatch(/interval === 'month'\) return/)
    expect(src).toMatch(/mensualiteCentimes\(/)
  })
})
