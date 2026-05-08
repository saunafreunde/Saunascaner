-- Phase 3: Achievement & Badge-System
-- member_achievements Tabelle, Statistik-RPCs, Monatlicher Leaderboard

-- ─── Tabelle ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  badge_id    text NOT NULL,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb NOT NULL DEFAULT '{}',
  UNIQUE (member_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_achievements_member ON member_achievements(member_id);
CREATE INDEX IF NOT EXISTS idx_achievements_badge  ON member_achievements(badge_id);

ALTER TABLE member_achievements ENABLE ROW LEVEL SECURITY;

-- Jeder darf alle Badges sehen (Prestige-Effekt)
CREATE POLICY "Alle lesen Badges"
  ON member_achievements FOR SELECT USING (true);

-- Frontend darf nicht direkt inserieren — nur via award_badge RPC
CREATE POLICY "Kein direktes Insert"
  ON member_achievements FOR INSERT WITH CHECK (false);

-- ─── Statistik-RPC ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_member_stats(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total        int;
  v_team         int;
  v_monthly      int;
  v_saunas_used  int;
  v_total_saunas int;
  v_daily_max    int;
  v_has_early    bool;
  v_has_late     bool;
BEGIN
  -- Gesamte abgeschlossene Aufgüsse als Aufgiesser
  SELECT COUNT(*) INTO v_total
  FROM infusions
  WHERE saunameister_id = p_member_id AND end_time < NOW();

  -- Team-Beteiligungen (als Co-Aufgiesser)
  SELECT COUNT(DISTINCT infusion_id) INTO v_team
  FROM infusion_co_aufgieser
  WHERE member_id = p_member_id;

  -- Aufgüsse diesen Monat
  SELECT COUNT(*) INTO v_monthly
  FROM infusions
  WHERE saunameister_id = p_member_id
    AND end_time >= date_trunc('month', NOW())
    AND end_time < NOW();

  -- Wie viele verschiedene Saunen bespielt
  SELECT COUNT(DISTINCT sauna_id) INTO v_saunas_used
  FROM infusions
  WHERE saunameister_id = p_member_id AND end_time < NOW();

  -- Wie viele aktive Saunen gibt es insgesamt
  SELECT COUNT(*) INTO v_total_saunas
  FROM saunas WHERE is_active = true;

  -- Maximale Aufgüsse an einem Tag
  SELECT COALESCE(MAX(daily_count), 0) INTO v_daily_max FROM (
    SELECT COUNT(*) AS daily_count
    FROM infusions
    WHERE saunameister_id = p_member_id AND end_time < NOW()
    GROUP BY DATE(start_time AT TIME ZONE 'Europe/Berlin')
  ) t;

  -- Frühaufsteher: jemals 11:00 Slot
  SELECT EXISTS(
    SELECT 1 FROM infusions
    WHERE saunameister_id = p_member_id AND end_time < NOW()
      AND EXTRACT(HOUR FROM start_time AT TIME ZONE 'Europe/Berlin') = 11
  ) INTO v_has_early;

  -- Nachtschicht: jemals 20:00 Slot
  SELECT EXISTS(
    SELECT 1 FROM infusions
    WHERE saunameister_id = p_member_id AND end_time < NOW()
      AND EXTRACT(HOUR FROM start_time AT TIME ZONE 'Europe/Berlin') = 20
  ) INTO v_has_late;

  RETURN json_build_object(
    'total_infusions',    v_total,
    'team_infusions',     v_team,
    'monthly_infusions',  v_monthly,
    'saunas_used',        v_saunas_used,
    'total_saunas',       v_total_saunas,
    'max_per_day',        v_daily_max,
    'has_early_bird',     v_has_early,
    'has_night_owl',      v_has_late
  );
END;
$$;

-- ─── Badge verleihen (SECURITY DEFINER umgeht RLS) ────────────────────────────
CREATE OR REPLACE FUNCTION award_badge(
  p_member_id uuid,
  p_badge_id  text,
  p_metadata  jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO member_achievements(member_id, badge_id, metadata)
  VALUES (p_member_id, p_badge_id, p_metadata)
  ON CONFLICT (member_id, badge_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- ─── Monatlicher Leaderboard ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_leaderboard()
RETURNS TABLE(member_id uuid, name text, sauna_name text, count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    i.saunameister_id AS member_id,
    m.name,
    m.sauna_name,
    COUNT(*) AS count
  FROM infusions i
  JOIN members m ON m.id = i.saunameister_id
  WHERE i.end_time >= date_trunc('month', NOW())
    AND i.end_time < NOW()
    AND i.saunameister_id IS NOT NULL
  GROUP BY i.saunameister_id, m.name, m.sauna_name
  ORDER BY count DESC
  LIMIT 5;
$$;

-- ─── Pionier-Badges: erste 3 Aufgieser des Vereins ────────────────────────────
INSERT INTO member_achievements (member_id, badge_id, metadata)
SELECT id, 'pioneer', '{"reason": "Erster Aufgieser des Vereins"}'::jsonb
FROM members
WHERE is_aufgieser = true
ORDER BY created_at ASC
LIMIT 3
ON CONFLICT (member_id, badge_id) DO NOTHING;
