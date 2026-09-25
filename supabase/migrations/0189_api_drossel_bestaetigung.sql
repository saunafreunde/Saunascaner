-- 0189_api_drossel_bestaetigung.sql
-- ---------------------------------------------------------------------
-- Öffentliche API-Endpunkte bremsen, Mitglieds-Konten erst nach
-- bestätigter E-Mail (Audit 25.09.2026, Gruppe F1).
--
-- Befunde:
--  * /api/ai (KI-Titel) war ohne Anmeldung, ohne Mengen- und ohne
--    Größenbegrenzung aufrufbar: jeder im Internet konnte das
--    OpenRouter-Guthaben leerräumen. Die neue Bremse zählt je Mitglied bzw.
--    je gekoppeltem Öl-Raum-Gerät und hat einen Tagesdeckel für alle.
--  * /api/email?action=magic-link und reset-link waren ungebremst: beliebig
--    viele Mails von info@sauna-fds.de an beliebige Adressen (Mail-Bombing,
--    Sperrlisten-Gefahr). Neu: Grenzen je IP, je Adresse (nur als
--    sha256) und für alle zusammen.
--  * magic-link legte für jede fremde Adresse SOFORT ein Mitglieds-Konto an
--    (Gast: freigegeben, mit PIN und „Einwilligung", sonst eine
--    Freigabe-Anfrage) — bevor die Person den Link je angeklickt hatte. Rund
--    8.900 Anfragen hätten den PIN-Pool (1000–9999) gefüllt, danach wäre jede
--    Registrierung gescheitert. Neu: handle_new_user legt die Mitglieds-Zeile
--    (PIN, Freigabe, Einwilligung, Einladung) erst an, wenn die E-Mail-Adresse
--    bestätigt ist — beim Anlegen (Tablet-Anmeldung: createUser mit
--    email_confirm) oder später beim Klick auf den Link (neuer Trigger
--    on_auth_user_confirmed).
--
-- Bestehende Konten ändern sich nicht: Wer schon eine Mitglieds-Zeile hat
-- (auch das eine unbestätigte Altkonto vom 23.05.), bleibt beim Bestätigen
-- unverändert.
--
-- Reihenfolge: VOR dem Deploy einspielen (rein additiv). Läuft der neue Code
-- ohne diese Migration, bremsen die Mail-Endpunkte nicht (wie bisher) und die
-- KI-Titel bleiben aus (der Dialog zeigt die Regel-Titel).
-- ---------------------------------------------------------------------

-- ─── 1) Drossel-Tabelle aus 0173 um zwei Arten erweitern ────────────────
ALTER TABLE public.kiosk_versuche DROP CONSTRAINT IF EXISTS kiosk_versuche_art_check;
ALTER TABLE public.kiosk_versuche ADD CONSTRAINT kiosk_versuche_art_check
  CHECK (art IN ('pin_fehl', 'signup', 'signup_mail', 'ki_titel', 'mail'));

COMMENT ON TABLE public.kiosk_versuche IS
  'Bremse für öffentliche Endpunkte: PIN-Fehlversuche und Tablet-Anmeldungen (0173), KI-Titel und Login-/Passwort-Mails (0189). Schlüssel: IP, Mitglieds-ID, Geräte-Hash oder E-Mail-Hash (nie die Adresse). Nur service_role. Einträge älter als 1 Tag werden beim Schreiben gelöscht.';

-- ─── 2) Prüfen und buchen in EINEM Schritt ──────────────────────────────
-- Mehrere „Töpfe" auf einmal (z. B. je Mitglied pro Stunde + alle pro Tag):
-- Ist einer voll, wird NICHTS gebucht und seine Nummer (1-basiert)
-- zurückgegeben; sonst wird in allen gebucht und 0 zurückgegeben.
-- Anders als kiosk_gesperrt + kiosk_versuch_merken (zwei Aufrufe) hält die
-- Grenze auch bei gleichzeitigen Anfragen genau: je Schlüssel eine Sperre
-- bis Transaktionsende. Fenster höchstens 1 Tag (ältere Einträge werden
-- gelöscht).
CREATE OR REPLACE FUNCTION public.api_drossel_buchen(
  p_art text,
  p_schluessel text[],
  p_max integer[],
  p_fenster_sekunden integer[]
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer := coalesce(array_length(p_schluessel, 1), 0);
  v_i integer;
  v_s text;
BEGIN
  IF v_n = 0 OR v_n > 8
     OR coalesce(array_length(p_max, 1), 0) <> v_n
     OR coalesce(array_length(p_fenster_sekunden, 1), 0) <> v_n THEN
    RAISE EXCEPTION 'drossel_parameter_ungueltig' USING ERRCODE = '22023';
  END IF;

  -- Feste Reihenfolge der Sperren, damit sich parallele Aufrufe nicht verklemmen.
  FOR v_s IN SELECT DISTINCT left(k, 128) FROM unnest(p_schluessel) AS k ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(189, hashtext(p_art || '|' || coalesce(v_s, '')));
  END LOOP;

  FOR v_i IN 1..v_n LOOP
    IF (
      SELECT count(*)
      FROM public.kiosk_versuche v
      WHERE v.art = p_art
        AND v.schluessel = left(p_schluessel[v_i], 128)
        AND v.zeit > now() - make_interval(secs => least(greatest(coalesce(p_fenster_sekunden[v_i], 1), 1), 86400))
    ) >= greatest(coalesce(p_max[v_i], 1), 1) THEN
      RETURN v_i;
    END IF;
  END LOOP;

  INSERT INTO public.kiosk_versuche (art, schluessel)
  SELECT DISTINCT p_art, left(k, 128) FROM unnest(p_schluessel) AS k;

  DELETE FROM public.kiosk_versuche WHERE zeit < now() - interval '1 day';
  RETURN 0;
END;
$fn$;

REVOKE ALL ON FUNCTION public.api_drossel_buchen(text, text[], integer[], integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_drossel_buchen(text, text[], integer[], integer[]) TO service_role;

COMMENT ON FUNCTION public.api_drossel_buchen(text, text[], integer[], integer[]) IS
  'Bremse (0189): prüft alle Töpfe und bucht nur, wenn keiner voll ist. 0 = gebucht, n = n-ter Topf voll. Nur service_role (api/*).';

-- ─── 3) Mitglieds-Zeile erst nach bestätigter E-Mail ───────────────────
-- Vorlage: Live-Fassung vom 25.09.2026 (pg_get_functiondef). Neu sind nur
-- die beiden Prüfungen am Anfang; der Rest ist unverändert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_kind text := new.raw_user_meta_data->>'signup_kind';
  v_ref  text := new.raw_user_meta_data->>'gast_referral';
  v_origin text := new.raw_user_meta_data->>'gast_origin';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
  v_pin char(4);
begin
  -- 0189: Noch nicht bestätigte Adresse → noch kein Mitglied, keine PIN,
  -- keine Einwilligung, keine eingelöste Einladung. Das holt der Trigger
  -- on_auth_user_confirmed nach, sobald die Person den Link anklickt.
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- Nur der Übergang unbestätigt → bestätigt zählt (der Trigger filtert
    -- schon; doppelt hält besser).
    if old.email_confirmed_at is not null then
      return new;
    end if;
    -- Altkonto, das schon vor 0189 eine Mitglieds-Zeile bekam: nichts ändern.
    if exists (select 1 from public.members where auth_user_id = new.id) then
      return new;
    end if;
  end if;

  v_pin := public.generate_checkin_pin();

  if v_kind = 'gast' then
    insert into public.members (
      auth_user_id, email, name, role, is_aufgieser, approved,
      gast_referral_source, gast_signup_origin, gast_consent_at,
      checkin_pin
    ) values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'name', new.email),
      'gast', false, true,
      v_ref, v_origin, now(),
      v_pin
    )
    on conflict (auth_user_id) do update set
      role = 'gast',
      approved = true,
      gast_referral_source = excluded.gast_referral_source,
      gast_signup_origin = excluded.gast_signup_origin,
      gast_consent_at = coalesce(public.members.gast_consent_at, excluded.gast_consent_at),
      checkin_pin = coalesce(public.members.checkin_pin, excluded.checkin_pin);
    return new;
  end if;

  if v_code is not null and length(v_code) > 0 then
    select * into v_inv from public.invitations
     where code = upper(v_code)
       and used_by is null
       and (expires_at is null or expires_at > now())
     for update;
    if found then
      insert into public.members
        (auth_user_id, email, name, role, is_aufgieser, is_personal_planer, approved, checkin_pin)
      values
        (new.id, new.email,
         coalesce(new.raw_user_meta_data->>'name', new.email),
         v_inv.target_role,
         v_inv.target_is_aufgieser,
         v_inv.target_is_personal_planer,
         true,
         v_pin)
      on conflict (auth_user_id) do update set
        role               = excluded.role,
        is_aufgieser       = excluded.is_aufgieser,
        is_personal_planer = excluded.is_personal_planer,
        approved           = true,
        checkin_pin        = coalesce(public.members.checkin_pin, excluded.checkin_pin)
      returning id into v_member_id;
      update public.invitations
         set used_by = v_member_id, used_at = now()
       where id = v_inv.id;
      return new;
    end if;
  end if;

  insert into public.members (auth_user_id, email, name, role, approved, checkin_pin)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false, v_pin)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$function$;

-- Trigger-Funktion: niemand ruft sie direkt auf (Rechte wie bisher).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Bestätigung per Link (Signup, Magic-Link, Passwort-Link, Einladung):
-- GoTrue setzt email_confirmed_at per UPDATE. Ohne Spaltenliste, damit auch
-- ein UPDATE aller Spalten greift; die WHEN-Bedingung filtert billig.
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
