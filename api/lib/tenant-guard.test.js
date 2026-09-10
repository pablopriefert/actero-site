import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ACT-24 — garde d'isolation multi-tenant, rejouable en CI.
 *
 * Le 9 septembre 2026, le même défaut a été trouvé quatre fois dans la journée,
 * sur trois surfaces différentes :
 *
 *   api/engine/gateway.js                  route serverless
 *   recompute_client_metrics               fonction Postgres SECURITY DEFINER
 *   7 routes dont knowledge/import-*       routes serverless
 *
 * Le motif est toujours identique :
 *
 *   const { data: { user } } = await supabase.auth.getUser(token)   // qui
 *   const { client_id } = req.body                                  // sur qui
 *   await supabase.from(...).eq('client_id', client_id)              // sans lien
 *
 * Ces routes utilisent la clé service_role, qui contourne RLS. Le contrôle
 * manquant est donc la seule barrière, et il ne manquait pas par négligence :
 * le code était lisible et avait été relu. Une des routes avait même fait
 * l'objet d'une migration qui pesait ses droits d'exécution sans voir que la
 * fonction elle-même ne vérifiait rien.
 *
 * D'où ce test. Il ne remplace pas une revue : il rend impossible d'AJOUTER
 * une route qui prend un client_id de l'appelant sans le vérifier.
 */

/* Routes dispensées, chacune avec sa raison. Ajouter une entrée ici est un
   choix explicite, pas un contournement — et la raison est relue avec. */
const DISPENSES = {
  // Routes d'administration : un admin Actero agit par conception sur
  // n'importe quel client, et ces routes vérifient le rôle.
  'admin/entitlements.js': 'vérifie profiles.role === admin',
  'ambassador/admin/commissions.js': 'vérifie profiles.role === admin',
  'ambassador/admin/leads.js': 'vérifie profiles.role === admin',
  'deploy/full-pipeline.js': 'vérifie profiles.role === admin',
  'deploy/resend-dns-instructions.js': 'vérifie profiles.role === admin',

  // Appels internes uniquement : authentifiés par secret partagé, sans session
  // utilisateur. Il n'y a donc pas d'appelant dont vérifier l'appartenance.
  'engine/backtest-classify.js': 'secret partagé, appel interne',
  'engine/setup-email-polling.js': 'secret partagé, appel interne',
  'knowledge/crawl-site.js': 'secret partagé, appel interne',
  'notifications/escalation-alert.js': 'secret partagé, appel interne',
  'vision/analyze.js': 'secret partagé, appel interne',
}

/* Identifiants qui désignent une ressource appartenant à un tenant. La
   première version ne couvrait que `client_id` — elle aurait donc manqué
   `api/integrations/test.js`, qui prend un `integration_id` et déchiffrait les
   credentials du marchand correspondant. Ajouter un identifiant ici est le
   moyen d'étendre la garde. */
const IDENTIFIANTS_DE_TENANT = ['client_id', 'integration_id']

const MOTIF_ID_DU_CORPS = new RegExp(
  `^\\s*(?:const|let|var)\\s*\\{[^}]*\\b(?:${IDENTIFIANTS_DE_TENANT.join('|')})\\b[^}]*\\}` +
  `\\s*=\\s*(?:req\\.body|await req\\.json\\(\\))`,
  'm',
)

/** Une protection reconnue : appartenance, rôle admin, ou secret partagé requis. */
const PROTECTIONS = [
  /requireClientAccess|userCanAccessClient/,   // le garde-fou partagé
  /client_users/,                              // vérification manuelle d'appartenance
  /owner_user_id/,
  /isActeroAdmin|profile\?\.role\s*!==\s*'admin'|role\s*===\s*'admin'/,
]

function fichiersJs(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) fichiersJs(full, acc)
    else if (e.endsWith('.js') && !e.endsWith('.test.js')) acc.push(full)
  }
  return acc
}

describe('ACT-24 — aucune route ne fait confiance au client_id de l’appelant', () => {
  it('toute route qui lit un identifiant de tenant dans le corps vérifie l’appartenance', () => {
    const coupables = []

    for (const fichier of fichiersJs('api')) {
      const source = readFileSync(fichier, 'utf8')
      if (!MOTIF_ID_DU_CORPS.test(source)) continue

      const relatif = fichier.replace(/^api\//, '')
      if (relatif in DISPENSES) continue
      if (PROTECTIONS.some((re) => re.test(source))) continue

      coupables.push(relatif)
    }

    expect(
      coupables,
      'Ces routes prennent un client_id de l’appelant sans vérifier qu’il lui ' +
      'appartient. Elles tournent en service_role, donc RLS ne filtre rien.\n' +
      'Corrigez avec requireClientAccess (api/lib/tenant-guard.js), ou ajoutez ' +
      'une dispense motivée dans ce fichier si la route est réellement ' +
      'interne :\n  ' + coupables.join('\n  '),
    ).toEqual([])
  })

  it('chaque dispense pointe une route qui existe encore', () => {
    // Une dispense orpheline est une raison que plus personne ne relit.
    const existantes = new Set(fichiersJs('api').map((f) => f.replace(/^api\//, '')))
    const orphelines = Object.keys(DISPENSES).filter((r) => !existantes.has(r))
    expect(orphelines, 'dispenses à supprimer, ces routes n’existent plus').toEqual([])
  })

  it('chaque dispense porte une raison lisible', () => {
    const sansRaison = Object.entries(DISPENSES)
      .filter(([, raison]) => !raison || raison.trim().length < 10)
      .map(([r]) => r)
    expect(sansRaison, 'une dispense sans raison est un contournement').toEqual([])
  })
})

describe('ACT-24 — les fonctions Postgres non plus', () => {
  it('toute fonction SECURITY DEFINER prenant un p_client_id consulte auth.uid()', () => {
    // C'est le défaut de recompute_client_metrics : SECURITY DEFINER, exécutable
    // par `authenticated`, un p_client_id en paramètre, et aucune trace
    // d'auth.uid() dans le corps.
    const coupables = []

    for (const fichier of fichiersJs('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
      const source = readFileSync(fichier, 'utf8')
      const blocs = source.split(/create\s+(?:or\s+replace\s+)?function/i).slice(1)
      for (const bloc of blocs) {
        const corps = bloc.slice(0, 8000)
        if (!/security\s+definer/i.test(corps)) continue
        if (!/p_client_id/i.test(corps)) continue
        // service_role uniquement : pas d'appelant utilisateur à vérifier.
        if (/to\s+service_role/i.test(corps) && !/to\s+authenticated/i.test(corps)) continue
        if (/auth\.uid\(\)/.test(corps)) continue
        const nom = corps.match(/^\s*(?:public\.)?(\w+)/)?.[1] || '?'
        coupables.push(`${fichier.split('/').pop()} → ${nom}`)
      }
    }

    expect(
      coupables,
      'Ces fonctions sont SECURITY DEFINER, prennent un p_client_id, sont ' +
      'exécutables par un utilisateur connecté, et ne consultent jamais ' +
      'auth.uid() :\n  ' + coupables.join('\n  '),
    ).toEqual([])
  })
})
