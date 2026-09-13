-- 0152 — Saunafest-Plan korrigiert (Vorgabe Christoph, 13.09.2026).
--
-- Am Fest läuft ein Raster zur halben Stunde, ein Aufguss je Sauna und
-- Stunde: 10:30, 11:30, … 23:30. Bis 13:30 ist je Stunde nur EINE Sauna dran,
-- im Wechsel 80 °C / 100 °C (10:30 Kelo, 11:30 Blockhaus, 12:30 Kelo, 13:30
-- Blockhaus). Ab 14:30 beide, ab 17:30 zusätzlich die 90-°C-Sauna — dann
-- stündlich alle drei.
--
-- Deshalb:
--  • saunafest_tage bekommt erster_slot / letzter_slot / ab_beide / ab_alle
--    (Uhrzeiten) statt der Stunden-Spalten aus 0150.
--  • saunafest_slots(datum) liefert den Plan (Uhrzeit × Sauna) — die eine
--    Quelle für Planer, Admin-Reiter, Bewerbungs-RLS und Zuteilung.
--    Spiegel im Frontend: src/lib/saunafestPlan.ts.
--  • Bewerbungen tragen eine Uhrzeit (slot_zeit) statt einer Stunde.
--  • Am Fest gibt es keine Garantie-Slots und keine Personal-Fallbacks: das
--    Programm entsteht vollständig aus den Zuteilungen. Bereits angelegte
--    Fallbacks an Festtagen werden gelöscht.

-- ── 1. Garantie: am Fest gar nicht ──────────────────────────────────────────
-- (vor dem Spaltenumbau, weil die alte Fassung ab_zwei_saunen liest)
CREATE OR REPLACE FUNCTION public.garantie_temperature_for(p_start timestamp with time zone)
RETURNS smallint
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_local timestamptz;
  v_dow   int;
  v_hour  int;
  v_start_hour int;
  v_last_hour  int := 20;
  v_monday_open boolean;
begin
  v_local := p_start at time zone 'Europe/Berlin';
  v_dow   := extract(dow from v_local)::int;
  v_hour  := extract(hour from v_local)::int;

  -- Saunafest (0152): kein Garantie-Rhythmus, keine Personal-Fallbacks —
  -- das Festprogramm kommt aus den Zuteilungen.
  if exists (select 1 from public.saunafest_tage where datum = (p_start at time zone 'Europe/Berlin')::date) then
    return null;
  end if;

  if v_dow = 1 then
    v_monday_open := coalesce(
      (select (value->>'monday_open')::boolean from public.system_config where key = 'schedule_settings'),
      false
    );
    if not v_monday_open then return null; end if;
    if v_hour < 11 or v_hour > v_last_hour then return null; end if;
    if ((v_hour - 11) % 2) = 0 then return 80; else return 100; end if;
  end if;

  if v_dow = 5 then
    if v_hour between 11 and 13 then return 80; end if;
    if v_hour < 14 or v_hour > v_last_hour then return null; end if;
    if ((v_hour - 14) % 2) = 0 then return 100; else return 80; end if;
  end if;

  if v_dow in (2, 3, 4) then v_start_hour := 14;
  else v_start_hour := 11;
  end if;

  if v_hour < v_start_hour or v_hour > v_last_hour then return null; end if;

  if ((v_hour - v_start_hour) % 2) = 0 then return 80; else return 100; end if;
end;
$function$;

DELETE FROM public.infusions i
 USING public.saunafest_tage f
 WHERE i.is_personal_fallback
   AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = f.datum;

-- ── 2. Festtage: Uhrzeiten statt Stunden ────────────────────────────────────
ALTER TABLE public.saunafest_tage
  ADD COLUMN IF NOT EXISTS erster_slot  time NOT NULL DEFAULT '10:30',
  ADD COLUMN IF NOT EXISTS letzter_slot time NOT NULL DEFAULT '23:30',
  ADD COLUMN IF NOT EXISTS ab_beide     time NOT NULL DEFAULT '14:30',
  ADD COLUMN IF NOT EXISTS ab_alle      time NOT NULL DEFAULT '17:30';
ALTER TABLE public.saunafest_tage
  DROP COLUMN IF EXISTS ab_zwei_saunen,
  DROP COLUMN IF EXISTS ab_drei_saunen;

COMMENT ON TABLE public.saunafest_tage IS
  'Saunafest-Termine (0150/0152). Raster zur halben Stunde von erster_slot bis letzter_slot: vor ab_beide eine Sauna im Wechsel 80/100, ab ab_beide beide, ab ab_alle zusaetzlich dritte_sauna_id. Plan: saunafest_slots(datum). Anzeige-Spiegel: src/lib/saunafeste.ts.';

-- ── 3. Der Plan ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_slots(p_datum date)
RETURNS TABLE (zeit time, sauna_id uuid)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  f     public.saunafest_tage%rowtype;
  v_80  uuid;
  v_100 uuid;
  t     time;
  i     int := 0;
BEGIN
  SELECT * INTO f FROM public.saunafest_tage WHERE datum = p_datum;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT id INTO v_80  FROM public.saunas WHERE temperature_label = '80°C'  AND is_active LIMIT 1;
  SELECT id INTO v_100 FROM public.saunas WHERE temperature_label = '100°C' AND is_active LIMIT 1;

  t := f.erster_slot;
  WHILE t <= f.letzter_slot AND i < 48 LOOP
    IF t < f.ab_beide THEN
      -- eine Sauna im Wechsel, beginnend mit 80 °C
      sauna_id := CASE WHEN i % 2 = 0 THEN v_80 ELSE v_100 END;
      IF sauna_id IS NOT NULL THEN zeit := t; RETURN NEXT; END IF;
    ELSE
      IF v_80  IS NOT NULL THEN zeit := t; sauna_id := v_80;  RETURN NEXT; END IF;
      IF v_100 IS NOT NULL THEN zeit := t; sauna_id := v_100; RETURN NEXT; END IF;
      IF t >= f.ab_alle AND f.dritte_sauna_id IS NOT NULL THEN
        zeit := t; sauna_id := f.dritte_sauna_id; RETURN NEXT;
      END IF;
    END IF;
    i := i + 1;
    -- time läuft nach 23:59 wieder bei 00:00 los — dann ist der Tag zu Ende
    EXIT WHEN t + interval '1 hour' < t;
    t := t + interval '1 hour';
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.saunafest_slots(date) IS
  'Saunafest-Programmraster (0152): welche Sauna zu welcher Uhrzeit einen Aufguss hat. Spiegel: src/lib/saunafestPlan.ts.';

REVOKE ALL ON FUNCTION public.saunafest_slots(date) FROM public;
GRANT EXECUTE ON FUNCTION public.saunafest_slots(date) TO anon, authenticated;

-- ── 4. Bewerbungen: Uhrzeit statt Stunde ────────────────────────────────────
ALTER TABLE public.saunafest_bewerbungen ADD COLUMN IF NOT EXISTS slot_zeit time;
UPDATE public.saunafest_bewerbungen SET slot_zeit = make_time(slot_hour, 0, 0) WHERE slot_zeit IS NULL;
ALTER TABLE public.saunafest_bewerbungen ALTER COLUMN slot_zeit SET NOT NULL;
-- Unique-Constraint und Index hingen an slot_hour und fallen mit der Spalte.
ALTER TABLE public.saunafest_bewerbungen DROP COLUMN IF EXISTS slot_hour;
ALTER TABLE public.saunafest_bewerbungen
  ADD CONSTRAINT saunafest_bewerbungen_slot_uniq UNIQUE (fest_datum, sauna_id, slot_zeit, member_id);
CREATE INDEX IF NOT EXISTS saunafest_bewerbungen_zeit_idx
  ON public.saunafest_bewerbungen (fest_datum, sauna_id, slot_zeit);

-- Bewerben nur auf Slots, die der Plan vorsieht.
DROP POLICY IF EXISTS saunafest_bewerbungen_insert ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_insert ON public.saunafest_bewerbungen
  FOR INSERT TO authenticated WITH CHECK (
    status = 'offen'
    AND infusion_id IS NULL
    AND member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND (public.is_aufgieser() OR public.is_admin())
    AND fest_datum >= (now() AT TIME ZONE 'Europe/Berlin')::date
    AND EXISTS (
      SELECT 1 FROM public.saunafest_slots(fest_datum) s
       WHERE s.zeit = slot_zeit AND s.sauna_id = saunafest_bewerbungen.sauna_id
    )
  );

-- ── 5. Zuteilen / Aufheben auf Uhrzeiten ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_zuteilen(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_b        public.saunafest_bewerbungen%rowtype;
  v_fallback public.infusions%rowtype;
  v_start    timestamptz;
  v_ende     timestamptz;
  v_inf_id   uuid;
  v_dauer    int := 20;   -- Standarddauer im Planer; der Bewerber passt sie nach Wunsch an
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT * INTO v_b FROM public.saunafest_bewerbungen WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bewerbung nicht gefunden.'; END IF;
  IF v_b.status = 'zugeteilt' THEN RAISE EXCEPTION 'Diese Bewerbung ist schon zugeteilt.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.saunafest_slots(v_b.fest_datum) s
     WHERE s.zeit = v_b.slot_zeit AND s.sauna_id = v_b.sauna_id
  ) THEN
    RAISE EXCEPTION 'Dieser Slot ist am Fest fuer diese Sauna nicht vorgesehen.';
  END IF;

  -- Ein Slot wird nie doppelt vergeben: Sauna + Tag sperren, wie book_banja_ritual.
  PERFORM pg_advisory_xact_lock(hashtext(v_b.sauna_id::text), hashtext(v_b.fest_datum::text));

  v_start := (v_b.fest_datum + v_b.slot_zeit) AT TIME ZONE 'Europe/Berlin';
  v_ende  := v_start + (v_dauer || ' minutes')::interval;
  IF v_start < now() THEN RAISE EXCEPTION 'Dieser Slot liegt in der Vergangenheit.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = v_b.sauna_id
       AND is_personal_fallback = false
       AND NOT (end_time <= v_start OR start_time >= v_ende)
  ) THEN
    RAISE EXCEPTION 'In diesem Slot ist schon ein Aufguss eingetragen — erst die bestehende Zuteilung aufheben.';
  END IF;

  -- Ein Personal-Fallback sollte am Fest nicht mehr vorkommen (0152); falls
  -- doch einer im Slot steht, wird er übernommen statt daneben eingefügt.
  SELECT * INTO v_fallback FROM public.infusions
   WHERE sauna_id = v_b.sauna_id AND is_personal_fallback = true AND start_time = v_start
   LIMIT 1;
  IF FOUND THEN
    UPDATE public.infusions
       SET saunameister_id      = v_b.member_id,
           is_personal_fallback = false,
           title                = 'Saunafest-Aufguss',
           description          = NULL,
           attributes           = '{}',
           oils                 = NULL,
           team_infusion        = false,
           duration_minutes     = v_dauer
     WHERE id = v_fallback.id;
    v_inf_id := v_fallback.id;
  ELSE
    INSERT INTO public.infusions
      (sauna_id, saunameister_id, title, attributes, start_time, duration_minutes, is_personal_fallback, team_infusion)
    VALUES
      (v_b.sauna_id, v_b.member_id, 'Saunafest-Aufguss', '{}', v_start, v_dauer, false, false)
    RETURNING id INTO v_inf_id;
  END IF;

  UPDATE public.saunafest_bewerbungen
     SET status = 'zugeteilt', infusion_id = v_inf_id, entschieden_at = now()
   WHERE id = v_b.id;
  UPDATE public.saunafest_bewerbungen
     SET status = 'abgelehnt', entschieden_at = now()
   WHERE fest_datum = v_b.fest_datum AND sauna_id = v_b.sauna_id AND slot_zeit = v_b.slot_zeit
     AND id <> v_b.id AND status = 'offen';

  RETURN v_inf_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.saunafest_zuteilung_aufheben(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_b public.saunafest_bewerbungen%rowtype;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT * INTO v_b FROM public.saunafest_bewerbungen WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_b.status <> 'zugeteilt' THEN RAISE EXCEPTION 'Keine Zuteilung zum Aufheben.'; END IF;

  DELETE FROM public.infusions
   WHERE id = v_b.infusion_id AND saunameister_id = v_b.member_id AND start_time > now();

  UPDATE public.saunafest_bewerbungen
     SET status = 'offen', infusion_id = NULL, entschieden_at = NULL
   WHERE id = v_b.id;
  UPDATE public.saunafest_bewerbungen
     SET status = 'offen', entschieden_at = NULL
   WHERE fest_datum = v_b.fest_datum AND sauna_id = v_b.sauna_id AND slot_zeit = v_b.slot_zeit
     AND status = 'abgelehnt';
END;
$$;
