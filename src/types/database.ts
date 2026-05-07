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
  image_path: string | null;
  start_time: string;
  duration_minutes: number;
  end_time: string;
  created_at: string;
};

export type InfusionTemplate = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  attributes: InfusionAttribute[];
  image_path: string | null;
  created_at: string;
};

export type TvSettings = {
  ads: { image_path: string; href?: string | null }[];
  background_path: string | null;
  logo_path: string | null;
};
