-- Saunafreunde Schwarzwald — initial schema (consolidated)
-- Applied to project tbjptybrtsmqyqmbiley on 2026-05-07.
-- Re-run safely on a fresh DB. For an existing DB, drop tables first.

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "citext";

-- ─── Tables ───────────────────────────────────────────────────────────────
create table public.saunas (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  temperature_label text not null,
  accent_color      text not null default '#22c55e',
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         citext unique,
  name          text not null,
  member_code   uuid not null unique default gen_random_uuid(),
  role          text not null default 'saunameister'
                check (role in ('saunameister','manager','super_admin','guest_staff')),
  is_present    boolean not null default false,
  last_scan_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index members_present_idx on public.members(is_present) where is_present;

create table public.infusion_templates (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid references public.members(id) on delete cascade,
  title            text not null,
  description      text,
  duration_minutes int not null default 15 check (duration_minutes between 1 and 120),
  attributes       text[] not null default '{}',
  image_path       text,
  created_at       timestamptz not null default now()
);
create index infusion_templates_member_idx on public.infusion_templates(member_id);

create table public.infusions (
  id               uuid primary key default gen_random_uuid(),
  sauna_id         uuid not null references public.saunas(id) on delete cascade,
  template_id      uuid references public.infusion_templates(id) on delete set null,
  saunameister_id  uuid references public.members(id) on delete set null,
  title            text not null,
  description      text,
  attributes       text[] not null default '{}',
  image_path       text,
  start_time       timestamptz not null,
  duration_minutes int not null default 15 check (duration_minutes between 1 and 120),
  end_time         timestamptz not null,
  created_at       timestamptz not null default now()
);
create index infusions_end_idx on public.infusions(end_time);
create index infusions_sauna_start_idx on public.infusions(sauna_id, start_time);

create or replace function public.set_infusion_end_time() returns trigger
language plpgsql as $$
begin
  new.end_time := new.start_time + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;
create trigger infusions_set_end_time
  before insert or update of start_time, duration_minutes on public.infusions
  for each row execute function public.set_infusion_end_time();

create table public.system_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

create table public.presence_audit (
  id          bigserial primary key,
  reset_at    timestamptz not null default now(),
  reset_count int not null,
  member_ids  uuid[] not null
);

create table public.evacuation_events (
  id              uuid primary key default gen_random_uuid(),
  triggered_by    uuid references public.members(id) on delete set null,
  triggered_at    timestamptz not null default now(),
  ended_at        timestamptz,
  present_count   int not null default 0,
  present_names   text[] not null default '{}',
  telegram_status text
);

-- ─── Helpers ──────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger saunas_touch        before update on public.saunas        for each row execute function public.touch_updated_at();
create trigger system_config_touch before update on public.system_config for each row execute function public.touch_updated_at();

create or replace function public.current_member()
returns public.members
language sql stable security definer set search_path = public, auth as $$
  select * from public.members where auth_user_id = auth.uid() limit 1;
$$;
grant execute on function public.current_member() to anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role in ('super_admin','manager') from public.members where auth_user_id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'super_admin' from public.members where auth_user_id = auth.uid()),
    false
  );
$$;

-- ─── Auth bridge: every new auth.users gets a member shell ────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.members (auth_user_id, email, name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'saunameister')
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.saunas             enable row level security;
alter table public.members            enable row level security;
alter table public.infusion_templates enable row level security;
alter table public.infusions          enable row level security;
alter table public.system_config      enable row level security;
alter table public.presence_audit     enable row level security;
alter table public.evacuation_events  enable row level security;

create policy saunas_read_public    on public.saunas             for select using (true);
create policy infusions_read_public on public.infusions          for select using (true);
create policy templates_read_public on public.infusion_templates for select using (member_id is null);
create policy config_read_public    on public.system_config      for select using (key = 'tv_settings');

create policy templates_read_own on public.infusion_templates
  for select to authenticated
  using (member_id is null or member_id = (select id from public.current_member()));
create policy templates_write_own on public.infusion_templates
  for all to authenticated
  using (member_id = (select id from public.current_member()) or public.is_admin())
  with check (member_id = (select id from public.current_member()) or public.is_admin());

create policy members_read_self on public.members
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
create policy members_write_admin on public.members
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy saunas_write_admin    on public.saunas    for all to authenticated using (public.is_admin())       with check (public.is_admin());
create policy infusions_write_admin on public.infusions for all to authenticated using (public.is_admin())       with check (public.is_admin());
create policy config_write_admin    on public.system_config for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy audit_read_admin      on public.presence_audit for select to authenticated using (public.is_admin());

create policy evac_read_public  on public.evacuation_events for select using (true);
create policy evac_insert_member on public.evacuation_events
  for insert to authenticated with check ((select id from public.current_member()) is not null);
create policy evac_update_member on public.evacuation_events
  for update to authenticated
  using ((select id from public.current_member()) is not null)
  with check ((select id from public.current_member()) is not null);

-- ─── RPCs ─────────────────────────────────────────────────────────────────
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

create or replace function public.bootstrap_super_admin(p_name text)
returns public.members
language plpgsql security definer set search_path = public, auth as $$
declare
  m public.members%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.members where role = 'super_admin') then
    raise exception 'super_admin_exists';
  end if;
  select email into uemail from auth.users where id = uid;
  insert into public.members (auth_user_id, email, name, role)
    values (uid, uemail, coalesce(nullif(p_name,''), uemail), 'super_admin')
    on conflict (auth_user_id) do update set role = 'super_admin'
    returning * into m;
  return m;
end;
$$;
grant execute on function public.bootstrap_super_admin(text) to authenticated;

create or replace view public.present_members as
  select id, name, last_scan_at
    from public.members
   where is_present and revoked_at is null
   order by name;

-- ─── Realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.saunas;
alter publication supabase_realtime add table public.infusions;
alter publication supabase_realtime add table public.system_config;
alter publication supabase_realtime add table public.evacuation_events;

-- ─── Storage ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('assets', 'assets', true)
  on conflict (id) do nothing;

create policy "assets read public"  on storage.objects for select using (bucket_id = 'assets');
create policy "assets write admin"  on storage.objects for insert
  with check (bucket_id = 'assets' and public.is_admin());
create policy "assets update admin" on storage.objects for update
  using (bucket_id = 'assets' and public.is_admin());
create policy "assets delete admin" on storage.objects for delete
  using (bucket_id = 'assets' and public.is_admin());

-- ─── Cron: nightly presence reset ─────────────────────────────────────────
create or replace function public.reset_presence_nightly() returns void
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into ids from public.members where is_present;
  if array_length(ids, 1) is not null then
    insert into public.presence_audit (reset_count, member_ids)
      values (array_length(ids, 1), ids);
    update public.members set is_present = false where is_present;
  end if;
end;
$$;

select cron.schedule('reset-presence-nightly', '0 2 * * *',
  $$ select public.reset_presence_nightly(); $$);

-- ─── Seeds ────────────────────────────────────────────────────────────────
insert into public.saunas (name, temperature_label, accent_color, sort_order, is_active) values
  ('Kelo',             '80°C',  '#fbbf24', 1, true),
  ('Finnische Sauna',  '90°C',  '#34d399', 2, false),
  ('Blockhaus',        '100°C', '#ef4444', 3, true);

insert into public.system_config (key, value) values
  ('tv_settings', '{"ads": [], "background_path": null, "logo_path": null}'::jsonb)
  on conflict (key) do nothing;
