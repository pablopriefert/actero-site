import React, { useEffect } from "react";
import { FileText } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";

export const TermsPage = ({ onNavigate }) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <SEO
        title="Conditions generales d'utilisation — Actero"
        description="Conditions generales d'utilisation du service Actero. Regles d'utilisation de la plateforme et des agents IA."
        canonical="/utilisation"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            <div className="mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F9F7F1] border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <FileText className="w-3.5 h-3.5" />
                Conditions d'utilisation
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Conditions generales d'utilisation
              </h1>
              <p className="text-sm text-[#716D5C]">Derniere mise a jour : 7 avril 2026</p>
            </div>

            <div className="space-y-12">

              <Section title="1. Objet" content={`Les presentes conditions generales d'utilisation (ci-apres "CGU") regissent l'acces et l'utilisation de la plateforme Actero accessible a l'adresse actero.fr (ci-apres "la Plateforme"), editee par Anne AIN EI — Actero, micro-entrepreneur, SIRET 103 250 775 00014, dont le siege social est situe au 54 Boulevard Notre-Dame, 13006 Marseille, France (ci-apres "Actero").

En utilisant la Plateforme, l'Utilisateur accepte sans reserve les presentes CGU.`} />

              <Section title="2. Definitions" content={`- "Utilisateur" : toute personne physique ou morale accedant a la Plateforme.
- "Client" : tout Utilisateur ayant souscrit a un abonnement Actero.
- "Agent IA" : programme d'intelligence artificielle deploye par Actero pour automatiser des taches specifiques (support client, relance paniers, qualification leads).
- "Dashboard" : interface de suivi accessible au Client apres souscription.
- "Service" : l'ensemble des prestations fournies par Actero via la Plateforme.`} />

              <Section title="3. Acces a la Plateforme" content={`L'acces a la partie publique du site (pages d'information, tarifs, FAQ) est libre et gratuit.

L'acces au Dashboard et aux fonctionnalites avancees (agents IA, integrations, simulateur, base de connaissances) est reserve aux Clients disposant d'un compte actif et d'un abonnement en cours de validite.

Actero se reserve le droit de modifier, suspendre ou interrompre tout ou partie de la Plateforme a tout moment, sans preavis ni indemnite.`} />

              <Section title="4. Inscription et compte" content={`Pour acceder au Service, le Client doit creer un compte en fournissant des informations exactes et a jour (nom, email, informations de l'entreprise).

Le Client est responsable de la confidentialite de ses identifiants de connexion. Toute utilisation du compte est presumee faite par le Client.

Le Client peut inviter des membres de son equipe avec des roles differencies (Admin, Operationnel, Support, Finance). Le Client reste responsable de l'utilisation faite par les membres qu'il invite.`} />

              <Section title="5. Description du Service" content={`Actero fournit un service d'automatisation base sur l'intelligence artificielle, comprenant :

- Le deploiement d'agents IA pour le support client e-commerce (Shopify) et la gestion de leads immobiliers
- La configuration personnalisee du ton de marque, des regles metier et des garde-fous
- Un dashboard de suivi des performances en temps reel
- La connexion aux outils tiers via OAuth (Shopify, Slack, Gorgias, Zendesk, Gmail, Google Sheets)
- Un simulateur de conversation pour tester l'agent avant mise en production
- Un systeme d'escalade vers un humain quand l'agent IA ne peut pas repondre

Le Service est fourni "en l'etat". Actero ne garantit pas l'absence d'erreurs ou d'interruptions.`} />

              <Section title="6. Obligations du Client" content={`Le Client s'engage a :

- Fournir des informations exactes lors de l'inscription et les maintenir a jour
- Utiliser le Service conformement a sa destination et aux presentes CGU
- Ne pas utiliser le Service a des fins illicites, frauduleuses ou portant atteinte aux droits de tiers
- Ne pas tenter d'acceder aux systemes informatiques d'Actero de maniere non autorisee
- Ne pas copier, reproduire ou extraire le contenu de la Plateforme
- Respecter les lois applicables, notamment le RGPD concernant les donnees de ses propres clients
- Configurer les garde-fous de son agent IA de maniere responsable`} />

              <Section title="7. Tarification et paiement" content={`Les tarifs du Service sont communiques sur devis apres un audit gratuit.

Le paiement est effectue mensuellement par carte bancaire via Stripe. Les factures sont disponibles dans le portail client Stripe, accessible depuis le Dashboard.

TVA non applicable, article 293 B du Code General des Impots.

En cas de defaut de paiement, Actero se reserve le droit de suspendre l'acces au Service apres relance restee infructueuse pendant 15 jours.`} />

              <Section title="8. Duree et resiliation" content={`L'abonnement est souscrit pour une duree indeterminee avec facturation mensuelle.

Le Client peut resilier son abonnement a tout moment depuis son Dashboard (section Mon Profil > Gerer mon abonnement). La resiliation prend effet a la fin de la periode mensuelle en cours.

Actero peut resilier l'abonnement d'un Client en cas de manquement grave aux presentes CGU, apres mise en demeure restee infructueuse pendant 15 jours.

En cas de resiliation, le Client conserve l'acces a ses donnees pendant 30 jours. Au-dela, Actero se reserve le droit de supprimer les donnees du Client.`} />

              <Section title="9. Propriete intellectuelle" content={`La Plateforme, les agents IA, les workflows, les algorithmes et l'ensemble des contenus d'Actero sont proteges par le droit de la propriete intellectuelle.

Le Client dispose d'un droit d'utilisation personnel, non exclusif et non cessible du Service pendant la duree de son abonnement.

Les donnees saisies par le Client (base de connaissances, regles metier, garde-fous) restent la propriete du Client.`} />

              <Section title="10. Donnees personnelles" content={`Actero traite les donnees personnelles conformement au Reglement General sur la Protection des Donnees (RGPD).

Pour plus d'informations sur la collecte, l'utilisation et la protection des donnees personnelles, consultez notre Politique de confidentialite accessible a l'adresse actero.fr/confidentialite.`} />

              <Section title="11. Responsabilite" content={`Actero met en oeuvre les moyens necessaires pour assurer le bon fonctionnement du Service.

Actero ne saurait etre tenue responsable :
- Des reponses generees par les agents IA, qui sont des outils d'aide et ne se substituent pas au jugement humain
- Des dommages indirects (perte de chiffre d'affaires, perte de clients, atteinte a l'image)
- Des interruptions de service dues a des cas de force majeure ou a des prestataires tiers (Shopify, Stripe, Supabase)
- De l'utilisation faite par le Client des agents IA

La responsabilite totale d'Actero est limitee au montant des sommes versees par le Client au cours des 12 derniers mois.`} />

              <Section title="12. Disponibilite du Service" content={`Actero s'efforce de maintenir le Service disponible 24 heures sur 24, 7 jours sur 7.

Actero ne garantit pas une disponibilite ininterrompue et ne saurait etre tenue responsable des interruptions de service pour maintenance, mise a jour ou en cas de force majeure.

Les operations de maintenance planifiees seront, dans la mesure du possible, signalees a l'avance aux Clients via le Dashboard ou par email.`} />

              <Section title="13. Modification des CGU" content={`Actero se reserve le droit de modifier les presentes CGU a tout moment.

Les modifications substantielles seront notifiees aux Clients par email ou via le Dashboard au moins 30 jours avant leur entree en vigueur.

L'utilisation continue du Service apres l'entree en vigueur des modifications vaut acceptation des nouvelles CGU.`} />

              <Section title="14. Droit applicable et litiges" content={`Les presentes CGU sont soumises au droit francais.

En cas de litige relatif a l'interpretation ou a l'execution des presentes CGU, les parties s'efforceront de trouver une solution amiable.

A defaut de resolution amiable dans un delai de 30 jours, le litige sera soumis aux tribunaux competents de Marseille.

Conformement aux dispositions du Code de la consommation, le Client consommateur peut recourir gratuitement au service de mediation MEDICYS (www.medicys.fr).`} />

              <Section title="15. Contact" content={`Pour toute question relative aux presentes CGU :

Email : contact@actero.fr
Site : actero.fr
Adresse : 54 Boulevard Notre-Dame, 13006 Marseille, France`} />

            </div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};

const Section = ({ title, content }) => (
  <section>
    <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">{title}</h2>
    <div className="text-[#716D5C] leading-relaxed whitespace-pre-line text-[15px]">{content}</div>
    <div className="mt-12 h-px bg-gray-200" />
  </section>
);
