-- ─── 0055: 20 Statistik-RPCs ─────────────────────────────────────────────
-- Read-only Aggregate für den neuen Admin-Tab "📈 Auswertungen".
-- Alle RPCs SECURITY DEFINER, grant authenticated (RLS-Check ggf. im Tab).

-- 1) Aufgießer-Bestenliste — Bubble: Anzahl × Ø-Rating
create or replace function public.stats_aufgieser_leaderboard()
returns table (member_id uuid, name text, avatar_path text, infusion_count bigint, avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.avatar_path,
         count(distinct i.id) as infusion_count,
         coalesce(avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung)::numeric / 6.0), 0) as avg_rating,
         count(r.id) as rating_count
    from public.members m
    left join public.infusions i on i.saunameister_id = m.id and i.start_time < now() and not i.is_personal_fallback
    left join public.infusion_ratings r on r.infusion_id = i.id
   where (m.is_aufgieser or m.role = 'guest_aufgieser')
     and m.revoked_at is null
   group by m.id, m.name, m.avatar_path
   having count(distinct i.id) > 0
   order by avg_rating desc, infusion_count desc;
$$;
revoke all on function public.stats_aufgieser_leaderboard() from public;
grant execute on function public.stats_aufgieser_leaderboard() to authenticated;

-- 2) Vereinsdurchschnitt für Radar-Overlay
create or replace function public.stats_verein_rating_avg()
returns table (chemie numeric, luftbewegung numeric, wedeltechnik numeric, hitzeniveau numeric, musik numeric, duftentwicklung numeric)
language sql stable security definer set search_path = public, auth as $$
  select avg(chemie)::numeric, avg(luftbewegung)::numeric, avg(wedeltechnik)::numeric,
         avg(hitzeniveau)::numeric, avg(musik)::numeric, avg(duftentwicklung)::numeric
    from public.infusion_ratings;
$$;
revoke all on function public.stats_verein_rating_avg() from public;
grant execute on function public.stats_verein_rating_avg() to authenticated;

-- 3) Konsistenz: stddev pro Aufgießer × Kategorie
create or replace function public.stats_aufgieser_consistency()
returns table (member_id uuid, name text, rating_count bigint,
               chemie_avg numeric, chemie_sd numeric, luft_avg numeric, luft_sd numeric,
               wedel_avg numeric, wedel_sd numeric, hitze_avg numeric, hitze_sd numeric,
               musik_avg numeric, musik_sd numeric, duft_avg numeric, duft_sd numeric)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, count(r.id),
         avg(r.chemie)::numeric, coalesce(stddev_pop(r.chemie),0)::numeric,
         avg(r.luftbewegung)::numeric, coalesce(stddev_pop(r.luftbewegung),0)::numeric,
         avg(r.wedeltechnik)::numeric, coalesce(stddev_pop(r.wedeltechnik),0)::numeric,
         avg(r.hitzeniveau)::numeric, coalesce(stddev_pop(r.hitzeniveau),0)::numeric,
         avg(r.musik)::numeric, coalesce(stddev_pop(r.musik),0)::numeric,
         avg(r.duftentwicklung)::numeric, coalesce(stddev_pop(r.duftentwicklung),0)::numeric
    from public.members m
    join public.infusions i on i.saunameister_id = m.id
    join public.infusion_ratings r on r.infusion_id = i.id
   where (m.is_aufgieser or m.role = 'guest_aufgieser') and m.revoked_at is null
   group by m.id, m.name
   having count(r.id) >= 3
   order by m.name;
$$;
revoke all on function public.stats_aufgieser_consistency() from public;
grant execute on function public.stats_aufgieser_consistency() to authenticated;

-- 4) Aroma-Signature pro Aufgießer
create or replace function public.stats_aufgieser_aroma_signature(p_member_id uuid, p_limit int default 12)
returns table (oil_slug text, usage_count bigint)
language sql stable security definer set search_path = public, auth as $$
  select oil_slug, count(*)
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.saunameister_id = p_member_id
     and i.oils is not null and not i.is_personal_fallback
   group by oil_slug
   order by count(*) desc
   limit greatest(1, p_limit);
$$;
revoke all on function public.stats_aufgieser_aroma_signature(uuid, int) from public;
grant execute on function public.stats_aufgieser_aroma_signature(uuid, int) to authenticated;

-- 5) Volumen pro Monat — eigen vs fallback vs team
create or replace function public.stats_volume_by_month(p_months int default 12)
returns table (month text, eigen bigint, fallback bigint, team bigint)
language sql stable security definer set search_path = public, auth as $$
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM'),
         count(*) filter (where not i.is_personal_fallback and not i.team_infusion),
         count(*) filter (where i.is_personal_fallback),
         count(*) filter (where i.team_infusion)
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now()
   group by 1 order by 1;
$$;
revoke all on function public.stats_volume_by_month(int) from public;
grant execute on function public.stats_volume_by_month(int) to authenticated;

-- 6) Heatmap Wochentag × Stunde
create or replace function public.stats_weekday_hour_heatmap(p_months int default 12)
returns table (weekday int, hour int, count bigint)
language sql stable security definer set search_path = public, auth as $$
  select extract(dow from i.start_time at time zone 'Europe/Berlin')::int,
         extract(hour from i.start_time at time zone 'Europe/Berlin')::int,
         count(*)
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now() and not i.is_personal_fallback
   group by 1, 2 order by 1, 2;
$$;
revoke all on function public.stats_weekday_hour_heatmap(int) from public;
grant execute on function public.stats_weekday_hour_heatmap(int) to authenticated;

-- 7) Personal-Fallback-Quote pro Monat
create or replace function public.stats_fallback_rate_by_month(p_months int default 12)
returns table (month text, total bigint, fallbacks bigint, fallback_pct numeric)
language sql stable security definer set search_path = public, auth as $$
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM'),
         count(*), count(*) filter (where i.is_personal_fallback),
         case when count(*) > 0
              then round((count(*) filter (where i.is_personal_fallback))::numeric * 100 / count(*), 1)
              else 0 end
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now()
   group by 1 order by 1;
$$;
revoke all on function public.stats_fallback_rate_by_month(int) from public;
grant execute on function public.stats_fallback_rate_by_month(int) to authenticated;

-- 8) Team-Aufguss-Summary + Top-3
create or replace function public.stats_team_aufguss_summary()
returns table (total bigint, team_count bigint, team_pct numeric,
               top_member_id uuid, top_name text, top_count bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_total bigint; v_team bigint;
begin
  select count(*), count(*) filter (where team_infusion)
    into v_total, v_team
    from public.infusions where start_time < now() and not is_personal_fallback;
  return query
    select v_total, v_team,
           case when v_total > 0 then round(v_team::numeric * 100 / v_total, 1) else 0 end,
           m.id, m.name, count(*)
      from public.infusions i join public.members m on m.id = i.saunameister_id
     where i.team_infusion and i.start_time < now()
     group by m.id, m.name order by count(*) desc limit 3;
end$$;
revoke all on function public.stats_team_aufguss_summary() from public;
grant execute on function public.stats_team_aufguss_summary() to authenticated;

-- 9) Top-Aromen
create or replace function public.stats_top_oils(p_limit int default 20)
returns table (oil_slug text, usage_count bigint)
language sql stable security definer set search_path = public, auth as $$
  select oil_slug, count(*)
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.oils is not null and not i.is_personal_fallback and i.start_time < now()
   group by oil_slug order by count(*) desc limit greatest(1, p_limit);
$$;
revoke all on function public.stats_top_oils(int) from public;
grant execute on function public.stats_top_oils(int) to authenticated;

-- 10) Aroma-Erfolg
create or replace function public.stats_oil_rating_correlation(p_min_usage int default 2)
returns table (oil_slug text, usage_count bigint, avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = public, auth as $$
  with oil_infusions as (
    select unnest(i.oils) as oil_slug, i.id as inf_id from public.infusions i
     where i.oils is not null and not i.is_personal_fallback and i.start_time < now()
  ),
  agg as (
    select oi.oil_slug, count(distinct oi.inf_id) as usage_count,
           avg((r.chemie+r.luftbewegung+r.wedeltechnik+r.hitzeniveau+r.musik+r.duftentwicklung)::numeric/6.0) as avg_rating,
           count(r.id) as rating_count
      from oil_infusions oi left join public.infusion_ratings r on r.infusion_id = oi.inf_id
     group by oi.oil_slug
  )
  select oil_slug, usage_count, coalesce(avg_rating,0)::numeric, rating_count
    from agg where usage_count >= greatest(1, p_min_usage)
   order by usage_count desc;
$$;
revoke all on function public.stats_oil_rating_correlation(int) from public;
grant execute on function public.stats_oil_rating_correlation(int) to authenticated;

-- 11) Aromen-Saisonalität
create or replace function public.stats_oil_seasonality()
returns table (oil_slug text, month int, usage_count bigint)
language sql stable security definer set search_path = public, auth as $$
  select oil_slug, extract(month from i.start_time at time zone 'Europe/Berlin')::int, count(*)
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.oils is not null and not i.is_personal_fallback and i.start_time < now()
   group by 1, 2 order by 1, 2;
$$;
revoke all on function public.stats_oil_seasonality() from public;
grant execute on function public.stats_oil_seasonality() to authenticated;

-- 12) Streak-Bestenliste
create or replace function public.stats_attendance_streak_leaderboard(p_limit int default 15)
returns table (member_id uuid, name text, longest_streak int, current_streak int, total_visits bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  return query
  with weeks as (
    select m.id as member_id, m.name, date_trunc('week', ae.date::timestamp)::date as week_start
      from public.members m join public.attendance_events ae on ae.member_id = m.id
     where m.revoked_at is null group by m.id, m.name, week_start
  ),
  grouped as (
    select member_id, name, week_start,
           (week_start - (row_number() over (partition by member_id order by week_start) * interval '7 days'))::date as grp
      from weeks
  ),
  runs as (
    select member_id, name, count(*)::int as streak_len, max(week_start) as last_week
      from grouped group by member_id, name, grp
  ),
  per_member as (
    select member_id, name, max(streak_len) as longest_streak,
           max(streak_len) filter (where last_week >= date_trunc('week', now())::date - interval '7 days') as current_streak,
           sum(streak_len) as total_visits
      from runs group by member_id, name
  )
  select pm.member_id, pm.name, pm.longest_streak::int,
         coalesce(pm.current_streak, 0)::int, pm.total_visits::bigint
    from per_member pm
   order by longest_streak desc, total_visits desc limit greatest(1, p_limit);
end$$;
revoke all on function public.stats_attendance_streak_leaderboard(int) from public;
grant execute on function public.stats_attendance_streak_leaderboard(int) to authenticated;

-- 13) Aktivitäts-Score
create or replace function public.stats_activity_score(p_limit int default 20)
returns table (member_id uuid, name text, role text,
               infusions_done bigint, attendances bigint, ratings_given bigint, posts bigint, reactions_made bigint,
               total_score numeric)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.role::text,
         (select count(*) from public.infusions i where i.saunameister_id = m.id and not i.is_personal_fallback and i.start_time < now()),
         (select count(*) from public.attendance_events ae where ae.member_id = m.id),
         (select count(*) from public.infusion_ratings r where r.member_id = m.id),
         (select count(*) from public.feed_posts p where p.author_id = m.id and p.deleted_at is null),
         (select count(*) from public.feed_post_reactions fr where fr.member_id = m.id),
         ((select count(*) from public.infusions i where i.saunameister_id = m.id and not i.is_personal_fallback and i.start_time < now()) * 5
          + (select count(*) from public.attendance_events ae where ae.member_id = m.id) * 2
          + (select count(*) from public.infusion_ratings r where r.member_id = m.id) * 1
          + (select count(*) from public.feed_posts p where p.author_id = m.id and p.deleted_at is null) * 3
          + (select count(*) from public.feed_post_reactions fr where fr.member_id = m.id) * 0.5)::numeric
    from public.members m where m.revoked_at is null
   order by 10 desc limit greatest(1, p_limit);
$$;
revoke all on function public.stats_activity_score(int) from public;
grant execute on function public.stats_activity_score(int) to authenticated;

-- 14) Mitgliederwachstum
create or replace function public.stats_member_growth_by_month(p_months int default 12)
returns table (month text, role text, joined bigint)
language sql stable security definer set search_path = public, auth as $$
  select to_char(date_trunc('month', m.created_at at time zone 'Europe/Berlin'), 'YYYY-MM'),
         m.role::text, count(*)
    from public.members m
   where m.created_at >= now() - (p_months || ' months')::interval and m.revoked_at is null
   group by 1, 2 order by 1, 2;
$$;
revoke all on function public.stats_member_growth_by_month(int) from public;
grant execute on function public.stats_member_growth_by_month(int) to authenticated;

-- 15) Wiederkehr-Funnel
create or replace function public.stats_guest_retention_funnel()
returns table (bucket text, member_count bigint)
language sql stable security definer set search_path = public, auth as $$
  with visit_counts as (
    select m.id, count(ae.date) as visits
      from public.members m left join public.attendance_events ae on ae.member_id = m.id
     where m.revoked_at is null and m.role = 'gast' group by m.id
  )
  select 'all_gaeste', count(*) from visit_counts
  union all select '>=1 Besuch', count(*) filter (where visits >= 1) from visit_counts
  union all select '>=2 Besuche', count(*) filter (where visits >= 2) from visit_counts
  union all select '>=5 Besuche', count(*) filter (where visits >= 5) from visit_counts
  union all select '>=10 Besuche', count(*) filter (where visits >= 10) from visit_counts;
$$;
revoke all on function public.stats_guest_retention_funnel() from public;
grant execute on function public.stats_guest_retention_funnel() to authenticated;

-- 16) Bewertungs-Coverage
create or replace function public.stats_rating_coverage_by_month(p_months int default 12)
returns table (month text, total bigint, rated bigint, coverage_pct numeric)
language sql stable security definer set search_path = public, auth as $$
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM'),
         count(distinct i.id),
         count(distinct i.id) filter (where r.id is not null),
         case when count(distinct i.id) > 0
              then round((count(distinct i.id) filter (where r.id is not null))::numeric * 100 / count(distinct i.id), 1)
              else 0 end
    from public.infusions i left join public.infusion_ratings r on r.infusion_id = i.id
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.end_time < now() and not i.is_personal_fallback
   group by 1 order by 1;
$$;
revoke all on function public.stats_rating_coverage_by_month(int) from public;
grant execute on function public.stats_rating_coverage_by_month(int) to authenticated;

-- 17) Sterne-Verteilung
create or replace function public.stats_rating_distribution()
returns table (stars int, count bigint)
language sql stable security definer set search_path = public, auth as $$
  with all_stars as (
    select chemie as s from public.infusion_ratings union all
    select luftbewegung from public.infusion_ratings union all
    select wedeltechnik from public.infusion_ratings union all
    select hitzeniveau from public.infusion_ratings union all
    select musik from public.infusion_ratings union all
    select duftentwicklung from public.infusion_ratings
  )
  select s::int, count(*) from all_stars where s is not null group by s order by s;
$$;
revoke all on function public.stats_rating_distribution() from public;
grant execute on function public.stats_rating_distribution() to authenticated;

-- 18) Feed-Aktivität pro Tag
create or replace function public.stats_feed_activity_by_day(p_days int default 30)
returns table (day text, posts bigint, reactions bigint)
language sql stable security definer set search_path = public, auth as $$
  with days as (
    select to_char(d, 'YYYY-MM-DD') as day
      from generate_series((now() - (p_days || ' days')::interval)::date, now()::date, '1 day') d
  ),
  pc as (
    select to_char(created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD') as day, count(*) c
      from public.feed_posts where created_at >= now() - (p_days || ' days')::interval and deleted_at is null group by 1
  ),
  rc as (
    select to_char(created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD') as day, count(*) c
      from public.feed_post_reactions where created_at >= now() - (p_days || ' days')::interval group by 1
  )
  select d.day, coalesce(pc.c,0), coalesce(rc.c,0)
    from days d left join pc on pc.day = d.day left join rc on rc.day = d.day
   order by d.day;
$$;
revoke all on function public.stats_feed_activity_by_day(int) from public;
grant execute on function public.stats_feed_activity_by_day(int) to authenticated;

-- 19) Reaction-Verteilung
create or replace function public.stats_feed_reaction_distribution()
returns table (reaction text, count bigint)
language sql stable security definer set search_path = public, auth as $$
  select reaction::text, count(*) from public.feed_post_reactions group by reaction order by count desc;
$$;
revoke all on function public.stats_feed_reaction_distribution() from public;
grant execute on function public.stats_feed_reaction_distribution() to authenticated;

-- 20) Follower-Netzwerk
create or replace function public.stats_follower_network(p_limit int default 8)
returns table (kind text, member_id uuid, name text, avatar_path text, role text, n bigint)
language sql stable security definer set search_path = public, auth as $$
  (select 'star', m.id, m.name, m.avatar_path, m.role::text, count(*)
     from public.member_follows f join public.members m on m.id = f.followee_id
    where m.revoked_at is null group by m.id, m.name, m.avatar_path, m.role
    order by count(*) desc limit greatest(1, p_limit))
  union all
  (select 'fan', m.id, m.name, m.avatar_path, m.role::text, count(*)
     from public.member_follows f join public.members m on m.id = f.follower_id
    where m.revoked_at is null group by m.id, m.name, m.avatar_path, m.role
    order by count(*) desc limit greatest(1, p_limit));
$$;
revoke all on function public.stats_follower_network(int) from public;
grant execute on function public.stats_follower_network(int) to authenticated;
