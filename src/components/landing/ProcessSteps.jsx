import React from 'react'
import { motion } from 'framer-motion'
import { Activity, Zap, BarChart3, CheckCircle2, Calendar, FileText, UserCheck } from 'lucide-react'
import { FadeInUp } from '../ui/scroll-animations'

/* ── Mini UI Mockups ── */

const MockupAudit = ({ isImmo }) => (
  <div className="bg-[#F9F7F1] rounded-xl border border-gray-200 p-4 text-[11px] font-mono">
    <p className="text-[#716D5C] mb-3 uppercase tracking-widest text-[9px]">Connexion outils</p>
    <div className="space-y-2">
      {(isImmo ? [
        { name: 'HubSpot CRM', status: 'connected' },
        { name: 'Google Calendar', status: 'connected' },
        { name: 'Gmail', status: 'connected' },
        { name: 'Twilio SMS', status: 'pending' },
      ] : [
        { name: 'Shopify', status: 'connected' },
        { name: 'Gorgias', status: 'connected' },
        { name: 'Klaviyo', status: 'connected' },
        { name: 'Stripe', status: 'pending' },
      ]).map((tool, i) => (
        <motion.div
          key={tool.name}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12, duration: 0.3 }}
          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
        >
          <span className="text-[#716D5C]">{tool.name}</span>
          {tool.status === 'connected' ? (
            <span className="flex items-center gap-1 text-[#003725]">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Connecté</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[9px] uppercase tracking-wider">Sync…</span>
            </span>
          )}
        </motion.div>
      ))}
    </div>
  </div>
)

const MockupDeploy = ({ isImmo }) => {
  const agents = isImmo
    ? [
        { name: 'LÉA', label: 'RDV', color: 'green', delay: 0 },
        { name: 'DOC', label: 'Documents', color: 'green', delay: 0.2 },
        { name: 'REX', label: 'Relances', color: 'green', delay: 0.4 },
      ]
    : [
        { name: 'SARA', label: 'SAV', color: 'green', delay: 0 },
        { name: 'ALEX', label: 'Paniers', color: 'green', delay: 0.2 },
        { name: 'NOVA', label: 'Monitoring', color: 'green', delay: 0.4 },
        { name: 'MAX', label: 'Ops', color: 'green', delay: 0.6 },
      ]

  return (
    <div className="bg-[#F9F7F1] rounded-xl border border-gray-200 p-4">
      <p className="text-[#716D5C] mb-3 uppercase tracking-widest text-[9px] font-mono">Déploiement agents</p>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: agent.delay, duration: 0.3 }}
            className="bg-[#0F5F35]/5 rounded-xl p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest text-[#003725]">{agent.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F5F35] animate-pulse" />
            </div>
            <span className="text-[10px] text-[#716D5C] font-medium">{agent.label}</span>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: '100%' }}
                viewport={{ once: true }}
                transition={{ delay: agent.delay + 0.3, duration: 0.8 }}
                className="h-full bg-[#0F5F35] rounded-full"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const MockupDashboard = ({ isImmo }) => {
  const bars = [60, 45, 75, 55, 85, 70, 90]

  return (
    <div className="bg-[#F9F7F1] rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#716D5C] uppercase tracking-widest text-[9px] font-mono">Dashboard ROI</p>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0F5F35]/5 text-[#003725]">
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {(isImmo ? [
          { label: 'RDV confirmés', value: '+30%' },
          { label: 'Temps admin', value: '-50%' },
        ] : [
          { label: 'Tickets auto', value: '94%' },
          { label: 'Revenus récup.', value: '+15%' },
        ]).map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
            <p className="text-base font-black tracking-tight text-[#262626]">{kpi.value}</p>
            <p className="text-[9px] text-[#716D5C] mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-1 h-10">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.5, ease: 'easeOut' }}
            className={`flex-1 rounded-sm ${i === bars.length - 1 ? 'bg-[#0F5F35]' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="text-[9px] text-[#716D5C] mt-1.5 text-right">7 derniers jours</p>
    </div>
  )
}

/* ── Main Component ── */

export const ProcessSteps = ({ vertical, onNavigate }) => {
  const isImmo = vertical === 'immobilier'

  const steps = isImmo ? [
    {
      step: '01',
      icon: <Activity className="w-5 h-5 text-[#003725]" />,
      title: 'Audit de votre agence',
      desc: "On analyse vos processus actuels (prise de RDV, collecte documentaire, suivi prospects) et on identifie les gains d'efficacité immédiats.",
      detail: 'Jour 1-2',
      mockup: <MockupAudit isImmo />,
    },
    {
      step: '02',
      icon: <Zap className="w-5 h-5 text-[#003725]" />,
      title: 'Déploiement des 3 agents',
      desc: "On configure vos agents IA (RDV, documents, relances), on les connecte à votre CRM et votre agenda, et on valide chaque scénario avec vous.",
      detail: 'Jour 3-5',
      mockup: <MockupDeploy isImmo />,
    },
    {
      step: '03',
      icon: <BarChart3 className="w-5 h-5 text-[#003725]" />,
      title: 'Optimisation continue',
      desc: "On mesure les résultats en temps réel : taux de RDV, documents collectés, prospects réactivés. Les agents s'améliorent en continu.",
      detail: 'En continu',
      mockup: <MockupDashboard isImmo />,
    },
  ] : [
    {
      step: '01',
      icon: <Activity className="w-5 h-5 text-[#003725]" />,
      title: 'Audit & Connexion',
      desc: "On analyse votre stack (Shopify, CRM, support) et on identifie vos plus grosses fuites de marge. On connecte vos outils en 15 minutes.",
      detail: 'Jour 1-2',
      mockup: <MockupAudit isImmo={false} />,
    },
    {
      step: '02',
      icon: <Zap className="w-5 h-5 text-[#003725]" />,
      title: 'Déploiement des agents',
      desc: "On configure vos agents IA et vos workflows sur mesure. Chaque automatisation est testée et validée avec vous avant la mise en production.",
      detail: 'Jour 3-5',
      mockup: <MockupDeploy isImmo={false} />,
    },
    {
      step: '03',
      icon: <BarChart3 className="w-5 h-5 text-[#003725]" />,
      title: 'Optimisation continue',
      desc: "On mesure les résultats en temps réel et on optimise. Vous suivez tout depuis votre dashboard : ROI, tickets traités, revenus récupérés.",
      detail: 'En continu',
      mockup: <MockupDashboard isImmo={false} />,
    },
  ]

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {steps.map((block, i) => (
        <FadeInUp key={`${vertical}-${i}`} delay={i * 0.12}>
          <div
            className="bg-white rounded-3xl border border-gray-200 h-full hover:border-gray-300 transition-all duration-500 overflow-hidden"
          >
            <div className="p-6 md:p-7">
              {/* Step header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  {block.icon}
                  <span className="text-xs font-bold uppercase tracking-widest text-[#716D5C]">Étape {block.step}</span>
                </div>
                <span className="text-xs font-bold text-gray-400 bg-[#F9F7F1] px-3 py-1 rounded-full">{block.detail}</span>
              </div>

              {/* Mockup */}
              <div className="mb-5">
                {block.mockup}
              </div>

              {/* Text */}
              <h3 className="text-lg font-bold text-[#262626] mb-3 tracking-tight">{block.title}</h3>
              <p className="text-[13px] text-[#716D5C] font-medium leading-relaxed">
                {block.desc}
              </p>
            </div>
          </div>
        </FadeInUp>
      ))}
    </div>
  )
}
