import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useLiveActivityFeed = () => {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    // Fetch initial 50 events
    const fetchInitial = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching events:", error);
      } else if (data) {
        setEvents(data);
      }
      setIsLoading(false);
    };

    fetchInitial();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('live-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_events',
        },
        (payload) => {
          setEvents((prev) => [payload.new, ...prev].slice(0, 100));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { events, isConnected, isLoading };
};
