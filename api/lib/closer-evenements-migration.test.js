import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { TYPES_EVENEMENT } from './familles-evenements.js'

/**
 * La migration du fil d'activité des closers, relue avant d'être appliquée.
 *
 * Ce que ces tests protègent :
 *   - le fil ne se lit jamais depuis le navigateur (RLS sans politique, droits
 *     retirés) ;
 *   - la base refuse un détail qui ne soit pas plan, formule, plateforme ou
 *     partiel : jamais un montant ni une adresse ;
 *   - les types de la base sont exactement ceux du code ;
 *   - les fonctions SECURITY DEFINER ne sont appelables par personne, et une
 *     panne du fil ne fait jamais échouer l'action du marchand.
 *
 * On lit le SQL sans ses commentaires : une phrase ne protège rien.
 */

const DOSSIER = 'supabase/migrations'
const FICHIERS = readdirSync(DOSSIER).filter((f) => f.endsWith('_closer_evenements.sql'))
const SQL = FICHIERS.length === 1 ? readFileSync(`${DOSSIER}/${FICHIERS[0]}`, 'utf8') : ''
const CODE = SQL.replace(/--.*$/gm, '')

const corpsDeTable = CODE.match(/create table if not exists public\.closer_evenements \(([\s\S]*?)\n\);/)?.[1] ?? ''
const fonctions = [...CODE.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\)\s*returns[\s\S]*?\$\$;/g)]

describe('migration du fil d’activité — la forme', () => {
  it('un seul fichier *_closer_evenements.sql', () => {
    expect(FICHIERS).toHaveLength(1)
  })

  it('attend un verrou 5 secondes au plus', () => {
    expect(CODE).toMatch(/^set lock_timeout = '5s';$/m)
    expect(CODE).toMatch(/^reset lock_timeout;\s*$/m)
  })
})

describe('migration du fil d’activité — la table', () => {
  it('RLS activée, aucune politique, aucun droit pour le navigateur', () => {
    expect(CODE).toMatch(/alter table public\.closer_evenements enable row level security;/)
    expect(CODE).toMatch(/revoke all on public\.closer_evenements from anon, authenticated;/)
    expect(CODE).not.toMatch(/create policy/i)
    expect(CODE).not.toMatch(/\bgrant\b/i)
  })

  it('les types de la base sont exactement ceux du code', () => {
    const bloc = corpsDeTable.match(/type\s+text not null check \(type in \(([\s\S]*?)\)\)/)?.[1] ?? ''
    expect([...bloc.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()).toEqual([...TYPES_EVENEMENT].sort())
  })

  it('un détail ne peut être que plan, formule, plateforme ou partiel', () => {
    expect(corpsDeTable).toMatch(/jsonb_typeof\(details\) = 'object'/)
    expect(corpsDeTable).toMatch(/\(details - array\['plan', 'formule', 'plateforme', 'partiel'\]\) = '\{\}'::jsonb/)
  })

  it('source_key est unique : un événement rejoué n’écrit qu’une ligne', () => {
    expect(corpsDeTable).toMatch(/source_key\s+text not null unique/)
  })

  it('le parcours d’un client disparaît avec lui, le fil d’un closer avec lui', () => {
    expect(corpsDeTable).toMatch(/closer_id\s+uuid not null references public\.closers \(id\) on delete cascade/)
    expect(corpsDeTable).toMatch(/client_id\s+uuid references public\.clients \(id\) on delete cascade/)
  })
})

describe('migration du fil d’activité — les fonctions et les déclencheurs', () => {
  it('cinq fonctions, toutes SECURITY DEFINER avec un search_path vide', () => {
    expect(fonctions.map((f) => f[1]).sort()).toEqual([
      'closer_evenement_agent_etat',
      'closer_evenement_boutique_integration',
      'closer_evenement_boutique_shopify',
      'closer_evenement_depuis_la_base',
      'closer_evenement_reponse_agent',
    ])
    for (const [texte] of fonctions) {
      expect(texte).toMatch(/security definer/)
      expect(texte).toMatch(/set search_path = ''/)
    }
  })

  it('aucune fonction n’est appelable par public, anon ou authenticated', () => {
    for (const [, nom, parametres] of fonctions) {
      const types = parametres.split(',').map((p) => p.trim().split(/\s+/).slice(1).join(' ')).filter(Boolean).join(', ')
      expect(CODE).toContain(`revoke all on function public.${nom}(${types}) from public, anon, authenticated;`)
    }
  })

  it('une panne du fil ne fait jamais échouer l’action du marchand', () => {
    const commune = fonctions.find((f) => f[1] === 'closer_evenement_depuis_la_base')?.[0] ?? ''
    expect(commune).toMatch(/exception when others then\s+raise warning/)
    expect(commune).toMatch(/on conflict \(source_key\) do nothing/)
    // Les déclencheurs passent tous par la fonction commune, jamais par un insert direct.
    for (const [texte, nom] of fonctions) {
      if (nom !== 'closer_evenement_depuis_la_base') expect(texte).not.toMatch(/insert into/)
    }
  })

  it.each([
    ['engine_responses', 'closer_evenement_reponse_agent', /after insert on public\.engine_responses/],
    ['client_shopify_connections', 'closer_evenement_boutique_shopify', /after insert or update of client_id on public\.client_shopify_connections/],
    ['client_integrations', 'closer_evenement_boutique_integration', /after insert or update of status on public\.client_integrations/],
    ['client_settings', 'closer_evenement_agent_etat', /after insert or update of agent_enabled on public\.client_settings/],
  ])('un déclencheur sur %s', (table, nom, moment) => {
    expect(CODE).toMatch(new RegExp(`create trigger ${nom}\\s+${moment.source}\\s+for each row execute function public\\.${nom}\\(\\);`))
    expect(CODE).toContain(`drop trigger if exists ${nom} on public.${table};`)
  })

  it('seule une réponse non escaladée compte comme première réponse', () => {
    const texte = fonctions.find((f) => f[1] === 'closer_evenement_reponse_agent')?.[0] ?? ''
    expect(texte).toMatch(/coalesce\(new\.was_escalated, false\) = false/)
  })
})
