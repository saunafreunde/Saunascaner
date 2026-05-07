-- Saunafreunde Schwarzwald — initial schema
-- Run in Supabase SQL editor (or via supabase CLI: supabase db push)

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ─────────────────────────────────────────────────────────────────────────────
-- Roles helper: read app_metadata.role from auth.users
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select raw_app_meta_data->>'role' from auth.users where id = auth.uid()),
    case when auth.uid() is null then 'anon' else 'authenticated' end
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_role_name() in ('super_admin', 'manager');
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$
  select public.current_role_name() = 'super_admin';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.saunas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  temperature_label text not null,           -- "80°C", "90°C", "100°C"
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  member_code   uuid not null unique default gen_random_uuid(),  -- QR payload, regenerable
  role          text not null default 'saunameister',
  is_present    boolean not null default false,
  last_scan_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index members_present_idx on public.members(is_present) where is_present;

create table public.infusion_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  tags        text[] not null default '{}',
  image_path  text,                          -- storage path in 'assets' bucket
  created_at  timestamptz not null default now()
);

create table public.infusions (
  id              uuid primary key default gen_random_uuid(),
  sauna_id        uuid not null references public.saunas(id) on delete cascade,
  template_id     uuid references public.infusion_templates(id) on delete set null,
  saunameister_id uuid references public.members(id) on delete set null,
  title           text not null,             -- denormalized snapshot
  description     text,
  image_path      text,
  start_time      timestamptz not null,
  duration_minutes int not null default 15 check (duration_minutes between 1 and 120),
  end_time        timestamptz generated always as (start_time + (duration_minutes || ' minutes')::interval) stored,
  created_at      timestamptz not null default now()
);

create index infusions_end_idx on public.infusions(end_time);
create index infusions_sauna_start_idx on public.infusions(sauna_id, start_time);

-- Key/value config — one row per logical setting, avoids JSONB last-write-wins races
create table public.system_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

-- Audit log for nightly presence reset
create table public.presence_audit (
  id          bigserial primary key,
  reset_at    timestamptz not null default now(),
  reset_count int not null,
  member_ids  uuid[] not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger saunas_touch before update on public.saunas
  for each row execute function public.touch_updated_at();
create trigger system_config_touch before update on public.system_config
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.saunas             enable row level security;
alter table public.members            enable row level security;
alter table public.infusion_templates enable row level security;
alter table public.infusions          enable row level security;
alter table public.system_config      enable row level security;
alter table public.presence_audit     enable row level security;

-- Public read for what the TV/guest app needs
create policy saunas_read_public on public.saunas
  for select using (true);
create policy infusions_read_public on public.infusions
  for select using (true);
create policy templates_read_public on public.infusion_templates
  for select using (true);
create policy config_read_public on public.system_config
  for select using (key in ('tv_settings', 'weather_cache'));

-- Admin write
create policy saunas_write_admin on public.saunas
  for all using (public.is_admin()) with check (public.is_admin());
create policy infusions_write_admin on public.infusions
  for all using (public.is_admin()) with check (public.is_admin());
create policy templates_write_admin on public.infusion_templates
  for all using (public.is_admin()) with check (public.is_admin());
create policy config_write_admin on public.system_config
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Members: only super_admin sees full table
create policy members_admin_all on public.members
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit: admin read only, no client writes
create policy audit_read_admin on public.presence_audit
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Public RPC: scanner toggles presence without exposing members table
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.toggle_presence(p_member_code uuid)
returns table (member_id uuid, name text, is_present boolean)
language plpgsql security definer set search_path = public as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members
   where member_code = p_member_code and revoked_at is null
   for update;
  if not found then
    raise exception 'unknown_or_revoked' using errcode = 'P0002';
  end if;

  update public.members
     set is_present = not m.is_present,
         last_scan_at = now()
   where id = m.id
   returning id, public.members.name, public.members.is_present
     into member_id, name, is_present;

  return next;
end;
$$;

revoke all on function public.toggle_presence(uuid) from public;
grant execute on function public.toggle_presence(uuid) to anon, authenticated;

-- Evacuation list view — admin only via RLS on members
create or replace view public.present_members as
  select id, name, last_scan_at
    from public.members
   where is_present and revoked_at is null
   order by name;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: publish tables the TV/guest app subscribes to
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.saunas;
alter publication supabase_realtime add table public.infusions;
alter publication supabase_realtime add table public.system_config;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for assets (ads, backgrounds, logos, template images)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('assets', 'assets', true)
  on conflict (id) do nothing;

create policy "assets read public" on storage.objects
  for select using (bucket_id = 'assets');
create policy "assets write admin" on storage.objects
  for insert with check (bucket_id = 'assets' and public.is_admin());
create policy "assets update admin" on storage.objects
  for update using (bucket_id = 'assets' and public.is_admin());
create policy "assets delete admin" on storage.objects
  for delete using (bucket_id = 'assets' and public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Nightly presence reset with audit log
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reset_presence_nightly() returns void
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into ids
    from public.members where is_present;

  if array_length(ids, 1) is not null then
    insert into public.presence_audit (reset_count, member_ids)
      values (array_length(ids, 1), ids);
    update public.members set is_present = false where is_present;
  end if;
end;
$$;

select cron.schedule(
  'reset-presence-nightly',
  '0 2 * * *',
  $$ select public.reset_presence_nightly(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed defaults
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.saunas (name, temperature_label, sort_order, is_active) values
  ('Finnische Sauna', '80°C',  1, true),
  ('Bio-Sauna',       '90°C',  2, false),
  ('Event-Sauna',     '100°C', 3, true);

insert into public.system_config (key, value) values
  ('tv_settings', '{"ads": [], "background_path": null, "logo_path": null}'::jsonb)
  on conflict (key) do nothing;
