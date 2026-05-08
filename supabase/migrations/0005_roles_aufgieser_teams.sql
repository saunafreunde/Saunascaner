-- ─── Migration 0005: Rollenbereinigung + Aufgieser + Team-Aufgüsse + Entry-Code ───
-- Rollen: 'saunameister'|'manager'|'super_admin'|'guest_staff' → 'member'|'admin'
-- Neues Flag: members.is_aufgieser (unabhängig von Admin-Rolle)
-- Neues Feld: members.entry_code (persönlicher Einlass-Code für Scanner-Tablet)
-- Team-Aufgüsse: infusions.team_infusion + Tabelle infusion_co_aufgieser
-- RLS-Fix: Aufgieser dürfen eigene Aufgüsse anlegen/bearbeiten

-- ─── 1. Neue Spalten auf members ──────────────────────────────────────────
alter table public.members
  add column if not exists is_aufgieser boolean not null default false,
  add column if not exists entry_code   text;

create unique index if not exists members_entry_code_idx
  on public.members (entry_code) where entry_code is not null;

-- ─── 2. CHECK-Constraint zuerst droppen (sonst schlägt Daten-Migration fehl) ──
alter table public.members drop constraint if exists members_role_check;

-- ─── 3. Daten-Migration: alte Rollen → neue Rollen ────────────────────────
-- Saunameister werden Mitglieder mit Aufgieser-Flag
update public.members set is_aufgieser = true where role = 'saunameister';
update public.members set role = 'member'        where role = 'saunameister';

-- Manager & Super-Admin → Admin (auto-approved)
update public.members set role = 'admin', approved = true where role in ('manager', 'super_admin');

-- Sonstige → Mitglied
update public.members set role = 'member' where role = 'guest_staff';

-- ─── 4. Neuen CHECK-Constraint setzen ─────────────────────────────────────
alter table public.members
  add constraint members_role_check check (role in ('member', 'admin'));

-- ─── 5. Hilfsfunktionen aktualisieren ─────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'admin' from public.members where auth_user_id = auth.uid()),
    false
  );
$$;

-- is_super_admin bleibt als Alias damit bestehende Policies nicht brechen
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.is_admin();
$$;

create or replace function public.is_aufgieser() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select is_aufgieser from public.members where auth_user_id = auth.uid()),
    false
  );
$$;

-- ─── 5. Auth-Trigger: neue User als 'member' anlegen ──────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'member', false)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── 6. bootstrap_super_admin: 'admin' statt 'super_admin' ───────────────
create or replace function public.bootstrap_super_admin(p_name text)
returns public.members
language plpgsql security definer set search_path = public, auth as $$
declare
  m public.members%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.members where role = 'admin') then
    raise exception 'super_admin_exists';
  end if;
  select email into uemail from auth.users where id = uid;
  insert into public.members (auth_user_id, email, name, role, approved)
    values (uid, uemail, coalesce(nullif(p_name,''), uemail), 'admin', true)
    on conflict (auth_user_id) do update set role = 'admin', approved = true
    returning * into m;
  return m;
end;
$$;
grant execute on function public.bootstrap_super_admin(text) to authenticated;

-- ─── 7. approve_member: neue Rollen + is_aufgieser + Admin-Check ──────────
create or replace function public.approve_member(
  p_member_id   uuid,
  p_role        text    default 'member',
  p_is_aufgieser boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  -- Robustheit: unbekannte Rolle → member
  if p_role not in ('member', 'admin') then
    p_role := 'member';
  end if;
  update public.members
     set approved      = true,
         role          = p_role,
         is_aufgieser  = p_is_aufgieser
   where id = p_member_id;
end;
$$;
revoke all on function public.approve_member(uuid, text, boolean) from public;
grant execute on function public.approve_member(uuid, text, boolean) to authenticated;

-- ─── 8. list_meister_names: is_aufgieser statt Rolle ─────────────────────
create or replace function public.list_meister_names()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name
    from public.members
   where is_aufgieser = true and revoked_at is null
   order by name;
$$;
revoke all on function public.list_meister_names() from public;
grant execute on function public.list_meister_names() to anon, authenticated;

-- ─── 9. RLS-Fix: Aufgieser dürfen eigene Aufgüsse anlegen ────────────────
drop policy if exists infusions_write_admin on public.infusions;

create policy infusions_write_saunameister on public.infusions
  for all to authenticated
  using (
    public.is_admin()
    or (public.is_aufgieser() and saunameister_id = (
      select id from public.members where auth_user_id = auth.uid()
    ))
  )
  with check (
    public.is_admin()
    or (public.is_aufgieser() and saunameister_id = (
      select id from public.members where auth_user_id = auth.uid()
    ))
  );

-- ─── 10. Team-Aufguss-Flag auf infusions ──────────────────────────────────
alter table public.infusions
  add column if not exists team_infusion boolean not null default false;

-- ─── 11. Tabelle infusion_co_aufgieser ────────────────────────────────────
create table if not exists public.infusion_co_aufgieser (
  id          uuid primary key default gen_random_uuid(),
  infusion_id uuid not null references public.infusions(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (infusion_id, member_id)
);
alter table public.infusion_co_aufgieser enable row level security;

create policy co_aufgieser_read on public.infusion_co_aufgieser
  for select using (true);

create policy co_aufgieser_self_write on public.infusion_co_aufgieser
  for all to authenticated
  using (
    public.is_aufgieser()
    and member_id = (select id from public.members where auth_user_id = auth.uid())
  )
  with check (
    public.is_aufgieser()
    and member_id = (select id from public.members where auth_user_id = auth.uid())
  );

create policy co_aufgieser_admin on public.infusion_co_aufgieser
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Realtime für Co-Aufgieser-Beitritte
alter publication supabase_realtime add table public.infusion_co_aufgieser;

-- ─── 12. RPC: toggle_presence_by_entry_code ───────────────────────────────
create or replace function public.toggle_presence_by_entry_code(p_code text)
returns table (member_id uuid, name text, is_present boolean)
language plpgsql security definer set search_path = public as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members
   where entry_code = p_code and revoked_at is null
   for update;
  if not found then
    raise exception 'unknown_or_revoked' using errcode = 'P0002';
  end if;
  update public.members
     set is_present   = not m.is_present,
         last_scan_at = now()
   where id = m.id
   returning id, public.members.name, public.members.is_present
     into member_id, name, is_present;
  return next;
end;
$$;
revoke all on function public.toggle_presence_by_entry_code(text) from public;
grant execute on function public.toggle_presence_by_entry_code(text) to anon, authenticated;

-- ─── 13. Mitglieder-Lese-Policy: alle angemeldeten Mitglieder können ──────
--         sich gegenseitig sehen (für Anwesenheitsliste in Me.tsx)
drop policy if exists members_read_self on public.members;
create policy members_read_self on public.members
  for select to authenticated
  using (true);
-- (Schreib-Policy bleibt: nur is_admin() darf ändern)
