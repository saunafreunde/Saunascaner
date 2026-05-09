-- Phase 7H+ — Helper-RPCs für Push-Reminder-Cron

-- 1) WM-Tipp-Reminder: Mitglieder mit Push-Sub die in den nächsten N Stunden anpfeifenden Spielen
--    noch nicht getippt haben
CREATE OR REPLACE FUNCTION wm_pending_tip_reminders(p_within_hours int DEFAULT 12)
RETURNS TABLE(
  member_id   uuid,
  member_name text,
  match_id    uuid,
  match_no    int,
  kickoff     timestamptz,
  home_label  text,
  away_label  text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT m.id, m.name, mt.id, mt.match_no, mt.kickoff,
    COALESCE((SELECT name FROM wm_teams WHERE id = mt.home_team_id), mt.home_label, '?') AS home_label,
    COALESCE((SELECT name FROM wm_teams WHERE id = mt.away_team_id), mt.away_label, '?') AS away_label
  FROM members m
  CROSS JOIN wm_matches mt
  WHERE m.approved = true AND m.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.member_id = m.id)
    AND mt.kickoff > NOW()
    AND mt.kickoff <= NOW() + (p_within_hours || ' hours')::interval
    AND NOT mt.locked
    AND NOT EXISTS (
      SELECT 1 FROM wm_tips t WHERE t.member_id = m.id AND t.match_id = mt.id
    );
$$;

-- 2) Bewertungs-Reminder: anwesende Mitglieder mit Push-Sub, Aufguss in den letzten 3h
--    beendet, noch nicht bewertet, kein Eigenaufguss
CREATE OR REPLACE FUNCTION rating_pending_reminders()
RETURNS TABLE(
  member_id     uuid,
  member_name   text,
  infusion_id   uuid,
  infusion_title text,
  end_time      timestamptz,
  meister_name  text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT m.id, m.name, i.id, i.title, i.end_time,
    COALESCE((SELECT name FROM members WHERE id = i.saunameister_id), 'Saunameister:in') AS meister_name
  FROM members m
  CROSS JOIN infusions i
  WHERE m.approved = true AND m.revoked_at IS NULL AND m.is_present = true
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.member_id = m.id)
    AND i.end_time < NOW()
    AND i.end_time > NOW() - INTERVAL '3 hours'
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> m.id
    AND NOT EXISTS (
      SELECT 1 FROM infusion_ratings r WHERE r.member_id = m.id AND r.infusion_id = i.id
    );
$$;
