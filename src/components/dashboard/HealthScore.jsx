import React, { useMemo } from 'react'

/**
 * Calculates a health score from 0 to 100 based on recent metrics and events.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function calculateHealthScore(metricsData = [], eventsData = []) {
  if (!metricsData.length) return { total: 100, components: { uptime: 100, performance: 100, reliability: 100 } };

  // 1. Reliability (based on errors/escalations in events)
  const totalEvents = eventsData.length || 1;
  const escalations = eventsData.filter(e => e.event_category === 'ticket_escalated').length;
  const reliability = Math.max(0, 100 - (escalations / totalEvents) * 500); // Heavy penalty for escalations

  // 2. Performance (based on tasks executed trend)
  const recentTasks = metricsData.slice(-3).reduce((sum, d) => sum + (d.tasks_executed || 0), 0);
  const avgTasks = metricsData.reduce((sum, d) => sum + (d.tasks_executed || 0), 0) / metricsData.length;
  const performance = Math.min(100, Math.max(70, (recentTasks / (avgTasks * 3 || 1)) * 100));

  // 3. Uptime (simplified: 100% if we have metrics recently)
  const uptime = 99.9;

  const total = Math.round((reliability * 0.4) + (performance * 0.4) + (uptime * 0.2));

  return {
    total,
    components: { reliability, performance, uptime }
  };
}

export function HealthScoreIndicator({ metricsData, eventsData, theme = "dark" }) {
  const { total: score } = useMemo(() => calculateHealthScore(metricsData, eventsData), [metricsData, eventsData]);
  const isLight = theme === "light";

  const getStatusColor = (s) => {
    if (s >= 90) return "text-emerald-500";
    if (s >= 70) return "text-amber-500";
    return "text-rose-500";
  };

  // eslint-disable-next-line no-unused-vars
  const getStatusBg = (s) => {
    if (s >= 90) return "bg-emerald-500/10";
    if (s >= 70) return "bg-amber-500/10";
    return "bg-rose-500/10";
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
      <div className={`w-2 h-2 rounded-full animate-pulse ${score >= 70 ? "bg-emerald-500" : "bg-rose-500"}`}></div>
      <span className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
        Système: <span className={getStatusColor(score)}>{score}%</span>
      </span>
    </div>
  );
}

export function HealthScoreWidget({ metricsData, eventsData, theme = "dark" }) {
  const { total: score, components } = useMemo(() => calculateHealthScore(metricsData, eventsData), [metricsData, eventsData]);
  const isLight = theme === "light";

  return (
    <div className={`p-6 rounded-2xl border transition-all ${isLight ? "bg-white border-slate-200" : "bg-[#0E1424] border-white/10"}`}>
      <h3 className={`text-sm font-bold uppercase tracking-widest mb-6 ${isLight ? "text-slate-500" : "text-gray-400"}`}>
        Santé de l'infrastructure
      </h3>
      <div className="flex items-center gap-8">
        <div className="relative w-32 h-32 flex items-center justify-center">
           <svg className="w-full h-full transform -rotate-90">
             <circle
               cx="64" cy="64" r="58"
               stroke="currentColor" strokeWidth="8" fill="transparent"
               className={isLight ? "text-slate-100" : "text-white/5"}
             />
             <circle
               cx="64" cy="64" r="58"
               stroke="currentColor" strokeWidth="8" fill="transparent"
               strokeDasharray={364.4}
               strokeDashoffset={364.4 - (364.4 * score) / 100}
               strokeLinecap="round"
               className={score >= 90 ? "text-emerald-500" : score >= 70 ? "text-amber-500" : "text-rose-500"}
             />
           </svg>
           <span className={`absolute text-2xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
             {score}%
           </span>
        </div>
        <div className="flex-1 space-y-4">
          {Object.entries(components).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-tighter">
                <span className={isLight ? "text-slate-500" : "text-gray-500"}>{key}</span>
                <span className={isLight ? "text-slate-900" : "text-white"}>{Math.round(val)}%</span>
              </div>
              <div className={`h-1.5 w-full rounded-full ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${val >= 90 ? "bg-emerald-500" : val >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
