import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// Find all files with the unsafe email-string admin check.
const raw = execSync(
  "grep -rln \"endsWith('@actero.fr')\" api/ 2>/dev/null || true",
  { encoding: 'utf8' },
).trim()
const files = raw ? raw.split('\n').filter((f) => !f.endsWith('admin-auth.js')) : []

const PATTERN = /user\.app_metadata\?\.role\s*===\s*'admin'\s*\|\|\s*user\.email\?\.endsWith\('@actero\.fr'\)/g

function relImportPath(filePath) {
  const dir = path.dirname(filePath)
  let rel = path.relative(dir, 'api/lib/admin-auth.js')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function hasImport(content) {
  return /from\s+['"][^'"]*admin-auth(\.js)?['"]/.test(content)
}

function addImport(content, importPath) {
  // Insert right after the first block of imports (or at the top).
  const lines = content.split('\n')
  let lastImport = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i
  }
  const importLine = `import { isActeroAdmin } from '${importPath}'`
  if (lastImport === -1) {
    return importLine + '\n' + content
  }
  lines.splice(lastImport + 1, 0, importLine)
  return lines.join('\n')
}

let changed = 0
let skipped = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  if (!PATTERN.test(content)) {
    skipped++
    continue
  }
  // Reset regex state (global flag)
  content.replace(PATTERN, '')

  // Replace with async helper call. Caller's expression becomes awaited.
  const updated = content.replace(
    PATTERN,
    'await isActeroAdmin(user, supabase)',
  )

  let finalContent = updated
  if (!hasImport(finalContent)) {
    finalContent = addImport(finalContent, relImportPath(file))
  }

  fs.writeFileSync(file, finalContent)
  changed++
  console.log('✓', file)
}

console.log(`\nchanged: ${changed}, skipped: ${skipped}`)
