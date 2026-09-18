-- 0158 — Öl-Raum-Tablet: Vorlagen des gewählten Aufgießers + Team-Aufguss bei Übernahme.
--
-- Vorgabe Christoph 18.09.2026: am Tablet dieselben Auswahlmöglichkeiten wie im
-- Planer — Name aussuchen und planen. Zwei Dinge fehlten der Datenbank dafür:
--
--  1. Vorlagen. infusion_templates ist per RLS nur für den eingeloggten Besitzer
--     lesbar (anon sieht nur die öffentlichen mit member_id IS NULL). Das Tablet
--     ist anonym und kennt den Aufgießer nur über die Namensauswahl — wie bei
--     den übrigen Kiosk-Funktionen (0130/0131) prüft die Funktion, dass die ID
--     zu einem freigeschalteten Aufgießer gehört. Vorlagen enthalten nichts
--     Vertrauliches (Titel, Dauer, Zutaten), geschrieben wird hier nichts.
--
--  2. takeover_personal_fallback_kiosk setzte team_infusion fest auf false. Der
--     Planer kann beim Übernehmen eines Personal-Slots einen Team-Aufguss
--     daraus machen — das Tablet jetzt auch. Fassung aus 0131 als Vorlage,
--     geändert ist nur der neue Parameter. DROP statt Überladung: zwei
--     Signaturen mit Default-Parametern kann PostgREST nicht auseinanderhalten;
--     alte Tablet-Bundles rufen ohne p_team_infusion und bekommen den Default.

CREATE OR REPLACE FUNCTION public.templates_kiosk(p_member_id uuid)
RETURNS SETOF public.infusion_templates
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_member_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.members
     WHERE id = p_member_id
       AND revoked_at IS NULL
       AND ((role = 'member' AND is_aufgieser = true) OR role = 'guest_aufgieser' OR role = 'admin')
  ) THEN
    RETURN;   -- unbekannte ID: leere Liste statt Fehler
  END IF;

  RETURN QUERY
    SELECT t.* FROM public.infusion_templates t
     WHERE t.member_id = p_member_id OR t.member_id IS NULL
     ORDER BY t.title;
END;
$$;

REVOKE ALL ON FUNCTION public.templates_kiosk(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.templates_kiosk(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[]);

CREATE OR REPLACE FUNCTION public.takeover_personal_fallback_kiosk(
  p_infusion_id uuid,
  p_saunameister_id uuid,
  p_title text,
  p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL::text[],
  p_team_infusion boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.members%rowtype;
  v_inf public.infusions%rowtype;
begin
  if p_saunameister_id is null then
    raise exception 'Bitte zuerst auswählen, wer du bist.';
  end if;

  select * into m
  from public.members
  where id = p_saunameister_id
    and revoked_at is null
    and (
      (role = 'member' and is_aufgieser = true)
      or role = 'guest_aufgieser'
      or role = 'admin'
    );

  if not found then raise exception 'Du musst ein freigeschalteter Aufgießer sein.'; end if;

  if p_title is null or length(btrim(p_title)) < 1 then raise exception 'Titel fehlt.'; end if;
  if p_oils is not null and cardinality(p_oils) > 3 then
    raise exception 'Höchstens drei Öle pro Aufguss.';
  end if;

  select * into v_inf from public.infusions where id = p_infusion_id;
  if not found then raise exception 'Aufguss nicht gefunden.'; end if;
  if not v_inf.is_personal_fallback then
    raise exception 'Dieser Slot ist kein Personal-Slot mehr — bitte Anzeige aktualisieren.';
  end if;
  if v_inf.end_time <= now() then raise exception 'Slot liegt in der Vergangenheit.'; end if;

  -- Derselbe UPDATE wie takeover_personal_fallback (0034): der Fallback WIRD
  -- der Aufguss — kein DELETE+INSERT, sonst kaeme der Overlap-Trigger dazwischen.
  update public.infusions
     set saunameister_id      = m.id,
         is_personal_fallback = false,
         title                = btrim(p_title),
         attributes           = coalesce(p_attributes, array[]::text[]),
         oils                 = p_oils,
         team_infusion        = coalesce(p_team_infusion, false)
   where id = p_infusion_id;

  -- Auto-Check-in wie in 0130.
  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;
end;
$function$;

REVOKE ALL ON FUNCTION public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[], boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[], boolean) TO anon, authenticated;
