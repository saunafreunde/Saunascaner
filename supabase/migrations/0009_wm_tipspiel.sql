-- Migration 0009: WM-Tipspiel 2026
-- 48 Teams, 12 Gruppen, 104 Spiele, mit Joker / Final-Tipp / Gruppen-Quali / Streak.

-- ─── Tabellen ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wm_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,    -- z.B. "BRA", "GER"
  name        text NOT NULL,           -- z.B. "Brasilien"
  flag        text NOT NULL,           -- Emoji-Flagge "🇧🇷"
  group_label text,                    -- "A" .. "L"
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wm_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_no      int UNIQUE NOT NULL,                       -- 1..104
  phase         text NOT NULL CHECK (phase IN ('group','r32','r16','qf','sf','third','final')),
  group_label   text,                                      -- nur Vorrunde
  kickoff       timestamptz NOT NULL,
  home_team_id  uuid REFERENCES wm_teams(id) ON DELETE SET NULL,
  away_team_id  uuid REFERENCES wm_teams(id) ON DELETE SET NULL,
  home_label    text,                                      -- "Sieger Gruppe A" für noch unbekannte Teams
  away_label    text,
  score_home    smallint,
  score_away    smallint,
  locked        boolean NOT NULL DEFAULT false,            -- nach Anpfiff oder Admin-Lock
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wm_matches_phase   ON wm_matches(phase);
CREATE INDEX IF NOT EXISTS idx_wm_matches_kickoff ON wm_matches(kickoff);

CREATE TABLE IF NOT EXISTS wm_tips (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  match_id          uuid NOT NULL REFERENCES wm_matches(id) ON DELETE CASCADE,
  tip_outcome       text NOT NULL CHECK (tip_outcome IN ('home','draw','away')),
  score_home_guess  smallint,
  score_away_guess  smallint,
  joker             boolean NOT NULL DEFAULT false,
  points_earned     int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_wm_tips_member ON wm_tips(member_id);
CREATE INDEX IF NOT EXISTS idx_wm_tips_match  ON wm_tips(match_id);

CREATE TABLE IF NOT EXISTS wm_meta_tips (
  member_id        uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  champion_team_id uuid REFERENCES wm_teams(id) ON DELETE SET NULL,
  -- Format: { "A": ["TEAM1_ID","TEAM2_ID"], "B": [...], ... }
  group_advance_picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  champion_bonus_earned int NOT NULL DEFAULT 0,
  group_bonus_earned    int NOT NULL DEFAULT 0,
  locked_at        timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wm_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
INSERT INTO wm_settings (key, value) VALUES
  ('tournament_start', '"2026-06-11T18:00:00Z"'::jsonb),
  ('tournament_name',  '"FIFA WM 2026"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE wm_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wm_matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wm_tips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wm_meta_tips   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wm_settings    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wm_teams_read"     ON wm_teams     FOR SELECT USING (true);
CREATE POLICY "wm_matches_read"   ON wm_matches   FOR SELECT USING (true);
CREATE POLICY "wm_tips_read"      ON wm_tips      FOR SELECT USING (true);
CREATE POLICY "wm_meta_read"      ON wm_meta_tips FOR SELECT USING (true);
CREATE POLICY "wm_settings_read"  ON wm_settings  FOR SELECT USING (true);

-- Tipps schreiben: nur eigene
CREATE POLICY "wm_tips_own_write" ON wm_tips FOR INSERT WITH CHECK (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);
CREATE POLICY "wm_tips_own_update" ON wm_tips FOR UPDATE USING (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);
CREATE POLICY "wm_meta_own_write" ON wm_meta_tips FOR INSERT WITH CHECK (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);
CREATE POLICY "wm_meta_own_update" ON wm_meta_tips FOR UPDATE USING (
  auth.uid() = (SELECT auth_user_id FROM members WHERE id = member_id)
);

-- Admin schreibt Teams/Matches/Settings via SECURITY DEFINER RPCs (siehe unten)

-- ─── 48 Teams seeden (Auswahl plausibler Qualifikanten) ──────────────────

INSERT INTO wm_teams (code, name, flag, group_label) VALUES
  -- Gruppe A
  ('CAN','Kanada','🇨🇦','A'),('MEX','Mexiko','🇲🇽','A'),('USA','USA','🇺🇸','A'),('GER','Deutschland','🇩🇪','A'),
  -- Gruppe B
  ('BRA','Brasilien','🇧🇷','B'),('FRA','Frankreich','🇫🇷','B'),('JPN','Japan','🇯🇵','B'),('SUI','Schweiz','🇨🇭','B'),
  -- Gruppe C
  ('ARG','Argentinien','🇦🇷','C'),('NED','Niederlande','🇳🇱','C'),('KOR','Südkorea','🇰🇷','C'),('NGA','Nigeria','🇳🇬','C'),
  -- Gruppe D
  ('ESP','Spanien','🇪🇸','D'),('POR','Portugal','🇵🇹','D'),('AUS','Australien','🇦🇺','D'),('CRC','Costa Rica','🇨🇷','D'),
  -- Gruppe E
  ('ENG','England','🏴󠁧󠁢󠁥󠁮󠁧󠁿','E'),('CRO','Kroatien','🇭🇷','E'),('SEN','Senegal','🇸🇳','E'),('IRN','Iran','🇮🇷','E'),
  -- Gruppe F
  ('ITA','Italien','🇮🇹','F'),('BEL','Belgien','🇧🇪','F'),('MAR','Marokko','🇲🇦','F'),('ECU','Ecuador','🇪🇨','F'),
  -- Gruppe G
  ('URU','Uruguay','🇺🇾','G'),('DEN','Dänemark','🇩🇰','G'),('CMR','Kamerun','🇨🇲','G'),('SRB','Serbien','🇷🇸','G'),
  -- Gruppe H
  ('COL','Kolumbien','🇨🇴','H'),('POL','Polen','🇵🇱','H'),('GHA','Ghana','🇬🇭','H'),('PAR','Paraguay','🇵🇾','H'),
  -- Gruppe I
  ('AUT','Österreich','🇦🇹','I'),('TUR','Türkei','🇹🇷','I'),('CIV','Elfenbeinküste','🇨🇮','I'),('SCO','Schottland','🏴󠁧󠁢󠁳󠁣󠁴󠁿','I'),
  -- Gruppe J
  ('CZE','Tschechien','🇨🇿','J'),('NOR','Norwegen','🇳🇴','J'),('TUN','Tunesien','🇹🇳','J'),('PER','Peru','🇵🇪','J'),
  -- Gruppe K
  ('SWE','Schweden','🇸🇪','K'),('UKR','Ukraine','🇺🇦','K'),('EGY','Ägypten','🇪🇬','K'),('CHI','Chile','🇨🇱','K'),
  -- Gruppe L
  ('GRE','Griechenland','🇬🇷','L'),('SVK','Slowakei','🇸🇰','L'),('ALG','Algerien','🇩🇿','L'),('VEN','Venezuela','🇻🇪','L')
ON CONFLICT (code) DO NOTHING;

-- ─── RPCs ─────────────────────────────────────────────────────────────────

-- Tipp abgeben (mit allen Server-Validierungen)
CREATE OR REPLACE FUNCTION submit_wm_tip(
  p_match_id   uuid,
  p_outcome    text,
  p_score_home smallint DEFAULT NULL,
  p_score_away smallint DEFAULT NULL,
  p_joker      boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member_id   uuid;
  v_kickoff     timestamptz;
  v_phase       text;
  v_locked      boolean;
  v_jokers_used int;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE auth_user_id = auth.uid();
  IF v_member_id IS NULL THEN RETURN 'not_authorized'; END IF;

  SELECT kickoff, phase, locked INTO v_kickoff, v_phase, v_locked
    FROM wm_matches WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN RETURN 'match_not_found'; END IF;
  IF v_locked OR NOW() >= v_kickoff THEN RETURN 'tipping_closed'; END IF;

  -- Joker: max 1 pro Phase
  IF p_joker THEN
    SELECT COUNT(*) INTO v_jokers_used
      FROM wm_tips t JOIN wm_matches m ON m.id = t.match_id
      WHERE t.member_id = v_member_id
        AND t.joker = true
        AND m.phase = v_phase
        AND t.match_id <> p_match_id;
    IF v_jokers_used >= 1 THEN RETURN 'joker_already_used_in_phase'; END IF;
  END IF;

  INSERT INTO wm_tips (member_id, match_id, tip_outcome, score_home_guess, score_away_guess, joker)
  VALUES (v_member_id, p_match_id, p_outcome, p_score_home, p_score_away, p_joker)
  ON CONFLICT (member_id, match_id) DO UPDATE SET
    tip_outcome      = EXCLUDED.tip_outcome,
    score_home_guess = EXCLUDED.score_home_guess,
    score_away_guess = EXCLUDED.score_away_guess,
    joker            = EXCLUDED.joker,
    updated_at       = NOW();

  RETURN 'ok';
END; $$;

-- Final-Tipp + Gruppen-Quali (nur vor Turnierstart)
CREATE OR REPLACE FUNCTION submit_wm_meta_tip(
  p_champion_id uuid,
  p_picks       jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member_id uuid;
  v_start     timestamptz;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE auth_user_id = auth.uid();
  IF v_member_id IS NULL THEN RETURN 'not_authorized'; END IF;

  SELECT (value #>> '{}')::timestamptz INTO v_start FROM wm_settings WHERE key = 'tournament_start';
  IF v_start IS NOT NULL AND NOW() >= v_start THEN RETURN 'meta_tipping_closed'; END IF;

  INSERT INTO wm_meta_tips (member_id, champion_team_id, group_advance_picks, updated_at)
  VALUES (v_member_id, p_champion_id, p_picks, NOW())
  ON CONFLICT (member_id) DO UPDATE SET
    champion_team_id    = EXCLUDED.champion_team_id,
    group_advance_picks = EXCLUDED.group_advance_picks,
    updated_at          = NOW();

  RETURN 'ok';
END; $$;

-- Punktebasis pro Phase
CREATE OR REPLACE FUNCTION wm_phase_points(p_phase text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_phase
    WHEN 'group' THEN 3
    WHEN 'r32'   THEN 4
    WHEN 'r16'   THEN 5
    WHEN 'qf'    THEN 6
    WHEN 'sf'    THEN 7
    WHEN 'third' THEN 7
    WHEN 'final' THEN 8
    ELSE 0
  END;
$$;

-- Ergebnis eintragen + Punkte für alle Tipps berechnen (Admin)
CREATE OR REPLACE FUNCTION record_wm_result(
  p_match_id   uuid,
  p_score_home smallint,
  p_score_away smallint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role         text;
  v_phase        text;
  v_actual_out   text;
  v_base         int;
  r              record;
  v_pts          int;
  v_diff_actual  int;
  v_diff_guess   int;
BEGIN
  SELECT role INTO v_role FROM members WHERE auth_user_id = auth.uid();
  IF v_role <> 'admin' THEN RETURN 'not_admin'; END IF;

  UPDATE wm_matches
    SET score_home = p_score_home, score_away = p_score_away, locked = true
    WHERE id = p_match_id
    RETURNING phase INTO v_phase;
  IF v_phase IS NULL THEN RETURN 'match_not_found'; END IF;

  v_base := wm_phase_points(v_phase);
  v_actual_out := CASE
    WHEN p_score_home > p_score_away THEN 'home'
    WHEN p_score_home < p_score_away THEN 'away'
    ELSE 'draw'
  END;
  v_diff_actual := p_score_home - p_score_away;

  -- Punkte für jeden Tipp berechnen
  FOR r IN SELECT * FROM wm_tips WHERE match_id = p_match_id LOOP
    v_pts := 0;
    IF r.tip_outcome = v_actual_out THEN
      v_pts := v_base;
      IF r.score_home_guess IS NOT NULL AND r.score_away_guess IS NOT NULL THEN
        v_diff_guess := r.score_home_guess - r.score_away_guess;
        IF r.score_home_guess = p_score_home AND r.score_away_guess = p_score_away THEN
          v_pts := v_pts + 2; -- Exakt
        ELSIF v_diff_guess = v_diff_actual THEN
          v_pts := v_pts + 1; -- Tordifferenz richtig
        END IF;
      END IF;
      IF r.joker THEN v_pts := v_pts * 2; END IF;
    END IF;
    UPDATE wm_tips SET points_earned = v_pts WHERE id = r.id;
  END LOOP;

  RETURN 'ok';
END; $$;

-- Admin: Match-Teams setzen (z.B. nach Vorrunde für K.O.)
CREATE OR REPLACE FUNCTION set_wm_match_teams(
  p_match_id    uuid,
  p_home_team   uuid,
  p_away_team   uuid,
  p_home_label  text DEFAULT NULL,
  p_away_label  text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM members WHERE auth_user_id = auth.uid();
  IF v_role <> 'admin' THEN RETURN 'not_admin'; END IF;

  UPDATE wm_matches
    SET home_team_id = p_home_team,
        away_team_id = p_away_team,
        home_label   = p_home_label,
        away_label   = p_away_label
    WHERE id = p_match_id;
  RETURN 'ok';
END; $$;

-- Admin: Match anlegen
CREATE OR REPLACE FUNCTION upsert_wm_match(
  p_match_no    int,
  p_phase       text,
  p_group_label text,
  p_kickoff     timestamptz,
  p_home_team   uuid,
  p_away_team   uuid,
  p_home_label  text,
  p_away_label  text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role text; v_id uuid;
BEGIN
  SELECT role INTO v_role FROM members WHERE auth_user_id = auth.uid();
  IF v_role <> 'admin' THEN RAISE EXCEPTION 'not_admin'; END IF;

  INSERT INTO wm_matches (match_no, phase, group_label, kickoff, home_team_id, away_team_id, home_label, away_label)
  VALUES (p_match_no, p_phase, p_group_label, p_kickoff, p_home_team, p_away_team, p_home_label, p_away_label)
  ON CONFLICT (match_no) DO UPDATE SET
    phase        = EXCLUDED.phase,
    group_label  = EXCLUDED.group_label,
    kickoff      = EXCLUDED.kickoff,
    home_team_id = EXCLUDED.home_team_id,
    away_team_id = EXCLUDED.away_team_id,
    home_label   = EXCLUDED.home_label,
    away_label   = EXCLUDED.away_label
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Vorrunden-Tabelle berechnen (Punkte: S=3, U=1, N=0; Tiebreaker: Differenz, Tore)
CREATE OR REPLACE FUNCTION wm_group_standings(p_group text)
RETURNS TABLE(
  team_id      uuid,
  team_name    text,
  flag         text,
  played       int,
  won          int,
  drawn        int,
  lost         int,
  goals_for    int,
  goals_against int,
  goal_diff    int,
  points       int
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH played AS (
    SELECT t.id AS team_id, t.name AS team_name, t.flag,
           m.score_home, m.score_away,
           CASE WHEN m.home_team_id = t.id THEN 'home' ELSE 'away' END AS side
    FROM wm_teams t
    JOIN wm_matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
    WHERE t.group_label = p_group
      AND m.phase = 'group'
      AND m.score_home IS NOT NULL
      AND m.score_away IS NOT NULL
  ), summed AS (
    SELECT team_id, team_name, flag,
      COUNT(*)::int AS played,
      SUM(CASE WHEN (side='home' AND score_home > score_away) OR (side='away' AND score_away > score_home) THEN 1 ELSE 0 END)::int AS won,
      SUM(CASE WHEN score_home = score_away THEN 1 ELSE 0 END)::int AS drawn,
      SUM(CASE WHEN (side='home' AND score_home < score_away) OR (side='away' AND score_away < score_home) THEN 1 ELSE 0 END)::int AS lost,
      SUM(CASE WHEN side='home' THEN score_home ELSE score_away END)::int AS goals_for,
      SUM(CASE WHEN side='home' THEN score_away ELSE score_home END)::int AS goals_against
    FROM played
    GROUP BY team_id, team_name, flag
  )
  SELECT team_id, team_name, flag, played, won, drawn, lost,
         goals_for, goals_against, (goals_for - goals_against) AS goal_diff,
         (won*3 + drawn) AS points
  FROM summed
  ORDER BY points DESC, (goals_for - goals_against) DESC, goals_for DESC, team_name ASC;
$$;

-- Leaderboard (alle Mitglieder mit Tipspiel-Punkten)
CREATE OR REPLACE FUNCTION get_wm_leaderboard()
RETURNS TABLE(
  member_id      uuid,
  name           text,
  sauna_name     text,
  total_points   int,
  match_points   int,
  champion_bonus int,
  group_bonus    int,
  streak_bonus   int,
  tips_total     int,
  tips_correct   int
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH match_pts AS (
    SELECT t.member_id,
           COALESCE(SUM(t.points_earned), 0)::int AS pts,
           COUNT(*) FILTER (WHERE t.points_earned > 0)::int AS correct,
           COUNT(*)::int AS total
    FROM wm_tips t
    GROUP BY t.member_id
  ), streak_calc AS (
    -- Vereinfachung: +2 wenn min. 3 in Folge richtig, +5 wenn 5 in Folge.
    -- Berechne längste aktuelle Streak chronologisch.
    SELECT t.member_id,
      CASE
        WHEN MAX(streak_len) >= 5 THEN 5
        WHEN MAX(streak_len) >= 3 THEN 2
        ELSE 0
      END AS streak_bonus
    FROM (
      SELECT member_id,
             SUM(CASE WHEN points_earned > 0 THEN 1 ELSE 0 END) OVER (PARTITION BY member_id, grp) AS streak_len
      FROM (
        SELECT t2.member_id, t2.points_earned,
               SUM(CASE WHEN t2.points_earned > 0 THEN 0 ELSE 1 END)
                 OVER (PARTITION BY t2.member_id ORDER BY m.kickoff) AS grp
        FROM wm_tips t2 JOIN wm_matches m ON m.id = t2.match_id
        WHERE m.locked = true
      ) sub
    ) t
    GROUP BY t.member_id
  )
  SELECT m.id, m.name, m.sauna_name,
    (COALESCE(mp.pts,0) + COALESCE(meta.champion_bonus_earned,0) + COALESCE(meta.group_bonus_earned,0) + COALESCE(sc.streak_bonus,0))::int AS total_points,
    COALESCE(mp.pts,0)::int AS match_points,
    COALESCE(meta.champion_bonus_earned,0)::int AS champion_bonus,
    COALESCE(meta.group_bonus_earned,0)::int AS group_bonus,
    COALESCE(sc.streak_bonus,0)::int AS streak_bonus,
    COALESCE(mp.total,0)::int AS tips_total,
    COALESCE(mp.correct,0)::int AS tips_correct
  FROM members m
  LEFT JOIN match_pts mp ON mp.member_id = m.id
  LEFT JOIN wm_meta_tips meta ON meta.member_id = m.id
  LEFT JOIN streak_calc sc ON sc.member_id = m.id
  WHERE m.approved = true AND m.revoked_at IS NULL
    AND (mp.pts IS NOT NULL OR meta.member_id IS NOT NULL)
  ORDER BY total_points DESC, m.name ASC;
$$;

-- Mitglieder die zu einem Match noch keinen Tipp haben (für Admin-Anstupser)
CREATE OR REPLACE FUNCTION wm_pending_tippers(p_match_id uuid)
RETURNS TABLE(member_id uuid, name text) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT m.id, m.name FROM members m
  WHERE m.approved = true AND m.revoked_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM wm_tips t WHERE t.member_id = m.id AND t.match_id = p_match_id)
  ORDER BY m.name;
$$;
