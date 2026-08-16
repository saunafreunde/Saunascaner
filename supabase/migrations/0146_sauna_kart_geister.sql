-- 0146_sauna_kart_geister.sql — angewendet 16.08.2026.
--
-- Sauna-Kart (Spiele-Neubewertung, Stufe 4): das Flaggschiff-Spiel.
-- Mode-7-Rennen auf Saunatuch-Schlitten durch den Schwarzwald — und der
-- Mehrspieler-Teil sind GEISTER statt Echtzeit: die beste Fahrt jedes
-- Mitglieds wird aufgezeichnet, die anderen fahren gegen die durchsichtige
-- Aufzeichnung. Echtzeit-Racing über Supabase-Realtime wäre Latenz-Lotterie;
-- „ich habe Hannes' Geist auf der Kelo-Kurve geschlagen" erzeugt dieselbe
-- Rivalität ohne eine Zeile Netcode.
--
-- Bewusst NICHT in games_score: dort gilt „höher = besser", beim Rennen
-- zählt die NIEDRIGSTE Zeit. Ein Vorzeichen-Trick hätte jede Bestenliste
-- und die Wochen-Krönung (0144) verwirrt — eigene Tabelle, eigene RPCs.
--
-- Ein Geist pro Mitglied und Strecke (UNIQUE): gespeichert wird nur die
-- Bestzeit, ein Upsert ersetzt sie. Samples als jsonb
-- {v:1, dt:100, pts:[[x,y,heading10],…]} — bei 100-ms-Abtastung und
-- ~3 Minuten Maximalfahrt bleibt das unter 40 KB (hart geprüft).

CREATE TABLE IF NOT EXISTS public.kart_ghosts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  strecke    text NOT NULL,
  zeit_ms    integer NOT NULL CHECK (zeit_ms BETWEEN 20000 AND 600000),
  samples    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, strecke)
);

ALTER TABLE public.kart_ghosts ENABLE ROW LEVEL SECURITY;
-- Kein direkter Tabellenzugriff: Lesen läuft über die RPC (die den
-- Anzeigenamen mitliefert — members ist für andere nicht lesbar), Schreiben
-- über den geprüften Submit. Keine Policies = kein Zugriff außer SECDEF.

-- ─── Bestzeit einreichen ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.kart_submit_ghost(
  p_strecke text,
  p_zeit_ms integer,
  p_samples jsonb
) RETURNS boolean  -- true = neue persönliche Bestzeit gespeichert
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_me uuid; v_alt integer; v_n integer; v_dt integer;
  v_vereins_best integer; v_name text;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_strecke IS NULL OR p_strecke !~ '^[a-z0-9_]{3,32}$' THEN
    RAISE EXCEPTION 'invalid_track';
  END IF;
  IF p_zeit_ms IS NULL OR p_zeit_ms < 20000 OR p_zeit_ms > 600000 THEN
    RAISE EXCEPTION 'invalid_time';
  END IF;

  -- Plausibilität der Aufzeichnung: Version, Taktung, Länge passend zur
  -- Fahrzeit (±25 %), Gesamtgröße. Eine handgebaute „Weltrekord-Fahrt" mit
  -- drei Stützpunkten fällt hier durch.
  IF (p_samples->>'v')::int IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'invalid_samples'; END IF;
  v_dt := (p_samples->>'dt')::int;
  IF v_dt IS NULL OR v_dt < 50 OR v_dt > 250 THEN RAISE EXCEPTION 'invalid_samples'; END IF;
  v_n := jsonb_array_length(p_samples->'pts');
  IF v_n IS NULL OR v_n < 50
     OR abs(v_n - (p_zeit_ms::numeric / v_dt)) > (p_zeit_ms::numeric / v_dt) * 0.25 THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  IF pg_column_size(p_samples) > 40960 THEN RAISE EXCEPTION 'samples_too_large'; END IF;

  SELECT zeit_ms INTO v_alt FROM public.kart_ghosts
   WHERE member_id = v_me AND strecke = p_strecke;
  IF v_alt IS NOT NULL AND v_alt <= p_zeit_ms THEN
    RETURN false;  -- langsamere Fahrt: Geist bleibt, nichts zu tun
  END IF;

  -- Vereins-Bestzeit VOR dem Upsert festhalten — für den Feed-Post.
  SELECT min(zeit_ms) INTO v_vereins_best FROM public.kart_ghosts
   WHERE strecke = p_strecke;

  INSERT INTO public.kart_ghosts(member_id, strecke, zeit_ms, samples)
  VALUES (v_me, p_strecke, p_zeit_ms, p_samples)
  ON CONFLICT (member_id, strecke)
  DO UPDATE SET zeit_ms = EXCLUDED.zeit_ms, samples = EXCLUDED.samples, created_at = now();

  -- Vereinsrekord → sofortiger Feed-Post, dieselbe Philosophie wie 0144:
  -- nur der Rekord ist eine Rundmail wert, persönliche Bestzeiten nicht.
  IF v_vereins_best IS NULL OR p_zeit_ms < v_vereins_best THEN
    SELECT name INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        v_name || ' hält jetzt den Streckenrekord auf ' ||
        public.kart_strecken_name(p_strecke) || ': ' ||
        to_char(p_zeit_ms / 60000, 'FM0') || ':' ||
        to_char((p_zeit_ms % 60000) / 1000, 'FM00') || ',' ||
        to_char(p_zeit_ms % 1000, 'FM000') || ' 🛷',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🛷',
          'strecke', p_strecke, 'zeit_ms', p_zeit_ms, 'prev_best_ms', v_vereins_best));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.kart_strecken_name(p_strecke text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_strecke
    WHEN 'kelo_kurve'        THEN 'der Kelo-Kurve'
    WHEN 'blockhaus_passage' THEN 'der Blockhaus-Passage'
    ELSE p_strecke END;
$$;

-- ─── Bestenliste + Geister laden ────────────────────────────────────────────
-- Liefert die schnellsten Fahrten einer Strecke MIT Aufzeichnung — der Client
-- lädt die Top 5 als Gegner. p_mit_samples=false für die reine Bestenliste
-- (spart die 15-KB-Blobs, wenn nur Zeiten angezeigt werden).

CREATE OR REPLACE FUNCTION public.kart_top_ghosts(
  p_strecke text,
  p_limit integer DEFAULT 5,
  p_mit_samples boolean DEFAULT true
) RETURNS TABLE(
  member_id uuid, name text, zeit_ms integer, created_at timestamptz, samples jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT g.member_id,
         public.anzeigename(m.name, m.sauna_name),
         g.zeit_ms, g.created_at,
         CASE WHEN p_mit_samples THEN g.samples ELSE NULL END
    FROM public.kart_ghosts g
    JOIN public.members m ON m.id = g.member_id
   WHERE g.strecke = p_strecke
   ORDER BY g.zeit_ms ASC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 5), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.kart_top_ghosts(text, integer, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.kart_strecken_name(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kart_top_ghosts(text, integer, boolean) TO authenticated;
