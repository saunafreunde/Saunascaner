import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Subscribes to realtime changes on the operational tables and invalidates
// the matching React Query caches. Mount once near the app root.
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saunas' },
        () => qc.invalidateQueries({ queryKey: ['saunas'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infusions' },
        () => qc.invalidateQueries({ queryKey: ['infusions'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' },
        () => qc.invalidateQueries({ queryKey: ['tv-settings'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evacuation_events' },
        () => qc.invalidateQueries({ queryKey: ['evacuation'] }))
      .subscribe();
    return () => { supabase!.removeChannel(ch); };
  }, [qc]);
}
