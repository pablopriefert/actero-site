import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

/**
 * La migration du programme closers, relue avant d'être appliquée.
 *
 * Ce que ces tests protègent :
 *   - les commissions et les IBAN ne se lisent jamais depuis le navigateur
 *     (RLS sans politique, droits retirés) ;
 *   - l'unicité qui empêche une commission en double est portée par la base ;
 *   - un IBAN en clair ne peut pas être écrit, quelle que soit la route ;
 *   - le trigger de facturation (ACT-49) refuse désormais une boutique créée
 *     depuis le navigateur déjà rattachée à un closer, SANS perdre une seule
 *     des protections de sa version précédente.
 *
 * On lit le SQL sans ses commentaires : une phrase ne protège rien.
 */

const DOSSIER = 'supabase/migrations'
const FICHIERS = readdirSync(DOSSIER).filter((f) => f.endsWith('_programme_closers.sql'))
const SQL = FICHIERS.length === 1 ? readFileSync(`${DOSSIER}/${FICHIERS[0]}`, 'utf8') : ''
const AVANT = readFileSync(`${DOSSIER}/20260915180215_securite_role_et_facturation.sql`, 'utf8')

const sansCommentaires = (sql) => sql.replace(/--.*$/gm, '')
const CODE = sansCommentaires(SQL)

function corpsDeTable(nom) {
  return CODE.match(new RegExp(`create table if not exists public\\.${nom} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ''
}

/** Les colonnes que la branche INSERT du trigger refuse depuis le navigateur. */
function colonnesRefuseesALInsertion(sql) {
  const fonction = sansCommentaires(sql).match(/create or replace function public\.clients_facturation_cote_serveur\(\)[\s\S]*?\$\$;/)?.[0] ?? ''
  const bloc = fonction.match(/if new\.plan is distinct from 'free'([\s\S]*?)\bthen\b/)?.[0] ?? ''
  return new Set([...bloc.matchAll(/new\.(\w+)/g)].map((m) => m[1]))
}

describe('migration programme closers — la forme', () => {
  it('un seul fichier *_programme_closers.sql', () => {
    expect(FICHIERS).toHaveLength(1)
  })

  it('additive : aucune ligne existante modifiée ou supprimée, aucune table retirée', () => {
    expect(CODE).not.toMatch(/\bupdate\s+public\./i)
    expect(CODE).not.toMatch(/\bdelete\s+from\b/i)
    expect(CODE).not.toMatch(/\bdrop\s+(table|column)\b/i)
  })
})

describe('migration programme closers — personne ne lit ces tables depuis le navigateur', () => {
  it.each(['closers', 'closer_commissions'])('%s : RLS activée, droits d’anon et d’authenticated retirés', (table) => {
    expect(corpsDeTable(table), `table ${table} absente`).not.toBe('')
    expect(CODE).toMatch(new RegExp(`alter table public\\.${table} enable row level security;`))
    expect(CODE).toMatch(new RegExp(`revoke all on public\\.${table} from anon, authenticated;`))
  })

  it('aucune politique : une politique mal écrite exposerait les commissions d’un autre', () => {
    expect(CODE).not.toMatch(/create\s+policy/i)
    expect(CODE).not.toMatch(/\bgrant\b/i)
  })
})

describe('migration programme closers — les contraintes qui portent les règles', () => {
  it('le code closer est unique et au format ACT-XXXXX', () => {
    expect(corpsDeTable('closers')).toMatch(/\bcode\s+text not null unique check \(code ~ '\^ACT-\[A-Z0-9\]\{5\}\$'\)/)
  })

  it('un compte n’a qu’une fiche', () => {
    expect(corpsDeTable('closers')).toMatch(/\buser_id\s+uuid not null unique references auth\.users/)
  })

  it('un closer est actif ou suspendu', () => {
    expect(corpsDeTable('closers')).toMatch(/statut\s+text not null default 'actif' check \(statut in \('actif', 'suspendu'\)\)/)
  })

  it('l’IBAN ne peut pas être écrit en clair', () => {
    expect(corpsDeTable('closers')).toMatch(/iban_chiffre\s+text check \(iban_chiffre is null or iban_chiffre like 'enc:v1:%'\)/)
    expect(corpsDeTable('closers')).not.toMatch(/^\s*iban\s/m)
  })

  it('source_key est unique : une facture rejouée ne crée qu’une commission', () => {
    expect(corpsDeTable('closer_commissions')).toMatch(/source_key\s+text not null unique/)
  })

  it('montant_centimes est strictement positif', () => {
    expect(corpsDeTable('closer_commissions')).toMatch(/montant_centimes\s+integer not null check \(montant_centimes > 0\)/)
  })

  it('les statuts sont ceux de la spec', () => {
    const bloc = corpsDeTable('closer_commissions').match(/check \(statut in \(([^)]*)\)\)/)?.[1] ?? ''
    expect([...bloc.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual(['a_valider', 'validee', 'payee', 'refusee', 'annulee'])
  })

  it('une commission survit à l’effacement du client (ACT-25) et ne le bloque pas', () => {
    const corps = corpsDeTable('closer_commissions')
    expect(corps).toMatch(/^\s*client_id\s+uuid references public\.clients \(id\) on delete set null,/m)
    expect(corps).not.toMatch(/client_id\s+uuid not null/)
  })

  it('les trois colonnes de clients : closer, date, source lien ou manuel', () => {
    expect(CODE).toMatch(/add column if not exists closer_id uuid references public\.closers \(id\) on delete set null/)
    expect(CODE).toMatch(/add column if not exists closer_attribue_at timestamptz/)
    expect(CODE).toMatch(/add column if not exists closer_source text check \(closer_source is null or closer_source in \('lien', 'manuel'\)\)/)
  })

  it('chaque clé étrangère a son index', () => {
    const cles = [
      ...['closers', 'closer_commissions'].flatMap((table) => [...corpsDeTable(table).matchAll(/^\s*(\w+)\s+uuid\b[^\n]*\breferences\b/gm)].map((m) => [table, m[1]])),
      ...[...CODE.matchAll(/add column if not exists (\w+) uuid references/g)].map((m) => ['clients', m[1]]),
    ]
    expect(cles).toEqual(expect.arrayContaining([
      ['closers', 'user_id'], ['clients', 'closer_id'],
      ['closer_commissions', 'closer_id'], ['closer_commissions', 'client_id'], ['closer_commissions', 'validee_par'],
    ]))
    for (const [table, colonne] of cles) {
      if (table === 'closers' && colonne === 'user_id') continue // `unique` crée l'index
      expect(CODE, `pas d'index sur ${table}.${colonne}`).toMatch(new RegExp(`on public\\.${table} \\(${colonne}\\)`))
    }
  })
})

describe('migration programme closers — le trigger de facturation', () => {
  it('garde chacune des protections de sa version précédente', () => {
    const avant = colonnesRefuseesALInsertion(AVANT)
    const apres = colonnesRefuseesALInsertion(SQL)
    expect(avant.size, 'version précédente illisible').toBeGreaterThan(15)
    const perdues = [...avant].filter((c) => !apres.has(c))
    expect(perdues, `protections perdues : ${perdues.join(', ')}`).toEqual([])
  })

  it('refuse une boutique créée depuis le navigateur avec une colonne closer renseignée', () => {
    const apres = colonnesRefuseesALInsertion(SQL)
    for (const colonne of ['closer_id', 'closer_attribue_at', 'closer_source']) {
      expect(apres.has(colonne), colonne).toBe(true)
    }
    for (const colonne of ['closer_id', 'closer_attribue_at', 'closer_source']) {
      expect(CODE).toMatch(new RegExp(`or new\\.${colonne} is not null`))
    }
  })

  it('en modification, la liste blanche reste nom de boutique et e-mail de contact', () => {
    expect(CODE).toMatch(/modifiables constant text\[\] := array\['brand_name', 'contact_email'\];/)
    expect(CODE).toMatch(/if current_user not in \('anon', 'authenticated'\) or public\.is_admin\(\) then/)
    expect(CODE).toMatch(/set search_path = ''/)
  })
})
