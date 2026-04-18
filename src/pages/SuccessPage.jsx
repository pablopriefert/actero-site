import { CheckCircle, ArrowRight, Zap, BookOpen, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { trackEvent } from "../lib/analytics";

/**
 * SuccessPage — affichée après un paiement Stripe réussi.
 *
 * Objectifs copy :
 *  1. Rassurer (paiement confirmé, facture envoyée)
 *  2. Donner 3 prochaines étapes concrètes (éviter le "wait what do I do now")
 *  3. Réduire le refund risk — user voit immédiatement qu'il peut commencer
 *  4. Inviter à un canal de support humain si besoin (diminue l'isolation post-paiement)
 *
 * Analytics : déjà couvert par Event 8 "Plan Upgraded" côté serveur dans stripe-webhook.
 */
export function SuccessPage({ onNavigate }) {
  useEffect(() => {
    // Analytics
    trackEvent('Payment Success Viewed');
  }, []);

  return (
    <div className="min-h-screen bg-[#F9F7F1] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        {/* Hero — confirmation */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-full bg-cta/10 border-2 border-cta/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-cta" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Bienvenue chez Actero.
          </h1>
          <p className="text-lg text-[#71717a] leading-relaxed max-w-md mx-auto">
            Votre paiement est confirmé et votre facture vient d'être envoyée par email. Voici comment démarrer en moins de 15 minutes.
          </p>
        </div>

        {/* 3 next steps — concrete, ordered */}
        <div className="bg-white rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af] mb-6">
            Vos 3 prochaines étapes
          </p>

          <div className="space-y-5">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cta text-white text-[13px] font-bold flex items-center justify-center">1</div>
              <div className="flex-1">
                <p className="font-semibold text-[#1a1a1a] mb-1">Connectez Shopify en OAuth</p>
                <p className="text-sm text-[#71717a] leading-relaxed">
                  Un clic pour autoriser Actero à lire votre catalogue, vos commandes et vos politiques de retour. Pas de code, pas d'installation d'app.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cta text-white text-[13px] font-bold flex items-center justify-center">2</div>
              <div className="flex-1">
                <p className="font-semibold text-[#1a1a1a] mb-1">Laissez l'IA apprendre votre ton</p>
                <p className="text-sm text-[#71717a] leading-relaxed">
                  Actero analyse automatiquement vos 50 derniers échanges SAV pour caler le ton, le tu/vous et votre style. Vous pouvez affiner manuellement ensuite.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cta text-white text-[13px] font-bold flex items-center justify-center">3</div>
              <div className="flex-1">
                <p className="font-semibold text-[#1a1a1a] mb-1">Testez sur 5 tickets réels</p>
                <p className="text-sm text-[#71717a] leading-relaxed">
                  Utilisez le simulateur pour voir comment l'agent répondrait à vos vrais cas. Ajustez les règles métier, puis activez en production.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("/client")}
            className="w-full mt-8 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-cta text-white font-semibold text-[15px] hover:bg-[#003725] transition-colors"
          >
            Accéder à mon dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Support + reassurance footer */}
        <div className="grid md:grid-cols-3 gap-4 text-center">
          <a
            href="/support"
            className="bg-white rounded-xl border border-[#f0f0f0] p-5 hover:border-cta/30 transition-colors group"
          >
            <BookOpen className="w-5 h-5 text-cta mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-[#1a1a1a]">Guide de démarrage</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">10 min de lecture</p>
          </a>
          <a
            href="mailto:support@actero.fr"
            className="bg-white rounded-xl border border-[#f0f0f0] p-5 hover:border-cta/30 transition-colors group"
          >
            <MessageCircle className="w-5 h-5 text-cta mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-[#1a1a1a]">Équipe support</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Réponse sous 2h</p>
          </a>
          <a
            href="/audit"
            className="bg-white rounded-xl border border-[#f0f0f0] p-5 hover:border-cta/30 transition-colors group"
          >
            <Zap className="w-5 h-5 text-cta mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-[#1a1a1a]">Onboarding guidé</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">15 min avec notre équipe</p>
          </a>
        </div>

        {/* Refund safety note — reduces post-purchase anxiety */}
        <p className="text-center text-[12px] text-[#9ca3af] mt-8 leading-relaxed">
          Garantie 30 jours satisfait ou remboursé · Résiliable à tout moment depuis votre dashboard<br />
          Une question ? Écrivez à <a href="mailto:support@actero.fr" className="text-cta hover:underline font-medium">support@actero.fr</a>
        </p>
      </div>
    </div>
  );
}
