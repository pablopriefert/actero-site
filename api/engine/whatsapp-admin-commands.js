/**
 * WhatsApp admin commands — let owners manage KB, settings, and escalations
 * directly via WhatsApp messages from a whitelisted phone number.
 *
 * Supported commands (prefix: /):
 *   /help                            — Liste des commandes
 *   /kb add <question> | <réponse>   — Ajoute une entrée dans la base de connaissances
 *   /kb list [n]                     — Liste les n dernières entrées (max 10)
 *   /kb delete <id>                  — Supprime une entrée (id = 4 premiers chars)
 *   /tone <texte>                    — Met à jour le ton de marque
 *   /pause                           — Désactive l'agent WhatsApp
 *   /resume                          — Réactive l'agent WhatsApp
 *   /stats                           — Aperçu du mois en cours
 *
 * The sender must be listed in client_settings.whatsapp_admin_phones (jsonb array
 * of E.164 numbers, e.g. ['+33612345678']). Messages from other phones are ignored
 * and forwarded to the normal Brain flow.
 */

export async function tryHandleAdminCommand(supabase, { clientId, fromPhone, message, account }) {
  const text = (message || '').trim()
  if (!text.startsWith('/')) return null

  // Check admin phone whitelist
  const { data: settings } = await supabase
    .from('client_settings')
    .select('whatsapp_admin_phones, brand_tone, whatsapp_agent_enabled')
    .eq('client_id', clientId)
    .maybeSingle()

  const admins = Array.isArray(settings?.whatsapp_admin_phones) ? settings.whatsapp_admin_phones : []
  const normFrom = normalizePhone(fromPhone)
  const isAdmin = admins.some((p) => normalizePhone(p) === normFrom)
  if (!isAdmin) return null // Fall through to Brain

  const [cmd, ...rest] = text.slice(1).split(/\s+/)
  const args = rest.join(' ')

  try {
    switch (cmd.toLowerCase()) {
      case 'help':
        return helpReply()

      case 'kb': {
        const sub = rest[0]?.toLowerCase()
        if (sub === 'add') {
          return await kbAdd(supabase, clientId, rest.slice(1).join(' '))
        } else if (sub === 'list') {
          const n = Math.min(parseInt(rest[1] || '5', 10) || 5, 10)
          return await kbList(supabase, clientId, n)
        } else if (sub === 'delete' || sub === 'del' || sub === 'rm') {
          return await kbDelete(supabase, clientId, rest[1])
        }
        return {
          reply: 'Utilisation :\n• /kb add <question> | <réponse>\n• /kb list [n]\n• /kb delete <id>',
        }
      }

      case 'tone':
        if (!args) return { reply: 'Utilisation : /tone <description du ton de marque>' }
        await supabase.from('client_settings').update({ brand_tone: args }).eq('client_id', clientId)
        return { reply: `✅ Ton de marque mis à jour :\n"${args.slice(0, 200)}"` }

      case 'pause':
        await supabase.from('client_settings').update({ whatsapp_agent_enabled: false }).eq('client_id', clientId)
        return { reply: '⏸️ Agent WhatsApp désactivé. Envoyez /resume pour réactiver.' }

      case 'resume':
        await supabase.from('client_settings').update({ whatsapp_agent_enabled: true }).eq('client_id', clientId)
        return { reply: '▶️ Agent WhatsApp réactivé.' }

      case 'stats':
        return await stats(supabase, clientId)

      default:
        return { reply: `Commande inconnue : /${cmd}\n\nEnvoyez /help pour la liste.` }
    }
  } catch (err) {
    console.error('[wa-admin] error:', err.message)
    return { reply: `❌ Erreur : ${err.message}` }
  }
}

function normalizePhone(p) {
  if (!p) return ''
  // Strip whitespace, dashes, parens. Accept 00 prefix. Finally drop leading +
  // so we compare digits only (Meta sends "33788192308", whitelist may have "+33788192308").
  return String(p).replace(/\s|-|\(|\)/g, '').replace(/^00/, '+').replace(/^\+/, '')
}

function helpReply() {
  return {
    reply: [
      '🛠 *Commandes admin Actero*',
      '',
      '/kb add <question> | <réponse>',
      '   Ajoute une entrée dans la base',
      '',
      '/kb list [n]',
      '   Liste les n dernières (max 10)',
      '',
      '/kb delete <id>',
      '   Supprime une entrée',
      '',
      '/tone <texte>',
      '   Met à jour le ton de marque',
      '',
      '/pause — Coupe l\'agent WhatsApp',
      '/resume — Le réactive',
      '/stats — Aperçu du mois',
    ].join('\n'),
  }
}

async function kbAdd(supabase, clientId, rest) {
  if (!rest || !rest.includes('|')) {
    return { reply: 'Format : /kb add <question> | <réponse>\n\nExemple :\n/kb add Délais livraison | 3-5 jours ouvrés en France' }
  }
  const [question, ...answerParts] = rest.split('|')
  const answer = answerParts.join('|').trim()
  const title = question.trim()
  if (!title || !answer) return { reply: '❌ Question et réponse requises.' }

  const { data, error } = await supabase.from('client_knowledge_base').insert({
    client_id: clientId,
    title: title.slice(0, 200),
    content: answer.slice(0, 2000),
    category: 'faq',
    source: 'whatsapp',
    is_active: true,
  }).select('id').single()

  if (error) throw error
  return { reply: `✅ Ajouté à la base de connaissances :\n\n*Q :* ${title}\n*R :* ${answer}\n\nID: \`${data.id.slice(0, 4)}\`` }
}

async function kbList(supabase, clientId, n) {
  const { data } = await supabase
    .from('client_knowledge_base')
    .select('id, title, category, source, created_at')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(n)

  if (!data?.length) return { reply: 'Aucune entrée dans la base de connaissances.' }

  const lines = data.map((r, i) => `${i + 1}. \`${r.id.slice(0, 4)}\` ${r.title.slice(0, 60)}${r.title.length > 60 ? '…' : ''}`)
  return { reply: `📚 *${data.length} dernière${data.length > 1 ? 's' : ''} entrée${data.length > 1 ? 's' : ''}*\n\n${lines.join('\n')}\n\nSupprimez : /kb delete <id>` }
}

async function kbDelete(supabase, clientId, shortId) {
  if (!shortId || shortId.length < 3) return { reply: '❌ ID requis (3+ caractères). Voir /kb list' }

  const { data: matches } = await supabase
    .from('client_knowledge_base')
    .select('id, title')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .ilike('id', `${shortId}%`)
    .limit(2)

  if (!matches?.length) return { reply: `❌ Aucune entrée trouvée avec l'id "${shortId}".` }
  if (matches.length > 1) return { reply: `❌ Plusieurs entrées matchent "${shortId}". Donnez plus de caractères.` }

  await supabase.from('client_knowledge_base').update({ is_active: false }).eq('id', matches[0].id)
  return { reply: `🗑 Supprimé : "${matches[0].title.slice(0, 80)}"` }
}

async function stats(supabase, clientId) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [ticketsRes, runsRes] = await Promise.all([
    supabase.from('automation_events').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('created_at', startOfMonth.toISOString()),
    supabase.from('engine_runs_v2').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('created_at', startOfMonth.toISOString()),
  ])

  return {
    reply: [
      '📊 *Stats du mois*',
      '',
      `Tickets : ${ticketsRes.count || 0}`,
      `Engine runs : ${runsRes.count || 0}`,
      '',
      'Dashboard complet : https://actero.fr/client/overview',
    ].join('\n'),
  }
}
