-- ─── Migration 0045: Gäste-Stats + Auszeichnungen ─────────────────────────
-- Tabelle infusion_attendances (welcher Member war bei welchem Aufguss anwesend).
-- 5 Trigger für automatische Badge-Vergabe basierend auf Attendance/Rating/Follow.
-- Stats-RPC get_member_stats_full für Gast-Dashboard.
-- Backfill für Bestand: bestehende Aktivität nachträglich belohnen.

-- ─── 1. infusion_attendances ──────────────────────────────────────────────
create table if not exists public.infusion_attendances (
  member_id   uuid not null references public.members(id) on delete cascade,
  infusion_id uuid not null references public.infusions(id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  primary key (member_id, infusion_id)
);
create index if not exists idx_attendances_member on public.infusion_attendances(member_id);
create index if not exists idx_attendances_infusion on public.infusion_attendances(infusion_id);

alter table public.infusion_attendances enable row level security;

drop policy if exists attendances_read on public.infusion_attendances;
create policy attendances_read on public.infusion_attendances
  for select to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Writes ausschließlich via Trigger (kein direkter Insert)
drop policy if exists attendances_no_direct_insert on public.infusion_attendances;
create policy attendances_no_direct_insert on public.infusion_attendances
  for insert with check (false);

-- ─── 2. Helper: Badge nur einmal vergeben (idempotent) ────────────────────
create or replace function public.award_badge_if_not_exists(
  p_member_id uuid, p_badge_id text, p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_was_new boolean;
begin
  begin
    insert into public.member_achievements(member_id, badge_id, metadata)
      values (p_member_id, p_badge_id, p_metadata);
    v_was_new := true;
  exception when unique_violation then
    v_was_new := false;
  end;
  return v_was_new;
end$$;
revoke all on function public.award_badge_if_not_exists(uuid, text, jsonb) from public;
-- nur Service-Role / DEFINER-Aufrufe — kein Frontend-Zugriff

-- ─── 3. Trigger: Scanner-Toggle → infusion_attendances ────────────────────
create or replace function public.log_infusion_attendance_on_scan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_inf record;
begin
  for v_inf in
    select id from public.infusions
     where coalesce(new.last_scan_at, now()) between start_time and end_time + interval '15 minutes'
       and coalesce(is_personal_fallback, false) = false
       and (saunameister_id is null or saunameister_id <> new.id)
  loop
    insert into public.infusion_attendances(member_id, infusion_id, scanned_at)
      values (new.id, v_inf.id, coalesce(new.last_scan_at, now()))
      on conflict do nothing;
  end loop;
  return new;
end$$;

drop trigger if exists trg_log_infusion_attendance on public.members;
create trigger trg_log_infusion_attendance
  after update of is_present on public.members
  for each row
  when (new.is_present = true and (old.is_present = false or old.is_present is null))
  execute function public.log_infusion_attendance_on_scan();

-- ─── 4a. Trigger: Anwesenheits-Badges ─────────────────────────────────────
create or replace function public.check_attendance_achievements() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_streak int;
  v_birthday date;
  v_today date := new.date;
  v_winter_count int;
  v_summer_count int;
begin
  select count(*) into v_total from public.attendance_events where member_id = new.member_id;
  if v_total = 1   then perform public.award_badge_if_not_exists(new.member_id, 'first_sauna_day'); end if;
  if v_total = 5   then perform public.award_badge_if_not_exists(new.member_id, 'regular_5'); end if;
  if v_total = 15  then perform public.award_badge_if_not_exists(new.member_id, 'regular_15'); end if;
  if v_total = 30  then perform public.award_badge_if_not_exists(new.member_id, 'regular_30'); end if;
  if v_total = 60  then perform public.award_badge_if_not_exists(new.member_id, 'regular_60'); end if;

  select public.get_attendance_streak_weeks(new.member_id) into v_streak;
  if v_streak >= 4  then perform public.award_badge_if_not_exists(new.member_id, 'streak_4w'); end if;
  if v_streak >= 12 then perform public.award_badge_if_not_exists(new.member_id, 'streak_12w'); end if;
  if v_streak >= 24 then perform public.award_badge_if_not_exists(new.member_id, 'streak_24w'); end if;

  select birthday into v_birthday from public.members where id = new.member_id;
  if v_birthday is not null
     and extract(month from v_birthday) = extract(month from v_today)
     and extract(day from v_birthday) = extract(day from v_today)
  then perform public.award_badge_if_not_exists(new.member_id, 'birthday_visitor'); end if;

  if extract(month from v_today) in (12, 1, 2) then
    select count(*) into v_winter_count from public.attendance_events
     where member_id = new.member_id and extract(month from date) in (12, 1, 2);
    if v_winter_count >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'winter_guest'); end if;
  end if;

  if extract(month from v_today) in (6, 7, 8) then
    select count(*) into v_summer_count from public.attendance_events
     where member_id = new.member_id and extract(month from date) in (6, 7, 8);
    if v_summer_count >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'summer_guest'); end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_check_attendance_achievements on public.attendance_events;
create trigger trg_check_attendance_achievements
  after insert on public.attendance_events
  for each row execute function public.check_attendance_achievements();

-- ─── 4b. Trigger: Bewertungs-Badges + Entdeckung + Adlerauge ──────────────
create or replace function public.check_rating_achievements() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_distinct_meister int;
  v_distinct_saunas int;
  v_infusion_date date;
  v_rated_date date := new.created_at::date;
  v_same_day int;
begin
  select count(*) into v_count from public.infusion_ratings where member_id = new.member_id;
  if v_count = 1   then perform public.award_badge_if_not_exists(new.member_id, 'first_rating'); end if;
  if v_count = 10  then perform public.award_badge_if_not_exists(new.member_id, 'feedback_giver'); end if;
  if v_count = 50  then perform public.award_badge_if_not_exists(new.member_id, 'feedback_pro'); end if;
  if v_count = 100 then perform public.award_badge_if_not_exists(new.member_id, 'feedback_top'); end if;

  select count(distinct i.saunameister_id)
    into v_distinct_meister
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where r.member_id = new.member_id and i.saunameister_id is not null;
  if v_distinct_meister >= 3  then perform public.award_badge_if_not_exists(new.member_id, 'curious'); end if;
  if v_distinct_meister >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'vielsauner'); end if;
  if v_distinct_meister >= 25 then perform public.award_badge_if_not_exists(new.member_id, 'connaisseur'); end if;

  select count(distinct i.sauna_id)
    into v_distinct_saunas
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where r.member_id = new.member_id;
  if v_distinct_saunas >= 3 then perform public.award_badge_if_not_exists(new.member_id, 'sauna_allrounder'); end if;

  select i.start_time::date into v_infusion_date
    from public.infusions i where i.id = new.infusion_id;
  if v_infusion_date = v_rated_date then
    select count(*) into v_same_day
      from public.infusion_ratings r
      join public.infusions i on i.id = r.infusion_id
     where r.member_id = new.member_id
       and r.created_at::date = i.start_time::date;
    if v_same_day >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'eagle_eye'); end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_check_rating_achievements on public.infusion_ratings;
create trigger trg_check_rating_achievements
  after insert on public.infusion_ratings
  for each row execute function public.check_rating_achievements();

-- ─── 4c. Trigger: Community-Badges (Follow) ──────────────────────────────
create or replace function public.check_follow_achievements() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.member_follows where follower_id = new.follower_id;
  if v_count = 1  then perform public.award_badge_if_not_exists(new.follower_id, 'first_fan'); end if;
  if v_count = 5  then perform public.award_badge_if_not_exists(new.follower_id, 'collector_5'); end if;
  if v_count = 15 then perform public.award_badge_if_not_exists(new.follower_id, 'collector_15'); end if;
  if v_count = 30 then perform public.award_badge_if_not_exists(new.follower_id, 'collector_30'); end if;
  return new;
end$$;

drop trigger if exists trg_check_follow_achievements on public.member_follows;
create trigger trg_check_follow_achievements
  after insert on public.member_follows
  for each row execute function public.check_follow_achievements();

-- ─── 4d. Trigger: Pioneer-Gast (erste 10 Gast-Signups) ───────────────────
create or replace function public.check_pioneer_gast() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rank int;
begin
  if new.role <> 'gast' then return new; end if;
  select count(*) + 1 into v_rank from public.members
   where role = 'gast' and created_at < new.created_at and id <> new.id;
  if v_rank <= 10 then
    perform public.award_badge_if_not_exists(new.id, 'pioneer_gast',
                                              jsonb_build_object('rank', v_rank));
  end if;
  return new;
end$$;

drop trigger if exists trg_check_pioneer_gast on public.members;
create trigger trg_check_pioneer_gast
  after insert on public.members
  for each row execute function public.check_pioneer_gast();

-- ─── 5. Stats-RPC für Dashboard ───────────────────────────────────────────
create or replace function public.get_member_stats_full(p_member_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sauna_days', (select count(*) from public.attendance_events where member_id = p_member_id),
    'streak_weeks', public.get_attendance_streak_weeks(p_member_id),
    'ratings_given', (select count(*) from public.infusion_ratings where member_id = p_member_id),
    'avg_rating_given', (
      select round(avg((chemie + luftbewegung + wedeltechnik + hitzeniveau + musik + duftentwicklung) / 6.0)::numeric, 2)
        from public.infusion_ratings where member_id = p_member_id
    ),
    'aufgusse_attended', (select count(*) from public.infusion_attendances where member_id = p_member_id),
    'unique_aufgieser', (
      select count(distinct i.saunameister_id)
        from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
       where r.member_id = p_member_id and i.saunameister_id is not null
    ),
    'follows_count', (select count(*) from public.member_follows where follower_id = p_member_id),
    'member_since', (select created_at from public.members where id = p_member_id),
    'favorite_aufgieser', (
      select m.name from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
        join public.members m on m.id = i.saunameister_id
       where r.member_id = p_member_id
       group by m.id, m.name
       order by count(*) desc limit 1
    ),
    'favorite_sauna', (
      select s.name from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
        join public.saunas s on s.id = i.sauna_id
       where r.member_id = p_member_id
       group by s.id, s.name
       order by count(*) desc limit 1
    ),
    'attendance_by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', month, 'count', cnt) order by month asc)
        from (
          select to_char(date, 'YYYY-MM') as month, count(*)::int as cnt
            from public.attendance_events
           where member_id = p_member_id
             and date >= (now() - interval '12 months')::date
           group by 1
        ) sq
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.get_member_stats_full(uuid) from public;
grant execute on function public.get_member_stats_full(uuid) to authenticated;

-- ─── 6. Backfill: bestehende Members nachträglich belohnen ───────────────
do $$
declare
  m record;
  v_total int; v_streak int; v_ratings int;
  v_distinct_meister int; v_distinct_saunas int; v_follows int;
  v_winter int; v_summer int;
  v_pioneer_rank int;
begin
  for m in select id, role, created_at, birthday from public.members where revoked_at is null loop
    -- Attendance
    select count(*) into v_total from public.attendance_events where member_id = m.id;
    if v_total >= 1   then perform public.award_badge_if_not_exists(m.id, 'first_sauna_day'); end if;
    if v_total >= 5   then perform public.award_badge_if_not_exists(m.id, 'regular_5'); end if;
    if v_total >= 15  then perform public.award_badge_if_not_exists(m.id, 'regular_15'); end if;
    if v_total >= 30  then perform public.award_badge_if_not_exists(m.id, 'regular_30'); end if;
    if v_total >= 60  then perform public.award_badge_if_not_exists(m.id, 'regular_60'); end if;

    -- Streak
    select public.get_attendance_streak_weeks(m.id) into v_streak;
    if v_streak >= 4  then perform public.award_badge_if_not_exists(m.id, 'streak_4w'); end if;
    if v_streak >= 12 then perform public.award_badge_if_not_exists(m.id, 'streak_12w'); end if;
    if v_streak >= 24 then perform public.award_badge_if_not_exists(m.id, 'streak_24w'); end if;

    -- Ratings
    select count(*) into v_ratings from public.infusion_ratings where member_id = m.id;
    if v_ratings >= 1   then perform public.award_badge_if_not_exists(m.id, 'first_rating'); end if;
    if v_ratings >= 10  then perform public.award_badge_if_not_exists(m.id, 'feedback_giver'); end if;
    if v_ratings >= 50  then perform public.award_badge_if_not_exists(m.id, 'feedback_pro'); end if;
    if v_ratings >= 100 then perform public.award_badge_if_not_exists(m.id, 'feedback_top'); end if;

    -- Entdeckung
    select count(distinct i.saunameister_id)
      into v_distinct_meister
      from public.infusion_ratings r
      join public.infusions i on i.id = r.infusion_id
     where r.member_id = m.id and i.saunameister_id is not null;
    if v_distinct_meister >= 3  then perform public.award_badge_if_not_exists(m.id, 'curious'); end if;
    if v_distinct_meister >= 10 then perform public.award_badge_if_not_exists(m.id, 'vielsauner'); end if;
    if v_distinct_meister >= 25 then perform public.award_badge_if_not_exists(m.id, 'connaisseur'); end if;

    select count(distinct i.sauna_id)
      into v_distinct_saunas
      from public.infusion_ratings r
      join public.infusions i on i.id = r.infusion_id
     where r.member_id = m.id;
    if v_distinct_saunas >= 3 then perform public.award_badge_if_not_exists(m.id, 'sauna_allrounder'); end if;

    -- Follows
    select count(*) into v_follows from public.member_follows where follower_id = m.id;
    if v_follows >= 1  then perform public.award_badge_if_not_exists(m.id, 'first_fan'); end if;
    if v_follows >= 5  then perform public.award_badge_if_not_exists(m.id, 'collector_5'); end if;
    if v_follows >= 15 then perform public.award_badge_if_not_exists(m.id, 'collector_15'); end if;
    if v_follows >= 30 then perform public.award_badge_if_not_exists(m.id, 'collector_30'); end if;

    -- Saison
    select count(*) into v_winter from public.attendance_events
     where member_id = m.id and extract(month from date) in (12, 1, 2);
    if v_winter >= 10 then perform public.award_badge_if_not_exists(m.id, 'winter_guest'); end if;
    select count(*) into v_summer from public.attendance_events
     where member_id = m.id and extract(month from date) in (6, 7, 8);
    if v_summer >= 10 then perform public.award_badge_if_not_exists(m.id, 'summer_guest'); end if;

    -- Pioneer-Gast (erste 10 Gast-Signups, retroaktiv)
    if m.role = 'gast' then
      select count(*) + 1 into v_pioneer_rank from public.members
       where role = 'gast' and created_at < m.created_at and id <> m.id;
      if v_pioneer_rank <= 10 then
        perform public.award_badge_if_not_exists(m.id, 'pioneer_gast', jsonb_build_object('rank', v_pioneer_rank));
      end if;
    end if;
  end loop;
end$$;

comment on table public.infusion_attendances is
  'Welcher Member war bei welchem Aufguss anwesend. Befüllt durch Trigger beim Scanner-Toggle.';
comment on function public.get_member_stats_full(uuid) is
  'Vollständige Stats für Dashboard: 8 Metriken + favorite_aufgieser/sauna + 12-Monats-Attendance.';
