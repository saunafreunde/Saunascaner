-- 0130_oelraum_auto_anwesenheit.sql — angewendet 14.08.2026 auf tbjptybrtsmqyqmbiley.
--
-- Das Öl-Raum-Tablet dreht eine Regel um: Anwesenheit ist ab jetzt die FOLGE
-- des Eintragens, nicht mehr seine Bedingung.
--
-- Bisher brach create_infusion_kiosk mit „Bitte zuerst am Eingang einchecken"
-- ab, sobald is_present false war. Gedacht war das als Echtheitsprüfung, in
-- der Praxis war es eine Sackgasse: gerade die Mitglieder ohne Smartphone —
-- für die das Tablet überhaupt existiert — gehen direkt in den Öl-Raum und
-- kommen am Eingangs-Terminal nicht vorbei. Sie standen dann vor einem Gerät,
-- das ihnen sagte, sie seien nicht da.
--
-- Ab jetzt checkt das Eintragen den Aufgießer ein. Das ist zugleich die
-- Grundlage der Auswertung: wer aufgießt, war da.
--
-- ZWEI FOLGEN, die man kennen muss:
--
--   1. Die Namensliste am Tablet zeigt jetzt ALLE Aufgießer, nicht mehr nur
--      die eingecheckten (Frontend nutzt list_meister_names statt
--      list_present_aufgieser). Wer einen fremden Namen antippt und absendet,
--      checkt damit jemand anderen ein — mit attendance_events, Badges und
--      Bewertungsrecht als Folge. Bewusst in Kauf genommen: der Zugang zum
--      Öl-Raum ist die Vereinstür, und die Anzeige macht jeden Check-in
--      sofort sichtbar (grüner Punkt neben dem Namen). Ein PIN kommt hier
--      nicht in Frage — der Öl-Raum lief einmal mit PIN 1234, die mit einem
--      echten Mitglieds-PIN kollidierte.
--
--   2. last_scan_at MUSS mitgesetzt werden. log_infusion_attendance_on_scan
--      vergleicht coalesce(new.last_scan_at, now()) gegen start_time/end_time
--      OHNE Datumsgrenze — ein stehengebliebener alter Wert schriebe
--      infusion_attendances für längst vergangene Aufgüsse.
--
-- Signatur von create_infusion_kiosk bleibt UNVERÄNDERT (10 Argumente): ein
-- zusätzlicher Parameter würde bei CREATE OR REPLACE eine ZWEITE Überladung
-- anlegen statt die alte zu ersetzen → PostgREST PGRST203.
--
-- Randnotiz zur Filter-Divergenz: list_meister_names verlangt approved = true
-- und akzeptiert is_aufgieser unabhängig von der Rolle, diese Funktion
-- verlangt role = 'member' AND is_aufgieser (oder guest_aufgieser/admin) und
-- prüft approved nicht. Am 14.08.2026 liefern beide dieselben 34 Personen.
-- Bekäme jemals ein `fan` das is_aufgieser-Flag, stünde er in der Liste und
-- würde hier abgelehnt. Bewusst nicht angeglichen: eine Berechtigungsprüfung
-- weitet man nicht nebenbei.

-- ─── create_infusion_kiosk: Anwesenheit setzen statt verlangen ───────────────

create or replace function public.create_infusion_kiosk(
  p_saunameister_id uuid,
  p_sauna_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_title text,
  p_description text default null,
  p_attributes text[] default array[]::text[],
  p_oils text[] default null,
  p_template_id uuid default null,
  p_team_infusion boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  -- (belegter Slot, Zweit-Sauna-Sperre, Trigger-Veto) darf keine Anwesenheit
  -- hinterlassen. Beides liegt in derselben Transaktion, ein Rollback nimmt
  -- also ohnehin beides mit — die Reihenfolge ist trotzdem die ehrlichere.
  --
  -- `and is_present = false` ist Pflicht: ein blindes UPDATE nähme bei jedem
  -- Eintrag eine Zeilensperre auf members und schickte ein Realtime-Ereignis
  -- an Tafel und Anwesenheits-Panel, ohne dass sich etwas geändert hätte.
  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;

  return v_new_id;
end;
$function$;

-- ─── update_infusion_kiosk: Zutaten nachtragen ──────────────────────────────
--
-- Der Grund für diese Funktion ist die Forderungs-Anzeige des Tablets: sie
-- mahnt fehlende Zutaten an, und eine Forderung, die man an Ort und Stelle
-- nicht erfüllen kann, ist bloß ein Vorwurf. Anlegen hilft dort nicht — der
-- Aufguss existiert bereits, sein Slot ist belegt.
--
-- Bewusst eng: Titel, Besonderheiten, Öle. Zeit, Sauna, Dauer und Team-Status
-- bleiben unangetastet — die gehören in den Planer, wo der Kontext dafür da
-- ist (Garantie-Slots, Zweit-Sauna-Sperre, Banja-Dauer).
--
-- KEINE 60-Minuten-Sperre wie beim Absagen: die Sperre dort schützt die Tafel
-- davor, dass ein angekündigter Aufguss kurzfristig verschwindet. Hier passiert
-- das Gegenteil — eine Viertelstunde vor Start noch die Öle einzutragen ist
-- genau das erwünschte Verhalten.

create or replace function public.update_infusion_kiosk(
  p_id uuid,
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
  v_meister uuid;
  v_ende timestamptz;
  v_fallback boolean;
begin
  if p_saunameister_id is null then
    raise exception 'Bitte zuerst auswählen, wer du bist.';
  end if;

  -- Identische Mitglieds-Validierung wie in create_infusion_kiosk.
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

  select saunameister_id, end_time, is_personal_fallback
    into v_meister, v_ende, v_fallback
    from public.infusions where id = p_id;

  if v_ende is null then raise exception 'Aufguss nicht gefunden.'; end if;
  if v_fallback then
    raise exception 'Das ist ein Personal-Slot — bitte im Planer übernehmen statt hier zu ergänzen.';
  end if;
  if v_meister is distinct from p_saunameister_id then
    raise exception 'Du kannst nur deine eigenen Aufgüsse ändern.';
  end if;

  -- Nachtragen ist bis zwei Stunden nach dem Ende erlaubt: wer direkt nach dem
  -- Aufguss notiert, was er tatsächlich verwendet hat, liefert die besten
  -- Verbrauchsdaten. Danach ist Schluss — Auswertungen sollen nicht Wochen
  -- später noch umgeschrieben werden.
  if now() > v_ende + interval '2 hours' then
    raise exception 'Dieser Aufguss ist zu lange vorbei — Nachtragen geht bis zwei Stunden nach dem Ende.';
  end if;

  update public.infusions
     set title = btrim(p_title),
         attributes = coalesce(p_attributes, array[]::text[]),
         oils = p_oils
   where id = p_id;

  -- Auch das Nachtragen checkt ein: wer im Öl-Raum steht und seinen Aufguss
  -- vervollständigt, ist da (siehe Kopf dieser Datei zu last_scan_at).
  update public.members
     set is_present = true,
         last_scan_at = now()
   where id = m.id
     and is_present = false;
end;
$function$;

-- ─── Rechte ─────────────────────────────────────────────────────────────────
-- Das Tablet läuft bewusst anonym, anon BRAUCHT hier also EXECUTE. Trotzdem
-- erst revoke auf public: sonst hinge das Recht zusätzlich an PUBLIC und ließe
-- sich später nicht gezielt wieder entziehen. (Supabase vergibt anon bei jeder
-- neuen public-Funktion ohnehin einen eigenen Grant — `revoke … from public`
-- entfernt den NICHT. Hier ist er erwünscht, deshalb steht er ausdrücklich da
-- statt sich zufällig zu ergeben.)

revoke all on function public.create_infusion_kiosk(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean) from public;
grant execute on function public.create_infusion_kiosk(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean) to anon, authenticated;

revoke all on function public.update_infusion_kiosk(uuid, uuid, text, text[], text[]) from public;
grant execute on function public.update_infusion_kiosk(uuid, uuid, text, text[], text[]) to anon, authenticated;
