import React, { useEffect } from "react";
import { Scale } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";

export const LegalPage = ({ onNavigate }) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <SEO
        title="Mentions légales — Actero"
        description="Mentions légales du site actero.fr — identité de l'éditeur, hébergement, propriété intellectuelle."
        canonical="/mentions-legales"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            {/* Header */}
            <div className="mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <Scale className="w-3.5 h-3.5" />
                Informations légales
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Mentions légales
              </h1>
              <p className="text-sm text-[#716D5C]">
                Dernière mise à jour : 7 avril 2026
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">1. Éditeur du site</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-2">
                  <p>Le site <strong className="text-[#262626]">actero.fr</strong> est édité par :</p>
                  <div className="bg-surface rounded-xl p-5 mt-3 space-y-1.5">
                    <p><strong className="text-[#262626]">Anne AIN EI — Actero</strong></p>
                    <p>Entrepreneur individuel — Micro-entrepreneur</p>
                    <p>SIREN : 103 250 775</p>
                    <p>SIRET : 103 250 775 00014</p>
                    <p>Code APE : 62.02A — Conseil en systèmes et logiciels informatiques</p>
                    <p>Siège social : 54 Boulevard Notre-Dame, 13006 Marseille, France</p>
                    <p>Date d'immatriculation : 02/04/2026</p>
                    <p>Email : contact@actero.fr</p>
                  </div>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">2. Directeur de la publication</h2>
                <p className="text-[#716D5C] leading-relaxed text-[15px]">
                  Le directeur de la publication du site actero.fr est Anne AIN, en qualité de titulaire de la micro-entreprise.
                </p>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">3. Hébergement</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-2">
                  <p>Le site est hébergé par :</p>
                  <div className="bg-surface rounded-xl p-5 mt-3 space-y-1.5">
                    <p><strong className="text-[#262626]">Vercel Inc.</strong></p>
                    <p>340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</p>
                    <p>Site web : vercel.com</p>
                  </div>
                  <p className="mt-3">La base de données est hébergée par :</p>
                  <div className="bg-surface rounded-xl p-5 mt-3 space-y-1.5">
                    <p><strong className="text-[#262626]">Supabase Inc.</strong></p>
                    <p>Région : EU West (Irlande)</p>
                    <p>Site web : supabase.com</p>
                  </div>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">4. TVA</h2>
                <p className="text-[#716D5C] leading-relaxed text-[15px]">
                  TVA non applicable, article 293 B du Code Général des Impôts (régime de franchise en base de TVA).
                </p>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">5. Propriété intellectuelle</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-3">
                  <p>
                    L'ensemble du contenu du site actero.fr (textes, images, logos, icônes, logiciels, base de données) est la propriété exclusive d'Actero ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
                  </p>
                  <p>
                    Toute reproduction, représentation, modification, publication, transmission, ou exploitation totale ou partielle du contenu du site, par quelque procédé que ce soit, sans l'autorisation préalable écrite d'Actero, est strictement interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
                  </p>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">6. Protection des données personnelles</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-3">
                  <p>
                    Actero s'engage à protéger les données personnelles de ses utilisateurs conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
                  </p>
                  <p>
                    Pour en savoir plus sur la collecte, l'utilisation et la protection de vos données, consultez notre{' '}
                    <button onClick={() => onNavigate('/confidentialite')} className="text-[#003725] font-semibold underline underline-offset-2">
                      Politique de confidentialité
                    </button>.
                  </p>
                  <p>
                    Pour exercer vos droits (accès, rectification, suppression, portabilité), contactez-nous à : contact@actero.fr
                  </p>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">7. Cookies</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-3">
                  <p>
                    Le site actero.fr utilise des cookies strictement nécessaires au fonctionnement du service (authentification, session utilisateur). Des cookies d'analyse anonymisée (Amplitude) peuvent également être utilisés pour améliorer l'expérience utilisateur.
                  </p>
                  <p>
                    Vous pouvez configurer votre navigateur pour refuser les cookies. Cela n'affectera pas l'accès aux fonctionnalités essentielles du site.
                  </p>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">8. Limitation de responsabilité</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px] space-y-3">
                  <p>
                    Actero s'efforce de fournir des informations exactes et à jour sur le site actero.fr. Toutefois, Actero ne peut garantir l'exactitude, la complétude ou l'actualité des informations diffusées.
                  </p>
                  <p>
                    Actero décline toute responsabilité pour les dommages directs ou indirects résultant de l'accès ou de l'utilisation du site, y compris l'inaccessibilité, les pertes de données, les détériorations, ou les virus pouvant affecter l'équipement informatique de l'utilisateur.
                  </p>
                </div>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">9. Liens hypertextes</h2>
                <p className="text-[#716D5C] leading-relaxed text-[15px]">
                  Le site actero.fr peut contenir des liens vers des sites tiers. Actero n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. L'insertion de ces liens ne constitue pas une approbation de leur contenu.
                </p>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">10. Droit applicable et juridiction</h2>
                <p className="text-[#716D5C] leading-relaxed text-[15px]">
                  Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents de Marseille seront seuls compétents.
                </p>
                <div className="mt-6 h-px bg-gray-200" />
              </section>

              <section>
                <h2 className="text-xl md:text-2xl font-bold text-[#262626] mb-4">11. Contact</h2>
                <div className="text-[#716D5C] leading-relaxed text-[15px]">
                  <p>Pour toute question relative aux présentes mentions légales :</p>
                  <div className="bg-surface rounded-xl p-5 mt-3 space-y-1.5">
                    <p>Email : contact@actero.fr</p>
                    <p>Site : actero.fr</p>
                    <p>Adresse : 54 Boulevard Notre-Dame, 13006 Marseille, France</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
