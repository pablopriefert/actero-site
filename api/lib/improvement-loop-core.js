import { createHash } from 'crypto'

/**
 * Pure helpers for the improvement loop (self-improving agent). No I/O — these
 * are unit-tested in improvement-loop-core.test.js. The cron orchestration and
 * the LLM call live in api/cron/improvement-loop.js and stay thin.
 */

/** Stable, case/space-insensitive hash of a theme — used to dedupe recommendations. */
export function computeFingerprint(theme) {
  const norm = String(theme || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(norm).digest('hex').slice(0, 16)
}

/** Build the miner's system prompt from the unresolved cases + the current KB. */
export function buildMinerPrompt({ cases = [], existingTitles = [] } = {}) {
  const casesBlock = cases
    .map((c, i) => `${i + 1}. Question client : ${c.question || '(vide)'}${c.humanReply ? `\n   Réponse donnée par le marchand : ${c.humanReply}` : ''}`)
    .join('\n')
  const kbBlock = existingTitles.length
    ? existingTitles.map((t) => `- ${t}`).join('\n')
    : '(base de connaissances vide)'

  return `Tu es un analyste qui améliore un agent IA de support client e-commerce.

Voici des demandes clients que l'agent n'a PAS su résoudre seul (escalades, faible confiance, ou notées négativement) sur les 30 derniers jours :
${casesBlock}

Voici les titres DÉJÀ présents dans la base de connaissances du marchand — n'invente rien qui existe déjà :
${kbBlock}

Regroupe ces demandes par THÈME récurrent. Pour chaque thème qui revient au moins 3 fois ET qui n'est pas déjà couvert par la base, rédige une entrée de base de connaissances prête à l'emploi qui aurait permis à l'agent de répondre seul. Appuie-toi sur les réponses du marchand quand elles existent. Contenu factuel, concis, en français, sans markdown.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "suggestions": [
    {
      "theme": "libellé court du thème",
      "kb_title": "titre de l'entrée",
      "kb_content": "contenu de la réponse",
      "occurrences": nombre entier,
      "evidence_conversation_ids": ["id1", "id2"],
      "estimated_time_gain_minutes": nombre entier
    }
  ]
}
Si rien ne mérite une entrée, renvoie {"suggestions": []}.`
}

/** Parse the miner's JSON output into validated suggestion objects. Robust to fences/prose. */
export function parseSuggestions(rawText) {
  if (!rawText) return []
  let obj = null
  try {
    obj = JSON.parse(rawText)
  } catch {
    const fence = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    const candidate = fence ? fence[1] : (rawText.match(/\{[\s\S]*\}/) || [null])[0]
    if (candidate) {
      try { obj = JSON.parse(candidate) } catch { obj = null }
    }
  }
  const list = Array.isArray(obj?.suggestions) ? obj.suggestions : []
  return list
    .filter((s) => s && typeof s.kb_title === 'string' && s.kb_title.trim() && typeof s.kb_content === 'string' && s.kb_content.trim())
    .map((s) => ({
      theme: String(s.theme || s.kb_title).trim(),
      kb_title: s.kb_title.trim(),
      kb_content: s.kb_content.trim(),
      occurrences: Number(s.occurrences) || 0,
      evidence_conversation_ids: Array.isArray(s.evidence_conversation_ids) ? s.evidence_conversation_ids.slice(0, 20) : [],
      estimated_time_gain_minutes: Number(s.estimated_time_gain_minutes) || 0,
    }))
}
