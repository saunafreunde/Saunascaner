-- 0159 — Öl-Raum-Tablet: Startzeit auf die volle Minute runden.
--
-- Fehlerbild (Christoph, 18.09.2026): am Tablet ließ sich in der Zweitsauna
-- nichts eintragen — „⛔ Zweit-Sauna gesperrt — erst den Personal-Slot in der
-- 100°C-Sauna … übernehmen", obwohl der 100°-Slot längst belegt war.
--
-- Ursache: das Tablet baute die Startzeit aus `new Date()` und setzte nur
-- Stunde und Minute — Sekunden und Millisekunden der aktuellen Uhrzeit blieben
-- stehen (18:00:37.123). check_secondary_sauna_allowed sucht den Garantie-Slot
-- aber mit `start_time = p_start_time`, also exakt — und fand ihn nie. Der
-- Fehler ist so alt wie das Tablet-Formular: in der Zweitsauna konnte man dort
-- noch nie NEU anlegen (Übernahmen schicken keine Zeit und gingen deshalb).
--
-- Das Frontend schickt ab jetzt glatte Zeiten; die Funktion rundet zusätzlich
-- selbst, damit auch ein Tablet mit altem Bundle sofort wieder funktioniert
-- und nie wieder schiefe Startzeiten im Bestand landen. Fassung aus 0130 als
-- Vorlage — geändert ist nur die eine Zeile mit date_trunc.

CREATE OR REPLACE FUNCTION public.create_infusion_kiosk(
  p_saunameister_id uuid,
  p_sauna_id uuid,
  p_start_time timestamp with time zone,
  p_duration_minutes integer,
  p_title text,
  p_description text DEFAULT NULL::text,
  p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL::text[],
  p_template_id uuid DEFAULT NULL::uuid,
  p_team_infusion boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.members%rowtype;
  v_new_id uuid;
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

  if p_sauna_id is null then raise exception 'Sauna fehlt.'; end if;
  if p_start_time is null then raise exception 'Startzeit fehlt.'; end if;
  if p_duration_minutes is null or p_duration_minutes < 1 then
    raise exception 'Dauer fehlt oder ungültig.';
  end if;
  if p_title is null or length(btrim(p_title)) < 1 then raise exception 'Titel fehlt.'; end if;
  if p_oils is not null and cardinality(p_oils) > 3 then
    raise exception 'Höchstens drei Öle pro Aufguss.';
  end if;

  -- Sekunden und Millisekunden weg: Slots sind minutengenau, und die
  -- Garantie-Prüfung vergleicht die Startzeit exakt (siehe Kopf).
  p_start_time := date_trunc('minute', p_start_time);

  perform public.check_secondary_sauna_allowed(p_sauna_id, p_start_time);

  insert into public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) values (
    p_sauna_id, p_start_time, p_duration_minutes, btrim(p_title), p_description,
    coalesce(p_attributes, array[]::text[]), p_oils, p_saunameister_id, p_template_id,
    coalesce(p_team_infusion, false), false
  )
  returning id into v_new_id;

  -- Erst NACH dem erfolgreichen Insert einchecken: ein abgelehnter Aufguss
  -- darf keine Anwesenheit hinterlassen. `and is_present = false` ist Pflicht,
  -- sonst Zeilensperre + Realtime-Ereignis bei jedem Eintrag ohne Aenderung.
  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;

  return v_new_id;
end;
$function$;
