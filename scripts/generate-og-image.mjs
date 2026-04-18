#!/usr/bin/env node
/**
 * Generate public/og-image.png from the SVG template.
 *
 * Why: Facebook / LinkedIn / Slack / Twitter prefer PNG for OG previews.
 * SVG OG is technically supported by some crawlers but unreliably rendered.
 * We ship a 1200x630 PNG that's ~40 kB and universally safe.
 *
 * Run manually: `node scripts/generate-og-image.mjs`
 * Auto-run: invoked as part of `prebuild` in package.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { resolve } from 'node:path'

const svgPath = resolve(process.cwd(), 'public/og-image.svg')
const pngPath = resolve(process.cwd(), 'public/og-image.png')

const svg = readFileSync(svgPath, 'utf8')

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  background: '#F9F7F1',
  font: {
    // resvg-js bundles system fallbacks; we don't need to load custom fonts for
    // OG — the PNG is rasterized once, then cached by every social crawler.
    loadSystemFonts: true,
  },
})

const pngData = resvg.render().asPng()
writeFileSync(pngPath, pngData)

const kb = (pngData.length / 1024).toFixed(1)
console.log(`✓ og-image.png written (${kb} kB, 1200×630)`)
