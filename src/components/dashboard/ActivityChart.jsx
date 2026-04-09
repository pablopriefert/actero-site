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

export const ActivityChart = ({ theme = "dark", supabase, selectedPeriod = "this_month", mini = false }) => {
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
      <div className={`h-full rounded-2xl border p-6 animate-pulse ${isLight ? "bg-white border-gray-200" : "bg-[#F9F7F1] border-gray-200"}`}>
        <div className="h-6 w-1/3 bg-gray-50 mb-4 rounded" />
        <div className="flex-1 bg-gray-50 rounded-xl" />
      </div>
    );
  }

  // When used as mini widget inside overview, render compact version
  if (mini) {
    return (
      <div className="w-full h-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-[#999]">Aucune activite.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#aaa" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#aaa" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ fontSize: '10px', padding: '1px 0' }}
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              />
              <Bar dataKey="ticket_resolved" stackId="a" name="Resolus" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ticket_escalated" stackId="a" name="Escalades" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_email_sent" stackId="a" name="Emails" fill="#3B82F6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_recovered" stackId="a" name="Paniers" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-6 shadow-sm flex flex-col transition-colors duration-300 ${isLight ? "bg-white border-gray-200" : "bg-[#F9F7F1] border-gray-200"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] flex items-center gap-2">
          Graphique d'activite <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        </h3>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-[#ccc] mb-2" />
          <p className="text-sm text-[#999]">Aucune activite pour le moment.</p>
        </div>
      ) : (
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px', fontSize: '12px' }}
                itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '12px' }} />
              <Bar dataKey="ticket_resolved" stackId="a" name="Resolus" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ticket_escalated" stackId="a" name="Escalades" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_email_sent" stackId="a" name="Emails" fill="#3B82F6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cart_recovered" stackId="a" name="Paniers" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
