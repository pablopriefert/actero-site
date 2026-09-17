import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALPHABET_CODE_CLOSER, FORMAT_CODE_CLOSER, genererCodeCloser, normaliserCodeCloser } from './code-closer.js'

describe('code closer ACT-XXXXX', () => {
  it('un alphabet de 32 signes : un octet modulo 32 ne favorise aucun signe', () => {
    expect(ALPHABET_CODE_CLOSER).toHaveLength(32)
    expect(new Set(ALPHABET_CODE_CLOSER).size).toBe(32)
    expect(256 % ALPHABET_CODE_CLOSER.length).toBe(0)
    expect(ALPHABET_CODE_CLOSER).not.toMatch(/[01IO]/)
  })

  it('chaque octet tiré donne un signe, et le code a le format attendu', () => {
    expect(genererCodeCloser(() => Uint8Array.from([0, 1, 31, 32, 255]))).toBe('ACT-AB9A9')
    for (let i = 0; i < 50; i++) expect(genererCodeCloser()).toMatch(FORMAT_CODE_CLOSER)
  })

  it('le hasard vient de crypto, jamais de Math.random', () => {
    // Commentaires retirés : le fichier explique pourquoi il n'utilise pas Math.random.
    const source = readFileSync('api/lib/code-closer.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(source).toMatch(/crypto\.randomBytes/)
    expect(source).not.toMatch(/Math\.random/)
  })

  it('normalise la saisie, refuse le reste', () => {
    expect(normaliserCodeCloser('  act-ab2cd ')).toBe('ACT-AB2CD')
    for (const brut of ['ACT-AB2C', 'ACT-AB2CDE', 'XYZ-AB2CD', '', null, 42, 'ACT-AB2C%']) {
      expect(normaliserCodeCloser(brut), String(brut)).toBeNull()
    }
  })
})
