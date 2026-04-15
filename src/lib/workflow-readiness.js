/**
 * Build the readiness checks for a given playbook before activation.
 *
 * 6 checks:
 *   1. Source connectée (e-commerce platform: Shopify/WooCommerce/Webflow)
 *   2. Données suffisantes (at least 1 order if Shopify, or skip for manual)
 *   3. Politique définie (brand_tone set)
 *   4. Canal actif (at least one channel selected in custom_config)
 *   5. Template de réponse prêt (at least 1 response_template or knowledge entry)
 *   6. Fallback humain activé (escalation_enabled or team member configured)
 *
 * Each check has: id, label, description, met (bool), fixTab (tab to navigate to), fixLabel
 */

import { supabase } from './supabase.js'

const ECOMMERCE_PROVIDERS = ['shopify', 'woocommerce', 'webflow']

export async function buildReadinessChecks({ clientId, playbookName, custom_config }) {
  // Parallel-fetch all needed data
  const [
    shopifyRes,
    integrationsRes,
    settingsRes,
    templatesRes,
    knowledgeRes,
    teamRes,
  ] = await Promise.all([
    supabase.from('client_shopify_connections').select('id').eq('client_id', clientId).maybeSingle(),
    supabase.from('client_integrations').select('provider, status').eq('client_id', clientId).eq('status', 'active'),
    supabase.from('client_settings').select('brand_tone, hourly_cost').eq('client_id', clientId).maybeSingle(),
    supabase.from('client_response_templates').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('client_knowledge_base').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('client_users').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ])

  const hasShopify = !!shopifyRes.data
  const integrations = integrationsRes.data || []
  const ecommerceConnected = hasShopify || integrations.some(i => ECOMMERCE_PROVIDERS.includes(i.provider))
  const emailConnected = integrations.some(i => ['smtp_imap', 'resend'].includes(i.provider))
  const settings = settingsRes.data
  const templateCount = templatesRes.count || 0
  const knowledgeCount = knowledgeRes.count || 0
  const teamCount = teamRes.count || 0

  // Parse channels from custom_config (can be object {email:true} or array)
  const rawChannels = custom_config?.channels || {}
  const channelsArray = Array.isArray(rawChannels)
    ? rawChannels
    : Object.entries(rawChannels).filter(([, v]) => v).map(([k]) => k)
  const hasActiveChannel = channelsArray.length > 0

  // Build checks based on playbook type
  const checks = []

  // 1. Source connectée (e-commerce platform)
  // For comptabilite_auto, require accounting tool instead
  if (playbookName === 'comptabilite_auto') {
    const accountingConnected = integrations.some(i => ['axonaut', 'pennylane', 'ipaidthat'].includes(i.provider))
    checks.push({
      id: 'source',
      label: 'Outil de comptabilité connecté',
      description: accountingConnected
        ? 'Votre outil de comptabilité est bien connecté.'
        : 'Connectez Axonaut, Pennylane ou iPaidThat pour activer les relances automatiques.',
      met: accountingConnected,
      fixTab: 'integrations',
      fixLabel: 'Connecter',
    })
  } else {
    checks.push({
      id: 'source',
      label: 'Plateforme e-commerce connectée',
      description: ecommerceConnected
        ? 'Shopify, WooCommerce ou Webflow est connecté.'
        : 'Connectez votre boutique (Shopify, WooCommerce ou Webflow) pour que l\'IA accède aux commandes.',
      met: ecommerceConnected,
      fixTab: 'integrations',
      fixLabel: 'Connecter',
    })
  }

  // 2. Canal d'envoi (email pour la plupart, téléphone pour agent_vocal)
  if (playbookName === 'agent_vocal') {
    // Agent vocal has its own wizard, skip email check
    checks.push({
      id: 'channel_source',
      label: 'Canal téléphonique configuré',
      description: 'L\'assistant vocal se configure via le wizard dédié.',
      met: true,
    })
  } else {
    checks.push({
      id: 'email',
      label: 'Email d\'envoi configuré',
      description: emailConnected
        ? 'Votre service d\'envoi d\'emails est prêt.'
        : 'Connectez Resend ou votre SMTP personnalisé pour que l\'IA puisse répondre.',
      met: emailConnected,
      fixTab: 'integrations',
      fixLabel: 'Configurer',
    })
  }

  // 3. Politique définie (brand tone)
  const toneDefined = !!(settings?.brand_tone && settings.brand_tone.trim().length >= 20)
  checks.push({
    id: 'policy',
    label: 'Ton de marque défini',
    description: toneDefined
      ? 'Votre ton de marque est configuré.'
      : 'Définissez au moins 20 caractères décrivant comment votre agent doit parler (chaleureux, professionnel, etc.).',
    met: toneDefined,
    fixTab: 'agent-config',
    fixLabel: 'Définir',
  })

  // 4. Canal actif (au moins un canal sélectionné pour le playbook)
  // Note: for first-time activation custom_config is empty, we allow this and activate defaults server-side
  // But we show this as a check if custom_config exists and has channels key
  checks.push({
    id: 'channel',
    label: 'Canal de diffusion actif',
    description: hasActiveChannel
      ? `${channelsArray.length} canal${channelsArray.length > 1 ? 'aux' : ''} actif${channelsArray.length > 1 ? 's' : ''}.`
      : 'Par défaut : email. Vous pourrez ajouter d\'autres canaux (Slack) après activation.',
    met: true, // always met (defaults applied on activation)
  })

  // 5. Template de réponse / base de connaissances
  const hasContent = templateCount + knowledgeCount >= 3
  checks.push({
    id: 'templates',
    label: 'Base de connaissances',
    description: hasContent
      ? `${knowledgeCount} entrée${knowledgeCount > 1 ? 's' : ''} + ${templateCount} template${templateCount > 1 ? 's' : ''} prêt${templateCount + knowledgeCount > 1 ? 's' : ''}.`
      : 'Ajoutez au moins 3 entrées dans la base de connaissances (FAQ, politiques retour, etc.) pour que l\'IA réponde correctement.',
    met: hasContent,
    fixTab: 'knowledge',
    fixLabel: 'Ajouter',
  })

  // 6. Fallback humain (au moins un membre d'équipe pour gérer les escalades)
  const fallbackReady = teamCount >= 1
  checks.push({
    id: 'fallback',
    label: 'Fallback humain disponible',
    description: fallbackReady
      ? `${teamCount} membre${teamCount > 1 ? 's' : ''} d'équipe peuvent recevoir les escalades.`
      : 'Ajoutez au moins un membre d\'équipe pour recevoir les cas complexes que l\'IA ne peut pas résoudre.',
    met: fallbackReady,
    fixTab: 'team',
    fixLabel: 'Équipe',
  })

  return checks
}
