-- 0131_oelraum_fallback_uebernahme.sql — angewendet 14.08.2026 auf tbjptybrtsmqyqmbiley.
--
-- Befund aus dem Testlauf 14.08.2026 (DIAG-Matrix, alle Kombinationen morgen):
-- an einem frisch materialisierten Tag kann das Tablet KEINEN Aufguss anlegen.
-- Jede Stunde traegt einen Personal-Fallback in der Garantie-Sauna — dort sagt
-- der Overlap-Trigger „bereits belegt", und in der jeweils anderen Sauna
-- blockt check_secondary_sauna_allowed („erst den Personal-Slot uebernehmen").
-- Der vorgesehene Ausweg ist die UEBERNAHME des Fallbacks — und genau den Pfad
-- hatte der Kiosk nicht: takeover_personal_fallback (0034) identifiziert den
-- Aufgiesser ueber auth.uid(), das Tablet laeuft anonym.
--
-- Diese Funktion ist die Kiosk-Variante: gleiche Member-Validierung wie
-- create_infusion_kiosk (0070/0091/0130), gleicher UPDATE wie
-- takeover_personal_fallback, plus Auto-Check-in wie in 0130.
-- team_infusion bleibt am Kiosk bewusst false — Team-Plaetze verwaltet der
-- Planer mit seiner Quick-Liste, das Tablet soll das Formular klein halten.

create or replace function public.takeover_personal_fallback_kiosk(
  p_infusion_id uuid,
  p_saunameister_id uuid,
  p_title text,
  p_attributes text[] default array[]::text[],
  p_oils text[] default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  m public.members%rowtype;
  v_inf public.infusions%rowtype;
begin
  if p_saunameister_id is null then
    raise exception 'Bitte zuerst auswählen, wer du bist.';
  end if;

  -- Identische Member-Validierung wie in create_infusion_kiosk.
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
         team_infusion        = false
   where id = p_infusion_id;

  -- Auto-Check-in wie in 0130 — Begruendung und last_scan_at-Pflicht siehe dort.
  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;
end;
$function$;

revoke all on function public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[]) from public;
grant execute on function public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[]) to anon, authenticated;
