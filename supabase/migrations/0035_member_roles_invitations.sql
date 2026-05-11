-- ─── Migration 0035: Erweiterte Mitglieds-Rollen + Invite-Link-System ───
-- Christoph (11.05.2026 nacht): zwei neue Mitglieds-Arten neben 'member' + 'admin':
--   - 'guest_aufgieser': Aufgießer von anderen Landesgruppen, gelegentlich
--     zu Gast in Freudenstadt. Volle Aufgießer-Rechte, aber als Gast markiert.
--   - 'staff': Mitarbeiter (nicht-Verein). Darf nur Personal-Fallback-Aufgüsse
--     übernehmen, Evak-Alarm auslösen, Anwesenheitsliste lesen, WM-Tipspiel
--     mitspielen, Mitgliederübersicht lesen. Keine eigenen Aufgüsse anlegen.
--
-- Approval: separate Invite-Links pro Typ. Admin generiert Code → User
-- registriert sich via /signup?invite=<code> → Trigger setzt Rolle + approved.
--
-- is_aufgieser() Helper wird erweitert: returnt true auch für role='guest_aufgieser'.
-- Dadurch greifen ALLE bestehenden Aufgießer-RLS-Policies automatisch.

-- ─── 1. Role-Constraint erweitern ─────────────────────────────────────────
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('member', 'guest_aufgieser', 'staff', 'admin'));

-- ─── 2. home_group für Gast-Aufgießer ─────────────────────────────────────
alter table public.members
  add column if not exists home_group text;

-- ─── 3. Helper-Funktionen aktualisieren ───────────────────────────────────
create or replace function public.is_aufgieser() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select (is_aufgieser = true or role = 'guest_aufgieser')
       from public.members where auth_user_id = auth.uid()),
    false
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'staff' from public.members where auth_user_id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

create or replace function public.is_guest_aufgieser() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'guest_aufgieser' from public.members where auth_user_id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_guest_aufgieser() from public;
grant execute on function public.is_guest_aufgieser() to anon, authenticated;

-- ─── 4. Tabelle invitations ──────────────────────────────────────────────
create table if not exists public.invitations (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  target_role         text not null check (target_role in ('member','guest_aufgieser','staff','admin')),
  target_is_aufgieser boolean not null default false,
  note                text,
  expires_at          timestamptz,
  created_by          uuid references public.members(id) on delete set null,
  used_by             uuid references public.members(id) on delete set null,
  used_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists invitations_code_idx on public.invitations(code);
create index if not exists invitations_unused_idx on public.invitations(code) where used_by is null;

alter table public.invitations enable row level security;

-- Nur Admin darf sehen (via RPCs verfügbar)
create policy invitations_read_admin on public.invitations
  for select to authenticated using (public.is_admin());

-- Schreibzugriff ausschließlich über SECURITY DEFINER RPCs.

-- ─── 5. approve_member aktualisieren ─────────────────────────────────────
-- Alte 2-Param-Variante (aus Pre-0005) wegräumen
drop function if exists public.approve_member(uuid, text);

create or replace function public.approve_member(
  p_member_id    uuid,
  p_role         text default 'member',
  p_is_aufgieser boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_role text := coalesce(p_role, 'member');
  v_aufgieser boolean := coalesce(p_is_aufgieser, false);
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_role not in ('member','guest_aufgieser','staff','admin') then
    v_role := 'member';
  end if;
  -- is_aufgieser-Flag nur für role='member' sinnvoll
  if v_role <> 'member' then v_aufgieser := false; end if;
  update public.members
     set approved     = true,
         role         = v_role,
         is_aufgieser = v_aufgieser
   where id = p_member_id;
end;
$$;
revoke all on function public.approve_member(uuid, text, boolean) from public;
grant execute on function public.approve_member(uuid, text, boolean) to authenticated;

-- ─── 6. takeover_personal_fallback erweitern (auch Gast + Staff) ─────────
create or replace function public.takeover_personal_fallback(
  p_infusion_id   uuid,
  p_title         text,
  p_description   text default null,
  p_attributes    text[] default '{}',
  p_oils          text[] default null,
  p_team_infusion boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member public.members%rowtype;
  v_inf    public.infusions%rowtype;
  v_allowed boolean;
begin
  select * into v_member from public.members where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
  v_allowed := v_member.is_aufgieser or v_member.role in ('guest_aufgieser','staff','admin');
  if not v_allowed then raise exception 'not_authorized'; end if;

  select * into v_inf from public.infusions where id = p_infusion_id;
  if not found then raise exception 'infusion_not_found'; end if;
  if not v_inf.is_personal_fallback then raise exception 'not_a_fallback'; end if;
  if v_inf.end_time <= now() then raise exception 'slot_in_past'; end if;
  if length(btrim(coalesce(p_title, ''))) < 1 then raise exception 'title_required'; end if;

  update public.infusions
     set saunameister_id      = v_member.id,
         is_personal_fallback = false,
         title                = btrim(p_title),
         description          = nullif(btrim(coalesce(p_description, '')), ''),
         attributes           = coalesce(p_attributes, '{}'),
         oils                 = p_oils,
         team_infusion        = coalesce(p_team_infusion, false)
   where id = p_infusion_id;
end;
$$;
revoke all on function public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean) from public;
grant execute on function public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean) to authenticated;

-- ─── 7. handle_new_user Trigger erweitern (Invite-Code-Handling) ────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
begin
  if v_code is not null and length(v_code) > 0 then
    select * into v_inv from public.invitations
     where code = upper(v_code)
       and used_by is null
       and (expires_at is null or expires_at > now())
     for update;
    if found then
      insert into public.members (auth_user_id, email, name, role, is_aufgieser, approved)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'name', new.email),
                v_inv.target_role, v_inv.target_is_aufgieser, true)
        on conflict (auth_user_id) do update set
          role         = excluded.role,
          is_aufgieser = excluded.is_aufgieser,
          approved     = true
        returning id into v_member_id;
      update public.invitations
         set used_by = v_member_id, used_at = now()
       where id = v_inv.id;
      return new;
    end if;
  end if;
  -- Fallback: regulärer Member, unapproved
  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── 8. RPCs für Invite-Management ────────────────────────────────────────
create or replace function public.create_invitation(
  p_target_role         text,
  p_target_is_aufgieser boolean default false,
  p_note                text default null,
  p_expires_at          timestamptz default null
) returns public.invitations
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_admin_id uuid;
  v_code text;
  v_inv  public.invitations%rowtype;
  v_attempts int := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_target_role not in ('member','guest_aufgieser','staff','admin') then
    raise exception 'invalid_target_role';
  end if;
  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  -- Generiere 8-stelligen alphanumerischen Code (ohne 0/O/1/I für Lesbarkeit)
  loop
    v_code := upper(substring(replace(replace(replace(replace(
      encode(extensions.gen_random_bytes(6), 'base64'),
      '/', ''), '+', ''), '=', ''), 'O', 'X'), 1, 8));
    -- Padding falls < 8 Zeichen
    if length(v_code) < 8 then v_code := v_code || repeat('A', 8 - length(v_code)); end if;
    exit when not exists (select 1 from public.invitations where code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then raise exception 'could_not_generate_code'; end if;
  end loop;

  insert into public.invitations
    (code, target_role, target_is_aufgieser, note, expires_at, created_by)
  values
    (v_code, p_target_role,
     case when p_target_role = 'member' then coalesce(p_target_is_aufgieser, false) else false end,
     nullif(btrim(coalesce(p_note, '')), ''),
     p_expires_at, v_admin_id)
  returning * into v_inv;

  return v_inv;
end;
$$;
revoke all on function public.create_invitation(text, boolean, text, timestamptz) from public;
grant execute on function public.create_invitation(text, boolean, text, timestamptz) to authenticated;

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.invitations where id = p_id and used_by is null;
  if not found then raise exception 'not_revocable'; end if;
end;
$$;
revoke all on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

create or replace function public.list_invitations()
returns setof public.invitations
language sql stable security definer set search_path = public, auth as $$
  select * from public.invitations
   where public.is_admin()
   order by created_at desc;
$$;
revoke all on function public.list_invitations() from public;
grant execute on function public.list_invitations() to authenticated;

-- ─── 9. Self-Edit-RPC für home_group (Gast-Aufgießer) ────────────────────
create or replace function public.set_my_home_group(p_group text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_clean text := nullif(btrim(coalesce(p_group, '')), '');
begin
  if v_clean is not null and char_length(v_clean) > 80 then
    raise exception 'home_group_too_long';
  end if;
  update public.members
     set home_group = v_clean
   where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
end;
$$;
revoke all on function public.set_my_home_group(text) from public;
grant execute on function public.set_my_home_group(text) to authenticated;

comment on function public.is_aufgieser() is
  'true wenn Vereinsmitglied mit is_aufgieser=true ODER role=guest_aufgieser. Damit greifen alle bestehenden Aufgießer-RLS-Policies auch für Gast-Aufgießer.';
comment on table public.invitations is
  'Admin-generierte Invite-Codes für gezielte Rolle-Zuweisung beim Signup. Single-Use.';
