/**
 * Un faux client Supabase qui FILTRE — pour les tests du programme closers.
 *
 * Pourquoi un faux qui filtre : un faux qui renvoie la même ligne à toutes les
 * requêtes laisse passer exactement le défaut que ces tests cherchent, une
 * route qui lit les données d'un autre closer (api/billing/upgrade.test.js a
 * fait le même constat). Ici chaque `.eq()`, `.in()`, `.is()`, `.lt()` compte, une
 * lecture ne rend que les colonnes de son `.select()`, et une colonne déclarée
 * unique refuse un doublon avec le code d'erreur de Postgres (23505).
 *
 * Ce fichier ne sert qu'aux tests. Il vit dans api/lib/ parce que tout autre
 * fichier de api/ deviendrait une fonction Vercel.
 */

/**
 * @param {{
 *   tables?: Record<string, object[]>,
 *   comptes?: Record<string, { id: string, email?: string, user_metadata?: object, app_metadata?: object }>,
 *   uniques?: Record<string, string[]>,
 *   erreurs?: Record<string, object | ((requete: { operation: string, filtres: any[], charge: any }) => object | null | undefined)>,
 * }} [options]
 *   tables   lignes de départ, par table
 *   comptes  jeton → compte Supabase Auth (auth.getUser) ; leurs e-mails sont déjà pris
 *   uniques  colonnes uniques, par table
 *   erreurs  erreur rendue par toute requête sur la table, ou fonction de la requête
 */
export function creerFauxSupabase({ tables = {}, comptes = {}, uniques = {}, erreurs = {} } = {}) {
  const base = {}
  for (const [nom, lignes] of Object.entries(tables)) base[nom] = lignes.map((l) => ({ ...l }))
  const journal = []
  const utilisateurs = Object.values(comptes).map((u) => ({ ...u }))
  let compteur = 0

  const valeur = (ligne, colonne) => {
    // `payload->>kind` : la clé `kind` du JSON `payload`, en texte, comme PostgREST.
    const [racine, cle] = colonne.split('->>')
    if (cle === undefined) return ligne[colonne] ?? null
    const v = ligne[racine]?.[cle]
    if (v == null) return null
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }

  const projeter = (ligne, colonnes) => {
    if (!colonnes || colonnes.trim() === '*') return { ...ligne }
    return Object.fromEntries(colonnes.split(',').map((c) => c.trim()).filter(Boolean).map((c) => [c, ligne[c] ?? null]))
  }

  const correspond = (ligne, filtres) => filtres.every(([op, colonne, attendu]) => {
    const v = valeur(ligne, colonne)
    switch (op) {
      case 'eq': return v === attendu
      case 'is': return v === attendu
      case 'not_is': return v !== attendu
      case 'in': return attendu.includes(v)
      case 'gt': return v !== null && v > attendu
      case 'gte': return v !== null && v >= attendu
      case 'lt': return v !== null && v < attendu
      case 'lte': return v !== null && v <= attendu
      case 'ilike': return String(v ?? '').toLowerCase().includes(String(attendu).replace(/%/g, '').toLowerCase())
      default: throw new Error(`faux Supabase : filtre ${op} non géré`)
    }
  })

  function requete(table) {
    const filtres = []
    let operation = 'select'
    let charge = null
    let colonnes = null
    let rendre = false
    let tri = null
    let limite = null
    let compter = false
    let tete = false

    function executer() {
      const regle = erreurs[table]
      const erreur = typeof regle === 'function' ? regle({ operation, filtres, charge }) : regle
      if (erreur) return { data: null, error: erreur }
      const lignes = (base[table] ??= [])

      if (operation === 'insert') {
        const nouvelles = (Array.isArray(charge) ? charge : [charge]).map((l) => ({
          id: `${table}-${++compteur}`,
          created_at: new Date().toISOString(),
          ...l,
        }))
        for (const n of nouvelles) {
          for (const colonne of uniques[table] ?? []) {
            if (n[colonne] != null && lignes.some((l) => l[colonne] === n[colonne])) {
              return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${table}_${colonne}_key"` } }
            }
          }
        }
        lignes.push(...nouvelles)
        journal.push({ table, operation, charge })
        return { data: rendre ? nouvelles.map((l) => projeter(l, colonnes)) : null, error: null }
      }

      const touchees = lignes.filter((l) => correspond(l, filtres))
      if (operation === 'update') {
        for (const l of touchees) Object.assign(l, charge)
        journal.push({ table, operation, charge, filtres: [...filtres] })
        return { data: rendre ? touchees.map((l) => projeter(l, colonnes)) : null, error: null }
      }
      if (operation === 'delete') {
        base[table] = lignes.filter((l) => !touchees.includes(l))
        journal.push({ table, operation, filtres: [...filtres] })
        return { data: null, error: null }
      }

      let resultat = touchees
      if (tri) {
        const [colonne, croissant] = tri
        resultat = [...resultat].sort((a, b) => {
          const x = a[colonne] ?? ''
          const y = b[colonne] ?? ''
          return (x < y ? -1 : x > y ? 1 : 0) * (croissant ? 1 : -1)
        })
      }
      if (limite !== null) resultat = resultat.slice(0, limite)
      journal.push({ table, operation, colonnes, filtres: [...filtres] })
      // `select(c, { count: 'exact', head: true })` : le nombre de lignes filtrées,
      // avant la limite, comme PostgREST ; `head` ne rend aucune ligne.
      if (compter) return { data: tete ? null : resultat.map((l) => projeter(l, colonnes)), count: touchees.length, error: null }
      return { data: resultat.map((l) => projeter(l, colonnes)), error: null }
    }

    const uneLigne = (exigee) => async () => {
      const r = executer()
      if (r.error) return r
      const lignes = Array.isArray(r.data) ? r.data : []
      if (lignes.length > 1) return { data: null, error: { code: 'PGRST116', message: 'plusieurs lignes' } }
      if (exigee && lignes.length === 0) return { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } }
      return { data: lignes[0] ?? null, error: null }
    }

    const b = {
      select(c = '*', { count, head } = {}) {
        colonnes = c
        compter = count === 'exact'
        tete = head === true
        if (operation !== 'select') rendre = true
        return b
      },
      insert(v) { operation = 'insert'; charge = v; return b },
      update(v) { operation = 'update'; charge = v; return b },
      delete() { operation = 'delete'; return b },
      eq(c, v) { filtres.push(['eq', c, v]); return b },
      is(c, v) { filtres.push(['is', c, v]); return b },
      not(c, op, v) {
        if (op !== 'is') throw new Error(`faux Supabase : not(${op}) non géré`)
        filtres.push(['not_is', c, v])
        return b
      },
      in(c, v) { filtres.push(['in', c, v]); return b },
      gt(c, v) { filtres.push(['gt', c, v]); return b },
      gte(c, v) { filtres.push(['gte', c, v]); return b },
      lt(c, v) { filtres.push(['lt', c, v]); return b },
      lte(c, v) { filtres.push(['lte', c, v]); return b },
      ilike(c, v) { filtres.push(['ilike', c, v]); return b },
      order(c, { ascending = true } = {}) { tri = [c, ascending]; return b },
      limit(n) { limite = n; return b },
      maybeSingle: uneLigne(false),
      single: uneLigne(true),
      then(resoudre, rejeter) { return Promise.resolve().then(executer).then(resoudre, rejeter) },
    }
    return b
  }

  return {
    base,
    journal,
    utilisateurs,
    from: (table) => requete(table),
    rpc: async (nom) => (nom === 'consume_rate_limit'
      ? { data: [{ allowed: true, remaining: 99, reset_at: new Date(Date.now() + 60_000).toISOString() }], error: null }
      : { data: null, error: { message: `faux Supabase : rpc ${nom} non gérée` } }),
    auth: {
      getUser: async (jeton) => (comptes[jeton]
        ? { data: { user: comptes[jeton] }, error: null }
        : { data: { user: null }, error: { message: 'jeton invalide' } }),
      admin: {
        createUser: async (attributs) => {
          journal.push({ operation: 'createUser', attributs })
          const email = String(attributs.email).toLowerCase()
          if (utilisateurs.some((u) => String(u.email).toLowerCase() === email)) {
            return { data: { user: null }, error: { status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' } }
          }
          const user = { id: `compte-${++compteur}`, email, user_metadata: attributs.user_metadata ?? {} }
          utilisateurs.push(user)
          return { data: { user }, error: null }
        },
        deleteUser: async (id) => {
          journal.push({ operation: 'deleteUser', id })
          return { data: null, error: null }
        },
      },
    },
  }
}

/** Une réponse HTTP minimale, comme celle que Vercel passe aux routes. */
export function fausseReponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(nom, v) { this.headers[nom.toLowerCase()] = v; return this },
    status(code) { this.statusCode = code; return this },
    json(corps) { this.body = corps; return this },
  }
}

/** Appelle une route et rend la réponse. */
export async function appeler(route, { methode = 'GET', jeton, corps, query = {}, ip = '203.0.113.9' } = {}) {
  const res = fausseReponse()
  await route({
    method: methode,
    headers: { ...(jeton ? { authorization: `Bearer ${jeton}` } : {}), 'x-forwarded-for': ip },
    body: corps,
    query,
  }, res)
  return res
}
