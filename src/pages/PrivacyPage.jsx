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
      content: `Le responsable du traitement des donnees personnelles est la societe Actero, dont le siege social est situe en France.\n\nContact : contact@actero.fr`,
    },
    {
      title: "2. Donnees collectees",
      content: `Dans le cadre de nos services, nous collectons les donnees suivantes :\n\n- Donnees d'identification : nom, prenom, adresse email, numero de telephone\n- Donnees professionnelles : nom de l'entreprise, site web, secteur d'activite\n- Donnees de connexion : adresse IP, logs de connexion, type de navigateur\n- Donnees de paiement : traitees exclusivement par Stripe, nous ne stockons aucun numero de carte bancaire\n- Donnees d'utilisation : interactions avec le dashboard, metriques de performance`,
    },
    {
      title: "3. Finalites du traitement",
      content: `Vos donnees sont utilisees pour :\n\n- La fourniture et la gestion de nos services d'automatisation IA\n- La creation et la gestion de votre compte client\n- La facturation et le suivi des paiements\n- L'amelioration de nos services et le support technique\n- L'envoi de communications relatives a votre compte (rapports, alertes, mises a jour)\n- Le respect de nos obligations legales et reglementaires`,
    },
    {
      title: "4. Base legale du traitement",
      content: `Le traitement de vos donnees repose sur :\n\n- L'execution du contrat : traitement necessaire a la fourniture de nos services\n- Le consentement : pour l'envoi de communications marketing (vous pouvez le retirer a tout moment)\n- L'interet legitime : pour l'amelioration de nos services et la securite de notre plateforme\n- L'obligation legale : pour la conservation des donnees de facturation`,
    },
    {
      title: "5. Destinataires des donnees",
      content: `Vos donnees peuvent etre transmises aux sous-traitants suivants, tous conformes au RGPD :\n\n- Supabase (hebergement et base de donnees) — serveurs en Europe\n- Vercel (hebergement du site) — serveurs internationaux avec garanties adequates\n- Stripe (paiements) — certifie PCI DSS niveau 1\n- Resend (envoi d'emails transactionnels)\n- n8n (automatisation des workflows)\n\nNous ne vendons jamais vos donnees a des tiers. Vos donnees ne sont partagees qu'avec les prestataires strictement necessaires a la fourniture du service.`,
    },
    {
      title: "6. Duree de conservation",
      content: `Nous conservons vos donnees pendant les durees suivantes :\n\n- Donnees de compte : pendant toute la duree de la relation contractuelle, puis 3 ans apres la fin du contrat\n- Donnees de facturation : 10 ans (obligation legale)\n- Logs de connexion : 12 mois\n- Donnees de prospection : 3 ans apres le dernier contact`,
    },
    {
      title: "7. Vos droits",
      content: `Conformement au RGPD, vous disposez des droits suivants :\n\n- Droit d'acces : obtenir une copie de vos donnees personnelles\n- Droit de rectification : corriger des donnees inexactes ou incompletes\n- Droit a l'effacement : demander la suppression de vos donnees\n- Droit a la limitation : restreindre le traitement de vos donnees\n- Droit a la portabilite : recevoir vos donnees dans un format structure\n- Droit d'opposition : vous opposer au traitement de vos donnees\n\nPour exercer ces droits, contactez-nous a : contact@actero.fr\nNous nous engageons a repondre dans un delai de 30 jours.`,
    },
    {
      title: "8. Cookies",
      content: `Notre site utilise des cookies strictement necessaires au fonctionnement du service (authentification, preferences). Nous utilisons egalement Amplitude pour l'analyse d'audience de maniere anonymisee.\n\nVous pouvez configurer votre navigateur pour refuser les cookies. Cela n'affectera pas l'acces aux fonctionnalites essentielles du site.`,
    },
    {
      title: "9. Securite des donnees",
      content: `Nous mettons en oeuvre des mesures techniques et organisationnelles appropriees pour proteger vos donnees :\n\n- Chiffrement des donnees en transit (HTTPS/TLS)\n- Authentification securisee via Supabase Auth\n- Controle d'acces strict (Row Level Security)\n- Aucun stockage de donnees bancaires\n- Audits de securite reguliers`,
    },
    {
      title: "10. Transferts internationaux",
      content: `Certains de nos sous-traitants sont situes en dehors de l'Union Europeenne. Dans ce cas, nous nous assurons que des garanties appropriees sont en place (clauses contractuelles types de la Commission europeenne, certification adequacy decision).`,
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
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            {/* Update banner */}
            <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F5F35]/10 border border-[#0F5F35]/20 text-[#0F5F35] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#0F5F35] animate-pulse" />
              Dernière mise à jour : 10 avril 2026
            </div>

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
                Derniere mise a jour : 10 avril 2026
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
