-- 0150 — Saunafest-Planung, Wenik nur als Teil des Banja-Rituals.
--
-- Drei Dinge (Vorgabe Christoph, 13.09.2026):
--
--  1. Die sechs Saunafeste bekommen eine Tabelle. An diesen Samstagen laufen
--     Aufgüsse ab 14 Uhr in den beiden Außensaunen (80 °C und 100 °C) und ab
--     17 Uhr zusätzlich in der dritten Sauna (Finnische Sauna, sonst inaktiv).
--     Jeder Aufgießer und Gast-Aufgießer wählt seine Slots per Klick wie an
--     jedem anderen Tag — der Planer zeigt an Festtagen drei Spalten.
--
--     Die Liste in src/lib/saunafeste.ts bleibt die ANZEIGE-Fassung für das
--     Tafel-Video und den Tagesabschluss. Beide müssen übereinstimmen; die
--     Tabelle hier ist die Quelle für alles, was plant und sperrt.
--
--  2. garantie_temperature_for() kennt die Festtage: vor der Festöffnung gibt
--     es keine Garantie-Slots. materialize_infusion_horizon() legt damit an
--     Festtagen keine Personal-Fallbacks vor 14 Uhr mehr an — die bereits
--     angelegten (10.10., 11–13 Uhr) werden unten gelöscht.
--
--  3. 'wenik' ohne 'banja' wird abgewiesen. Den Wenikaufguss gibt es nur als
--     Teil des Banja-Rituals; die Spezialkarte im Planer setzt beide Marker
--     zusammen. Als einzelne Besonderheit ist er nirgends mehr wählbar
--     (lib/attributes.ts: automatisch) — der Trigger fängt die übrigen
--     Schreibwege ab. Bestand mit wenik ohne banja (10 Altfälle) bleibt
--     unangetastet: geprüft wird nur, wenn sich die Attribute ändern.

-- ── 1. Saunafest-Tage ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saunafest_tage (
  datum            date PRIMARY KEY,
  motto            text NOT NULL,
  -- Stunde (Europe/Berlin), ab der in den beiden Außensaunen aufgegossen wird
  ab_zwei_saunen   smallint NOT NULL DEFAULT 14 CHECK (ab_zwei_saunen BETWEEN 0 AND 23),
  -- Stunde, ab der die dritte Sauna dazukommt
  ab_drei_saunen   smallint NOT NULL DEFAULT 17 CHECK (ab_drei_saunen BETWEEN 0 AND 23),
  dritte_sauna_id  uuid REFERENCES public.saunas(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saunafest_tage IS
  'Saunafest-Termine (0150): ab ab_zwei_saunen Aufguesse in den aktiven Saunen, ab ab_drei_saunen zusaetzlich in dritte_sauna_id. Anzeige-Spiegel: src/lib/saunafeste.ts.';

ALTER TABLE public.saunafest_tage ENABLE ROW LEVEL SECURITY;

-- Lesen darf jeder — die Tafel läuft anonym und muss den Festtag kennen.
DROP POLICY IF EXISTS saunafest_tage_read ON public.saunafest_tage;
CREATE POLICY saunafest_tage_read ON public.saunafest_tage
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS saunafest_tage_write_admin ON public.saunafest_tage;
CREATE POLICY saunafest_tage_write_admin ON public.saunafest_tage
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.saunafest_tage TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.saunafest_tage TO authenticated;

-- Die dritte Sauna wird über den Namen gefunden, nicht über eine ID.
INSERT INTO public.saunafest_tage (datum, motto, dritte_sauna_id)
SELECT v.datum::date, v.motto,
       (SELECT id FROM public.saunas WHERE name = 'Finnische Sauna' LIMIT 1)
  FROM (VALUES
    ('2026-10-10', 'Laubfeuer'),
    ('2026-11-14', 'Nebelabend'),
    ('2026-12-12', 'Kerzenlicht'),
    ('2027-01-09', 'Raureif'),
    ('2027-02-13', 'Zu zweit'),
    ('2027-03-13', 'Letzter Schnee')
  ) AS v(datum, motto)
ON CONFLICT (datum) DO NOTHING;

-- ── 2. Garantie kennt die Festtage ──────────────────────────────────────────
-- Unverändert gegenüber 0083, bis auf den Festtag-Block am Anfang.
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
  v_fest_ab smallint;
begin
  v_local := p_start at time zone 'Europe/Berlin';
  v_dow   := extract(dow from v_local)::int;
  v_hour  := extract(hour from v_local)::int;

  -- Saunafest (0150): vor der Festöffnung keine Garantie-Slots, danach der
  -- normale Samstags-Rhythmus. So bleiben 14–20 Uhr Personal-Fallbacks
  -- übernehmbar, aber 11–13 Uhr entstehen gar nicht erst.
  select ab_zwei_saunen into v_fest_ab
    from public.saunafest_tage
   where datum = (p_start at time zone 'Europe/Berlin')::date;
  if v_fest_ab is not null and v_hour < v_fest_ab then return null; end if;

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

-- Bereits materialisierte Personal-Fallbacks vor der Festöffnung entfernen.
-- Nur Fallbacks — echte Aufgüsse (falls jemand schon geplant hat) bleiben.
DELETE FROM public.infusions i
 USING public.saunafest_tage f
 WHERE i.is_personal_fallback
   AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date = f.datum
   AND EXTRACT(HOUR FROM i.start_time AT TIME ZONE 'Europe/Berlin') < f.ab_zwei_saunen;

-- ── 3. Wenik nur mit Banja ──────────────────────────────────────────────────
-- Identisch mit 0149, plus der Wenik-Block nach der Titelprüfung.
CREATE OR REPLACE FUNCTION public.validate_infusion_banja_and_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_banja boolean;
  v_start_hour_berlin int;
  v_soll_dauer int;
  v_conflict_count int;
  v_sperr_count int;
  v_effective_end timestamptz;
  v_darf_banja boolean;
BEGIN
  v_is_banja := NEW.attributes IS NOT NULL AND 'banja' = ANY(NEW.attributes);

  IF v_is_banja THEN
    SELECT coalesce(darf_banja, false) INTO v_darf_banja
      FROM public.members WHERE id = NEW.saunameister_id;
    IF NOT coalesce(v_darf_banja, false) THEN
      RAISE EXCEPTION 'BANJA_SPERRE: Das Banja-Ritual darf nur anbieten, wer dafuer freigegeben ist.';
    END IF;
  END IF;

  IF NEW.title IS NOT NULL AND NEW.title ~* '\mbanja' AND NOT v_is_banja THEN
    RAISE EXCEPTION 'BANJA_SPERRE: Das Wort "Banja" ist dem Banja-Ritual vorbehalten.';
  END IF;

  -- Wenik gehoert zum Banja-Ritual (0150). Altbestand bleibt: geprueft wird
  -- nur beim Anlegen oder wenn sich die Attribute aendern.
  IF NEW.attributes IS NOT NULL AND 'wenik' = ANY(NEW.attributes) AND NOT v_is_banja
     AND (TG_OP = 'INSERT' OR NEW.attributes IS DISTINCT FROM OLD.attributes) THEN
    RAISE EXCEPTION 'Der Wenikaufguss gehoert zum Banja-Ritual und laesst sich nicht einzeln waehlen.';
  END IF;

  IF v_is_banja THEN
    v_start_hour_berlin := EXTRACT(HOUR FROM NEW.start_time AT TIME ZONE 'Europe/Berlin')::int;
    v_soll_dauer := CASE WHEN v_start_hour_berlin = 19 THEN 90 ELSE 120 END;
    IF NEW.duration_minutes <> v_soll_dauer THEN
      RAISE EXCEPTION 'Banja um %:00 Uhr dauert % Minuten (gewaehlt: %).',
        v_start_hour_berlin, v_soll_dauer, NEW.duration_minutes;
    END IF;
  END IF;

  v_effective_end := NEW.start_time + (NEW.duration_minutes || ' minutes')::interval;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.infusions
  WHERE sauna_id = NEW.sauna_id
    AND id IS DISTINCT FROM NEW.id
    AND NOT (end_time <= NEW.start_time OR start_time >= v_effective_end);
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Diese Sauna ist im gewaehlten Zeitraum bereits durch einen anderen Aufguss belegt.';
  END IF;

  IF NOT v_is_banja THEN
    SELECT COUNT(*) INTO v_sperr_count
    FROM public.infusions
    WHERE sauna_id = NEW.sauna_id
      AND id IS DISTINCT FROM NEW.id
      AND attributes IS NOT NULL AND 'banja' = ANY(attributes)
      AND NEW.start_time >= end_time
      AND NEW.start_time < end_time + interval '60 minutes';
    IF v_sperr_count > 0 THEN
      RAISE EXCEPTION 'Nach dem Banja-Ritual bleibt diese Sauna eine Stunde geschlossen - bitte einen spaeteren Slot waehlen.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
