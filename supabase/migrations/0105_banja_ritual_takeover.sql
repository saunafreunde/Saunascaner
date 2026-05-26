-- Migration 0105: Banja-Ritual übernimmt Personal-Aufgüsse automatisch
--
-- Bug: Wenn die 80°C-Sauna für 19:00 oder 20:00 einen Personal-Fallback hat,
-- konnte das Banja-Ritual nicht gebucht werden:
--   - UI: Quick-Action war disabled (Status 'fallback' ≠ 'free')
--   - Backend: takeover_personal_fallback (0034) updated nicht duration_minutes
--     und behandelt nur 1 Slot — Banja braucht aber 2 Slots (19 + 20)
--     mit duration=90.
--
-- Fix: Neue dedizierte RPC `book_banja_ritual` die atomar:
--   1. Berechtigung prüft (Aufgießer oder Admin)
--   2. Sauna prüft (muss 80°C sein)
--   3. Slot-Status prüft (19+20 müssen frei ODER Personal-Fallback sein)
--   4. Existierende Personal-Fallbacks für 19:00 + 20:00 in dieser Sauna löscht
--   5. Neue Banja-Infusion (duration=90) inserted
--      → der bestehende Trigger validate_infusion_banja_and_overlap (0104)
--        validiert dann Constraints + Overlap.
--
-- Alles in einer Transaction — entweder geht Banja durch oder gar nichts.

CREATE OR REPLACE FUNCTION public.book_banja_ritual(
  p_sauna_id uuid,
  p_date date,                       -- Datum in Europe/Berlin (YYYY-MM-DD)
  p_title text DEFAULT '🇷🇺 Traditionelles Banja-Ritual',
  p_attributes text[] DEFAULT ARRAY['banja','wenik']::text[],
  p_oils text[] DEFAULT NULL,
  p_team_infusion boolean DEFAULT false,
  p_saunameister_id uuid DEFAULT NULL   -- Admin-only Override
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_sauna_temp text;
  v_start_19 timestamptz;
  v_start_20 timestamptz;
  v_new_id uuid;
  v_effective_meister uuid;
  v_clean_attrs text[];
BEGIN
  -- ── Permission ──────────────────────────────────────────────────────
  SELECT id INTO v_member_id
    FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt — bitte neu anmelden.';
  END IF;
  v_is_admin     := public.is_admin();
  v_is_aufgieser := public.is_aufgieser();
  IF NOT v_is_admin AND NOT v_is_aufgieser THEN
    RAISE EXCEPTION 'Keine Berechtigung — nur Aufgießer und Admins dürfen Banja anlegen.';
  END IF;

  IF NOT v_is_admin AND p_saunameister_id IS NOT NULL AND p_saunameister_id <> v_member_id THEN
    RAISE EXCEPTION 'Saunameister-Wechsel ist Admin-only.';
  END IF;
  v_effective_meister := COALESCE(
    CASE WHEN v_is_admin THEN p_saunameister_id ELSE NULL END,
    v_member_id
  );

  -- ── Sauna-Check ─────────────────────────────────────────────────────
  SELECT temperature_label INTO v_sauna_temp
    FROM public.saunas WHERE id = p_sauna_id;
  IF v_sauna_temp IS DISTINCT FROM '80°C' THEN
    RAISE EXCEPTION 'Banja-Ritual findet ausschließlich in der 80°C-Sauna statt (gewählt: %).', COALESCE(v_sauna_temp, '?');
  END IF;

  -- ── Banja-Marker erzwingen ──────────────────────────────────────────
  v_clean_attrs := COALESCE(p_attributes, ARRAY[]::text[]);
  IF NOT ('banja' = ANY(v_clean_attrs)) THEN
    v_clean_attrs := array_append(v_clean_attrs, 'banja');
  END IF;

  -- ── 19:00 + 20:00 Berlin-Zeit ───────────────────────────────────────
  v_start_19 := ((p_date::text || ' 19:00:00')::timestamp) AT TIME ZONE 'Europe/Berlin';
  v_start_20 := ((p_date::text || ' 20:00:00')::timestamp) AT TIME ZONE 'Europe/Berlin';

  IF v_start_19 < now() THEN
    RAISE EXCEPTION 'Banja-Slot liegt in der Vergangenheit.';
  END IF;

  -- ── Konflikte prüfen: 19+20 dürfen nur frei oder Personal-Fallback sein
  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = p_sauna_id
       AND start_time = v_start_19
       AND is_personal_fallback = false
  ) THEN
    RAISE EXCEPTION 'Banja kann nicht angelegt werden: 19:00-Slot ist bereits durch einen echten Aufgießer belegt.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.infusions
     WHERE sauna_id = p_sauna_id
       AND start_time = v_start_20
       AND is_personal_fallback = false
  ) THEN
    RAISE EXCEPTION 'Banja kann nicht angelegt werden: 20:00-Slot ist bereits durch einen echten Aufgießer belegt.';
  END IF;

  -- ── Personal-Fallbacks für 19+20 in dieser Sauna LÖSCHEN ───────────
  -- Damit der nachfolgende INSERT (90 Min) nicht vom Overlap-Trigger
  -- (Migration 0104) geblockt wird.
  DELETE FROM public.infusions
   WHERE sauna_id = p_sauna_id
     AND start_time IN (v_start_19, v_start_20)
     AND is_personal_fallback = true;

  -- ── Banja als neue Infusion eintragen ──────────────────────────────
  -- Der Trigger validate_infusion_banja_and_overlap (0104) validiert:
  --   duration=90, start_hour=19 Berlin, sauna=80°C, kein Overlap.
  INSERT INTO public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, team_infusion, is_personal_fallback
  ) VALUES (
    p_sauna_id, v_start_19, 90, btrim(COALESCE(p_title, '🇷🇺 Traditionelles Banja-Ritual')), NULL,
    v_clean_attrs, p_oils, v_effective_meister, COALESCE(p_team_infusion, false), false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_banja_ritual(uuid, date, text, text[], text[], boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.book_banja_ritual(uuid, date, text, text[], text[], boolean, uuid) TO authenticated;

COMMENT ON FUNCTION public.book_banja_ritual(uuid, date, text, text[], text[], boolean, uuid) IS
  'Atomare Banja-Ritual-Buchung. Löscht bestehende Personal-Fallbacks für 19+20:00 in der 80°C-Sauna und legt 90-Min-Banja an. Validierung via Trigger validate_infusion_banja_and_overlap (Migration 0104).';
