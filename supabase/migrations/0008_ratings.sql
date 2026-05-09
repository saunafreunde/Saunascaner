-- Migration 0008: Aufguss-Bewertungssystem
-- Mitglieder können abgeschlossene Aufgüsse in 6 Kategorien bewerten.
-- Bedingungen (serverseitig geprüft via RPC):
--   - Nur anwesende Mitglieder (is_present = true)
--   - Nur innerhalb von 3h nach Aufguss-Ende
--   - Nicht der eigene Aufguss

CREATE TABLE IF NOT EXISTS infusion_ratings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infusion_id     uuid NOT NULL REFERENCES infusions(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- 6 Lern-Kategorien (1–5 Sterne)
  chemie          smallint CHECK (chemie BETWEEN 1 AND 5),
  luftbewegung    smallint CHECK (luftbewegung BETWEEN 1 AND 5),
  wedeltechnik    smallint CHECK (wedeltechnik BETWEEN 1 AND 5),
  hitzeniveau     smallint CHECK (hitzeniveau BETWEEN 1 AND 5),
  musik           smallint CHECK (musik BETWEEN 1 AND 5),
  duftentwicklung smallint CHECK (duftentwicklung BETWEEN 1 AND 5),
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (infusion_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_infusion ON infusion_ratings(infusion_id);
CREATE INDEX IF NOT EXISTS idx_ratings_member   ON infusion_ratings(member_id);

-- RLS: Alle dürfen lesen, nur eigene Ratings schreiben
ALTER TABLE infusion_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle lesen Ratings" ON infusion_ratings
  FOR SELECT USING (true);

CREATE POLICY "Eigene Ratings einfügen" ON infusion_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
  );

CREATE POLICY "Eigene Ratings updaten" ON infusion_ratings
  FOR UPDATE USING (
    auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
  );

-- RPC: Bewertung abgeben (SECURITY DEFINER prüft alle Bedingungen)
CREATE OR REPLACE FUNCTION submit_rating(
  p_infusion_id   uuid,
  p_member_id     uuid,
  p_chemie        smallint,
  p_luftbewegung  smallint,
  p_wedeltechnik  smallint,
  p_hitzeniveau   smallint,
  p_musik         smallint,
  p_duftentwicklung smallint,
  p_comment       text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_end_time   timestamptz;
  v_meister_id uuid;
  v_is_present boolean;
BEGIN
  SELECT end_time, saunameister_id
    INTO v_end_time, v_meister_id
    FROM infusions WHERE id = p_infusion_id;

  IF v_meister_id = p_member_id THEN
    RETURN 'self_rating_not_allowed';
  END IF;

  IF NOW() < v_end_time THEN
    RETURN 'infusion_not_finished';
  END IF;

  IF NOW() > v_end_time + INTERVAL '3 hours' THEN
    RETURN 'rating_window_expired';
  END IF;

  SELECT is_present INTO v_is_present FROM members WHERE id = p_member_id;
  IF NOT v_is_present THEN
    RETURN 'not_present';
  END IF;

  INSERT INTO infusion_ratings
    (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
     hitzeniveau, musik, duftentwicklung, comment)
  VALUES
    (p_infusion_id, p_member_id, p_chemie, p_luftbewegung, p_wedeltechnik,
     p_hitzeniveau, p_musik, p_duftentwicklung, p_comment)
  ON CONFLICT (infusion_id, member_id) DO UPDATE SET
    chemie          = EXCLUDED.chemie,
    luftbewegung    = EXCLUDED.luftbewegung,
    wedeltechnik    = EXCLUDED.wedeltechnik,
    hitzeniveau     = EXCLUDED.hitzeniveau,
    musik           = EXCLUDED.musik,
    duftentwicklung = EXCLUDED.duftentwicklung,
    comment         = EXCLUDED.comment;

  RETURN 'ok';
END; $$;

-- RPC: Durchschnittswerte eines Aufgiesers für Radar-Chart
CREATE OR REPLACE FUNCTION get_meister_rating_avg(p_member_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'chemie',          ROUND(AVG(r.chemie)::numeric, 1),
    'luftbewegung',    ROUND(AVG(r.luftbewegung)::numeric, 1),
    'wedeltechnik',    ROUND(AVG(r.wedeltechnik)::numeric, 1),
    'hitzeniveau',     ROUND(AVG(r.hitzeniveau)::numeric, 1),
    'musik',           ROUND(AVG(r.musik)::numeric, 1),
    'duftentwicklung', ROUND(AVG(r.duftentwicklung)::numeric, 1),
    'total_ratings',   COUNT(*)
  )
  FROM infusion_ratings r
  JOIN infusions i ON i.id = r.infusion_id
  WHERE i.saunameister_id = p_member_id;
$$;

-- RPC: Zählbar bewertete Aufgüsse für ein Mitglied (abgeschlossen, Fenster offen, nicht selbst)
CREATE OR REPLACE FUNCTION get_ratable_infusions(p_member_id uuid)
RETURNS TABLE(
  id              uuid,
  title           text,
  sauna_id        uuid,
  saunameister_id uuid,
  start_time      timestamptz,
  end_time        timestamptz,
  already_rated   boolean
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    i.id,
    i.title,
    i.sauna_id,
    i.saunameister_id,
    i.start_time,
    i.end_time,
    EXISTS(
      SELECT 1 FROM infusion_ratings r
      WHERE r.infusion_id = i.id AND r.member_id = p_member_id
    ) AS already_rated
  FROM infusions i
  WHERE i.end_time < NOW()
    AND i.end_time > NOW() - INTERVAL '3 hours'
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> p_member_id
  ORDER BY i.end_time DESC;
$$;

-- RPC: Anzahl abgegebener Bewertungen eines Mitglieds (für Feedback-Badge)
CREATE OR REPLACE FUNCTION count_member_ratings(p_member_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*) FROM infusion_ratings WHERE member_id = p_member_id;
$$;
