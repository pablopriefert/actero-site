import React from 'react'
import { motion } from 'framer-motion'
import { Activity, Zap, BarChart3, CheckCircle2, Calendar, FileText, UserCheck } from 'lucide-react'
import { FadeInUp } from '../ui/scroll-animations'
import { GlowCard } from '../ui/GlowCard'

/* ── Mini UI Mockups ── */

const MockupAudit = ({ isImmo }) => (
  <div className="bg-white rounded-xl border border-[#2E4068]/10 p-4 text-[11px] font-mono">
    <p className="text-[#5A7A8C] mb-3 uppercase tracking-widest text-[9px]">Connexion outils</p>
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
          className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2"
        >
          <span className="text-[#5A7A8C]">{tool.name}</span>
          {tool.status === 'connected' ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Connecté</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400/70">
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
        { name: 'LÉA', label: 'RDV', color: 'violet', delay: 0 },
        { name: 'DOC', label: 'Documents', color: 'purple', delay: 0.2 },
        { name: 'REX', label: 'Relances', color: 'fuchsia', delay: 0.4 },
      ]
    : [
        { name: 'SARA', label: 'SAV', color: 'emerald', delay: 0 },
        { name: 'ALEX', label: 'Paniers', color: 'cyan', delay: 0.2 },
        { name: 'NOVA', label: 'Monitoring', color: 'amber', delay: 0.4 },
        { name: 'MAX', label: 'Ops', color: 'violet', delay: 0.6 },
      ]

  const colorMap = {
    emerald: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    cyan: { dot: 'bg-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10' },
    violet: { dot: 'bg-violet-400', text: 'text-violet-400', bg: 'bg-violet-500/10' },
    purple: { dot: 'bg-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10' },
    fuchsia: { dot: 'bg-fuchsia-400', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  }

  return (
    <div className="bg-white rounded-xl border border-[#2E4068]/10 p-4">
      <p className="text-[#5A7A8C] mb-3 uppercase tracking-widest text-[9px] font-mono">Déploiement agents</p>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => {
          const c = colorMap[agent.color]
          return (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: agent.delay, duration: 0.3 }}
              className={`${c.bg} rounded-xl p-3 flex flex-col gap-2`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black tracking-widest ${c.text}`}>{agent.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
              </div>
              <span className="text-[10px] text-[#5A7A8C] font-medium">{agent.label}</span>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ delay: agent.delay + 0.3, duration: 0.8 }}
                  className={`h-full ${c.dot} rounded-full`}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

const MockupDashboard = ({ isImmo }) => {
  const bars = [60, 45, 75, 55, 85, 70, 90]
  const accentColor = isImmo ? 'bg-violet-400' : 'bg-emerald-400'
  const accentText = isImmo ? 'text-violet-400' : 'text-emerald-400'

  return (
    <div className="bg-white rounded-xl border border-[#2E4068]/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#5A7A8C] uppercase tracking-widest text-[9px] font-mono">Dashboard ROI</p>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 ${accentText}`}>
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
          <div key={kpi.label} className="bg-white/60 rounded-lg px-3 py-2">
            <p className={`text-base font-black tracking-tight ${accentText}`}>{kpi.value}</p>
            <p className="text-[9px] text-[#5A7A8C] mt-0.5">{kpi.label}</p>
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
            className={`flex-1 rounded-sm ${i === bars.length - 1 ? accentColor : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="text-[9px] text-[#5A7A8C] mt-1.5 text-right">7 derniers jours</p>
    </div>
  )
}

/* ── Main Component ── */

export const ProcessSteps = ({ vertical, onNavigate }) => {
  const isImmo = vertical === 'immobilier'
  const accent = isImmo ? 'violet' : 'emerald'

  const steps = isImmo ? [
    {
      step: '01',
      icon: <Activity className="w-5 h-5 text-violet-400" />,
      title: 'Audit de votre agence',
      desc: "On analyse vos processus actuels (prise de RDV, collecte documentaire, suivi prospects) et on identifie les gains d'efficacité immédiats.",
      detail: 'Jour 1-2',
      mockup: <MockupAudit isImmo />,
      glowColor: 'violet',
    },
    {
      step: '02',
      icon: <Zap className="w-5 h-5 text-purple-400" />,
      title: 'Déploiement des 3 agents',
      desc: "On configure vos agents IA (RDV, documents, relances), on les connecte à votre CRM et votre agenda, et on valide chaque scénario avec vous.",
      detail: 'Jour 3-5',
      mockup: <MockupDeploy isImmo />,
      glowColor: 'purple',
    },
    {
      step: '03',
      icon: <BarChart3 className="w-5 h-5 text-fuchsia-400" />,
      title: 'Optimisation continue',
      desc: "On mesure les résultats en temps réel : taux de RDV, documents collectés, prospects réactivés. Les agents s'améliorent en continu.",
      detail: 'En continu',
      mockup: <MockupDashboard isImmo />,
      glowColor: 'violet',
    },
  ] : [
    {
      step: '01',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      title: 'Audit & Connexion',
      desc: "On analyse votre stack (Shopify, CRM, support) et on identifie vos plus grosses fuites de marge. On connecte vos outils en 15 minutes.",
      detail: 'Jour 1-2',
      mockup: <MockupAudit isImmo={false} />,
      glowColor: 'emerald',
    },
    {
      step: '02',
      icon: <Zap className="w-5 h-5 text-cyan-400" />,
      title: 'Déploiement des agents',
      desc: "On configure vos agents IA et vos workflows sur mesure. Chaque automatisation est testée et validée avec vous avant la mise en production.",
      detail: 'Jour 3-5',
      mockup: <MockupDeploy isImmo={false} />,
      glowColor: 'cyan',
    },
    {
      step: '03',
      icon: <BarChart3 className="w-5 h-5 text-amber-400" />,
      title: 'Optimisation continue',
      desc: "On mesure les résultats en temps réel et on optimise. Vous suivez tout depuis votre dashboard : ROI, tickets traités, revenus récupérés.",
      detail: 'En continu',
      mockup: <MockupDashboard isImmo={false} />,
      glowColor: 'amber',
    },
  ]

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {steps.map((block, i) => (
        <FadeInUp key={`${vertical}-${i}`} delay={i * 0.12}>
          <GlowCard
            color={block.glowColor}
            className="bg-white/80 rounded-[28px] border border-[#2E4068]/10 h-full hover:border-[#2E4068]/15 transition-all duration-500 overflow-hidden"
          >
            <div className="p-6 md:p-7">
              {/* Step header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  {block.icon}
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A7A8C]">Étape {block.step}</span>
                </div>
                <span className="text-xs font-bold text-[#0A0E1A]/40 bg-white/60 px-3 py-1 rounded-full">{block.detail}</span>
              </div>

              {/* Mockup */}
              <div className="mb-5">
                {block.mockup}
              </div>

              {/* Text */}
              <h3 className="text-lg font-bold text-[#0A0E1A] mb-3 tracking-tight">{block.title}</h3>
              <p className="text-[13px] text-[#5A7A8C] font-medium leading-relaxed">
                {block.desc}
              </p>
            </div>
          </GlowCard>
        </FadeInUp>
      ))}
    </div>
  )
}
