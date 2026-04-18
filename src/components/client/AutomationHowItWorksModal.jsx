import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Target, Plug, User, Cog, CheckCircle2, ArrowRight, Sparkles,
  Headphones, ShoppingBag, TrendingUp, Phone, Mail, MessageSquare,
} from 'lucide-react'

/**
 * AutomationHowItWorksModal — premium modal explaining a specific automation.
 *
 * Four sections :
 *  1. Ce que fait cette automation
 *  2. Ce qu'il te faut (integrations with connected check)
 *  3. Ce que vit ton client (storytelling)
 *  4. Comment ca s'active
 */

const MODAL_CONTENT = {
  sav_ecommerce: {
    icon: Headphones,
    gradient: 'from-emerald-500 to-emerald-600',
    title: 'SAV E-commerce',
    subtitle: 'Un agent support qui ne dort jamais',
    whatItDoes: [
      'Lit toutes les demandes clients entrantes (email, chat, Gorgias, Zendesk) et comprend l\'intention (suivi commande, retour, remboursement, question produit).',
      'Interroge votre Shopify en temps reel pour recuperer le statut exact des commandes, le suivi transporteur, les politiques de retour.',
      'Repond en moins de 30 secondes avec votre ton de marque, signature personnalisee, threading parfait dans le meme fil.',
      'Escalade automatiquement vers vous les cas complexes (insatisfaction, remboursement hors politique, question hors perimetre).',
    ],
    requires: [
      { label: 'Un canal de reception', detail: 'Email, Gorgias ou Zendesk', providers: ['gmail', 'smtp_imap', 'gorgias', 'zendesk'], match: 'any' },
      { label: 'Shopify', detail: 'Pour acceder aux donnees reelles (commandes, clients, produits)', providers: ['shopify'], match: 'any', recommended: true },
    ],
    customerStory: [
      { role: 'client', text: '"Bonjour, ou est mon colis commande il y a 3 jours ?"' },
      { role: 'system', text: 'Actero identifie le client, retrouve la commande #1234 dans Shopify, recupere le tracking.' },
      { role: 'agent', text: '"Bonjour Marie, votre commande #1234 est en cours de livraison, arrivee prevue demain entre 10h et 13h. Voici votre tracking : [lien Colissimo]. Bonne journee !"' },
      { role: 'result', text: 'Reponse envoyee en 28 secondes. Marie n\'a meme pas eu le temps d\'attendre.' },
    ],
    howToActivate: [
      'Activez le toggle de l\'automation.',
      'Selectionnez les canaux sur lesquels l\'agent doit repondre (Email / Chat / Gorgias / Zendesk).',
      'L\'agent devient actif immediatement et repond aux nouvelles demandes entrantes.',
    ],
  },
  abandoned_cart: {
    icon: ShoppingBag,
    gradient: 'from-amber-500 to-amber-600',
    title: 'Relance Paniers Abandonnes',
    subtitle: 'Recuperez les ventes perdues automatiquement',
    whatItDoes: [
      'Lit votre Shopify en continu et detecte tous les paniers abandonnes (clients qui ajoutent un produit sans finaliser).',
      'Envoie une sequence d\'emails personnalises a 1h, 24h et 72h apres l\'abandon.',
      'Inclut la photo du produit, le CTA direct vers le panier, et un code promo optionnel pour declencher la conversion.',
      'Stoppe automatiquement la sequence si le client finalise sa commande entre-temps.',
    ],
    requires: [
      { label: 'Shopify', detail: 'Pour detecter les paniers abandonnes', providers: ['shopify'], match: 'any' },
      { label: 'Email professionnel', detail: 'Gmail ou SMTP pour envoyer les relances depuis votre domaine', providers: ['gmail', 'smtp_imap'], match: 'any' },
    ],
    customerStory: [
      { role: 'client', text: 'Marie ajoute une robe a 89 euros dans son panier, puis quitte le site.' },
      { role: 'system', text: '1 heure plus tard, Actero detecte l\'abandon et envoie un email personnalise.' },
      { role: 'agent', text: '"Marie, votre coup de coeur vous attend. Profitez de -10% avec le code CODE10 jusqu\'a demain soir."' },
      { role: 'result', text: 'Marie clique, finalise l\'achat. +89 euros de CA recupere qui etait perdu.' },
    ],
    howToActivate: [
      'Connectez votre boutique Shopify dans l\'onglet Integrations.',
      'Activez le toggle de l\'automation.',
      'Personnalisez le ton des emails et le code promo (optionnel) dans les parametres.',
    ],
  },
  comptabilite_auto: {
    icon: TrendingUp,
    gradient: 'from-indigo-500 to-indigo-600',
    title: 'Comptabilite Automatisee',
    subtitle: 'Votre comptable IA qui ne rate jamais une echeance',
    whatItDoes: [
      'Se connecte a Axonaut, Pennylane ou iPaidThat pour lire vos factures et paiements en continu.',
      'Relance automatiquement les factures en retard avec escalade progressive (J+3 rappel soft, J+15 ferme, J+30 mise en demeure).',
      'Envoie des alertes tresorerie Slack ou email quand votre runway passe sous un seuil critique.',
      'Genere les exports comptables mensuels pour votre expert-comptable sans intervention.',
    ],
    requires: [
      { label: 'Un outil de facturation', detail: 'Axonaut, Pennylane ou iPaidThat', providers: ['axonaut', 'pennylane', 'ipaidthat'], match: 'any' },
      { label: 'Slack ou Email', detail: 'Pour recevoir les alertes tresorerie', providers: ['slack', 'gmail', 'smtp_imap'], match: 'any' },
    ],
    customerStory: [
      { role: 'client', text: 'Vous : "Tiens, j\'ai oublie de relancer la facture de Client X de janvier..."' },
      { role: 'system', text: 'Actero l\'a deja relancee il y a 2 jours. Client X a promis de payer sous 48h.' },
      { role: 'agent', text: 'Notification Slack : "Facture #INV-024 - 2 450 euros - Client X - relance envoyee le 14/04 - engagement client : paiement avant 16/04"' },
      { role: 'result', text: 'Zero facture oubliee ce mois. +3 jours de tresorerie recuperes en moyenne par facture.' },
    ],
    howToActivate: [
      'Connectez votre outil de facturation (Axonaut, Pennylane ou iPaidThat).',
      'Suivez le wizard de configuration : seuils tresorerie, cadence relances, canal d\'alerte.',
      'Activez. L\'agent prend la main des la prochaine echeance.',
    ],
  },
  agent_vocal: {
    icon: Phone,
    gradient: 'from-violet-500 to-violet-600',
    title: 'Agent Vocal IA',
    subtitle: 'Un numero francais qui repond 24/7 a votre place',
    whatItDoes: [
      'Un numero francais dedie que vos clients peuvent appeler a tout moment.',
      'L\'agent IA repond avec une voix naturelle, gere le suivi de commande, les questions produit, les retours.',
      'Transfert vers un humain possible si le client le demande ou si le cas est complexe.',
      'Transcriptions + resumes automatiques de chaque appel, consultables dans votre dashboard.',
    ],
    requires: [
      { label: 'Aucune integration obligatoire', detail: 'Optionnel : Shopify pour acceder aux commandes en direct', providers: ['shopify'], match: 'optional' },
    ],
    customerStory: [
      { role: 'client', text: '*appelle votre numero support a 22h un samedi*' },
      { role: 'agent', text: '"Bonjour, vous etes bien chez Votre Marque. Je suis Lisa, l\'assistante IA. Comment puis-je vous aider ?"' },
      { role: 'client', text: '"Je voudrais savoir ou est ma commande 1234."' },
      { role: 'result', text: 'Lisa recupere la commande dans Shopify, donne le tracking. Appel resolu en 90 secondes. Transcription + resume ajoutes a votre dashboard.' },
    ],
    howToActivate: [
      'Suivez le wizard : choix de la voix (homme/femme), ton de marque, horaires d\'ouverture.',
      'Un numero francais dedie vous est attribue en moins de 2 minutes.',
      'Partagez le numero sur votre site, vos emails, vos reseaux. L\'agent est operationnel.',
    ],
  },
  email_agent: {
    icon: Mail,
    gradient: 'from-blue-500 to-blue-600',
    title: 'Email Agent',
    subtitle: 'Votre boite pro traitee comme un expert humain',
    whatItDoes: [
      'Lit votre boite email professionnelle (Gmail OAuth ou IMAP) en continu, 24/7.',
      'Repond automatiquement aux questions SAV courantes (suivi, retour, remboursement, FAQ produit) avec signature personnalisee.',
      'Threading parfait : les reponses arrivent dans le meme fil que le message client, pas un nouveau mail.',
      'Escalade intelligemment : si la confiance est faible ou le cas sensible, la reponse est mise dans "A traiter" pour validation.',
    ],
    requires: [
      { label: 'Gmail ou IMAP/SMTP', detail: 'Connexion OAuth Gmail (1 clic) ou configuration IMAP classique', providers: ['gmail', 'smtp_imap'], match: 'any' },
    ],
    customerStory: [
      { role: 'client', text: 'Un client envoie un email : "Bonjour, puis-je retourner mon article achete la semaine derniere ?"' },
      { role: 'system', text: 'Actero lit l\'email, identifie le client dans Shopify, verifie la politique de retour.' },
      { role: 'agent', text: '"Bonjour Marie, vous avez bien 30 jours pour retourner votre commande. Voici votre etiquette de retour prepayee : [lien]. Une fois receptionne, le remboursement arrive sous 3 jours ouvres."' },
      { role: 'result', text: 'Reponse envoyee dans le meme fil, 2 minutes apres reception. Marie est ravie.' },
    ],
    howToActivate: [
      'Connectez votre Gmail en 1 clic, ou configurez votre IMAP/SMTP.',
      'Activez le toggle Email Agent. Configurez le seuil de confiance et les horaires quiet.',
      'L\'agent prend la main des la prochaine reception email.',
    ],
  },
  slack_copilot: {
    icon: MessageSquare,
    gradient: 'from-fuchsia-500 to-fuchsia-600',
    title: 'Slack Copilot',
    subtitle: 'Posez vos questions a Actero depuis Slack',
    whatItDoes: [
      'Integration native dans votre workspace Slack : interagissez avec Actero sans jamais quitter Slack.',
      'Mentions @Actero ou commandes /actero pour obtenir en 3 secondes vos KPIs live (tickets du jour, taux d\'auto, CA du mois).',
      'Demandez des recommandations contextualisees : "Donne-moi une reco pour ameliorer mon taux de reponse cette semaine."',
      'Receive les alertes importantes (pic de tickets, escalade urgente, sentiment negatif) directement dans votre canal dedie.',
    ],
    requires: [
      { label: 'Slack', detail: 'Workspace Slack avec droits admin pour installer l\'app Actero', providers: ['slack'], match: 'any' },
    ],
    customerStory: [
      { role: 'client', text: 'Vous, lundi matin dans #ops : "@Actero combien de tickets ce weekend ?"' },
      { role: 'agent', text: '"47 tickets traites (vendredi soir -> dimanche). 89% resolus en auto. 5 escalades : 3 retours produit, 1 reclamation urgente, 1 question technique."' },
      { role: 'client', text: 'Vous : "/actero donne-moi une reco"' },
      { role: 'result', text: '"Je remarque 3 questions recurrentes sur les delais de livraison cette semaine. Je te suggere d\'ajouter une FAQ a ta base de connaissance. Veux-tu que je la redige ?"' },
    ],
    howToActivate: [
      'Installez l\'app Actero dans votre workspace Slack (OAuth 1 clic).',
      'Choisissez le canal ou recevoir les alertes importantes.',
      'C\'est tout. Mentionnez @Actero ou tapez /actero dans n\'importe quel canal.',
    ],
  },
}

const RoleIcon = ({ role }) => {
  if (role === 'client') return <span className="text-[11px] font-bold text-[#1a1a1a]">Client</span>
  if (role === 'agent') return <span className="text-[11px] font-bold text-cta">Actero</span>
  if (role === 'system') return <span className="text-[11px] font-bold text-[#9ca3af]">Systeme</span>
  if (role === 'result') return <span className="text-[11px] font-bold text-cta">Resultat</span>
  return null
}

export const AutomationHowItWorksModal = ({
  automationKey,
  isOpen,
  onClose,
  isActive = false,
  reqsMet = true,
  onActivate,
  onViewStats,
  connectedProviders = [],
  onGoToIntegrations,
}) => {
  const content = MODAL_CONTENT[automationKey]
  if (!content) return null

  const Icon = content.icon

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className={`relative bg-gradient-to-br ${content.gradient} p-6 md:p-8 text-white`}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-[22px] font-bold leading-tight">{content.title}</h2>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/25 text-white text-[10px] font-bold rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Actif
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-white/90 leading-relaxed">{content.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 md:p-8 space-y-7 max-h-[calc(100vh-280px)] overflow-y-auto">
              {/* Section 1 — What it does */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-cta" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#1a1a1a]">Ce que fait cette automation</h3>
                </div>
                <ul className="space-y-2 pl-9">
                  {content.whatItDoes.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-[#1a1a1a] leading-relaxed">
                      <span className="text-cta font-bold mt-0.5">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Section 2 — Requirements */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Plug className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#1a1a1a]">Ce qu'il te faut</h3>
                </div>
                <div className="space-y-2 pl-9">
                  {content.requires.map((req, i) => {
                    const connected = req.providers.some(p => connectedProviders.includes(p))
                    const optional = req.match === 'optional'
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          connected ? 'bg-cta/5 border-cta/20' : optional ? 'bg-[#fafafa] border-[#f0f0f0]' : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          connected ? 'bg-cta text-white' : optional ? 'bg-white text-[#9ca3af]' : 'bg-amber-500 text-white'
                        }`}>
                          {connected ? <CheckCircle2 className="w-4 h-4" /> : <Plug className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-[#1a1a1a]">{req.label}</p>
                            {optional && <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">optionnel</span>}
                            {connected && <span className="text-[10px] font-semibold text-cta">connecte</span>}
                          </div>
                          <p className="text-[11px] text-[#71717a] mt-0.5">{req.detail}</p>
                        </div>
                        {!connected && !optional && onGoToIntegrations && (
                          <button
                            onClick={() => { onGoToIntegrations(); onClose() }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100 rounded-full transition-colors flex-shrink-0"
                          >
                            Connecter
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Section 3 — Customer story */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                    <User className="w-4 h-4 text-violet-600" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#1a1a1a]">Ce que vit ton client</h3>
                </div>
                <div className="pl-9 space-y-2.5">
                  {content.customerStory.map((step, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl ${
                        step.role === 'agent' ? 'bg-cta/5 border border-cta/15' :
                        step.role === 'client' ? 'bg-[#fafafa] border border-[#f0f0f0]' :
                        step.role === 'system' ? 'bg-white border border-[#f0f0f0]' :
                        'bg-emerald-50 border border-emerald-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <RoleIcon role={step.role} />
                      </div>
                      <p className="text-[13px] text-[#1a1a1a] leading-relaxed">{step.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 4 — How to activate */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Cog className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#1a1a1a]">Comment ca s'active</h3>
                </div>
                <ol className="space-y-2.5 pl-9">
                  {content.howToActivate.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-cta text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-[#1a1a1a] leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* Footer */}
            <div className="p-5 md:p-6 border-t border-[#f0f0f0] bg-[#fafafa] flex flex-col sm:flex-row items-center gap-3">
              {onActivate && !isActive && (
                <button
                  onClick={() => { onActivate(); onClose() }}
                  disabled={!reqsMet}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-cta hover:bg-[#003725] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" /> Activer maintenant
                </button>
              )}
              {isActive && onViewStats && (
                <button
                  onClick={() => { onViewStats(); onClose() }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-cta hover:bg-[#003725] text-white text-[13px] font-semibold rounded-xl transition-colors"
                >
                  <ArrowRight className="w-4 h-4" /> Voir les stats detaillees
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 text-[13px] font-semibold text-[#71717a] hover:text-[#1a1a1a] transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AutomationHowItWorksModal
