-- Migration 0070: Kiosk-RPCs für /oil-room — Aufguss anlegen + absagen OHNE Login
--
-- Use-Case: Das Tablet im Ölraum hat keinen Login. Jeder Aufgießer, der per
-- Check-in (QR oder PIN am Eingang) als is_present markiert ist, soll am
-- Tablet einen Aufguss anlegen oder seinen eigenen wieder absagen können —
-- insbesondere Mitglieder ohne Smartphone.
--
-- Die bestehende RPC create_infusion (Migration 0069) bricht intern mit
-- "Nicht eingeloggt" ab sobald auth.uid()=NULL — passt deshalb nicht zum
-- Kiosk-Modus. Diese Migration liefert zwei neue Public-RPCs, die
-- saunameister_id als Parameter nehmen statt aus der Session zu lesen.
--
-- Validierungs-Pattern identisch zu list_present_aufgieser (Migration 0068):
-- nur eingecheckte, nicht revokierte Aufgießer/Guest-Aufgießer/Admins
-- dürfen identifiziert werden. Bestehende create_infusion und
-- cancel_my_infusion bleiben unverändert (werden vom /planner für
-- eingeloggte Aufgießer weiter genutzt).

-- ─── create_infusion_kiosk ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_infusion_kiosk(
  p_saunameister_id uuid,
  p_sauna_id uuid,
  p_start_time timestamptz,
  p_duration_minutes int,
  p_title text,
  p_description text DEFAULT NULL,
  p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_team_infusion boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.members%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF p_saunameister_id IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst auswählen, wer du bist.';
  END IF;

  -- Member auflösen + Aufgießer-Check (gleicher WHERE-Block wie
  -- list_present_aufgieser, Migration 0068).
  SELECT * INTO m
  FROM public.members
  WHERE id = p_saunameister_id
    AND revoked_at IS NULL
    AND (
      (role = 'member' AND is_aufgieser = true)
      OR role = 'guest_aufgieser'
      OR role = 'admin'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Du musst ein freigeschalteter Aufgießer sein.';
  END IF;

  IF NOT m.is_present THEN
    RAISE EXCEPTION 'Bitte zuerst am Eingang einchecken.';
  END IF;

  -- Pflichtfelder
  IF p_sauna_id IS NULL THEN
    RAISE EXCEPTION 'Sauna fehlt.';
  END IF;
  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Startzeit fehlt.';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 THEN
    RAISE EXCEPTION 'Dauer fehlt oder ungültig.';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) < 1 THEN
    RAISE EXCEPTION 'Titel fehlt.';
  END IF;

  -- Insert. BEFORE-Trigger (set_end_time, set_temperature) und AFTER-Trigger
  -- (activity_log, notify_followers) laufen automatisch.
  INSERT INTO public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) VALUES (
    p_sauna_id, p_start_time, p_duration_minutes, btrim(p_title), p_description,
    coalesce(p_attributes, ARRAY[]::text[]), p_oils, p_saunameister_id, p_template_id,
    coalesce(p_team_infusion, false), false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_infusion_kiosk(uuid, uuid, timestamptz, int, text, text, text[], text[], uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_infusion_kiosk(uuid, uuid, timestamptz, int, text, text, text[], text[], uuid, boolean) TO anon, authenticated;

-- ─── cancel_infusion_kiosk ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_infusion_kiosk(
  p_id uuid,
  p_saunameister_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.members%ROWTYPE;
  v_meister uuid;
  v_start timestamptz;
  v_minutes_until int;
BEGIN
  IF p_saunameister_id IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst auswählen, wer du bist.';
  END IF;

  -- Identische Member-Validierung wie in create_infusion_kiosk.
  SELECT * INTO m
  FROM public.members
  WHERE id = p_saunameister_id
    AND revoked_at IS NULL
    AND (
      (role = 'member' AND is_aufgieser = true)
      OR role = 'guest_aufgieser'
      OR role = 'admin'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Du musst ein freigeschalteter Aufgießer sein.';
  END IF;

  IF NOT m.is_present THEN
    RAISE EXCEPTION 'Bitte zuerst am Eingang einchecken.';
  END IF;

  SELECT saunameister_id, start_time INTO v_meister, v_start
  FROM public.infusions WHERE id = p_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Aufguss nicht gefunden.';
  END IF;

  IF v_meister IS DISTINCT FROM p_saunameister_id THEN
    RAISE EXCEPTION 'Du kannst nur deine eigenen Aufgüsse absagen.';
  END IF;

  -- 60-Minuten-Tafel-Lock wie cancel_my_infusion (Migration 0066).
  -- Am Kiosk gibt es kein Admin-Konzept → kein Bypass.
  v_minutes_until := floor(extract(epoch from (v_start - now())) / 60);
  IF v_minutes_until < 60 THEN
    RAISE EXCEPTION
      'Absage nicht möglich: der Aufguss steht in % Minuten auf der Tafel. Ab 60 Minuten vor Start ist eine Absage gesperrt — bitte intern Bescheid geben damit Personal-Fallback greift.',
      greatest(0, v_minutes_until);
  END IF;

  DELETE FROM public.infusions WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_infusion_kiosk(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_infusion_kiosk(uuid, uuid) TO anon, authenticated;
