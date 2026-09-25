-- 0190_kart_grand_prix.sql — Sauna-Kart Grand Prix (25.09.2026)
--
-- Das Kart-Spiel ist komplett neu: acht Fahrer (du + sieben Computerfahrer),
-- Items, Drift mit Mini-Turbo, vier Strecken, drei Klassen (60°/80°/100°).
-- Ein Grand Prix („Dampf-Cup") besteht aus vier Rennen; am Ende steht ein
-- Platz 1–8 und eine Punktzahl (4 Rennen × 1–15 Punkte).
--
-- Hier: die Pokal-Tabelle, drei RPCs (melden, Bestenliste, eigene Vitrine)
-- und die Namen der neuen Strecken für die Feed-Meldung beim Streckenrekord
-- im Zeitfahren (kart_submit_ghost bleibt unverändert; neue Strecken-IDs,
-- weil die Grand-Prix-Fassung drei Runden fährt statt zwei).

CREATE TABLE IF NOT EXISTS public.kart_gp_ergebnisse (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  klasse      smallint NOT NULL CHECK (klasse IN (60, 80, 100)),
  platz       smallint NOT NULL CHECK (platz BETWEEN 1 AND 8),
  punkte      smallint NOT NULL CHECK (punkte BETWEEN 4 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kart_gp_ergebnisse_member_idx ON public.kart_gp_ergebnisse (member_id, klasse);
CREATE INDEX IF NOT EXISTS kart_gp_ergebnisse_klasse_idx ON public.kart_gp_ergebnisse (klasse);
ALTER TABLE public.kart_gp_ergebnisse ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kart_gp_ergebnisse FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kart_gp_ergebnisse TO service_role;
COMMENT ON TABLE public.kart_gp_ergebnisse IS
  'Sauna-Kart Grand Prix: Endstand je gefahrenem Cup (0190). Zugriff nur über kart_gp_* RPCs.';

-- Ergebnis eines Grand Prix melden. Plausibilität: Platz 1–8, Punkte 4–60,
-- höchstens ein Cup alle drei Minuten (vier Rennen dauern länger).
CREATE OR REPLACE FUNCTION public.kart_gp_melden(p_klasse integer, p_platz integer, p_punkte integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid;
  v_letzt timestamptz;
  v_gold_vorher integer;
  v_name text;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_klasse IS NULL OR p_klasse NOT IN (60, 80, 100) THEN RAISE EXCEPTION 'invalid_class'; END IF;
  IF p_platz IS NULL OR p_platz < 1 OR p_platz > 8 THEN RAISE EXCEPTION 'invalid_place'; END IF;
  IF p_punkte IS NULL OR p_punkte < 4 OR p_punkte > 60 THEN RAISE EXCEPTION 'invalid_points'; END IF;
  -- Wer alle vier Rennen gewinnt, hat 60; wer Letzter wird, mindestens 4.
  IF p_platz = 1 AND p_punkte < 24 THEN RAISE EXCEPTION 'invalid_points'; END IF;

  SELECT max(created_at) INTO v_letzt FROM public.kart_gp_ergebnisse WHERE member_id = v_me;
  IF v_letzt IS NOT NULL AND v_letzt > now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'zu_schnell';
  END IF;

  SELECT count(*) INTO v_gold_vorher FROM public.kart_gp_ergebnisse
   WHERE member_id = v_me AND klasse = p_klasse AND platz = 1;

  INSERT INTO public.kart_gp_ergebnisse (member_id, klasse, platz, punkte)
  VALUES (v_me, p_klasse, p_platz, p_punkte);

  -- Der erste Goldpokal in der 100°-Klasse ist eine Feed-Meldung wert.
  IF p_platz = 1 AND v_gold_vorher = 0 AND p_klasse = 100 THEN
    SELECT public.anzeigename(name, sauna_name) INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts (author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        coalesce(v_name, 'Jemand') || ' holt den Goldpokal im 100°-Dampf-Cup von Sauna-Kart! 🏆',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🏆',
          'klasse', p_klasse, 'punkte', p_punkte));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'erster_gold', p_platz = 1 AND v_gold_vorher = 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.kart_gp_bestenliste(p_klasse integer)
RETURNS TABLE (member_id uuid, name text, gold integer, silber integer, bronze integer, beste_punkte integer, cups integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public._games_current_member_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
    SELECT e.member_id,
           public.anzeigename(m.name, m.sauna_name),
           count(*) FILTER (WHERE e.platz = 1)::integer,
           count(*) FILTER (WHERE e.platz = 2)::integer,
           count(*) FILTER (WHERE e.platz = 3)::integer,
           max(e.punkte)::integer,
           count(*)::integer
      FROM public.kart_gp_ergebnisse e
      JOIN public.members m ON m.id = e.member_id
     WHERE e.klasse = p_klasse AND m.revoked_at IS NULL
     GROUP BY e.member_id, m.name, m.sauna_name
     ORDER BY 3 DESC, 4 DESC, 5 DESC, 6 DESC
     LIMIT 20;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kart_meine_pokale()
RETURNS TABLE (klasse integer, gold integer, silber integer, bronze integer, beste_punkte integer, cups integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
    SELECT e.klasse::integer,
           count(*) FILTER (WHERE e.platz = 1)::integer,
           count(*) FILTER (WHERE e.platz = 2)::integer,
           count(*) FILTER (WHERE e.platz = 3)::integer,
           max(e.punkte)::integer,
           count(*)::integer
      FROM public.kart_gp_ergebnisse e
     WHERE e.member_id = v_me
     GROUP BY e.klasse
     ORDER BY 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_gp_melden(integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kart_gp_bestenliste(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kart_meine_pokale() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_gp_melden(integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kart_gp_bestenliste(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kart_meine_pokale() TO authenticated, service_role;

-- Streckennamen für die Rekord-Meldung im Feed (alte IDs bleiben gültig).
CREATE OR REPLACE FUNCTION public.kart_strecken_name(p_strecke text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_strecke
    WHEN 'kelo_kurve'        THEN 'der Kelo-Kurve'
    WHEN 'blockhaus_passage' THEN 'der Blockhaus-Passage'
    WHEN 'kelo'              THEN 'der Kelo-Kurve'
    WHEN 'blockhaus'         THEN 'der Blockhaus-Passage'
    WHEN 'eisbach'           THEN 'dem Eisbach-Kanal'
    WHEN 'glutofen'          THEN 'dem Glut-Ofen'
    ELSE p_strecke END;
$function$;
