import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen, Clock, BarChart3, Users, PlayCircle } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "sav", label: "SAV" },
  { id: "ecom", label: "E-commerce" },
  { id: "ai", label: "IA" },
  { id: "automation", label: "Automation" },
  { id: "tools", label: "Outils" },
];

const LEVELS = [
  { id: "all", label: "Tous niveaux" },
  { id: "beginner", label: "Débutant" },
  { id: "intermediate", label: "Intermédiaire" },
  { id: "advanced", label: "Avancé" },
];

const GRADIENT_MAP = {
  emerald: ["#064e3b", "#10b981"],
  teal: ["#134e4a", "#14b8a6"],
  green: ["#14532d", "#22c55e"],
  lime: ["#3f6212", "#84cc16"],
  cyan: ["#164e63", "#06b6d4"],
  blue: ["#1e3a8a", "#3b82f6"],
  indigo: ["#312e81", "#6366f1"],
  violet: ["#4c1d95", "#8b5cf6"],
  purple: ["#581c87", "#a855f7"],
  fuchsia: ["#701a75", "#d946ef"],
  pink: ["#831843", "#ec4899"],
  rose: ["#881337", "#f43f5e"],
  amber: ["#78350f", "#f59e0b"],
  orange: ["#7c2d12", "#f97316"],
  red: ["#7f1d1d", "#ef4444"],
};

function CourseCover({ cover, title }) {
  const key = (cover || "").startsWith("gradient:") ? cover.split(":")[1] : "emerald";
  const [from, to] = GRADIENT_MAP[key] || GRADIENT_MAP.emerald;
  return (
    <div
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <PlayCircle className="w-14 h-14 text-white/90 drop-shadow-lg" />
      </div>
      <div className="absolute bottom-3 left-4 right-4 text-white/95 text-sm font-bold line-clamp-2">
        {title}
      </div>
    </div>
  );
}

function LevelBadge({ level }) {
  const map = {
    beginner: { label: "Débutant", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    intermediate: { label: "Intermédiaire", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    advanced: { label: "Avancé", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const info = map[level] || map.beginner;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${info.cls}`}>
      {info.label}
    </span>
  );
}

export const AcademyPage = ({ onNavigate }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent("Academy_Page_Viewed");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("academy_courses")
        .select("*")
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (!alive) return;
      if (!error && data) setCourses(data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (level !== "all" && c.level !== level) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.subtitle || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
      );
    });
  }, [courses, search, category, level]);

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: courses.slice(0, 15).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Course",
        name: c.title,
        description: c.subtitle || c.description,
        provider: { "@type": "Organization", name: "Actero", sameAs: "https://actero.fr" },
        url: `https://actero.fr/academy/${c.slug}`,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#262626]">
      <SEO
        title="Actero Academy - Formations gratuites service client et automatisation e-commerce"
        description="Apprenez gratuitement a automatiser votre SAV, votre e-commerce et a deployer des agents IA performants. 15 cours experts, 100h de contenu, acces libre."
        canonical="/academy"
        keywords="formation SAV, service client e-commerce, agent IA, automation, Shopify, Actero Academy"
        schemaData={schemaData}
      />
      <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-[#003725] mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Actero Academy
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Formez-vous gratuitement a l'automatisation du service client
            </h1>
            <p className="text-lg md:text-xl text-[#716D5C] max-w-3xl mx-auto mb-8">
              Des cours concrets pour scaler votre SAV, automatiser votre e-commerce et deployer
              des agents IA qui convertissent.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#716D5C] mb-10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#003725]" />
                <span className="font-semibold text-[#262626]">15+ cours gratuits</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#003725]" />
                <span className="font-semibold text-[#262626]">100h de contenu</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#003725]" />
                <span className="font-semibold text-[#262626]">+1000 inscrits</span>
              </div>
            </div>

            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#716D5C]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un cours..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#003725] font-medium"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 mb-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  category === c.id
                    ? "bg-cta text-white border-[#003725]"
                    : "bg-white text-[#262626] border-gray-200 hover:border-[#003725]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  level === l.id
                    ? "bg-[#262626] text-white border-[#262626]"
                    : "bg-white text-[#716D5C] border-gray-200 hover:border-[#262626]"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-gray-200 p-4 animate-pulse">
                  <div className="aspect-[16/9] rounded-xl bg-gray-100 mb-4" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[#716D5C]">
              Aucun cours ne correspond a votre recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((c) => (
                <motion.button
                  key={c.id}
                  onClick={() => {
                    trackEvent("Academy_Course_Clicked", { slug: c.slug, title: c.title });
                    onNavigate(`/academy/${c.slug}`);
                  }}
                  whileHover={{ y: -4 }}
                  className="text-left rounded-2xl bg-white border border-gray-200 p-4 hover:shadow-lg hover:border-[#003725] transition-all"
                >
                  <CourseCover cover={c.cover_image} title={c.title} />
                  <div className="mt-4 flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#003725] bg-cta/10 px-2 py-0.5 rounded-full">
                      {CATEGORIES.find((x) => x.id === c.category)?.label || c.category}
                    </span>
                    <LevelBadge level={c.level} />
                  </div>
                  <h3 className="text-lg font-bold text-[#262626] mb-1 line-clamp-2">{c.title}</h3>
                  {c.subtitle && (
                    <p className="text-sm text-[#716D5C] line-clamp-2 mb-3">{c.subtitle}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-[#716D5C]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {c.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {c.module_count} modules
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default AcademyPage;
