-- 0166 — Saunafest-Video: eigenes Versuchs-Kontingent der Aufgießer + Nachlauf
--        gelöschter Fest-Aufgüsse. Ergänzt 0164/0165 (dort schon eingespielt).
--
-- 1) saunafest_video.versuche_aufgiesser
--    Bisher zählte `versuche` jeden Start — auch die des Admins („Fehlende Videos
--    erzeugen", „Video neu erzeugen", Speichern im Admin-Reiter). Dieselbe Zahl
--    prüfte aber die Grenze max_versuche, die laut 0165 nur für den Aufgießer
--    gilt („Admin unbegrenzt"): Nach drei Admin-Läufen war der Aufgießer gesperrt.
--    Jetzt: max_versuche prüft versuche_aufgiesser (nur Starts von Nicht-Admins),
--    `versuche` bleibt die Gesamtsumme für die Notbremse max_je_fest.
--
-- 2) saunafest_video_nachlauf
--    saunafest_austeilen (0163) löscht die Aufgusszeile; ON DELETE CASCADE nimmt
--    saunafest_video, saunafest_aufguss_info und saunafest_video_auftrag mit.
--    Dabei gingen (a) die bezahlten Versuche aus der Summe für max_je_fest verloren
--    und (b) Standbild und Video blieben verwaist und öffentlich lesbar unter
--    saunafest-videos/<datum>/. Ein BEFORE-DELETE-Trigger auf infusions merkt sich
--    darum Festdatum und Versuche (er läuft vor der Kaskade, saunafest_video ist
--    also noch lesbar). api/saunafest-video.ts zählt diese Versuche weiter mit und
--    räumt die Dateien beim Poll (alle 5 min) weg; die Zeile wird dann nur markiert.
--    Deckt jedes DELETE ab: saunafest_austeilen, cancel_my_infusion,
--    cancel_infusion_kiosk, Admin-Löschen.
--
-- Reihenfolge: VOR dem Deploy von api/saunafest-video.ts einspielen — der Server
-- liest und schreibt versuche_aufgiesser.

-- ── 1) Kontingent der Aufgießer ──────────────────────────────────────────
-- Kein Nachtragen nötig: bis zu diesem Stand endete jeder Start aus der App
-- mit 500, noch bevor ein Versuch gezählt wurde (doppelter Content-Type, im
-- selben Zug behoben) — bestehende Zeilen starten mit 0.
ALTER TABLE public.saunafest_video
  ADD COLUMN IF NOT EXISTS versuche_aufgiesser int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.saunafest_video.versuche IS
  'Alle Starts (auch Admin) — Summe je Festtag gegen system_config.saunafest_video.max_je_fest.';
COMMENT ON COLUMN public.saunafest_video.versuche_aufgiesser IS
  'Nur Starts von Nicht-Admins — gegen system_config.saunafest_video.max_versuche (0166).';

-- ── 2) Nachlauf gelöschter Fest-Aufgüsse ─────────────────────────────────
-- Bewusst OHNE Fremdschlüssel auf infusions: die Zeile soll das Löschen überleben.
CREATE TABLE IF NOT EXISTS public.saunafest_video_nachlauf (
  infusion_id     uuid PRIMARY KEY,
  fest_datum      date NOT NULL,             -- Berlin-Datum = Ordner saunafest-videos/<datum>/
  versuche        int NOT NULL DEFAULT 0,
  erfasst_at      timestamptz NOT NULL DEFAULT now(),
  aufgeraeumt_at  timestamptz                -- Dateien entfernt (Zeile bleibt für max_je_fest)
);
ALTER TABLE public.saunafest_video_nachlauf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saunafest_video_nachlauf FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS saunafest_video_nachlauf_offen
  ON public.saunafest_video_nachlauf (erfasst_at) WHERE aufgeraeumt_at IS NULL;
CREATE INDEX IF NOT EXISTS saunafest_video_nachlauf_datum
  ON public.saunafest_video_nachlauf (fest_datum);

-- SECURITY DEFINER: gelöscht wird auch als authenticated (RLS), die Tabelle ist
-- für diese Rolle gesperrt — ohne Definer-Rechte scheiterte sonst das DELETE.
CREATE OR REPLACE FUNCTION public.saunafest_video_nachlauf_merken()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.saunafest_video_nachlauf (infusion_id, fest_datum, versuche)
  SELECT OLD.id, (OLD.start_time AT TIME ZONE 'Europe/Berlin')::date, v.versuche
    FROM public.saunafest_video v
   WHERE v.infusion_id = OLD.id
  ON CONFLICT (infusion_id) DO NOTHING;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.saunafest_video_nachlauf_merken() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_saunafest_video_nachlauf ON public.infusions;
CREATE TRIGGER trg_saunafest_video_nachlauf
  BEFORE DELETE ON public.infusions
  FOR EACH ROW EXECUTE FUNCTION public.saunafest_video_nachlauf_merken();
