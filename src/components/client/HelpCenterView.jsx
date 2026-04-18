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
  { id: 'getting-started', icon: Zap, title: 'Premiers pas', desc: 'Comprendre et démarrer' },
  { id: 'integrations', icon: Plug, title: 'Intégrations', desc: 'Connecter vos outils' },
  { id: 'automatisations', icon: Sparkles, title: 'Automatisations', desc: 'Activer vos agents' },
  { id: 'agent-ia', icon: Brain, title: 'Mon Agent', desc: 'Configurer votre IA' },
  { id: 'dashboard', icon: BarChart3, title: 'Dashboard', desc: 'Vos métriques' },
  { id: 'billing', icon: CreditCard, title: 'Facturation', desc: 'Abonnement' },
]

// Fetch guides dynamically from the page or use a static import
// For now we'll fetch from the support page HTML and parse, but simpler:
// we create a lightweight version of the guides inline

const GUIDES = [
  { id: 'comment-fonctionne', category: 'getting-started', title: 'Comment fonctionne Actero', summary: 'Comprendre le fonctionnement de la plateforme.', icon: Zap, readTime: '3 min',
    content: "Actero est une plateforme qui automatise le support client de votre boutique e-commerce. Vous connectez vos outils (Shopify, email, etc.), vous activez des automatisations, et l'IA répond à vos clients 24h/24.\n\nLe fonctionnement est simple :\n1. Vous connectez vos outils dans Intégrations\n2. Vous configurez votre agent dans Mon Agent (ton, connaissances)\n3. Vous activez les automatisations qui vous intéressent\n4. L'IA traite les demandes automatiquement\n5. Vous suivez les résultats dans votre dashboard" },
  { id: 'premier-jour', category: 'getting-started', title: 'Votre premier jour', summary: 'De la connexion à votre première automatisation.', icon: Zap, readTime: '5 min',
    content: "Étape 1 : Connectez Shopify dans Intégrations (1 clic OAuth)\nÉtape 2 : Allez dans Mon Agent et ajustez le ton avec les 3 curseurs\nÉtape 3 : Importez vos FAQ dans la Base de savoir (URL ou fichier)\nÉtape 4 : Allez dans Automatisations, sélectionnez 'Chat sur le site' sur SAV E-commerce, activez le toggle\nÉtape 5 : Le widget chat apparaît sur votre boutique Shopify !\nÉtape 6 : Testez en envoyant un message depuis votre site\nÉtape 7 : Configurez le ROI dans l'onglet ROI pour suivre vos économies" },
  { id: 'problemes', category: 'getting-started', title: 'Problèmes fréquents', summary: 'Solutions aux problèmes courants.', icon: HelpCircle, readTime: '4 min',
    content: "Mon agent répond mal :\n→ Ajoutez plus de contenu dans la Base de savoir. Plus l'agent a d'infos, mieux il répond.\n\nLe widget n'apparaît pas sur mon site :\n→ Vérifiez que Shopify est connecté et que 'Chat sur le site' est sélectionné dans Automatisations.\n\nJe ne reçois pas de notifications :\n→ Vérifiez vos préférences dans le menu Notifications (cliquez sur votre nom en bas).\n\nL'intégration ne se connecte pas :\n→ Vérifiez vos identifiants. Pour SMTP/IMAP, vérifiez les serveurs et ports auprès de votre hébergeur.\n\nLes métriques ne bougent pas :\n→ Les métriques se mettent à jour quand des messages sont traités par l'agent. Envoyez un message test via le widget." },
  // Integrations
  { id: 'connecter-shopify', category: 'integrations', title: 'Connecter Shopify', summary: 'Connecter votre boutique en 1 clic.', icon: ShoppingBag, readTime: '2 min',
    content: "1. Allez dans Intégrations\n2. Cliquez 'Connecter' sur Shopify\n3. Entrez votre domaine Shopify (ex: ma-boutique.myshopify.com)\n4. Vous êtes redirigé vers Shopify — autorisez l'app\n5. Retour automatique sur Actero avec 'Connecté' affiché\n\nShopify est nécessaire pour : le widget chat sur le site, le suivi des commandes, la relance paniers abandonnés." },
  { id: 'connecter-gmail', category: 'integrations', title: 'Connecter Gmail', summary: 'Recevoir et répondre aux emails.', icon: Mail, readTime: '2 min',
    content: "1. Allez dans Intégrations\n2. Cliquez 'Connecter' sur Gmail\n3. Connectez-vous avec votre compte Google\n4. Autorisez Actero à lire et envoyer des emails\n5. C'est connecté !\n\nGmail permet à l'agent de répondre automatiquement aux emails clients." },
  { id: 'connecter-smtp', category: 'integrations', title: 'Connecter un email SMTP/IMAP', summary: 'Utiliser votre email professionnel.', icon: Mail, readTime: '4 min',
    content: "Pour connecter votre email pro (contact@maboutique.com) :\n\n1. Allez dans Intégrations → Email personnalisé (SMTP/IMAP)\n2. Remplissez les champs :\n- Adresse email : votre email pro\n- Serveur SMTP + Port : demandez à votre hébergeur\n- Serveur IMAP + Port : demandez à votre hébergeur\n- Identifiant : votre email\n- Mot de passe : votre mot de passe email\n\nServeurs courants :\nOVH : smtp.ovh.net (587) / imap: ssl0.ovh.net (993)\nIonos : smtp.ionos.fr (587) / imap.ionos.fr (993)\nInfomaniak : mail.infomaniak.com (587/993)\nO2switch : votre-domaine.com (465/993)" },
  { id: 'connecter-slack', category: 'integrations', title: 'Connecter Slack', summary: 'Recevoir les alertes dans Slack.', icon: MessageSquare, readTime: '2 min',
    content: "1. Allez dans Intégrations\n2. Cliquez 'Connecter' sur Slack\n3. Sélectionnez votre workspace\n4. Choisissez le canal pour les notifications\n5. Validez\n\nVous recevrez : les alertes d'escalade, les rapports d'activité, les notifications de tickets urgents." },
  { id: 'connecter-gorgias', category: 'integrations', title: 'Connecter Gorgias', summary: 'Traiter les tickets Gorgias automatiquement.', icon: Headphones, readTime: '2 min',
    content: "1. Allez dans Intégrations\n2. Cliquez 'Connecter' sur Gorgias\n3. Entrez votre sous-domaine Gorgias (ex: ma-boutique)\n4. Autorisez Actero\n5. C'est connecté !\n\nL'agent traitera automatiquement les nouveaux tickets Gorgias et répondra directement dans votre interface Gorgias." },
  { id: 'connecter-zendesk', category: 'integrations', title: 'Connecter Zendesk', summary: 'Traiter les tickets Zendesk automatiquement.', icon: Headphones, readTime: '2 min',
    content: "1. Allez dans Intégrations\n2. Cliquez 'Connecter' sur Zendesk\n3. Entrez votre sous-domaine Zendesk\n4. Autorisez Actero\n5. C'est connecté !\n\nL'agent répondra aux tickets Zendesk automatiquement." },
  { id: 'connecter-comptabilite', category: 'integrations', title: 'Connecter Axonaut, Pennylane ou iPaidThat', summary: 'Automatiser la comptabilité.', icon: TrendingUp, readTime: '3 min',
    content: "Axonaut : CRM et facturation pour PME\n→ Intégrations → Axonaut → Collez votre clé API (Paramètres → API)\n\nPennylane : Comptabilité automatisée\n→ Intégrations → Pennylane → Collez votre token (Paramètres → Intégrations → API)\n\niPaidThat : Collecte de factures\n→ Intégrations → iPaidThat → Collez votre clé API (Paramètres → API & Intégrations)\n\nCes outils permettent d'automatiser les relances de factures et le suivi de trésorerie." },
  // Automatisations
  { id: 'activer-automatisations', category: 'automatisations', title: 'Activer vos automatisations', summary: 'Comment activer et choisir les canaux.', icon: Sparkles, readTime: '3 min',
    content: "1. Allez dans Automatisations\n2. Choisissez les canaux pour chaque automatisation (Email, Chat, Gorgias, Zendesk)\n3. Un canal est vert = connecté. Grisé = intégration manquante.\n4. Activez le toggle\n5. C'est en production !\n\nPour désactiver : cliquez le toggle vert. Le widget est automatiquement retiré de votre site." },
  { id: 'sav-ecommerce', category: 'automatisations', title: 'SAV E-commerce', summary: 'Support client automatique 24h/24.', icon: Headphones, readTime: '3 min',
    content: "L'automatisation SAV répond aux questions de vos clients : suivi commande, retours, remboursements, questions produits.\n\nCanaux disponibles :\n- Chat sur le site (nécessite Shopify)\n- Email (nécessite Gmail ou SMTP)\n- Gorgias / Zendesk\n\nL'agent classifie chaque demande, répond avec votre base de connaissances, et escalade vers vous s'il n'est pas sûr de sa réponse." },
  { id: 'relance-paniers', category: 'automatisations', title: 'Relance Paniers Abandonnés', summary: 'Récupérer les ventes perdues.', icon: ShoppingBag, readTime: '2 min',
    content: "Quand un client abandonne son panier sur votre boutique Shopify, l'agent envoie un email de relance personnalisé.\n\nNécessite : Shopify connecté + Email (Gmail ou SMTP)\n\nL'email est personnalisé avec le prénom du client et les produits laissés dans le panier." },
  { id: 'comptabilite-comment-ca-marche', category: 'automatisations', title: 'Comptabilité automatisée : comment ça marche', summary: 'Tout comprendre sur l\'automatisation comptable.', icon: TrendingUp, readTime: '6 min',
    content: "L'automatisation Comptabilité Automatisée gère 4 tâches pour vous :\n\n1. RELANCE DE FACTURES IMPAYÉES\nL'IA détecte automatiquement les factures qui dépassent leur date d'échéance. Elle envoie un email de relance professionnel à votre client avec le montant dû, le numéro de facture et un lien de paiement. Vous définissez le délai (par défaut 7 jours après l'échéance). Si le client ne paie toujours pas, une deuxième relance est envoyée.\n\n2. ALERTES DE TRÉSORERIE\nVous définissez un seuil (par exemple 1000€). Dès que votre solde de trésorerie passe en dessous de ce montant, vous recevez une alerte par email et/ou Slack. Ça vous permet d'anticiper les problèmes de trésorerie avant qu'ils n'arrivent.\n\n3. EXPORTS COMPTABLES AUTOMATIQUES\nChaque semaine, mois ou trimestre (selon votre choix), l'IA génère un export de vos données comptables et vous l'envoie par email. Plus besoin de vous connecter à votre outil comptable pour sortir les chiffres.\n\n4. NOTIFICATIONS\nChaque action comptable (relance envoyée, alerte déclenchée, export généré) vous est notifiée par email et/ou Slack. Vous restez informé sans effort.\n\nPRÉREQUIS\nPour activer cette automatisation, vous devez connecter au moins un outil comptable dans Intégrations :\n- Axonaut : CRM et facturation pour PME\n- Pennylane : comptabilité automatisée, rapprochement bancaire\n- iPaidThat : collecte et classement automatique de factures\n\nSans outil comptable connecté, le toggle d'activation sera bloqué.\n\nCOMMENT ACTIVER\n1. Connectez Axonaut, Pennylane ou iPaidThat dans Intégrations\n2. Allez dans Automatisations → Comptabilité Automatisée\n3. Cliquez le toggle → un assistant de configuration s'ouvre\n4. Choisissez votre outil comptable\n5. Configurez le délai de relance, le seuil de trésorerie et la fréquence des exports\n6. Choisissez les canaux de notification (Email, Slack)\n7. Activez !\n\nL'automatisation commence immédiatement à surveiller vos factures et votre trésorerie." },
  { id: 'agent-vocal', category: 'automatisations', title: 'Configurer l\'agent vocal', summary: 'Donner une voix à votre agent IA.', icon: Mic, readTime: '3 min',
    content: "L'agent vocal permet à vos clients de parler directement à votre agent par la voix sur votre site ou par téléphone.\n\n1. Allez dans Mon Agent → Agent Vocal\n2. Choisissez une voix (masculine, féminine, neutre) et une langue\n3. Ajustez la vitesse de parole et le ton\n4. Testez avec le bouton 'Écouter un exemple'\n5. Activez sur le canal souhaité : widget vocal sur le site, ou numéro de téléphone dédié\n\nL'agent vocal s'appuie sur la même Base de savoir que l'agent texte, donc aucune reconfiguration n'est nécessaire." },
  { id: 'playbooks', category: 'automatisations', title: 'Les playbooks : comment ça marche', summary: 'Scripts préétablis pour vos automatisations.', icon: PlayCircle, readTime: '3 min',
    content: "Un playbook est un scénario prêt à l'emploi que votre agent suit pour traiter un type de demande (ex : retour produit, suivi commande, demande de remboursement).\n\n1. Allez dans Playbooks\n2. Choisissez un modèle (SAV, Paniers, Relances...) ou partez d'un playbook vierge\n3. Éditez les étapes : message d'accueil, questions à poser, conditions d'escalade\n4. Activez le playbook\n\nLes playbooks garantissent que votre agent traite chaque demande de façon cohérente. Vous pouvez les tester dans l'onglet Tester avant activation." },

  // Mon Agent
  { id: 'configurer-ton', category: 'agent-ia', title: 'Configurer le ton', summary: 'Ajuster la personnalité de votre agent.', icon: Sliders, readTime: '3 min',
    content: "Dans Mon Agent, vous avez 3 curseurs :\n\n1. Formel ↔ Casual : à gauche l'agent vouvoie et est très pro, à droite il tutoie et est amical\n2. Froid ↔ Chaleureux : à gauche l'agent est factuel et direct, à droite il est empathique et accueillant\n3. Court ↔ Détaillé : à gauche les réponses font 1-2 phrases, à droite elles sont plus complètes\n\nUne prévisualisation en bas montre à quoi ressemblera une réponse. Ajustez jusqu'à ce que ça corresponde à votre marque, puis sauvegardez." },
  { id: 'base-connaissances', category: 'agent-ia', title: 'Base de connaissances', summary: '3 façons d\'alimenter votre agent.', icon: BookOpen, readTime: '4 min',
    content: "Plus votre agent a d'informations, mieux il répond.\n\n3 méthodes pour ajouter du contenu :\n\n1. Import URL : collez l'adresse de votre page FAQ → l'IA extrait les questions/réponses automatiquement\n\n2. Upload fichier : envoyez un PDF ou TXT (politique retour, catalogue...) → l'IA en extrait les infos clés\n\n3. Ajout manuel : tapez directement une question et sa réponse\n\nToutes les entrées sont modifiables et supprimables. Ajoutez au minimum votre politique de retour et vos délais de livraison." },
  { id: 'escalades', category: 'agent-ia', title: 'Les escalades (À traiter)', summary: 'Quand l\'agent a besoin de vous.', icon: AlertTriangle, readTime: '3 min',
    content: "Quand l'agent n'est pas assez confiant dans sa réponse, il escalade la demande vers vous.\n\nDans l'onglet 'À traiter' vous voyez :\n- Le message du client\n- La réponse proposée par l'IA\n- 3 boutons : Approuver, Modifier, Rejeter\n\nPour réduire les escalades : ajoutez plus de contenu dans la Base de savoir sur les sujets qui reviennent souvent." },
  { id: 'regles', category: 'agent-ia', title: 'Définir vos règles', summary: 'Ce que l\'agent ne doit jamais faire.', icon: Shield, readTime: '3 min',
    content: "Dans Règles, vous définissez les règles & limites de votre agent :\n\n- Ajoutez des règles texte (ex: 'Ne jamais promettre de remboursement sans validation')\n- Utilisez le builder visuel : SI [condition] ALORS [action]\n- Configurez les seuils d'escalade (montant max, confiance minimum)\n\nCes règles sont vérifiées avant chaque réponse de l'agent." },
  // Dashboard
  { id: 'metriques', category: 'dashboard', title: 'Vos métriques', summary: 'Comprendre les chiffres de votre dashboard.', icon: BarChart3, readTime: '3 min',
    content: "Sur votre page d'accueil, 5 chiffres :\n\n1. Tickets résolus : demandes traitées automatiquement\n2. Escalades : demandes en attente de votre réponse\n3. Temps économisé : heures gagnées grâce à l'agent\n4. Actions IA : nombre total d'actions exécutées\n5. ROI généré : valeur financière créée\n\nLes pourcentages en vert/rouge comparent au mois précédent." },
  { id: 'roi', category: 'dashboard', title: 'Configurer le ROI', summary: 'Calculer votre retour sur investissement.', icon: TrendingUp, readTime: '2 min',
    content: "Dans l'onglet ROI, configurez :\n\n- Coût horaire de votre équipe support (ex: 25€/h)\n- Temps moyen par ticket (ex: 5 minutes)\n- Votre abonnement Actero\n\nLe ROI est calculé automatiquement :\nROI = (Temps économisé × Coût horaire) - Abonnement\n\nPlus l'agent traite de tickets, plus le ROI augmente." },
  { id: 'tester', category: 'dashboard', title: 'Tester votre agent', summary: 'Vérifier les réponses avant de lancer.', icon: PlayCircle, readTime: '3 min',
    content: "Dans Tester, vous pouvez :\n\n- Tester chaque automatisation active avec des scénarios pré-faits\n- Cliquer 'Tester tous les playbooks actifs' pour tout vérifier d'un coup\n- Utiliser le chat libre en bas pour poser n'importe quelle question\n\nChaque test montre : la classification, le score de confiance, et la réponse complète de l'agent." },
  { id: 'notifications', category: 'dashboard', title: 'Notifications', summary: 'Choisir quoi recevoir et où.', icon: Bell, readTime: '2 min',
    content: "Cliquez sur votre nom en bas → Notifications.\n\nPour chaque type de notification (escalades, rapports, activité), choisissez le canal : Email, Slack, Push.\n\nVous pouvez aussi activer le mode silencieux pour ne pas recevoir de notifications la nuit." },
  // Facturation
  { id: 'facturation', category: 'billing', title: 'Facturation', summary: 'Gérer votre abonnement.', icon: CreditCard, readTime: '2 min',
    content: "Cliquez sur votre nom en bas → Facturation.\n\nVous voyez votre plan actuel, votre consommation du mois, et pouvez accéder au Portail Stripe pour :\n- Télécharger vos factures\n- Modifier votre carte bancaire\n- Changer de plan" },
  { id: 'limites-plan', category: 'billing', title: 'Comprendre mes limites de plan', summary: 'Tickets, intégrations et workflows inclus.', icon: Shield, readTime: '3 min',
    content: "Chaque plan inclut des quotas :\n\nFree : 50 tickets/mois, 1 intégration, 1 workflow actif\nStarter (99€) : 500 tickets/mois, 3 intégrations, 3 workflows actifs\nPro (399€) : 5 000 tickets/mois, intégrations illimitées, workflows illimités, règles & limites avancées, agents spécialisés, API + webhooks\nEnterprise : sur mesure, volume illimité, SLA dédié\n\nVotre consommation en temps réel est visible dans Facturation. Si vous approchez la limite, une bannière vous prévient." },
  { id: 'upgrade-plan', category: 'billing', title: 'Upgrade : basculer entre plans', summary: 'Changer de plan en un clic.', icon: TrendingUp, readTime: '2 min',
    content: "1. Allez dans Facturation\n2. Cliquez 'Changer de plan'\n3. Sélectionnez le plan souhaité (Starter, Pro, Enterprise)\n4. Vous êtes redirigé vers Stripe pour valider\n\nLes upgrades sont immédiats : vos nouvelles limites et fonctionnalités sont débloquées dès la confirmation. Les downgrades prennent effet à la fin de la période de facturation en cours." },
  { id: 'parrainage', category: 'billing', title: 'Parrainer un ami', summary: '30 jours offerts pour lui, 1 mois de crédit pour vous.', icon: Sparkles, readTime: '2 min',
    content: "1. Allez dans Parrainage (menu latéral)\n2. Copiez votre lien de parrainage personnel\n3. Partagez-le à un ami e-commerçant\n\nRécompenses :\n- Votre filleul bénéficie de 30 jours gratuits sur Actero\n- Vous recevez 1 mois de crédit sur votre abonnement dès qu'il devient client payant\n\nAucune limite : plus vous parrainez, plus vous accumulez de crédit." },
  { id: 'conflits-integrations', category: 'integrations', title: 'Conflits d\'intégrations', summary: 'Pourquoi certaines intégrations sont exclusives.', icon: Plug, readTime: '2 min',
    content: "Certaines catégories d'intégrations sont mutuellement exclusives pour éviter les conflits de données :\n\n- CMS e-commerce : un seul parmi Shopify, WooCommerce, Webflow\n- Helpdesk : un seul parmi Gorgias ou Zendesk\n- Email transactionnel : un seul parmi Resend ou SMTP\n\nPour changer, déconnectez d'abord l'intégration existante, puis connectez la nouvelle. Les autres catégories (Slack, Axonaut, Pennylane, iPaidThat) restent cumulables." },
  { id: 'export-donnees', category: 'dashboard', title: 'Exporter mes données', summary: 'Récupérer vos conversations et métriques.', icon: BarChart3, readTime: '2 min',
    content: "1. Allez dans Activité ou Escalades\n2. Cliquez 'Exporter' en haut à droite\n3. Choisissez le format (CSV, JSON) et la période\n4. Le fichier est téléchargé directement\n\nVous pouvez exporter : conversations, tickets résolus, escalades, métriques ROI, base de connaissances. Les exports respectent le RGPD : vos données vous appartiennent." },
  { id: 'copilot-ia', category: 'getting-started', title: 'Utiliser le Copilot IA', summary: 'La bulle violette qui répond à vos questions.', icon: Brain, readTime: '2 min',
    content: "En bas à droite de votre dashboard, la bulle violette ouvre le Copilot IA.\n\nPosez-lui n'importe quelle question sur Actero :\n- 'Comment ajouter une FAQ dans la base de connaissances ?'\n- 'Pourquoi mon agent escalade trop souvent ?'\n- 'Où je vois mon ROI ce mois-ci ?'\n\nLe Copilot connaît votre configuration, vos intégrations et vos métriques. Il peut aussi vous guider pas à pas dans la plateforme." },
  { id: 'support-contact', category: 'getting-started', title: 'Support : comment nous contacter', summary: 'Notre équipe répond sous 24h.', icon: Headphones, readTime: '1 min',
    content: "Plusieurs moyens de nous joindre :\n\n- Email : support@actero.fr (réponse sous 24h en semaine)\n- Copilot IA : la bulle violette en bas à droite répond à la plupart des questions instantanément\n- Chat support : cliquez 'Contacter le support' dans le menu latéral\n\nLes clients Pro et Enterprise bénéficient d'un support prioritaire avec réponse sous 4h ouvrées." },
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold text-[#1a1a1a]">Centre d'aide</h2>
          <p className="text-[13px] text-[#9ca3af] mt-1">{GUIDES.length} guides pour vous aider à utiliser Actero</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('actero:restart-tour'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-cta bg-cta/[0.08] hover:bg-cta/[0.12] transition-colors"
          title="Relancer le tour produit"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Relancer le tour produit
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4c4c4]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null) }}
          placeholder="Rechercher un guide..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-cta/30"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            !selectedCategory ? 'bg-cta text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
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
                selectedCategory === cat.id ? 'bg-cta text-white' : 'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
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
          <p className="text-[13px]">Aucun guide trouvé pour « {search} »</p>
        </div>
      )}
    </div>
  )
}
