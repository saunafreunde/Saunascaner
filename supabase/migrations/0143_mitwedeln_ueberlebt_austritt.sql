-- 0143 — Gehaltene Aufgüsse bleiben gezählt, auch wenn jemand geht.
--
-- Befund vom 16.08.2026: beim Löschen eines Mitglieds verhielten sich die
-- Aufguss-Daten unterschiedlich.
--
--   infusions.saunameister_id        → SET NULL  (Aufguss bleibt, wird herrenlos)
--   infusion_co_aufgieser.member_id  → CASCADE   (Team-Teilnahme verschwindet)
--
-- Der zweite Fall ist der schlimmere: Ein Team-Aufguss, an dem drei Leute
-- gewedelt haben, schrumpft rückwirkend auf zwei, sobald einer austritt.
-- Die geleistete Arbeit verschwindet aus der Vereinsgeschichte, und die
-- Wochenrückblicke vergangener Wochen ändern sich nachträglich.
--
-- Ab jetzt bleibt der Eintrag stehen und trägt nur keine Person mehr —
-- genau wie beim Hauptaufgießer. Damit stimmen die Summen weiterhin; wer
-- es war, ist dann eben nicht mehr hinterlegt.
--
-- Für ein DSGVO-Löschersuchen ändert das nichts: die Person selbst ist
-- vollständig weg, es bleibt eine anonyme Zeile „hier hat noch jemand
-- mitgewedelt" ohne Bezug zu ihr.

ALTER TABLE public.infusion_co_aufgieser
  ALTER COLUMN member_id DROP NOT NULL;

DO $$
DECLARE v_con text;
BEGIN
  SELECT tc.constraint_name INTO v_con
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema = 'public'
     AND tc.table_name  = 'infusion_co_aufgieser'
     AND kcu.column_name = 'member_id';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.infusion_co_aufgieser DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.infusion_co_aufgieser
  ADD CONSTRAINT infusion_co_aufgieser_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;

-- Die Beteiligungs-View (0141) darf keine leeren Personen ausliefern —
-- sie beantwortet die Frage „wer hat gewedelt", und dafür braucht es einen
-- Namen. Die Zeile bleibt in der Tabelle und zählt in den Summen mit, aber
-- sie taucht nicht als Person in einer Rangliste auf.
CREATE OR REPLACE VIEW public.aufguss_beteiligung AS
SELECT infusion_id, member_id, bool_or(ist_haupt) AS ist_haupt
  FROM (
    SELECT i.id AS infusion_id, i.saunameister_id AS member_id, true AS ist_haupt
      FROM public.infusions i
     WHERE i.saunameister_id IS NOT NULL
    UNION ALL
    SELECT c.infusion_id, c.member_id, false
      FROM public.infusion_co_aufgieser c
     WHERE c.member_id IS NOT NULL
  ) x
 GROUP BY infusion_id, member_id;

REVOKE ALL ON public.aufguss_beteiligung FROM PUBLIC, anon, authenticated;
