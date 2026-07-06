import { describe, it, expect } from 'vitest'
import { computeFingerprint, buildMinerPrompt, parseSuggestions } from './improvement-loop-core.js'

describe('computeFingerprint', () => {
  it('is stable and case/space-insensitive for the same theme', () => {
    expect(computeFingerprint('Assurance colis perdu'))
      .toBe(computeFingerprint('  assurance   COLIS perdu '))
  })
  it('differs for different themes', () => {
    expect(computeFingerprint('assurance colis')).not.toBe(computeFingerprint('délais belgique'))
  })
})

describe('buildMinerPrompt', () => {
  it('includes the cases and the existing KB titles', () => {
    const p = buildMinerPrompt({
      cases: [{ question: 'Mes colis sont-ils assurés ?', humanReply: 'Oui, assurés.' }],
      existingTitles: ['Politique de retour'],
    })
    expect(p).toContain('Mes colis sont-ils assurés ?')
    expect(p).toContain('Oui, assurés.')
    expect(p).toContain('Politique de retour')
    expect(p.toLowerCase()).toContain('json')
  })
})

describe('parseSuggestions', () => {
  it('parses a clean {suggestions:[...]} object', () => {
    const raw = JSON.stringify({ suggestions: [
      { theme: 'Assurance colis', kb_title: 'Assurance et colis perdus', kb_content: 'Tous nos envois sont assurés.', occurrences: 8, evidence_conversation_ids: ['a', 'b'], estimated_time_gain_minutes: 40 },
    ] })
    const out = parseSuggestions(raw)
    expect(out).toHaveLength(1)
    expect(out[0].kb_title).toBe('Assurance et colis perdus')
    expect(out[0].occurrences).toBe(8)
  })
  it('extracts JSON even when wrapped in prose/code fences', () => {
    const raw = 'Voici:\n```json\n{"suggestions":[{"theme":"X","kb_title":"T","kb_content":"C","occurrences":3,"evidence_conversation_ids":[],"estimated_time_gain_minutes":15}]}\n```'
    expect(parseSuggestions(raw)).toHaveLength(1)
  })
  it('returns [] on garbage', () => {
    expect(parseSuggestions('not json at all')).toEqual([])
  })
  it('drops malformed entries (missing kb_title/kb_content)', () => {
    const raw = JSON.stringify({ suggestions: [{ theme: 'X', occurrences: 5 }] })
    expect(parseSuggestions(raw)).toEqual([])
  })
})
