-- 0137 — Bewerten am Eingangs-Tablet, OHNE Login. Plus: eine Bewertung pro Stunde.
--
-- ═══ Warum das dringend war ═══
-- handlePinCheckin erzeugte für den eingetippten PIN einen Magic-Link und
-- meldete das Tablet damit als diese Person an. /checkin/rate las anschließend
-- useCurrentMember() — also eine vollwertige Session auf einem öffentlich
-- zugänglichen Gerät. Wer nach dem PIN nicht auf den Auto-Logout wartete,
-- sondern herumtippte, stand im Profil, in den Direktnachrichten und in den
-- Einstellungen einer fremden Person. Ein 4-stelliger PIN öffnete das ganze
-- Konto.
--
-- Ab jetzt: der PIN ist am Tablet nur noch Ausweis für zwei eng gefasste
-- Vorgänge — anwesend setzen und bewerten. Keine Session, kein auth.uid(),
-- kein Zugriff auf sonst irgendetwas.
--
-- ═══ Zugriffsschutz ═══
-- Die Funktionen hier sind bewusst NICHT für anon freigegeben. Sie laufen
-- ausschließlich über /api/qr-signin mit dem service_role-Schlüssel — dort
-- sitzt der IP-Rate-Limiter (10 Anfragen pro Minute). Wären sie anon-fähig,
-- könnte man einen 4-stelligen PIN direkt über PostgREST durchprobieren:
-- 9000 Möglichkeiten sind in Minuten durch.

-- ── 1. Eine Bewertung pro Stunde ──────────────────────────────────────────
-- Laufen um 17 Uhr drei Saunen parallel, war der Gast in genau einer davon.
-- Ein Banja von 17 bis 19 Uhr belegt entsprechend ZWEI Stunden.
--
-- Umgesetzt als eigene Tabelle statt als Spalte: ein mehrstündiger Aufguss
-- belegt mehrere Stunden, das passt nicht in einen Wert. Der eindeutige
-- Index ist die eigentliche Regel — die Oberfläche zeigt sie nur an. Sonst
-- könnte man am Tablet und gleichzeitig in der App zwei Aufgüsse derselben
-- Stunde bewerten.
CREATE TABLE IF NOT EXISTS public.bewertungs_stunden (
  rating_id uuid NOT NULL REFERENCES public.infusion_ratings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Berliner Ortszeit, auf die volle Stunde abgeschnitten. Bewusst ohne
  -- Zeitzone: es geht um „die 17-Uhr-Runde", nicht um einen Zeitpunkt.
  stunde    timestamp NOT NULL,
  PRIMARY KEY (rating_id, stunde)
);

CREATE UNIQUE INDEX IF NOT EXISTS bewertungs_stunden_eine_pro_stunde
  ON public.bewertungs_stunden (member_id, stunde);

ALTER TABLE public.bewertungs_stunden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bewertungs_stunden_read ON public.bewertungs_stunden;
CREATE POLICY bewertungs_stunden_read ON public.bewertungs_stunden
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid())
    OR public.is_admin()
  );

-- Welche Stunden belegt ein Aufguss? 17:00–17:20 → nur 17. 17:00–19:00 → 17 und 18.
CREATE OR REPLACE FUNCTION public.aufguss_stunden(p_infusion_id uuid)
RETURNS SETOF timestamp
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT generate_series(
           date_trunc('hour', i.start_time AT TIME ZONE 'Europe/Berlin'),
           (i.end_time AT TIME ZONE 'Europe/Berlin') - interval '1 second',
           interval '1 hour')
  FROM public.infusions i WHERE i.id = p_infusion_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_bewertungs_stunden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Erst die eigenen Zeilen weg, sonst kollidiert eine Änderung mit sich selbst.
  DELETE FROM public.bewertungs_stunden WHERE rating_id = NEW.id;
  INSERT INTO public.bewertungs_stunden (rating_id, member_id, stunde)
  SELECT NEW.id, NEW.member_id, s FROM public.aufguss_stunden(NEW.infusion_id) s;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bewertungs_stunden ON public.infusion_ratings;
CREATE TRIGGER trg_bewertungs_stunden
  AFTER INSERT OR UPDATE OF infusion_id, member_id ON public.infusion_ratings
  FOR EACH ROW EXECUTE FUNCTION public.sync_bewertungs_stunden();

-- Bestand nachtragen (geprüft: 0 Kollisionen bei 79 Bewertungen).
INSERT INTO public.bewertungs_stunden (rating_id, member_id, stunde)
SELECT r.id, r.member_id, s
FROM public.infusion_ratings r, public.aufguss_stunden(r.infusion_id) s
ON CONFLICT DO NOTHING;

-- ── 2. Hilfsfunktion: Mitglied zum PIN ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mitglied_zu_pin(p_pin text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT m.id FROM public.members m
   WHERE m.checkin_pin = p_pin
     AND m.approved = true
     AND m.revoked_at IS NULL
   LIMIT 1;
$$;

-- ── 3. Check-in am Tablet (setzt NUR, schaltet nie ab) ────────────────────
-- Bewusst kein Toggle: der PIN wird beim zweiten Mal zum Bewerten eingetippt,
-- und niemand soll sich dabei versehentlich auschecken. Die Anwesenheitsliste
-- ist zugleich die Evakuierungsliste.
CREATE OR REPLACE FUNCTION public.kiosk_checkin(p_pin text)
RETURNS TABLE(member_id uuid, name text, war_schon_da boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid; v_war boolean; v_name text;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RAISE EXCEPTION 'pin_unbekannt'; END IF;

  SELECT m.is_present, m.name INTO v_war, v_name FROM public.members m WHERE m.id = v_id;

  UPDATE public.members
     SET is_present = true, last_scan_at = now()
   WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_name, coalesce(v_war, false);
END; $$;

-- ── 4. Was kann dieser PIN gerade bewerten? ───────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_ratable(p_pin text)
RETURNS TABLE(id uuid, title text, sauna_name text, sauna_farbe text,
              meister_name text, start_time timestamptz, end_time timestamptz,
              schon_bewertet boolean, stunde_belegt boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RAISE EXCEPTION 'pin_unbekannt'; END IF;

  RETURN QUERY
  SELECT i.id, i.title, s.name, s.accent_color, m.name, i.start_time, i.end_time,
         EXISTS (SELECT 1 FROM public.infusion_ratings r
                  WHERE r.infusion_id = i.id AND r.member_id = v_id) AS schon_bewertet,
         -- Eine der belegten Stunden ist schon durch einen ANDEREN Aufguss weg
         EXISTS (SELECT 1
                   FROM public.aufguss_stunden(i.id) st
                   JOIN public.bewertungs_stunden bs
                     ON bs.stunde = st AND bs.member_id = v_id
                   JOIN public.infusion_ratings rr ON rr.id = bs.rating_id
                  WHERE rr.infusion_id <> i.id) AS stunde_belegt
  FROM public.infusions i
  JOIN public.members m ON m.id = i.saunameister_id
  LEFT JOIN public.saunas s ON s.id = i.sauna_id
  WHERE i.end_time < now()
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> v_id
    AND coalesce(i.is_personal_fallback, false) = false
    AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date
        = (now() AT TIME ZONE 'Europe/Berlin')::date
  ORDER BY i.end_time DESC;
END; $$;

-- ── 5. Bewerten am Tablet ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_submit_rating(
  p_pin text, p_infusion_id uuid,
  p_chemie smallint, p_luftbewegung smallint, p_wedeltechnik smallint,
  p_hitzeniveau smallint, p_musik smallint, p_duftentwicklung smallint,
  p_comment text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid; v_start timestamptz; v_end timestamptz; v_meister uuid;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RETURN 'pin_unbekannt'; END IF;

  SELECT start_time, end_time, saunameister_id
    INTO v_start, v_end, v_meister
    FROM public.infusions WHERE id = p_infusion_id;
  IF v_end IS NULL THEN RETURN 'aufguss_unbekannt'; END IF;
  IF v_meister = v_id THEN RETURN 'eigener_aufguss'; END IF;
  IF now() < v_end THEN RETURN 'noch_nicht_zu_ende'; END IF;

  -- Am Tablet nur der laufende Tag. Wer später von zuhause nachbewerten will,
  -- macht das in der App — dort gilt das normale Fenster bis Folgetag 12 Uhr.
  IF (v_start AT TIME ZONE 'Europe/Berlin')::date
     <> (now() AT TIME ZONE 'Europe/Berlin')::date THEN
    RETURN 'nicht_von_heute';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.attendance_events
                  WHERE member_id = v_id
                    AND date = (v_start AT TIME ZONE 'Europe/Berlin')::date) THEN
    RETURN 'nicht_anwesend_gewesen';
  END IF;

  INSERT INTO public.infusion_ratings
    (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
     hitzeniveau, musik, duftentwicklung, comment)
  VALUES
    (p_infusion_id, v_id, p_chemie, p_luftbewegung, p_wedeltechnik,
     p_hitzeniveau, p_musik, p_duftentwicklung, nullif(btrim(coalesce(p_comment,'')),''))
  ON CONFLICT (infusion_id, member_id) DO UPDATE SET
    chemie = excluded.chemie, luftbewegung = excluded.luftbewegung,
    wedeltechnik = excluded.wedeltechnik, hitzeniveau = excluded.hitzeniveau,
    musik = excluded.musik, duftentwicklung = excluded.duftentwicklung,
    comment = excluded.comment;

  RETURN 'ok';
EXCEPTION
  WHEN unique_violation THEN
    -- Kommt aus bewertungs_stunden: in dieser Stunde ist schon ein anderer
    -- Aufguss bewertet. Man war schließlich nur in einer Sauna.
    RETURN 'stunde_schon_bewertet';
END; $$;

-- ── 6. Grants: NUR service_role. Nicht anon, nicht authenticated. ─────────
REVOKE ALL ON FUNCTION public.kiosk_checkin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kiosk_ratable(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kiosk_submit_rating(text, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mitglied_zu_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_checkin(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_ratable(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_submit_rating(text, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mitglied_zu_pin(text) TO service_role;

-- aufguss_stunden wird von kiosk_ratable aufgerufen und ist harmlos (nur Zeiten),
-- bleibt aber ebenfalls dem Server vorbehalten.
REVOKE ALL ON FUNCTION public.aufguss_stunden(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aufguss_stunden(uuid) TO service_role, authenticated;
