-- 0148 — Banja nur für freigegebene Personen, und das Wort ist geschützt.
--
-- Das Banja-Ritual ist ein Privileg: 90 bzw. 120 Minuten, eine Stunde Ruhe
-- danach in derselben Sauna, zwei Kacheln auf der Tafel — und es ist von der
-- Zutaten-Pflicht (3 Öle + 2 Besonderheiten) ausgenommen. Bisher konnte das
-- jeder Aufgießer für sich beanspruchen, indem er das Attribut anklickte.
--
-- Zwei Löcher werden hier geschlossen:
--
--  1. WER darf. Neu ist `members.darf_banja`; nur der Admin setzt es.
--
--  2. DAS WORT. Gemessen am 09.09.2026: 11 Aufgüsse trugen das Banja-Attribut,
--     aber 16 hatten "Banja" im Titel — fünf davon ohne das Ritual. Ein
--     Aufguss namens „Banja-Feeling" sieht auf der Tafel aus wie das echte
--     Ritual und entwertet es. Deshalb ist das Wort im Titel künftig dem
--     echten, freigegebenen Banja vorbehalten.
--
-- Warum im TRIGGER und nicht im Frontend oder in einer RPC: es gibt mehrere
-- Schreibwege auf public.infusions (Planer, Bearbeiten-Dialog, Öl-Raum-Kiosk,
-- Admin, künftige). Ein Frontend-Check ist eine Bitte, keine Regel — wer die
-- API direkt anspricht, umgeht ihn. Der Trigger auf der Tabelle ist die
-- einzige Stelle, an der ALLE Wege vorbeimüssen. Genau das war die Vorgabe:
-- die Regel darf nicht umgehbar sein.

-- ── 1. Das Recht ────────────────────────────────────────────────────────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS darf_banja boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.darf_banja IS
  'Darf das Banja-Ritual anbieten und das Wort "Banja" im Aufguss-Titel führen. Wird ausschliesslich vom Admin gesetzt (0148).';

-- Bestandsschutz: wer das Ritual bereits durchgeführt hat, behält es. Sonst
-- wäre die Freigabe eine stille Enteignung und die App am nächsten Tag für
-- fünf Leute kaputt. Der Admin kann jederzeit entziehen.
UPDATE public.members m
   SET darf_banja = true
 WHERE EXISTS (
   SELECT 1 FROM public.infusions i
    WHERE i.saunameister_id = m.id
      AND i.attributes IS NOT NULL
      AND 'banja' = ANY(i.attributes)
 );

-- ── 2. Die Sperre ───────────────────────────────────────────────────────────
-- Der bestehende Trigger wird ERWEITERT, nicht ersetzt: Dauer-Regel,
-- Überlappungsprüfung und Banja-Ruhestunde bleiben Wort für Wort erhalten.
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

  -- ── NEU (0148): Wer das Ritual anbietet, muss dafür freigegeben sein ──
  IF v_is_banja THEN
    SELECT coalesce(darf_banja, false) INTO v_darf_banja
      FROM public.members WHERE id = NEW.saunameister_id;
    IF NOT coalesce(v_darf_banja, false) THEN
      RAISE EXCEPTION 'Das Banja-Ritual darf nur anbieten, wer dafür freigegeben ist. Frag einen Admin.';
    END IF;
  END IF;

  -- ── NEU (0148): "Banja" im Titel ist dem echten Ritual vorbehalten ──
  -- Wortgrenzen, damit z. B. "Banjarmasin" nicht versehentlich greift; der
  -- Bindestrich in "Banja-Aufguss" ist eine Wortgrenze und wird erfasst.
  IF NEW.title IS NOT NULL AND NEW.title ~* '\mbanja' AND NOT v_is_banja THEN
    RAISE EXCEPTION 'Das Wort "Banja" ist dem Banja-Ritual vorbehalten - bitte einen anderen Titel waehlen.';
  END IF;

  -- ── Banja: nur noch die Dauer ist vorgeschrieben ──────────────────
  IF v_is_banja THEN
    v_start_hour_berlin := EXTRACT(HOUR FROM NEW.start_time AT TIME ZONE 'Europe/Berlin')::int;
    v_soll_dauer := CASE WHEN v_start_hour_berlin = 19 THEN 90 ELSE 120 END;
    IF NEW.duration_minutes <> v_soll_dauer THEN
      RAISE EXCEPTION 'Banja um %:00 Uhr dauert % Minuten (gewählt: %).',
        v_start_hour_berlin, v_soll_dauer, NEW.duration_minutes;
    END IF;
    -- Uhrzeit und Sauna sind ab 08.08.2026 frei: das Ritual soll jederzeit
    -- und überall stattfinden können.
  END IF;

  -- ── Überlappung in derselben Sauna ───────────────────────────────
  -- start + duration explizit statt NEW.end_time: bei einem UPDATE, das nur
  -- attributes ändert, läuft der end_time-Trigger nicht mit.
  v_effective_end := NEW.start_time + (NEW.duration_minutes || ' minutes')::interval;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.infusions
  WHERE sauna_id = NEW.sauna_id
    AND id IS DISTINCT FROM NEW.id
    AND NOT (end_time <= NEW.start_time OR start_time >= v_effective_end);
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Diese Sauna ist im gewählten Zeitraum bereits durch einen anderen Aufguss belegt.';
  END IF;

  -- ── Ruhestunde nach einem Banja-Ritual ───────────────────────────
  IF NOT v_is_banja THEN
    SELECT COUNT(*) INTO v_sperr_count
    FROM public.infusions
    WHERE sauna_id = NEW.sauna_id
      AND id IS DISTINCT FROM NEW.id
      AND attributes IS NOT NULL AND 'banja' = ANY(attributes)
      AND NEW.start_time >= end_time
      AND NEW.start_time < end_time + interval '60 minutes';
    IF v_sperr_count > 0 THEN
      RAISE EXCEPTION 'Nach dem Banja-Ritual bleibt diese Sauna eine Stunde geschlossen — bitte einen späteren Slot wählen.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
