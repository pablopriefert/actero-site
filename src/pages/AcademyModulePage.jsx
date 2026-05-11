import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Download,
  PlayCircle,
  Check,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import { resolveGradient } from "../components/academy/CourseCover";
import {
  EmailGateModal,
  getStoredAcademyEmail,
  setStoredAcademyEmail,
} from "../components/academy/EmailGateModal";

async function upsertProgress(email, courseId, moduleSlug, markComplete) {
  if (!supabase) return null;
  const { data: existing } = await supabase
    .from("academy_enrollments")
    .select("progress")
    .eq("user_email", email)
    .eq("course_id", courseId)
    .maybeSingle();
  const next = { ...(existing?.progress || {}) };
  if (markComplete) {
    next[moduleSlug] = { completed: true, watched_at: new Date().toISOString() };
  }
  await supabase
    .from("academy_enrollments")
    .upsert(
      { user_email: email, course_id: courseId, progress: next },
      { onConflict: "user_email,course_id" }
    );
  return next;
}

async function enrollApi(email, courseId) {
  try {
    await fetch("/api/academy/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, course_id: courseId }),
    });
  } catch {
    // ignore
  }
}

function QuizBlock({ quiz, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  if (!quiz?.questions?.length) return null;

  const score = quiz.questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
    0
  );

  return (
    <div className="mt-8 rounded-2xl bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-[#262626] mb-4">Quiz de validation</h3>
      <div className="space-y-6">
        {quiz.questions.map((q, i) => (
          <div key={i}>
            <div className="font-semibold text-sm text-[#262626] mb-3">
              {i + 1}. {q.q}
            </div>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const picked = answers[i] === oi;
                const correct = submitted && oi === q.answer;
                const wrong = submitted && picked && oi !== q.answer;
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => setAnswers({ ...answers, [i]: oi })}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                      correct
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                        : wrong
                        ? "bg-rose-50 border-rose-400 text-rose-900"
                        : picked
                        ? "bg-[#003725]/5 border-[#003725]"
                        : "bg-white border-gray-200 hover:border-[#003725]/50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!submitted ? (
        <button
          onClick={() => {
            setSubmitted(true);
            onComplete?.(score, quiz.questions.length);
          }}
          className="mt-6 bg-[#003725] hover:bg-[#00291c] text-white font-bold px-6 py-2.5 rounded-xl text-sm"
        >
          Valider mes reponses
        </button>
      ) : (
        <div className="mt-6 text-sm text-[#262626] font-semibold">
          Votre score : {score} / {quiz.questions.length}
        </div>
      )}
    </div>
  );
}

export const AcademyModulePage = ({ courseSlug, moduleSlug, onNavigate }) => {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [mod, setMod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [progress, setProgress] = useState({});
  const [enrolledEmail, setEnrolledEmail] = useState(() => getStoredAcademyEmail());
  const [gateOpen, setGateOpen] = useState(() => !getStoredAcademyEmail());

  // Reset scroll and update enrolled email on slug change
  const prevModuleSlugRef = React.useRef(moduleSlug);
  if (prevModuleSlugRef.current !== moduleSlug) {
    prevModuleSlugRef.current = moduleSlug;
    const email = getStoredAcademyEmail();
    setEnrolledEmail(email);
    if (!email) setGateOpen(true);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [moduleSlug]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase || !courseSlug) return;
      setLoading(true);
      const { data: courseData } = await supabase
        .from("academy_courses")
        .select("*")
        .eq("slug", courseSlug)
        .eq("is_published", true)
        .maybeSingle();
      if (!alive || !courseData) {
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
      const found = (modData || []).find((m) => m.slug === moduleSlug);
      setMod(found || null);

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
      trackEvent("Academy_Module_Viewed", { courseSlug, moduleSlug });
    })();
    return () => {
      alive = false;
    };
  }, [courseSlug, moduleSlug]);

  const { prev, next } = useMemo(() => {
    const idx = modules.findIndex((m) => m.slug === moduleSlug);
    return {
      prev: idx > 0 ? modules[idx - 1] : null,
      next: idx >= 0 && idx < modules.length - 1 ? modules[idx + 1] : null,
    };
  }, [modules, moduleSlug]);

  const handleComplete = async () => {
    if (!enrolledEmail || !course || !mod) return;
    const nextProgress = await upsertProgress(enrolledEmail, course.id, mod.slug, true);
    if (nextProgress) setProgress(nextProgress);
    trackEvent("Academy_Module_Completed", { courseSlug, moduleSlug });
  };

  const handleGateSubmit = async (email) => {
    setStoredAcademyEmail(email);
    setEnrolledEmail(email);
    if (course) {
      await enrollApi(email, course.id);
    }
    setGateOpen(false);
  };

  const { from, to } = resolveGradient(course?.cover_image);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F7F1]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />
        <div className="pt-40 text-center text-[#716D5C]">Chargement...</div>
      </div>
    );
  }

  if (!course || !mod) {
    return (
      <div className="min-h-screen bg-[#F9F7F1]">
        <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />
        <div className="pt-40 text-center">
          <h1 className="text-2xl font-bold mb-2">Module introuvable</h1>
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

  const isCompleted = !!progress?.[mod.slug]?.completed;
  const locked = !enrolledEmail;

  return (
    <div className="min-h-screen bg-[#F9F7F1] text-[#262626]">
      <SEO
        title={`${mod.title} - ${course.title} - Actero Academy`}
        description={mod.description || course.subtitle}
        canonical={`/academy/${course.slug}/${mod.slug}`}
        schemaData={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: mod.title,
          description: mod.description,
          isPartOf: {
            "@type": "Course",
            name: course.title,
            url: `https://actero.fr/academy/${course.slug}`,
          },
        }}
      />
      <Navbar onNavigate={onNavigate} trackEvent={trackEvent} />

      <section className="pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3">
            <button
              onClick={() => onNavigate(`/academy/${courseSlug}`)}
              className="inline-flex items-center gap-2 text-sm text-[#716D5C] hover:text-[#262626] font-semibold mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              {course.title}
            </button>

            {/* Video player */}
            <div
              className="relative aspect-video rounded-2xl overflow-hidden mb-6"
              style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
            >
              {mod.video_url ? (
                <iframe
                  src={mod.video_url}
                  title={mod.title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <PlayCircle className="w-20 h-20 text-white/90 mb-3" />
                  <div className="text-white/90 text-sm font-semibold">
                    Video bientot disponible
                  </div>
                </div>
              )}
              {locked && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <button
                    onClick={() => setGateOpen(true)}
                    className="bg-white text-[#003725] font-bold px-6 py-3 rounded-xl"
                  >
                    Debloquer le module
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-3xl font-bold text-[#262626] mb-3">{mod.title}</h1>
            {mod.description && (
              <p className="text-base text-[#716D5C] leading-relaxed mb-6">{mod.description}</p>
            )}

            {/* Transcript */}
            {mod.transcript && (
              <div className="mb-6 rounded-xl bg-white border border-gray-200">
                <button
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                >
                  Transcript
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${transcriptOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {transcriptOpen && (
                  <div className="px-4 pb-4 text-sm text-[#716D5C] whitespace-pre-line">
                    {mod.transcript}
                  </div>
                )}
              </div>
            )}

            {/* Resources */}
            {(mod.resources || []).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#716D5C] mb-3">
                  Ressources
                </h3>
                <div className="space-y-2">
                  {(mod.resources || []).map((r, i) => (
                    <a
                      key={i}
                      href={r.url || "#"}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-[#003725] transition-all"
                    >
                      <FileText className="w-4 h-4 text-[#003725]" />
                      <div className="flex-1 text-sm font-semibold text-[#262626]">{r.title}</div>
                      <Download className="w-4 h-4 text-[#716D5C]" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Quiz */}
            <QuizBlock quiz={mod.quiz} onComplete={() => handleComplete()} />

            {/* Mark as completed + navigation */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <button
                onClick={handleComplete}
                disabled={locked}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
                  isCompleted
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : "bg-[#003725] text-white hover:bg-[#00291c]"
                } disabled:opacity-60`}
              >
                {isCompleted ? (
                  <>
                    <Check className="w-4 h-4" />
                    Module termine
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Marquer comme termine
                  </>
                )}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => prev && onNavigate(`/academy/${courseSlug}/${prev.slug}`)}
                  disabled={!prev}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:border-[#003725]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Precedent
                </button>
                <button
                  onClick={() => next && onNavigate(`/academy/${courseSlug}/${next.slug}`)}
                  disabled={!next}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#262626] text-white text-sm font-semibold disabled:opacity-40 hover:bg-black"
                >
                  Suivant
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl bg-white border border-gray-200 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[#716D5C] mb-3">
                Modules du cours
              </div>
              <div className="space-y-1">
                {modules.map((m, i) => {
                  const active = m.slug === moduleSlug;
                  const done = progress?.[m.slug]?.completed;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onNavigate(`/academy/${courseSlug}/${m.slug}`)}
                      className={`w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg transition-colors ${
                        active ? "bg-[#003725]/10" : "hover:bg-[#F9F7F1]"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-[#003725] flex-shrink-0" />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            active ? "border-[#003725]" : "border-gray-300"
                          }`}
                        />
                      )}
                      <span
                        className={`text-xs font-medium truncate flex-1 ${
                          active ? "text-[#003725]" : "text-[#262626]"
                        }`}
                      >
                        {i + 1}. {m.title}
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
        courseTitle={course?.title}
      />
    </div>
  );
};

export default AcademyModulePage;
