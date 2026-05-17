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
      // members: is_present-Toggle (Self-Check-in, Scanner-Check-in) muss live
      // bei allen anderen Geräten ankommen — sonst sieht der User sich nicht
      // in der Anwesenheitsliste obwohl er auf dem Handy eingecheckt ist.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' },
        () => {
          qc.invalidateQueries({ queryKey: ['present'] });
          qc.invalidateQueries({ queryKey: ['members'] });
          qc.invalidateQueries({ queryKey: ['current-member'] });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' },
        () => qc.invalidateQueries({ queryKey: ['tv-settings'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evacuation_events' },
        () => qc.invalidateQueries({ queryKey: ['evacuation'] }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'member_achievements' },
        () => {
          qc.invalidateQueries({ queryKey: ['achievements'] });
          qc.invalidateQueries({ queryKey: ['member-stats-full'] });
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'infusion_attendances' },
        () => qc.invalidateQueries({ queryKey: ['member-stats-full'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufgieser_comments' },
        () => qc.invalidateQueries({ queryKey: ['aufgieser-comments'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufgieser_comment_likes' },
        () => qc.invalidateQueries({ queryKey: ['aufgieser-comments'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufgieser_photos' },
        () => qc.invalidateQueries({ queryKey: ['aufgieser-photos'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infusion_reactions' },
        () => qc.invalidateQueries({ queryKey: ['infusion-reactions'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infusion_announcements' },
        () => qc.invalidateQueries({ queryKey: ['infusion-announcements'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufguss_wishes' },
        () => qc.invalidateQueries({ queryKey: ['aufguss-wishes'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufguss_wish_likes' },
        () => qc.invalidateQueries({ queryKey: ['aufguss-wishes'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tasks' },
        () => qc.invalidateQueries({ queryKey: ['support-tasks'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_task_helpers' },
        () => {
          qc.invalidateQueries({ queryKey: ['support-tasks'] });
          qc.invalidateQueries({ queryKey: ['support-task-helpers'] });
        })
      .subscribe();
    return () => { supabase!.removeChannel(ch); };
  }, [qc]);
}
