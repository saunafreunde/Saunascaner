-- 0132 — Die Rolle 'fan' wird nicht mehr vergeben. Es gibt nur noch 'gast'.
--
-- Warum:
--   • In Produktion hatte die Rolle 'fan' NULL Personen (member 29, admin 7,
--     gast 2, staff 2). Die zugehörigen Premium-Tabellen sind ebenfalls leer:
--     0 org_news, 0 aroma_recipes. Der ganze Zweig war nie in Betrieb.
--   • Das Wort ist doppelt belegt: 'fan' hieß bisher „zahlender Förderer",
--     gemeint ist ab jetzt aber „Fan eines Aufgießers" (= member_follows).
--     Zwei Bedeutungen für ein Wort, für null Nutzen.
--
-- Der Enum-Wert 'fan' in members.role BLEIBT bestehen. Ihn zu entfernen
-- hieße in Postgres, den Typ neu zu bauen — bei 0 betroffenen Zeilen ein
-- reines Risiko ohne Gegenwert. Er wird nur nicht mehr vergeben; das
-- Frontend bietet ihn nirgends mehr an.
--
-- Fachliche Folge: was bisher „Fan-Ebene" war (Vereins-News, Aroma-Rezepte),
-- ist ab jetzt für JEDEN freigegebenen Zugang sichtbar — also auch für Gäste.

-- ── 1. Neuer Helper ───────────────────────────────────────────────────────
-- Löst is_fan_or_higher() ab. Der alte Name wäre nach dieser Migration
-- schlicht gelogen (er lieferte true für 'gast', obwohl 'fan' im Namen
-- steht) — genau die Sorte Stolperstein, die später eine Stunde kostet.
CREATE OR REPLACE FUNCTION public.is_approved_account()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce((
    SELECT m.approved AND m.revoked_at IS NULL
    FROM public.members m
    WHERE m.auth_user_id = auth.uid()
    LIMIT 1
  ), false);
$$;

COMMENT ON FUNCTION public.is_approved_account() IS
  'Jeder freigegebene, nicht widerrufene Zugang — jede Rolle inkl. gast. Nachfolger von is_fan_or_higher() (0132).';

-- REVOKE FROM public entfernt den anon-Grant NICHT — Supabase vergibt anon
-- einen eigenen. Deshalb ausdrücklich beide.
REVOKE EXECUTE ON FUNCTION public.is_approved_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.is_approved_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_approved_account() TO authenticated;

-- ── 2. Zielrollen der Vereins-News: 'fan' fällt weg ───────────────────────
-- Reihenfolge zwingend: erst CHECK droppen, dann Daten anfassen, dann neu
-- setzen. (org_news ist aktuell leer — das UPDATE ist die Absicherung für
-- den Fall, dass zwischen Prüfung und Migration doch etwas angelegt wurde.)
ALTER TABLE public.org_news DROP CONSTRAINT IF EXISTS org_news_target_min_role_check;
UPDATE public.org_news SET target_min_role = 'gast' WHERE target_min_role = 'fan';
ALTER TABLE public.org_news ALTER COLUMN target_min_role SET DEFAULT 'gast';
ALTER TABLE public.org_news ADD CONSTRAINT org_news_target_min_role_check
  CHECK (target_min_role IN ('gast', 'member'));

-- ── 3. Policies auf den neuen Helper umstellen ────────────────────────────
DROP POLICY IF EXISTS org_news_read_by_role ON public.org_news;
CREATE POLICY org_news_read_by_role ON public.org_news
  FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND (
      target_min_role = 'gast'
      OR (target_min_role = 'member' AND EXISTS (
        SELECT 1 FROM public.members mm
        WHERE mm.auth_user_id = auth.uid()
          AND mm.role IN ('member', 'guest_aufgieser', 'staff', 'admin')
      ))
    )
  );

DROP POLICY IF EXISTS aroma_recipes_read ON public.aroma_recipes;
CREATE POLICY aroma_recipes_read ON public.aroma_recipes
  FOR SELECT TO authenticated
  USING (
    (approved = true AND public.is_approved_account())
    OR created_by IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid())
    OR public.is_admin()
  );

-- ── 4. Die beiden Listen-RPCs mitziehen ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_active_news()
RETURNS TABLE(id uuid, title text, body text, pinned boolean,
              published_at timestamptz, expires_at timestamptz,
              cover_image_url text, target_min_role text, created_by_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT n.id, n.title, n.body, n.pinned, n.published_at, n.expires_at,
         n.cover_image_url, n.target_min_role,
         m.name AS created_by_name
  FROM public.org_news n
  LEFT JOIN public.members m ON m.id = n.created_by
  WHERE (n.expires_at IS NULL OR n.expires_at > now())
    AND (
      n.target_min_role = 'gast'
      OR (n.target_min_role = 'member' AND EXISTS (
        SELECT 1 FROM public.members mm
        WHERE mm.auth_user_id = auth.uid()
          AND mm.role IN ('member', 'guest_aufgieser', 'staff', 'admin')
      ))
    )
  ORDER BY n.pinned DESC, n.published_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.list_approved_aroma_recipes()
RETURNS TABLE(id uuid, title text, description text, ingredients jsonb,
              sauna_type text, temperature_c integer,
              created_by_name text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT r.id, r.title, r.description, r.ingredients, r.sauna_type, r.temperature_c,
         m.name AS created_by_name,
         r.created_at
  FROM public.aroma_recipes r
  LEFT JOIN public.members m ON m.id = r.created_by
  WHERE r.approved = true AND public.is_approved_account()
  ORDER BY r.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_active_news() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_approved_aroma_recipes() FROM anon;

-- ── 5. Alten Helper entsorgen ─────────────────────────────────────────────
-- Erst jetzt, nachdem alle vier Abhängigkeiten (2 Policies, 2 RPCs)
-- umgehängt sind.
DROP FUNCTION IF EXISTS public.is_fan_or_higher();
