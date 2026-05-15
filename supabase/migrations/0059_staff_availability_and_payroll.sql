-- ─── Migration 0059: Mitarbeiter-Verfügbarkeit + Stunden-Tracking ────────
-- A) staff_availability: pro Tag + Zeitfenster (z.B. 18:00–22:00 verfügbar)
--    - Mitarbeiter trägt selbst ein, beliebig weit voraus
--    - „Nicht bindend" — CP nutzt's als Planungs-Hinweis
-- B) members: hourly_rate_eur + monthly_hour_limit_eur (Default 14€ / 610€)
--    - Pro Mitarbeiter konfigurierbar
-- C) RPC staff_monthly_stats: liefert pro Mitarbeiter geplante Stunden +
--    Euro-Betrag + Limit-Auslastung für einen Monat
-- D) RPC list_staff_availability für CP, set_my_availability für staff

-- ─── A) Verfügbarkeits-Tabelle ────────────────────────────────────────────
create table if not exists public.staff_availability (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(member_id, date),
  check (end_time > start_time)
);

create index if not exists idx_staff_availability_date   on public.staff_availability(date);
create index if not exists idx_staff_availability_member on public.staff_availability(member_id);

alter table public.staff_availability enable row level security;

-- Staff: nur eigene
drop policy if exists staff_availability_self_all on public.staff_availability;
create policy staff_availability_self_all on public.staff_availability
  for all to authenticated
  using (member_id in (select id from public.members where auth_user_id = auth.uid()))
  with check (member_id in (select id from public.members where auth_user_id = auth.uid()));

-- CP-Verantwortliche + Admin: alle lesen
drop policy if exists staff_availability_cp_read on public.staff_availability;
create policy staff_availability_cp_read on public.staff_availability
  for select to authenticated
  using (public.is_personal_planer() or public.is_admin());

-- Touch updated_at
create or replace function public.touch_staff_availability_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_availability_touch on public.staff_availability;
create trigger trg_staff_availability_touch
  before update on public.staff_availability
  for each row execute function public.touch_staff_availability_updated_at();

-- ─── B.1) Vergütungs-Spalten an members ──────────────────────────────────
alter table public.members
  add column if not exists hourly_rate_eur          numeric(6,2) not null default 14.00,
  add column if not exists monthly_hour_limit_eur   numeric(8,2) not null default 610.00;

-- ─── B.2) Stornierungs-Spalten an personal_shifts (vorbereitet für 0060) ──
alter table public.personal_shifts
  add column if not exists cancelled_at         timestamptz,
  add column if not exists cancelled_by         uuid references public.members(id) on delete set null,
  add column if not exists cancellation_reason  text;

create index if not exists idx_personal_shifts_cancelled on public.personal_shifts(cancelled_at)
  where cancelled_at is not null;

comment on column public.members.hourly_rate_eur is
  'Stundenlohn in Euro für Personal (role=''staff''). Default 14€.';
comment on column public.members.monthly_hour_limit_eur is
  'Monatliches Verdienst-Limit in Euro (Übungsleiter/Minijob). Default 610€.
   Soft-Limit: CP sieht Warnung, aber System blockiert nicht.';

-- ─── C.1) RPC: eigene Verfügbarkeit setzen ────────────────────────────────
create or replace function public.set_my_availability(
  p_date date,
  p_start_time time,
  p_end_time time,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_id uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  if p_end_time <= p_start_time then raise exception 'invalid_time_range'; end if;

  insert into public.staff_availability(member_id, date, start_time, end_time, note)
    values (v_me, p_date, p_start_time, p_end_time,
            nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (member_id, date) do update set
    start_time = excluded.start_time,
    end_time   = excluded.end_time,
    note       = excluded.note
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_my_availability(date, time, time, text) from public;
grant execute on function public.set_my_availability(date, time, time, text) to authenticated;

-- ─── C.2) RPC: eigene Verfügbarkeit löschen ───────────────────────────────
create or replace function public.delete_my_availability(p_date date)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  delete from public.staff_availability where member_id = v_me and date = p_date;
end;
$$;
revoke all on function public.delete_my_availability(date) from public;
grant execute on function public.delete_my_availability(date) to authenticated;

-- ─── C.3) RPC: eigene Verfügbarkeit listen (staff sieht nur sich selbst) ──
create or replace function public.list_my_availability(p_from date, p_to date)
returns table (
  id uuid, date date, start_time time, end_time time, note text
)
language sql stable security definer set search_path = public, auth
as $$
  select a.id, a.date, a.start_time, a.end_time, a.note
    from public.staff_availability a
    join public.members m on m.id = a.member_id
   where m.auth_user_id = auth.uid()
     and a.date >= p_from and a.date <= p_to
   order by a.date asc;
$$;
revoke all on function public.list_my_availability(date, date) from public;
grant execute on function public.list_my_availability(date, date) to authenticated;

-- ─── C.4) RPC: alle Verfügbarkeiten für CP ────────────────────────────────
create or replace function public.list_staff_availability(p_from date, p_to date)
returns table (
  id uuid, member_id uuid, member_name text,
  date date, start_time time, end_time time, note text
)
language sql stable security definer set search_path = public, auth
as $$
  select a.id, a.member_id, m.name,
         a.date, a.start_time, a.end_time, a.note
    from public.staff_availability a
    join public.members m on m.id = a.member_id
   where a.date >= p_from and a.date <= p_to
     and (public.is_personal_planer() or public.is_admin())
   order by a.date asc, m.name asc;
$$;
revoke all on function public.list_staff_availability(date, date) from public;
grant execute on function public.list_staff_availability(date, date) to authenticated;

-- ─── D) RPC: Monats-Stunden + Euro-Betrag pro Mitarbeiter (CP-Übersicht) ──
-- Berechnet aus personal_shifts: SUM(end_time - start_time) pro Mitarbeiter
-- für einen Kalendermonat. Liefert Stunden, Euro, Limit, Auslastung.
create or replace function public.staff_monthly_stats(p_year int, p_month int)
returns table (
  member_id uuid,
  name text,
  shift_count int,
  total_hours numeric,
  hourly_rate_eur numeric,
  total_earned_eur numeric,
  monthly_limit_eur numeric,
  limit_remaining_eur numeric,
  limit_usage_pct numeric
)
language sql stable security definer set search_path = public, auth
as $$
  with month_range as (
    select make_date(p_year, p_month, 1) as start_date,
           (make_date(p_year, p_month, 1) + interval '1 month')::date as end_date
  ),
  shift_hours as (
    select s.staff_member_id,
           count(*)::int as shift_count,
           sum(extract(epoch from (s.end_time - s.start_time)) / 3600)::numeric(10,2) as total_hours
      from public.personal_shifts s, month_range r
     where s.shift_date >= r.start_date
       and s.shift_date <  r.end_date
       and (s.cancelled_at is null)  -- abgesagte Schichten nicht mitzählen (Spalte aus 0060)
     group by s.staff_member_id
  )
  select
    m.id as member_id,
    m.name,
    coalesce(sh.shift_count, 0) as shift_count,
    coalesce(sh.total_hours, 0)::numeric(10,2) as total_hours,
    m.hourly_rate_eur,
    (coalesce(sh.total_hours, 0) * m.hourly_rate_eur)::numeric(10,2) as total_earned_eur,
    m.monthly_hour_limit_eur as monthly_limit_eur,
    (m.monthly_hour_limit_eur - coalesce(sh.total_hours, 0) * m.hourly_rate_eur)::numeric(10,2) as limit_remaining_eur,
    case when m.monthly_hour_limit_eur > 0
         then round(((coalesce(sh.total_hours, 0) * m.hourly_rate_eur) / m.monthly_hour_limit_eur * 100)::numeric, 1)
         else 0 end as limit_usage_pct
    from public.members m
    left join shift_hours sh on sh.staff_member_id = m.id
   where m.role = 'staff'
     and m.revoked_at is null
     and (public.is_personal_planer() or public.is_admin())
   order by limit_usage_pct desc, m.name asc;
$$;
revoke all on function public.staff_monthly_stats(int, int) from public;
grant execute on function public.staff_monthly_stats(int, int) to authenticated;

comment on function public.staff_monthly_stats(int, int) is
  'CP-Übersicht: pro Mitarbeiter geplante Stunden + Euro-Betrag + Limit-Auslastung
   für einen Kalendermonat. Cancelled Shifts werden ausgeschlossen.
   Sortiert nach Auslastung absteigend — wer noch viel Luft hat, ist unten.';

-- ─── E) RPC: hourly_rate + monthly_limit pro Mitarbeiter setzen (Admin) ───
create or replace function public.set_member_payroll(
  p_member_id uuid,
  p_hourly_rate_eur numeric,
  p_monthly_hour_limit_eur numeric
) returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not (public.is_personal_planer() or public.is_admin()) then
    raise exception 'not_authorized';
  end if;
  if coalesce(p_hourly_rate_eur, 0) <= 0 then raise exception 'invalid_hourly_rate'; end if;
  if coalesce(p_monthly_hour_limit_eur, 0) < 0 then raise exception 'invalid_limit'; end if;
  update public.members
     set hourly_rate_eur         = p_hourly_rate_eur,
         monthly_hour_limit_eur  = p_monthly_hour_limit_eur
   where id = p_member_id
     and role = 'staff';
end;
$$;
revoke all on function public.set_member_payroll(uuid, numeric, numeric) from public;
grant execute on function public.set_member_payroll(uuid, numeric, numeric) to authenticated;
