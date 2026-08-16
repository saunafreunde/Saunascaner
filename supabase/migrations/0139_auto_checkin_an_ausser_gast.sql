-- 0139 — WLAN-Auto-Check-in: für alle an, für Gäste nie.
--
-- Bisher war die Funktion Opt-in und stand auf `false` — genutzt haben sie
-- 7 von 41 Konten. Wer sie nicht kennt, checkt sich also weiter von Hand ein
-- oder vergisst es, und ohne Check-in kann er nichts bewerten.
--
-- Ab jetzt: bei jeder Rolle AUSSER Gast automatisch an. Gäste bekommen sie
-- nie — sie kommen unregelmäßig, oft in Begleitung, und ein Konto, das sich
-- beim Betreten des WLANs von selbst als anwesend meldet, wäre bei ihnen
-- eher eine Überraschung als ein Dienst.
--
-- Wichtig: Mitglieder können weiterhin selbst abschalten. Der Trigger fasst
-- eine bewusste Entscheidung NICHT an — er greift nur beim Anlegen und beim
-- Rollenwechsel. (Gegengeprüft: Mitglied-Opt-out bleibt bestehen, Gast lässt
-- sich auch per direktem UPDATE nicht einschalten.)

ALTER TABLE public.members ALTER COLUMN auto_checkin_enabled SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.auto_checkin_regel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.role = 'gast' THEN
    -- Gilt immer, egal über welchen Weg jemand es zu setzen versucht.
    NEW.auto_checkin_enabled := false;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.auto_checkin_enabled := true;
  ELSIF NEW.role IS DISTINCT FROM OLD.role AND OLD.role = 'gast' THEN
    -- Aus einem Gast wird ein Mitglied → ab jetzt bekommt er die Funktion.
    NEW.auto_checkin_enabled := true;
  END IF;
  -- Sonst: nichts anfassen. Wer es bewusst abgeschaltet hat, hat es
  -- abgeschaltet — das darf kein Trigger überstimmen.
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_checkin_regel ON public.members;
CREATE TRIGGER trg_auto_checkin_regel
  BEFORE INSERT OR UPDATE OF role, auto_checkin_enabled ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.auto_checkin_regel();

-- Bestand angleichen (vorher: 7 von 41 an, darunter ein Gast).
UPDATE public.members SET auto_checkin_enabled = true
 WHERE role <> 'gast' AND auto_checkin_enabled = false;
UPDATE public.members SET auto_checkin_enabled = false
 WHERE role = 'gast' AND auto_checkin_enabled = true;

-- Zweite Sicherung an der Stelle, an der es wirklich zählt: selbst wenn das
-- Flag bei einem Gast je wieder true würde, checkt ihn das WLAN nicht ein.
CREATE OR REPLACE FUNCTION public.auto_checkin_via_wifi(p_local_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_me_id uuid; v_opt_in boolean; v_is_present boolean; v_rolle text;
  v_on_wifi boolean; v_needs_family boolean;
BEGIN
  SELECT id, auto_checkin_enabled, is_present, role,
         (family_has_partner OR family_children_count > 0)
    INTO v_me_id, v_opt_in, v_is_present, v_rolle, v_needs_family
  FROM public.members
  WHERE auth_user_id = auth.uid() AND revoked_at IS NULL AND approved = true;
  IF v_me_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_logged_in'); END IF;
  IF v_rolle = 'gast' THEN RETURN jsonb_build_object('ok', false, 'reason', 'gast_kein_auto_checkin'); END IF;
  IF NOT v_opt_in THEN RETURN jsonb_build_object('ok', false, 'reason', 'opt_in_disabled'); END IF;
  IF v_is_present THEN RETURN jsonb_build_object('ok', true, 'reason', 'already_present', 'changed', false); END IF;
  v_on_wifi := public.check_wifi_subnet(p_local_ip);
  IF NOT v_on_wifi THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_on_wifi'); END IF;
  UPDATE public.members SET is_present = true, last_scan_at = now() WHERE id = v_me_id;
  RETURN jsonb_build_object('ok', true, 'reason', 'checked_in', 'changed', true,
    'needs_family_modal', v_needs_family);
END;
$$;
