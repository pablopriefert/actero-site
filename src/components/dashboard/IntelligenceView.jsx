import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Lightbulb, 
  RefreshCw, 
  Filter, 
  AlertCircle, 
  TrendingUp, 
  Zap, 
  ShieldAlert, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  X,
  Clock,
  Bot,
  Activity
} from 'lucide-react'
import { Badge } from '../ui/badge'

const GptBadge = () => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
    GPT-4o
  </span>
);

export const ExecutionPlanDrawer = ({
  reco,
  onClose,
  onImplement,
  supabase,
  onNavigateToActivity,
}) => {
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    let interval;
    if (startedAt) {
      const fetchRecentEvents = async () => {
        const { data } = await supabase
          .from("automation_events")
          .select("id, event_category, ticket_type, created_at, time_saved_seconds")
          .gte("created_at", startedAt)
          .order("created_at", { ascending: false })
          .limit(10);
        if (data) setRecentEvents(data);
      };

      fetchRecentEvents();
      interval = setInterval(fetchRecentEvents, 5000);
    }
    return () => clearInterval(interval);
  }, [startedAt, supabase]);

  const handleImplementClick = async () => {
    setLoading(true);
    await onImplement(reco.id, "implemented");
    setStartedAt(new Date().toISOString());
    setLoading(false);
  };

  if (!reco) return null;

  const steps = {
    growth: [
      { title: "Acquisition", desc: "Configuration des nouveaux canaux d'acquisition ciblés." },
      { title: "Conversion", desc: "Déploiement des stratégies d'optimisation du taux de conversion." },
      { title: "Analyse", desc: "Mise en place des trackers de performance de croissance." },
    ],
    efficiency: [
      { title: "Analyse des processus", desc: "Identification des goulots d'étranglement actuels." },
      { title: <span className="flex items-center gap-2">Automatisation <GptBadge /></span>, desc: "Connexion et automatisation des flux de travail chronophages." },
      { title: "Monitoring", desc: "Surveillance continue des gains d'efficacité." },
    ],
    risk: [
      { title: "Audit de sécurité", desc: "Identification des failles et vulnérabilités potentielles." },
      { title: "Mise en place de garde-fous", desc: "Déploiement des règles de mitigation des risques." },
      { title: "Alerting", desc: "Configuration des notifications d'anomalies en temps réel." },
    ],
    automation: [
      { title: "Cartographie du workflow", desc: "Définition des déclencheurs et actions automatisées." },
      { title: "Intégrations requises", desc: "Connexion sécurisée aux outils tiers." },
      { title: "Assurance Qualité (QA)", desc: "Tests approfondis des scénarios d'automatisation." },
    ],
    all: [
      { title: "Initialisation", desc: "Préparation de l'environnement d'exécution." },
      { title: "Déploiement", desc: "Mise en oeuvre des recommandations de l'IA." },
      { title: "Surveillance", desc: "Suivi des impacts post-déploiement." },
    ],
  };

  const planSteps = steps[reco.category] || steps.all;
  const isStarted = !!startedAt;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[540px] bg-[#0E1424] shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0 overflow-y-auto border-l border-white/10">
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0E1424]/90 backdrop-blur z-10">
          <div className="flex items-center gap-3 text-white font-bold">
            <Sparkles className="w-5 h-5 text-zinc-300" />
            <h2 className="text-xl tracking-tight">Plan d'exécution IA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 flex-1 flex flex-col gap-8 animate-fade-in-up font-light text-gray-400">
          <section>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-gray-400 border border-white/10 mb-4 inline-block uppercase tracking-widest">
              Contexte de l'action
            </span>
            <h3 className="text-2xl font-bold text-white mb-2 leading-tight tracking-tight">
              {reco.title}
            </h3>
            <p className="text-sm font-normal text-gray-400 leading-relaxed mb-6">
              {reco.description}
            </p>

            <div className="flex gap-4 p-5 rounded-2xl bg-[#0A0E1A] border border-white/5">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Score d'impact IA
                </p>
                <span className="text-2xl font-black text-white">
                  {reco.impact_score}
                  <span className="text-sm font-bold text-gray-400">/100</span>
                </span>
              </div>
              <div className="w-px bg-white/10"></div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Catégorie
                </p>
                <span className="text-sm font-bold text-white capitalize">
                  {reco.category}
                </span>
              </div>
            </div>
          </section>

          {(reco.estimated_time_gain_minutes > 0 || reco.estimated_revenue_gain > 0) && (
            <section>
              <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">
                Gains Stratégiqes Estimés
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {reco.estimated_time_gain_minutes > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col">
                    <Clock className="w-5 h-5 text-emerald-500 mb-2" />
                    <span className="text-xl font-bold text-emerald-400">
                      +{Math.round(reco.estimated_time_gain_minutes / 60)}h
                      <span className="text-sm font-normal opacity-60">/mois</span>
                    </span>
                  </div>
                )}
                {reco.estimated_revenue_gain > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col">
                    <TrendingUp className="w-5 h-5 text-amber-500 mb-2" />
                    <span className="text-xl font-bold text-amber-400">
                      +{Number(reco.estimated_revenue_gain).toLocaleString("fr-FR")}€
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="relative">
            <h4 className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">
              Protocoles d'implémentation
            </h4>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-px before:bg-gradient-to-b before:from-white/10 before:to-transparent">
              {planSteps.map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#0E1424] border border-white/10 flex items-center justify-center flex-shrink-0 z-10 text-gray-400 font-bold text-sm shadow-sm mt-1">
                    {idx + 1}
                  </div>
                  <div className="bg-[#0E1424] border border-white/5 p-4 rounded-2xl flex-1 shadow-sm mt-1">
                    <h5 className="font-bold text-white mb-1 leading-tight">
                      {step.title}
                    </h5>
                    <p className="text-sm font-normal text-gray-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isStarted && (
            <section className="mt-4 bg-[#0A0E1A] border border-white/10 rounded-3xl p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Realtime
                </span>
              </div>
              <h4 className="text-lg font-bold mb-2">Exécution en cours</h4>
              <p className="text-sm text-gray-400 font-normal mb-6">
                Les agents parcourent l'infrastructure actuellement.
              </p>

              {recentEvents.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mb-3" />
                  <p className="text-sm font-bold text-gray-400">
                    En attente des premiers signaux...
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {recentEvents.map((evt, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between text-sm animate-fade-in-up"
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-gray-200">
                          {evt.event_category} / {evt.ticket_type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        À l'instant
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  onClose();
                  onNavigateToActivity();
                }}
                className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
              >
                Voir l'activité en direct <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          )}
        </div>

        {!isStarted && (
          <div className="p-6 md:p-8 border-t border-white/10 bg-[#0A0E1A] flex flex-col sm:flex-row gap-3 sticky bottom-0 z-10">
            <button
              disabled={loading}
              onClick={handleImplementClick}
              className="flex-1 bg-white text-black font-bold py-3.5 px-6 rounded-xl hover:bg-gray-100 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-black/20 border-t-black rounded-full"></span>
              ) : (
                <Bot className="w-5 h-5" />
              )}
              Implémenter maintenant
            </button>
            <button
              disabled={loading}
              onClick={onClose}
              className="flex-1 sm:flex-none bg-[#0E1424] text-gray-400 font-bold py-3.5 px-6 rounded-xl border border-white/10 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export const RecommendationCard = ({ reco, onAction, onOpenPlan, theme = "dark" }) => {
  const [loadingAction, setLoadingAction] = useState(false);
  const isLight = theme === "light";

  const handleAction = async (newStatus) => {
    setLoadingAction(true);
    await onAction(reco.id, newStatus);
    setLoadingAction(false);
  };

  const getCategoryTheme = (cat) => {
    switch (cat) {
      case "growth":
        return { icon: TrendingUp, c: "text-amber-500", bg: isLight ? "bg-amber-50" : "bg-amber-500/10" };
      case "efficiency":
        return { icon: Zap, c: "text-blue-500", bg: isLight ? "bg-blue-50" : "bg-blue-500/10" };
      case "risk":
        return { icon: ShieldAlert, c: "text-red-500", bg: isLight ? "bg-red-50" : "bg-red-500/10" };
      default:
        return { icon: Lightbulb, c: "text-emerald-500", bg: isLight ? "bg-emerald-50" : "bg-emerald-500/10" };
    }
  };

  const cat = getCategoryTheme(reco.category);
  const ImpactIcon = cat.icon;

  return (
    <div className={`border rounded-3xl p-6 transition-all duration-300 ${isLight ? "bg-white border-slate-200 shadow-sm hover:shadow-md" : "bg-[#0E1424] border-white/10 hover:border-white/20"}`}>
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.bg}`}>
              <ImpactIcon className={`w-5 h-5 ${cat.c}`} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isLight ? "outline" : "secondary"}>
                {reco.category || "Automatisation"}
              </Badge>
              {reco.priority_level === "high" && (
                <Badge variant="destructive">Critique</Badge>
              )}
            </div>
          </div>

          <h4 className={`text-xl font-bold mb-2 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {reco.title}
          </h4>
          <p className={`text-sm font-medium leading-relaxed mb-4 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
            {reco.description}
          </p>

          <div className="flex flex-wrap gap-6 mt-4">
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-zinc-600"}`}>
                Impact estimé
              </span>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  {reco.impact_score}/100
                </span>
                <div className={`h-1.5 w-24 rounded-full overflow-hidden ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                  <div
                    className={`h-full rounded-full ${cat.c.replace("text-", "bg-")}`}
                    style={{ width: `${reco.impact_score}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {reco.estimated_time_gain_minutes > 0 && (
              <div className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-zinc-600"}`}>
                  Gain de temps
                </span>
                <p className="text-lg font-bold text-emerald-500 flex items-center gap-1">
                  +{Math.round(reco.estimated_time_gain_minutes / 60)}h/mois
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`pt-6 border-t flex flex-wrap items-center gap-3 ${isLight ? "border-slate-100" : "border-white/5"}`}>
        <button
          disabled={loadingAction}
          onClick={() => handleAction("implemented")}
          className="flex-1 lg:flex-none text-sm font-bold bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loadingAction ? (
            <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span>
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Approuver
        </button>
        <button
          disabled={loadingAction}
          onClick={() => onOpenPlan(reco)}
          className={`flex-1 lg:flex-none text-sm font-bold border px-6 py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${isLight ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}
        >
          Détails techniques <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const IntelligenceView = ({ supabase, setActiveTab, theme = "dark" }) => {
  const queryClient = useQueryClient();
  const isLight = theme === "light";
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("impact");
  const [actionError, setActionError] = useState("");
  const [selectedPlanReco, setSelectedPlanReco] = useState(null);

  const { data: recommendations = [], isLoading, error, refetch } = useQuery({
    queryKey: ["ai-recommendations", statusFilter, categoryFilter, sortBy],
    queryFn: async () => {
      if (!supabase) return [];
      let query = supabase.from("ai_recommendations").select("*");

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (sortBy === "impact") query = query.order("impact_score", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      return data || [];
    },
    enabled: !!supabase,
  });

  const handleAction = async (id, newStatus) => {
    try {
      setActionError("");
      const { error: rpcErr } = await supabase.rpc("mark_ai_recommendation", {
        p_id: id,
        p_status: newStatus,
      });
      if (rpcErr) throw rpcErr;
      queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
    } catch (err) {
      setActionError(err.message || "Erreur lors de la mise à jour.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={`border rounded-3xl shadow-sm overflow-hidden transition-colors duration-300 ${isLight ? "bg-white border-slate-200" : "bg-[#0E1424] border-white/10"}`}>
        <div className={`p-6 md:p-8 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isLight ? "bg-slate-900 text-white" : "bg-gradient-to-r from-zinc-900 to-zinc-800 text-white"}`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-sm">
                <Lightbulb className="w-5 h-5 text-amber-300" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Intelligence & Recommandations</h3>
            </div>
            <p className="text-sm text-slate-300/80 font-medium max-w-xl">
              L'IA analyse vos flux de données en continu pour identifier des optimisations de croissance et d'efficacité.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className={`text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ${isLight ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Rafraîchir
          </button>
        </div>

        <div className={`px-6 py-4 flex flex-wrap gap-4 items-center border-b ${isLight ? "bg-slate-50 border-slate-100" : "bg-[#0E1424] border-white/5"}`}>
          <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${isLight ? "text-slate-400" : "text-zinc-500"}`} />
            <span className={`text-sm font-bold ${isLight ? "text-slate-500" : "text-zinc-600"}`}>Filtrer par :</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`border text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 outline-none transition-colors ${isLight ? "bg-white border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-gray-300"}`}
          >
            <option value="active">À traiter</option>
            <option value="implemented">Implémentées</option>
            <option value="dismissed">Ignorées</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`border text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 outline-none transition-colors ${isLight ? "bg-white border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-gray-300"}`}
          >
            <option value="all">Toutes les catégories</option>
            <option value="growth">Croissance</option>
            <option value="efficiency">Efficacité</option>
            <option value="risk">Risque</option>
            <option value="automation">Automatisation</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`border text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 outline-none transition-colors ml-auto ${isLight ? "bg-white border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-gray-300"}`}
          >
            <option value="impact">Trier par: Impact</option>
            <option value="recent">Trier par: Plus récentes</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{actionError}</p>
        </div>
      )}

      {error ? (
        <div className="p-10 rounded-3xl flex flex-col items-center justify-center text-center border bg-red-50 border-red-100">
          <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
          <p className="text-red-900 font-bold mb-1">Erreur de connexion</p>
          <p className="text-sm text-red-600">{error.message || error}</p>
        </div>
      ) : isLoading && recommendations.length === 0 ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`border rounded-3xl p-6 shadow-sm animate-pulse h-48 flex flex-col gap-4 ${isLight ? "bg-white border-slate-200" : "bg-[#0E1424] border-white/10"}`}>
              <div className={`h-6 rounded w-1/4 ${isLight ? "bg-slate-100" : "bg-white/5"}`}></div>
              <div className={`h-4 rounded w-3/4 mt-2 ${isLight ? "bg-slate-100" : "bg-white/5"}`}></div>
              <div className="mt-auto flex gap-4">
                <div className={`h-10 rounded w-32 ${isLight ? "bg-slate-100" : "bg-white/5"}`}></div>
              </div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className={`border rounded-3xl p-16 text-center shadow-sm flex flex-col items-center ${isLight ? "bg-white border-slate-200" : "bg-[#0E1424] border-white/10"}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border ${isLight ? "bg-blue-50 border-blue-100" : "bg-white/5 border-white/5"}`}>
            <Lightbulb className={`w-10 h-10 ${isLight ? "text-blue-500" : "text-gray-300"}`} />
          </div>
          <p className={`font-bold text-xl mb-2 ${isLight ? "text-slate-900" : "text-white"}`}>Tout est optimisé</p>
          <p className={`font-medium max-w-md ${isLight ? "text-slate-500" : "text-zinc-500"}`}>L'IA n'a pas de nouvelle recommandation à proposer pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
          {recommendations.map((reco) => (
            <RecommendationCard
              key={reco.id}
              reco={reco}
              onAction={handleAction}
              onOpenPlan={setSelectedPlanReco}
              theme={theme}
            />
          ))}
        </div>
      )}

      {selectedPlanReco && (
        <ExecutionPlanDrawer
          reco={selectedPlanReco}
          supabase={supabase}
          onClose={() => setSelectedPlanReco(null)}
          onImplement={handleAction}
          onNavigateToActivity={() => setActiveTab("activity")}
        />
      )}
    </div>
  );
};
