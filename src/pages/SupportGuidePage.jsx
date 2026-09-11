import React, { useState, useEffect } from "react";
import {
  Search, BookOpen, Zap, ShoppingBag, Plug, Shield, BarChart3,
  ArrowRight, ArrowLeft, Mail, ChevronDown, ChevronUp,
  Building2, Headphones, RefreshCw, FileText, UserCheck,
  CheckCircle2, Clock, AlertTriangle, Sparkles, Settings,
  MessageSquare, Phone, CreditCard, Bell, Globe, Sliders,
  Brain, HelpCircle, Send, Key, Calendar, TrendingUp,
  PlayCircle, Volume2, Gift, Users, Terminal, Calculator,
  GitBranch, ArrowUpCircle, Rocket,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { motion, AnimatePresence } from "framer-motion";

// ═══════════════════════════════════════
// GUIDE ARTICLES — Full content pages
// ═══════════════════════════════════════
const GUIDES = [
  // ─────────────────────────────────
  // PREMIERS PAS
  // ─────────────────────────────────
  {
    id: 'comment-fonctionne-actero',
    category: 'getting-started',
    title: 'Comment fonctionne Actero',
    summary: 'Tout comprendre sur la plateforme en 5 minutes.',
    icon: Zap,
    readTime: '5 min',
    sections: [
      {
        title: 'Actero en deux mots',
        content: "Actero est une plateforme qui automatise votre service client grâce a l'intelligence artificielle. Vous connectez vos outils (Shopify, votre email, Gorgias...), vous activez des automatisations, et l'IA répond a vos clients 24h/24, 7j/7. Vous gardez le contrôle total : chaque réponse que l'IA n'est pas sure de donner vous est soumise pour validation. C'est comme avoir un employé supplémentaire qui ne dort jamais et qui apprend de vos corrections.",
      },
      {
        title: 'Les 3 grandes étapes',
        content: "1. Vous connectez vos outils : Shopify pour vos commandes, Gmail ou un email pro pour les messages, et eventuellement Gorgias ou Zendesk si vous les utilisez déjà. Tout se fait en quelques clics depuis votre dashboard.\n\n2. Vous activez les automatisations : SAV, relance de paniers abandonnés, comptabilité... Choisissez celles qui vous concernent et sur quels canaux elles doivent fonctionner.\n\n3. L'IA travaille pour vous : elle répond aux emails, traite les tickets, relance les paniers. Vous suivez tout en temps réel dans votre dashboard et vous intervenez uniquement quand l'IA a besoin de vous.",
      },
      {
        title: 'Ce que fait l\'IA concretement',
        content: "Quand un client envoie un email pour savoir ou est son colis, l'IA va chercher la commande dans Shopify, verifie le statut de livraison, et répond au client avec les bonnes informations. Quand un client veut un retour, l'IA verifie votre politique de retour et guide le client. Quand un panier est abandonné, l'IA envoie un email de relance personnalisé. Tout ça se passe automatiquement, sans que vous leviez le petit doigt.",
      },
      {
        title: 'Vous gardez le contrôle',
        content: "L'IA ne fait rien dans votre dos. Si elle n'est pas sure d'une réponse, elle vous la soumet dans l'onglet 'A traiter'. Vous pouvez approuver, modifier ou rejeter. Plus vous validez des réponses, plus l'IA devient précise pour votre boutique. Vous définissez aussi les règles : par exemple, ne jamais proposer un remboursement au-dessus de 100 euros sans votre accord.",
      },
    ],
  },
  {
    id: 'premier-jour-actero',
    category: 'getting-started',
    title: 'Votre premier jour sur Actero',
    summary: 'De la connexion a votre première automatisation active, étape par étape.',
    icon: Clock,
    readTime: '6 min',
    sections: [
      {
        title: 'Se connecter pour la première fois',
        content: "Après votre inscription, vous recevez un email avec un lien pour accéder a votre dashboard. Cliquez dessus et connectez-vous avec votre email et mot de passe. Vous arrivez sur la page Vue d'ensemble qui affiche une checklist d'onboarding. Cette checklist vous guide étape par étape pour tout configurer. Suivez-la dans l'ordre, c'est le chemin le plus rapide.",
      },
      {
        title: 'Étape 1 : Connecter Shopify',
        content: "Cliquez sur Intégrations dans le menu à gauche. Trouvez Shopify et cliquez Connecter. Vous êtes redirigé vers la fiche Actero sur l'App Store Shopify : cliquez Installer et autorisez l'accès. Aucune adresse à saisir, Shopify transmet votre boutique. Acceptez et c'est fait. Actero peut maintenant accéder a vos commandes, clients et produits en lecture seule.",
      },
      {
        title: 'Étape 2 : Connecter votre email',
        content: "Toujours dans Intégrations, connectez Gmail (un clic, autorisation Google) ou votre email professionnel via SMTP/IMAP. C'est indispensable pour que l'IA puisse envoyer et recevoir des emails en votre nom. Si vous utilisez Gorgias ou Zendesk, connectez-les aussi a cette étape.",
      },
      {
        title: 'Étape 3 : Configurer votre agent',
        content: "Allez dans Mon Agent dans le menu. Reglez le ton de votre agent avec les 3 curseurs (formel ou casual, froid ou chaleureux, court ou detaille). Ajoutez votre politique de retour et vos FAQ dans la base de connaissances. Plus vous en mettez, meilleures seront les réponses. Vous pouvez importer automatiquement depuis une URL de votre site.",
      },
      {
        title: 'Étape 4 : Activer votre première automatisation',
        content: "Allez dans Automatisations. Commencez par le SAV E-commerce : sélectionnez les canaux (Email, Chat sur le site...) et activez le toggle. L'IA commence a travailler immédiatement. Surveillez les premiers tickets dans l'onglet Activité et les escalades dans A traiter. Felicitations, votre agent est en ligne !",
      },
      {
        title: 'Les jours suivants',
        content: "Pendant les premiers jours, gardez un oeil sur les escalades. Chaque escalade est une occasion d'apprendre a votre agent : approuvez les bonnes réponses, corrigez les mauvaises. En une semaine, l'IA connait déjà les cas les plus frequents de votre boutique. Après 2-3 semaines, le taux de resolution automatique se stabilise généralement entre 70 et 85%.",
      },
    ],
  },
  {
    id: 'problèmes-frequents',
    category: 'getting-started',
    title: 'Problèmes frequents et solutions',
    summary: 'Les soucis les plus courants et comment les résoudre rapidement.',
    icon: HelpCircle,
    readTime: '5 min',
    sections: [
      {
        title: 'Mon agent répond mal ou a cote',
        content: "C'est presque toujours un problème de base de connaissances. Vérifiez dans Mon Agent si le sujet est couvert. Si votre client pose une question sur les retours et que votre politique de retour n'est pas renseignee, l'agent ne peut pas bien répondre. Ajoutez l'information manquante et testez a nouveau. Pensez aussi a vérifier que vos instructions ne sont pas contradictoires (par exemple, demander un ton amical mais imposer le vouvoiement strict).",
      },
      {
        title: 'Je ne recois plus de notifications',
        content: "Plusieurs causes possibles. D'abord, vérifiez vos préférences dans la section Notifications : les toggles sont peut-être desactives. Ensuite, regardez dans vos spams car les emails Actero viennent de notifications@actero.fr. Si vous utilisez Slack, allez dans Intégrations et vérifiez que la connexion Slack est toujours active (badge vert). Enfin, vérifiez que le mode silencieux n'est pas active sur une plage horaire trop large.",
      },
      {
        title: 'Erreur lors de la connexion Shopify',
        content: "Assurez-vous d'avoir les droits administrateur sur la boutique : un compte staff sans ces droits ne peut pas installer d'application. Si ça ne marche toujours pas, essayez de déconnecter puis reconnecter. Vous pouvez aussi lancer un Diagnostic depuis la Vue d'ensemble pour voir ou ça bloque.",
      },
      {
        title: 'Le dashboard ne se charge pas',
        content: "Essayez de rafraichir la page avec Ctrl+R (ou Cmd+R sur Mac). Si ça persiste, videz le cache de votre navigateur ou essayez en navigation privee. Si le problème continue, il peut y avoir une maintenance en cours. Vérifiez vos emails pour d'eventuelles notifications de maintenance. Vous pouvez toujours nous ecrire a contact@actero.fr.",
      },
      {
        title: 'Mon intégration affiche une erreur',
        content: "Si une intégration montre un badge rouge, cliquez sur le bouton Tester pour vérifier la connexion. Si le test échoué, essayez Reconnecter. Si c'est une intégration par cle API (Resend, Axonaut, Pennylane...), vérifiez que la cle est toujours valide dans l'outil d'origine. Parfois, les cles expirent ou sont revoquees. Regenerez-en une nouvelle et mettez-la a jour dans Actero.",
      },
    ],
  },

  // ─────────────────────────────────
  // INTEGRATIONS
  // ─────────────────────────────────
  {
    id: 'choisir-ecommerce',
    category: 'intégrations',
    title: 'Comment choisir entre Shopify, WooCommerce et Webflow',
    summary: 'Une seule plateforme e-commerce peut être connectee. Voici comment choisir.',
    icon: GitBranch,
    readTime: '3 min',
    sections: [
      {
        title: 'La règle : une seule e-commerce a la fois',
        content: "Actero autorise une seule intégration e-commerce active parmi Shopify, WooCommerce et Webflow. Si vous essayez d'en connecter une deuxieme, l'interface vous demandera de déconnecter la première. Cette règle evite les doublons de commandes et les conflits de données.",
      },
      {
        title: 'Choisir selon votre stack',
        content: "- Shopify : si votre boutique est déjà sur Shopify ou Shopify Plus. Connexion OAuth en un clic, synchronisation complète.\n- WooCommerce : si votre site tourne sous WordPress avec le plugin WooCommerce. Connexion via cles API REST.\n- Webflow : si votre site est sur Webflow avec Webflow Ecommerce. Connexion via token API Webflow.",
      },
      {
        title: 'Que faire si vous changez de plateforme',
        content: "Vous migrez de WooCommerce vers Shopify ? Deconnectez WooCommerce dans Intégrations, puis connectez Shopify. Les données historiques restent dans Actero, seules les nouvelles commandes proviendront de la nouvelle plateforme. Pensez a re-tester votre agent après le changement.",
      },
      {
        title: 'Les autres groupes de conflit',
        content: "La même logique s'applique a :\n- Helpdesk : Gorgias OU Zendesk (pas les deux)\n- Email : Resend OU SMTP personnalisé (pas les deux)\n\nToutes les autres intégrations (Slack, Axonaut, Pennylane, iPaidThat) se cumulent sans limite.",
      },
    ],
  },
  {
    id: 'connecter-shopify',
    category: 'intégrations',
    title: 'Connecter Shopify',
    summary: 'Relier votre boutique Shopify en un clic pour synchroniser commandes, clients et produits.',
    icon: ShoppingBag,
    readTime: '4 min',
    sections: [
      {
        title: 'A quoi sert la connexion Shopify',
        content: "Shopify est le coeur de votre boutique. En le connectant a Actero, votre agent IA peut accéder a vos commandes, vos clients, vos produits et vos livraisons. Grâce a ça, quand un client demande ou est son colis ou veut faire un retour, l'agent a toutes les informations pour répondre. Actero accede a vos données en lecture seule : il ne modifie jamais rien dans votre boutique.",
      },
      {
        title: 'Comment connecter, étape par étape',
        content: "1. Connectez-vous a votre dashboard Actero\n2. Cliquez sur Intégrations dans le menu a gauche\n3. Trouvez la carte Shopify et cliquez Connecter\n4. Vous êtes redirigé vers la fiche Actero sur l'App Store Shopify. Aucune adresse à saisir : Shopify sait de quelle boutique il s'agit.\n5. Cliquez Installer l'application et autorisez les accès demandés.\n7. Vous revenez automatiquement sur Actero. Un badge vert Connecte apparait.",
      },
      {
        title: 'Quelles données sont synchronisees',
        content: "Actero synchronise en lecture les informations suivantes : les commandes (numéro, statut, montant, date), les clients (nom, email, historique), les produits (titre, description, prix, stock), les livraisons (transporteur, numéro de suivi, statut), et les paniers abandonnés. Aucune donnee n'est modifiee cote Shopify. Actero ne peut pas passer de commande, modifier un prix ou supprimer un produit.",
      },
      {
        title: 'Si ça ne marche pas',
        content: "Vérifiez que vous êtes bien administrateur de votre boutique Shopify : un compte staff sans droits admin ne peut pas installer d'application. Vérifiez aussi que vous êtes connecté à la bonne boutique dans Shopify Admin avant de lancer l'installation. Si l'erreur persiste, lancez un Diagnostic depuis la Vue d'ensemble de votre dashboard ou contactez-nous a contact@actero.fr.",
      },
    ],
  },
  {
    id: 'connecter-gmail',
    category: 'intégrations',
    title: 'Connecter Gmail',
    summary: 'Utiliser votre compte Gmail pour envoyer et recevoir les emails via Actero.',
    icon: Mail,
    readTime: '3 min',
    sections: [
      {
        title: 'Pourquoi connecter Gmail',
        content: "Gmail permet a votre agent IA d'envoyer et de recevoir des emails. Quand un client vous ecrit, l'agent lit le message, analyse la demande, et répond automatiquement depuis votre adresse Gmail. C'est le moyen le plus simple de démarrer si vous n'avez pas d'email professionnel dedie.",
      },
      {
        title: 'Comment connecter',
        content: "1. Allez dans Intégrations dans votre dashboard\n2. Trouvez Gmail et cliquez Connecter\n3. Une fenetre Google s'ouvre : sélectionnez votre compte Gmail\n4. Autorisez Actero a lire et envoyer des emails en votre nom\n5. Vous revenez sur Actero, un badge vert confirme la connexion\n\nC'est une connexion OAuth sécurisée. Actero n'a jamais accès a votre mot de passe. Vous pouvez revoquer l'accès a tout moment depuis les paramètres de votre compte Google.",
      },
      {
        title: 'Ce que fait Actero avec Gmail',
        content: "Actero surveille les nouveaux emails entrants et les traite automatiquement selon vos automatisations actives. Si le SAV est active sur le canal Email, l'agent lit le message du client, cherche les informations dans Shopify, et répond. L'email de réponse est envoye depuis votre adresse Gmail, le client ne voit aucune difference avec un email envoye par vous.",
      },
      {
        title: 'Gmail ou email personnalisé ?',
        content: "Si votre adresse de support est une adresse Gmail (comme maboutique.sav@gmail.com), connectez Gmail. Si vous avez une adresse professionnelle (comme contact@maboutique.com hébergée chez OVH, Ionos ou autre), utilisez plutot l'intégration Email personnalisé (SMTP/IMAP). Consultez le guide dedie pour les details.",
      },
    ],
  },
  {
    id: 'connecter-email-smtp',
    category: 'intégrations',
    title: 'Connecter un email SMTP/IMAP',
    summary: 'Utiliser votre adresse email professionnelle (contact@votreboutique.com) avec Actero.',
    icon: Send,
    readTime: '5 min',
    sections: [
      {
        title: 'Pourquoi utiliser un email professionnel',
        content: "Si vous avez une adresse comme contact@maboutique.com ou sav@maboutique.com, vos clients recoivent les réponses depuis cette adresse officielle. Ça fait plus serieux qu'une adresse Gmail. La connexion se fait via les protocoles SMTP (pour envoyer) et IMAP (pour recevoir). Ça parait technique, mais on va tout vous expliquer simplement.",
      },
      {
        title: 'Les informations a preparer',
        content: "Avant de commencer, rassemblez ces informations aupres de votre hebergeur email :\n\n- Votre adresse email complète (ex: contact@maboutique.com)\n- Le serveur SMTP et son port (pour envoyer des emails)\n- Le serveur IMAP et son port (pour recevoir des emails)\n- Votre identifiant (souvent l'adresse email elle-même)\n- Votre mot de passe email\n\nSi vous ne savez pas ou trouver ces infos, regardez la section Hebergeurs courants ci-dessous.",
      },
      {
        title: 'Comment connecter',
        content: "1. Allez dans Intégrations dans votre dashboard\n2. Trouvez Email personnalisé (SMTP/IMAP) dans la liste\n3. Cliquez Configurer\n4. Remplissez chaque champ : adresse email, serveur SMTP, port SMTP, serveur IMAP, port IMAP, identifiant et mot de passe\n5. Laissez la case SSL/TLS cochee (c'est la valeur par defaut et c'est recommande)\n6. Cliquez Connecter\n7. Actero teste automatiquement la connexion. Si tout est bon, un badge vert apparait.",
      },
      {
        title: 'Paramètres des hebergeurs courants',
        content: "OVH / OVHcloud :\nSMTP : ssl0.ovh.net, port 587\nIMAP : ssl0.ovh.net, port 993\n\nIonos (1&1) :\nSMTP : smtp.ionos.fr, port 587\nIMAP : imap.ionos.fr, port 993\n\nInfomaniak :\nSMTP : mail.infomaniak.com, port 587\nIMAP : mail.infomaniak.com, port 993\n\nO2switch :\nSMTP : votre-domaine.com, port 465\nIMAP : votre-domaine.com, port 993\n(Remplacez votre-domaine.com par votre vrai nom de domaine)\n\nSi votre hebergeur n'est pas dans la liste, cherchez sur Google : 'paramètres SMTP + le nom de votre hebergeur'. Vous trouverez les infos en 30 secondes.",
      },
      {
        title: 'En cas de problème',
        content: "Si la connexion échoué, vérifiez d'abord que le mot de passe est correct en vous connectant directement a votre webmail. Vérifiez aussi que le port est le bon (587 pour SMTP est le plus courant, 993 pour IMAP). Certains hebergeurs demandent d'activer l'accès IMAP dans les paramètres du compte email. Si vous avez active la double authentification, vous devrez peut-être creer un mot de passe spécifique pour les applications.",
      },
    ],
  },
  {
    id: 'email-resend-vs-smtp',
    category: 'intégrations',
    title: 'Quelle intégration email choisir : Resend ou SMTP',
    summary: 'Les differences entre Resend (cle API) et SMTP personnalisé, et laquelle choisir.',
    icon: Mail,
    readTime: '3 min',
    sections: [
      {
        title: 'Une seule intégration email a la fois',
        content: "Vous devez choisir entre Resend ET SMTP personnalisé : les deux ne peuvent pas être actives en même temps. Les deux permettent d'envoyer les emails de l'agent (réponses SAV, relances, notifications).",
      },
      {
        title: 'Resend (recommande)',
        content: "Resend est un service d'envoi d'email transactionnel moderne. Connexion en 30 secondes avec une cle API.\n\nAvantages :\n- Setup ultra rapide\n- Deliverabilite premium (SPF/DKIM geres automatiquement)\n- Dashboard de suivi des emails envoyes\n- 3 000 emails/mois gratuits chez Resend\n\nIdeal si : vous demarrez, vous voulez le moins de friction possible, ou vous n'avez pas de domaine pro configure.",
      },
      {
        title: 'SMTP personnalisé',
        content: "Utilise votre propre serveur email (OVH, Ionos, Infomaniak, Google Workspace, etc.). Les emails partent depuis votre adresse pro existante (contact@maboutique.com).\n\nAvantages :\n- Vos emails partent depuis votre domaine officiel\n- Continuite avec l'email que vos clients connaissent déjà\n- Pas de service tiers supplémentaire\n\nIdeal si : vous avez déjà une adresse pro active et voulez conserver une signature de marque forte.",
      },
      {
        title: 'Comment changer',
        content: "Pour passer de l'un a l'autre : Intégrations > déconnecter l'actuel > connecter le nouveau. Aucune donnee n'est perdue. Les automatisations actives basculent automatiquement sur le nouveau canal email.",
      },
    ],
  },
  {
    id: 'connecter-slack',
    category: 'intégrations',
    title: 'Connecter Slack',
    summary: 'Recevoir les alertes, escalades et rapports directement dans votre Slack.',
    icon: MessageSquare,
    readTime: '3 min',
    sections: [
      {
        title: 'Pourquoi connecter Slack',
        content: "Avec Slack connecte, vous etes informe en temps réel sans ouvrir le dashboard Actero. Vous recevez les alertes d'escalade quand l'IA transfere une demande, les notifications de tickets urgents, les rapports d'activité quotidiens, et les alertes de performance (par exemple si le taux d'escalade augmente). Tout arrive directement dans un canal Slack de votre choix.",
      },
      {
        title: 'Comment connecter',
        content: "1. Allez dans Intégrations dans votre dashboard\n2. Trouvez Slack dans la liste (il est marque comme Recommande)\n3. Cliquez Connecter\n4. Une fenetre Slack s'ouvre : sélectionnez votre workspace\n5. Choisissez le canal ou vous voulez recevoir les notifications (par exemple #actero-alertes)\n6. Cliquez Autoriser\n7. Vous revenez sur Actero avec un badge vert Connecte",
      },
      {
        title: 'Ce que vous recevrez',
        content: "Une fois connecte, voici ce qui arrive dans votre canal Slack : les nouvelles escalades avec un résumé de la demande du client, les alertes urgentes (par exemple un client tres mecontent), les rapports de performance si vous les avez actives, et les alertes de trésorerie si vous utilisez l'automatisation comptabilité. Vous pouvez personnaliser les types de notifications dans la section Notifications de votre dashboard.",
      },
    ],
  },
  {
    id: 'connecter-gorgias',
    category: 'intégrations',
    title: 'Connecter Gorgias',
    summary: 'Laisser l\'IA traiter automatiquement vos tickets Gorgias.',
    icon: Headphones,
    readTime: '4 min',
    sections: [
      {
        title: 'A quoi sert la connexion Gorgias',
        content: "Si vous utilisez déjà Gorgias pour gerer votre support client, Actero peut s'y brancher directement. L'IA lit les nouveaux tickets qui arrivent dans Gorgias, les analyse, et y répond automatiquement. Vous n'avez pas besoin de changer vos habitudes : tout se passe dans Gorgias, mais c'est l'IA qui fait le travail. Les tickets que l'IA ne sait pas traiter sont escalades vers vous.",
      },
      {
        title: 'Comment connecter',
        content: "1. Allez dans Intégrations\n2. Trouvez Gorgias et cliquez Connecter\n3. Entrez votre sous-domaine Gorgias. C'est la première partie de l'URL de votre compte : si votre compte est ma-boutique.gorgias.com, tapez simplement ma-boutique.\n4. Cliquez Connecter. Vous etes redirige vers Gorgias.\n5. Autorisez Actero a accéder a votre compte Gorgias.\n6. Vous revenez sur Actero avec un badge vert Connecte.",
      },
      {
        title: 'Comment l\'IA traite vos tickets',
        content: "Quand un nouveau ticket arrive dans Gorgias, l'IA le lit et decide si elle peut le traiter. Si oui, elle redige une réponse en respectant votre ton de marque et vos règles, puis la publie directement dans le ticket Gorgias. Si elle n'est pas sure, elle escalade le ticket vers vous. Le ticket est alors visible dans l'onglet A traiter de votre dashboard Actero, en plus de Gorgias.",
      },
      {
        title: 'Gorgias + les autres canaux',
        content: "Vous pouvez utiliser Gorgias en même temps que les autres canaux (Email, Chat...). Par exemple, l'IA répond aux emails via Gmail ET aux tickets via Gorgias. Quand vous activez l'automatisation SAV, il suffit de cocher le canal Gorgias en plus du canal Email. Les deux fonctionnent en parallele, sans conflit.",
      },
    ],
  },
  {
    id: 'connecter-zendesk',
    category: 'intégrations',
    title: 'Connecter Zendesk',
    summary: 'Automatiser le traitement de vos tickets Zendesk avec l\'IA.',
    icon: Headphones,
    readTime: '4 min',
    sections: [
      {
        title: 'A quoi sert la connexion Zendesk',
        content: "Si votre helpdesk est Zendesk, Actero s'y connecte pour traiter automatiquement les tickets entrants. L'IA lit chaque nouveau ticket, comprend la demande, verifie les informations dans Shopify si besoin, et répond directement dans Zendesk. Vos clients recoivent la réponse comme s'il s'agissait d'un agent humain. Tout reste dans Zendesk, Actero travaille en coulisses.",
      },
      {
        title: 'Comment connecter',
        content: "1. Allez dans Intégrations\n2. Trouvez Zendesk et cliquez Connecter\n3. Entrez votre sous-domaine Zendesk. Si votre URL est ma-boutique.zendesk.com, tapez ma-boutique.\n4. Cliquez Connecter. Vous etes redirige vers Zendesk.\n5. Connectez-vous a Zendesk si ce n'est pas déjà fait et autorisez Actero.\n6. Retour automatique sur Actero avec un badge vert Connecte.",
      },
      {
        title: 'Comment l\'IA traite vos tickets Zendesk',
        content: "Le fonctionnement est le même qu'avec Gorgias : chaque nouveau ticket est lu et analyse par l'IA. Si elle peut répondre avec confiance, elle le fait. Sinon, elle escalade. L'IA respecte vos règles & limites, votre ton de marque, et utilise votre base de connaissances pour formuler ses réponses. Les tickets traites par l'IA sont tagges automatiquement dans Zendesk pour que vous puissiez les retrouver facilement.",
      },
    ],
  },
  {
    id: 'connecter-axonaut',
    category: 'intégrations',
    title: 'Connecter Axonaut',
    summary: 'Relier votre CRM et facturation Axonaut pour la comptabilité automatisee.',
    icon: FileText,
    readTime: '3 min',
    sections: [
      {
        title: 'A quoi sert Axonaut dans Actero',
        content: "Axonaut est un logiciel de CRM et facturation pour les PME. En le connectant, Actero peut automatiser vos relances de factures, synchroniser vos données clients entre Shopify et Axonaut, et suivre votre trésorerie. C'est particulierement utile si vous utilisez l'automatisation Comptabilité Automatisee.",
      },
      {
        title: 'Trouver votre cle API',
        content: "1. Connectez-vous a votre compte Axonaut\n2. Allez dans Paramètres (roue crantee en haut a droite)\n3. Cliquez sur API\n4. Votre cle API est affichee (elle commence par ak_)\n5. Copiez-la",
      },
      {
        title: 'Connecter dans Actero',
        content: "1. Allez dans Intégrations\n2. Trouvez Axonaut et cliquez Connecter\n3. Collez votre cle API\n4. Cliquez Connecter\n5. La connexion est testee automatiquement. Badge vert si tout va bien.",
      },
    ],
  },
  {
    id: 'connecter-pennylane',
    category: 'intégrations',
    title: 'Connecter Pennylane',
    summary: 'Automatiser votre comptabilité avec Pennylane : factures, rapprochements, bilan.',
    icon: TrendingUp,
    readTime: '3 min',
    sections: [
      {
        title: 'A quoi sert Pennylane dans Actero',
        content: "Pennylane est un logiciel de comptabilité en ligne. En le connectant, Actero peut automatiser le rapprochement bancaire, exporter vos factures Shopify vers Pennylane, et vous alerter sur votre trésorerie. C'est idéal si votre comptable utilise déjà Pennylane et que vous voulez automatiser les flux entre votre boutique et votre compta.",
      },
      {
        title: 'Trouver votre token API',
        content: "1. Connectez-vous a votre compte Pennylane\n2. Allez dans Paramètres puis Intégrations\n3. Cliquez sur API\n4. Generez un nouveau token (il commence par pl_)\n5. Copiez-le immédiatement car il ne s'affiche qu'une fois",
      },
      {
        title: 'Connecter dans Actero',
        content: "1. Allez dans Intégrations\n2. Trouvez Pennylane et cliquez Connecter\n3. Collez votre token API\n4. Cliquez Connecter\n5. La connexion est verifiee. Si c'est bon, vous verrez un badge vert.",
      },
    ],
  },
  {
    id: 'connecter-ipaidthat',
    category: 'intégrations',
    title: 'Connecter iPaidThat',
    summary: 'Collecte automatique de vos factures et justificatifs comptables.',
    icon: FileText,
    readTime: '3 min',
    sections: [
      {
        title: 'A quoi sert iPaidThat dans Actero',
        content: "iPaidThat collecte et classe automatiquement vos factures et justificatifs. En le connectant a Actero, vos factures Shopify et vos justificatifs de depenses sont automatiquement envoyes vers iPaidThat. Plus besoin de télécharger et trier vos factures a la main. C'est un gain de temps enorme pour votre comptabilité.",
      },
      {
        title: 'Trouver votre cle API',
        content: "1. Connectez-vous a votre compte iPaidThat\n2. Allez dans Paramètres\n3. Cliquez sur API et Intégrations\n4. Generez ou copiez votre cle API (elle commence par ipt_)\n5. Gardez-la prete pour l'étape suivante",
      },
      {
        title: 'Connecter dans Actero',
        content: "1. Allez dans Intégrations\n2. Trouvez iPaidThat et cliquez Connecter\n3. Collez votre cle API\n4. Cliquez Connecter\n5. C'est fait ! Vos factures seront desormais envoyees automatiquement.",
      },
    ],
  },
  {
    id: 'connecter-calendly-calcom',
    category: 'intégrations',
    title: 'Connecter Calendly ou Cal.com',
    summary: 'Permettre a l\'IA de proposer des creneaux et prendre des rendez-vous automatiquement.',
    icon: Calendar,
    readTime: '4 min',
    sections: [
      {
        title: 'A quoi ça sert',
        content: "En connectant Calendly ou Cal.com, votre agent IA peut proposer des creneaux de rendez-vous a vos clients ou prospects et les reserver automatiquement. C'est tres utile pour les agences immobilieres (visites de biens), les consultants, ou toute activité qui necessite de la prise de rendez-vous. Quand un prospect demande un RDV, l'IA verifie vos disponibilites et lui propose les creneaux libres.",
      },
      {
        title: 'Connecter Calendly',
        content: "1. Connectez-vous a Calendly\n2. Allez dans Intégrations puis API et Webhooks\n3. Cliquez sur Generer un token personnel\n4. Copiez le token (il commence par eyJ...)\n5. Dans Actero, allez dans Intégrations, trouvez Calendly et cliquez Connecter\n6. Collez votre token et validez",
      },
      {
        title: 'Connecter Cal.com',
        content: "1. Connectez-vous a Cal.com\n2. Allez dans Settings puis Developer puis API Keys\n3. Cliquez sur Create a new API Key\n4. Copiez la cle (elle commence par cal_live_)\n5. Dans Actero, allez dans Intégrations, trouvez Cal.com et cliquez Connecter\n6. Collez votre cle et validez",
      },
      {
        title: 'Comment l\'IA utilise votre agenda',
        content: "Une fois connecte, l'IA a accès a vos disponibilites. Quand un client ou prospect demande un rendez-vous, l'agent lui propose les prochains creneaux disponibles. Si le client en choisit un, le rendez-vous est cree automatiquement dans votre agenda. Vous et le client recevez un email de confirmation. C'est entièrement automatique, vous n'avez rien a faire.",
      },
    ],
  },
  {
    id: 'connecter-intercom-crisp',
    category: 'intégrations',
    title: 'Connecter Intercom ou Crisp',
    summary: 'Brancher votre chat en direct pour que l\'IA reponde aux conversations.',
    icon: MessageSquare,
    readTime: '4 min',
    sections: [
      {
        title: 'A quoi ça sert',
        content: "Si vous utilisez Intercom ou Crisp pour le chat en direct sur votre site, Actero peut s'y connecter pour répondre automatiquement aux conversations. L'IA traite les messages entrants, répond aux questions courantes, et escalade les cas complexes vers votre équipe. Vous gardez votre outil de chat habituel, mais avec un agent IA qui répond en premier.",
      },
      {
        title: 'Connecter Intercom',
        content: "1. Connectez-vous a Intercom\n2. Allez dans Settings puis Developers puis Access Token\n3. Copiez votre token d'accès (il commence par dG9r...)\n4. Dans Actero, allez dans Intégrations, trouvez Intercom et cliquez Connecter\n5. Collez votre token et validez\n6. Badge vert = c'est connecte",
      },
      {
        title: 'Connecter Crisp',
        content: "1. Connectez-vous a Crisp\n2. Allez dans Settings puis Website Settings puis Setup instructions\n3. Copiez votre identifiant de site (un long code au format xxxx-xxxx-xxxx-xxxx)\n4. Dans Actero, allez dans Intégrations, trouvez Crisp et cliquez Connecter\n5. Collez l'identifiant et validez",
      },
      {
        title: 'Chat Actero vs Intercom/Crisp',
        content: "Si vous n'avez pas encore de solution de chat, sachez qu'Actero inclut son propre widget de chat integrable sur votre site. Pas besoin d'Intercom ou Crisp. Mais si vous les utilisez déjà et que vos équipes y sont habituees, il est plus simple de les connecter plutot que de changer d'outil.",
      },
    ],
  },

  {
    id: 'configurer-mcp-claude-desktop',
    category: 'intégrations',
    title: 'Configurer le serveur MCP avec Claude Desktop',
    summary: 'Brancher Actero directement dans Claude Desktop ou Cursor via MCP.',
    icon: Terminal,
    readTime: '4 min',
    sections: [
      {
        title: "Qu'est-ce que MCP",
        content: "MCP (Model Context Protocol) est un standard ouvert qui permet a des assistants IA comme Claude Desktop ou Cursor d'accéder a vos données Actero. Une fois connecte, vous pouvez demander dans Claude : \"Résumé-moi les escalades Actero du jour\" ou \"Quel est le taux de resolution ce mois-ci ?\". Claude appellera Actero en temps réel.",
      },
      {
        title: "URL du serveur Actero",
        content: "L'endpoint MCP public d'Actero est :\n\nhttps://actero.fr/api/mcp\n\nL'authentification se fait via OAuth (pas de cle API a copier). Vous vous connectez a votre compte Actero lors de la premiere utilisation.",
      },
      {
        title: "Configurer Claude Desktop",
        content: "1. Ouvrez Claude Desktop\n2. Settings > Developer > Edit Config\n3. Ajoutez dans claude_desktop_config.json :\n\n{\n  \"mcpServers\": {\n    \"actero\": {\n      \"url\": \"https://actero.fr/api/mcp\"\n    }\n  }\n}\n\n4. Sauvegardez et relancez Claude Desktop\n5. Au premier appel, Claude ouvrira une fenetre d'authentification OAuth Actero",
      },
      {
        title: "Configurer Cursor",
        content: "1. Cursor > Settings > MCP\n2. Ajoutez un nouveau serveur avec l'URL https://actero.fr/api/mcp\n3. Sauvegardez\n4. Authentifiez-vous via OAuth au premier appel",
      },
      {
        title: "Ce que vous pouvez demander",
        content: "Une fois connecte, exemples de requêtes :\n- \"Liste les 5 dernières escalades Actero\"\n- \"Quelles intégrations sont connectees ?\"\n- \"Quel est mon ROI ce mois-ci ?\"\n- \"Montre-moi la conversation du ticket #1234\"\n\nClaude appellera les bons endpoints Actero et synthetisera la réponse.",
      },
    ],
  },

  // ─────────────────────────────────
  // AUTOMATISATIONS
  // ─────────────────────────────────
  {
    id: 'activer-automatisations',
    category: 'automatisations',
    title: 'Activer vos automatisations',
    summary: 'Comment choisir, configurer et activer les automatisations sur vos canaux.',
    icon: Sparkles,
    readTime: '5 min',
    sections: [
      {
        title: 'Qu\'est-ce qu\'une automatisation',
        content: "Une automatisation, c'est une tache que votre agent IA fait tout seul, sans que vous ayez a intervenir. Répondre aux emails des clients, relancer un panier abandonné, classer une facture... tout ça, l'IA le fait a votre place. Il vous suffit de choisir quelles automatisations activer et sur quels canaux (email, chat, Gorgias, Zendesk, etc.).",
      },
      {
        title: 'Les automatisations disponibles',
        content: "Actero propose 3 automatisations principales :\n\n- SAV E-commerce : répond aux questions de vos clients (ou est mon colis, je veux un retour, problème de taille...)\n- Relance Paniers Abandonnés : detecte les paniers laisses a l'abandon et envoie des emails de relance personnalisés\n- Comptabilité Automatisee : relance les factures impayees, exporte les données comptables, alerte sur la trésorerie",
      },
      {
        title: 'Comment activer une automatisation',
        content: "1. Allez dans Automatisations dans le menu a gauche\n2. Trouvez l'automatisation qui vous interesse\n3. Choisissez les canaux en cliquant sur les boutons sous l'automatisation (Email, Chat, Gorgias, Zendesk, SMS...)\n4. Un canal grise signifie que l'intégration correspondante n'est pas encore connectee. Connectez-la d'abord dans Intégrations.\n5. Une fois au moins un canal selectionne, cliquez le toggle pour activer\n6. L'agent commence a travailler immédiatement",
      },
      {
        title: 'Désactiver ou changer les canaux',
        content: "Pour désactiver, cliquez simplement sur le toggle vert. L'automatisation s'arrete instantanement. Toute votre configuration est conservee, vous pouvez la réactiver quand vous voulez. Pour modifier les canaux, cliquez ou decliquez les boutons de canal. Les changements sont sauvegardes automatiquement. Par exemple, vous pouvez commencer avec le canal Email seul puis ajouter le Chat plus tard.",
      },
    ],
  },
  {
    id: 'sav-ecommerce',
    category: 'automatisations',
    title: 'SAV E-commerce',
    summary: 'Comment l\'IA répond automatiquement aux demandes de vos clients : suivi, retours, FAQ.',
    icon: Headphones,
    readTime: '5 min',
    sections: [
      {
        title: 'Ce que fait le SAV automatise',
        content: "L'automatisation SAV E-commerce est le coeur d'Actero. Elle traite automatiquement les demandes les plus courantes de vos clients : ou est mon colis, je veux faire un retour, quand vais-je être rembourse, est-ce que ce produit est disponible en telle taille, etc. L'IA consulte vos commandes Shopify, votre base de connaissances et vos règles pour formuler des réponses précises et personnalisées.",
      },
      {
        title: 'Les canaux disponibles',
        content: "Le SAV peut fonctionner sur 4 canaux en parallele :\n\n- Email : l'IA lit les emails entrants (via Gmail ou votre email pro) et y répond\n- Chat sur le site : un widget de chat s'installe sur votre boutique Shopify, l'IA répond en direct\n- Gorgias : l'IA traite les tickets directement dans Gorgias\n- Zendesk : l'IA traite les tickets directement dans Zendesk\n\nVous pouvez activer un seul canal ou tous en même temps.",
      },
      {
        title: 'Comment l\'IA classe les demandes',
        content: "Quand un message arrive, l'IA l'analyse et le classe automatiquement : suivi de commande, demande de retour, question produit, réclamation, demande de remboursement, etc. Selon la catégorie, elle applique une stratégie de réponse différente. Pour un suivi de commande, elle va chercher le statut dans Shopify. Pour un retour, elle verifie votre politique. Pour une réclamation, elle peut escalader vers vous.",
      },
      {
        title: 'Quand l\'IA escalade',
        content: "L'IA ne répond pas au hasard. Si elle n'est pas assez sure de sa réponse, si le client est agressif, si la commande depasse un certain montant, ou si une règle & limite est declenchee, elle escalade la demande vers vous dans l'onglet A traiter. Vous pouvez alors approuver, modifier ou rejeter la réponse proposee. C'est un filet de sécurité qui garantit que vos clients recoivent toujours une réponse de qualité.",
      },
    ],
  },
  {
    id: 'relance-paniers-abandonnés',
    category: 'automatisations',
    title: 'Relance Paniers Abandonnés',
    summary: 'Récupérer les ventes perdues grâce aux emails de relance automatiques.',
    icon: ShoppingBag,
    readTime: '4 min',
    sections: [
      {
        title: 'Comment ça marche',
        content: "Quand un visiteur ajoute des produits a son panier sur votre boutique Shopify mais ne finalise pas sa commande, Actero le detecte automatiquement. L'IA envoie alors un email de relance personnalisé au client, avec les produits qu'il a laisses et un message adapte a votre ton de marque. Le but est de le convaincre de revenir finir sa commande.",
      },
      {
        title: 'Ce qu\'il faut pour que ça fonctionne',
        content: "Pour que la relance fonctionne, vous avez besoin de deux choses : Shopify connecte (pour detecter les paniers abandonnés) et un canal email connecte (Resend, Gmail ou email SMTP pour envoyer la relance). Activez les canaux souhaites dans l'automatisation.",
      },
      {
        title: 'La séquence de relance',
        content: "Par defaut, l'IA envoie un email dans les heures qui suivent l'abandon du panier. L'email est personnalisé : il contient le prenom du client, les produits laisses dans le panier, et un message dans votre ton de marque. L'IA adapte le message en fonction du montant du panier et du profil du client (nouveau client vs client fidele).",
      },
      {
        title: 'Résultats attendus',
        content: "En moyenne, les boutiques qui activent la relance de paniers recuperent entre 5 et 15% de paniers supplémentaires. Le résultat depend de votre secteur, du montant moyen de vos paniers et de la qualité de l'email de relance. Vous pouvez suivre les paniers recuperes dans votre dashboard, dans les metriques et dans le feed d'activité.",
      },
    ],
  },
  {
    id: 'comptabilité-automatisee',
    category: 'automatisations',
    title: 'Comptabilité Automatisee',
    summary: 'Automatiser les relances de factures, exports et alertes de trésorerie.',
    icon: TrendingUp,
    readTime: '4 min',
    sections: [
      {
        title: 'Ce que ça automatise',
        content: "L'automatisation Comptabilité prend en charge les taches comptables repetitives : relance des factures impayees par email, export automatique de vos données de ventes vers vos outils comptables, et alertes de trésorerie dans Slack quand un seuil est atteint. C'est particulierement utile si vous passez du temps chaque mois a relancer des factures ou a exporter des données.",
      },
      {
        title: 'Ce qu\'il faut avoir connecte',
        content: "Au minimum, Shopify doit être connecte pour que l'IA puisse accéder a vos données de ventes et factures. Pour les relances par email, connectez Gmail ou un email SMTP. Pour les alertes de trésorerie dans Slack, connectez Slack. Et si vous utilisez Axonaut, Pennylane ou iPaidThat, connectez-les aussi pour automatiser les exports.",
      },
      {
        title: 'Les canaux disponibles',
        content: "Deux canaux sont disponibles pour cette automatisation : Email pour les relances de factures et les exports par email, et Slack pour les alertes de trésorerie. Vous pouvez activer l'un ou les deux selon vos besoins.",
      },
      {
        title: 'Comment ça se passe au quotidien',
        content: "Une fois activee, l'automatisation tourne en arrière-plan. Quand une facture n'est pas payee après un certain délai, l'IA envoie un email de relance poli au client. Si votre trésorerie passe sous un seuil que vous définissez, vous recevez une alerte dans Slack. Les exports comptables sont envoyes periodiquement a votre comptable ou vers votre outil de comptabilité.",
      },
    ],
  },
  {
    id: 'playbook-comptabilité-detail',
    category: 'automatisations',
    title: 'Comprendre le playbook Comptabilité',
    summary: 'Comment fonctionnent les relances de factures impayees avec Axonaut, Pennylane ou iPaidThat.',
    icon: Calculator,
    readTime: '4 min',
    sections: [
      {
        title: 'Ce que fait le playbook',
        content: "Le playbook Comptabilité automatise la detection et la relance des factures en retard. Toutes les nuits (cron 3h du matin), Actero verifie vos factures dans l'outil comptable connecte, detecte celles en retard, et envoie une relance adaptee selon l'anciennete du retard.",
      },
      {
        title: 'Les outils comptables supportes',
        content: "Vous devez connecter un outil comptable parmi :\n- Axonaut : CRM + facturation PME francaises\n- Pennylane : comptabilité en ligne, souvent utilise avec expert-comptable\n- iPaidThat : collecte et classement automatique de factures\n\nUn seul peut être actif a la fois. Si aucun n'est connecte, le playbook reste inactif.",
      },
      {
        title: 'Les niveaux de relance',
        content: "Actero applique 3 niveaux automatiques :\n- J+7 après échéance : rappel courtois (ton amical)\n- J+15 : relance ferme avec recap des penalites\n- J+30 : mise en demeure formelle (avec piece jointe si configure)\n\nChaque relance est envoyee via votre canal email (Resend ou SMTP). Le ton suit votre agent, mais le playbook est plus direct par design.",
      },
      {
        title: 'Alertes Slack trésorerie',
        content: "Si Slack est connecte, vous recevez une alerte quand :\n- Une facture passe en retard\n- Un client ignore 2 relances de suite\n- Votre encours clients depasse un seuil\n\nLe seuil se configure dans Mon Agent > Règles > Trésorerie.",
      },
      {
        title: 'Personnaliser les relances',
        content: "Vous pouvez editer les templates dans Automatisations > Comptabilité > Modèles. Variables disponibles : {{client.nom}}, {{facture.numero}}, {{facture.montant}}, {{facture.jours_retard}}. Les changements s'appliquent au prochain run (nuit suivante).",
      },
    ],
  },

  // ─────────────────────────────────
  // MON AGENT
  // ─────────────────────────────────
  {
    id: 'configurer-ton-agent',
    category: 'agent-ia',
    title: 'Configurer le ton de votre agent',
    summary: 'Ajuster la personnalite de votre agent avec les 3 curseurs de ton.',
    icon: Sliders,
    readTime: '4 min',
    sections: [
      {
        title: 'Ou trouver les reglages de ton',
        content: "Allez dans Mon Agent dans le menu a gauche. La première section que vous voyez s'appelle Ton de votre agent. Vous y trouvez 3 curseurs que vous pouvez deplacer avec la souris. Chaque curseur contrôle un aspect de la personnalite de votre agent. La previsualisation en dessous des curseurs se met a jour en temps réel pour que vous voyiez l'effet immédiatement.",
      },
      {
        title: 'Les 3 curseurs expliques',
        content: "Curseur 1 — Formel / Casual : a gauche, l'agent vouvoie et utilise un vocabulaire soigne. A droite, il tutoie et parle de façon decontractee. Pour une boutique de luxe, mettez le curseur a gauche. Pour une marque jeune et fun, mettez-le a droite.\n\nCurseur 2 — Froid / Chaleureux : a gauche, l'agent est factuel et va droit au but. A droite, il est empathique, prend le temps et ajoute une touche humaine. La plupart des boutiques preferent un ton chaleureux.\n\nCurseur 3 — Court / Detaille : a gauche, l'agent répond en 2-3 phrases. A droite, il donne des explications completes avec du contexte. Pour des questions simples (suivi de colis), un ton court suffit. Pour des réclamations, un ton detaille est preferable.",
      },
      {
        title: 'La previsualisation',
        content: "Sous les curseurs, un encadre affiche un exemple de réponse en temps réel. Deplacez les curseurs et regardez comment le texte change. Ça vous donne une idee concrete de comment votre agent va s'exprimer. C'est le meilleur moyen de trouver le ton qui colle a votre marque sans avoir besoin de tester avec de vrais clients.",
      },
      {
        title: 'Sauvegarder',
        content: "Une fois satisfait du ton, cliquez le bouton Enregistrer la configuration en bas de la page. Tant que vous n'avez pas sauvegarde, les changements ne sont pas appliques. Après sauvegarde, l'agent utilise immédiatement les nouveaux reglages pour toutes les prochaines réponses.",
      },
    ],
  },
  {
    id: 'base-de-connaissances',
    category: 'agent-ia',
    title: 'Alimenter la base de connaissances',
    summary: 'Les 3 méthodes pour enrichir le savoir de votre agent et améliorer ses réponses.',
    icon: Brain,
    readTime: '5 min',
    sections: [
      {
        title: 'Pourquoi c\'est important',
        content: "La base de connaissances, c'est tout ce que votre agent sait sur votre boutique. Plus elle est riche, meilleures sont ses réponses. Sans base de connaissances, l'agent ne connait que les informations de base de Shopify (commandes, produits). Avec une bonne base, il peut répondre a des questions sur votre politique de retour, vos délais de livraison, vos promotions en cours, les tailles de vos produits, etc.",
      },
      {
        title: 'Méthode 1 : Importer depuis une URL',
        content: "C'est la méthode la plus rapide. Dans Mon Agent, section Base de connaissances, collez l'URL de votre page FAQ ou de votre politique de retour. Cliquez le bouton eclair. L'IA va lire la page, extraire les informations importantes, et creer automatiquement des paires Question/Réponse. En 10 secondes, votre agent a appris tout le contenu de la page. Vous pouvez importer autant de pages que vous voulez.",
      },
      {
        title: 'Méthode 2 : Importer un fichier',
        content: "Vous avez un document PDF, un fichier texte ou un CSV avec vos FAQ ? Glissez-le dans la zone d'import de fichier dans Mon Agent. L'IA analyse le contenu et en extrait les informations utiles. Les formats acceptes sont PDF, TXT, CSV, MD et DOC. La taille maximale est de 4 Mo par fichier.",
      },
      {
        title: 'Méthode 3 : Ajouter manuellement',
        content: "Cliquez sur Ajouter une entree manuellement dans la section Base de connaissances. Donnez un titre (par exemple 'Délais de livraison') et ecrivez le contenu (par exemple 'La livraison standard est gratuite et prend 3-5 jours ouvrables. La livraison express est a 9,90 euros et prend 24-48h.'). C'est la méthode la plus précise car vous ecrivez exactement ce que vous voulez que l'agent sache.",
      },
      {
        title: 'Gerer vos entrees',
        content: "Toutes vos entrees apparaissent en bas de la section. Vous pouvez les modifier (icone crayon) ou les supprimer (icone poubelle) a tout moment. Plus votre base est a jour, mieux l'agent répond. Pensez a la mettre a jour quand vous changez votre politique de retour, vos délais ou vos promotions.",
      },
    ],
  },
  {
    id: 'comprendre-escalades',
    category: 'agent-ia',
    title: 'Comprendre les escalades (A traiter)',
    summary: 'Ce qu\'est une escalade, comment la traiter, et comment en avoir moins.',
    icon: AlertTriangle,
    readTime: '5 min',
    sections: [
      {
        title: 'Qu\'est-ce qu\'une escalade',
        content: "Une escalade, c'est quand votre agent IA decide qu'il ne peut pas répondre seul a une demande. Plutot que de risquer une mauvaise réponse, il met la demande de cote et vous la montre dans l'onglet A traiter. Un badge rouge dans le menu vous indique combien d'escalades attendent votre attention. C'est un mecanisme de sécurité : votre agent prefere vous demander plutot que de dire n'importe quoi.",
      },
      {
        title: 'Pourquoi l\'agent escalade',
        content: "Les raisons les plus courantes sont : l'agent n'a pas assez d'informations dans sa base de connaissances pour répondre, le client est agressif ou menacant, une de vos règles & limites s'est declenchee (par exemple une demande de remboursement au-dessus d'un certain montant), la confiance de l'IA est trop basse sur sa réponse, ou le message contient un mot-cle sensible que vous avez defini (comme 'avocat' ou 'plainte').",
      },
      {
        title: 'Comment traiter une escalade',
        content: "Allez dans A traiter dans le menu. Pour chaque escalade, vous voyez le message original du client et la réponse que l'IA propose. Vous avez 3 options :\n\n- Approuver : la réponse proposee est bonne, envoyez-la telle quelle au client\n- Modifier : ajustez le texte de la réponse puis envoyez-la\n- Rejeter : ne pas envoyer de réponse (par exemple si c'est du spam)\n\nLa réponse est envoyee automatiquement au client sur le canal d'origine.",
      },
      {
        title: 'Comment reduire les escalades',
        content: "Si vous avez trop d'escalades, c'est généralement bon signe : ça veut dire que l'agent est prudent. Mais vous pouvez en reduire le nombre en enrichissant votre base de connaissances sur les sujets qui reviennent souvent. Regardez les escalades : si vous voyez le même type de question 5 fois, ajoutez une FAQ sur ce sujet. L'agent saura y répondre la prochaine fois. En une semaine, vous pouvez diviser vos escalades par deux.",
      },
    ],
  },
  {
    id: 'définir-règles-agent',
    category: 'agent-ia',
    title: 'Définir vos règles',
    summary: 'Les règles & limites et seuils d\'escalade pour controler ce que l\'agent peut faire.',
    icon: Shield,
    readTime: '4 min',
    sections: [
      {
        title: 'Les règles & limites',
        content: "Les règles & limites sont des règles que votre agent ne doit JAMAIS enfreindre. Par exemple : ne jamais proposer un remboursement sans votre accord, ne jamais mentionner un concurrent, toujours demander le numéro de commande avant de traiter un retour. Vous pouvez définir autant de règles que vous voulez. L'agent les verifie avant chaque réponse.",
      },
      {
        title: 'Les seuils d\'escalade',
        content: "Les seuils definissent quand l'agent doit automatiquement vous passer la main. Vous pouvez configurer :\n\n- Montant maximum : escalader si la commande depasse X euros\n- Client fidele : escalader si le client a plus de X commandes (pour un traitement VIP)\n- Confiance IA : escalader si l'IA est sure de sa réponse a moins de X%\n- Ton agressif : escalader automatiquement quand le client est en colere\n- Mots-cles sensibles : escalader si le message contient certains mots (avocat, plainte, DGCCRF...)",
      },
      {
        title: 'Le constructeur visuel de règles',
        content: "Vous n'avez pas besoin de coder pour creer des règles. Dans Mon Agent, section Règles, vous trouvez un constructeur visuel. Chaque règle a un toggle pour l'activer ou la désactiver. Vous pouvez modifier les seuils avec de simples champs numeriques. Le tout est sauvegarde quand vous cliquez Enregistrer la configuration.",
      },
      {
        title: 'Trouver le bon equilibre',
        content: "Si vous mettez trop de règles ou des seuils trop bas, l'agent escalade tout et ne traite plus rien automatiquement. Si vous en mettez trop peu, l'agent risque de mal répondre sur des cas delicats. Le bon equilibre : commencez avec les règles par defaut, surveillez les escalades pendant une semaine, puis ajustez. La plupart des boutiques n'ont besoin que de 3-5 règles & limites bien choisies.",
      },
    ],
  },

  {
    id: 'agents-ia-specialises',
    category: 'agent-ia',
    title: 'Debloquer les agents IA specialises',
    summary: 'Agents metier (juridique, comptable, technique) disponibles sur le plan Pro.',
    icon: Sparkles,
    readTime: '3 min',
    sections: [
      {
        title: 'Qu\'est-ce qu\'un agent specialise',
        content: "En plus de votre agent generaliste, le plan Pro debloque des agents specialises par metier. Chacun a son propre prompt, sa base de connaissances et ses règles. Exemples : agent Juridique (CGV, RGPD), agent Comptable (factures, relances), agent Technique produit (specs, compatibilite).",
      },
      {
        title: 'Plan requis',
        content: "Les agents specialises sont inclus dans le plan Pro (399 €/mois) et Enterprise. Les plans Free et Starter n'ont accès qu'a un agent generaliste unique. Pour passer au Pro : Facturation > Changer de plan.",
      },
      {
        title: 'Activer un agent specialise',
        content: "1. Mon Agent > onglet Agents specialises\n2. Choisissez un modèle (Juridique, Compta, Technique, ou Custom)\n3. Configurez ton, règles et base de connaissances propres\n4. Assignez des catégories de tickets a cet agent (ex : agent Juridique recoit toutes les demandes mentionnant retractation ou RGPD)\n5. Sauvegardez",
      },
      {
        title: 'Routage automatique',
        content: "Quand un ticket arrive, Actero detecte la catégorie et route vers l'agent le mieux arme. Si aucun agent specialise ne matche, l'agent generaliste prend le relais. Vous pouvez forcer un routage manuel depuis A traiter.",
      },
    ],
  },

  // ─────────────────────────────────
  // DASHBOARD & METRIQUES
  // ─────────────────────────────────
  {
    id: 'comprendre-metriques',
    category: 'dashboard',
    title: 'Comprendre vos metriques',
    summary: 'Les 5 chiffres cles de votre dashboard et ce qu\'ils veulent dire.',
    icon: BarChart3,
    readTime: '4 min',
    sections: [
      {
        title: 'Les 5 metriques principales',
        content: "Sur votre page d'accueil, vous voyez 5 chiffres importants :\n\n1. Tickets résolus : le nombre de demandes clients traitees automatiquement par l'IA ce mois-ci. C'est le chiffre le plus important, il montre combien de travail l'IA fait pour vous.\n\n2. Escalades : le nombre de demandes que l'IA n'a pas pu traiter seule et qui attendent votre réponse.\n\n3. Temps economise : le nombre d'heures que vous auriez passe a traiter ces tickets vous-même.\n\n4. Actions IA : le nombre total d'actions executees par l'IA (réponses envoyees, emails de relance, classifications, etc.)\n\n5. ROI genere : l'estimation financiere de la valeur creee. C'est le temps economise multiplie par votre cout horaire, moins le prix de votre abonnement.",
      },
      {
        title: 'Les pourcentages en vert et en rouge',
        content: "A cote de chaque chiffre, vous voyez parfois un pourcentage avec une fleche. En vert avec une fleche vers le haut, ça veut dire que le chiffre augmente par rapport au mois precedent. C'est généralement positif (plus de tickets résolus = l'IA travaille plus). En rouge avec une fleche vers le bas, ça diminue. Pour les escalades, une baisse en rouge est en fait une bonne nouvelle : ça veut dire que l'IA s'ameliore et escalade moins.",
      },
      {
        title: 'Le feed d\'activité en direct',
        content: "Sous les metriques, vous voyez l'activité en temps réel de votre agent. Chaque action apparait au fur et a mesure : un ticket résolu, un email de relance envoye, un panier recupere, une escalade. Un point vert pulse indique que la connexion en temps réel est active. Vous pouvez donner votre avis sur chaque réponse de l'IA avec les boutons pouce haut et pouce bas. Chaque feedback aide l'IA a s'améliorer.",
      },
      {
        title: 'Les graphiques',
        content: "Votre dashboard affiche aussi des graphiques d'activité sur les 14 derniers jours et un graphique d'evolution du ROI. Ces graphiques vous permettent de voir les tendances : est-ce que le nombre de tickets augmente ? Le ROI est-il en croissance ? Si vous voyez un pic de tickets un jour donne, c'est peut-être lie a une promotion ou un problème de livraison.",
      },
    ],
  },
  {
    id: 'configurer-roi',
    category: 'dashboard',
    title: 'Configurer le ROI',
    summary: 'Renseigner vos couts pour que le calcul de retour sur investissement soit précis.',
    icon: TrendingUp,
    readTime: '3 min',
    sections: [
      {
        title: 'Comment le ROI est calcule',
        content: "Le ROI (retour sur investissement) mesure la valeur que vous creez grâce a Actero. La formule est simple : (Temps economise en heures x Cout horaire de votre équipe) - Prix de votre abonnement Actero. Par exemple, si l'IA a economise 40 heures ce mois-ci, que votre cout horaire est de 25 euros, et que votre abonnement est de 199 euros, votre ROI est de (40 x 25) - 199 = 801 euros.",
      },
      {
        title: 'Ou configurer les paramètres',
        content: "Allez dans Mon Profil puis Calcul du ROI (ou directement depuis le lien dans la section metriques du dashboard). Vous avez 3 champs a remplir :\n\n1. Cout horaire de votre équipe support : combien coute 1 heure de travail d'un agent support dans votre entreprise (salaire charges comprises divise par le nombre d'heures).\n\n2. Temps moyen par ticket : combien de minutes prend en moyenne le traitement d'un ticket client (entre 3 et 10 minutes généralement).\n\n3. Votre abonnement Actero : le montant mensuel de votre abonnement.",
      },
      {
        title: 'Le calcul en temps réel',
        content: "Une fois les paramètres renseignes, le ROI se met a jour en temps réel sur votre dashboard. Vous voyez 4 chiffres : le nombre de tickets résolus ce mois, le temps economise en heures, la valeur economisee en euros, et le ROI net (valeur economisee moins abonnement). Si le ROI net est positif et en vert, Actero vous rapporte plus qu'il ne vous coute. C'est généralement le cas des le premier mois.",
      },
    ],
  },
  {
    id: 'tester-votre-agent',
    category: 'dashboard',
    title: 'Tester votre agent',
    summary: 'Utiliser les tests et le chat libre pour vérifier les réponses de votre agent.',
    icon: PlayCircle,
    readTime: '4 min',
    sections: [
      {
        title: 'Les tests de playbook',
        content: "Dans la section Tester de votre dashboard, vous trouvez des scenarios pre-faits qui simulent des situations réelles : un client qui demande ou est son colis, un client mecontent, une demande de remboursement, etc. Cliquez sur Lancer le test et l'agent répond comme il le ferait avec un vrai client. Chaque réponse est evaluee automatiquement sur sa pertinence et son ton.",
      },
      {
        title: 'Le chat libre',
        content: "Vous pouvez aussi taper n'importe quel message dans le champ de chat libre, comme si vous etiez un client. L'agent répond en utilisant votre configuration actuelle (ton, règles, base de connaissances). C'est le meilleur moyen de vérifier que l'agent reagit bien a des questions spécifiques a votre boutique. Aucun vrai ticket n'est cree, c'est un mode bac a sable.",
      },
      {
        title: 'Comprendre les résultats',
        content: "Chaque réponse de test affiche un score de qualité. Si le score est eleve, la réponse est pertinente et bien formulee. Si le score est bas, ça peut indiquer que la base de connaissances manque d'informations sur ce sujet, ou que les instructions sont contradictoires. Utilisez les tests pour identifier les points faibles et ajustez votre configuration en consequence.",
      },
      {
        title: 'Quand tester',
        content: "Testez après chaque modification importante : ajout de FAQ, changement de ton, nouvelle règle & limite. C'est aussi utile quand vous ajoutez de nouveaux produits a votre catalogue ou quand vous changez votre politique de retour. Les tests vous evitent de decouvrir un problème avec un vrai client.",
      },
    ],
  },
  {
    id: 'roi-calcul-detaille',
    category: 'dashboard',
    title: 'Tableau ROI : comment c\'est calcule',
    summary: 'La formule exacte derriere les chiffres du dashboard ROI.',
    icon: Calculator,
    readTime: '3 min',
    sections: [
      {
        title: 'La formule',
        content: "ROI net = (Tickets résolus x Temps moyen par ticket x Cout horaire) - Abonnement Actero mensuel\n\nExemple concret :\n- 800 tickets résolus ce mois\n- 5 minutes par ticket = 66,6 heures economisees\n- Cout horaire : 25 €\n- Valeur economisee : 1 666 €\n- Abonnement Starter : 99 €\n- ROI net : 1 567 €",
      },
      {
        title: 'D\'ou viennent les chiffres',
        content: "- Tickets résolus : compte uniquement les tickets cloturees par l'IA sans intervention humaine (les escalades ne comptent pas)\n- Temps moyen par ticket : valeur que vous renseignez dans Mon Profil > ROI (par defaut 5 min)\n- Cout horaire : que vous renseignez aussi (par defaut 25 €, charges comprises)\n- Abonnement : recupere automatiquement de votre plan Stripe",
      },
      {
        title: 'Mois en cours vs mois precedent',
        content: "Les chiffres se reinitialisent chaque 1er du mois a 00h00. Le pourcentage vert/rouge compare au mois precedent sur la même période (ex : le 14 du mois, il compare aux 14 premiers jours du mois d'avant). Les 3 premiers jours du mois, l'indicateur peut être volatile.",
      },
      {
        title: 'Ajuster vos paramètres',
        content: "Si le ROI vous semble sous-estime, vérifiez vos paramètres dans Mon Profil > ROI. Un temps moyen de 5 min est prudent : la plupart des SAV comptent 7 a 10 min par ticket incluant la recherche d'infos. Un cout horaire de 25 € correspond a un SMIC charge ; augmentez a 35-45 € pour un agent experimente.",
      },
    ],
  },
  {
    id: 'compteur-tickets-bloque',
    category: 'dashboard',
    title: 'Mon compteur de tickets n\'avance pas',
    summary: 'Les 5 raisons courantes et comment debloquer la situation.',
    icon: AlertTriangle,
    readTime: '3 min',
    sections: [
      {
        title: '1. Aucune automatisation active',
        content: "Vérifiez Automatisations : au moins une doit avoir le toggle vert. Sans automatisation active, l'IA ne traite rien et le compteur reste a zéro, même si les messages arrivent.",
      },
      {
        title: '2. Aucun canal selectionne',
        content: "Une automatisation peut être activee sans canal. Cliquez dessus et vérifiez que au moins un canal (Email, Chat, Gorgias...) est coche. Sans canal, l'IA ne recoit pas les messages.",
      },
      {
        title: '3. Intégration en erreur',
        content: "Intégrations > vérifiez les badges. Un badge rouge (erreur de connexion) bloque le flux de messages. Cliquez Tester puis Reconnecter si besoin. Les cles API expirent parfois chez les fournisseurs.",
      },
      {
        title: '4. Limite du plan atteinte',
        content: "Le plan Free inclut 50 tickets/mois et le Starter 1 000. Si vous atteignez la limite, les nouveaux messages sont mis en file d'attente mais non traites. Facturation > vous verrez un badge Limite atteinte. Upgradez pour debloquer.",
      },
      {
        title: '5. Cache ou délai d\'affichage',
        content: "Le compteur se met a jour en quasi temps réel mais un leger délai (jusqu'a 60 sec) peut exister. Rafraichissez la page (Cmd+R / Ctrl+R). Si le problème persiste après 5 minutes avec toutes les autres causes ecartees, contactez contact@actero.fr.",
      },
    ],
  },
  {
    id: 'configurer-notifications',
    category: 'dashboard',
    title: 'Configurer les notifications',
    summary: 'Choisir ce que vous recevez et par quel canal : email, Slack, push, vocal.',
    icon: Bell,
    readTime: '3 min',
    sections: [
      {
        title: 'Accéder aux notifications',
        content: "Cliquez sur votre nom en bas a gauche du dashboard, puis sélectionnez Notifications. Vous arrivez sur la page ou vous pouvez configurer chaque type de notification et choisir par quel canal la recevoir.",
      },
      {
        title: 'Les types de notifications',
        content: "Il y a 3 catégories :\n\n1. Alertes critiques : les escalades, les tickets urgents, les anomalies detectees, les tentatives de fraude. Ce sont les notifications les plus importantes, celles que vous ne voulez pas rater.\n\n2. Rapports : résumé quotidien, hebdomadaire ou mensuel de l'activité de votre agent. Pratique pour avoir une vue d'ensemble sans ouvrir le dashboard.\n\n3. Activité : nouvelles intégrations configurees, suggestions d'amélioration de l'IA, jalons atteints (par exemple : 1000 tickets résolus).",
      },
      {
        title: 'Les canaux de notification',
        content: "Pour chaque type de notification, vous choisissez comment la recevoir : par Email, dans Slack (si connecte), en notification Push dans le navigateur, ou en Rapport vocal (un résumé audio). Vous pouvez combiner plusieurs canaux pour les alertes critiques (par exemple email ET Slack) et n'en garder qu'un pour les rapports.",
      },
      {
        title: 'Les heures silencieuses',
        content: "Si vous ne voulez pas être derange la nuit ou le week-end, activez le mode silencieux. Allez dans Notifications puis Horaires puis Mode silencieux. Définissez la plage horaire pendant laquelle aucune notification ne sera envoyee (par exemple de 22h a 7h). Les alertes critiques seront mises en attente et envoyees des la fin du mode silencieux.",
      },
    ],
  },

  // ─────────────────────────────────
  // FACTURATION
  // ─────────────────────────────────
  {
    id: 'upgrade-plan',
    category: 'billing',
    title: 'Upgrade de plan : que se passe-t-il',
    summary: 'Trial, proration, crediting : ce qui se passe quand vous changez de plan.',
    icon: ArrowUpCircle,
    readTime: '3 min',
    sections: [
      {
        title: 'Les 4 plans Actero',
        content: "- Free : 50 tickets/mois, 1 intégration, agent generaliste\n- Starter : 99 €/mois, 1 000 tickets, intégrations illimitées\n- Pro : 399 €/mois, tickets illimités, Règles & limites avancees, API publique, agents specialises\n- Enterprise : sur devis, SLA, SSO, multi-workspace",
      },
      {
        title: 'Upgrade en cours de mois',
        content: "Stripe applique une proration automatique. Exemple : vous etes au Starter (99 €), vous passez au Pro (399 €) au 15 du mois. Stripe calcule :\n- Credit restant Starter : 99 € x 15/30 = 49,50 €\n- Pro prorate : 399 € x 15/30 = 199,50 €\n- Debite maintenant : 150 €\n\nLa prochaine facture mensuelle sera le montant plein du nouveau plan.",
      },
      {
        title: 'Trial gratuit',
        content: "Les nouveaux inscrits beneficient d'une période d'essai de 7 jours sur les plans payants (Starter et Pro). A la fin, vous basculez vers le plan Free (pas de coupure de service) sauf si vous souscrivez. Les parraines beneficient en plus de 30 jours offerts (cumulable avec le trial).",
      },
      {
        title: 'Downgrade',
        content: "Un passage a un plan inferieur prend effet a la fin de la période en cours (pas de remboursement). Vous gardez les fonctionnalites payantes jusqu'a la bascule. Attention : si vous passez de Pro a Starter, les agents specialises seront desactives.",
      },
      {
        title: 'Comment changer',
        content: "Facturation > Changer de plan, ou directement via le Portail Stripe > Modifier l'abonnement. Le changement est effectif immédiatement pour un upgrade, en fin de période pour un downgrade.",
      },
    ],
  },
  {
    id: 'programme-parrainage',
    category: 'billing',
    title: 'Comprendre le programme de parrainage',
    summary: '30 jours offerts pour le parraine, 1 mois de credit Stripe pour le parrain.',
    icon: Gift,
    readTime: '3 min',
    sections: [
      {
        title: 'Les recompenses',
        content: "- Le parraine (nouveau client) : 30 jours gratuits a l'inscription sur n'importe quel plan payant. Cumulable avec les 7 jours de trial standard.\n- Le parrain (vous) : 1 mois d'abonnement offert sous forme de credit Stripe, applique automatiquement sur la prochaine facture.\n\nPas de limite : plus vous parrainez, plus vous cumulez de mois gratuits.",
      },
      {
        title: 'Trouver votre lien de parrainage',
        content: "Dashboard > Parrainage. Vous y trouvez :\n- Votre code personnel (ex : PABLO-H3X)\n- Votre lien direct (https://actero.fr/?referral_code=PABLO-H3X)\n- Un bouton de partage rapide (email, Slack, LinkedIn)\n- L'historique de vos filleuls et recompenses",
      },
      {
        title: 'Comment ça marche pour le parraine',
        content: "Le nouvel utilisateur :\n1. Clique sur votre lien de parrainage\n2. Voit une banniere \"30 jours offerts\" sur la landing et le signup\n3. S'inscrit normalement\n4. Les 30 jours sont automatiquement ajoutes a sa période de trial\n\nLa banniere n'apparait QUE si l'URL contient ?referral_code=. Les visiteurs sans code ne voient pas l'offre.",
      },
      {
        title: 'Quand le credit parrain est-il applique',
        content: "Le credit parrain est declenche quand le filleul paie sa première facture (après son trial + les 30 jours offerts). Le credit apparait alors dans Facturation et est automatiquement deduit de votre prochaine échéance Stripe. Vous recevez un email de confirmation.",
      },
      {
        title: 'Conditions',
        content: "- Pas d'auto-parrainage (même email, même IP bloques)\n- Le filleul doit atteindre au moins 1 facture payee pour que le credit parrain se declenche\n- Pas de plafond sur le nombre de parrainages",
      },
    ],
  },
  {
    id: 'gerer-facturation',
    category: 'billing',
    title: 'Gerer votre facturation',
    summary: 'Plan, portail Stripe, consommation et changement de moyen de paiement.',
    icon: CreditCard,
    readTime: '3 min',
    sections: [
      {
        title: 'Accéder a la facturation',
        content: "Cliquez sur votre nom en bas a gauche du dashboard, puis sélectionnez Facturation. Vous voyez votre plan actuel, le statut de votre abonnement, la date de debut, et les fonctionnalites incluses.",
      },
      {
        title: 'Le portail Stripe',
        content: "Pour tout ce qui touche au paiement, cliquez sur le bouton Portail Stripe. Vous etes redirige vers un portail sécurisé gere par Stripe ou vous pouvez : télécharger toutes vos factures en PDF, mettre a jour votre carte bancaire ou ajouter un nouveau moyen de paiement, modifier votre abonnement (monter ou descendre en gamme), et annuler votre abonnement si besoin (l'annulation prend effet en fin de période payee).",
      },
      {
        title: 'Comprendre votre consommation',
        content: "En bas de la page Facturation, vous voyez votre consommation du mois en cours : le nombre de runs du moteur IA (chaque fois que l'agent traite une demande) et le nombre total d'événements. Ces chiffres vous donnent une idee de l'activité de votre agent. La facturation Actero est mensuelle et forfaitaire : vous ne payez pas a l'usage, le nombre de tickets traites est illimité dans votre plan.",
      },
      {
        title: 'Changer de moyen de paiement',
        content: "Pour changer de carte bancaire, passez par le Portail Stripe. Cliquez sur Mettre a jour le moyen de paiement, entrez les nouvelles informations, et validez. Le changement est immediat et votre prochaine facture sera debitee sur la nouvelle carte. Tous les paiements sont securises par Stripe (norme PCI DSS niveau 1).",
      },
    ],
  },
];

const CATEGORIES = [
  { id: 'getting-started', icon: Zap, title: 'Premiers pas', desc: 'Comprendre et démarrer avec Actero' },
  { id: 'intégrations', icon: Plug, title: 'Intégrations', desc: 'Connecter vos outils' },
  { id: 'automatisations', icon: Sparkles, title: 'Automatisations', desc: 'Activer vos automatisations' },
  { id: 'agent-ia', icon: Brain, title: 'Mon Agent', desc: 'Configurer et personnaliser votre agent IA' },
  { id: 'dashboard', icon: BarChart3, title: 'Dashboard & Metriques', desc: 'Suivre vos résultats' },
  { id: 'billing', icon: CreditCard, title: 'Facturation', desc: 'Abonnement et factures' },
];

// ═══════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════
export const SupportGuidePage = ({ onNavigate }) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [search, setSearch] = useState('');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const openGuide = (guide) => {
    setSelectedGuide(guide);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setSelectedGuide(null);
    window.scrollTo(0, 0);
  };

  // Filter guides by search
  const filteredGuides = search.trim().length >= 2
    ? GUIDES.filter(g =>
        `${g.title} ${g.summary} ${g.sections.map(s => s.title + ' ' + s.content).join(' ')}`
          .toLowerCase().includes(search.toLowerCase())
      )
    : selectedCategory
      ? GUIDES.filter(g => g.category === selectedCategory)
      : GUIDES;

  // ── GUIDE DETAIL VIEW ──
  if (selectedGuide) {
    const guide = selectedGuide;
    const Icon = guide.icon;
    return (
      <>
        <SEO
          title={`${guide.title} — Centre d'aide Actero`}
          description={guide.summary}
          canonical="/support"
        />
        <div className="relative min-h-screen bg-white font-sans text-[#262626]">
          <Navbar onNavigate={onNavigate} />
          <main className="pt-28 md:pt-36 pb-24 px-6">
            <div className="max-w-3xl mx-auto">
              {/* Back button */}
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-sm font-medium text-[#716D5C] hover:text-[#003725] transition-colors mb-8"
              >
                <ArrowLeft className="w-4 h-4" /> Retour au centre d'aide
              </button>

              {/* Header */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#003725]" />
                  </div>
                  <span className="text-xs font-semibold text-[#716D5C] uppercase tracking-wider">
                    {CATEGORIES.find(c => c.id === guide.category)?.title}
                  </span>
                </div>
                <h1
                  className="text-3xl md:text-4xl font-normal text-[#262626] mb-4 leading-[1.15]"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  {guide.title}
                </h1>
                <p className="text-[#716D5C] text-lg leading-relaxed">{guide.summary}</p>
                <div className="flex items-center gap-2 mt-4 text-xs text-[#716D5C]">
                  <Clock className="w-3.5 h-3.5" />
                  Lecture : {guide.readTime}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-10">
                {guide.sections.map((section, i) => (
                  <section key={i}>
                    <h2 className="text-xl font-bold text-[#262626] mb-4">
                      {section.title}
                    </h2>
                    <div className="text-[#716D5C] leading-relaxed text-[15px] whitespace-pre-line">
                      {section.content}
                    </div>
                    {i < guide.sections.length - 1 && (
                      <div className="mt-10 h-px bg-gray-200" />
                    )}
                  </section>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-16 p-8 bg-surface rounded-2xl border border-gray-200 text-center">
                <p className="text-[#262626] font-bold mb-2">Besoin d'aide supplementaire ?</p>
                <p className="text-sm text-[#716D5C] mb-4">Notre equipe repond en moins de 24h.</p>
                <a href="mailto:contact@actero.fr" className="inline-flex items-center gap-2 px-5 py-2.5 bg-cta text-white rounded-full text-sm font-semibold hover:bg-cta transition-colors">
                  <Mail className="w-4 h-4" /> Contacter le support
                </a>
              </div>
            </div>
          </main>
          <Footer onNavigate={onNavigate} />
        </div>
      </>
    );
  }

  // ── HOME VIEW ──
  return (
    <>
      <SEO
        title="Centre d'aide — Actero"
        description="Guides, tutoriels et documentation pour utiliser Actero. Intégrations, dashboard, agents IA, facturation."
        canonical="/support"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-4xl mx-auto">

            {/* Hero */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <BookOpen className="w-3.5 h-3.5" />
                Centre d'aide
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Comment pouvons-nous vous aider ?
              </h1>

              {/* Search */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#716D5C]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null); }}
                  placeholder="Rechercher un guide, une question..."
                  className="w-full pl-12 pr-4 py-4 bg-surface border border-gray-200 rounded-2xl text-[15px] text-[#262626] placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            {/* Categories */}
            {!search.trim() && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  const count = GUIDES.filter(g => g.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isActive
                          ? 'bg-cta text-white border-[#003725]'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-white/80' : 'text-[#003725]'}`} />
                      <h3 className="font-bold text-xs mb-0.5">{cat.title}</h3>
                      <p className={`text-[10px] ${isActive ? 'text-white/60' : 'text-[#716D5C]'}`}>
                        {count} guide{count > 1 ? 's' : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Guides list */}
            <div className="space-y-3">
              {filteredGuides.length === 0 ? (
                <div className="text-center py-16 text-[#716D5C]">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucun guide trouve pour "{search}"</p>
                </div>
              ) : (
                filteredGuides.map(guide => {
                  const Icon = guide.icon;
                  const catLabel = CATEGORIES.find(c => c.id === guide.category)?.title;
                  return (
                    <button
                      key={guide.id}
                      onClick={() => openGuide(guide)}
                      className="w-full flex items-center gap-5 p-5 bg-white border border-gray-200 rounded-2xl text-left hover:border-gray-300 hover:shadow-sm transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center shrink-0 group-hover:bg-cta/10 transition-colors">
                        <Icon className="w-5 h-5 text-[#003725]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[15px] text-[#262626]">{guide.title}</h3>
                          <span className="text-[10px] text-[#716D5C] bg-surface px-2 py-0.5 rounded-full shrink-0">{catLabel}</span>
                        </div>
                        <p className="text-sm text-[#716D5C] truncate">{guide.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#716D5C]">{guide.readTime}</span>
                        <ArrowRight className="w-4 h-4 text-[#716D5C] group-hover:text-[#003725] transition-colors" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Contact CTA */}
            <div className="mt-20 text-center p-10 bg-surface rounded-3xl border border-gray-200">
              <h2 className="text-2xl font-bold text-[#262626] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                Vous n'avez pas trouve votre réponse ?
              </h2>
              <p className="text-[#716D5C] mb-6">Notre equipe repond en moins de 24h.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="mailto:contact@actero.fr"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-cta text-white rounded-full font-semibold hover:bg-cta transition-colors"
                >
                  <Mail className="w-4 h-4" /> contact@actero.fr
                </a>
                <button
                  onClick={() => onNavigate('/signup')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-[#003725] font-semibold underline underline-offset-4 decoration-[#003725]/40 hover:decoration-[#003725] transition-colors"
                >
                  Reserver un audit gratuit <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
