-- 0141 — Beim Team-Aufguss zählt jeder als gewedelt.
--
-- Bisher hing jede Zählung an `infusions.saunameister_id` — also an genau
-- einer Person pro Aufguss. Wenn drei zusammen wedeln, ist das in Summe ein
-- Aufguss, aber drei Leute haben gearbeitet. In den Auswertungen tauchten
-- zwei davon nicht auf.
--
-- Die Mitwedler stehen längst in `infusion_co_aufgieser` (56 Einträge über
-- 39 Aufgüsse). Drei Funktionen nutzten sie auch schon (`get_member_stats`,
-- `get_star_stats`, `get_member_calendar_events`) — aber als getrennte
-- Kennzahl neben der Gesamtzahl, nicht als Teil davon.
--
-- Statt das in zehn Funktionen einzeln nachzurüsten, gibt es ab jetzt EINE
-- Wahrheit: die View `aufguss_beteiligung`. Wer künftig „wie viele Aufgüsse
-- hat diese Person" auswertet, joint darauf und nicht mehr auf
-- `saunameister_id`.
--
-- Was NICHT umgestellt wird: die Zuordnung von BEWERTUNGEN. Ein Ø-Rating
-- gehört weiterhin dem Hauptaufgießer. „Zählt als gewedelt" war der Auftrag
-- — Bewertungen unter allen Beteiligten aufzuteilen wäre eine andere
-- Entscheidung mit anderen Folgen (rückwirkend veränderte Schnitte).

-- ─── 1) Die gemeinsame Grundlage ─────────────────────────────────────────
-- Eine Zeile je (Aufguss, Person). `ist_haupt` unterscheidet den
-- Verantwortlichen von den Mitwedlern.
--
-- Die Gruppierung ist kein Zierrat: steht jemand versehentlich sowohl als
-- Saunameister als auch als Co-Aufgießer am selben Aufguss, zählt er hier
-- trotzdem nur einmal. Ohne das würden solche Datensätze die Bestenliste
-- verfälschen.
CREATE OR REPLACE VIEW public.aufguss_beteiligung AS
SELECT infusion_id, member_id, bool_or(ist_haupt) AS ist_haupt
  FROM (
    SELECT i.id AS infusion_id, i.saunameister_id AS member_id, true AS ist_haupt
      FROM public.infusions i
     WHERE i.saunameister_id IS NOT NULL
    UNION ALL
    SELECT c.infusion_id, c.member_id, false
      FROM public.infusion_co_aufgieser c
  ) x
 GROUP BY infusion_id, member_id;

-- Die View ist Innenleben der SECURITY-DEFINER-Funktionen (Owner postgres),
-- niemand sonst braucht sie direkt.
REVOKE ALL ON public.aufguss_beteiligung FROM PUBLIC, anon, authenticated;

-- ─── 2) Wochenrückblick (0140) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wochenrueckblick_daten(
  p_von timestamptz,
  p_bis timestamptz
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH echte AS (
    SELECT *
      FROM public.infusions
     WHERE start_time >= p_von
       AND start_time <  p_bis
       AND is_personal_fallback = false
  ),
  -- Jeder Beteiligte zählt einzeln — drei Wedelnde an einem Aufguss ergeben
  -- drei Einträge in der Rangliste, aber weiterhin nur einen Aufguss oben.
  aufgiesser AS (
    SELECT public.anzeigename(m.name, m.sauna_name) AS name, count(*) AS anzahl
      FROM echte e
      JOIN public.aufguss_beteiligung b ON b.infusion_id = e.id
      JOIN public.members m ON m.id = b.member_id
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  ),
  oele AS (
    SELECT o AS id, count(*) AS anzahl
      FROM echte e, unnest(coalesce(e.oils, '{}')) AS o
     WHERE o IS NOT NULL AND btrim(o) <> ''
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  ),
  besonderheiten AS (
    SELECT a AS id, count(*) AS anzahl
      FROM echte e, unnest(coalesce(e.attributes, '{}')) AS a
     WHERE a IS NOT NULL AND btrim(a) <> ''
     GROUP BY 1
     ORDER BY count(*) DESC, 1
     LIMIT 12
  )
  SELECT jsonb_build_object(
    'von',        to_char(p_von AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'),
    'bis',        to_char((p_bis - interval '1 second') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'),
    'aufguesse',  (SELECT count(*) FROM echte),
    'team',       (SELECT count(*) FROM echte WHERE team_infusion),
    'saunen',     (SELECT count(DISTINCT sauna_id) FROM echte),
    'aufgiesser', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, name) FROM aufgiesser), '[]'::jsonb),
    'oele',       coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM oele), '[]'::jsonb),
    'attribute',  coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'anzahl', anzahl)
                                    ORDER BY anzahl DESC, id) FROM besonderheiten), '[]'::jsonb)
  );
$$;

-- ─── 3) „Aufgießer kennenlernen" ─────────────────────────────────────────
-- `gehaltene_aufguesse` steuert die 10er-Schwelle, ab der jemand im Verein
-- vorgestellt wird. Team-Teilnahmen zählen dafür mit (Vorgabe 16.08.2026).
-- `avg_rating` bleibt bewusst an den eigenen Aufgüssen hängen.
CREATE OR REPLACE FUNCTION public.list_aufgieser_stars()
RETURNS TABLE(id uuid, name text, avatar_path text, motto text, bio text,
              aufgieser_story text, signature_aufguss text, specialties text[],
              style_quote text, star_accent_color text, role text,
              is_aufgieser boolean, home_group text, total_aufguss bigint,
              gehaltene_aufguesse bigint, fan_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  select m.id,
         public.anzeigename(m.name, m.sauna_name) as name,
         m.avatar_path, m.motto, m.bio, m.aufgieser_story, m.signature_aufguss,
         m.specialties, m.style_quote, m.star_accent_color, m.role, m.is_aufgieser, m.home_group,
         (select count(*) from public.aufguss_beteiligung b
            join public.infusions i on i.id = b.infusion_id
           where b.member_id = m.id
             and coalesce(i.is_personal_fallback, false) = false) as total_aufguss,
         (select count(*) from public.aufguss_beteiligung b
            join public.infusions i on i.id = b.infusion_id
           where b.member_id = m.id
             and coalesce(i.is_personal_fallback, false) = false
             and i.end_time < now()) as gehaltene_aufguesse,
         (select count(*) from public.member_follows where followee_id = m.id) as fan_count,
         (select round(avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung) / 6.0)::numeric, 2)
            from public.infusion_ratings r
            join public.infusions i on i.id = r.infusion_id
           where i.saunameister_id = m.id) as avg_rating
    from public.members m
   where m.approved = true
     and m.revoked_at is null
     and m.star_card_visible = true
     and (m.is_aufgieser = true or m.role in ('guest_aufgieser', 'admin'))
     and exists (select 1 from public.members me where me.auth_user_id = auth.uid())
   order by fan_count desc, total_aufguss desc, name asc;
$$;

-- ─── 4) Bestenliste im Admin-Tab „Auswertungen" ──────────────────────────
-- Aus den JOINs werden Subqueries: `infusion_count` und die Rating-Zahlen
-- haben ab jetzt unterschiedliche Bezugsmengen und würden sich in einer
-- gemeinsamen Gruppierung gegenseitig vervielfachen.
CREATE OR REPLACE FUNCTION public.stats_aufgieser_leaderboard()
RETURNS TABLE(member_id uuid, name text, avatar_path text, infusion_count bigint,
              avg_rating numeric, rating_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  select * from (
    select m.id as member_id, m.name, m.avatar_path,
           (select count(*) from public.aufguss_beteiligung b
              join public.infusions i on i.id = b.infusion_id
             where b.member_id = m.id
               and i.start_time < now()
               and not i.is_personal_fallback) as infusion_count,
           coalesce((select avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung)::numeric / 6.0)
                       from public.infusion_ratings r
                       join public.infusions i on i.id = r.infusion_id
                      where i.saunameister_id = m.id
                        and not i.is_personal_fallback), 0) as avg_rating,
           (select count(*) from public.infusion_ratings r
              join public.infusions i on i.id = r.infusion_id
             where i.saunameister_id = m.id
               and not i.is_personal_fallback) as rating_count
      from public.members m
     where (m.is_aufgieser or m.role = 'guest_aufgieser')
       and m.revoked_at is null
  ) x
   where x.infusion_count > 0
   order by x.avg_rating desc, x.infusion_count desc;
$$;

-- ─── 5) Monats-Bestenliste ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard()
RETURNS TABLE(member_id uuid, name text, sauna_name text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT b.member_id,
         m.name,
         m.sauna_name,
         COUNT(*) AS count
    FROM public.aufguss_beteiligung b
    JOIN public.infusions i ON i.id = b.infusion_id
    JOIN public.members   m ON m.id = b.member_id
   WHERE i.end_time >= date_trunc('month', NOW())
     AND i.end_time <  NOW()
   GROUP BY b.member_id, m.name, m.sauna_name
   ORDER BY count DESC
   LIMIT 5;
$$;

-- ─── 6) Profil-Kennzahlen ────────────────────────────────────────────────
-- `total_infusions` enthält ab jetzt die Team-Teilnahmen. `team_infusions`
-- bleibt daneben stehen und sagt, wie viele davon im Team waren.
-- Auch Tagesrekord, bespielte Saunen und die Früh-/Spät-Abzeichen zählen
-- Mitwedeln mit — wer um 11 Uhr im Team gewedelt hat, war früh auf.
CREATE OR REPLACE FUNCTION public.get_member_stats(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_total        int;
  v_team         int;
  v_monthly      int;
  v_saunas_used  int;
  v_total_saunas int;
  v_daily_max    int;
  v_has_early    bool;
  v_has_late     bool;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.aufguss_beteiligung b
  JOIN public.infusions i ON i.id = b.infusion_id
  WHERE b.member_id = p_member_id AND i.end_time < NOW();

  SELECT COUNT(DISTINCT infusion_id) INTO v_team
  FROM public.infusion_co_aufgieser
  WHERE member_id = p_member_id;

  SELECT COUNT(*) INTO v_monthly
  FROM public.aufguss_beteiligung b
  JOIN public.infusions i ON i.id = b.infusion_id
  WHERE b.member_id = p_member_id
    AND i.end_time >= date_trunc('month', NOW())
    AND i.end_time < NOW();

  SELECT COUNT(DISTINCT i.sauna_id) INTO v_saunas_used
  FROM public.aufguss_beteiligung b
  JOIN public.infusions i ON i.id = b.infusion_id
  WHERE b.member_id = p_member_id AND i.end_time < NOW();

  SELECT COUNT(*) INTO v_total_saunas
  FROM public.saunas WHERE is_active = true;

  SELECT COALESCE(MAX(daily_count), 0) INTO v_daily_max FROM (
    SELECT COUNT(*) AS daily_count
    FROM public.aufguss_beteiligung b
    JOIN public.infusions i ON i.id = b.infusion_id
    WHERE b.member_id = p_member_id AND i.end_time < NOW()
    GROUP BY DATE(i.start_time AT TIME ZONE 'Europe/Berlin')
  ) t;

  SELECT EXISTS(
    SELECT 1 FROM public.aufguss_beteiligung b
    JOIN public.infusions i ON i.id = b.infusion_id
    WHERE b.member_id = p_member_id AND i.end_time < NOW()
      AND EXTRACT(HOUR FROM i.start_time AT TIME ZONE 'Europe/Berlin') = 11
  ) INTO v_has_early;

  SELECT EXISTS(
    SELECT 1 FROM public.aufguss_beteiligung b
    JOIN public.infusions i ON i.id = b.infusion_id
    WHERE b.member_id = p_member_id AND i.end_time < NOW()
      AND EXTRACT(HOUR FROM i.start_time AT TIME ZONE 'Europe/Berlin') = 20
  ) INTO v_has_late;

  RETURN json_build_object(
    'total_infusions',    v_total,
    'team_infusions',     v_team,
    'monthly_infusions',  v_monthly,
    'saunas_used',        v_saunas_used,
    'total_saunas',       v_total_saunas,
    'max_per_day',        v_daily_max,
    'has_early_bird',     v_has_early,
    'has_night_owl',      v_has_late
  );
END;
$$;
