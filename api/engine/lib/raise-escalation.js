/**
 * Escalade : ticket + alerte marchand + webhook sortant.
 *
 * Extrait de la branche `escalate` de l'exécuteur, parce que ce n'était pas le
 * seul chemin qui devait la déclencher.
 *
 * Le problème : `gateway.js` n'exécute le plan d'action que si
 * `brainResult.needsReview` est faux. Quand le moteur décide qu'un message
 * mérite un humain — client agressif, réponse tronquée, référence inventée — il
 * met `needsReview: true`, et **le plan d'action n'est jamais exécuté**. Donc
 * pas de ticket, pas d'alerte : le message atterrissait dans
 * `engine_reviews_v2`, une table que rien ne surveille et qui ne notifie
 * personne.
 *
 * Autrement dit, plus le message était grave, moins le marchand en était
 * averti. C'est la même famille de panne que les deux mois d'arrêt du moteur
 * passés inaperçus (ACT-21) : une file d'attente que personne ne regarde est
 * l'endroit où les tickets meurent.
 *
 * Tous les effets sont encapsulés et aucune erreur ne remonte : une escalade
 * qui échoue à notifier doit tout de même être enregistrée.
 */
export async function raiseEscalation(supabase, { clientId, classification, normalized, reason = null }) {
  const resultat = { ticket: false, notified: false, webhook: false }

  try {
    await supabase.from('escalation_tickets').insert({
      client_id: clientId,
      classification,
      customer_email: normalized?.customer_email || null,
      customer_name: normalized?.customer_name || null,
      message_preview: normalized?.message ? normalized.message.substring(0, 500) : null,
      status: 'pending',
      priority: 'high',
    })
    resultat.ticket = true
  } catch (err) {
    console.error('[escalation] insert escalation_tickets:', err.message)
  }

  try {
    const { notifyClient } = await import('../../lib/notify.js')
    await notifyClient(supabase, {
      clientId,
      eventKey: 'escalation_alert',
      title: `Ticket escaladé — ${classification}${reason ? ` (${reason})` : ''}`,
      message: `De : ${normalized?.customer_name || normalized?.customer_email}\n\n${normalized?.message?.substring(0, 300) || ''}`,
      context: {
        url: 'https://actero.fr/client/escalations',
        customer_email: normalized?.customer_email,
        classification,
        reason,
      },
    })
    resultat.notified = true
  } catch (err) {
    console.error('[escalation] notifyClient:', err.message)
  }

  try {
    const { dispatchWebhook } = await import('../../lib/webhooks.js')
    await dispatchWebhook(supabase, {
      clientId,
      eventType: 'ticket.escalated',
      data: {
        classification,
        reason,
        customer_email: normalized?.customer_email,
        customer_name: normalized?.customer_name,
        subject: normalized?.subject,
        message_preview: normalized?.message?.substring(0, 500),
      },
    })
    resultat.webhook = true
  } catch (err) {
    console.error('[escalation] dispatchWebhook:', err.message)
  }

  return resultat
}

/**
 * Une mise en revue mérite-t-elle d'alerter le marchand ?
 *
 * Oui pour les vrais signaux d'escalade. Non pour `low_confidence` seul : le
 * classifieur qui hésite est un cas de relecture, pas une alarme — sur le banc
 * du 9 septembre, six cas sur vingt étaient dans ce cas, et en faire six
 * notifications apprendrait au marchand à les ignorer.
 */
const RAISONS_ALARMANTES = new Set([
  'aggressive',
  'out_of_policy',
  'escalation_agent',
  'reponse_tronquee',
  'error',
])

export function reviewMeriteAlerte({ reviewReason, actionPlan }) {
  if (Array.isArray(actionPlan) && actionPlan.includes('escalate')) return true
  if (!reviewReason) return false
  if (RAISONS_ALARMANTES.has(reviewReason)) return true
  // Les raisons composées portent leur préfixe, ex. references_inventees:LX123…
  return reviewReason.startsWith('references_inventees')
}
