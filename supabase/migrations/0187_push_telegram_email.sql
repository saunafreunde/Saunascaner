-- 0187_push_telegram_email.sql — Push, Telegram und E-Mail-Protokoll (Audit 25.09.2026, Gruppe F2)
--
-- 1) E-Mail-Protokoll: log_email_send und mark_invitation_sent verlangten
--    auth.uid() bzw. is_admin(). Die API ruft beide aber mit dem service_role-
--    Client auf (auth.uid() ist dort NULL) — beide warfen still eine Ausnahme.
--    Folge: email_log hatte 0 Zeilen, keine Einladung stand je als „gesendet“.
--    Jetzt: beide ohne Nutzer-Prüfung, dafür NUR noch für service_role
--    ausführbar (vorher durften anon/authenticated sie aufrufen und z. B.
--    Protokollzeilen fälschen). Die API prüft die Admin-Rolle selbst
--    (api/email.ts). mark_invitation_sent bekommt den Absender als Parameter
--    (p_sender_member_id, DEFAULT NULL — der alte 3-Argument-Aufruf geht weiter).
--    Weil email_log ab jetzt Empfängeradressen speichert: Zeilen eines
--    gelöschten Mitglieds verschwinden mit (ON DELETE CASCADE), und ein
--    täglicher Job löscht alles, was älter als 12 Monate ist.
--
-- 2) push_subscriptions: anon/authenticated hatten volle Tabellenrechte, mit
--    RLS-Regeln „eigene Zeilen“. So ließen sich beliebig viele Abos mit frei
--    gewählten Endpunkten (http://…, interne Adressen) direkt anlegen — jeder
--    Push hätte dann an diese Adressen gesendet. Das Frontend geht ohnehin nur
--    über /api/push-subscribe (service_role). Jetzt: keine Tabellenrechte mehr
--    für anon/authenticated und eine CHECK-Regel für das Format (https,
--    Schlüssel in Base64-Länge). Die Liste erlaubter Push-Dienste prüft die API.
--
-- 3) push_vorlagen_versand (neu): Nicht-Admins dürfen keine freien Rundrufe
--    mehr senden, nur noch Vorlagen (Team-Aufguss, Stamm-Slot-Antrag,
--    Urlaubsslots), deren Text der Server baut. Diese Tabelle merkt sich je
--    Vorlage und Bezug (z. B. team_aufguss:<infusion_id>), dass sie schon
--    verschickt wurde — jede Vorlage geht genau einmal raus.
--
-- 4) Telegram-Freigabe: /start trug bisher JEDEN Chat sofort in den Verteiler
--    ein (system_config.telegram_chats) — auch Unbekannte bekamen dann
--    Evakuierungslisten mit Namen, Geburtstage, Umfrageergebnisse. Jetzt landen
--    neue Chats in telegram_chat_anfragen und kommen erst nach Freigabe durch
--    einen Admin in den Verteiler (Admin → Handbuch → Telegram). Die Admins
--    bekommen dazu eine Benachrichtigung. Bestehende Chats bleiben unverändert.
--    Ausnahme: ein Admin, der seinen eigenen privaten Chat anmeldet.
--    Abgelehnte Chats bleiben vermerkt, damit ein erneutes /start die Admins
--    nicht wieder anpiept. /stop entfernt auch eine offene Anfrage.
--    Wer sein Konto entknüpft (App oder /unlink) oder gelöscht wird, fliegt
--    mit seinem privaten Chat aus dem Verteiler (Trigger auf members).
--
-- 5) pg_cron-Job saunafest-video-poll schickt jetzt wie die anderen Jobs das
--    Cron-Geheimnis (Header x-cron-secret aus dem Vault). /api/saunafest-video
--    ?action=poll verlangt es ab dem nächsten Deploy. REIHENFOLGE: erst diese
--    Migration, dann den Code deployen (die alte API ignoriert den Header).

-- ─── 1) E-Mail-Protokoll ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_email_send(
  p_recipient text, p_subject text, p_template_name text, p_status text,
  p_error text DEFAULT NULL::text, p_related_invitation_id uuid DEFAULT NULL::uuid,
  p_related_member_id uuid DEFAULT NULL::uuid, p_sender_email text DEFAULT NULL::text,
  p_sender_member_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_id uuid;
begin
  -- Nur der Server (service_role) ruft das auf — siehe Rechte unten. Kein
  -- auth.uid(): der Service-Client hat keinen Nutzer.
  insert into public.email_log
    (recipient, subject, template_name, status, error,
     related_invitation_id, related_member_id, sender_email, sender_member_id)
  values
    (left(p_recipient, 320), left(p_subject, 300), left(p_template_name, 80), p_status, left(p_error, 1000),
     p_related_invitation_id, p_related_member_id, left(p_sender_email, 320), p_sender_member_id)
  returning id into v_id;
  return v_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.log_email_send(text, text, text, text, text, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_email_send(text, text, text, text, text, uuid, uuid, text, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.mark_invitation_sent(uuid, text, text);
-- OR REPLACE: die Migration lässt sich so auch ein zweites Mal einspielen.
CREATE OR REPLACE FUNCTION public.mark_invitation_sent(
  p_invitation_id uuid, p_recipient_email text, p_via text, p_sender_member_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  -- Nur der Server (service_role); die Admin-Prüfung macht api/email.ts.
  if p_via not in ('admin_account','system_fallback') then raise exception 'invalid_via'; end if;
  update public.invitations
     set sent_to_email     = p_recipient_email,
         sent_at           = now(),
         sent_by_member_id = p_sender_member_id,
         sent_via          = p_via
   where id = p_invitation_id;
  if not found then raise exception 'invitation_not_found'; end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.mark_invitation_sent(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invitation_sent(uuid, text, text, uuid) TO service_role;

-- Lesen bleibt Admins vorbehalten (Policy email_log_read_admin); schreiben
-- darf nur noch die Funktion oben.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.email_log FROM PUBLIC, anon, authenticated;

ALTER TABLE public.email_log
  DROP CONSTRAINT IF EXISTS email_log_related_member_id_fkey,
  ADD CONSTRAINT email_log_related_member_id_fkey
    FOREIGN KEY (related_member_id) REFERENCES public.members(id) ON DELETE CASCADE;

-- ─── 2) push_subscriptions nur über die API ──────────────────────────────

REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_format;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_format CHECK (
        endpoint ~ '^https://[A-Za-z0-9.-]+(:443)?/'
    AND length(endpoint) <= 1024
    AND p256dh_key ~ '^[A-Za-z0-9_+/-]+={0,2}$' AND length(p256dh_key) BETWEEN 80 AND 100
    AND auth_key   ~ '^[A-Za-z0-9_+/-]+={0,2}$' AND length(auth_key)   BETWEEN 16 AND 32
  ) NOT VALID;
ALTER TABLE public.push_subscriptions VALIDATE CONSTRAINT push_subscriptions_format;

-- ─── 3) Vorlagen-Pushes genau einmal ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_vorlagen_versand (
  schluessel  text PRIMARY KEY,
  member_id   uuid REFERENCES public.members(id) ON DELETE SET NULL,
  gesendet_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.push_vorlagen_versand IS
  'Welche Push-Vorlage (api/push-send, vorlage=…) schon verschickt wurde; je Schlüssel genau einmal. Nur service_role.';
ALTER TABLE public.push_vorlagen_versand ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_vorlagen_versand FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_vorlagen_versand TO service_role;

-- ─── 4) Telegram: neue Chats erst nach Admin-Freigabe ────────────────────

CREATE TABLE IF NOT EXISTS public.telegram_chat_anfragen (
  chat_id          bigint PRIMARY KEY,
  telegram_user_id bigint,
  vorname          text,
  benutzername     text,
  chat_typ         text,
  angefragt_at     timestamptz NOT NULL DEFAULT now(),
  abgelehnt_at     timestamptz,
  abgelehnt_von    uuid REFERENCES public.members(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.telegram_chat_anfragen IS
  'Telegram-Chats, die per /start in den Vereins-Verteiler wollen; ein Admin gibt frei oder lehnt ab (0187). Nur über RPCs.';
ALTER TABLE public.telegram_chat_anfragen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_chat_anfragen FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.telegram_chat_anfragen TO service_role;

-- /stop: aus dem Verteiler UND eine offene Anfrage zurückziehen (eine
-- Ablehnung bleibt stehen, sonst könnte man sie per /stop + /start umgehen).
CREATE OR REPLACE FUNCTION public.unregister_telegram_chat(p_chat_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cur jsonb;
  filtered jsonb;
begin
  -- NULL-sicher: „x <> NULL“ ist nie wahr — ohne diese Zeile würde ein
  -- Aufruf mit NULL den GANZEN Verteiler leeren.
  if p_chat_id is null then return; end if;
  delete from public.telegram_chat_anfragen where chat_id = p_chat_id and abgelehnt_at is null;
  select value into cur from public.system_config where key = 'telegram_chats';
  if cur is null then return; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into filtered
    from jsonb_array_elements(coalesce(cur->'chat_ids', '[]'::jsonb)) x
   where x::text::bigint <> p_chat_id;
  update public.system_config
     set value = jsonb_set(value, '{chat_ids}', filtered)
   where key = 'telegram_chats';
end;
$function$;
REVOKE ALL ON FUNCTION public.unregister_telegram_chat(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_telegram_chat(bigint) TO service_role;

-- Aufruf nur vom Bot (api/telegram-webhook.ts, service_role) bei /start.
-- Ergebnis: 'aktiv' (schon im Verteiler bzw. Admin-Eigenchat), 'neu' (Anfrage
-- angelegt, Admins benachrichtigt), 'wartet' (Anfrage lief schon),
-- 'abgelehnt' (ein Admin hat abgelehnt), 'voll' (zu viele offene Anfragen).
CREATE OR REPLACE FUNCTION public.telegram_chat_anmelden(
  p_chat_id bigint, p_telegram_user_id bigint,
  p_vorname text DEFAULT NULL, p_benutzername text DEFAULT NULL, p_chat_typ text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ids      jsonb;
  v_anfrage  public.telegram_chat_anfragen;
  v_vorname  text := left(nullif(btrim(coalesce(p_vorname, '')), ''), 64);
  v_benutzer text := left(nullif(btrim(coalesce(p_benutzername, '')), ''), 64);
  v_typ      text := left(nullif(btrim(coalesce(p_chat_typ, '')), ''), 20);
  v_mitglied text;
begin
  if p_chat_id is null then raise exception 'chat_fehlt'; end if;

  select coalesce(s.value->'chat_ids', '[]'::jsonb) into v_ids
    from public.system_config s where s.key = 'telegram_chats';
  if coalesce(v_ids, '[]'::jsonb) @> to_jsonb(p_chat_id) then return 'aktiv'; end if;

  -- Ein Admin meldet seinen eigenen privaten Chat an: keine Selbst-Freigabe nötig.
  if v_typ = 'private' and p_telegram_user_id = p_chat_id and exists (
       select 1 from public.members m
        where m.telegram_user_id = p_telegram_user_id
          and m.role = 'admin' and m.approved and m.revoked_at is null) then
    perform public.register_telegram_chat(p_chat_id);
    delete from public.telegram_chat_anfragen where chat_id = p_chat_id;
    return 'aktiv';
  end if;

  select * into v_anfrage from public.telegram_chat_anfragen where chat_id = p_chat_id;
  if found then
    if v_anfrage.abgelehnt_at is not null then return 'abgelehnt'; end if;
    update public.telegram_chat_anfragen
       set telegram_user_id = coalesce(p_telegram_user_id, telegram_user_id),
           vorname          = coalesce(v_vorname, vorname),
           benutzername     = coalesce(v_benutzer, benutzername),
           chat_typ         = coalesce(v_typ, chat_typ)
     where chat_id = p_chat_id;
    return 'wartet';
  end if;

  -- Bremse gegen Massen-Anmeldungen: höchstens 50 offene Anfragen.
  -- (Vermerke freigegebener Chats zählen nicht mit.)
  if (select count(*) from public.telegram_chat_anfragen a
       where a.abgelehnt_at is null
         and not (coalesce(v_ids, '[]'::jsonb) @> to_jsonb(a.chat_id))) >= 50 then
    return 'voll';
  end if;

  -- Zwei gleichzeitige /start (Telegram stellt Updates parallel zu): der
  -- zweite findet die Zeile schon — kein Fehler, keine zweite Meldung.
  insert into public.telegram_chat_anfragen (chat_id, telegram_user_id, vorname, benutzername, chat_typ)
  values (p_chat_id, p_telegram_user_id, v_vorname, v_benutzer, v_typ)
  on conflict (chat_id) do nothing;
  if not found then return 'wartet'; end if;

  select m.name into v_mitglied from public.members m
   where m.telegram_user_id = p_telegram_user_id and m.revoked_at is null
   limit 1;

  insert into public.notification_queue (kind, recipient_id, payload, dedup_key)
  select 'telegram_anfrage', m.id,
         jsonb_build_object(
           'title', '✈️ Telegram-Anmeldung wartet',
           'body', coalesce(v_mitglied || ' (verknüpftes Konto)', v_vorname, 'Jemand')
                   || case when v_typ is not null and v_typ <> 'private' then ' (Gruppe)' else '' end
                   || ' möchte die Vereins-Meldungen per Telegram bekommen. Bitte freigeben oder ablehnen.',
           'url', '/admin#handbook',
           'chat_id', p_chat_id),
         'tg_anfrage:' || p_chat_id::text || ':' || m.id::text
    from public.members m
   where m.role = 'admin' and m.revoked_at is null
  on conflict do nothing;

  return 'neu';
end;
$function$;
REVOKE ALL ON FUNCTION public.telegram_chat_anmelden(bigint, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_chat_anmelden(bigint, bigint, text, text, text) TO service_role;

-- Admin-Liste: aktive Chats (Verteiler), offene und abgelehnte Anfragen.
CREATE OR REPLACE FUNCTION public.telegram_chats_admin_liste()
 RETURNS TABLE(chat_id bigint, status text, vorname text, benutzername text, chat_typ text,
               angefragt_at timestamptz, mitglied_name text, mitglied_gesperrt boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  with aktiv as (
    select (c #>> '{}')::bigint as cid
      from public.system_config s,
           jsonb_array_elements(coalesce(s.value->'chat_ids', '[]'::jsonb)) c
     where s.key = 'telegram_chats' and jsonb_typeof(c) = 'number'
  ), alle as (
    select a.cid, 'aktiv'::text as st from aktiv a
    union all
    select t.chat_id, case when t.abgelehnt_at is null then 'wartet' else 'abgelehnt' end
      from public.telegram_chat_anfragen t
     where not exists (select 1 from aktiv a where a.cid = t.chat_id)
  )
  select x.cid, x.st, t.vorname, t.benutzername, t.chat_typ, t.angefragt_at,
         mm.name, (mm.revoked_at is not null)
    from alle x
    left join public.telegram_chat_anfragen t on t.chat_id = x.cid
    left join lateral (
      select m.name, m.revoked_at from public.members m
       where m.telegram_user_id = coalesce(t.telegram_user_id, x.cid)
       limit 1
    ) mm on true
   order by case x.st when 'wartet' then 0 when 'aktiv' then 1 else 2 end,
            t.angefragt_at desc nulls last, x.cid;
end;
$function$;
REVOKE ALL ON FUNCTION public.telegram_chats_admin_liste() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_chats_admin_liste() TO authenticated, service_role;

-- p_aktion: 'freigeben' (Anfrage → Verteiler) oder 'ablehnen' (aus dem
-- Verteiler nehmen bzw. Anfrage ablehnen; bleibt als „abgelehnt“ vermerkt).
CREATE OR REPLACE FUNCTION public.telegram_chat_entscheiden(p_chat_id bigint, p_aktion text)
 RETURNS void
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select m.id into v_me from public.members m where m.auth_user_id = auth.uid();

  if p_aktion = 'freigeben' then
    -- Nur Chats, die sich selbst per /start gemeldet haben.
    if not exists (select 1 from public.telegram_chat_anfragen where chat_id = p_chat_id) then
      raise exception 'anfrage_nicht_gefunden';
    end if;
    perform public.register_telegram_chat(p_chat_id);
    -- Die Anfrage bleibt als Vermerk stehen: so zeigt die Liste auch bei
    -- freigegebenen Chats ohne App-Konto noch Name/@Benutzername. Eine
    -- frühere Ablehnung ist damit aufgehoben.
    update public.telegram_chat_anfragen
       set abgelehnt_at = null, abgelehnt_von = null
     where chat_id = p_chat_id;
  elsif p_aktion = 'ablehnen' then
    -- Erst als abgelehnt vermerken, dann aus dem Verteiler nehmen: in dieser
    -- Reihenfolge bleiben Name und Typ der Anfrage für die Admin-Liste
    -- erhalten (unregister löscht nur OFFENE Anfragen).
    insert into public.telegram_chat_anfragen (chat_id, abgelehnt_at, abgelehnt_von)
    values (p_chat_id, now(), v_me)
    on conflict (chat_id) do update set abgelehnt_at = now(), abgelehnt_von = v_me;
    perform public.unregister_telegram_chat(p_chat_id);
  else
    raise exception 'ungueltige_aktion';
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.telegram_chat_entscheiden(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_chat_entscheiden(bigint, text) TO authenticated, service_role;

-- Entknüpft oder gelöscht → privater Chat raus aus dem Verteiler.
-- Vorher bekam, wer in der App „Verknüpfung lösen“ tippte oder als Mitglied
-- gelöscht wurde, weiter alle Rundnachrichten (im Notfall mit den Namen der
-- Anwesenden). Der private Chat hat dieselbe ID wie der Telegram-Nutzer;
-- Gruppen (negative IDs) sind nicht betroffen. Greift für jeden Weg: App
-- (unlink_my_telegram), Bot (/unlink), Neu-Verknüpfung mit einem anderen
-- Telegram-Konto, Löschen des Mitglieds. Wieder dabei: /start + Freigabe.
CREATE OR REPLACE FUNCTION public._telegram_chat_entknuepft()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- telegram_user_id ist eindeutig (members_telegram_user_id_idx): kein
  -- anderes Konto hängt an diesem Chat.
  perform public.unregister_telegram_chat(OLD.telegram_user_id);
  return null;
end;
$function$;
REVOKE ALL ON FUNCTION public._telegram_chat_entknuepft() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_telegram_chat_entknuepft ON public.members;
CREATE TRIGGER trg_telegram_chat_entknuepft
  AFTER UPDATE OF telegram_user_id ON public.members
  FOR EACH ROW
  WHEN (OLD.telegram_user_id IS NOT NULL AND OLD.telegram_user_id IS DISTINCT FROM NEW.telegram_user_id)
  EXECUTE FUNCTION public._telegram_chat_entknuepft();

DROP TRIGGER IF EXISTS trg_telegram_chat_mitglied_geloescht ON public.members;
CREATE TRIGGER trg_telegram_chat_mitglied_geloescht
  AFTER DELETE ON public.members
  FOR EACH ROW
  WHEN (OLD.telegram_user_id IS NOT NULL)
  EXECUTE FUNCTION public._telegram_chat_entknuepft();

-- ─── Aufräumen (täglich 03:40 UTC) ───────────────────────────────────────
-- email_log nach 12 Monaten, Vorlagen-Vermerke nach 90 Tagen, nie
-- entschiedene Telegram-Anfragen nach 60 Tagen (Ablehnungen und die Vermerke
-- freigegebener Chats bleiben).
SELECT cron.schedule(
  'versandprotokolle-aufraeumen',
  '40 3 * * *',
  $job$
  delete from public.email_log where sent_at < now() - interval '12 months';
  delete from public.push_vorlagen_versand where gesendet_at < now() - interval '90 days';
  delete from public.telegram_chat_anfragen a
   where a.abgelehnt_at is null and a.angefragt_at < now() - interval '60 days'
     and not exists (select 1 from public.system_config s
                      where s.key = 'telegram_chats'
                        and coalesce(s.value->'chat_ids', '[]'::jsonb) @> to_jsonb(a.chat_id));
  $job$
);

-- ─── 5) saunafest-video-poll mit Cron-Geheimnis ──────────────────────────
DO $cron$
DECLARE
  v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'saunafest-video-poll';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/saunafest-video?action=poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$);
  ELSE
    RAISE WARNING '0187: pg_cron-Job saunafest-video-poll fehlt';
  END IF;
END $cron$;
