-- 0157 — Eigene Öle erben das Bild eines gleichnamigen Öls.
--
-- Eigene Öle (member_custom_oils) bekamen ihr Tafel-Motiv bisher nur von Hand.
-- Legte ein zweites Mitglied dasselbe Öl an, stand es ohne Bild da — so
-- geschehen bei „blaue Kamille" (13.09.2026), obwohl drei andere Mitglieder
-- „Blaue Kamille" längst mit Bild hatten. Vorgabe Christoph 18.09.2026: das
-- vorhandene Bild nutzen.
--
-- Ab jetzt automatisch: fehlt beim Anlegen (oder Umbenennen) das Bild, nimmt
-- der Trigger das Bild des ältesten gleichnamigen Öls. „Gleichnamig" ist
-- großzügig: Groß/klein, Leerzeichen, Bindestriche und ß/ss spielen keine
-- Rolle („Ylang-Ylang" = „ylang ylang", „Weißtanne" = „Weisstanne").
-- Ein gesetztes Bild wird nie überschrieben.

CREATE OR REPLACE FUNCTION public.oel_name_norm(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT regexp_replace(lower(replace(coalesce(p_name, ''), 'ß', 'ss')), '[^a-z0-9äöü]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.custom_oil_bild_erben()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_bild text;
BEGIN
  IF (NEW.image_path IS NULL OR NEW.image_path = '') AND public.oel_name_norm(NEW.name) <> '' THEN
    SELECT c.image_path INTO v_bild
      FROM public.member_custom_oils c
     WHERE c.id IS DISTINCT FROM NEW.id
       AND c.image_path IS NOT NULL AND c.image_path <> ''
       AND public.oel_name_norm(c.name) = public.oel_name_norm(NEW.name)
     ORDER BY c.created_at
     LIMIT 1;
    IF v_bild IS NOT NULL THEN NEW.image_path := v_bild; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_oil_bild_erben ON public.member_custom_oils;
CREATE TRIGGER trg_custom_oil_bild_erben
  BEFORE INSERT OR UPDATE OF name, image_path ON public.member_custom_oils
  FOR EACH ROW EXECUTE FUNCTION public.custom_oil_bild_erben();

-- Trigger-Funktionen ruft niemand direkt auf; der Namens-Helfer ist harmlos,
-- braucht aber auch keinen anonymen Zugriff (Supabase vergibt ihn sonst automatisch).
REVOKE ALL ON FUNCTION public.custom_oil_bild_erben() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.oel_name_norm(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.oel_name_norm(text) TO authenticated;
