import fs from 'node:fs'
import path from 'node:path'

const API_DIR = 'api'
const SKIP_DIRS = new Set(['api/lib', 'api/cron', 'api/portal/lib'])
const SKIP_NAMES = /(?:_helpers\.js|\.test\.js)$/

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(full)) continue
      walk(full, out)
    } else if (entry.name.endsWith('.js') && !SKIP_NAMES.test(full)) {
      out.push(full)
    }
  }
  return out
}

function getRelativeImport(filePath) {
  const dir = path.dirname(filePath)
  let rel = path.relative(dir, 'api/lib/sentry.js')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

// Find the line index where leading-block content ends (shebangs, comments,
// blank lines). We insert the import right there — above any existing `import`
// statements so we never split a multi-line import.
function findInsertionPoint(lines) {
  let i = 0
  // Optional shebang
  if (lines[0]?.startsWith('#!')) i = 1
  // Skip leading blanks and pure comment lines until we hit code
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed === '') { i++; continue }
    if (trimmed.startsWith('//')) { i++; continue }
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) { i++; continue }
    break
  }
  return i
}

let updated = 0
let skipped = 0
const skippedList = []

for (const file of walk(API_DIR)) {
  let content = fs.readFileSync(file, 'utf8')

  if (content.includes('withSentry') || content.includes('withCronMonitor')) {
    skipped++
    continue
  }

  const asyncRe = /^export default async function handler\(/m
  const syncRe = /^export default function handler\(/m

  let newContent
  if (asyncRe.test(content)) {
    newContent = content.replace(asyncRe, 'async function handler(')
  } else if (syncRe.test(content)) {
    newContent = content.replace(syncRe, 'function handler(')
  } else {
    skipped++
    skippedList.push(file + ' (no default handler)')
    continue
  }

  const importLine = `import { withSentry } from '${getRelativeImport(file)}'`

  const lines = newContent.split('\n')
  const insertAt = findInsertionPoint(lines)
  lines.splice(insertAt, 0, importLine)
  newContent = lines.join('\n')

  if (!newContent.endsWith('\n')) newContent += '\n'
  newContent += '\nexport default withSentry(handler)\n'

  fs.writeFileSync(file, newContent)
  updated++
}

console.log(`\nupdated: ${updated}\nskipped: ${skipped}`)
if (skippedList.length) {
  console.log('\nSkipped files:')
  skippedList.forEach(f => console.log('  -', f))
}
