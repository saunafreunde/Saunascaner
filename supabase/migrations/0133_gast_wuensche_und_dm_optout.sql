-- 0133 — Der Gast wird eingebunden: Duft-Wünsche + Nachrichten-Opt-out
--
-- Ausgangslage: Gäste dürfen schon lange Aufgießern folgen (45 Follows) und
-- ihnen schreiben (/dm ist für sie nicht gesperrt) — nur findet das niemand.
-- In der gesamten Datenbank steht GENAU EINE Direktnachricht.
--
-- Zwei Dinge:
--   1. Ein Gast kann sich zu einem konkreten kommenden Aufguss einen Duft
--      wünschen. Der Wunsch hängt am Aufguss, nicht an der Person — dadurch
--      landet er da, wo er brauchbar ist: im Öl-Raum, wo ohnehin steht, was
--      ans Regal muss.
--   2. Weil der Nachrichten-Knopf gleich sichtbar wird, bekommt jeder
--      Aufgießer vorher einen Schalter, mit dem er Nachrichten von Gästen
--      abstellen kann. Voreinstellung: an — aber abschaltbar, bevor es das
--      erste Mal jemand zu weit treibt.

-- ── 1. Nachrichten-Opt-out ────────────────────────────────────────────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dm_von_gaesten boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.members.dm_von_gaesten IS
  'Darf mir ein Gast schreiben? Voreinstellung true. Steuert nur Gäste — Vereinsmitglieder untereinander sind davon nicht betroffen (0133).';

-- Self-Write über members ist für Nicht-Admins still gefiltert, deshalb ein
-- eigener SECDEF-RPC (wie set_my_motto, set_my_avatar, ...).
CREATE OR REPLACE FUNCTION public.set_my_dm_von_gaesten(p_wert boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.members
     SET dm_von_gaesten = p_wert
   WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authenticated'; END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_my_dm_von_gaesten(boolean) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_my_dm_von_gaesten(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_dm_von_gaesten(boolean) TO authenticated;

-- Der Schalter muss dort greifen, wo das Gespräch entsteht — sonst hilft er
-- nichts. DROP vor CREATE ist hier nicht nötig (Signatur unverändert).
CREATE OR REPLACE FUNCTION public.dm_get_or_create_conversation(p_other_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_meine_rolle text; v_lo uuid; v_hi uuid; v_conv uuid;
BEGIN
  SELECT id, role INTO v_me, v_meine_rolle
    FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_other_id = v_me THEN RAISE EXCEPTION 'cannot_dm_self'; END IF;

  -- Gast schreibt jemanden an, der das abgestellt hat → Abbruch.
  -- Ein bereits bestehendes Gespräch bleibt bestehen; der Schalter verhindert
  -- nur das Aufmachen eines neuen.
  IF v_meine_rolle IN ('gast', 'fan') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.members
      WHERE id = p_other_id AND dm_von_gaesten
    ) AND NOT EXISTS (
      SELECT 1 FROM public.dm_conversations
      WHERE member_lo = LEAST(v_me, p_other_id)
        AND member_hi = GREATEST(v_me, p_other_id)
    ) THEN
      RAISE EXCEPTION 'empfaenger_nimmt_keine_gastnachrichten';
    END IF;
  END IF;

  v_lo := LEAST(v_me, p_other_id); v_hi := GREATEST(v_me, p_other_id);
  INSERT INTO public.dm_conversations(member_lo, member_hi)
  VALUES (v_lo, v_hi) ON CONFLICT DO NOTHING;
  SELECT id INTO v_conv FROM public.dm_conversations
  WHERE member_lo = v_lo AND member_hi = v_hi;
  RETURN v_conv;
END; $$;

REVOKE EXECUTE ON FUNCTION public.dm_get_or_create_conversation(uuid) FROM anon;

-- ── 2. Duft-Wünsche ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aufguss_wuensche (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id)   ON DELETE CASCADE,
  infusion_id uuid NOT NULL REFERENCES public.infusions(id) ON DELETE CASCADE,
  -- Schlüssel aus src/lib/oils.ts bzw. 'custom:<uuid>' — bewusst ohne
  -- Fremdschlüssel, die Öl-Liste lebt im Frontend und wächst ohne Migration.
  oil_key     text NOT NULL CHECK (char_length(oil_key) BETWEEN 1 AND 80),
  notiz       text CHECK (notiz IS NULL OR char_length(notiz) <= 140),
  status      text NOT NULL DEFAULT 'offen'
              CHECK (status IN ('offen', 'erfuellt', 'abgelehnt')),
  -- Berliner Kalendertag des Wunsches. Eigene Spalte, weil sich
  -- "(created_at AT TIME ZONE 'Europe/Berlin')::date" nicht indizieren lässt
  -- (STABLE, nicht IMMUTABLE) — und ohne Index wäre das Tageslimit eine
  -- Prüfung mit Rennen.
  wunsch_tag  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  decided_by  uuid REFERENCES public.members(id) ON DELETE SET NULL
);

-- Ein offener Wunsch pro Gast und Tag. Erfüllte/abgelehnte zählen nicht mit,
-- sonst könnte ein früh erfüllter Wunsch den ganzen Tag blockieren.
CREATE UNIQUE INDEX IF NOT EXISTS aufguss_wuensche_ein_offener_pro_tag
  ON public.aufguss_wuensche (member_id, wunsch_tag)
  WHERE status = 'offen';

CREATE INDEX IF NOT EXISTS aufguss_wuensche_infusion
  ON public.aufguss_wuensche (infusion_id) WHERE status = 'offen';

ALTER TABLE public.aufguss_wuensche ENABLE ROW LEVEL SECURITY;

-- Lesen: eigener Wunsch, oder ich bin der Aufgießer dieses Aufgusses, oder Admin.
CREATE POLICY aufguss_wuensche_read ON public.aufguss_wuensche
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid())
    OR infusion_id IN (
      SELECT i.id FROM public.infusions i
      JOIN public.members m ON m.id = i.saunameister_id
      WHERE m.auth_user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Geschrieben wird ausschließlich über die RPCs unten.
CREATE POLICY aufguss_wuensche_admin_all ON public.aufguss_wuensche
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. Wunsch abgeben ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_wunsch(
  p_infusion_id uuid,
  p_oil_key     text,
  p_notiz       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_tag date; v_start timestamptz; v_fallback boolean; v_id uuid;
BEGIN
  SELECT id INTO v_me FROM public.members
   WHERE auth_user_id = auth.uid() AND approved AND revoked_at IS NULL;
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT start_time, coalesce(is_personal_fallback, false)
    INTO v_start, v_fallback
    FROM public.infusions WHERE id = p_infusion_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'aufguss_unbekannt'; END IF;

  -- Ein Wunsch für einen bereits gelaufenen Aufguss ist sinnlos, und ein
  -- Personal-Fallback hat keinen Aufgießer, der ihn lesen könnte.
  IF v_start <= now() THEN RAISE EXCEPTION 'aufguss_liegt_in_der_vergangenheit'; END IF;
  IF v_fallback THEN RAISE EXCEPTION 'kein_aufgieser_fuer_diesen_slot'; END IF;

  v_tag := (now() AT TIME ZONE 'Europe/Berlin')::date;

  INSERT INTO public.aufguss_wuensche (member_id, infusion_id, oil_key, notiz, wunsch_tag)
  VALUES (v_me, p_infusion_id, p_oil_key, nullif(btrim(coalesce(p_notiz, '')), ''), v_tag)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'schon_ein_offener_wunsch_heute';
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_wunsch(uuid, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_wunsch(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_wunsch(uuid, text, text) TO authenticated;

-- ── 4. Wunsch beantworten ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_wunsch(p_wunsch_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_darf boolean;
BEGIN
  IF p_status NOT IN ('erfuellt', 'abgelehnt') THEN
    RAISE EXCEPTION 'ungueltiger_status';
  END IF;

  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT (i.saunameister_id = v_me) OR public.is_admin()
    INTO v_darf
    FROM public.aufguss_wuensche w
    JOIN public.infusions i ON i.id = w.infusion_id
   WHERE w.id = p_wunsch_id;
  IF v_darf IS NOT TRUE THEN RAISE EXCEPTION 'nicht_dein_aufguss'; END IF;

  UPDATE public.aufguss_wuensche
     SET status = p_status, decided_at = now(), decided_by = v_me
   WHERE id = p_wunsch_id AND status = 'offen';
END; $$;

REVOKE EXECUTE ON FUNCTION public.resolve_wunsch(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.resolve_wunsch(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_wunsch(uuid, text) TO authenticated;

-- ── 5. Wünsche für das Öl-Raum-Tablet ─────────────────────────────────────
-- Das Tablet läuft anonym (Kiosk-Muster). Deshalb ein eigener SECDEF-RPC
-- statt eines anon-Grants auf die Tabelle — und OHNE Namen: wer sich was
-- gewünscht hat, geht den Öl-Raum nichts an, dort zählt nur das Fläschchen.
CREATE OR REPLACE FUNCTION public.list_oelraum_wuensche(p_stunden int DEFAULT 6)
RETURNS TABLE(infusion_id uuid, oil_key text, notiz text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT w.infusion_id, w.oil_key, w.notiz
  FROM public.aufguss_wuensche w
  JOIN public.infusions i ON i.id = w.infusion_id
  WHERE w.status = 'offen'
    AND i.start_time > now()
    AND i.start_time < now() + make_interval(hours => greatest(1, least(24, p_stunden)))
  ORDER BY i.start_time, w.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.list_oelraum_wuensche(int) FROM public;
GRANT EXECUTE ON FUNCTION public.list_oelraum_wuensche(int) TO anon, authenticated;

-- ── 6. Meine Wünsche (Gast-Ansicht) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_my_wuensche()
RETURNS TABLE(id uuid, infusion_id uuid, oil_key text, notiz text, status text,
              created_at timestamptz, infusion_start timestamptz,
              infusion_title text, sauna_name text, aufgieser_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT w.id, w.infusion_id, w.oil_key, w.notiz, w.status, w.created_at,
         i.start_time, i.title, s.name, m.name
  FROM public.aufguss_wuensche w
  JOIN public.infusions i ON i.id = w.infusion_id
  LEFT JOIN public.saunas  s ON s.id = i.sauna_id
  LEFT JOIN public.members m ON m.id = i.saunameister_id
  WHERE w.member_id IN (
    SELECT mm.id FROM public.members mm WHERE mm.auth_user_id = auth.uid()
  )
  ORDER BY i.start_time DESC
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_wuensche() FROM public;
REVOKE EXECUTE ON FUNCTION public.list_my_wuensche() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_wuensche() TO authenticated;

-- ── 7. Wünsche zu meinen Aufgüssen (Aufgießer-Ansicht) ────────────────────
CREATE OR REPLACE FUNCTION public.list_wuensche_fuer_meine_aufguesse()
RETURNS TABLE(id uuid, infusion_id uuid, oil_key text, notiz text, status text,
              created_at timestamptz, infusion_start timestamptz,
              infusion_title text, sauna_name text,
              gast_id uuid, gast_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT w.id, w.infusion_id, w.oil_key, w.notiz, w.status, w.created_at,
         i.start_time, i.title, s.name,
         g.id, g.name
  FROM public.aufguss_wuensche w
  JOIN public.infusions i ON i.id = w.infusion_id
  JOIN public.members  g ON g.id = w.member_id
  LEFT JOIN public.saunas s ON s.id = i.sauna_id
  WHERE i.saunameister_id IN (
    SELECT mm.id FROM public.members mm WHERE mm.auth_user_id = auth.uid()
  )
    AND i.start_time > now() - interval '12 hours'
  ORDER BY i.start_time, w.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() FROM public;
REVOKE EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() TO authenticated;
