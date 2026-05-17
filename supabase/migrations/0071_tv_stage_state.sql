-- Migration 0071: Bühnen-State für die TV-Tafel (Szenarien + Effekte)
--
-- Use-Case: Admin steuert vom Handy aus, welche Szenarien-Layer auf der Tafel
-- aktiv sind (z.B. Schnee, Weihnachts-Lichter, Halloween-Kürbisse) und löst
-- transiente Effekte aus (Feuerwerk, Monster-Schreck, Konfetti, ...).
--
-- Pattern: Single-Row-Tabelle (id=1, CHECK-Constraint), wie für globale
-- TV-Settings üblich. Realtime über supabase_realtime-Publication, Dashboard
-- reagiert via postgres_changes-Subscription in useRealtime.ts.

-- ─── Tabelle ──────────────────────────────────────────────────────────────────

CREATE TABLE public.tv_stage_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Vom Admin manuell aktivierte Scene-IDs (additiv zu Auto, oder alleinig
  -- wenn suppress_auto_season=true)
  manual_scenes text[] NOT NULL DEFAULT '{}',
  -- TRUE = Datum-basierte Auto-Saison wird ignoriert, nur manual_scenes zählen
  suppress_auto_season boolean NOT NULL DEFAULT false,
  -- Letzter ausgelöster Effekt: {kind: 'fireworks', triggered_at: ts, nonce: uuid}.
  -- Frontend nutzt nonce als React-key, damit derselbe Effect-Kind mehrmals
  -- hintereinander auslösbar bleibt. triggered_at zum Ignorieren alter Effekte
  -- beim Tafel-Reload.
  last_effect jsonb DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.members(id) ON DELETE SET NULL
);

INSERT INTO public.tv_stage_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.tv_stage_state ENABLE ROW LEVEL SECURITY;

-- Lesen: public (Dashboard läuft ohne Login)
CREATE POLICY tv_stage_state_read ON public.tv_stage_state
  FOR SELECT USING (true);

-- Schreiben: nur Admin (via RPCs unten, direkter UPDATE eigentlich nicht
-- vorgesehen, aber als Defense-in-Depth)
CREATE POLICY tv_stage_state_write_admin ON public.tv_stage_state
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_stage_state;

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

-- Setzt komplette Scene-Liste + Override-Flag in einem Rutsch.
-- Genutzt für Theme-One-Click-Buttons im Admin-UI.
CREATE OR REPLACE FUNCTION public.set_stage_manual_scenes(
  p_scenes text[],
  p_suppress_auto boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins können die Bühne steuern.';
  END IF;

  UPDATE public.tv_stage_state
  SET manual_scenes = coalesce(p_scenes, '{}'),
      suppress_auto_season = coalesce(p_suppress_auto, false),
      updated_at = now(),
      updated_by = v_member_id
  WHERE id = 1;
END;
$$;

-- Toggle einer einzelnen Scene-ID. Convenience für Checkbox-UI.
CREATE OR REPLACE FUNCTION public.set_stage_scene_toggle(
  p_scene_id text,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_current text[];
BEGIN
  SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins können die Bühne steuern.';
  END IF;
  IF p_scene_id IS NULL OR length(btrim(p_scene_id)) < 1 THEN
    RAISE EXCEPTION 'Scene-ID fehlt.';
  END IF;

  SELECT manual_scenes INTO v_current FROM public.tv_stage_state WHERE id = 1;

  IF p_active THEN
    -- Hinzufügen falls noch nicht drin
    IF NOT (p_scene_id = ANY(v_current)) THEN
      v_current := array_append(v_current, p_scene_id);
    END IF;
  ELSE
    -- Entfernen
    v_current := array_remove(v_current, p_scene_id);
  END IF;

  UPDATE public.tv_stage_state
  SET manual_scenes = v_current,
      updated_at = now(),
      updated_by = v_member_id
  WHERE id = 1;
END;
$$;

-- Triggert einen One-Shot-Effekt. nonce wird als React-key auf der Tafel
-- genutzt, damit derselbe Effect-Kind direkt hintereinander mehrmals
-- ausgelöst werden kann.
CREATE OR REPLACE FUNCTION public.trigger_stage_effect(p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins können Effekte auslösen.';
  END IF;
  IF p_kind IS NULL OR length(btrim(p_kind)) < 1 THEN
    RAISE EXCEPTION 'Effekt-Kind fehlt.';
  END IF;

  UPDATE public.tv_stage_state
  SET last_effect = jsonb_build_object(
        'kind', btrim(p_kind),
        'triggered_at', now(),
        'nonce', gen_random_uuid()
      ),
      updated_at = now(),
      updated_by = v_member_id
  WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_stage_manual_scenes(text[], boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_stage_manual_scenes(text[], boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_stage_scene_toggle(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_stage_scene_toggle(text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_stage_effect(text) FROM public;
GRANT EXECUTE ON FUNCTION public.trigger_stage_effect(text) TO authenticated;
