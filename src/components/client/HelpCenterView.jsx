import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, BookOpen, Zap, ShoppingBag, Plug, Shield, BarChart3,
  ArrowLeft, Mail, ChevronDown,
  Headphones, AlertTriangle, Sparkles,
  MessageSquare, Phone, CreditCard, Bell, Globe, Sliders,
  Brain, HelpCircle, Send, Key, Calendar, TrendingUp,
  PlayCircle, Volume2, Mic, Clock, CheckCircle2,
} from 'lucide-react'

// Import guides data from the public support page
// We duplicate the minimal structure here to keep it self-contained
const CATEGORIES = [
  { id: 'getting-started', icon: Zap, title: 'Premiers pas', desc: 'Comprendre et demarrer' },
  { id: 'integrations', icon: Plug, title: 'Integrations', desc: 'Connecter vos outils' },
  { id: 'automatisations', icon: Sparkles, title: 'Automatisations', desc: 'Activer vos agents' },
  { id: 'agent-ia', icon: Brain, title: 'Mon Agent', desc: 'Configurer votre IA' },
  { id: 'dashboard', icon: BarChart3, title: 'Dashboard', desc: 'Vos metriques' },
  { id: 'billing', icon: CreditCard, title: 'Facturation', desc: 'Abonnement' },
]

// Fetch guides dynamically from the page or use a static import
// For now we'll fetch from the support page HTML and parse, but simpler:
// we create a lightweight version of the guides inline

const GUIDES = [
  { id: 'comment-fonctionne', category: 'getting-started', title: 'Comment fonctionne Actero', summary: 'Comprendre le fonctionnement de la plateforme.', icon: Zap, readTime: '3 min',
    content: "Actero est une plateforme qui automatise le support client de votre boutique e-commerce. Vous connectez vos outils (Shopify, email, etc.), vous activez des automatisations, et l'IA repond a vos clients 24h/24.\n\nLe fonctionnement est simple :\n1. Vous connectez vos outils dans Integrations\n2. Vous configurez votre agent dans Mon Agent (ton, connaissances)\n3. Vous activez les automatisations qui vous interessent\n4. L'IA traite les demandes automatiquement\n5. Vous suivez les resultats dans votre dashboard" },
  { id: 'premier-jour', category: 'getting-started', title: 'Votre premier jour', summary: 'De la connexion a votre premiere automatisation.', icon: Zap, readTime: '5 min',
    content: "Etape 1 : Connectez Shopify dans Integrations (1 clic OAuth)\nEtape 2 : Allez dans Mon Agent et ajustez le ton avec les 3 curseurs\nEtape 3 : Importez vos FAQ dans la Base de savoir (URL ou fichier)\nEtape 4 : Allez dans Automatisations, selectionnez 'Chat sur le site' sur SAV E-commerce, activez le toggle\nEtape 5 : Le widget chat apparait sur votre boutique Shopify !\nEtape 6 : Testez en envoyant un message depuis votre site\nEtape 7 : Configurez le ROI dans l'onglet ROI pour suivre vos economies" },
  { id: 'problemes', category: 'getting-started', title: 'Problemes frequents', summary: 'Solutions aux problemes courants.', icon: HelpCircle, readTime: '4 min',
    content: "Mon agent repond mal :\n→ Ajoutez plus de contenu dans la Base de savoir. Plus l'agent a d'infos, mieux il repond.\n\nLe widget n'apparait pas sur mon site :\n→ Verifiez que Shopify est connecte et que 'Chat sur le site' est selectionne dans Automatisations.\n\nJe ne recois pas de notifications :\n→ Verifiez vos preferences dans le menu Notifications (cliquez sur votre nom en bas).\n\nL'integration ne se connecte pas :\n→ Verifiez vos identifiants. Pour SMTP/IMAP, verifiez les serveurs et ports aupres de votre hebergeur.\n\nLes metriques ne bougent pas :\n→ Les metriques se mettent a jour quand des messages sont traites par l'agent. Envoyez un message test via le widget." },
  // Integrations
  { id: 'connecter-shopify', category: 'integrations', title: 'Connecter Shopify', summary: 'Connecter votre boutique en 1 clic.', icon: ShoppingBag, readTime: '2 min',
    content: "1. Allez dans Integrations\n2. Cliquez 'Connecter' sur Shopify\n3. Entrez votre domaine Shopify (ex: ma-boutique.myshopify.com)\n4. Vous etes redirige vers Shopify — autorisez l'app\n5. Retour automatique sur Actero avec 'Connecte' affiche\n\nShopify est necessaire pour : le widget chat sur le site, le suivi des commandes, la relance paniers abandonnes." },
  { id: 'connecter-gmail', category: 'integrations', title: 'Connecter Gmail', summary: 'Recevoir et repondre aux emails.', icon: Mail, readTime: '2 min',
    content: "1. Allez dans Integrations\n2. Cliquez 'Connecter' sur Gmail\n3. Connectez-vous avec votre compte Google\n4. Autorisez Actero a lire et envoyer des emails\n5. C'est connecte !\n\nGmail permet a l'agent de repondre automatiquement aux emails clients." },
  { id: 'connecter-smtp', category: 'integrations', title: 'Connecter un email SMTP/IMAP', summary: 'Utiliser votre email professionnel.', icon: Mail, readTime: '4 min',
    content: "Pour connecter votre email pro (contact@maboutique.com) :\n\n1. Allez dans Integrations → Email personnalise (SMTP/IMAP)\n2. Remplissez les champs :\n- Adresse email : votre email pro\n- Serveur SMTP + Port : demandez a votre hebergeur\n- Serveur IMAP + Port : demandez a votre hebergeur\n- Identifiant : votre email\n- Mot de passe : votre mot de passe email\n\nServeurs courants :\nOVH : smtp.ovh.net (587) / imap: ssl0.ovh.net (993)\nIonos : smtp.ionos.fr (587) / imap.ionos.fr (993)\nInfomaniak : mail.infomaniak.com (587/993)\nO2switch : votre-domaine.com (465/993)" },
  { id: 'connecter-slack', category: 'integrations', title: 'Connecter Slack', summary: 'Recevoir les alertes dans Slack.', icon: MessageSquare, readTime: '2 min',
    content: "1. Allez dans Integrations\n2. Cliquez 'Connecter' sur Slack\n3. Selectionnez votre workspace\n4. Choisissez le canal pour les notifications\n5. Validez\n\nVous recevrez : les alertes d'escalade, les rapports d'activite, les notifications de tickets urgents." },
  { id: 'connecter-gorgias', category: 'integrations', title: 'Connecter Gorgias', summary: 'Traiter les tickets Gorgias automatiquement.', icon: Headphones, readTime: '2 min',
    content: "1. Allez dans Integrations\n2. Cliquez 'Connecter' sur Gorgias\n3. Entrez votre sous-domaine Gorgias (ex: ma-boutique)\n4. Autorisez Actero\n5. C'est connecte !\n\nL'agent traitera automatiquement les nouveaux tickets Gorgias et repondra directement dans votre interface Gorgias." },
  { id: 'connecter-zendesk', category: 'integrations', title: 'Connecter Zendesk', summary: 'Traiter les tickets Zendesk automatiquement.', icon: Headphones, readTime: '2 min',
    content: "1. Allez dans Integrations\n2. Cliquez 'Connecter' sur Zendesk\n3. Entrez votre sous-domaine Zendesk\n4. Autorisez Actero\n5. C'est connecte !\n\nL'agent repondra aux tickets Zendesk automatiquement." },
  { id: 'connecter-klaviyo', category: 'integrations', title: 'Connecter Klaviyo', summary: 'Email et SMS marketing.', icon: Send, readTime: '2 min',
    content: "1. Allez dans Integrations → Klaviyo\n2. Cliquez 'Connecter'\n3. Collez votre cle API Klaviyo\n   (Trouvez-la dans Klaviyo → Settings → API Keys)\n4. Cliquez 'Connecter'\n\nKlaviyo permet d'envoyer des SMS de relance pour les paniers abandonnes." },
  { id: 'connecter-comptabilite', category: 'integrations', title: 'Connecter Axonaut, Pennylane ou iPaidThat', summary: 'Automatiser la comptabilite.', icon: TrendingUp, readTime: '3 min',
    content: "Axonaut : CRM et facturation pour PME\n→ Integrations → Axonaut → Collez votre cle API (Parametres → API)\n\nPennylane : Comptabilite automatisee\n→ Integrations → Pennylane → Collez votre token (Parametres → Integrations → API)\n\niPaidThat : Collecte de factures\n→ Integrations → iPaidThat → Collez votre cle API (Parametres → API & Integrations)\n\nCes outils permettent d'automatiser les relances de factures et le suivi de tresorerie." },
  // Automatisations
  { id: 'activer-automatisations', category: 'automatisations', title: 'Activer vos automatisations', summary: 'Comment activer et choisir les canaux.', icon: Sparkles, readTime: '3 min',
    content: "1. Allez dans Automatisations\n2. Choisissez les canaux pour chaque automatisation (Email, Chat, Gorgias, Zendesk)\n3. Un canal est vert = connecte. Grise = integration manquante.\n4. Activez le toggle\n5. C'est en production !\n\nPour desactiver : cliquez le toggle vert. Le widget est automatiquement retire de votre site." },
  { id: 'sav-ecommerce', category: 'automatisations', title: 'SAV E-commerce', summary: 'Support client automatique 24h/24.', icon: Headphones, readTime: '3 min',
    content: "L'automatisation SAV repond aux questions de vos clients : suivi commande, retours, remboursements, questions produits.\n\nCanaux disponibles :\n- Chat sur le site (necessite Shopify)\n- Email (necessite Gmail ou SMTP)\n- Gorgias / Zendesk\n\nL'agent classifie chaque demande, repond avec votre base de connaissances, et escalade vers vous si il n'est pas sur de sa reponse." },
  { id: 'relance-paniers', category: 'automatisations', title: 'Relance Paniers Abandonnes', summary: 'Recuperer les ventes perdues.', icon: ShoppingBag, readTime: '2 min',
    content: "Quand un client abandonne son panier sur votre boutique Shopify, l'agent envoie un email de relance personnalise.\n\nNecessite : Shopify connecte + Email (Gmail ou SMTP)\n\nL'email est personnalise avec le prenom du client et les produits laisses dans le panier." },
  { id: 'comptabilite-comment-ca-marche', category: 'automatisations', title: 'Comptabilite automatisee : comment ca marche', summary: 'Tout comprendre sur l\'automatisation comptable.', icon: TrendingUp, readTime: '6 min',
    content: "L'automatisation Comptabilite Automatisee gere 4 taches pour vous :\n\n1. RELANCE DE FACTURES IMPAYEES\nL'IA detecte automatiquement les factures qui depassent leur date d'echeance. Elle envoie un email de relance professionnel a votre client avec le montant du, le numero de facture et un lien de paiement. Vous definissez le delai (par defaut 7 jours apres l'echeance). Si le client ne paie toujours pas, une deuxieme relance est envoyee.\n\n2. ALERTES DE TRESORERIE\nVous definissez un seuil (par exemple 1000€). Des que votre solde de tresorerie passe en dessous de ce montant, vous recevez une alerte par email et/ou Slack. Ca vous permet d'anticiper les problemes de tresorerie avant qu'ils n'arrivent.\n\n3. EXPORTS COMPTABLES AUTOMATIQUES\nChaque semaine, mois ou trimestre (selon votre choix), l'IA genere un export de vos donnees comptables et vous l'envoie par email. Plus besoin de vous connecter a votre outil comptable pour sortir les chiffres.\n\n4. NOTIFICATIONS\nChaque action comptable (relance envoyee, alerte declenchee, export genere) vous est notifiee par email et/ou Slack. Vous restez informe sans effort.\n\nPREREQUIS\nPour activer cette automatisation, vous devez connecter au moins un outil comptable dans Integrations :\n- Axonaut : CRM et facturation pour PME\n- Pennylane : comptabilite automatisee, rapprochement bancaire\n- iPaidThat : collecte et classement automatique de factures\n\nSans outil comptable connecte, le toggle d'activation sera bloque.\n\nCOMMENT ACTIVER\n1. Connectez Axonaut, Pennylane ou iPaidThat dans Integrations\n2. Allez dans Automatisations → Comptabilite Automatisee\n3. Cliquez le toggle → un assistant de configuration s'ouvre\n4. Choisissez votre outil comptable\n5. Configurez le delai de relance, le seuil de tresorerie et la frequence des exports\n6. Choisissez les canaux de notification (Email, Slack)\n7. Activez !\n\nL'automatisation commence immediatement a surveiller vos factures et votre tresorerie." },
  { id: 'agent-vocal', category: 'automatisations', title: 'Agent Vocal IA', summary: 'Bientot disponible.', icon: Phone, readTime: '1 min',
    content: "L'agent vocal IA permettra a vos clients de parler directement a votre agent par la voix sur votre site web.\n\nCette fonctionnalite est en cours de developpement et sera disponible prochainement." },
  // Mon Agent
  { id: 'configurer-ton', category: 'agent-ia', title: 'Configurer le ton', summary: 'Ajuster la personnalite de votre agent.', icon: Sliders, readTime: '3 min',
    content: "Dans Mon Agent, vous avez 3 curseurs :\n\n1. Formel ↔ Casual : a gauche l'agent vouvoie et est tres pro, a droite il tutoie et est amical\n2. Froid ↔ Chaleureux : a gauche l'agent est factuel et direct, a droite il est empathique et accueillant\n3. Court ↔ Detaille : a gauche les reponses font 1-2 phrases, a droite elles sont plus completes\n\nUne previsualisation en bas montre a quoi ressemblera une reponse. Ajustez jusqu'a ce que ca corresponde a votre marque, puis sauvegardez." },
  { id: 'base-connaissances', category: 'agent-ia', title: 'Base de connaissances', summary: '3 facons d\'alimenter votre agent.', icon: BookOpen, readTime: '4 min',
    content: "Plus votre agent a d'informations, mieux il repond.\n\n3 methodes pour ajouter du contenu :\n\n1. Import URL : collez l'adresse de votre page FAQ → l'IA extrait les questions/reponses automatiquement\n\n2. Upload fichier : envoyez un PDF ou TXT (politique retour, catalogue...) → l'IA en extrait les infos cles\n\n3. Ajout manuel : tapez directement une question et sa reponse\n\nToutes les entrees sont modifiables et supprimables. Ajoutez au minimum votre politique de retour et vos delais de livraison." },
  { id: 'escalades', category: 'agent-ia', title: 'Les escalades (A traiter)', summary: 'Quand l\'agent a besoin de vous.', icon: AlertTriangle, readTime: '3 min',
    content: "Quand l'agent n'est pas assez confiant dans sa reponse, il escalade la demande vers vous.\n\nDans l'onglet 'A traiter' vous voyez :\n- Le message du client\n- La reponse proposee par l'IA\n- 3 boutons : Approuver, Modifier, Rejeter\n\nPour reduire les escalades : ajoutez plus de contenu dans la Base de savoir sur les sujets qui reviennent souvent." },
  { id: 'regles', category: 'agent-ia', title: 'Definir vos regles', summary: 'Ce que l\'agent ne doit jamais faire.', icon: Shield, readTime: '3 min',
    content: "Dans Regles, vous definissez les garde-fous de votre agent :\n\n- Ajoutez des regles texte (ex: 'Ne jamais promettre de remboursement sans validation')\n- Utilisez le builder visuel : SI [condition] ALORS [action]\n- Configurez les seuils d'escalade (montant max, confiance minimum)\n\nCes regles sont verifiees avant chaque reponse de l'agent." },
  // Dashboard
  { id: 'metriques', category: 'dashboard', title: 'Vos metriques', summary: 'Comprendre les chiffres de votre dashboard.', icon: BarChart3, readTime: '3 min',
    content: "Sur votre page d'accueil, 5 chiffres :\n\n1. Tickets resolus : demandes traitees automatiquement\n2. Escalades : demandes en attente de votre reponse\n3. Temps economise : heures gagnees grace a l'agent\n4. Actions IA : nombre total d'actions executees\n5. ROI genere : valeur financiere creee\n\nLes pourcentages en vert/rouge comparent au mois precedent." },
  { id: 'roi', category: 'dashboard', title: 'Configurer le ROI', summary: 'Calculer votre retour sur investissement.', icon: TrendingUp, readTime: '2 min',
    content: "Dans l'onglet ROI, configurez :\n\n- Cout horaire de votre equipe support (ex: 25€/h)\n- Temps moyen par ticket (ex: 5 minutes)\n- Votre abonnement Actero\n\nLe ROI est calcule automatiquement :\nROI = (Temps economise × Cout horaire) - Abonnement\n\nPlus l'agent traite de tickets, plus le ROI augmente." },
  { id: 'tester', category: 'dashboard', title: 'Tester votre agent', summary: 'Verifier les reponses avant de lancer.', icon: PlayCircle, readTime: '3 min',
    content: "Dans Tester, vous pouvez :\n\n- Tester chaque automatisation active avec des scenarios pre-faits\n- Cliquer 'Tester tous les playbooks actifs' pour tout verifier d'un coup\n- Utiliser le chat libre en bas pour poser n'importe quelle question\n\nChaque test montre : la classification, le score de confiance, et la reponse complete de l'agent." },
  { id: 'notifications', category: 'dashboard', title: 'Notifications', summary: 'Choisir quoi recevoir et ou.', icon: Bell, readTime: '2 min',
    content: "Cliquez sur votre nom en bas → Notifications.\n\nPour chaque type de notification (escalades, rapports, activite), choisissez le canal : Email, Slack, Push.\n\nVous pouvez aussi activer le mode silencieux pour ne pas recevoir de notifications la nuit." },
  // Facturation
  { id: 'facturation', category: 'billing', title: 'Facturation', summary: 'Gerer votre abonnement.', icon: CreditCard, readTime: '2 min',
    content: "Cliquez sur votre nom en bas → Facturation.\n\nVous voyez votre plan actuel, votre consommation du mois, et pouvez acceder au Portail Stripe pour :\n- Telecharger vos factures\n- Modifier votre carte bancaire\n- Changer de plan" },
]

export const HelpCenterView = ({ theme }) => {
  const [search, setSearch] = useState('')
  const [selectedGuide, setSelectedGuide] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const filteredGuides = search.trim().length >= 2
    ? GUIDES.filter(g => `${g.title} ${g.summary} ${g.content}`.toLowerCase().includes(search.toLowerCase()))
    : selectedCategory
      ? GUIDES.filter(g => g.category === selectedCategory)
      : GUIDES

  if (selectedGuide) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setSelectedGuide(null)} className="flex items-center gap-1 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour aux guides
        </button>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a] mb-2">{selectedGuide.title}</h2>
        <p className="text-[12px] text-[#9ca3af] mb-6 flex items-center gap-2">
          <Clock className="w-3 h-3" /> {selectedGuide.readTime}
        </p>
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6">
          <p className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-line">{selectedGuide.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Centre d'aide</h2>
        <p className="text-[13px] text-[#9ca3af] mt-1">{GUIDES.length} guides pour vous aider a utiliser Actero</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4c4c4]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null) }}
          placeholder="Rechercher un guide..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-[#0F5F35]/30"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            !selectedCategory ? 'bg-[#0F5F35] text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
          }`}
        >
          Tout
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                selectedCategory === cat.id ? 'bg-[#0F5F35] text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {cat.title}
            </button>
          )
        })}
      </div>

      {/* Guides list */}
      <div className="space-y-2">
        {filteredGuides.map(guide => {
          const Icon = guide.icon || BookOpen
          return (
            <button
              key={guide.id}
              onClick={() => setSelectedGuide(guide)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#e0e0e0] transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#9ca3af]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1a1a1a]">{guide.title}</p>
                <p className="text-[11px] text-[#9ca3af] truncate">{guide.summary}</p>
              </div>
              <span className="text-[10px] text-[#c4c4c4] flex-shrink-0">{guide.readTime}</span>
            </button>
          )
        })}
      </div>

      {filteredGuides.length === 0 && (
        <div className="text-center py-12 text-[#9ca3af]">
          <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-[13px]">Aucun guide trouve pour "{search}"</p>
        </div>
      )}
    </div>
  )
}
