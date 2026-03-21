import { useState, useEffect } from "react";
import { CheckCircle, Mail, ShoppingBag, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";

export function SuccessPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.search);
  const clientSlug = params.get("client");

  const [clientType, setClientType] = useState(null);
  const [shopDomain, setShopDomain] = useState("");

  useEffect(() => {
    if (!clientSlug) return;
    supabase
      .from("funnel_clients")
      .select("client_type")
      .eq("slug", clientSlug)
      .single()
      .then(({ data }) => {
        if (data) setClientType(data.client_type);
      });
  }, [clientSlug]);

  const handleInstallShopify = () => {
    const domain = shopDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!domain) return;
    const shop = domain.includes(".myshopify.com") ? domain : `${domain}.myshopify.com`;
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}&client=${encodeURIComponent(clientSlug || "")}`;
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
      <div className="text-center max-w-lg w-full">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Merci pour votre confiance
        </h1>

        <p className="text-gray-400 text-lg mb-4 leading-relaxed">
          Votre paiement a bien été confirmé.
        </p>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">Vos accès arrivent par email</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Vous recevrez vos identifiants de connexion au dashboard dans quelques minutes.
          </p>
        </div>

        {/* Shopify install step — only for e-commerce clients */}
        {clientType === "ecommerce" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-white">Étape suivante : Connectez Shopify</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Installez l'application Actero sur votre boutique Shopify pour activer les automatisations SAV.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInstallShopify()}
                placeholder="ma-boutique.myshopify.com"
                className="flex-1 px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-all placeholder-gray-600"
              />
              <button
                onClick={handleInstallShopify}
                disabled={!shopDomain.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                Installer
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
