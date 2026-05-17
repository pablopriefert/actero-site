import React, { useEffect } from "react";
import { Shield } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";

export const PrivacyPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "1. Responsable du traitement",
      content: `Le responsable du traitement des données personnelles est la société Actero, dont le siège social est situé en France.\n\nContact : contact@actero.fr`,
    },
    {
      title: "2. Données collectées",
      content: `Dans le cadre de nos services, nous collectons les données suivantes :\n\n- Données d'identification : nom, prénom, adresse email, numéro de téléphone\n- Données professionnelles : nom de l'entreprise, site web, secteur d'activité\n- Données de connexion : adresse IP, logs de connexion, type de navigateur\n- Données de paiement : traitées exclusivement par Stripe, nous ne stockons aucun numéro de carte bancaire\n- Données d'utilisation : interactions avec le dashboard, métriques de performance`,
    },
    {
      title: "3. Finalités du traitement",
      content: `Vos données sont utilisées pour :\n\n- La fourniture et la gestion de nos services d'automatisation IA\n- La création et la gestion de votre compte client\n- La facturation et le suivi des paiements\n- L'amélioration de nos services et le support technique\n- L'envoi de communications relatives à votre compte (rapports, alertes, mises à jour)\n- Le respect de nos obligations légales et réglementaires`,
    },
    {
      title: "4. Base légale du traitement",
      content: `Le traitement de vos données repose sur :\n\n- L'exécution du contrat : traitement nécessaire à la fourniture de nos services\n- Le consentement : pour l'envoi de communications marketing (vous pouvez le retirer à tout moment)\n- L'intérêt légitime : pour l'amélioration de nos services et la sécurité de notre plateforme\n- L'obligation légale : pour la conservation des données de facturation`,
    },
    {
      title: "5. Destinataires des données",
      content: `Vos données peuvent être transmises aux sous-traitants suivants, tous conformes au RGPD :\n\n- Supabase (hébergement et base de données) — serveurs en Europe\n- Vercel (hébergement du site) — serveurs internationaux avec garanties adéquates\n- Stripe (paiements) — certifié PCI DSS niveau 1\n- Resend (envoi d'emails transactionnels)\n- n8n (automatisation des workflows)\n\nNous ne vendons jamais vos données à des tiers. Vos données ne sont partagées qu'avec les prestataires strictement nécessaires à la fourniture du service.`,
    },
    {
      title: "6. Durée de conservation",
      content: `Nous conservons vos données pendant les durées suivantes :\n\n- Données de compte : pendant toute la durée de la relation contractuelle, puis 3 ans après la fin du contrat\n- Données de facturation : 10 ans (obligation légale)\n- Logs de connexion : 12 mois\n- Données de prospection : 3 ans après le dernier contact`,
    },
    {
      title: "7. Vos droits",
      content: `Conformément au RGPD, vous disposez des droits suivants :\n\n- Droit d'accès : obtenir une copie de vos données personnelles\n- Droit de rectification : corriger des données inexactes ou incomplètes\n- Droit à l'effacement : demander la suppression de vos données\n- Droit à la limitation : restreindre le traitement de vos données\n- Droit à la portabilité : recevoir vos données dans un format structuré\n- Droit d'opposition : vous opposer au traitement de vos données\n\nPour exercer ces droits, contactez-nous à : contact@actero.fr\nNous nous engageons à répondre dans un délai de 30 jours.`,
    },
    {
      title: "8. Cookies",
      content: `Notre site utilise des cookies strictement nécessaires au fonctionnement du service (authentification, préférences). Nous utilisons également Amplitude pour l'analyse d'audience de manière anonymisée.\n\nVous pouvez configurer votre navigateur pour refuser les cookies. Cela n'affectera pas l'accès aux fonctionnalités essentielles du site.`,
    },
    {
      title: "9. Sécurité des données",
      content: `Nous mettons en oeuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :\n\n- Chiffrement des données en transit (HTTPS/TLS)\n- Authentification sécurisée via Supabase Auth\n- Contrôle d'accès strict (Row Level Security)\n- Aucun stockage de données bancaires\n- Audits de sécurité réguliers`,
    },
    {
      title: "10. Transferts internationaux",
      content: `Certains de nos sous-traitants sont situés en dehors de l'Union Européenne. Dans ce cas, nous nous assurons que des garanties appropriées sont en place (clauses contractuelles types de la Commission européenne, certification adequacy decision).`,
    },
    {
      title: "11. Modifications",
      content: `Nous nous reservons le droit de modifier la presente politique de confidentialite. Toute modification substantielle sera notifiee par email ou via votre dashboard. La date de derniere mise a jour est indiquee en haut de cette page.`,
    },
    {
      title: "12. Contact et reclamation",
      content: `Pour toute question relative a la protection de vos donnees, contactez-nous :\n\nEmail : contact@actero.fr\n\nSi vous estimez que le traitement de vos donnees constitue une violation du RGPD, vous avez le droit d'introduire une reclamation aupres de la CNIL (Commission Nationale de l'Informatique et des Libertes) : www.cnil.fr`,
    },
  ];

  return (
    <>
      <SEO
        title="Politique de confidentialite — Actero"
        description="Decouvrez comment Actero collecte, utilise et protege vos donnees personnelles. Politique conforme au RGPD."
        canonical="/confidentialite"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            {/* Header */}
            <div className="mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F9F7F1] border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <Shield className="w-3.5 h-3.5" />
                Protection des donnees
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Politique de confidentialite
              </h1>
              <p className="text-lg text-[#716D5C] leading-relaxed">
                Actero s'engage a proteger la vie privee de ses utilisateurs. Cette politique decrit comment nous collectons, utilisons et protegeons vos donnees personnelles, conformement au Reglement General sur la Protection des Donnees (RGPD).
              </p>
              <p className="text-sm text-[#716D5C] mt-4">
                Derniere mise a jour : 5 avril 2026
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {sections.map((section, i) => (
                <section key={i}>
                  <h2
                    className="text-xl md:text-2xl font-bold text-[#262626] mb-4"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {section.title}
                  </h2>
                  <div className="text-[#716D5C] leading-relaxed whitespace-pre-line text-[15px]">
                    {section.content}
                  </div>
                  {i < sections.length - 1 && (
                    <div className="mt-12 h-px bg-gray-200" />
                  )}
                </section>
              ))}
            </div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
