import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Aucune route hors admin n'écrit le rôle d'un compte — spec closers, famille 6.
 *
 * CE QUE CE FICHIER EXISTE POUR ARRÊTER — 14 septembre 2026
 *
 * `POST /api/ambassador/apply` ne demandait aucun compte. Pour n'importe quelle
 * adresse reçue, la route retrouvait le compte existant et remplaçait son rôle
 * par « ambassador », dans Supabase Auth (`app_metadata.role`) ET dans
 * `profiles.role`. `api/lib/admin-auth.js` reconnaît un admin à l'un de ces
 * deux champs ou à une ligne `admin_users` ; le seul compte admin tenait par
 * les deux premiers. Une requête anonyme portant son adresse l'enfermait dehors.
 *
 * La route a été fermée (410) le 14 septembre, puis tout `api/ambassador/` a
 * été supprimé avec le programme ambassadeurs (programme closers, 17
 * septembre). La garde qui l'accompagnait ne regardait que cette route : elle
 * regarde maintenant toutes les routes et tous les helpers hors `api/admin/`.
 * L'inscription des closers est le premier chemin neuf qu'elle protège.
 *
 * Commentaires retirés avant l'analyse : une phrase qui raconte le défaut ne
 * le commet pas.
 */

const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function fichiersSource(dossier, extensions = /\.(js|mjs)$/, acc = []) {
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules') continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, extensions, acc)
    else if (extensions.test(entree) && !entree.includes('.test.')) acc.push(chemin)
  }
  return acc
}

/**
 * La clé abrégée qui commence à `depuis` (juste après « app_metadata »)
 * appartient-elle à une DÉCOMPOSITION (une lecture) plutôt qu'à un objet écrit ?
 * On suit les accolades : un motif se ferme sur « = » (`const { … } = u`) ou
 * sur « ) => » (paramètre), en remontant les motifs imbriqués (`{ a: { … } }`).
 * Les tableaux décomposés ne sont pas suivis : pris pour une écriture, ils
 * s'écrivent autrement (`u.app_metadata`).
 */
function estDecomposition(code, depuis) {
  let profondeur = 1
  for (let i = depuis; i < code.length; i++) {
    if (code[i] === '{') profondeur++
    else if (code[i] === '}' && --profondeur === 0) {
      const suite = code.slice(i + 1)
      if (/^\s*=(?![=>])/.test(suite) || /^\s*\)\s*=>/.test(suite)) return true
      if (!/^\s*[,}]/.test(suite)) return false
      profondeur = 1 // un motif imbriqué : on continue jusqu'à la fermeture du motif englobant
    }
  }
  return false
}

/** Les écritures de rôle que ce fichier refuse, chacune avec son motif. */
function ecrituresDeRole(source) {
  const code = sansCommentaires(source)
  const trouvees = []
  // Clé explicite, entre guillemets ou non — mais pas `u.app_metadata :` (une
  // lecture, dans un ternaire).
  if (/(?<![.\w$])['"`]?app_metadata['"`]?\s*:/.test(code)) trouvees.push('app_metadata écrit (createUser / updateUserById)')
  // Clé abrégée : `updateUserById(id, { app_metadata })`.
  for (const m of code.matchAll(/[{,]\s*app_metadata\s*(?=[,}])/g)) {
    if (!estDecomposition(code, m.index + m[0].length)) {
      trouvees.push('app_metadata écrit en abrégé ({ app_metadata })')
      break
    }
  }
  if (/\/auth\/v1\/admin\/users/.test(code)) trouvees.push('API d’administration des comptes Supabase appelée directement')
  for (const m of code.matchAll(/\.from\(\s*['"`]profiles['"`]\s*\)/g)) {
    const suite = code.slice(m.index + m[0].length, m.index + m[0].length + 300)
    const fin = suite.search(/\.from\(/)
    const instruction = fin === -1 ? suite : suite.slice(0, fin)
    if (/\.(insert|update|upsert|delete)\s*\(/.test(instruction)) trouvees.push('profiles écrit')
  }
  return trouvees
}

describe('garde de rôle — la garde reconnaît le défaut', () => {
  it.each([
    ['createUser avec un rôle', `await supabase.auth.admin.createUser({ email, app_metadata: { role: 'ambassador' } })`],
    ['updateUserById sur plusieurs lignes', `await supabase.auth.admin.updateUserById(id, {\n  app_metadata: { ...u.app_metadata, role: 'ambassador' },\n})`],
    ['updateUserById en abrégé', `await supabase.auth.admin.updateUserById(id, { app_metadata })`],
    ['abrégé sur plusieurs lignes, parmi d’autres clés', `await supabase.auth.admin.updateUserById(user.id, {\n  user_metadata,\n  app_metadata,\n})`],
    ['abrégé après une décomposition', `await supabase.auth.admin.updateUserById(id, { ...attributs, app_metadata })`],
    ['objet préparé en abrégé, puis passé', `const attributs = { email, app_metadata }\nawait supabase.auth.admin.createUser(attributs)`],
    ['clé entre guillemets', `await supabase.auth.admin.updateUserById(id, { 'app_metadata': { role } })`],
    ['appel direct à GoTrue', 'await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "PUT", body })'],
    ['profiles.upsert', `await supabase.from('profiles').upsert({ id, role: 'ambassador' })`],
    ['profiles.update en chaîne', `await supabase\n  .from("profiles")\n  .update({ role: 'ambassador' })\n  .eq('id', id)`],
  ])('%s', (_cas, extrait) => {
    expect(ecrituresDeRole(extrait)).not.toEqual([])
  })

  it.each([
    ['lecture du rôle Auth', `if (user.app_metadata?.role === 'admin') return true`],
    ['lecture de profiles', `const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()`],
    ['une écriture sur une autre table ensuite', `await supabase.from('profiles').select('role').eq('id', u).maybeSingle()\nawait supabase.from('closers').insert({ user_id: u })`],
    ['un commentaire qui raconte le défaut', `// l'ancienne route écrivait app_metadata: { role } via /auth/v1/admin/users`],
    ['une lecture par décomposition', `const { app_metadata } = user`],
    ['une lecture par décomposition imbriquée', `const { data: { user: { app_metadata } }, error } = await supabase.auth.getUser(jeton)`],
    ['un paramètre décomposé', `const estAdmin = ({ app_metadata }) => app_metadata?.role === 'admin'`],
    ['une lecture dans une condition ternaire', `const meta = user ? user.app_metadata : {}`],
  ])('ne confond pas : %s', (_cas, extrait) => {
    expect(ecrituresDeRole(extrait)).toEqual([])
  })
})

describe('garde de rôle — le dépôt', () => {
  it('aucune route ni aucun helper hors api/admin/ n’écrit app_metadata.role ni profiles.role', () => {
    const fautifs = []
    for (const fichier of fichiersSource('api')) {
      if (fichier.startsWith(join('api', 'admin'))) continue
      const trouvees = ecrituresDeRole(readFileSync(fichier, 'utf8'))
      if (trouvees.length) fautifs.push(`${fichier} → ${trouvees.join(', ')}`)
    }
    expect(fautifs, `Écritures de rôle hors admin :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('les chemins d’inscription closer sont bien parmi les fichiers regardés', () => {
    const regardes = fichiersSource('api')
    for (const f of ['api/closer/verifier-code.js', 'api/closer/devenir-closer.js', 'api/lib/fiche-closer.js']) {
      expect(regardes, f).toContain(join(...f.split('/')))
    }
  })
})

describe('le programme ambassadeurs a disparu', () => {
  it('ses routes et son helper n’existent plus', () => {
    expect(existsSync('api/ambassador'), 'api/ambassador/ est revenu').toBe(false)
    expect(existsSync('src/lib/ambassador-helpers.js'), 'src/lib/ambassador-helpers.js est revenu').toBe(false)
  })

  it('plus personne ne les appelle', () => {
    const fautifs = []
    for (const fichier of [...fichiersSource('api'), ...fichiersSource('src', /\.(js|jsx|ts|tsx)$/)]) {
      const code = sansCommentaires(readFileSync(fichier, 'utf8'))
      if (/\/api\/ambassador\/|ambassador-helpers|AMBASSADOR_STATUS_MAP/.test(code)) fautifs.push(fichier)
    }
    expect(fautifs).toEqual([])
  })

  it('ni la palette de commandes, ni le sitemap, ni le pré-rendu, ni llms.txt ne l’annoncent', () => {
    expect(readFileSync('src/components/CommandPalette.jsx', 'utf8')).not.toMatch(/Ambassador/i)
    for (const f of ['public/sitemap.xml', 'scripts/prerender-routes.mjs', 'public/llms.txt', 'public/robots.txt']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/ambassad/i)
    }
  })
})
