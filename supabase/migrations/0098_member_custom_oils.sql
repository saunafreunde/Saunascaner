-- 0098_member_custom_oils.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Persönliche Öl-/Zutaten-Liste pro Aufgießer.
-- Use-Case: Räucherwerk-Mischungen, Eigenkreationen, Spezial-Öle die
-- nicht im offiziellen 59er-Regal stehen.
--
-- Verwaltung:
--   - Aufgießer legt eigene Einträge in seinem Profil an (Add/Delete)
--   - Im OilPicker sieht NUR der Aufgießer seine eigenen Öle zur Auswahl
--   - Sobald ein eigenes Öl in einem Aufguss verwendet wird, sehen es
--     ALLE (Tafel-Anzeige, Planner-Card etc.) — die Sichtbarkeits-
--     beschränkung gilt nur für die AUSWAHL, nicht für die Anzeige
--
-- ID-Schema in infusions.oils:
--   - Standard-Öle: 'blutorange', 'pfefferminze', ...
--   - Custom-Öle:   'custom:<uuid>'  (Präfix damit Frontend leicht trennt)
--
-- Max 15 eigene Öle pro Aufgießer (Trigger).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.member_custom_oils (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  emoji       text not null default '🌿' check (char_length(emoji) between 1 and 8),
  created_at  timestamptz not null default now()
);

create index if not exists member_custom_oils_member_idx
  on public.member_custom_oils(member_id);

-- Eindeutigkeit pro Aufgießer (nicht zwei eigene Öle mit gleichem Namen)
create unique index if not exists member_custom_oils_member_name_idx
  on public.member_custom_oils(member_id, lower(btrim(name)));

-- Trigger: max 15 eigene Öle pro Aufgießer
create or replace function public.check_max_custom_oils()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.member_custom_oils where member_id = new.member_id) >= 15 then
    raise exception 'max_custom_oils: Maximal 15 eigene Öle pro Aufgießer erlaubt';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_max_custom_oils on public.member_custom_oils;
create trigger trg_max_custom_oils
  before insert on public.member_custom_oils
  for each row execute function public.check_max_custom_oils();

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.member_custom_oils enable row level security;

-- SELECT: alle dürfen lesen (auch anon — damit die Tafel die in Aufgüssen
-- verwendeten Custom-Öle auflösen kann, ohne RLS-Tricks).
drop policy if exists "custom_oils_select_all" on public.member_custom_oils;
create policy "custom_oils_select_all" on public.member_custom_oils
  for select using (true);

-- INSERT: nur Aufgießer/Admins für SICH SELBST
drop policy if exists "custom_oils_insert_self" on public.member_custom_oils;
create policy "custom_oils_insert_self" on public.member_custom_oils
  for insert with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    and (public.is_aufgieser() or public.is_admin())
  );

-- DELETE: nur owner oder admin
drop policy if exists "custom_oils_delete_self" on public.member_custom_oils;
create policy "custom_oils_delete_self" on public.member_custom_oils
  for delete using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

grant select on public.member_custom_oils to anon, authenticated;
grant insert, delete on public.member_custom_oils to authenticated;
