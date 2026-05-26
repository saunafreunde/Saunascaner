import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Subscribes to realtime changes on the operational tables and invalidates
// the matching React Query caches. Mount once near the app root.
//
// FIX 0107 (Audit Phase 9.A): vorher KEIN Subscription-State-Handler →
// stille Total-Disconnects nach Supabase-Tenant-Park/JWT-Refresh-Fail/WLAN-Drop.
// Jetzt: bei CHANNEL_ERROR/CLOSED/TIMED_OUT → Channel entfernen + nach 2s
// re-subscriben. Logged in Production damit man im Vercel-Log sieht ob ein
// Tafel-Browser Reconnect-Storm hat.
export function useRealtimeSync() {
  const qc = useQueryClient();
  const reconnectAttempts = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let currentChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = () => {
      if (cancelled || !supabase) return;
      const ch = supabase
        .channel(`app-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
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
      // TV-Bühne (Migration 0071): Admin steuert vom Handy, Tafel reagiert live
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_stage_state' },
        () => qc.invalidateQueries({ queryKey: ['tv-stage-state'] }))
      // Game-Hub (Migration 0073): Lobby + Active-List müssen aktuell sein
      // (einzelne Matches haben in /spiele/match/:id einen dedizierten Channel)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games_match' },
        () => {
          qc.invalidateQueries({ queryKey: ['games-active-mine'] });
          qc.invalidateQueries({ queryKey: ['games-open'] });
        })
      // Notification-Inbox (Migration 0077): live-updaten wenn neue
      // Notification reinkommt oder mark_read passiert
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_queue' },
        () => {
          qc.invalidateQueries({ queryKey: ['my-notifications'] });
          qc.invalidateQueries({ queryKey: ['my-notifications-unread'] });
        })
      // Feed-Kommentare (Migration 0078): pro post_id invalidieren
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_post_comments' },
        () => qc.invalidateQueries({ queryKey: ['feed-comments'] }))
      // DM-Hub-Liste (Migration 0079): einzelne Conversation hat eigenen
      // Channel in /dm/:id — hier nur Inbox + Bottom-Nav-Counter aktuell halten
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' },
        () => {
          qc.invalidateQueries({ queryKey: ['dm-conversations'] });
          qc.invalidateQueries({ queryKey: ['dm-unread'] });
        })
      // Shared-Email-Tickets (Migration 0080): Lock-Updates + Status-Wechsel
      // sollen live bei allen Admins ankommen, damit niemand doppelt bearbeitet
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_tickets' },
        () => {
          qc.invalidateQueries({ queryKey: ['account-tickets'] });
          qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') {
            reconnectAttempts.current = 0; // erfolgreich → Backoff resetten
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // eslint-disable-next-line no-console
            console.warn('[realtime] disconnected:', status, '· attempt', reconnectAttempts.current);
            if (currentChannel) {
              supabase!.removeChannel(currentChannel).catch(() => {});
              currentChannel = null;
            }
            // Exponential Backoff: 2s · 5s · 10s · 30s · max 60s
            const delays = [2000, 5000, 10000, 30000, 60000];
            const delay = delays[Math.min(reconnectAttempts.current, delays.length - 1)];
            reconnectAttempts.current += 1;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(subscribe, delay);
          }
        });
      currentChannel = ch;
    };

    subscribe();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (currentChannel) supabase!.removeChannel(currentChannel).catch(() => {});
    };
  }, [qc]);
}
