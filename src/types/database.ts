// Placeholder — regenerate via:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
import type { InfusionAttribute } from '@/lib/attributes';

export type Sauna = {
  id: string;
  name: string;
  temperature_label: string;
  accent_color: string;          // hex, used as visual identity on TV + planner
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Infusion = {
  id: string;
  sauna_id: string;
  template_id: string | null;
  saunameister_id: string | null;
  title: string;
  description: string | null;
  attributes: InfusionAttribute[];
  oils: (string | null)[] | null;
  image_path: string | null;
  start_time: string;
  duration_minutes: number;
  end_time: string;
  team_infusion: boolean;
  is_personal_fallback: boolean;
  recurring_slot_id: string | null;
  temperature_c: number | null;
  created_at: string;
};

export type MemberRole = 'gast' | 'fan' | 'member' | 'guest_aufgieser' | 'staff' | 'admin';

export type StarStats = {
  total_aufguss: number;
  team_aufguss: number;
  avg_rating: number | null;
  rating_count: number;
  fan_count: number;
  badge_count: number;
  favorite_temp: string | null;
};

export type AufgieserStar = {
  id: string;
  name: string;
  avatar_path: string | null;
  motto: string | null;
  bio: string | null;
  aufgieser_story: string | null;
  signature_aufguss: string | null;
  specialties: string[];
  style_quote: string | null;
  star_accent_color: string | null;
  role: MemberRole;
  is_aufgieser: boolean;
  home_group: string | null;
  total_aufguss: number;
  fan_count: number;
  avg_rating: number | null;
};

export type FollowEntry = {
  followee_id: string;
  name: string;
  avatar_path: string | null;
  signature_aufguss: string | null;
  specialties: string[];
  is_aufgieser: boolean;
  notifications_enabled: boolean;
};

export type TopFan = {
  follower_id: string;
  name: string;
  avatar_path: string | null;
  followed_at: string;
};

export type Invitation = {
  id: string;
  code: string;
  target_role: MemberRole;
  target_is_aufgieser: boolean;
  target_is_personal_planer: boolean;
  note: string | null;
  expires_at: string | null;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  sent_to_email: string | null;
  sent_at: string | null;
  sent_by_member_id: string | null;
  sent_via: 'admin_account' | 'system_fallback' | null;
  created_at: string;
};

export type RecurringSlot = {
  id: string;
  member_id: string;
  weekday: number;        // 0=So, 1=Mo, ..., 6=Sa
  slot_hour: number;
  sauna_id: string;
  status: 'pending' | 'active' | 'revoked';
  active_from: string;
  note: string | null;
  template_id: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export type AufgieserAbsence = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
};

export type CoAufgieser = {
  id: string;
  infusion_id: string;
  member_id: string;
  joined_at: string;
};

export type InfusionTemplate = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  attributes: InfusionAttribute[];
  oils: (string | null)[] | null;
  image_path: string | null;
  created_at: string;
};

export type MemberCustomAttr = {
  id: string;
  member_id: string;
  emoji: string;
  color: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type TvSettings = {
  ads: { image_path: string; href?: string | null }[];
  background_path: string | null;
  logo_path: string | null;
};
