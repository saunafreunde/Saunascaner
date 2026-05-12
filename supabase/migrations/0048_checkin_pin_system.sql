-- ─── Migration 0048: PIN-Checkin am Sauna-Tablet ─────────────────────────
-- 4-stelliger numerischer PIN für jeden Gast (und optional Mitglieder).
-- Tablet-Workflow: PIN-Eingabe → Anwesenheits-Eintrag → bewertbar bis morgen 12 Uhr.
-- Schnell-Signup direkt am Tablet (Name + Email + DSGVO).

-- ─── 1. PIN-Spalte ───────────────────────────────────────────────────────
alter table public.members
  add column if not exists checkin_pin char(4);

create unique index if not exists idx_members_checkin_pin on public.members(checkin_pin)
  where checkin_pin is not null;

-- ─── 2. Helper: 4-stelligen PIN generieren (kollisionsfrei) ─────────────
create or replace function public.generate_checkin_pin() returns char(4)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pin char(4);
  v_attempts int := 0;
begin
  loop
    -- 4-stelliger PIN, ohne führende 0er-Folgen die zu trivial sind
    v_pin := lpad(((random() * 9000)::int + 1000)::text, 4, '0');
    exit when not exists (select 1 from public.members where checkin_pin = v_pin);
    v_attempts := v_attempts + 1;
    if v_attempts > 100 then raise exception 'could_not_generate_unique_pin'; end if;
  end loop;
  return v_pin;
end$$;

-- ─── 3. PIN für bestehende Gäste nachträglich generieren ────────────────
do $$
declare m record;
begin
  for m in select id from public.members where role = 'gast' and checkin_pin is null and revoked_at is null loop
    update public.members set checkin_pin = public.generate_checkin_pin() where id = m.id;
  end loop;
end$$;

-- ─── 4. handle_new_user: Gast-Signups bekommen automatisch PIN ──────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_kind text := new.raw_user_meta_data->>'signup_kind';
  v_ref  text := new.raw_user_meta_data->>'gast_referral';
  v_origin text := new.raw_user_meta_data->>'gast_origin';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
begin
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
      public.generate_checkin_pin()
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

  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── 5. Lookup-RPC: Gast per PIN finden (für Tablet-Endpoint) ────────────
-- Returns minimale Info — wird nur von service-role im /api/checkin verwendet.
create or replace function public.lookup_gast_by_pin(p_pin char(4))
returns table (
  id uuid,
  auth_user_id uuid,
  name text,
  email text,
  role text
)
language sql stable security definer set search_path = public as $$
  select m.id, m.auth_user_id, m.name, m.email, m.role
    from public.members m
   where m.checkin_pin = p_pin
     and m.revoked_at is null
     and m.approved = true
   limit 1;
$$;
revoke all on function public.lookup_gast_by_pin(char) from public;
-- nur Service-Role darf das aufrufen

-- ─── 6. Eigenen PIN ablesen (im /gast-Bereich anzeigen) ──────────────────
create or replace function public.get_my_checkin_pin() returns char(4)
language sql stable security definer set search_path = public, auth as $$
  select checkin_pin from public.members where auth_user_id = auth.uid();
$$;
revoke all on function public.get_my_checkin_pin() from public;
grant execute on function public.get_my_checkin_pin() to authenticated;

-- ─── 7. PIN neu generieren (für eigenen Account) ─────────────────────────
create or replace function public.rotate_my_checkin_pin() returns char(4)
language plpgsql security definer set search_path = public, auth as $$
declare v_new char(4);
begin
  v_new := public.generate_checkin_pin();
  update public.members
     set checkin_pin = v_new
   where auth_user_id = auth.uid();
  return v_new;
end$$;
revoke all on function public.rotate_my_checkin_pin() from public;
grant execute on function public.rotate_my_checkin_pin() to authenticated;

-- ─── 8. Bewertungs-Frist erweitert: bis nächster Tag 12:00 nach Anwesenheit ─
-- Member darf bewerten wenn:
--  - innerhalb 3h nach Aufguss-Ende (alte Schnellbewertung am Tablet), ODER
--  - er am Tag des Aufgusses anwesend war UND aktuelle Zeit < Tag+1 12:00 (App-Bewertung später)
create or replace function public.submit_rating(
  p_infusion_id   uuid,
  p_member_id     uuid,
  p_chemie        smallint,
  p_luftbewegung  smallint,
  p_wedeltechnik  smallint,
  p_hitzeniveau   smallint,
  p_musik         smallint,
  p_duftentwicklung smallint,
  p_comment       text default null
) returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_end_time   timestamptz;
  v_start_time timestamptz;
  v_meister_id uuid;
  v_attended   boolean;
  v_deadline   timestamptz;
begin
  select start_time, end_time, saunameister_id
    into v_start_time, v_end_time, v_meister_id
    from public.infusions where id = p_infusion_id;

  if v_end_time is null then return 'infusion_not_found'; end if;
  if v_meister_id = p_member_id then return 'self_rating_not_allowed'; end if;
  if now() < v_end_time then return 'infusion_not_finished'; end if;

  -- Pfad 1: Schnellbewertung innerhalb 3h nach Aufguss + is_present
  if now() <= v_end_time + interval '3 hours' then
    if exists (select 1 from public.members where id = p_member_id and is_present = true) then
      -- ok, direkter Schnell-Pfad
    elsif exists (
      select 1 from public.attendance_events
       where member_id = p_member_id
         and date = (v_start_time at time zone 'Europe/Berlin')::date
    ) then
      -- auch ok wenn am Aufguss-Tag schon angekommen
    else
      return 'not_present';
    end if;
  else
    -- Pfad 2: Spätbewertung in der App — bis morgen 12:00 nach Anwesenheits-Tag
    -- Anwesenheits-Tag = Tag an dem der Aufguss startete (lokale Zeit)
    v_deadline := (date_trunc('day', v_start_time at time zone 'Europe/Berlin') + interval '1 day 12 hours') at time zone 'Europe/Berlin';
    if now() > v_deadline then
      return 'rating_window_expired';
    end if;
    -- Member muss am Tag anwesend gewesen sein
    v_attended := exists (
      select 1 from public.attendance_events
       where member_id = p_member_id
         and date = (v_start_time at time zone 'Europe/Berlin')::date
    );
    if not v_attended then return 'not_attended_that_day'; end if;
  end if;

  insert into public.infusion_ratings
    (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
     hitzeniveau, musik, duftentwicklung, comment)
  values
    (p_infusion_id, p_member_id, p_chemie, p_luftbewegung, p_wedeltechnik,
     p_hitzeniveau, p_musik, p_duftentwicklung, p_comment)
  on conflict (infusion_id, member_id) do update set
    chemie          = excluded.chemie,
    luftbewegung    = excluded.luftbewegung,
    wedeltechnik    = excluded.wedeltechnik,
    hitzeniveau     = excluded.hitzeniveau,
    musik           = excluded.musik,
    duftentwicklung = excluded.duftentwicklung,
    comment         = excluded.comment;

  return 'ok';
end$$;

-- ─── 9. get_ratable_infusions erweitert: zeigt auch Aufgüsse vom Anwesenheits-Tag ─
create or replace function public.get_ratable_infusions(p_member_id uuid)
returns table (
  id              uuid,
  title           text,
  sauna_id        uuid,
  saunameister_id uuid,
  start_time      timestamptz,
  end_time        timestamptz,
  already_rated   boolean
) language sql security definer set search_path = public as $$
  -- Aufgüsse die der Member bewerten kann:
  --  - Aufguss ist beendet
  --  - Saunameister gesetzt + nicht der Member selbst
  --  - Entweder im 3h-Fenster ODER war am Aufguss-Tag anwesend UND noch vor morgen 12:00
  select i.id, i.title, i.sauna_id, i.saunameister_id, i.start_time, i.end_time,
    exists(select 1 from public.infusion_ratings r where r.infusion_id = i.id and r.member_id = p_member_id) as already_rated
  from public.infusions i
  where i.end_time < now()
    and i.saunameister_id is not null
    and i.saunameister_id <> p_member_id
    and (
      -- Schnellbewertung-Fenster
      i.end_time > now() - interval '3 hours'
      or
      -- Spätbewertung: war am Aufguss-Tag anwesend + noch vor morgen 12 Uhr
      (
        exists (
          select 1 from public.attendance_events a
           where a.member_id = p_member_id
             and a.date = (i.start_time at time zone 'Europe/Berlin')::date
        )
        and now() <= ((date_trunc('day', i.start_time at time zone 'Europe/Berlin') + interval '1 day 12 hours') at time zone 'Europe/Berlin')
      )
    )
  order by i.end_time desc;
$$;

comment on column public.members.checkin_pin is
  '4-stelliger numerischer PIN für Sauna-Tablet-Checkin. Wird beim Gast-Signup auto-generiert. Unique.';
comment on function public.lookup_gast_by_pin(char) is
  'Service-Role-Only: Lookup für /api/checkin Endpoint.';
