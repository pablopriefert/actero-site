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
        title="Conditions générales d'utilisation — Actero"
        description="Conditions générales d'utilisation du service Actero. Règles d'utilisation de la plateforme et des agents IA."
        canonical="/utilisation"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            <div className="mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <FileText className="w-3.5 h-3.5" />
                Conditions d'utilisation
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Conditions générales d'utilisation
              </h1>
              <p className="text-sm text-[#716D5C]">Dernière mise à jour : 7 avril 2026</p>
            </div>

            <div className="space-y-12">

              <Section title="1. Objet" content={`Les présentes conditions générales d'utilisation (ci-après "CGU") régissent l'accès et l'utilisation de la plateforme Actero accessible à l'adresse actero.fr (ci-après "la Plateforme"), éditée par Anne AIN EI — Actero, micro-entrepreneur, SIRET 103 250 775 00014, dont le siège social est situé au 54 Boulevard Notre-Dame, 13006 Marseille, France (ci-après "Actero").

En utilisant la Plateforme, l'Utilisateur accepte sans réserve les présentes CGU.`} />

              <Section title="2. Définitions" content={`- "Utilisateur" : toute personne physique ou morale accédant à la Plateforme.
- "Client" : tout Utilisateur ayant souscrit à un abonnement Actero.
- "Agent IA" : programme d'intelligence artificielle déployé par Actero pour automatiser des tâches spécifiques (support client, relance paniers, qualification leads).
- "Dashboard" : interface de suivi accessible au Client après souscription.
- "Service" : l'ensemble des prestations fournies par Actero via la Plateforme.`} />

              <Section title="3. Accès à la Plateforme" content={`L'accès à la partie publique du site (pages d'information, tarifs, FAQ) est libre et gratuit.

L'accès au Dashboard et aux fonctionnalités avancées (agents IA, intégrations, simulateur, base de connaissances) est réservé aux Clients disposant d'un compte actif et d'un abonnement en cours de validité.

Actero se réserve le droit de modifier, suspendre ou interrompre tout ou partie de la Plateforme à tout moment, sans préavis ni indemnité.`} />

              <Section title="4. Inscription et compte" content={`Pour accéder au Service, le Client doit créer un compte en fournissant des informations exactes et à jour (nom, email, informations de l'entreprise).

Le Client est responsable de la confidentialité de ses identifiants de connexion. Toute utilisation du compte est présumée faite par le Client.

Le Client peut inviter des membres de son équipe avec des rôles différenciés (Admin, Opérationnel, Support, Finance). Le Client reste responsable de l'utilisation faite par les membres qu'il invite.`} />

              <Section title="5. Description du Service" content={`Actero fournit un service d'automatisation basé sur l'intelligence artificielle, comprenant :

- Le déploiement d'agents IA pour le support client e-commerce (Shopify)
- La configuration personnalisée du ton de marque, des règles métier et des règles & limites
- Un dashboard de suivi des performances en temps réel
- La connexion aux outils tiers via OAuth (Shopify, Slack, Gorgias, Zendesk, Gmail)
- Un simulateur de conversation pour tester l'agent avant mise en production
- Un système d'escalade vers un humain quand l'agent IA ne peut pas répondre

Le Service est fourni "en l'état". Actero ne garantit pas l'absence d'erreurs ou d'interruptions.`} />

              <Section title="6. Obligations du Client" content={`Le Client s'engage à :

- Fournir des informations exactes lors de l'inscription et les maintenir à jour
- Utiliser le Service conformément à sa destination et aux présentes CGU
- Ne pas utiliser le Service à des fins illicites, frauduleuses ou portant atteinte aux droits de tiers
- Ne pas tenter d'accéder aux systèmes informatiques d'Actero de manière non autorisée
- Ne pas copier, reproduire ou extraire le contenu de la Plateforme
- Respecter les lois applicables, notamment le RGPD concernant les données de ses propres clients
- Configurer les règles & limites de son agent IA de manière responsable`} />

              <Section title="7. Tarification et paiement" content={`Les tarifs du Service sont communiques sur devis après un audit gratuit.

Le paiement est effectue mensuellement par carte bancaire via Stripe. Les factures sont disponibles dans le portail client Stripe, accessible depuis le Dashboard.

TVA non applicable, article 293 B du Code General des Impots.

En cas de defaut de paiement, Actero se reserve le droit de suspendre l'accès au Service après relance restee infructueuse pendant 15 jours.`} />

              <Section title="8. Durée et résiliation" content={`L'abonnement est souscrit pour une durée indéterminée avec facturation mensuelle.

Le Client peut résilier son abonnement à tout moment depuis son Dashboard (section Mon Profil > Gérer mon abonnement). La résiliation prend effet à la fin de la période mensuelle en cours.

Actero peut résilier l'abonnement d'un Client en cas de manquement grave aux présentes CGU, après mise en demeure restée infructueuse pendant 15 jours.

En cas de résiliation, le Client conserve l'accès à ses données pendant 30 jours. Au-delà, Actero se réserve le droit de supprimer les données du Client.`} />

              <Section title="9. Propriété intellectuelle" content={`La Plateforme, les agents IA, les workflows, les algorithmes et l'ensemble des contenus d'Actero sont protégés par le droit de la propriété intellectuelle.

Le Client dispose d'un droit d'utilisation personnel, non exclusif et non cessible du Service pendant la durée de son abonnement.

Les données saisies par le Client (base de connaissances, règles métier, règles & limites) restent la propriété du Client.`} />

              <Section title="10. Données personnelles" content={`Actero traite les données personnelles conformément au Règlement Général sur la Protection des Données (RGPD).

Pour plus d'informations sur la collecte, l'utilisation et la protection des données personnelles, consultez notre Politique de confidentialité accessible à l'adresse actero.fr/confidentialite.`} />

              <Section title="11. Responsabilité" content={`Actero met en oeuvre les moyens nécessaires pour assurer le bon fonctionnement du Service.

Actero ne saurait être tenue responsable :
- Des réponses générées par les agents IA, qui sont des outils d'aide et ne se substituent pas au jugement humain
- Des dommages indirects (perte de chiffre d'affaires, perte de clients, atteinte à l'image)
- Des interruptions de service dues à des cas de force majeure ou à des prestataires tiers (Shopify, Stripe, Supabase)
- De l'utilisation faite par le Client des agents IA

La responsabilité totale d'Actero est limitée au montant des sommes versées par le Client au cours des 12 derniers mois.`} />

              <Section title="12. Disponibilité du Service" content={`Actero s'efforce de maintenir le Service disponible 24 heures sur 24, 7 jours sur 7.

Actero ne garantit pas une disponibilité ininterrompue et ne saurait être tenue responsable des interruptions de service pour maintenance, mise à jour ou en cas de force majeure.

Les opérations de maintenance planifiées seront, dans la mesure du possible, signalées à l'avance aux Clients via le Dashboard ou par email.`} />

              <Section title="13. Modification des CGU" content={`Actero se réserve le droit de modifier les présentes CGU à tout moment.

Les modifications substantielles seront notifiées aux Clients par email ou via le Dashboard au moins 30 jours avant leur entrée en vigueur.

L'utilisation continue du Service après l'entrée en vigueur des modifications vaut acceptation des nouvelles CGU.`} />

              <Section title="14. Droit applicable et litiges" content={`Les présentes CGU sont soumises au droit français.

En cas de litige relatif à l'interprétation ou à l'exécution des présentes CGU, les parties s'efforceront de trouver une solution amiable.

À défaut de résolution amiable dans un délai de 30 jours, le litige sera soumis aux tribunaux compétents de Marseille.

Conformément aux dispositions du Code de la consommation, le Client consommateur peut recourir gratuitement au service de médiation MEDICYS (www.medicys.fr).`} />

              <Section title="15. Contact" content={`Pour toute question relative aux présentes CGU :

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
