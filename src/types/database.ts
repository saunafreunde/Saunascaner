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

export type RecurringSlot = {
  id: string;
  member_id: string;
  weekday: number;        // 0=So, 1=Mo, ..., 6=Sa
  slot_hour: number;
  sauna_id: string;
  status: 'pending' | 'active' | 'revoked';
  active_from: string;
  note: string | null;
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
