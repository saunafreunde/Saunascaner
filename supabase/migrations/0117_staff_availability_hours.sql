-- ─── Migration 0117: Verfügbarkeits-Stundenslots + Bestätigen-Brücke ──────
-- A) staff_availability.hours smallint[]  — angeklickte Start-Stunden (grün).
--    start_time/end_time bleiben (aus min/max abgeleitet → Constraint gültig,
--    Altbestand kompatibel).
-- B) set_my_availability_hours(date, smallint[])  — Self-Service Upsert/Delete.
-- C) list_my_availability / list_staff_availability  — drop+recreate mit hours.
-- D) confirm_staff_availability(member, date, smallint[])  — grün→blau:
--    erzeugt personal_shifts aus zusammenhängenden Stunden-Läufen (CP/Admin).
--    Fließt automatisch in staff_monthly_stats (Lohn), Tausch/Absage, MyShiftsList.

-- ─── A) hours-Spalte ──────────────────────────────────────────────────────
alter table public.staff_availability
  add column if not exists hours smallint[];

comment on column public.staff_availability.hours is
  'Angeklickte Start-Stunden (z.B. {13,14,15} = Blöcke 13–16 Uhr).
   Source of Truth; start_time/end_time = min / max+1 daraus abgeleitet.';

-- ─── B) RPC: eigene Verfügbarkeit als Stundenslots setzen ─────────────────
create or replace function public.set_my_availability_hours(
  p_date  date,
  p_hours smallint[]
) returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me    uuid;
  v_id    uuid;
  v_hours smallint[];
  v_min   int;
  v_max   int;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  -- dedupliziert + aufsteigend sortiert, nur gültige Stunden 0..23
  select array_agg(h order by h) into v_hours
    from (select distinct unnest(coalesce(p_hours, '{}'::smallint[])) as h) s
   where h >= 0 and h <= 23;

  -- leer → Tag zurücksetzen
  if v_hours is null or array_length(v_hours, 1) is null then
    delete from public.staff_availability where member_id = v_me and date = p_date;
    return null;
  end if;

  v_min := v_hours[1];
  v_max := v_hours[array_length(v_hours, 1)];

  insert into public.staff_availability(member_id, date, start_time, end_time, hours)
    values (
      v_me, p_date,
      make_time(v_min, 0, 0),
      case when v_max + 1 >= 24 then time '24:00:00' else make_time(v_max + 1, 0, 0) end,
      v_hours
    )
  on conflict (member_id, date) do update set
    start_time = excluded.start_time,
    end_time   = excluded.end_time,
    hours      = excluded.hours
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_my_availability_hours(date, smallint[]) from public;
grant execute on function public.set_my_availability_hours(date, smallint[]) to authenticated;

comment on function public.set_my_availability_hours(date, smallint[]) is
  'Mitarbeiter setzt seine verfügbaren Start-Stunden für einen Tag (grün).
   Leeres Array löscht den Tag. Upsert auf (member_id, date).';

-- ─── C) List-RPCs neu (Rückgabe um hours erweitert) ───────────────────────
drop function if exists public.list_my_availability(date, date);
create or replace function public.list_my_availability(p_from date, p_to date)
returns table (
  id uuid, date date, start_time time, end_time time, note text, hours smallint[]
)
language sql stable security definer set search_path = public, auth
as $$
  select a.id, a.date, a.start_time, a.end_time, a.note, a.hours
    from public.staff_availability a
    join public.members m on m.id = a.member_id
   where m.auth_user_id = auth.uid()
     and a.date >= p_from and a.date <= p_to
   order by a.date asc;
$$;
revoke all on function public.list_my_availability(date, date) from public;
grant execute on function public.list_my_availability(date, date) to authenticated;

drop function if exists public.list_staff_availability(date, date);
create or replace function public.list_staff_availability(p_from date, p_to date)
returns table (
  id uuid, member_id uuid, member_name text,
  date date, start_time time, end_time time, note text, hours smallint[]
)
language sql stable security definer set search_path = public, auth
as $$
  select a.id, a.member_id, m.name,
         a.date, a.start_time, a.end_time, a.note, a.hours
    from public.staff_availability a
    join public.members m on m.id = a.member_id
   where a.date >= p_from and a.date <= p_to
     and (public.is_personal_planer() or public.is_admin())
   order by a.date asc, m.name asc;
$$;
revoke all on function public.list_staff_availability(date, date) from public;
grant execute on function public.list_staff_availability(date, date) to authenticated;

-- ─── D) RPC: Verfügbarkeit bestätigen → personal_shifts (grün→blau) ───────
-- Idempotent: löscht nicht-stornierte Schichten des Tages und legt für jeden
-- zusammenhängenden Stunden-Lauf genau eine Schicht an. Leeres Array = nur
-- zurücknehmen (blau → grün/leer).
create or replace function public.confirm_staff_availability(
  p_member_id uuid,
  p_date      date,
  p_hours     smallint[]
) returns int
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me        uuid;
  v_hours     smallint[];
  v_run_start int;
  v_prev      int;
  v_h         int;
  v_count     int := 0;
  i           int;
begin
  if not (public.is_personal_planer() or public.is_admin()) then
    raise exception 'not_personal_planer';
  end if;
  select id into v_me from public.members where auth_user_id = auth.uid();
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'member_not_found';
  end if;

  -- bestehende (nicht stornierte) Schichten dieses Tages entfernen (idempotent)
  delete from public.personal_shifts
   where staff_member_id = p_member_id
     and shift_date = p_date
     and cancelled_at is null;

  select array_agg(h order by h) into v_hours
    from (select distinct unnest(coalesce(p_hours, '{}'::smallint[])) as h) s
   where h >= 0 and h <= 23;

  if v_hours is null or array_length(v_hours, 1) is null then
    return 0;  -- leer = nur zurücknehmen
  end if;

  v_run_start := v_hours[1];
  v_prev := v_hours[1];
  for i in 2 .. array_length(v_hours, 1) loop
    v_h := v_hours[i];
    if v_h = v_prev + 1 then
      v_prev := v_h;
    else
      insert into public.personal_shifts(staff_member_id, shift_date, start_time, end_time, created_by)
        values (p_member_id, p_date, make_time(v_run_start, 0, 0), make_time(v_prev + 1, 0, 0), v_me);
      v_count := v_count + 1;
      v_run_start := v_h;
      v_prev := v_h;
    end if;
  end loop;
  -- letzten Lauf schreiben (24:00-Rand abgesichert)
  insert into public.personal_shifts(staff_member_id, shift_date, start_time, end_time, created_by)
    values (p_member_id, p_date, make_time(v_run_start, 0, 0),
            case when v_prev + 1 >= 24 then time '24:00:00' else make_time(v_prev + 1, 0, 0) end, v_me);
  v_count := v_count + 1;

  return v_count;
end;
$$;
revoke all on function public.confirm_staff_availability(uuid, date, smallint[]) from public;
grant execute on function public.confirm_staff_availability(uuid, date, smallint[]) to authenticated;

comment on function public.confirm_staff_availability(uuid, date, smallint[]) is
  'CP/Admin bestätigt Verfügbarkeit eines Mitarbeiters für einen Tag → erzeugt
   personal_shifts aus zusammenhängenden Stunden-Läufen (blau). Idempotent pro Tag.';
