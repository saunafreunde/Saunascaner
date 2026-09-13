-- 0151 — Saunafest: Bewerbungen statt Erstbuchung.
--
-- Am Fest gilt nicht „wer zuerst klickt": Aufgießer und Gast-Aufgießer
-- bewerben sich auf beliebig viele Slots in der Sauna ihrer Wahl, mehrere
-- dürfen denselben Slot wollen. Der Admin entscheidet im Reiter „Saunafest",
-- wer wann aufgießt (Vorgabe Christoph, 13.09.2026).
--
-- Bausteine:
--  • saunafest_bewerbungen — eine Zeile je Mitglied × Fest × Sauna × Stunde.
--    Bewerben/Zurückziehen läuft direkt über die Tabelle (RLS: nur für sich
--    selbst, nur solange offen). Lesen dürfen alle Angemeldeten: der Planer
--    zeigt den Zähler je Slot und die eigene Bewerbung.
--  • saunafest_zuteilen(p_id) — Admin. Legt den Aufguss an (übernimmt einen
--    Personal-Fallback im Slot, sonst neuer Aufguss), setzt die Bewerbung auf
--    zugeteilt und die anderen des Slots auf abgelehnt. Der Aufguss gehört
--    danach dem Bewerber — Titel und Öle trägt er selbst nach (die
--    Nachpflege-Liste erinnert ihn daran).
--  • saunafest_zuteilung_aufheben(p_id) — Admin. Nimmt den Aufguss wieder
--    heraus, die Bewerbung wird offen, die abgelehnten des Slots ebenfalls.

CREATE TABLE IF NOT EXISTS public.saunafest_bewerbungen (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fest_datum      date NOT NULL REFERENCES public.saunafest_tage(datum) ON DELETE CASCADE,
  sauna_id        uuid NOT NULL REFERENCES public.saunas(id) ON DELETE CASCADE,
  slot_hour       smallint NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  member_id       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'zugeteilt', 'abgelehnt')),
  infusion_id     uuid REFERENCES public.infusions(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  entschieden_at  timestamptz,
  UNIQUE (fest_datum, sauna_id, slot_hour, member_id)
);
CREATE INDEX IF NOT EXISTS saunafest_bewerbungen_slot_idx
  ON public.saunafest_bewerbungen (fest_datum, sauna_id, slot_hour);

COMMENT ON TABLE public.saunafest_bewerbungen IS
  'Slot-Bewerbungen fuer Saunafeste (0151). Mehrere je Slot erlaubt; der Admin teilt per saunafest_zuteilen() zu.';

ALTER TABLE public.saunafest_bewerbungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saunafest_bewerbungen_read ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_read ON public.saunafest_bewerbungen
  FOR SELECT TO authenticated USING (true);

-- Bewerben: nur für sich selbst, nur als Aufgießer/Gast-Aufgießer/Admin,
-- nur offen und nur für Feste, die noch kommen.
DROP POLICY IF EXISTS saunafest_bewerbungen_insert ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_insert ON public.saunafest_bewerbungen
  FOR INSERT TO authenticated WITH CHECK (
    status = 'offen'
    AND infusion_id IS NULL
    AND member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND (public.is_aufgieser() OR public.is_admin())
    AND fest_datum >= (now() AT TIME ZONE 'Europe/Berlin')::date
  );

-- Zurückziehen: die eigene, solange sie offen ist. Admin darf alles löschen.
DROP POLICY IF EXISTS saunafest_bewerbungen_delete ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_delete ON public.saunafest_bewerbungen
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (status = 'offen' AND member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  );

-- Ändern nur der Admin (normalerweise über die RPCs unten).
DROP POLICY IF EXISTS saunafest_bewerbungen_update_admin ON public.saunafest_bewerbungen;
CREATE POLICY saunafest_bewerbungen_update_admin ON public.saunafest_bewerbungen
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saunafest_bewerbungen TO authenticated;

-- ── Zuteilen ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.saunafest_zuteilen(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_b        public.saunafest_bewerbungen%rowtype;
  v_fest     public.saunafest_tage%rowtype;
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

  SELECT * INTO v_fest FROM public.saunafest_tage WHERE datum = v_b.fest_datum;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saunafest nicht gefunden.'; END IF;
  IF v_b.slot_hour < v_fest.ab_zwei_saunen THEN
    RAISE EXCEPTION 'Aufguesse am Fest erst ab %:00 Uhr.', v_fest.ab_zwei_saunen;
  END IF;
  IF v_b.sauna_id = v_fest.dritte_sauna_id AND v_b.slot_hour < v_fest.ab_drei_saunen THEN
    RAISE EXCEPTION 'Diese Sauna oeffnet am Fest erst um %:00 Uhr.', v_fest.ab_drei_saunen;
  END IF;

  -- Ein Slot wird nie doppelt vergeben: Sauna + Tag sperren, wie book_banja_ritual.
  PERFORM pg_advisory_xact_lock(hashtext(v_b.sauna_id::text), hashtext(v_b.fest_datum::text));

  v_start := ((v_b.fest_datum::text || ' ' || lpad(v_b.slot_hour::text, 2, '0') || ':00:00')::timestamp)
             AT TIME ZONE 'Europe/Berlin';
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

  -- Personal-Fallback im Slot: übernehmen statt daneben einfügen — der
  -- Overlap-Trigger zählt Fallbacks mit (wie takeover_personal_fallback, 0034).
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
   WHERE fest_datum = v_b.fest_datum AND sauna_id = v_b.sauna_id AND slot_hour = v_b.slot_hour
     AND id <> v_b.id AND status = 'offen';

  RETURN v_inf_id;
END;
$$;

-- ── Zuteilung aufheben ──────────────────────────────────────────────────────
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

  -- Der Aufguss verschwindet nur, wenn er noch dem Bewerber gehört und in
  -- der Zukunft liegt. Der Personal-Fallback entsteht beim nächsten
  -- materialize_infusion_horizon() von selbst wieder.
  DELETE FROM public.infusions
   WHERE id = v_b.infusion_id AND saunameister_id = v_b.member_id AND start_time > now();

  UPDATE public.saunafest_bewerbungen
     SET status = 'offen', infusion_id = NULL, entschieden_at = NULL
   WHERE id = v_b.id;
  UPDATE public.saunafest_bewerbungen
     SET status = 'offen', entschieden_at = NULL
   WHERE fest_datum = v_b.fest_datum AND sauna_id = v_b.sauna_id AND slot_hour = v_b.slot_hour
     AND status = 'abgelehnt';
END;
$$;

-- Neue public-Funktionen bekommen bei Supabase automatisch einen anon-Grant
-- (siehe 0123). Zuteilen darf nur der Admin — geprüft in der Funktion; anon
-- soll sie gar nicht erst aufrufen können.
REVOKE ALL ON FUNCTION public.saunafest_zuteilen(uuid) FROM public;
REVOKE ALL ON FUNCTION public.saunafest_zuteilen(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.saunafest_zuteilen(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.saunafest_zuteilung_aufheben(uuid) FROM public;
REVOKE ALL ON FUNCTION public.saunafest_zuteilung_aufheben(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.saunafest_zuteilung_aufheben(uuid) TO authenticated;
