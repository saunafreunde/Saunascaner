-- 0163 — Saunafest: Zeitraum statt Einzel-Slots, Lieblingssauna, Tagesübersicht.
--
-- Vorgabe Christoph 23.09.2026: „Beim Saunafest soll nur der Zeitraum gewählt
-- werden können. Danach sieht man nur noch die Tagesübersicht, wie viele wann
-- verfügbar wären, mit Zahlen pro Uhrzeitblock. Zusätzlich gibt man seine
-- Lieblingssauna an. Der Planer fürs Saunafest wird ein eigener Bereich,
-- getrennt vom Tagesplaner." Einteilen bleibt Admin-Sache (0162).
--
-- Neu:
--   saunafest_verfuegbarkeit   je Person und Fest EIN Zeitraum (von/bis = erster
--                              und letzter Aufguss-Slot, den sie übernehmen könnte),
--                              Lieblingssauna (NULL = egal), höchstens N Aufgüsse,
--                              Hinweis/Wünsche an den Admin (max. 300 Zeichen,
--                              Nachtrag Christoph 24.09.2026). Schreiben nur über RPCs.
--   saunafest_zeitraum_setzen / _loeschen   eigener Eintrag; wer schon eingeteilt
--                              ist, kann den Zeitraum nicht an der Einteilung
--                              vorbei verkleinern (sonst entstünden stille Lücken).
--   saunafest_uebersicht       je Uhrzeitblock: Bedarf (Saunen), verfügbar,
--                              eingeteilt, Lieblingssaunen — nur Zahlen, keine Namen.
--   saunafest_einteilen / _austeilen   Admin legt den Aufguss an bzw. nimmt ihn
--                              zurück; die Person bekommt Push + Posteingang.
--   saunafest_erinnern         Admin erinnert Aufgießer ohne Eintrag.
--   saunafest_plan_bestaetigen Nachtrag Christoph 24.09.2026: der Admin teilt erst
--                              in Ruhe ein (Entwurf, niemand wird angepingt) und
--                              bestätigt dann den Plan. Erst DANN erfährt jeder, der
--                              einen Zeitraum eingetragen hat, ob und wann er dran
--                              ist, und sieht den fertigen Plan. Änderungen nach
--                              der Bestätigung gehen sofort an die Betroffenen.
--
-- saunafest_bewerbungen (0151) bleibt als Archiv stehen. Offene Bewerbungen
-- werden einmalig in Zeiträume übernommen; ein Trigger übersetzt Bewerbungen,
-- die ein noch nicht aktualisiertes App-Bundle schickt, weiter in Zeiträume.

-- ── Tabelle ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saunafest_verfuegbarkeit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fest_datum          date NOT NULL REFERENCES public.saunafest_tage(datum) ON DELETE CASCADE,
  member_id           uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  von                 time NOT NULL,
  bis                 time NOT NULL,
  lieblings_sauna_id  uuid REFERENCES public.saunas(id) ON DELETE SET NULL,
  max_aufguesse       smallint CHECK (max_aufguesse BETWEEN 1 AND 20),
  notiz               text CHECK (char_length(notiz) <= 300),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saunafest_verfuegbarkeit_eine_je_fest UNIQUE (fest_datum, member_id),
  CONSTRAINT saunafest_verfuegbarkeit_reihenfolge CHECK (von <= bis)
);

ALTER TABLE public.saunafest_verfuegbarkeit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saunafest_verfuegbarkeit FROM PUBLIC, anon;
GRANT SELECT ON public.saunafest_verfuegbarkeit TO authenticated;

-- Lesen: den eigenen Eintrag, der Admin alle. Andere Mitglieder sehen nur
-- die Zahlen aus saunafest_uebersicht — keine Namen.
DROP POLICY IF EXISTS saunafest_verfuegbarkeit_lesen ON public.saunafest_verfuegbarkeit;
CREATE POLICY saunafest_verfuegbarkeit_lesen ON public.saunafest_verfuegbarkeit
  FOR SELECT TO authenticated
  USING (
    member_id = (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid())
    OR public.is_admin()
  );

DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                        AND tablename = 'saunafest_verfuegbarkeit') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saunafest_verfuegbarkeit;
  END IF;
END $pub$;

-- Planbestätigung je Fest (NULL = der Plan ist noch Entwurf).
ALTER TABLE public.saunafest_tage
  ADD COLUMN IF NOT EXISTS plan_bestaetigt_at  timestamptz,
  ADD COLUMN IF NOT EXISTS plan_bestaetigt_von uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- ── Übernahme der offenen Bewerbungen (0151/0162) ────────────────────────
INSERT INTO public.saunafest_verfuegbarkeit (fest_datum, member_id, von, bis, lieblings_sauna_id, created_at)
SELECT b.fest_datum, b.member_id, min(b.slot_zeit), max(b.slot_zeit),
       mode() WITHIN GROUP (ORDER BY b.sauna_id), min(b.created_at)
  FROM public.saunafest_bewerbungen b
 WHERE b.status = 'offen'
   AND b.fest_datum >= ((now() AT TIME ZONE 'Europe/Berlin'))::date
 GROUP BY b.fest_datum, b.member_id
ON CONFLICT (fest_datum, member_id) DO NOTHING;

-- ── Alte App-Bundles: Bewerbung → Zeitraum erweitern ─────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_bewerbung_als_zeitraum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'offen' THEN
    INSERT INTO public.saunafest_verfuegbarkeit (fest_datum, member_id, von, bis, lieblings_sauna_id)
    VALUES (NEW.fest_datum, NEW.member_id, NEW.slot_zeit, NEW.slot_zeit, NEW.sauna_id)
    ON CONFLICT (fest_datum, member_id) DO UPDATE
      SET von = LEAST(public.saunafest_verfuegbarkeit.von, EXCLUDED.von),
          bis = GREATEST(public.saunafest_verfuegbarkeit.bis, EXCLUDED.bis),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.saunafest_bewerbung_als_zeitraum() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_saunafest_bewerbung_als_zeitraum ON public.saunafest_bewerbungen;
CREATE TRIGGER trg_saunafest_bewerbung_als_zeitraum
  AFTER INSERT ON public.saunafest_bewerbungen
  FOR EACH ROW EXECUTE FUNCTION public.saunafest_bewerbung_als_zeitraum();

-- ── Hilfen ───────────────────────────────────────────────────────────────
-- „Sa 10.10." ohne Abhängigkeit von lc_time.
CREATE OR REPLACE FUNCTION public.saunafest_datum_kurz(p_datum date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ARRAY['So','Mo','Di','Mi','Do','Fr','Sa'])[extract(dow FROM p_datum)::int + 1]
         || ' ' || to_char(p_datum, 'DD.MM.');
$$;

-- ── Eigener Zeitraum ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_zeitraum_setzen(
  p_datum           date,
  p_von             time,
  p_bis             time,
  p_lieblings_sauna uuid     DEFAULT NULL,
  p_max             smallint DEFAULT NULL,
  p_notiz           text     DEFAULT NULL
)
RETURNS public.saunafest_verfuegbarkeit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_me     public.members%rowtype;
  v_notiz  text := nullif(btrim(coalesce(p_notiz, '')), '');
  v_konf   record;
  v_row    public.saunafest_verfuegbarkeit%rowtype;
BEGIN
  SELECT * INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Bitte zuerst anmelden.'; END IF;
  IF v_me.revoked_at IS NOT NULL OR v_me.role = 'gast' THEN
    RAISE EXCEPTION 'Gäste können sich fürs Saunafest nicht eintragen.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum) THEN
    RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.';
  END IF;
  IF p_datum < ((now() AT TIME ZONE 'Europe/Berlin'))::date THEN
    RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.';
  END IF;
  IF p_von IS NULL OR p_bis IS NULL OR p_von > p_bis THEN
    RAISE EXCEPTION 'Bitte einen Zeitraum wählen: „von“ muss vor „bis“ liegen.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_von)
     OR NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_bis) THEN
    RAISE EXCEPTION 'Von und bis müssen Aufguss-Zeiten des Festes sein.';
  END IF;
  IF p_lieblings_sauna IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.sauna_id = p_lieblings_sauna) THEN
    RAISE EXCEPTION 'Diese Sauna läuft am Fest nicht.';
  END IF;
  IF p_max IS NOT NULL AND (p_max < 1 OR p_max > 20) THEN
    RAISE EXCEPTION 'Höchstzahl der Aufgüsse: 1 bis 20.';
  END IF;
  IF char_length(v_notiz) > 300 THEN
    RAISE EXCEPTION 'Der Hinweis ist zu lang (höchstens 300 Zeichen).';
  END IF;

  -- Wer schon eingeteilt ist, darf den Zeitraum nicht an der Einteilung vorbei
  -- verkleinern — sonst stünde ein Aufguss ohne Verfügbarkeit im Plan.
  SELECT to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr, s.name AS sauna
    INTO v_konf
    FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = v_me.id
     AND NOT i.is_personal_fallback
     AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
     AND ((i.start_time AT TIME ZONE 'Europe/Berlin')::time < p_von
          OR (i.start_time AT TIME ZONE 'Europe/Berlin')::time > p_bis)
   ORDER BY i.start_time
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Du bist schon um % Uhr (%) eingeteilt — diese Zeit muss im Zeitraum bleiben. Zum Austragen sprich bitte mit dem Admin.',
      v_konf.uhr, v_konf.sauna;
  END IF;

  INSERT INTO public.saunafest_verfuegbarkeit AS v
         (fest_datum, member_id, von, bis, lieblings_sauna_id, max_aufguesse, notiz)
  VALUES (p_datum, v_me.id, p_von, p_bis, p_lieblings_sauna, p_max, v_notiz)
  ON CONFLICT (fest_datum, member_id) DO UPDATE
     SET von = EXCLUDED.von, bis = EXCLUDED.bis,
         lieblings_sauna_id = EXCLUDED.lieblings_sauna_id,
         max_aufguesse = EXCLUDED.max_aufguesse,
         notiz = EXCLUDED.notiz,
         updated_at = now()
  RETURNING v.* INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.saunafest_zeitraum_loeschen(p_datum date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_me   public.members%rowtype;
  v_konf record;
BEGIN
  SELECT * INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Bitte zuerst anmelden.'; END IF;

  SELECT to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr, s.name AS sauna
    INTO v_konf
    FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = v_me.id
     AND NOT i.is_personal_fallback
     AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
   ORDER BY i.start_time
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Du bist schon um % Uhr (%) eingeteilt. Zum Austragen sprich bitte mit dem Admin.',
      v_konf.uhr, v_konf.sauna;
  END IF;

  DELETE FROM public.saunafest_verfuegbarkeit WHERE fest_datum = p_datum AND member_id = v_me.id;
END;
$$;

-- ── Tagesübersicht: nur Zahlen ───────────────────────────────────────────
-- LANGUAGE sql: die Ausgabespalten (zeit …) kollidieren so nicht mit den
-- gleichnamigen Spalten von saunafest_slots().
CREATE OR REPLACE FUNCTION public.saunafest_uebersicht(p_datum date)
RETURNS TABLE (
  zeit        time,
  saunen      uuid[],
  bedarf      int,
  verfuegbar  int,
  eingeteilt  int,
  lieblinge   jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
  WITH ich_darf AS (
    SELECT 1 FROM public.members m
     WHERE m.auth_user_id = auth.uid() AND m.role <> 'gast' AND m.revoked_at IS NULL
  ),
  slots AS (
    SELECT s.zeit, array_agg(s.sauna_id ORDER BY sa.sort_order) AS saunen, count(*)::int AS bedarf
      FROM public.saunafest_slots(p_datum) s
      JOIN public.saunas sa ON sa.id = s.sauna_id
     GROUP BY s.zeit
  ),
  v AS (
    SELECT * FROM public.saunafest_verfuegbarkeit WHERE fest_datum = p_datum
  ),
  inf AS (
    SELECT (i.start_time AT TIME ZONE 'Europe/Berlin')::time AS uhr, i.sauna_id
      FROM public.infusions i
     WHERE NOT i.is_personal_fallback
       AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
  )
  SELECT sl.zeit, sl.saunen, sl.bedarf,
         (SELECT count(*)::int FROM v WHERE v.von <= sl.zeit AND sl.zeit <= v.bis),
         (SELECT count(*)::int FROM inf WHERE inf.uhr = sl.zeit AND inf.sauna_id = ANY (sl.saunen)),
         (SELECT coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb)
            FROM (SELECT coalesce(v.lieblings_sauna_id::text, 'egal') AS k, count(*)::int AS n
                    FROM v WHERE v.von <= sl.zeit AND sl.zeit <= v.bis
                   GROUP BY 1) x)
    FROM slots sl
   WHERE EXISTS (SELECT 1 FROM ich_darf)
   ORDER BY sl.zeit;
$$;

-- ── Admin: einteilen / austeilen / erinnern ──────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_einteilen(
  p_datum  date,
  p_zeit   time,
  p_sauna  uuid,
  p_member uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_wer      public.members%rowtype;
  v_start    timestamptz;
  v_ende     timestamptz;
  v_dauer    int := 20;
  v_fallback public.infusions%rowtype;
  v_inf_id   uuid;
  v_sauna    text;
  v_andere   text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Einteilen darf nur ein Admin.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.saunafest_slots(p_datum) s WHERE s.zeit = p_zeit AND s.sauna_id = p_sauna) THEN
    RAISE EXCEPTION 'Dieser Slot ist am Fest für diese Sauna nicht vorgesehen.';
  END IF;
  SELECT * INTO v_wer FROM public.members WHERE id = p_member;
  IF NOT FOUND OR v_wer.revoked_at IS NOT NULL OR v_wer.role = 'gast' THEN
    RAISE EXCEPTION 'Diese Person kann nicht eingeteilt werden.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_sauna::text), hashtext(p_datum::text));

  v_start := (p_datum + p_zeit) AT TIME ZONE 'Europe/Berlin';
  v_ende  := v_start + make_interval(mins => v_dauer);
  IF v_start < now() THEN RAISE EXCEPTION 'Dieser Slot liegt in der Vergangenheit.'; END IF;

  IF EXISTS (SELECT 1 FROM public.infusions
              WHERE sauna_id = p_sauna AND NOT is_personal_fallback
                AND NOT (end_time <= v_start OR start_time >= v_ende)) THEN
    RAISE EXCEPTION 'In diesem Slot ist schon ein Aufguss eingetragen — erst die bestehende Einteilung aufheben.';
  END IF;

  SELECT s.name INTO v_andere
    FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
   WHERE i.saunameister_id = p_member AND NOT i.is_personal_fallback
     AND NOT (i.end_time <= v_start OR i.start_time >= v_ende)
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '% gießt um diese Zeit schon in der % auf.', v_wer.name, v_andere;
  END IF;

  SELECT * INTO v_fallback FROM public.infusions
   WHERE sauna_id = p_sauna AND is_personal_fallback AND start_time = v_start
   LIMIT 1;
  IF FOUND THEN
    UPDATE public.infusions
       SET saunameister_id = p_member, is_personal_fallback = false,
           title = 'Saunafest-Aufguss', description = NULL, attributes = '{}',
           oils = NULL, team_infusion = false, duration_minutes = v_dauer
     WHERE id = v_fallback.id;
    v_inf_id := v_fallback.id;
  ELSE
    INSERT INTO public.infusions
      (sauna_id, saunameister_id, title, attributes, start_time, duration_minutes, is_personal_fallback, team_infusion)
    VALUES
      (p_sauna, p_member, 'Saunafest-Aufguss', '{}', v_start, v_dauer, false, false)
    RETURNING id INTO v_inf_id;
  END IF;

  -- Vor der Planbestätigung ist alles Entwurf: niemand wird angepingt.
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum AND plan_bestaetigt_at IS NOT NULL) THEN
    RETURN v_inf_id;
  END IF;

  SELECT name INTO v_sauna FROM public.saunas WHERE id = p_sauna;
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  VALUES ('saunafest_einteilung', p_member,
          jsonb_build_object(
            'title', '🔥 Saunafest — du bist eingeteilt',
            'body', public.saunafest_datum_kurz(p_datum) || ' · ' || to_char(p_zeit, 'HH24:MI') || ' Uhr · ' || v_sauna
                    || '. Titel und Öle bitte im Planer eintragen.',
            'url', '/planner#saunafest'),
          'saunafest_einteilung:' || v_inf_id::text)
  ON CONFLICT DO NOTHING;

  RETURN v_inf_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.saunafest_austeilen(p_infusion uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_inf   public.infusions%rowtype;
  v_tag   date;
  v_sauna text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Austeilen darf nur ein Admin.'; END IF;

  SELECT * INTO v_inf FROM public.infusions WHERE id = p_infusion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diesen Aufguss gibt es nicht mehr.'; END IF;
  v_tag := (v_inf.start_time AT TIME ZONE 'Europe/Berlin')::date;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = v_tag) THEN
    RAISE EXCEPTION 'Das ist kein Aufguss eines Saunafests.';
  END IF;
  IF v_inf.start_time < now() THEN RAISE EXCEPTION 'Dieser Aufguss liegt in der Vergangenheit.'; END IF;

  SELECT name INTO v_sauna FROM public.saunas WHERE id = v_inf.sauna_id;
  DELETE FROM public.infusions WHERE id = v_inf.id;

  -- Alte Bewerbungen (0151), die auf diesen Aufguss zeigten, wieder öffnen.
  UPDATE public.saunafest_bewerbungen SET status = 'offen', entschieden_at = NULL
   WHERE fest_datum = v_tag AND status = 'zugeteilt' AND infusion_id IS NULL;

  IF v_inf.saunameister_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = v_tag AND plan_bestaetigt_at IS NOT NULL) THEN
    INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
    VALUES ('saunafest_einteilung', v_inf.saunameister_id,
            jsonb_build_object(
              'title', '🔥 Saunafest — Einteilung aufgehoben',
              'body', public.saunafest_datum_kurz(v_tag) || ' · '
                      || to_char(v_inf.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr · ' || v_sauna
                      || ' wurde wieder freigegeben.',
              'url', '/planner#saunafest'),
            'saunafest_austeilung:' || v_inf.id::text)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.saunafest_erinnern(p_datum date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_n     int;
  v_heute date := ((now() AT TIME ZONE 'Europe/Berlin'))::date;
  v_motto text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Erinnern darf nur ein Admin.'; END IF;
  SELECT motto INTO v_motto FROM public.saunafest_tage WHERE datum = p_datum;
  IF NOT FOUND THEN RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.'; END IF;
  IF p_datum < v_heute THEN RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.'; END IF;

  -- Aufgießer (auch Gast-Aufgießer) ohne Eintrag; höchstens eine Erinnerung je Tag.
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  SELECT 'saunafest_erinnerung', m.id,
         jsonb_build_object(
           'title', '🔥 Saunafest ' || public.saunafest_datum_kurz(p_datum) || ' · ' || coalesce(v_motto, ''),
           'body', 'Wann hättest du Zeit für einen Aufguss? Trag deinen Zeitraum und deine Lieblingssauna im Planer ein.',
           'url', '/planner#saunafest'),
         'saunafest_erinnerung:' || p_datum::text || ':' || m.id::text || ':' || v_heute::text
    FROM public.members m
   WHERE m.revoked_at IS NULL
     AND m.role <> 'gast'
     AND (m.is_aufgieser OR m.role = 'guest_aufgieser')
     AND NOT EXISTS (SELECT 1 FROM public.saunafest_verfuegbarkeit v
                      WHERE v.fest_datum = p_datum AND v.member_id = m.id)
     AND NOT EXISTS (SELECT 1 FROM public.notification_queue q
                      WHERE q.dedup_key = 'saunafest_erinnerung:' || p_datum::text || ':' || m.id::text || ':' || v_heute::text)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ── Admin: Plan bestätigen / Bestätigung zurücknehmen ────────────────────
-- Benachrichtigt jeden, der für dieses Fest einen Zeitraum eingetragen hat oder
-- eingeteilt ist: Eingeteilte bekommen ihre Zeiten, alle anderen einen Dank.
-- Erneutes Bestätigen (nach größeren Umbauten) schickt allen den neuen Stand.
CREATE OR REPLACE FUNCTION public.saunafest_plan_bestaetigen(p_datum date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_n     int;
  v_tag   text := public.saunafest_datum_kurz(p_datum);
  v_stamp text := floor(extract(epoch FROM clock_timestamp()))::bigint::text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Den Plan bestätigen darf nur ein Admin.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum) THEN
    RAISE EXCEPTION 'An diesem Tag ist kein Saunafest.';
  END IF;
  IF p_datum < ((now() AT TIME ZONE 'Europe/Berlin'))::date THEN
    RAISE EXCEPTION 'Dieses Saunafest ist schon vorbei.';
  END IF;

  UPDATE public.saunafest_tage
     SET plan_bestaetigt_at = now(),
         plan_bestaetigt_von = (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid())
   WHERE datum = p_datum;

  WITH einteilung AS (
    SELECT i.saunameister_id AS member_id,
           string_agg(to_char(i.start_time AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' ' || s.name,
                      ' · ' ORDER BY i.start_time) AS zeiten
      FROM public.infusions i JOIN public.saunas s ON s.id = i.sauna_id
     WHERE NOT i.is_personal_fallback AND i.saunameister_id IS NOT NULL
       AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = p_datum
     GROUP BY i.saunameister_id
  ),
  empfaenger AS (
    SELECT v.member_id FROM public.saunafest_verfuegbarkeit v WHERE v.fest_datum = p_datum
    UNION
    SELECT e.member_id FROM einteilung e
  )
  INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
  SELECT 'saunafest_plan', r.member_id,
         jsonb_build_object(
           'title', '🔥 Saunafest ' || v_tag || ' — der Plan steht',
           'body', CASE WHEN e.zeiten IS NOT NULL
                        THEN 'Du bist dabei: ' || e.zeiten || '. Titel und Öle bitte im Planer eintragen.'
                        ELSE 'Diesmal bist du nicht eingeteilt — danke fürs Eintragen! Den ganzen Plan siehst du im Planer.' END,
           'url', '/planner#saunafest'),
         'saunafest_plan:' || p_datum::text || ':' || r.member_id::text || ':' || v_stamp
    FROM empfaenger r
    JOIN public.members m ON m.id = r.member_id AND m.revoked_at IS NULL
    LEFT JOIN einteilung e ON e.member_id = r.member_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.saunafest_plan_zuruecknehmen(p_datum date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Nur ein Admin kann die Bestätigung zurücknehmen.'; END IF;
  UPDATE public.saunafest_tage SET plan_bestaetigt_at = NULL, plan_bestaetigt_von = NULL WHERE datum = p_datum;
END;
$$;

-- ── Rechte ───────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.saunafest_datum_kurz(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_zeitraum_setzen(date, time, time, uuid, smallint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_zeitraum_loeschen(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_uebersicht(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_einteilen(date, time, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_austeilen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_erinnern(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_plan_bestaetigen(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.saunafest_plan_zuruecknehmen(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.saunafest_datum_kurz(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_zeitraum_setzen(date, time, time, uuid, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_zeitraum_loeschen(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_uebersicht(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_einteilen(date, time, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_austeilen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_erinnern(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_plan_bestaetigen(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saunafest_plan_zuruecknehmen(date) TO authenticated;
