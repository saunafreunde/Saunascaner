-- 0167 — Saunafest: Meldeschluss (Vorgabe Christoph 24.09.2026: „Do 18 Uhr ist
-- Meldeschluss, baue auch einen Timer in der App ein, dass man sofort sieht,
-- ob und bis wann man noch eine Rückmeldung geben kann").
--
--   saunafest_tage.meldeschluss   Standard: der Donnerstag vor dem Fest, 18:00
--                                 Berlin (Fest am Samstag → zwei Tage vorher).
--                                 Neue Feste bekommen ihn per Trigger; der Admin
--                                 kann ihn je Fest verschieben.
--   Nach dem Meldeschluss lehnen saunafest_zeitraum_setzen / _loeschen für
--   Nicht-Admins ab — auch ältere App-Stände können dann nichts mehr ändern.
--   Einteilen, Plan bestätigen usw. bleiben für den Admin offen.
--   Die Erinnerung nennt den Meldeschluss.
--
-- Funktionen: Fassungen aus 0163 als Vorlage — neu ist nur die Meldeschluss-
-- Prüfung (bzw. der Text in saunafest_erinnern).

ALTER TABLE public.saunafest_tage ADD COLUMN IF NOT EXISTS meldeschluss timestamptz;

-- Donnerstag vor (oder am) Festtag, 18:00 Berlin.
CREATE OR REPLACE FUNCTION public.saunafest_meldeschluss_standard(p_datum date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((p_datum - ((extract(dow FROM p_datum)::int - 4 + 7) % 7)) + time '18:00') AT TIME ZONE 'Europe/Berlin';
$$;
REVOKE ALL ON FUNCTION public.saunafest_meldeschluss_standard(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saunafest_meldeschluss_standard(date) TO authenticated;

UPDATE public.saunafest_tage SET meldeschluss = public.saunafest_meldeschluss_standard(datum) WHERE meldeschluss IS NULL;

CREATE OR REPLACE FUNCTION public.saunafest_tage_meldeschluss_setzen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.meldeschluss IS NULL OR (TG_OP = 'UPDATE' AND NEW.datum IS DISTINCT FROM OLD.datum AND NEW.meldeschluss IS NOT DISTINCT FROM OLD.meldeschluss) THEN
    NEW.meldeschluss := public.saunafest_meldeschluss_standard(NEW.datum);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_saunafest_tage_meldeschluss ON public.saunafest_tage;
CREATE TRIGGER trg_saunafest_tage_meldeschluss
  BEFORE INSERT OR UPDATE OF datum, meldeschluss ON public.saunafest_tage
  FOR EACH ROW EXECUTE FUNCTION public.saunafest_tage_meldeschluss_setzen();

-- „Do 08.10., 18:00 Uhr"
CREATE OR REPLACE FUNCTION public.saunafest_meldeschluss_text(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.saunafest_datum_kurz((p_ts AT TIME ZONE 'Europe/Berlin')::date) || ', '
         || to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr';
$$;
REVOKE ALL ON FUNCTION public.saunafest_meldeschluss_text(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saunafest_meldeschluss_text(timestamptz) TO authenticated;

-- ── Eigener Zeitraum: nach dem Meldeschluss nur noch über den Admin ─────
CREATE OR REPLACE FUNCTION public.saunafest_zeitraum_setzen(p_datum date, p_von time, p_bis time, p_lieblings_sauna uuid DEFAULT NULL, p_max smallint DEFAULT NULL, p_notiz text DEFAULT NULL)
RETURNS public.saunafest_verfuegbarkeit LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
DECLARE v_me public.members%rowtype; v_notiz text := nullif(btrim(coalesce(p_notiz, '')), ''); v_konf record; v_row public.saunafest_verfuegbarkeit%rowtype; v_schluss timestamptz;
BEGIN
  SELECT * INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Bitte zuerst anmelden.'; END IF;
  IF v_me.revoked_at IS NOT NULL OR v_me.role = 'gast' THEN RAISE EXCEPTION 'Gäste können sich fürs Saunafest nicht eintragen.'; END IF;
  SELECT meldeschluss INTO v_schluss FROM public.saunafest_tage WHERE datum = p_datum;
  IF NOT FOUND THEN RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.'; END IF;
  IF p_datum < ((now() AT TIME ZONE 'Europe/Berlin'))::date THEN RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.'; END IF;
  IF v_schluss IS NOT NULL AND now() > v_schluss AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Meldeschluss war %. Für Änderungen wende dich bitte an den Admin.', public.saunafest_meldeschluss_text(v_schluss);
  END IF;
  IF p_von IS NULL OR p_bis IS NULL OR p_von > p_bis THEN RAISE EXCEPTION 'Bitte einen Zeitraum wählen: „von“ muss vor „bis“ liegen.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_von) OR NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_bis) THEN
    RAISE EXCEPTION 'Von und bis müssen Aufguss-Zeiten des Festes sein.'; END IF;
  IF p_lieblings_sauna IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.sauna_id = p_lieblings_sauna) THEN RAISE EXCEPTION 'Diese Sauna läuft am Fest nicht.'; END IF;
  IF p_max IS NOT NULL AND (p_max < 1 OR p_max > 20) THEN RAISE EXCEPTION 'Höchstzahl der Aufgüsse: 1 bis 20.'; END IF;
  IF char_length(v_notiz) > 300 THEN RAISE EXCEPTION 'Der Hinweis ist zu lang (höchstens 300 Zeichen).'; END IF;
  SELECT to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr, s.name AS sauna INTO v_konf
    FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = v_me.id AND NOT i.is_personal_fallback AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
     AND ((i.start_time AT TIME ZONE 'Europe/Berlin')::time < p_von OR (i.start_time AT TIME ZONE 'Europe/Berlin')::time > p_bis)
   ORDER BY i.start_time LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Du bist schon um % Uhr (%) eingeteilt — diese Zeit muss im Zeitraum bleiben. Zum Austragen sprich bitte mit dem Admin.', v_konf.uhr, v_konf.sauna; END IF;
  INSERT INTO public.saunafest_verfuegbarkeit AS v (fest_datum, member_id, von, bis, lieblings_sauna_id, max_aufguesse, notiz)
  VALUES (p_datum, v_me.id, p_von, p_bis, p_lieblings_sauna, p_max, v_notiz)
  ON CONFLICT (fest_datum, member_id) DO UPDATE SET von = EXCLUDED.von, bis = EXCLUDED.bis, lieblings_sauna_id = EXCLUDED.lieblings_sauna_id,
     max_aufguesse = EXCLUDED.max_aufguesse, notiz = EXCLUDED.notiz, updated_at = now()
  RETURNING v.* INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.saunafest_zeitraum_loeschen(p_datum date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
DECLARE v_me public.members%rowtype; v_konf record; v_schluss timestamptz;
BEGIN
  SELECT * INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Bitte zuerst anmelden.'; END IF;
  SELECT meldeschluss INTO v_schluss FROM public.saunafest_tage WHERE datum = p_datum;
  IF v_schluss IS NOT NULL AND now() > v_schluss AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Meldeschluss war %. Zum Austragen wende dich bitte an den Admin.', public.saunafest_meldeschluss_text(v_schluss);
  END IF;
  SELECT to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr, s.name AS sauna INTO v_konf
    FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = v_me.id AND NOT i.is_personal_fallback AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
   ORDER BY i.start_time LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Du bist schon um % Uhr (%) eingeteilt. Zum Austragen sprich bitte mit dem Admin.', v_konf.uhr, v_konf.sauna; END IF;
  DELETE FROM public.saunafest_verfuegbarkeit WHERE fest_datum = p_datum AND member_id = v_me.id;
END; $$;

-- ── Erinnerung nennt den Meldeschluss ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_erinnern(p_datum date) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
DECLARE v_n int; v_heute date := ((now() AT TIME ZONE 'Europe/Berlin'))::date; v_motto text; v_schluss timestamptz; v_text text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Erinnern darf nur ein Admin.'; END IF;
  SELECT motto, meldeschluss INTO v_motto, v_schluss FROM public.saunafest_tage WHERE datum = p_datum;
  IF NOT FOUND THEN RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.'; END IF;
  IF p_datum < v_heute THEN RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.'; END IF;
  v_text := 'Wann hättest du Zeit für einen Aufguss? Trag deinen Zeitraum und deine Lieblingssauna im Planer ein.'
            || CASE WHEN v_schluss IS NOT NULL AND v_schluss > now()
                    THEN ' Meldeschluss: ' || public.saunafest_meldeschluss_text(v_schluss) || '.' ELSE '' END;
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  SELECT 'saunafest_erinnerung', m.id, jsonb_build_object('title', '🔥 Saunafest ' || public.saunafest_datum_kurz(p_datum) || ' · ' || coalesce(v_motto, ''),
           'body', v_text, 'url', '/planner#saunafest'),
         'saunafest_erinnerung:' || p_datum::text || ':' || m.id::text || ':' || v_heute::text
    FROM public.members m
   WHERE m.revoked_at IS NULL AND m.role <> 'gast' AND (m.is_aufgieser OR m.role = 'guest_aufgieser')
     AND NOT EXISTS (SELECT 1 FROM public.saunafest_verfuegbarkeit v WHERE v.fest_datum = p_datum AND v.member_id = m.id)
     AND NOT EXISTS (SELECT 1 FROM public.notification_queue q WHERE q.dedup_key = 'saunafest_erinnerung:' || p_datum::text || ':' || m.id::text || ':' || v_heute::text)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END; $$;

-- ── Admin: Meldeschluss je Fest verschieben ──────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_meldeschluss_aendern(p_datum date, p_meldeschluss timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Den Meldeschluss ändern darf nur ein Admin.'; END IF;
  IF p_meldeschluss IS NULL THEN RAISE EXCEPTION 'Bitte einen Zeitpunkt wählen.'; END IF;
  IF (p_meldeschluss AT TIME ZONE 'Europe/Berlin')::date > p_datum THEN
    RAISE EXCEPTION 'Der Meldeschluss muss vor dem Fest liegen.';
  END IF;
  UPDATE public.saunafest_tage SET meldeschluss = p_meldeschluss WHERE datum = p_datum;
  IF NOT FOUND THEN RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.saunafest_meldeschluss_aendern(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saunafest_meldeschluss_aendern(date, timestamptz) TO authenticated;
