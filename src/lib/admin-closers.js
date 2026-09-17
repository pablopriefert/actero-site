import { supabase } from './supabase'

/**
 * La section « Closers » de l'admin lit et écrit par les routes serveur
 * (api/admin/closer*.js, requireAdmin), jamais par supabase.from() : les
 * tables du programme sont fermées au navigateur (principe du chantier C).
 */
export async function appelAdmin(chemin, { methode = 'GET', corps, query } = {}) {
  const { data } = await supabase.auth.getSession()
  const jeton = data?.session?.access_token
  const recherche = query ? `?${new URLSearchParams(query)}` : ''
  const res = await fetch(`/api/admin/${chemin}${recherche}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  })
  const donnees = await res.json().catch(() => null)
  if (!res.ok || donnees === null) {
    const erreur = new Error(donnees?.message || donnees?.error || `Erreur ${res.status}`)
    erreur.status = res.ok ? 502 : res.status
    erreur.code = donnees?.error
    throw erreur
  }
  return donnees
}
