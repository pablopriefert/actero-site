import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  BarChart3,
  PlayCircle,
  CheckCircle2,
  FileText,
  Download,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import { CourseCover, resolveGradient } from "../components/academy/CourseCover";
import {
  EmailGateModal,
  getStoredAcademyEmail,
  setStoredAcademyEmail,
} from "../components/academy/EmailGateModal";

const CATEGORY_LABELS = {
  sav: "SAV",
  ecom: "E-commerce",
  ai: "IA",
  automation: "Automation",
  tools: "Outils",
};

const LEVEL_LABELS = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

async function enrollUser(email, courseId) {
  try {
    const res = await fetch("/api/academy/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, course_id: courseId }),
    });
    if (!res.ok) throw new Error("Inscription impossible");
  } catch (_err) {
    // Fallback direct insert if API unavailable (dev)
    if (supabase) {
      await supabase
        .from("academy_enrollments")
        .upsert(
          { user_email: email, course_id: courseId },
          { onConflict: "user_email,course_id" }
        );
    }
  }
}

export const AcademyCoursePage = ({ slug, onNavigate }) => {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("description");
  const [gateOpen, setGateOpen] = useState(false);
  const [enrolledEmail, setEnrolledEmail] = useState(() => getStoredAcademyEmail());
  const [progress, setProgress] = useState({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase || !slug) return;
      setLoading(true);
      const { data: courseData } = await supabase
        .from("academy_courses")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (!alive) return;
      if (!courseData) {
        setLoading(false);
        return;
      }
      setCourse(courseData);

      const { data: modData } = await supabase
        .from("academy_modules")
        .select("*")
        .eq("course_id", courseData.id)
        .order("order_index", { ascending: true });
      if (!alive) return;
      setModules(modData || []);

      const email = getStoredAcademyEmail();
      if (email) {
        const { data: enroll } = await supabase
          .from("academy_enrollments")
          .select("progress")
          .eq("user_email", email)
          .eq("course_id", courseData.id)
          .maybeSingle();
        if (alive && enroll?.progress) setProgress(enroll.progress);
      }
      setLoading(false);
      trackEvent("Academy_Course_Viewed", { slug });
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const { from, to } = resolveGradient(course?.cover_image);

  const completedCount = useMemo(
    () => modules.filter((m) => progress?.[m.slug]?.completed).length,
    [modules, progress]
  );
  const progressPct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  const handleStart = () => {
    if (!enrolledEmail) {
      setGateOpen(true);
      return;
    }
    if (modules[0]) {
      onNavigate(`/academy/${slug}/${modules[0].slug}`);
    }
  };

  const handleGateSubmit = async (email) => {
    setStoredAcademyEmail(email);
    setEnrolledEmail(email);
    if (course) await enrollUser(email, course.id);
    setGateOpen(false);
    trackEvent("Academy_Enrollment_Created", { slug });
    if (modules[0]) {
      onNavigate(`/academy/${slug}/${modules[0].slug}`);
    }
  };

  const schemaData = course
    ? {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title,
        description: course.subtitle || course.description,
        provider: {
          "@type": "Organization",
          name: "Actero",
          sameAs: "https://actero.fr",
        },
        url: `https://actero.fr/academy/${course.slug}`,
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          inLanguage: "fr",
        },
      }
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F7F1]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />
        <div className="pt-40 text-center text-[#716D5C]">Chargement...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#F9F7F1]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />
        <div className="pt-40 text-center">
          <h1 className="text-2xl font-bold mb-2">Cours introuvable</h1>
          <button
            onClick={() => onNavigate("/academy")}
            className="text-[#003725] font-bold underline mt-4"
          >
            Retour a l'Academy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F7F1] text-[#262626]">
      <SEO
        title={`${course.title} - Actero Academy`}
        description={course.subtitle || course.description}
        canonical={`/academy/${course.slug}`}
        keywords={`${course.title}, formation ${CATEGORY_LABELS[course.category]}, Actero Academy`}
        schemaData={schemaData}
      />
      <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

      {/* Header with gradient background */}
      <section
        className="pt-32 pb-16 px-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="max-w-6xl mx-auto relative">
          <button
            onClick={() => onNavigate("/academy")}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour a l'Academy
          </button>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-white/20 text-white">
              {CATEGORY_LABELS[course.category] || course.category}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-white/20 text-white">
              {LEVEL_LABELS[course.level]}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 max-w-3xl">
            {course.title}
          </h1>
          {course.subtitle && (
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mb-6">{course.subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-6 text-white/90 text-sm mb-8">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {course.duration_minutes} minutes
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {modules.length} modules
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Gratuit
            </div>
          </div>
          <button
            onClick={handleStart}
            className="bg-white text-[#003725] font-bold px-6 py-3 rounded-xl hover:bg-white/95 transition-colors inline-flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            {enrolledEmail && completedCount > 0 ? "Continuer le cours" : "Commencer le cours"}
          </button>
        </div>
      </section>

      {/* Body */}
      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2">
            <div className="flex gap-1 border-b border-gray-200 mb-6">
              {[
                { id: "description", label: "Description" },
                { id: "modules", label: "Modules" },
                { id: "resources", label: "Ressources" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                    tab === t.id
                      ? "text-[#003725] border-[#003725]"
                      : "text-[#716D5C] border-transparent hover:text-[#262626]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "description" && (
              <div className="prose prose-sm max-w-none">
                <p className="text-[#262626] leading-relaxed text-base whitespace-pre-line">
                  {course.description}
                </p>
                <h3 className="text-lg font-bold text-[#262626] mt-8 mb-3">
                  Ce que vous allez apprendre
                </h3>
                <ul className="space-y-2">
                  {modules.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 text-sm text-[#262626]">
                      <CheckCircle2 className="w-4 h-4 text-[#003725] mt-0.5 flex-shrink-0" />
                      {m.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "modules" && (
              <div className="space-y-2">
                {modules.map((m, i) => {
                  const done = progress?.[m.slug]?.completed;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (!enrolledEmail) {
                          setGateOpen(true);
                          return;
                        }
                        onNavigate(`/academy/${slug}/${m.slug}`);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 hover:border-[#003725] hover:shadow-sm transition-all text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          done ? "bg-[#003725] text-white" : "bg-gray-100 text-[#716D5C]"
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#262626] truncate">{m.title}</div>
                        {m.description && (
                          <div className="text-xs text-[#716D5C] line-clamp-1">{m.description}</div>
                        )}
                      </div>
                      <div className="text-xs text-[#716D5C] flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {Math.round((m.duration_seconds || 600) / 60)} min
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#716D5C] flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "resources" && (
              <div className="space-y-3">
                {modules
                  .flatMap((m) =>
                    (m.resources || []).map((r, idx) => ({
                      ...r,
                      moduleTitle: m.title,
                      key: `${m.id}-${idx}`,
                    }))
                  )
                  .map((r) => (
                    <a
                      key={r.key}
                      href={r.url || "#"}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 hover:border-[#003725] transition-all"
                    >
                      <FileText className="w-5 h-5 text-[#003725]" />
                      <div className="flex-1">
                        <div className="font-semibold text-[#262626]">{r.title}</div>
                        <div className="text-xs text-[#716D5C]">{r.moduleTitle}</div>
                      </div>
                      <Download className="w-4 h-4 text-[#716D5C]" />
                    </a>
                  ))}
                {modules.every((m) => !(m.resources || []).length) && (
                  <div className="text-sm text-[#716D5C]">
                    Aucune ressource telechargeable pour ce cours.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl bg-white border border-gray-200 p-6">
              <CourseCover
                cover={course.cover_image}
                title=""
                className="aspect-[16/9] rounded-xl mb-4"
              />
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-[#716D5C] mb-2">
                  <span className="font-semibold">Progression</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[#003725] transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#716D5C] mt-1">
                  {completedCount} / {modules.length} modules completes
                </div>
              </div>
              <div className="space-y-1">
                {modules.map((m, i) => {
                  const done = progress?.[m.slug]?.completed;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (!enrolledEmail) {
                          setGateOpen(true);
                          return;
                        }
                        onNavigate(`/academy/${slug}/${m.slug}`);
                      }}
                      className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-[#F9F7F1] transition-colors"
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-[#003725] flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      <span className="text-xs text-[#262626] font-medium truncate flex-1">
                        {i + 1}. {m.title}
                      </span>
                      <span className="text-[10px] text-[#716D5C]">
                        {Math.round((m.duration_seconds || 600) / 60)}m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />

      <EmailGateModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onSubmit={handleGateSubmit}
        courseTitle={course.title}
      />
    </div>
  );
};

export default AcademyCoursePage;
