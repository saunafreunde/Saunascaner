-- 0149 — Banja-Umgehung sichtbar machen.
--
-- 0148 hat die Sperre gebaut; sie meldet sich bisher wie jeder andere Fehler.
-- Ein Umgehungsversuch ist aber kein Vertipper: das Banja ist ein Privileg,
-- und wer es sich an der Regel vorbei nimmt, tut das absichtlich. Deshalb
-- bekommt er künftig ein rotes Fenster mit Glocke — und der Admin erfährt
-- davon.
--
-- Zwei kleine Bausteine:
--
--  1. Die beiden Sperr-Meldungen tragen jetzt das Präfix BANJA_SPERRE. Das
--     Frontend erkennt daran zuverlässig, dass es die Banja-Sperre war, und
--     nicht am deutschen Wortlaut — der ändert sich, sobald jemand einen Tippfehler
--     ausbessert, und dann bliebe der Alarm still aus.
--
--  2. melde_banja_versuch() schreibt den Versuch ins Aktivitäts-Protokoll.
--     Nötig ist die eigene Funktion, weil der Trigger die Transaktion
--     abbricht — ein Protokoll-Eintrag aus dem Trigger heraus würde mit
--     zurückgerollt und wäre nie zu sehen. Das Frontend meldet den Versuch
--     deshalb hinterher, in einer eigenen Transaktion.

-- ── 1. Sperr-Meldungen mit erkennbarem Präfix ───────────────────────────────
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

-- ── 2. Den Versuch protokollieren ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.melde_banja_versuch(p_grund text, p_titel text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_actor public.members;
BEGIN
  SELECT * INTO v_actor FROM public.members WHERE auth_user_id = auth.uid();
  IF v_actor.id IS NULL THEN
    RETURN;   -- nicht angemeldet: nichts zu protokollieren
  END IF;

  INSERT INTO public.activity_log (
    actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details
  ) VALUES (
    v_actor.id, v_actor.name, v_actor.role,
    'banja.umgehungsversuch', 'member', v_actor.id, v_actor.name,
    jsonb_build_object(
      'grund', left(coalesce(p_grund, ''), 300),
      'titel', left(coalesce(p_titel, ''), 200)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.melde_banja_versuch(text, text) IS
  'Protokolliert einen abgewiesenen Banja-Versuch (0149). Wird vom Frontend NACH dem Trigger-Abbruch gerufen, weil ein Eintrag aus dem Trigger heraus mit zurueckgerollt wuerde.';

-- Neue public-Funktionen bekommen bei Supabase automatisch einen anon-Grant
-- (siehe 0123). Melden darf nur, wer angemeldet ist.
REVOKE ALL ON FUNCTION public.melde_banja_versuch(text, text) FROM public;
REVOKE ALL ON FUNCTION public.melde_banja_versuch(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.melde_banja_versuch(text, text) TO authenticated;
