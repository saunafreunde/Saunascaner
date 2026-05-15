-- ─── Migration 0060: Schicht-Absage + Tausch zwischen Mitarbeitern ───────
-- A) cancel_my_shift: Mitarbeiter sagt eigene Schicht ab → alle staff
--    bekommen Broadcast-Notification, Schicht ist offen für Übernahme
-- B) take_open_shift: anderer Mitarbeiter übernimmt eine abgesagte Schicht
-- C) shift_swap_requests: direkter Tausch zwischen 2 Mitarbeitern
--    - A bietet B seinen Slot (optional gegen B's Slot)
--    - B akzeptiert → Schichten getauscht + CP bekommt Notification
--
-- notification_queue (existierende Tabelle aus früheren Migrationen) hat:
--   id, kind, payload(jsonb), dedup_key, recipient_id, created_at,
--   processed_at, error
-- → wir packen title + body + custom data in payload

-- ─── A) RPC: eigene Schicht absagen ───────────────────────────────────────
create or replace function public.cancel_my_shift(
  p_shift_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_me_name text;
  v_shift public.personal_shifts%rowtype;
  v_staff_id uuid;
  v_body text;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select * into v_shift from public.personal_shifts where id = p_shift_id;
  if v_shift.id is null then raise exception 'shift_not_found'; end if;
  if v_shift.cancelled_at is not null then raise exception 'shift_already_cancelled'; end if;

  -- Erlaubt: Mitarbeiter selbst, CP, Admin
  if v_shift.staff_member_id <> v_me
     and not public.is_personal_planer()
     and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  update public.personal_shifts
     set cancelled_at        = now(),
         cancelled_by        = v_me,
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_shift_id;

  v_body := v_me_name || ' hat eine Personal-Schicht abgesagt: ' ||
            to_char(v_shift.shift_date, 'DD.MM.') || ' ' ||
            to_char(v_shift.start_time, 'HH24:MI') || '–' ||
            to_char(v_shift.end_time, 'HH24:MI') ||
            '. Wer kann übernehmen?';

  -- Broadcast an alle anderen staff-Mitglieder
  for v_staff_id in
    select id from public.members
     where role = 'staff'
       and id <> v_shift.staff_member_id
       and revoked_at is null
  loop
    insert into public.notification_queue(
      kind, recipient_id, payload, dedup_key
    ) values (
      'shift_cancelled_broadcast',
      v_staff_id,
      jsonb_build_object(
        'title', 'Schicht-Absage: Wer hat Zeit?',
        'body', v_body,
        'shift_id', v_shift.id,
        'shift_date', v_shift.shift_date,
        'start_time', v_shift.start_time::text,
        'end_time', v_shift.end_time::text,
        'cancelled_by', v_me,
        'cancelled_by_name', v_me_name
      ),
      'shift_cancel:' || v_shift.id::text || ':' || v_staff_id::text
    )
    on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.cancel_my_shift(uuid, text) from public;
grant execute on function public.cancel_my_shift(uuid, text) to authenticated;

-- ─── B) RPC: abgesagte Schicht übernehmen ─────────────────────────────────
create or replace function public.take_open_shift(p_shift_id uuid)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_me_name text;
  v_role text;
  v_shift public.personal_shifts%rowtype;
  v_new_id uuid;
begin
  select id, name, role into v_me, v_me_name, v_role
    from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  if v_role <> 'staff' then raise exception 'only_staff_can_take'; end if;

  select * into v_shift from public.personal_shifts
   where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'shift_not_found'; end if;
  if v_shift.cancelled_at is null then raise exception 'shift_not_cancelled'; end if;

  -- Neue Schicht für mich anlegen mit gleichen Zeiten
  insert into public.personal_shifts
    (staff_member_id, shift_date, start_time, end_time, notes, created_by)
  values (v_me, v_shift.shift_date, v_shift.start_time, v_shift.end_time,
          'Übernommen von ' || (select name from public.members where id = v_shift.staff_member_id),
          v_me)
  returning id into v_new_id;

  -- Original-Absage als "übernommen" markieren
  update public.personal_shifts
     set cancellation_reason = trim(both ' ' from coalesce(cancellation_reason, '') ||
                                    ' · übernommen von ' || v_me_name)
   where id = v_shift.id;

  -- CP-Verantwortliche benachrichtigen
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select 'shift_cancellation_taken', m.id,
         jsonb_build_object(
           'title', 'Absage übernommen',
           'body', v_me_name || ' übernimmt die abgesagte Schicht.',
           'shift_id', v_new_id,
           'original_shift_id', v_shift.id
         ),
         'shift_take:' || v_new_id::text || ':' || m.id::text
    from public.members m
   where (m.is_personal_planer = true or m.role = 'admin')
     and m.revoked_at is null
  on conflict do nothing;

  return v_new_id;
end;
$$;
revoke all on function public.take_open_shift(uuid) from public;
grant execute on function public.take_open_shift(uuid) to authenticated;

-- ─── B.1) RPC: offene Absagen listen (abgesagt, noch nicht übernommen) ────
create or replace function public.list_open_cancellations()
returns table (
  shift_id uuid,
  original_member_id uuid,
  original_member_name text,
  shift_date date,
  start_time time,
  end_time time,
  cancelled_at timestamptz,
  cancellation_reason text
)
language sql stable security definer set search_path = public, auth
as $$
  select s.id, s.staff_member_id, m.name,
         s.shift_date, s.start_time, s.end_time,
         s.cancelled_at, s.cancellation_reason
    from public.personal_shifts s
    join public.members m on m.id = s.staff_member_id
   where s.cancelled_at is not null
     and s.shift_date >= current_date
     -- Nur wenn KEINE Übernahme-Schicht für diesen Slot existiert
     and not exists (
       select 1 from public.personal_shifts s2
        where s2.shift_date    = s.shift_date
          and s2.start_time    = s.start_time
          and s2.end_time      = s.end_time
          and s2.cancelled_at is null
          and s2.staff_member_id <> s.staff_member_id
     )
   order by s.shift_date asc, s.start_time asc;
$$;
revoke all on function public.list_open_cancellations() from public;
grant execute on function public.list_open_cancellations() to authenticated;

-- ─── C) Schicht-Tausch-Anfragen-Tabelle ───────────────────────────────────
create table if not exists public.shift_swap_requests (
  id              uuid primary key default gen_random_uuid(),
  shift_id        uuid not null references public.personal_shifts(id) on delete cascade,
  requested_by    uuid not null references public.members(id) on delete cascade,
  requested_to    uuid not null references public.members(id) on delete cascade,
  offered_shift_id uuid references public.personal_shifts(id) on delete set null,
  message         text,
  status          text not null default 'pending'
                  check (status in ('pending','accepted','rejected','cancelled')),
  decided_at      timestamptz,
  cp_notified_at  timestamptz,
  created_at      timestamptz not null default now(),
  check (requested_by <> requested_to)
);

create index if not exists idx_swap_requests_shift on public.shift_swap_requests(shift_id);
create index if not exists idx_swap_requests_to    on public.shift_swap_requests(requested_to, status);
create index if not exists idx_swap_requests_by    on public.shift_swap_requests(requested_by, status);

alter table public.shift_swap_requests enable row level security;

drop policy if exists swap_requests_participants_read on public.shift_swap_requests;
create policy swap_requests_participants_read on public.shift_swap_requests
  for select to authenticated
  using (
    requested_by in (select id from public.members where auth_user_id = auth.uid())
    or requested_to in (select id from public.members where auth_user_id = auth.uid())
    or public.is_personal_planer() or public.is_admin()
  );

drop policy if exists swap_requests_creator_insert on public.shift_swap_requests;
create policy swap_requests_creator_insert on public.shift_swap_requests
  for insert to authenticated
  with check (requested_by in (select id from public.members where auth_user_id = auth.uid()));

drop policy if exists swap_requests_target_update on public.shift_swap_requests;
create policy swap_requests_target_update on public.shift_swap_requests
  for update to authenticated
  using (
    requested_to in (select id from public.members where auth_user_id = auth.uid())
    or requested_by in (select id from public.members where auth_user_id = auth.uid())
    or public.is_personal_planer() or public.is_admin()
  );

-- ─── C.1) RPC: Tausch anfragen ────────────────────────────────────────────
create or replace function public.request_shift_swap(
  p_shift_id uuid,
  p_to_member_id uuid,
  p_offered_shift_id uuid default null,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_me_name text;
  v_shift_owner uuid;
  v_id uuid;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select staff_member_id into v_shift_owner from public.personal_shifts where id = p_shift_id;
  if v_shift_owner is null then raise exception 'shift_not_found'; end if;
  if v_shift_owner <> v_me then raise exception 'not_my_shift'; end if;
  if v_me = p_to_member_id then raise exception 'cannot_swap_with_self'; end if;

  insert into public.shift_swap_requests
    (shift_id, requested_by, requested_to, offered_shift_id, message)
  values
    (p_shift_id, v_me, p_to_member_id, p_offered_shift_id,
     nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_id;

  -- Notification an Empfänger
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  values (
    'shift_swap_requested',
    p_to_member_id,
    jsonb_build_object(
      'title', 'Tausch-Anfrage erhalten',
      'body', v_me_name || ' möchte eine Schicht mit dir tauschen.',
      'swap_id', v_id,
      'shift_id', p_shift_id,
      'requested_by', v_me,
      'requested_by_name', v_me_name
    ),
    'swap_req:' || v_id::text
  )
  on conflict do nothing;
  return v_id;
end;
$$;
revoke all on function public.request_shift_swap(uuid, uuid, uuid, text) from public;
grant execute on function public.request_shift_swap(uuid, uuid, uuid, text) to authenticated;

-- ─── C.2) RPC: Tausch annehmen → Schichten tauschen + CP-Notification ─────
create or replace function public.accept_shift_swap(p_swap_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_me_name text;
  v_swap public.shift_swap_requests%rowtype;
  v_from_name text;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select * into v_swap from public.shift_swap_requests where id = p_swap_id for update;
  if v_swap.id is null then raise exception 'swap_not_found'; end if;
  if v_swap.requested_to <> v_me then raise exception 'not_my_swap'; end if;
  if v_swap.status <> 'pending' then raise exception 'swap_not_pending'; end if;

  -- Schicht auf Empfänger umstellen
  update public.personal_shifts
     set staff_member_id = v_me
   where id = v_swap.shift_id;

  -- Wenn Gegenseiten-Schicht angeboten: auf Anfrager umstellen
  if v_swap.offered_shift_id is not null then
    update public.personal_shifts
       set staff_member_id = v_swap.requested_by
     where id = v_swap.offered_shift_id;
  end if;

  update public.shift_swap_requests
     set status = 'accepted',
         decided_at = now(),
         cp_notified_at = now()
   where id = p_swap_id;

  select name into v_from_name from public.members where id = v_swap.requested_by;

  -- Notification an Anfrager (Tausch akzeptiert)
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  values (
    'shift_swap_accepted',
    v_swap.requested_by,
    jsonb_build_object(
      'title', 'Tausch akzeptiert ✓',
      'body', v_me_name || ' hat deine Tausch-Anfrage akzeptiert.',
      'swap_id', p_swap_id
    ),
    'swap_accept_req:' || p_swap_id::text
  )
  on conflict do nothing;

  -- CP-Verantwortliche + Admin benachrichtigen
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select 'shift_swap_notified_cp',
         m.id,
         jsonb_build_object(
           'title', 'Schicht-Tausch durchgeführt',
           'body', v_from_name || ' ↔ ' || v_me_name || ' haben getauscht.',
           'swap_id', p_swap_id
         ),
         'swap_cp:' || p_swap_id::text || ':' || m.id::text
    from public.members m
   where (m.is_personal_planer = true or m.role = 'admin')
     and m.revoked_at is null
  on conflict do nothing;
end;
$$;
revoke all on function public.accept_shift_swap(uuid) from public;
grant execute on function public.accept_shift_swap(uuid) to authenticated;

-- ─── C.3) RPC: Tausch ablehnen / abbrechen ────────────────────────────────
create or replace function public.reject_shift_swap(p_swap_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_me uuid;
  v_me_name text;
  v_swap public.shift_swap_requests%rowtype;
  v_target uuid;
  v_new_status text;
begin
  select id, name into v_me, v_me_name from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select * into v_swap from public.shift_swap_requests where id = p_swap_id;
  if v_swap.id is null then raise exception 'swap_not_found'; end if;
  if v_swap.requested_to <> v_me and v_swap.requested_by <> v_me then
    raise exception 'not_my_swap';
  end if;
  if v_swap.status <> 'pending' then raise exception 'swap_not_pending'; end if;

  if v_me = v_swap.requested_to then
    v_new_status := 'rejected';
    v_target := v_swap.requested_by;
  else
    v_new_status := 'cancelled';
    v_target := v_swap.requested_to;
  end if;

  update public.shift_swap_requests
     set status = v_new_status,
         decided_at = now()
   where id = p_swap_id;

  -- Notification an Gegenseite
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  values (
    'shift_swap_' || v_new_status,
    v_target,
    jsonb_build_object(
      'title', case when v_new_status = 'rejected' then 'Tausch abgelehnt' else 'Tausch zurückgezogen' end,
      'body', v_me_name ||
              case when v_new_status = 'rejected' then ' hat deine Tausch-Anfrage abgelehnt.'
                   else ' hat seine Tausch-Anfrage zurückgezogen.' end,
      'swap_id', p_swap_id
    ),
    'swap_' || v_new_status || ':' || p_swap_id::text
  )
  on conflict do nothing;
end;
$$;
revoke all on function public.reject_shift_swap(uuid) from public;
grant execute on function public.reject_shift_swap(uuid) to authenticated;

-- ─── C.4) RPC: meine Tausch-Anfragen listen (eingehend + ausgehend) ───────
create or replace function public.list_my_swap_requests()
returns table (
  id uuid,
  direction text,                  -- 'incoming' | 'outgoing'
  status text,
  shift_id uuid,
  shift_date date,
  shift_start time,
  shift_end time,
  offered_shift_id uuid,
  offered_date date,
  offered_start time,
  offered_end time,
  other_member_id uuid,
  other_member_name text,
  message text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  with me as (select id from public.members where auth_user_id = auth.uid())
  select
    r.id,
    case when r.requested_by = (select id from me) then 'outgoing' else 'incoming' end,
    r.status,
    r.shift_id,
    s1.shift_date, s1.start_time, s1.end_time,
    r.offered_shift_id,
    s2.shift_date, s2.start_time, s2.end_time,
    case when r.requested_by = (select id from me) then r.requested_to else r.requested_by end,
    case when r.requested_by = (select id from me)
         then (select name from public.members where id = r.requested_to)
         else (select name from public.members where id = r.requested_by) end,
    r.message,
    r.created_at
  from public.shift_swap_requests r
  join public.personal_shifts s1 on s1.id = r.shift_id
  left join public.personal_shifts s2 on s2.id = r.offered_shift_id
  where r.requested_by = (select id from me)
     or r.requested_to = (select id from me)
  order by r.created_at desc;
$$;
revoke all on function public.list_my_swap_requests() from public;
grant execute on function public.list_my_swap_requests() to authenticated;

-- ─── D) RPC: pending notifications für mich (App-Inbox) ───────────────────
create or replace function public.list_my_pending_notifications()
returns table (
  id uuid,
  kind text,
  payload jsonb,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select n.id, n.kind, n.payload, n.created_at
    from public.notification_queue n
    join public.members m on m.id = n.recipient_id
   where m.auth_user_id = auth.uid()
     and (n.processed_at is null or n.created_at > now() - interval '7 days')
   order by n.created_at desc
   limit 50;
$$;
revoke all on function public.list_my_pending_notifications() from public;
grant execute on function public.list_my_pending_notifications() to authenticated;

-- ─── D.1) RPC: Notification als gesehen markieren ─────────────────────────
create or replace function public.mark_notification_seen(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  update public.notification_queue
     set processed_at = coalesce(processed_at, now())
   where id = p_id
     and recipient_id in (select id from public.members where auth_user_id = auth.uid());
end;
$$;
revoke all on function public.mark_notification_seen(uuid) from public;
grant execute on function public.mark_notification_seen(uuid) to authenticated;
