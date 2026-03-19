import { CheckCircle, Mail } from "lucide-react";

export function SuccessPage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Merci pour votre confiance
        </h1>

        <p className="text-gray-400 text-lg mb-4 leading-relaxed">
          Votre paiement a bien été confirmé.
        </p>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">Vos accès arrivent par email</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Vous recevrez vos identifiants de connexion au dashboard dans quelques minutes. Notre équipe vous contactera sous 24h pour démarrer la mise en place.
          </p>
        </div>

        <button
          onClick={() => onNavigate("/")}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          Retour au site
        </button>
      </div>
    </div>
  );
}
