-- 0138 — Auf geteilten Bildschirmen nur noch der selbst gewählte Aufgießer-Name.
--
-- members hat zwei Namen: name (Klarname) und sauna_name (selbst gewählt).
-- Das Frontend hat dafür längst displayMemberName(), und list_meister_names
-- liefert beide Felder aus. Die Lücke sind RPCs, die einen FERTIGEN Namen
-- zurückgeben — dort kann das Frontend nichts mehr richten, weil der
-- Klarname schon drinsteht.
--
-- Diese Migration stellt genau die um. Bewusst NICHT umgestellt:
--   • list_present_full  → speist die Evakuierungs-Übersicht. Im Notfall
--     zählt der Klarname, nicht der Künstlername.
--   • Admin-Listen (list_pending_members, list_members_directory, …) → dort
--     verwaltet jemand Personen und muss wissen, wer gemeint ist.
CREATE OR REPLACE FUNCTION public.anzeigename(p_name text, p_sauna_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(btrim(coalesce(p_sauna_name, '')), ''), p_name);
$$;

COMMENT ON FUNCTION public.anzeigename(text, text) IS
  'Selbst gewählter Sauna-Name, sonst Klarname. Für alle Bildschirme, die mehrere Personen sehen (0138).';

GRANT EXECUTE ON FUNCTION public.anzeigename(text, text) TO anon, authenticated, service_role;

-- ── Aufgießer-Galerie und Star-Profile ────────────────────────────────────
-- Gibt ab jetzt NUR den Anzeigenamen aus — der Klarname verlässt die
-- Datenbank hier gar nicht mehr. Die Spalte heißt weiterhin `name`, damit
-- alle Aufrufer unverändert funktionieren.
DROP FUNCTION IF EXISTS public.list_aufgieser_stars();
CREATE FUNCTION public.list_aufgieser_stars()
RETURNS TABLE(id uuid, name text, avatar_path text, motto text, bio text,
              aufgieser_story text, signature_aufguss text, specialties text[],
              style_quote text, star_accent_color text, role text,
              is_aufgieser boolean, home_group text,
              total_aufguss bigint, gehaltene_aufguesse bigint,
              fan_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  select m.id,
         public.anzeigename(m.name, m.sauna_name) as name,
         m.avatar_path, m.motto, m.bio, m.aufgieser_story, m.signature_aufguss,
         m.specialties, m.style_quote, m.star_accent_color, m.role, m.is_aufgieser, m.home_group,
         (select count(*) from public.infusions
            where saunameister_id = m.id
              and coalesce(is_personal_fallback, false) = false) as total_aufguss,
         (select count(*) from public.infusions
            where saunameister_id = m.id
              and coalesce(is_personal_fallback, false) = false
              and end_time < now()) as gehaltene_aufguesse,
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

REVOKE EXECUTE ON FUNCTION public.list_aufgieser_stars() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_aufgieser_stars() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_aufgieser_stars() TO authenticated;

-- ── Fans auf dem Star-Profil ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_fans(p_member_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(follower_id uuid, name text, avatar_path text, followed_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT f.follower_id,
         public.anzeigename(m.name, m.sauna_name) AS name,
         m.avatar_path, f.created_at
  FROM public.member_follows f
  JOIN public.members m ON m.id = f.follower_id
  WHERE f.followee_id = p_member_id
    AND m.revoked_at IS NULL
  ORDER BY f.created_at DESC
  LIMIT greatest(1, least(100, p_limit));
$$;

REVOKE EXECUTE ON FUNCTION public.get_top_fans(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_top_fans(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_top_fans(uuid, integer) TO authenticated;

-- ── Kiosk-Bewerten am Tablet (0137) ───────────────────────────────────────
-- Das Tablet steht öffentlich — hier ist der Klarname am wenigsten am Platz.
CREATE OR REPLACE FUNCTION public.kiosk_ratable(p_pin text)
RETURNS TABLE(id uuid, title text, sauna_name text, sauna_farbe text,
              meister_name text, start_time timestamptz, end_time timestamptz,
              schon_bewertet boolean, stunde_belegt boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RAISE EXCEPTION 'pin_unbekannt'; END IF;

  RETURN QUERY
  SELECT i.id, i.title, s.name, s.accent_color,
         public.anzeigename(m.name, m.sauna_name),
         i.start_time, i.end_time,
         EXISTS (SELECT 1 FROM public.infusion_ratings r
                  WHERE r.infusion_id = i.id AND r.member_id = v_id),
         EXISTS (SELECT 1
                   FROM public.aufguss_stunden(i.id) st
                   JOIN public.bewertungs_stunden bs
                     ON bs.stunde = st AND bs.member_id = v_id
                   JOIN public.infusion_ratings rr ON rr.id = bs.rating_id
                  WHERE rr.infusion_id <> i.id)
  FROM public.infusions i
  JOIN public.members m ON m.id = i.saunameister_id
  LEFT JOIN public.saunas s ON s.id = i.sauna_id
  WHERE i.end_time < now()
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> v_id
    AND coalesce(i.is_personal_fallback, false) = false
    AND (i.start_time AT TIME ZONE 'Europe/Berlin')::date
        = (now() AT TIME ZONE 'Europe/Berlin')::date
  ORDER BY i.end_time DESC;
END; $$;

REVOKE ALL ON FUNCTION public.kiosk_ratable(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kiosk_ratable(text) FROM anon;
REVOKE ALL ON FUNCTION public.kiosk_ratable(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_ratable(text) TO service_role;

-- ── Duft-Wünsche (0133) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_my_wuensche()
RETURNS TABLE(id uuid, infusion_id uuid, oil_key text, notiz text, status text,
              created_at timestamptz, infusion_start timestamptz,
              infusion_title text, sauna_name text, aufgieser_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT w.id, w.infusion_id, w.oil_key, w.notiz, w.status, w.created_at,
         i.start_time, i.title, s.name,
         public.anzeigename(m.name, m.sauna_name)
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

REVOKE EXECUTE ON FUNCTION public.list_my_wuensche() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_my_wuensche() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_wuensche() TO authenticated;

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
         g.id, public.anzeigename(g.name, g.sauna_name)
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

REVOKE EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_wuensche_fuer_meine_aufguesse() TO authenticated;
