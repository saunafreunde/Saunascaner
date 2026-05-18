-- 0082_rating_app_only.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Bewerten-Workflow umbauen:
--  • Tablet (/checkin/rate) ist NICHT mehr zum Bewerten — nur noch Check-in.
--  • App ist einziger Bewertungs-Weg (Smartphone des Members).
--  • Rolen-spezifisches Zeitfenster:
--      - Aufgießer (is_aufgieser=true): 3h nach Aufguss-Ende
--      - Alle anderen (Gast/Fan/Helfer/Staff/CP/Admin): bis Folgetag 12:00 (Berlin)
--  • Anti-Fake bleibt streng: attendance_events am Aufguss-Tag Pflicht.
--  • Push-Reminder: pg_cron alle 5 Min pickt Aufgüsse die gerade endeten und
--    schreibt notification_queue-Einträge an Anwesende (außer Saunameister).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Helper: is_aufgieser_for(member_id) ──────────────────────────────
-- public.is_aufgieser() (Migrationen 0005/0035) prüft nur auth.uid().
-- Für submit_rating brauchen wir den Check für einen GEGEBENEN member_id.
create or replace function public.is_aufgieser_for(p_member_id uuid) returns boolean
language sql security definer set search_path = public as $$
  select coalesce(
    (select is_aufgieser from public.members where id = p_member_id),
    false
  );
$$;
revoke all on function public.is_aufgieser_for(uuid) from public;
grant execute on function public.is_aufgieser_for(uuid) to authenticated, service_role;

-- ─── 2. submit_rating() — rolen-spezifisches Zeitfenster ─────────────────
-- Überschreibt Migration 0048. Pfad-1 (3h-Tablet-Schnellbewertung) ENTFÄLLT.
-- Anti-Fake: attendance_events am Aufguss-Tag bleibt Pflicht.
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
  v_end_time    timestamptz;
  v_start_time  timestamptz;
  v_meister_id  uuid;
  v_is_aufg     boolean;
  v_deadline    timestamptz;
  v_attended    boolean;
begin
  select start_time, end_time, saunameister_id
    into v_start_time, v_end_time, v_meister_id
    from public.infusions where id = p_infusion_id;

  if v_end_time is null then return 'infusion_not_found'; end if;
  if v_meister_id = p_member_id then return 'self_rating_not_allowed'; end if;
  if now() < v_end_time then return 'infusion_not_finished'; end if;

  -- Anwesenheits-Check (immer Pflicht — kein Tablet-Fallback mehr)
  v_attended := exists (
    select 1 from public.attendance_events
     where member_id = p_member_id
       and date = (v_start_time at time zone 'Europe/Berlin')::date
  );
  if not v_attended then return 'not_attended_that_day'; end if;

  -- Rolen-spezifisches Zeitfenster
  v_is_aufg := public.is_aufgieser_for(p_member_id);
  if v_is_aufg then
    if now() > v_end_time + interval '3 hours' then
      return 'rating_window_expired_aufgieser';
    end if;
  else
    -- Gast/Fan/Helfer/Staff/CP/Admin: bis Folgetag 12:00 Berlin
    v_deadline := (date_trunc('day', v_start_time at time zone 'Europe/Berlin')
                   + interval '1 day 12 hours') at time zone 'Europe/Berlin';
    if now() > v_deadline then
      return 'rating_window_expired';
    end if;
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

-- ─── 3. get_ratable_infusions() — rolen-spezifisches Zeitfenster ────────
-- Überschreibt Migration 0048. Liefert genau die Aufgüsse die submit_rating
-- akzeptieren würde (gleiche Logik), damit UI nichts anzeigt was beim
-- Submit dann abgelehnt wird.
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
  with
    is_aufg as (
      select public.is_aufgieser_for(p_member_id) as v
    )
  select i.id, i.title, i.sauna_id, i.saunameister_id, i.start_time, i.end_time,
    exists(
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = p_member_id
    ) as already_rated
  from public.infusions i
  cross join is_aufg
  where i.end_time < now()
    and i.saunameister_id is not null
    and i.saunameister_id <> p_member_id
    -- Anwesenheit immer Pflicht
    and exists (
      select 1 from public.attendance_events a
       where a.member_id = p_member_id
         and a.date = (i.start_time at time zone 'Europe/Berlin')::date
    )
    -- Rolen-spezifisches Fenster
    and (
      (is_aufg.v = true  and i.end_time > now() - interval '3 hours')
      or
      (is_aufg.v = false and now() <= (
        (date_trunc('day', i.start_time at time zone 'Europe/Berlin')
         + interval '1 day 12 hours') at time zone 'Europe/Berlin'
      ))
    )
  order by i.end_time desc;
$$;

-- ─── 4. Push-Reminder Cron ──────────────────────────────────────────────
-- Findet Aufgüsse die in den letzten ~10 Min zu Ende gingen und schreibt
-- notification_queue-Einträge für alle die an dem Tag anwesend waren
-- (außer Saunameister selbst, außer schon bewertet).
create or replace function public.cron_notify_rating_window_open() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int := 0;
begin
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select distinct
    'rating_reminder',
    a.member_id,
    jsonb_build_object(
      'title', '⭐ Wie war dein Aufguss?',
      'body',  coalesce(i.title, 'Aufguss') || ' — jetzt bewerten in der App',
      'infusion_id', i.id,
      'sauna_id', i.sauna_id,
      'saunameister_id', i.saunameister_id,
      'end_time', i.end_time
    ),
    'rating:' || i.id::text || ':' || a.member_id::text
  from public.infusions i
  join public.attendance_events a
    on a.date = (i.start_time at time zone 'Europe/Berlin')::date
   and a.member_id <> i.saunameister_id
  where i.end_time between now() - interval '10 minutes' and now() - interval '2 minutes'
    and i.saunameister_id is not null
    and not exists (
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = a.member_id
    )
    and not exists (
      select 1 from public.notification_queue q
       where q.dedup_key = 'rating:' || i.id::text || ':' || a.member_id::text
         and q.processed_at is null
    );
  get diagnostics v_count = row_count;
  return v_count;
end$$;
revoke all on function public.cron_notify_rating_window_open() from public;
grant execute on function public.cron_notify_rating_window_open() to service_role;

-- ─── 5. pg_cron Schedule (alle 5 Minuten) ───────────────────────────────
-- Idempotent: vorhandenen Job zuerst entfernen, dann neu anlegen.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'notify_rating_window';
    perform cron.schedule(
      'notify_rating_window',
      '*/5 * * * *',
      $cron$ select public.cron_notify_rating_window_open(); $cron$
    );
  end if;
end$$;

comment on function public.is_aufgieser_for(uuid) is
  'Checkt ob ein gegebener Member is_aufgieser=true hat. Pendant zur TS-Helper isAufgieser() in src/lib/roles.ts.';
comment on function public.submit_rating(uuid, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text) is
  'Bewertung abgeben. Rolen-spezifisch: Aufgießer 3h, andere bis Folgetag 12:00. attendance_events am Aufguss-Tag Pflicht.';
comment on function public.get_ratable_infusions(uuid) is
  'Liste der bewertbaren Aufgüsse für einen Member, rolen-spezifisches Fenster.';
comment on function public.cron_notify_rating_window_open() is
  'pg_cron: alle 5 Min — schiebt rating_reminder-Notifications für gerade beendete Aufgüsse in die Queue.';
