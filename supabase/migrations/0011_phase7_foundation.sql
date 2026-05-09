-- Phase 7 Foundation: Geburtstage, Anwesenheits-Streak-Tracking, Push-Subscriptions, WM-Champion-Vergabe

-- ─── 1. Geburtstage ──────────────────────────────────────────────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS birthday DATE;

-- ─── 2. Anwesenheits-Tracking (rückwirkend nicht nachholbar) ────────────
CREATE TABLE IF NOT EXISTS attendance_events (
  member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
  date       date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance_events(member_id, date);

ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_read" ON attendance_events FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION log_attendance_on_checkin() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_present = true AND (OLD.is_present = false OR OLD.is_present IS NULL) THEN
    INSERT INTO attendance_events (member_id, date)
    VALUES (NEW.id, CURRENT_DATE)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_log_attendance ON members;
CREATE TRIGGER members_log_attendance AFTER UPDATE OF is_present ON members
  FOR EACH ROW EXECUTE FUNCTION log_attendance_on_checkin();

-- ─── 3. Streak-Berechnung (Wochen in Folge) ──────────────────────────────
CREATE OR REPLACE FUNCTION get_attendance_streak_weeks(p_member_id uuid)
RETURNS int LANGUAGE sql STABLE AS $$
WITH weeks_present AS (
  SELECT DISTINCT date_trunc('week', date)::date AS week_start
  FROM attendance_events
  WHERE member_id = p_member_id
),
numbered AS (
  SELECT week_start,
         (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' * (row_number() OVER (ORDER BY week_start DESC) - 1))::date AS expected
  FROM weeks_present
)
SELECT COALESCE(COUNT(*) FILTER (WHERE week_start = expected), 0)::int FROM numbered;
$$;

-- ─── 4. WM-Champion-Vergabe (Admin nach Finale) ──────────────────────────
CREATE OR REPLACE FUNCTION award_wm_champions() RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r record; pos int := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND role = 'admin')
    THEN RETURN 'not_admin'; END IF;
  FOR r IN SELECT member_id FROM get_wm_leaderboard() LIMIT 3 LOOP
    pos := pos + 1;
    PERFORM award_badge(r.member_id,
      CASE pos WHEN 1 THEN 'wm_champion_gold' WHEN 2 THEN 'wm_champion_silver' ELSE 'wm_champion_bronze' END,
      jsonb_build_object('tournament', '2026', 'position', pos));
  END LOOP;
  RETURN 'ok';
END $$;

-- ─── 5. Push-Subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh_key  text NOT NULL,
  auth_key    text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_own_select" ON push_subscriptions FOR SELECT USING (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);
CREATE POLICY "ps_own_insert" ON push_subscriptions FOR INSERT WITH CHECK (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);
CREATE POLICY "ps_own_delete" ON push_subscriptions FOR DELETE USING (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);

-- ─── 6. Birthday-Helper RPCs ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_birthdays_today()
RETURNS TABLE(member_id uuid, name text, sauna_name text)
LANGUAGE sql STABLE AS $$
  SELECT id, name, sauna_name FROM members
  WHERE birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
    AND approved = true AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION set_my_birthday(p_birthday DATE) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE members SET birthday = p_birthday WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RETURN 'not_authorized'; END IF;
  RETURN 'ok';
END $$;
