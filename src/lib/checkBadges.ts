import { supabase } from './supabase';
import { MILESTONE_BADGES, SPECIAL_BADGES, type BadgeDefinition } from './badges';
import type { MemberStats } from './api';

function need() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  return supabase;
}

async function fetchStats(memberId: string): Promise<MemberStats> {
  const { data, error } = await need().rpc('get_member_stats', { p_member_id: memberId });
  if (error) throw error;
  return data as MemberStats;
}

async function awardIfNew(memberId: string, badgeId: string): Promise<boolean> {
  const { data, error } = await need().rpc('award_badge', {
    p_member_id: memberId,
    p_badge_id: badgeId,
    p_metadata: {},
  });
  if (error) return false;
  return data === true;
}

// Prüft alle automatisch vergebenen Badges und gibt neu freigeschaltete zurück.
// Wird nach createInfusion() oder joinTeamInfusion() aufgerufen.
export async function checkAndAwardBadges(memberId: string): Promise<BadgeDefinition[]> {
  let stats: MemberStats;
  try {
    stats = await fetchStats(memberId);
  } catch {
    return [];
  }

  const newBadges: BadgeDefinition[] = [];

  // ─── Aufguss-Meilensteine
  for (const badge of MILESTONE_BADGES) {
    if (!badge.threshold) continue;
    const count =
      badge.category === 'infusion' ? stats.total_infusions : stats.team_infusions;
    if (count >= badge.threshold) {
      const awarded = await awardIfNew(memberId, badge.id);
      if (awarded) newBadges.push(badge);
    }
  }

  // ─── Spezial-Badges
  let ratingCount = 0;
  try {
    const { data } = await need().rpc('count_member_ratings', { p_member_id: memberId });
    ratingCount = (data as number) ?? 0;
  } catch { /* ignore */ }

  const specialChecks: { badge: BadgeDefinition; condition: boolean }[] = [
    {
      badge: SPECIAL_BADGES.find((b) => b.id === 'early_bird')!,
      condition: stats.has_early_bird,
    },
    {
      badge: SPECIAL_BADGES.find((b) => b.id === 'night_owl')!,
      condition: stats.has_night_owl,
    },
    {
      badge: SPECIAL_BADGES.find((b) => b.id === 'allrounder')!,
      condition: stats.total_saunas > 0 && stats.saunas_used >= stats.total_saunas,
    },
    {
      badge: SPECIAL_BADGES.find((b) => b.id === 'marathon')!,
      condition: stats.max_per_day >= 3,
    },
    {
      badge: SPECIAL_BADGES.find((b) => b.id === 'feedback_giver')!,
      condition: ratingCount >= 10,
    },
  ];

  for (const { badge, condition } of specialChecks) {
    if (!badge) continue;
    if (condition) {
      const awarded = await awardIfNew(memberId, badge.id);
      if (awarded) newBadges.push(badge);
    }
  }

  return newBadges;
}
