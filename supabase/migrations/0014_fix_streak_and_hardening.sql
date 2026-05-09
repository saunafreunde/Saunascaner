-- Phase 7 Hotfix:
--  (a) get_attendance_streak_weeks zählte Treffer ohne bei der ersten Lücke zu stoppen
--      → Streak für [W0,W1,W3,W4] gab 3 statt 2 zurück.
--  (b) SECURITY DEFINER-Funktionen ohne expliziten search_path (Supabase-Advisory).

-- (a) Streak-Funktion korrekt: bricht bei erster Lücke ab
CREATE OR REPLACE FUNCTION get_attendance_streak_weeks(p_member_id uuid)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH weeks_present AS (
    SELECT DISTINCT date_trunc('week', date)::date AS week_start
    FROM attendance_events
    WHERE member_id = p_member_id
  ),
  numbered AS (
    SELECT week_start,
           row_number() OVER (ORDER BY week_start DESC) AS rn,
           (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' * (row_number() OVER (ORDER BY week_start DESC) - 1))::date AS expected
    FROM weeks_present
  ),
  matched AS (
    SELECT rn, (week_start = expected) AS ok FROM numbered
  ),
  first_gap AS (
    SELECT MIN(rn) AS gap_rn FROM matched WHERE NOT ok
  )
  SELECT COALESCE(
    (SELECT gap_rn - 1 FROM first_gap WHERE gap_rn IS NOT NULL),
    (SELECT COUNT(*)::int FROM matched)
  )::int;
$$;

-- (b) search_path für SECURITY DEFINER-Funktionen aus Phase 7 setzen
ALTER FUNCTION award_wm_champions() SET search_path = public, pg_temp;
ALTER FUNCTION set_my_birthday(DATE)  SET search_path = public, pg_temp;
