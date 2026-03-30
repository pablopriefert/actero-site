import React from 'react'
import { motion } from 'framer-motion'

const INTEGRATIONS = {
  ecommerce: [
    { name: "Shopify", icon: "shopify", color: "95BF47", desc: "Commandes & clients en temps réel" },
    { name: "Stripe", icon: "stripe", color: "635BFF", desc: "Paiements et anomalies de facturation" },
    { name: "Klaviyo", src: "/klaviyo.svg", desc: "Séquences email et SMS personnalisées" },
    { name: "Gorgias", icon: "gorgias", color: "EA580C", desc: "Tickets support automatisés" },
    { name: "HubSpot", icon: "hubspot", color: "FF7A59", desc: "Synchronisation CRM et scoring clients" },
    { name: "Slack", src: "/slack.svg", desc: "Alertes temps réel dans vos channels" },
    { name: "n8n", icon: "n8n", color: "FF6D5A", desc: "Orchestration des workflows" },
    { name: "OpenAI", src: "/openai.svg", desc: "Moteur LLM pour les réponses IA" },
    { name: "Zendesk", icon: "zendesk", color: "03363D", desc: "Escalade intelligente des tickets" },
    { name: "Make", icon: "make", color: "5F4CFF", desc: "Connecteur universel" },
    { name: "Intercom", icon: "intercom", color: "0058DD", desc: "Chat en direct augmenté IA" },
    { name: "WhatsApp", icon: "whatsapp", color: "25D366", desc: "Alertes et relances WhatsApp" },
  ],
  immobilier: [
    { name: "n8n", icon: "n8n", color: "FF6D5A", desc: "Orchestration des workflows IA" },
    { name: "OpenAI", src: "/openai.svg", desc: "Qualification intelligente des leads" },
    { name: "HubSpot", icon: "hubspot", color: "FF7A59", desc: "CRM et suivi prospects" },
    { name: "Google Calendar", icon: "googlecalendar", color: "4285F4", desc: "Prise de RDV automatique" },
    { name: "Twilio", icon: "twilio", color: "F22F46", desc: "SMS de relance et confirmation" },
    { name: "WhatsApp", icon: "whatsapp", color: "25D366", desc: "Alertes leads chauds en direct" },
    { name: "Gmail", icon: "gmail", color: "EA4335", desc: "Emails de relance personnalisés" },
    { name: "Slack", src: "/slack.svg", desc: "Alertes temps réel sur les leads" },
    { name: "Stripe", icon: "stripe", color: "635BFF", desc: "Facturation honoraires automatisée" },
    { name: "Make", icon: "make", color: "5F4CFF", desc: "Connecteur universel pour vos outils" },
    { name: "Notion", icon: "notion", color: "ffffff", desc: "Base de connaissances clients" },
    { name: "Zapier", icon: "zapier", color: "FF4A00", desc: "Automatisations supplémentaires" },
  ],
}

export const IntegrationGrid = ({ vertical }) => {
  const integrations = INTEGRATIONS[vertical] || INTEGRATIONS.ecommerce

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
      {integrations.map((integ, i) => (
        <motion.div
          key={`${vertical}-${integ.name}`}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
          whileHover={{ y: -3 }}
          className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 cursor-default transition-all duration-300 group hover:border-gray-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 group-hover:border-gray-300 transition-colors">
              <img
                src={integ.src
                  ? integ.src
                  : `https://cdn.simpleicons.org/${integ.icon}/${integ.color}`}
                alt={integ.name}
                className="w-5 h-5 object-contain"
                loading="lazy"
              />
            </div>
            <span className="font-bold text-gray-900 text-sm leading-tight">{integ.name}</span>
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            {integ.desc}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
