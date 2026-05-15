-- ─── Migration 0056: CP-Verantwortlicher (Personal-Planer) ────────────────
-- A) Neues Flag `is_personal_planer` für Personal-Rolle (staff)
--    - Hat alles vom Mitarbeiter PLUS Personal-Planung, Anwesenheits-Export,
--      anonymisierte Bewertungs-Übersicht (ohne Aufgießer-Namen).
--    - Darf NICHT alles wie Admin (kein Saunas-Konfig, kein Branding, etc.)
-- B) Neue Tabelle `personal_shifts` für Schicht-Planung
-- C) Anonymisierte Bewertungs-Aggregate via RPC (View geht nicht mit RLS)
-- D) Einladungs- und Approval-RPCs um is_personal_planer-Flag erweitert

-- ─── A.1) Flag-Spalte auf members ─────────────────────────────────────────
alter table public.members
  add column if not exists is_personal_planer boolean not null default false;

comment on column public.members.is_personal_planer is
  'true = CP-Verantwortlicher (Personal-Planer). Nur sinnvoll bei role=''staff''.
   Erweitert Mitarbeiter um: Personal-Planung, Anwesenheits-Export, anonyme Bewertungs-Analyse.';

-- ─── A.2) Helper-RPC: is_personal_planer() ────────────────────────────────
create or replace function public.is_personal_planer()
returns boolean
language sql security definer set search_path = public
as $$
  select coalesce((
    select is_personal_planer
      from public.members
     where auth_user_id = auth.uid()
     limit 1
  ), false);
$$;
revoke all on function public.is_personal_planer() from public;
grant execute on function public.is_personal_planer() to authenticated, anon;

-- ─── A.3) Admin-RPC: set_is_personal_planer ───────────────────────────────
create or replace function public.set_is_personal_planer(p_member_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_role text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select role into v_role from public.members where id = p_member_id;
  if v_role is null then raise exception 'member_not_found'; end if;
  -- Flag nur für staff sinnvoll
  if coalesce(p_value, false) = true and v_role <> 'staff' then
    raise exception 'personal_planer_only_for_staff';
  end if;
  update public.members
     set is_personal_planer = coalesce(p_value, false)
   where id = p_member_id;
end;
$$;
revoke all on function public.set_is_personal_planer(uuid, boolean) from public;
grant execute on function public.set_is_personal_planer(uuid, boolean) to authenticated;

-- ─── B.1) personal_shifts: Schicht-Planung für Personal ───────────────────
create table if not exists public.personal_shifts (
  id              uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.members(id) on delete cascade,
  shift_date      date not null,
  start_time      time not null,
  end_time        time not null,
  notes           text,
  created_by      uuid not null references public.members(id),
  created_at      timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_personal_shifts_date  on public.personal_shifts(shift_date);
create index if not exists idx_personal_shifts_staff on public.personal_shifts(staff_member_id);

alter table public.personal_shifts enable row level security;

-- CP-Verantwortliche + Admin: full access
drop policy if exists personal_shifts_planer_all on public.personal_shifts;
create policy personal_shifts_planer_all on public.personal_shifts
  for all to authenticated
  using (public.is_personal_planer() or public.is_admin())
  with check (public.is_personal_planer() or public.is_admin());

-- Staff: nur eigene Schichten lesen
drop policy if exists personal_shifts_staff_self_read on public.personal_shifts;
create policy personal_shifts_staff_self_read on public.personal_shifts
  for select to authenticated
  using (staff_member_id in (
    select id from public.members where auth_user_id = auth.uid()
  ));

-- ─── B.2) RPC: Schicht anlegen / ändern / löschen ─────────────────────────
create or replace function public.create_personal_shift(
  p_staff_member_id uuid,
  p_shift_date date,
  p_start_time time,
  p_end_time time,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare v_me uuid; v_id uuid;
begin
  if not (public.is_personal_planer() or public.is_admin()) then
    raise exception 'not_personal_planer';
  end if;
  select id into v_me from public.members where auth_user_id = auth.uid();
  insert into public.personal_shifts(staff_member_id, shift_date, start_time, end_time, notes, created_by)
    values (p_staff_member_id, p_shift_date, p_start_time, p_end_time,
            nullif(btrim(coalesce(p_notes, '')), ''), v_me)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_personal_shift(uuid, date, time, time, text) from public;
grant execute on function public.create_personal_shift(uuid, date, time, time, text) to authenticated;

create or replace function public.delete_personal_shift(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not (public.is_personal_planer() or public.is_admin()) then
    raise exception 'not_personal_planer';
  end if;
  delete from public.personal_shifts where id = p_id;
end;
$$;
revoke all on function public.delete_personal_shift(uuid) from public;
grant execute on function public.delete_personal_shift(uuid) to authenticated;

-- ─── B.3) RPC: Schichten in Zeitraum listen ───────────────────────────────
create or replace function public.list_personal_shifts(
  p_from date,
  p_to date
) returns table (
  id uuid,
  staff_member_id uuid,
  staff_name text,
  shift_date date,
  start_time time,
  end_time time,
  notes text
)
language sql stable security definer set search_path = public, auth
as $$
  select s.id, s.staff_member_id, m.name, s.shift_date, s.start_time, s.end_time, s.notes
    from public.personal_shifts s
    join public.members m on m.id = s.staff_member_id
   where s.shift_date >= p_from
     and s.shift_date <= p_to
     and (
       public.is_personal_planer() or public.is_admin()
       or s.staff_member_id in (select id from public.members where auth_user_id = auth.uid())
     )
   order by s.shift_date asc, s.start_time asc;
$$;
revoke all on function public.list_personal_shifts(date, date) from public;
grant execute on function public.list_personal_shifts(date, date) to authenticated;

-- ─── C.1) RPC: Anonymisierte Bewertungs-Übersicht ─────────────────────────
-- Aggregiert Bewertungen pro Sauna + Wochentag + Stunde — OHNE Aufgießer-ID
-- Nur für CP-Verantwortliche + Admin callable.
create or replace function public.list_ratings_anonymous(
  p_from date,
  p_to date
) returns table (
  sauna_id uuid,
  sauna_name text,
  weekday smallint,           -- 0=Sonntag ... 6=Samstag
  hour_of_day smallint,       -- 0..23
  rating_count bigint,
  avg_chemie numeric,
  avg_luftbewegung numeric,
  avg_wedeltechnik numeric,
  avg_hitzeniveau numeric,
  avg_musik numeric,
  avg_duftentwicklung numeric,
  avg_overall numeric
)
language sql stable security definer set search_path = public, auth
as $$
  select
    i.sauna_id,
    s.name as sauna_name,
    extract(dow from i.start_time)::smallint as weekday,
    extract(hour from i.start_time)::smallint as hour_of_day,
    count(r.id) as rating_count,
    round(avg(r.chemie)::numeric, 2)          as avg_chemie,
    round(avg(r.luftbewegung)::numeric, 2)    as avg_luftbewegung,
    round(avg(r.wedeltechnik)::numeric, 2)    as avg_wedeltechnik,
    round(avg(r.hitzeniveau)::numeric, 2)     as avg_hitzeniveau,
    round(avg(r.musik)::numeric, 2)           as avg_musik,
    round(avg(r.duftentwicklung)::numeric, 2) as avg_duftentwicklung,
    round(((avg(r.chemie) + avg(r.luftbewegung) + avg(r.wedeltechnik)
          + avg(r.hitzeniveau) + avg(r.musik) + avg(r.duftentwicklung)) / 6)::numeric, 2)
                                              as avg_overall
  from public.infusion_ratings r
  join public.infusions i on i.id = r.infusion_id
  join public.saunas s    on s.id = i.sauna_id
  where i.start_time::date >= p_from
    and i.start_time::date <= p_to
    and (public.is_personal_planer() or public.is_admin())
  group by i.sauna_id, s.name, weekday, hour_of_day;
$$;
revoke all on function public.list_ratings_anonymous(date, date) from public;
grant execute on function public.list_ratings_anonymous(date, date) to authenticated;

comment on function public.list_ratings_anonymous(date, date) is
  'Anonymisierte Bewertungs-Aggregate pro Sauna × Wochentag × Stunde.
   Liefert KEINE Aufgießer-IDs oder -Namen — für CP-Verantwortliche zur
   Qualitäts-Übersicht ohne Personal-Bias.';

-- ─── C.2) RPC: Anwesenheits-Export für Mitarbeiter ────────────────────────
create or replace function public.export_staff_attendance(
  p_from date,
  p_to date
) returns table (
  member_id uuid,
  name text,
  role text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  duration_minutes int
)
language sql stable security definer set search_path = public, auth
as $$
  select m.id, m.name, m.role,
         p.start_at as check_in_at,
         p.end_at   as check_out_at,
         extract(epoch from (coalesce(p.end_at, now()) - p.start_at))::int / 60 as duration_minutes
    from public.presence_log p
    join public.members m on m.id = p.member_id
   where m.role = 'staff'
     and p.start_at::date >= p_from
     and p.start_at::date <= p_to
     and (public.is_personal_planer() or public.is_admin())
   order by m.name, p.start_at;
$$;
revoke all on function public.export_staff_attendance(date, date) from public;
grant execute on function public.export_staff_attendance(date, date) to authenticated;

comment on function public.export_staff_attendance(date, date) is
  'Anwesenheits-Log für Personal in Zeitraum. CP-only.
   Falls presence_log-Tabelle anders strukturiert ist, RPC anpassen.';

-- ─── D.1) Einladungen: target_is_personal_planer-Spalte ──────────────────
alter table public.invitations
  add column if not exists target_is_personal_planer boolean not null default false;

-- ─── D.2) create_invitation: erweiterte Signatur ─────────────────────────
drop function if exists public.create_invitation(text, boolean, text, timestamptz);

create or replace function public.create_invitation(
  p_target_role text,
  p_target_is_aufgieser boolean default false,
  p_target_is_personal_planer boolean default false,
  p_note text default null,
  p_expires_at timestamptz default null
) returns public.invitations
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare
  v_admin_id uuid;
  v_code text;
  v_inv  public.invitations%rowtype;
  v_attempts int := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_target_role not in ('member','guest_aufgieser','staff','admin','gast') then
    raise exception 'invalid_target_role';
  end if;
  if coalesce(p_target_is_personal_planer, false) and p_target_role <> 'staff' then
    raise exception 'personal_planer_only_for_staff';
  end if;
  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  loop
    v_code := upper(substring(replace(replace(replace(replace(
      encode(extensions.gen_random_bytes(6), 'base64'),
      '/', ''), '+', ''), '=', ''), 'O', 'X'), 1, 8));
    if length(v_code) < 8 then v_code := v_code || repeat('A', 8 - length(v_code)); end if;
    exit when not exists (select 1 from public.invitations where code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then raise exception 'could_not_generate_code'; end if;
  end loop;

  insert into public.invitations
    (code, target_role, target_is_aufgieser, target_is_personal_planer, note, expires_at, created_by)
  values
    (v_code, p_target_role,
     case when p_target_role = 'member' then coalesce(p_target_is_aufgieser, false) else false end,
     case when p_target_role = 'staff'  then coalesce(p_target_is_personal_planer, false) else false end,
     nullif(btrim(coalesce(p_note, '')), ''),
     p_expires_at, v_admin_id)
  returning * into v_inv;

  return v_inv;
end;
$$;
revoke all on function public.create_invitation(text, boolean, boolean, text, timestamptz) from public;
grant execute on function public.create_invitation(text, boolean, boolean, text, timestamptz) to authenticated;

-- ─── D.3) handle_new_user: is_personal_planer aus Invitation übernehmen ───
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_kind text := new.raw_user_meta_data->>'signup_kind';
  v_ref  text := new.raw_user_meta_data->>'gast_referral';
  v_origin text := new.raw_user_meta_data->>'gast_origin';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
  v_pin char(4);
begin
  v_pin := public.generate_checkin_pin();

  if v_kind = 'gast' then
    insert into public.members (
      auth_user_id, email, name, role, is_aufgieser, approved,
      gast_referral_source, gast_signup_origin, gast_consent_at,
      checkin_pin
    ) values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'name', new.email),
      'gast', false, true,
      v_ref, v_origin, now(),
      v_pin
    )
    on conflict (auth_user_id) do update set
      role = 'gast',
      approved = true,
      gast_referral_source = excluded.gast_referral_source,
      gast_signup_origin = excluded.gast_signup_origin,
      gast_consent_at = coalesce(public.members.gast_consent_at, excluded.gast_consent_at),
      checkin_pin = coalesce(public.members.checkin_pin, excluded.checkin_pin);
    return new;
  end if;

  if v_code is not null and length(v_code) > 0 then
    select * into v_inv from public.invitations
     where code = upper(v_code)
       and used_by is null
       and (expires_at is null or expires_at > now())
     for update;
    if found then
      insert into public.members
        (auth_user_id, email, name, role, is_aufgieser, is_personal_planer, approved, checkin_pin)
      values
        (new.id, new.email,
         coalesce(new.raw_user_meta_data->>'name', new.email),
         v_inv.target_role,
         v_inv.target_is_aufgieser,
         v_inv.target_is_personal_planer,
         true,
         v_pin)
      on conflict (auth_user_id) do update set
        role               = excluded.role,
        is_aufgieser       = excluded.is_aufgieser,
        is_personal_planer = excluded.is_personal_planer,
        approved           = true,
        checkin_pin        = coalesce(public.members.checkin_pin, excluded.checkin_pin)
      returning id into v_member_id;
      update public.invitations
         set used_by = v_member_id, used_at = now()
       where id = v_inv.id;
      return new;
    end if;
  end if;

  insert into public.members (auth_user_id, email, name, role, approved, checkin_pin)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false, v_pin)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── C.3) RPC: Liste Personal-Mitglieder für Schicht-Planung ──────────────
create or replace function public.list_staff_members()
returns table (
  id uuid,
  name text,
  email text,
  is_personal_planer boolean,
  is_present boolean,
  avatar_path text
)
language sql stable security definer set search_path = public, auth
as $$
  select m.id, m.name, m.email, m.is_personal_planer, m.is_present, m.avatar_path
    from public.members m
   where m.role = 'staff'
     and m.revoked_at is null
     and (public.is_personal_planer() or public.is_admin())
   order by m.name;
$$;
revoke all on function public.list_staff_members() from public;
grant execute on function public.list_staff_members() to authenticated;

-- ─── D.4) approve_member um is_personal_planer erweitern ──────────────────
create or replace function public.approve_member(
  p_member_id          uuid,
  p_role               text default 'member',
  p_is_aufgieser       boolean default false,
  p_is_personal_planer boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_role text := coalesce(p_role, 'member');
  v_aufgieser boolean := coalesce(p_is_aufgieser, false);
  v_planer    boolean := coalesce(p_is_personal_planer, false);
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_role not in ('gast','member','guest_aufgieser','staff','admin') then
    v_role := 'member';
  end if;
  if v_role <> 'member' then v_aufgieser := false; end if;
  if v_role <> 'staff' then v_planer := false; end if;
  update public.members
     set approved           = true,
         role               = v_role,
         is_aufgieser       = v_aufgieser,
         is_personal_planer = v_planer,
         checkin_pin        = coalesce(checkin_pin, public.generate_checkin_pin())
   where id = p_member_id;
end;
$$;
