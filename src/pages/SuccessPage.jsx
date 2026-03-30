import { CheckCircle, ArrowRight } from "lucide-react";

export function SuccessPage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Merci, tout est confirmé
        </h1>

        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          Nous allons vous contacter sous 24h pour démarrer la mise en place de votre automatisation.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://tally.so"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            Commencer l'onboarding
            <ArrowRight className="w-5 h-5" />
          </a>

          <button
            onClick={() => onNavigate("/")}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            Retour au site
          </button>
        </div>
      </div>
    </div>
  );
}
