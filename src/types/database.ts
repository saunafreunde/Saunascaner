// Placeholder — regenerate via:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// Hand-written shapes mirror migration 0001_init.sql for Phase 1.

export type Sauna = {
  id: string;
  name: string;
  temperature_label: string;
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
  tags: string[];
  image_path: string | null;
  created_at: string;
};

export type TvSettings = {
  ads: { image_path: string; href?: string | null }[];
  background_path: string | null;
  logo_path: string | null;
};
