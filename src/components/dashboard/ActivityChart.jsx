import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Activity } from 'lucide-react'

export const ActivityChart = ({ theme = "dark", supabase, selectedPeriod = "this_month" }) => {
  const isLight = theme === "light";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["client-activity-events", selectedPeriod],
    queryFn: async () => {
      if (!supabase) return [];
      const now = new Date();
      let start, end;

      if (selectedPeriod === "this_month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (selectedPeriod === "last_month") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else { // Default to last 30 days
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = now;
      }

      const { data, error } = await supabase
        .from('automation_events')
        .select('created_at, event_category')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
    refetchInterval: 60000,
    staleTime: 30000, // UX: cache results for 30s
  });

  const chartData = useMemo(() => {
    if (!events.length) return [];

    // Group by date
    const groups = events.reduce((acc, event) => {
      const date = new Date(event.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if (!acc[date]) {
        acc[date] = { date, ticket_resolved: 0, ticket_escalated: 0, cart_email_sent: 0, cart_recovered: 0 };
      }
      if (acc[date][event.event_category] !== undefined) {
        acc[date][event.event_category]++;
      }
      return acc;
    }, {});

    return Object.values(groups);
  }, [events]);

  if (isLoading) {
    return (
      <div className={`h-full rounded-2xl border p-6 animate-pulse ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
        <div className="h-6 w-1/3 bg-white/5 mb-4 rounded" />
        <div className="flex-1 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-6 shadow-sm flex flex-col h-full transition-colors duration-300 ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
          Graphique d'activité <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        </h3>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-gray-400 mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Aucune activité pour le moment.</p>
        </div>
      ) : (
        <div className="flex-1 w-full min-h-[250px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isLight ? "#94a3b8" : "#6b7280" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isLight ? "#94a3b8" : "#6b7280" }} />
              <Tooltip
                contentStyle={{ backgroundColor: isLight ? '#fff' : '#0a0a0a', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                cursor={{ fill: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }} />
              <Bar dataKey="ticket_resolved" stackId="a" name="Résolus" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ticket_escalated" stackId="a" name="Escaladés" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_email_sent" stackId="a" name="Emails" fill="#3B82F6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_recovered" stackId="a" name="Paniers" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
