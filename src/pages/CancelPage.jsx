import { XCircle, RotateCcw } from "lucide-react";

export function CancelPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.search);
  const client = params.get("client");

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-8">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Paiement annulé
        </h1>

        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          Pas de souci — vous pouvez reprendre à tout moment.
        </p>

        <div className="flex flex-col gap-3">
          {client && (
            <button
              onClick={() => onNavigate(`/start/${client}`)}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              Réessayer
            </button>
          )}

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
