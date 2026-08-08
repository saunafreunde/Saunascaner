-- 0124_sud.sql — angewendet am 08.08.2026 auf Projekt tbjptybrtsmqyqmbiley.
-- ─────────────────────────────────────────────────────────────────────────
-- Sudaufguss: gemeinsamer Kräuter-Pool + daraus gemischte Süde.
--
-- Bewusst GEMEINSAM statt pro Aufgießer (anders als member_custom_attrs):
-- ein Kräutervorrat steht im Regal und gehört dem Verein, nicht einer Person.
-- Jeder Aufgießer darf ergänzen, jeder darf alles verwenden.
--
-- Im Aufguss selbst wird NICHTS Neues gespeichert: die Auswahl landet als
-- 'sud:<uuid>' bzw. 'sudmix:<uuid>' in infusions.attributes[] — dieselbe
-- Konvention wie 'schnaps:<slug>' und 'custom:<uuid>'. Grund siehe
-- src/lib/schnaps.ts: der Schreibpfad läuft über fünf SECURITY-DEFINER-RPCs,
-- ein zusätzlicher Parameter würde bei CREATE OR REPLACE eine zweite
-- Überladung anlegen statt die alte zu ersetzen.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.sud_kraeuter (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text not null default '🌿',
  color      text not null default '#84cc16',
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists sud_kraeuter_name_uniq
  on public.sud_kraeuter (lower(btrim(name)));

create table if not exists public.sud_mixe (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text not null default '🧪',
  color      text not null default '#a16207',
  kraeuter   uuid[] not null,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sud_mixe_min_zwei check (coalesce(array_length(kraeuter, 1), 0) >= 2)
);

create unique index if not exists sud_mixe_name_uniq
  on public.sud_mixe (lower(btrim(name)));

alter table public.sud_kraeuter enable row level security;
alter table public.sud_mixe     enable row level security;

-- Lesen: ALLE, auch anonym — die TV-Tafel läuft ohne Login und muss die Namen
-- zu den 'sud:<uuid>'-Einträgen auflösen. Ohne expliziten GRANT an anon nützt
-- die Policy nichts, die Rolle käme nicht bis zur Zeilenprüfung.
drop policy if exists sud_kraeuter_select_all on public.sud_kraeuter;
create policy sud_kraeuter_select_all on public.sud_kraeuter for select using (true);
drop policy if exists sud_mixe_select_all on public.sud_mixe;
create policy sud_mixe_select_all on public.sud_mixe for select using (true);

drop policy if exists sud_kraeuter_insert on public.sud_kraeuter;
create policy sud_kraeuter_insert on public.sud_kraeuter for insert
  with check (public.is_aufgieser());
drop policy if exists sud_mixe_insert on public.sud_mixe;
create policy sud_mixe_insert on public.sud_mixe for insert
  with check (public.is_aufgieser());

-- Ändern/Löschen nur Urheber oder Admin: sonst könnte jemand das Kraut eines
-- anderen löschen, während es in dessen geplantem Aufguss steckt.
drop policy if exists sud_kraeuter_update on public.sud_kraeuter;
create policy sud_kraeuter_update on public.sud_kraeuter for update
  using (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin())
  with check (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin());
drop policy if exists sud_kraeuter_delete on public.sud_kraeuter;
create policy sud_kraeuter_delete on public.sud_kraeuter for delete
  using (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin());

drop policy if exists sud_mixe_update on public.sud_mixe;
create policy sud_mixe_update on public.sud_mixe for update
  using (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin())
  with check (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin());
drop policy if exists sud_mixe_delete on public.sud_mixe;
create policy sud_mixe_delete on public.sud_mixe for delete
  using (created_by = (select id from public.members where auth_user_id = auth.uid()) or public.is_admin());

grant select on public.sud_kraeuter to anon, authenticated;
grant select on public.sud_mixe     to anon, authenticated;
grant insert, update, delete on public.sud_kraeuter to authenticated;
grant insert, update, delete on public.sud_mixe     to authenticated;
