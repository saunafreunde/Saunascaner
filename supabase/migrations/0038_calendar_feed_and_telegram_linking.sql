-- ─── Migration 0038: iCal-Feed-Token + Telegram-Linking ───
-- Christoph (11.05.2026 nacht):
-- - iCal-Feed: Aufgießer abonniert eigene Aufgüsse in Apple/Google Calendar.
--   Token-basierte URL (iCal-Clients können keine Bearer-Header).
-- - Telegram-Linking: Bot-Account mit Saunafreunde-Member verknüpfen, damit
--   Inline-Button-Klick „Ich übernehme!" einen Personal-Fallback an den
--   richtigen Member zuordnet.

-- ─── 1. members-Spalten ──────────────────────────────────────────────────
alter table public.members
  add column if not exists calendar_feed_token uuid default gen_random_uuid(),
  add column if not exists telegram_user_id    bigint,
  add column if not exists telegram_link_token uuid;

create unique index if not exists members_calendar_feed_token_idx
  on public.members(calendar_feed_token) where calendar_feed_token is not null;

create unique index if not exists members_telegram_user_id_idx
  on public.members(telegram_user_id) where telegram_user_id is not null;

-- ─── 2. RPC: rotate_my_calendar_token ────────────────────────────────────
create or replace function public.rotate_my_calendar_token()
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new uuid := gen_random_uuid();
begin
  update public.members
     set calendar_feed_token = v_new
   where auth_user_id = auth.uid()
   returning calendar_feed_token into v_new;
  if not found then raise exception 'member_not_found'; end if;
  return v_new;
end;
$$;
revoke all on function public.rotate_my_calendar_token() from public;
grant execute on function public.rotate_my_calendar_token() to authenticated;

-- ─── 3. RPC: get_calendar_member_by_token (service_role-only) ────────────
-- Wird von /api/calendar.ics genutzt um Member über Token zu finden.
create or replace function public.get_calendar_member_by_token(p_token uuid)
returns table(member_id uuid, member_name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.members
   where calendar_feed_token = p_token
     and approved = true
     and revoked_at is null
   limit 1;
$$;
revoke all on function public.get_calendar_member_by_token(uuid) from public;
revoke all on function public.get_calendar_member_by_token(uuid) from anon, authenticated;
grant execute on function public.get_calendar_member_by_token(uuid) to service_role;

-- ─── 4. RPC: get_member_calendar_events (service_role-only) ──────────────
-- Liefert alle künftigen Aufgüsse des Members (eigene + Co-Aufgießer +
-- Stamm-Slots). Verwendet vom /api/calendar.ics Endpoint.
create or replace function public.get_member_calendar_events(p_member_id uuid)
returns table(
  id uuid, sauna_name text, sauna_temp text, title text, description text,
  start_time timestamptz, end_time timestamptz,
  team_infusion boolean, is_co_aufgieser boolean, is_personal_fallback boolean
)
language sql stable security definer set search_path = public as $$
  select i.id, s.name, s.temperature_label, i.title, i.description,
         i.start_time, i.end_time,
         i.team_infusion,
         (i.saunameister_id is distinct from p_member_id and
          exists(select 1 from public.infusion_co_aufgieser c
                  where c.infusion_id = i.id and c.member_id = p_member_id)) as is_co_aufgieser,
         i.is_personal_fallback
    from public.infusions i
    join public.saunas s on s.id = i.sauna_id
   where i.end_time > now() - interval '7 days'
     and (
       i.saunameister_id = p_member_id
       or exists(select 1 from public.infusion_co_aufgieser c
                  where c.infusion_id = i.id and c.member_id = p_member_id)
     )
   order by i.start_time;
$$;
revoke all on function public.get_member_calendar_events(uuid) from public;
revoke all on function public.get_member_calendar_events(uuid) from anon, authenticated;
grant execute on function public.get_member_calendar_events(uuid) to service_role;

-- ─── 5. RPC: my_calendar_token ───────────────────────────────────────────
-- Frontend holt seinen aktuellen Token zum Anzeigen der Abo-URL.
create or replace function public.my_calendar_token()
returns uuid
language sql stable security definer set search_path = public, auth as $$
  select calendar_feed_token from public.members where auth_user_id = auth.uid();
$$;
revoke all on function public.my_calendar_token() from public;
grant execute on function public.my_calendar_token() to authenticated;

-- ─── 6. Telegram-Linking RPCs ────────────────────────────────────────────
-- generate_my_telegram_link_token: erzeugt einen einmaligen Token, den der
-- User über /start <token> beim Bot einreicht. Bot ruft dann
-- claim_telegram_link auf (service_role) um Verknüpfung herzustellen.
create or replace function public.generate_my_telegram_link_token()
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_token uuid := gen_random_uuid();
begin
  update public.members
     set telegram_link_token = v_token
   where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
  return v_token;
end;
$$;
revoke all on function public.generate_my_telegram_link_token() from public;
grant execute on function public.generate_my_telegram_link_token() to authenticated;

create or replace function public.claim_telegram_link(p_token uuid, p_telegram_user_id bigint)
returns table(member_id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare
  v_member_id uuid;
begin
  -- Token aufbrauchen + telegram_user_id setzen
  update public.members
     set telegram_user_id    = p_telegram_user_id,
         telegram_link_token = null
   where telegram_link_token = p_token
   returning id into v_member_id;
  if not found then raise exception 'invalid_or_expired_token'; end if;
  return query select m.id, m.name from public.members m where m.id = v_member_id;
end;
$$;
revoke all on function public.claim_telegram_link(uuid, bigint) from public;
revoke all on function public.claim_telegram_link(uuid, bigint) from anon, authenticated;
grant execute on function public.claim_telegram_link(uuid, bigint) to service_role;

-- ─── 7. RPC: unlink_my_telegram ─────────────────────────────────────────
create or replace function public.unlink_my_telegram()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  update public.members
     set telegram_user_id    = null,
         telegram_link_token = null
   where auth_user_id = auth.uid();
end;
$$;
revoke all on function public.unlink_my_telegram() from public;
grant execute on function public.unlink_my_telegram() to authenticated;

-- ─── 8. RPC: takeover_personal_fallback_by_telegram (service_role) ──────
-- Vom Telegram-Webhook aufgerufen wenn jemand auf den „Ich übernehme!"-
-- Button klickt. Übernimmt Personal-Fallback im Namen des verknüpften
-- Members.
create or replace function public.takeover_personal_fallback_by_telegram(
  p_telegram_user_id bigint,
  p_infusion_id      uuid
) returns table(member_id uuid, member_name text, infusion_title text)
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members%rowtype;
  v_inf    public.infusions%rowtype;
  v_allowed boolean;
begin
  select * into v_member from public.members where telegram_user_id = p_telegram_user_id;
  if not found then raise exception 'telegram_not_linked'; end if;
  v_allowed := v_member.is_aufgieser or v_member.role in ('guest_aufgieser','staff','admin');
  if not v_allowed then raise exception 'not_authorized'; end if;

  select * into v_inf from public.infusions where id = p_infusion_id;
  if not found then raise exception 'infusion_not_found'; end if;
  if not v_inf.is_personal_fallback then raise exception 'already_taken'; end if;
  if v_inf.end_time <= now() then raise exception 'slot_in_past'; end if;

  update public.infusions
     set saunameister_id      = v_member.id,
         is_personal_fallback = false,
         title                = 'Übernahme von ' || v_member.name
   where id = p_infusion_id;

  return query select v_member.id, v_member.name, v_inf.title;
end;
$$;
revoke all on function public.takeover_personal_fallback_by_telegram(bigint, uuid) from public;
revoke all on function public.takeover_personal_fallback_by_telegram(bigint, uuid) from anon, authenticated;
grant execute on function public.takeover_personal_fallback_by_telegram(bigint, uuid) to service_role;

-- ─── 9. RPC: get_takeover_candidates_for_telegram (für Cron-Reminder) ───
-- Liefert Personal-Fallbacks die in den nächsten N Stunden starten und
-- noch nicht in Telegram-Channel angekündigt wurden.
alter table public.infusions
  add column if not exists telegram_takeover_announced_at timestamptz;

create or replace function public.get_personal_fallbacks_to_announce(p_hours int default 2)
returns table(
  infusion_id uuid, sauna_name text, sauna_accent text,
  start_time timestamptz, temperature_c smallint
)
language sql stable security definer set search_path = public as $$
  select i.id, s.name, s.accent_color, i.start_time, i.temperature_c
    from public.infusions i
    join public.saunas s on s.id = i.sauna_id
   where i.is_personal_fallback = true
     and i.start_time between now() and now() + (p_hours || ' hours')::interval
     and i.telegram_takeover_announced_at is null
   order by i.start_time;
$$;
revoke all on function public.get_personal_fallbacks_to_announce(int) from public;
revoke all on function public.get_personal_fallbacks_to_announce(int) from anon, authenticated;
grant execute on function public.get_personal_fallbacks_to_announce(int) to service_role;

create or replace function public.mark_telegram_announced(p_infusion_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.infusions set telegram_takeover_announced_at = now() where id = p_infusion_id;
$$;
revoke all on function public.mark_telegram_announced(uuid) from public;
grant execute on function public.mark_telegram_announced(uuid) to service_role;

comment on column public.members.calendar_feed_token is
  'Token für iCal-Feed-URL (/api/calendar.ics?token=...). Rotierbar via rotate_my_calendar_token().';
comment on column public.members.telegram_user_id is
  'Verknüpfter Telegram-User-ID. Erlaubt Bot-Callback-Aktionen (z.B. Slot-Übernahme).';
