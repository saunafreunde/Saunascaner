-- ─── 0053: Telegram-Bot-Optimierungen ───────────────────────────────────
-- 1) Quick-Rating per Telegram (Inline 1-5 Stars)
-- 2) "Ich komme heute"-Inline-Action via Telegram
-- 3) PIN-Lookup für /pin Command
-- 4) Tracking welche Rating-Pushes schon raus sind
-- 5) Announce-Threshold von 2h auf 90 Min (Parameter umgestellt auf Minuten)

-- ─── Tabelle für gesendete Rating-Pushes (verhindert Doppel-Sends) ───────
create table if not exists public.telegram_rating_pushes (
  member_id   uuid not null references public.members(id) on delete cascade,
  infusion_id uuid not null references public.infusions(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (member_id, infusion_id)
);
alter table public.telegram_rating_pushes enable row level security;
drop policy if exists trp_admin on public.telegram_rating_pushes;
create policy trp_admin on public.telegram_rating_pushes
  for all to authenticated using (public.is_admin());

-- ─── Inline-"Ich komme heute" via Telegram-Bot ───────────────────────────
create or replace function public.telegram_announce_attendance(
  p_telegram_user_id bigint,
  p_infusion_id uuid
) returns table (member_id uuid, member_name text, infusion_title text, start_time timestamptz)
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_name text; v_start timestamptz; v_title text;
begin
  select id, name into v_me, v_name from public.members where telegram_user_id = p_telegram_user_id;
  if v_me is null then raise exception 'telegram_not_linked'; end if;
  select start_time, title into v_start, v_title from public.infusions where id = p_infusion_id;
  if v_start is null then raise exception 'infusion_not_found'; end if;
  if v_start <= now() then raise exception 'infusion_already_started'; end if;
  insert into public.infusion_announcements (infusion_id, member_id)
    values (p_infusion_id, v_me)
    on conflict (infusion_id, member_id) do update set announced_at = now();
  return query select v_me, v_name, v_title, v_start;
end$$;
revoke all on function public.telegram_announce_attendance(bigint, uuid) from public;
grant execute on function public.telegram_announce_attendance(bigint, uuid) to authenticated;

-- ─── Inline-Quick-Rating via Telegram-Bot (alle 6 Kategorien gleich) ─────
create or replace function public.telegram_quick_rate(
  p_telegram_user_id bigint,
  p_infusion_id uuid,
  p_stars int
) returns table (member_id uuid, infusion_title text)
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_meister uuid; v_end timestamptz; v_title text;
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'stars_out_of_range'; end if;
  select id into v_me from public.members where telegram_user_id = p_telegram_user_id;
  if v_me is null then raise exception 'telegram_not_linked'; end if;
  select saunameister_id, end_time, title into v_meister, v_end, v_title
    from public.infusions where id = p_infusion_id;
  if v_meister is null then raise exception 'infusion_not_found'; end if;
  if v_meister = v_me then raise exception 'self_rating_not_allowed'; end if;
  if v_end > now() then raise exception 'infusion_not_finished'; end if;
  if v_end + interval '3 hours' < now() then raise exception 'rating_window_expired'; end if;
  insert into public.infusion_ratings (
    infusion_id, member_id, chemie, luftbewegung, wedeltechnik, hitzeniveau, musik, duftentwicklung
  ) values (
    p_infusion_id, v_me, p_stars, p_stars, p_stars, p_stars, p_stars, p_stars
  )
  on conflict (infusion_id, member_id) do update set
    chemie = excluded.chemie,
    luftbewegung = excluded.luftbewegung,
    wedeltechnik = excluded.wedeltechnik,
    hitzeniveau = excluded.hitzeniveau,
    musik = excluded.musik,
    duftentwicklung = excluded.duftentwicklung;
  return query select v_me, v_title;
end$$;
revoke all on function public.telegram_quick_rate(bigint, uuid, int) from public;
grant execute on function public.telegram_quick_rate(bigint, uuid, int) to authenticated;

-- ─── PIN-Lookup für /pin Command ─────────────────────────────────────────
create or replace function public.get_my_checkin_pin_by_telegram(p_telegram_user_id bigint)
returns table (pin char(4), name text)
language sql stable security definer set search_path = public, auth as $$
  select checkin_pin, name
    from public.members
   where telegram_user_id = p_telegram_user_id;
$$;
revoke all on function public.get_my_checkin_pin_by_telegram(bigint) from public;
grant execute on function public.get_my_checkin_pin_by_telegram(bigint) to authenticated;

-- ─── Pending Rating-Pushes für Telegram-Bot ──────────────────────────────
create or replace function public.get_pending_telegram_rating_pushes()
returns table (
  member_id uuid, telegram_user_id bigint, member_name text,
  infusion_id uuid, infusion_title text, meister_name text, end_time timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.telegram_user_id, m.name,
         i.id, i.title,
         coalesce(a.name, 'Personal') as meister_name,
         i.end_time
    from public.infusions i
    join public.infusion_attendances att on att.infusion_id = i.id
    join public.members m on m.id = att.member_id
    left join public.members a on a.id = i.saunameister_id
   where i.end_time between (now() - interval '30 minutes') and (now() - interval '15 minutes')
     and m.telegram_user_id is not null
     and m.id <> coalesce(i.saunameister_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and not exists (
       select 1 from public.infusion_ratings r
        where r.infusion_id = i.id and r.member_id = m.id
     )
     and not exists (
       select 1 from public.telegram_rating_pushes p
        where p.infusion_id = i.id and p.member_id = m.id
     );
$$;
revoke all on function public.get_pending_telegram_rating_pushes() from public;
grant execute on function public.get_pending_telegram_rating_pushes() to authenticated;

create or replace function public.mark_telegram_rating_pushed(
  p_member_id uuid, p_infusion_id uuid
) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.telegram_rating_pushes (member_id, infusion_id)
    values (p_member_id, p_infusion_id)
    on conflict do nothing;
end$$;
revoke all on function public.mark_telegram_rating_pushed(uuid, uuid) from public;
grant execute on function public.mark_telegram_rating_pushed(uuid, uuid) to authenticated;

-- ─── Announce-Threshold: 2h → 90 Min, Parameter auf Minuten umgestellt ──
drop function if exists public.get_personal_fallbacks_to_announce(integer);
create or replace function public.get_personal_fallbacks_to_announce(p_minutes int default 90)
returns table (infusion_id uuid, sauna_name text, sauna_accent text, start_time timestamptz, temperature_c smallint)
language sql stable security definer set search_path = public as $$
  select i.id, s.name, s.accent_color, i.start_time, i.temperature_c
    from public.infusions i
    join public.saunas s on s.id = i.sauna_id
   where i.is_personal_fallback = true
     and i.start_time between now() and now() + (p_minutes || ' minutes')::interval
     and i.telegram_takeover_announced_at is null
   order by i.start_time;
$$;
revoke all on function public.get_personal_fallbacks_to_announce(int) from public;
grant execute on function public.get_personal_fallbacks_to_announce(int) to authenticated;

-- ─── Cron für Rating-Pushes (alle 5 Min) ─────────────────────────────────
do $$ begin
  perform cron.unschedule('telegram-rating-pushes-5min');
exception when others then null;
end$$;

select cron.schedule(
  'telegram-rating-pushes-5min',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://saunascaner.vercel.app/api/telegram-webhook?rating_push=1',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 30000
  );
  $job$
);
