-- ─── Migration 0028: Abwesenheit / Urlaub für Stamm-Aufgießer ───
-- Aufgießer kann Datums-Range eintragen. Betroffene materialisierte
-- Stamm-Aufgüsse werden auf Personal-Fallback umgestellt (saunameister_id=NULL,
-- is_personal_fallback=true). Der RPC gibt die freigegebenen Slots zurück,
-- damit das Frontend einen Push an die anderen Aufgießer auslösen kann.

create table if not exists public.aufgieser_absences (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  start_date  date not null,
  end_date    date not null check (end_date >= start_date),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists absences_member_idx on public.aufgieser_absences(member_id);
create index if not exists absences_range_idx on public.aufgieser_absences(start_date, end_date);

alter table public.aufgieser_absences enable row level security;

create policy absences_read on public.aufgieser_absences
  for select to authenticated using (true);

-- Schreibzugriff via SECURITY DEFINER RPCs (s. unten).

-- ─── RPC: add_absence ────────────────────────────────────────────────────
create or replace function public.add_absence(
  p_start date,
  p_end   date,
  p_note  text default null
)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member public.members%rowtype;
  v_absence_id uuid;
  v_freed jsonb;
begin
  -- Aufrufer-Member ermitteln + Aufgießer-Check
  select * into v_member from public.members where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
  if not v_member.is_aufgieser then raise exception 'not_aufgieser'; end if;
  if p_end < p_start then raise exception 'invalid_range'; end if;

  insert into public.aufgieser_absences (member_id, start_date, end_date, note)
    values (v_member.id, p_start, p_end, p_note)
    returning id into v_absence_id;

  -- Betroffene materialisierte Stamm-Aufgüsse → Personal-Fallback
  with affected as (
    update public.infusions i
       set saunameister_id     = null,
           is_personal_fallback = true,
           title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
           description          = null,
           oils                 = null,
           attributes           = '{}'
      where i.recurring_slot_id in (
              select rs.id from public.recurring_slots rs
               where rs.member_id = v_member.id and rs.status = 'active'
            )
        and (i.start_time at time zone 'Europe/Berlin')::date between p_start and p_end
        and i.end_time > now()
    returning i.id, i.start_time, i.sauna_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'infusion_id', a.id,
           'start_time', a.start_time,
           'sauna_id',   a.sauna_id,
           'sauna_name', s.name
         )), '[]'::jsonb)
    into v_freed
    from affected a left join public.saunas s on s.id = a.sauna_id;

  return jsonb_build_object('absence_id', v_absence_id, 'freed_slots', v_freed);
end;
$$;

revoke all on function public.add_absence(date, date, text) from public;
grant execute on function public.add_absence(date, date, text) to authenticated;

-- ─── RPC: delete_absence ────────────────────────────────────────────────
create or replace function public.delete_absence(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member_id uuid;
begin
  select member_id into v_member_id from public.aufgieser_absences where id = p_id;
  if not found then raise exception 'absence_not_found'; end if;
  if not (public.is_admin() or v_member_id = (select id from public.members where auth_user_id = auth.uid())) then
    raise exception 'not_authorized';
  end if;
  delete from public.aufgieser_absences where id = p_id;
  -- Rematerialisierung wird vom Cron / approve_recurring_slot beim nächsten
  -- Lauf wieder durchgeführt; alternativ manuell.
end;
$$;

revoke all on function public.delete_absence(uuid) from public;
grant execute on function public.delete_absence(uuid) to authenticated;

comment on function public.add_absence(date, date, text) is
  'Aufgießer trägt Urlaubs-Range ein. Setzt betroffene Stamm-Aufgüsse auf Personal-Fallback. Returnt JSON mit freed_slots-Array.';
