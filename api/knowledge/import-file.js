/**
 * Knowledge Base — File Import
 * Accepts text/PDF content and uses Claude to extract knowledge base entries.
 *
 * Note: For PDF parsing, the client sends the extracted text (via browser FileReader).
 * Complex PDF parsing would require a library like pdf-parse.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Increase body size limit for file uploads
export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  const { content, filename, client_id } = req.body
  if (!content) return res.status(400).json({ error: 'content requis (texte du fichier)' })
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  if (content.length > 50000) {
    return res.status(400).json({ error: 'Fichier trop volumineux (max ~50000 caracteres). Essayez un fichier plus court.' })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    // Use Claude to extract knowledge base entries from the file content
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: `Tu es un extracteur de contenu pour un agent de support client IA. A partir du contenu d'un fichier (PDF, TXT, document), genere des entrees pour une base de connaissances.

Genere entre 5 et 20 entrees selon la longueur du document, melange de:
- FAQ (question/reponse) — categorie "faq"
- Politiques (livraison, retour, remboursement, CGV) — categorie "policy"
- Informations produit/service — categorie "product"
- Informations temporaires (promotions, evenements) — categorie "temporary"

Chaque entree doit etre autonome et contenir assez de contexte pour qu'un agent IA puisse repondre a un client.

Reponds UNIQUEMENT en JSON valide:
[
  {"category": "faq|policy|product|temporary", "title": "titre ou question", "content": "contenu detaille"}
]`,
        messages: [{ role: 'user', content: `Fichier: ${filename || 'document.txt'}\n\nContenu:\n${content.substring(0, 8000)}` }],
      }),
    })

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`)
    const claudeData = await claudeRes.json()
    let rawText = claudeData?.content?.[0]?.text || '[]'

    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (jsonMatch) rawText = jsonMatch[0]

    let entries
    try {
      entries = JSON.parse(rawText)
    } catch {
      try {
        entries = JSON.parse(rawText.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'))
      } catch {
        return res.status(500).json({ error: 'Erreur parsing des resultats. Essayez un autre fichier.' })
      }
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Aucune entree extraite du fichier' })
    }

    // Insert entries
    const toInsert = entries.map((entry, i) => ({
      client_id,
      category: entry.category || 'faq',
      title: entry.title,
      content: entry.content,
      sort_order: i,
      is_active: true,
    }))

    const { error: insertError } = await supabase
      .from('client_knowledge_base')
      .insert(toInsert)

    if (insertError) throw new Error(insertError.message)

    // Sync brand context
    try {
      await fetch(`${req.headers.origin || 'https://actero.fr'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id }),
      })
    } catch {}

    return res.status(200).json({
      imported: entries.length,
      entries: entries.map(e => ({ category: e.category, title: e.title })),
      filename,
    })
  } catch (err) {
    console.error('[knowledge/import-file] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
