-- Migration 0104: Banja-Ritual — 90-Min-Spezial-Aufguss mit fester Slot-Sperre
--
-- Ein "Traditionelles Banja-Ritual" ist ein Aufguss mit folgenden festen Regeln:
--   - Dauer: 90 Minuten (überspannt 2 reguläre Stunden-Slots, 19:00 + 20:00)
--   - Startzeit: ausschließlich 19:00 Uhr (Europe/Berlin)
--   - Ort: ausschließlich 80°C-Sauna (temperature_label = '80°C')
--
-- Erkennungs-Marker: Der String 'banja' steht im attributes-Array
-- (existiert bereits als Standard-Attribute in src/lib/attributes.ts).
--
-- Zusätzlich führen wir einen GENERELLEN Overlap-Check ein: in derselben
-- Sauna dürfen zwei Aufgüsse zeitlich nicht überlappen. Vorher war das durch
-- "1 Aufguss pro Stundenslot, max 45 Min Dauer" implizit gegeben — mit dem
-- 90-Min Banja wird der Check notwendig damit nicht parallel zum laufenden
-- Banja noch ein 20:00-Aufguss in der gleichen Sauna gebucht werden kann.
--
-- Implementierung als BEFORE INSERT/UPDATE Trigger statt RPC-Inline, damit
-- die Validation auch dann greift wenn jemand außerhalb von create_infusion()
-- in die infusions-Tabelle schreibt (z.B. Admin via SQL).

CREATE OR REPLACE FUNCTION public.validate_infusion_banja_and_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_banja boolean;
  v_sauna_temp text;
  v_start_hour_berlin int;
  v_conflict_count int;
  v_effective_end timestamptz;
BEGIN
  v_is_banja := NEW.attributes IS NOT NULL AND 'banja' = ANY(NEW.attributes);

  -- ── BANJA-spezifische Constraints ────────────────────────────────
  IF v_is_banja THEN
    IF NEW.duration_minutes <> 90 THEN
      RAISE EXCEPTION 'Banja-Ritual dauert genau 90 Minuten (gewählt: % Min).', NEW.duration_minutes;
    END IF;

    v_start_hour_berlin := EXTRACT(HOUR FROM NEW.start_time AT TIME ZONE 'Europe/Berlin')::int;
    IF v_start_hour_berlin <> 19 THEN
      RAISE EXCEPTION 'Banja-Ritual startet ausschließlich um 19:00 Uhr (Berlin) — gewählt: %:00 Uhr.', v_start_hour_berlin;
    END IF;

    SELECT temperature_label INTO v_sauna_temp
      FROM public.saunas WHERE id = NEW.sauna_id;
    IF v_sauna_temp IS DISTINCT FROM '80°C' THEN
      RAISE EXCEPTION 'Banja-Ritual findet ausschließlich in der 80°C-Sauna statt (gewählt: %).', COALESCE(v_sauna_temp, '?');
    END IF;
  END IF;

  -- ── Überlappungs-Check (in derselben Sauna) ──────────────────────
  -- NEW.end_time wird von set_infusion_end_time() (BEFORE-Trigger, Migration
  -- 0001) gesetzt — beim Compare nutzen wir aber start + duration explizit,
  -- weil end_time bei UPDATE-only-on-attributes evtl. nicht neu gesetzt wird.
  v_effective_end := NEW.start_time + (NEW.duration_minutes || ' minutes')::interval;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.infusions
  WHERE sauna_id = NEW.sauna_id
    AND id IS DISTINCT FROM NEW.id  -- bei UPDATE: sich selbst ausschließen
    AND NOT (
      end_time <= NEW.start_time
      OR start_time >= v_effective_end
    );
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Diese Sauna ist im gewählten Zeitraum bereits durch einen anderen Aufguss belegt.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-Reihenfolge: set_infusion_end_time (Migration 0001) läuft alphabetisch
-- VOR validate_… (s < v), so dass NEW.end_time bereits gesetzt ist. Im Check
-- nutzen wir aber NEW.start_time + duration explizit als Source of Truth.
DROP TRIGGER IF EXISTS trg_validate_infusion ON public.infusions;
CREATE TRIGGER trg_validate_infusion
  BEFORE INSERT OR UPDATE ON public.infusions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_infusion_banja_and_overlap();
