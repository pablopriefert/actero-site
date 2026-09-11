import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLANS } from '../../src/lib/plans.js'
import { PLAN_LIMITS } from './plan-limits.js'

/**
 * ACT-36 — la rétention d'historique est appliquée, et le reste.
 *
 * `limits.history_days` existait depuis toujours dans les deux fichiers de
 * plans, et **n'était lu que pour être affiché** sur la page tarifs. Aucune
 * route, aucun cron, aucun composant ne s'en servait : un compte gratuit
 * gardait son historique aussi longtemps qu'un compte Pro.
 *
 * La limite vit maintenant dans une politique RLS, parce que le tableau de
 * bord interroge Supabase directement depuis le navigateur : un filtre posé
 * dans un composant ne serait pas une limite, seulement une politesse.
 *
 * Le risque qui reste est la dérive entre trois fichiers — deux en JavaScript,
 * un en SQL — qui doivent dire la même chose.
 */

const SQL = readFileSync('supabase/migrations/20260910130000_act36_retention_historique.sql', 'utf8')

// Ce que la fonction SQL accorde, plan par plan. `null` = illimité.
function joursSelonSql(plan) {
  const corps = SQL.match(/create or replace function public\.retention_limite[\s\S]*?\$\$;/)?.[0] || ''
  if (new RegExp(`in \\('pro', 'enterprise'\\)[\\s\\S]*?then null`).test(corps) && ['pro', 'enterprise'].includes(plan)) {
    return null
  }
  const m = corps.match(new RegExp(`= '${plan}' then now\\(\\) - interval '(\\d+) days'`))
  if (m) return Number(m[1])
  // Le `else` final couvre free et tout plan inconnu.
  const defaut = corps.match(/else now\(\) - interval '(\d+) days'/)
  return defaut ? Number(defaut[1]) : undefined
}

describe('rétention d\'historique', () => {
  it('le SQL accorde exactement ce que la page tarifs annonce', () => {
    // La page tarifs lit `limits.history_days`. Si quelqu'un y écrit 30 jours
    // sans toucher au SQL, le marchand paierait pour une fenêtre qu'il n'a
    // pas — l'inverse exact du défaut qu'on vient de corriger.
    const ecarts = []
    for (const plan of ['free', 'starter', 'pro', 'enterprise']) {
      const annonce = PLANS[plan].limits.history_days
      const applique = joursSelonSql(plan)
      const attendu = annonce === Infinity ? null : annonce
      if (applique !== attendu) {
        ecarts.push(`${plan} : la page annonce ${annonce}, le SQL applique ${applique === null ? 'illimité' : applique + ' jours'}`)
      }
    }
    expect(ecarts, `Rétention annoncée ≠ rétention appliquée :\n${ecarts.join('\n')}`).toEqual([])
  })

  it('les deux fichiers de plans annoncent la même rétention', () => {
    for (const plan of ['free', 'starter', 'pro', 'enterprise']) {
      expect(PLAN_LIMITS[plan].history_days, `history_days divergent sur ${plan}`)
        .toBe(PLANS[plan].limits.history_days)
    }
  })

  it('la limite est appliquée sur les DEUX tables que le marchand consulte', () => {
    // Le piège : l'onglet « Activité » lit automation_events, pas
    // ai_conversations. Limiter la seconde sans la première aurait laissé
    // l'historique entièrement visible là où il est réellement consulté.
    for (const table of ['ai_conversations', 'automation_events']) {
      expect(SQL, `aucune politique de rétention sur ${table}`).toMatch(new RegExp(`on public\\.${table}`))
    }
  })

  it('les DEUX politiques marchandes du fil d\'activité sont resserrées', () => {
    // PostgreSQL combine les politiques permissives par OU : n'en resserrer
    // qu'une laisserait l'autre tout ouvrir. C'est le piège du fournisseur de
    // webhooks, qui avait deux blocs d'écriture et dont un seul avait été
    // migré — sauf qu'ici, l'oubli ne se verrait jamais : la limite aurait
    // simplement l'air de ne pas marcher.
    for (const politique of ['ae_select_client', 'ae_select_member']) {
      const bloc = SQL.match(new RegExp(`create policy "${politique}"[\\s\\S]*?\\);`))?.[0]
      expect(bloc, `politique ${politique} absente de la migration`).toBeTruthy()
      expect(bloc, `${politique} ne vérifie pas la rétention`).toMatch(/retention_limite\(client_id\)/)
    }
  })

  it('rien n\'est effacé : la limite masque, elle ne détruit pas', () => {
    // Une limite qui supprime la donnée détruit aussi l'argument de vente :
    // le marchand qui monte en gamme doit retrouver son historique entier.
    const corps = SQL.replace(/^\s*--.*$/gm, '')
    expect(corps, 'la migration supprime des lignes').not.toMatch(/\bdelete\s+from\b/i)
    expect(corps, 'la migration tronque une table').not.toMatch(/\btruncate\b/i)
  })

  it('le compteur renvoie des nombres, jamais du contenu', () => {
    // `historique_masque` est `security definer` : elle contourne RLS. Si elle
    // renvoyait des lignes, elle rendrait précisément ce que la limite cache.
    const fn = SQL.match(/create or replace function public\.historique_masque[\s\S]*?\$\$;/)?.[0] || ''
    expect(fn, 'historique_masque introuvable').toBeTruthy()
    expect(fn, 'elle doit renvoyer un objet de compteurs').toMatch(/returns jsonb/)
    expect(fn, 'elle doit refaire le contrôle d\'appartenance, RLS étant contournée')
      .toMatch(/owner_user_id = auth\.uid\(\)/)
    expect(fn, 'elle doit refuser un client qui n\'est pas le sien').toMatch(/insufficient_privilege/)
  })
})
