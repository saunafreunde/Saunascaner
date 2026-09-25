// Vercel Serverless Function — POST /api/qr-signin
// Default: Body { member_code: "<uuid>" } — Mitglieder-QR-Scanner
// ?action=pin-checkin: Body { pin: "1234" } — Sauna-Tablet PIN-Checkin
// ?action=tablet-signup: Body { name, email, dsgvo, ref?, origin? } — Schnell-Signup am Tablet
// ?action=pin-toggle: Body { pin: "1234" } — Eingangs-Scanner (ein-/auschecken)
//
// Bremse (Migration 0173, 25.09.2026): Fehlversuche mit unbekannter PIN werden
// je IP in der Datenbank gezählt (kiosk_versuche) — Treffer bremsen nie, damit
// der Eingang am Saunafest nicht stockt. Die Speicher-Bremse unten bleibt als
// grobe erste Stufe.
//
// Gekoppelte Geräte (Migration 0177, Nachtrag Audit 25.09.2026 / 0189): Eingangs-
// Tablet und Scanner schicken ihr Geräte-Token (Header x-kiosk-geraet) mit.
//  * Die Speicher-Bremse bremst sie nicht (Tablet und Scanner teilen sich am
//    Eingang eine IP).
//  * Ihre PIN-Fehlversuche zählen in einen eigenen Topf je Gerät (30 je
//    15 min, 200 je Tag) statt in den Topf der Vereins-IP (Audit-Runde 2).
//  * PIN-Fehlversuche OHNE gekoppeltes Gerät zählen zusätzlich in einen
//    gemeinsamen Topf („ungekoppelt", 20 je Stunde) — wer IPs wechselt, kommt
//    so nicht mehr auf Tausende Versuche. Gilt erst, sobald ein Eingangs-Tablet
//    oder Scanner gekoppelt ist (vorher liefen die echten Geräte ja selbst
//    ungekoppelt).
//  * tablet-signup (legt Konten an und verschickt Mails) nimmt nur noch das
//    gekoppelte Eingangs-Tablet an — ebenfalls erst, sobald eins gekoppelt ist.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { authenticate } from './_auth.js';
import { getBrandSettings, logEmailSend, sendSystemMail } from './_email_helpers.js';
import { renderGastAccessEmail } from './_email_templates.js';
import { clientIp, emailSchluessel, geraeteartGekoppelt, kioskGeraet, ohneAdressen } from './_schutz.js';
import { queryParam } from './_query.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^\d{4}$/;

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string, max = 10): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

// Client-IP: clientIp() aus _schutz.ts (x-real-ip bzw. erster Eintrag von
// x-forwarded-for — setzt Vercel selbst, lässt sich nicht vorgeben).

// Datenbank-Bremse (0173). Grenzen: unbekannte PINs je IP; Anmeldungen je IP;
// Anmelde-Mails an ein bestehendes Konto je E-Mail (als sha256, nie im Klartext).
const PIN_FEHL_MAX = 8;
const PIN_FEHL_FENSTER_S = 15 * 60;
const SIGNUP_MAX = 30;
const SIGNUP_FENSTER_S = 60 * 60;
const SIGNUP_MAIL_FENSTER_S = 10 * 60;

async function gebremst(admin: SupabaseClient, art: string, schluessel: string, max: number, fensterS: number): Promise<boolean> {
  const { data, error } = await admin.rpc('kiosk_gesperrt', {
    p_art: art, p_schluessel: schluessel, p_max: max, p_fenster_sekunden: fensterS,
  });
  if (error) {
    // Lieber durchlassen als den Eingang lahmlegen — die Speicher-Bremse greift weiter.
    console.error('[qr-signin] kiosk_gesperrt fehlgeschlagen', error.code ?? '');
    return false;
  }
  return data === true;
}

async function versuchMerken(admin: SupabaseClient, art: string, schluessel: string): Promise<void> {
  const { error } = await admin.rpc('kiosk_versuch_merken', { p_art: art, p_schluessel: schluessel });
  if (error) console.error('[qr-signin] kiosk_versuch_merken fehlgeschlagen', error.code ?? '');
}

// ─── Gekoppelte Geräte + gemeinsamer Topf für ungekoppelte PIN-Versuche ──
// Welche Gerätearten PIN-Aktionen und die Tablet-Anmeldung ausführen.
const PIN_GERAETE = ['eingang', 'scanner'];
// Schlüssel des gemeinsamen Topfs — kann mit keiner IP zusammenfallen.
const UNGEKOPPELT = 'ungekoppelt';
const PIN_FEHL_UNGEKOPPELT_MAX = 20;
const PIN_FEHL_UNGEKOPPELT_FENSTER_S = 60 * 60;

// Gekoppelte Eingangsgeräte (Audit-Runde 2, 25.09.2026): eigener Topf je
// Gerät statt des Topfs je IP. Vorher zählten ihre Fehlversuche in den Topf
// der Vereins-IP — 8 Tippfehler (oder jemand, der am öffentlichen Tablet
// herumtippt, oder ein Gast im Vereins-WLAN) sperrten Eingangs-Tablet UND
// Scanner bis zu 15 min, auch für richtige PINs. Die Grenze je Gerät ist
// großzügiger (Saunafest), ein Tagesdeckel bremst ein ausgelesenes Token.
const PIN_FEHL_GERAET_MAX = 30;
const PIN_FEHL_GERAET_FENSTER_S = 15 * 60;
const PIN_FEHL_GERAET_TAG_MAX = 200;
const PIN_FEHL_GERAET_TAG_S = 24 * 60 * 60;

/** Anfrage-Kontext der PIN-Aktionen: IP, ob ein gekoppeltes Gerät fragt und
 *  dessen Drossel-Schlüssel (sha256-Auszug des Tokens, nie das Token). */
type PinKontext = { ip: string; gekoppelt: boolean; geraetSchluessel?: string };

/** Topf-Schlüssel eines gekoppelten Geräts — kann mit keiner IP zusammenfallen. */
function geraeteTopf(k: PinKontext): string | null {
  return k.gekoppelt && k.geraetSchluessel ? `g:${k.geraetSchluessel}` : null;
}

async function pinGebremst(admin: SupabaseClient, k: PinKontext): Promise<boolean> {
  const g = geraeteTopf(k);
  if (g) {
    // Gekoppeltes Eingangsgerät: nur sein eigener Topf, nicht der der IP.
    if (await gebremst(admin, 'pin_fehl', g, PIN_FEHL_GERAET_MAX, PIN_FEHL_GERAET_FENSTER_S)) return true;
    return gebremst(admin, 'pin_fehl', g, PIN_FEHL_GERAET_TAG_MAX, PIN_FEHL_GERAET_TAG_S);
  }
  if (await gebremst(admin, 'pin_fehl', k.ip, PIN_FEHL_MAX, PIN_FEHL_FENSTER_S)) return true;
  // Übergang: solange weder Eingangs-Tablet noch Scanner gekoppelt ist, laufen
  // die echten Geräte selbst ungekoppelt — dann nur die Bremse je IP.
  const aktiv = (await geraeteartGekoppelt(admin, 'eingang')) || (await geraeteartGekoppelt(admin, 'scanner'));
  if (!aktiv) return false;
  return gebremst(admin, 'pin_fehl', UNGEKOPPELT, PIN_FEHL_UNGEKOPPELT_MAX, PIN_FEHL_UNGEKOPPELT_FENSTER_S);
}

async function pinFehlMerken(admin: SupabaseClient, k: PinKontext): Promise<void> {
  const g = geraeteTopf(k);
  if (g) {
    // Spiegelbildlich zu pinGebremst: nur der Gerätetopf, nicht die Vereins-IP.
    await versuchMerken(admin, 'pin_fehl', g);
    return;
  }
  await versuchMerken(admin, 'pin_fehl', k.ip);
  await versuchMerken(admin, 'pin_fehl', UNGEKOPPELT);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = clientIp(req);
  const speicherVoll = isRateLimited(ip);

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return res.status(500).json({ error: 'server env missing' });

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const action = String(queryParam(req, 'action') ?? '');

  // Nur für die Kiosk-Aktionen fragen wir nach dem Gerät (eine Abfrage).
  const kioskAktion = ['pin-checkin', 'pin-toggle', 'kiosk-rate', 'tablet-signup'].includes(action);
  const geraet = kioskAktion ? await kioskGeraet(admin, req) : null;
  const gekoppelt = !!geraet && PIN_GERAETE.includes(geraet.art);
  // Grobe Speicher-Stufe — gekoppelte Vereinsgeräte bremst sie nicht.
  if (speicherVoll && !gekoppelt) return res.status(429).json({ error: 'too_many_requests' });

  const k: PinKontext = { ip, gekoppelt, geraetSchluessel: gekoppelt ? geraet?.schluessel : undefined };
  if (action === 'pin-checkin') return handlePinCheckin(req, res, admin, k);
  if (action === 'pin-toggle') return handlePinToggle(req, res, admin, k);
  if (action === 'kiosk-rate') return handleKioskRate(req, res, admin, k);
  if (action === 'tablet-signup') {
    // Legt Konten an und verschickt Mails: nur vom gekoppelten Eingangs-Tablet
    // (Übergang: solange noch keins gekoppelt ist, wie bisher offen).
    if (geraet?.art !== 'eingang' && (await geraeteartGekoppelt(admin, 'eingang'))) {
      return res.status(403).json({ error: 'Dieses Gerät ist nicht als Eingangs-Tablet freigeschaltet. Bitte beim Personal melden.' });
    }
    return handleTabletSignup(req, res, admin, ip);
  }
  if (action === 'resend-access') return handleResendAccess(req, res, admin);

  // Default: Mitglieder-QR-Scanner mit UUID member_code
  const code = (req.body?.member_code ?? '').trim();
  if (!UUID_RE.test(code)) return res.status(400).json({ error: 'invalid member_code' });

  const { data: m, error: mErr } = await admin
    .from('members')
    .select('id, email, name, role, revoked_at')
    .eq('member_code', code)
    .maybeSingle();
  if (mErr) return res.status(500).json({ error: mErr.message });
  if (!m || m.revoked_at) return res.status(404).json({ error: 'unknown_or_revoked' });
  if (!m.email) return res.status(400).json({ error: 'no_email_on_member' });

  const origin = getOrigin(req);
  const redirectTo = `${origin}/me`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: m.email,
    options: { redirectTo },
  });
  if (error) return res.status(500).json({ error: error.message });

  const url = data?.properties?.action_link;
  if (!url) return res.status(500).json({ error: 'no_action_link' });

  return res.status(200).json({ url, name: m.name, role: m.role });
}

function getOrigin(req: VercelRequest): string {
  return (
    (req.headers['origin'] as string) ??
    `https://${req.headers['x-forwarded-host'] ?? req.headers['host']}`
  );
}

// ─── PIN-Checkin am Sauna-Tablet ──────────────────────────────────────────
//
// ⚠️ Hier stand bis 16.08.2026 ein generateLink('magiclink') — das Tablet
// wurde damit als die eingetippte Person ANGEMELDET. /checkin/rate lief
// entsprechend mit einer echten Session auf einem öffentlich zugänglichen
// Gerät: wer nicht auf den Auto-Logout wartete, sondern herumtippte, stand im
// Profil, in den Direktnachrichten und in den Einstellungen einer fremden
// Person. Ein 4-stelliger PIN öffnete das ganze Konto.
//
// Jetzt: der PIN ist nur noch Ausweis für zwei eng gefasste Vorgänge —
// anwesend setzen und bewerten. Keine Session, kein Token, nichts, womit man
// woanders hinkäme. Die zugehörigen RPCs sind ausschließlich für service_role
// freigegeben und laufen deshalb nur über diesen Endpunkt, wo der
// IP-Rate-Limiter oben greift. Anon-Zugriff würde bedeuten, dass man 9000
// PIN-Möglichkeiten direkt über PostgREST durchprobieren kann.
async function handlePinCheckin(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
  k: PinKontext,
) {
  const pin = String(req.body?.pin ?? '').trim();
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'invalid_pin' });
  if (await pinGebremst(admin, k)) {
    return res.status(429).json({ error: 'zu_viele_fehlversuche' });
  }

  const { data: rows, error } = await admin.rpc('kiosk_checkin', { p_pin: pin });
  if (error) {
    if (error.message?.includes('pin_unbekannt')) {
      await pinFehlMerken(admin, k);
      return res.status(404).json({ error: 'pin_unknown' });
    }
    return res.status(500).json({ error: error.message });
  }
  const m = Array.isArray(rows) ? rows[0] : rows;
  if (!m) return res.status(404).json({ error: 'pin_unknown' });

  const bewertbar = await ladeBewertbar(admin, pin);

  return res.status(200).json({
    name: m.name,
    war_schon_da: !!m.war_schon_da,
    bewertbar,
  });
}

// ─── Eingangs-Scanner: PIN ein-/auschecken ────────────────────────────────
// Vorher rief /scanner toggle_presence_by_checkin_pin direkt über PostgREST
// mit dem öffentlichen anon-Key auf — ohne Bremse, alle 72 PINs waren mit
// 10.000 Versuchen zu finden. Jetzt nur noch hier (service_role, 0174 sperrt
// den direkten Weg).
async function handlePinToggle(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
  k: PinKontext,
) {
  const pin = String(req.body?.pin ?? '').trim();
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'invalid_pin_format' });
  if (await pinGebremst(admin, k)) {
    return res.status(429).json({ error: 'zu_viele_fehlversuche' });
  }

  const { data, error } = await admin.rpc('toggle_presence_by_checkin_pin', { p_pin: pin });
  if (error) {
    if (error.code === 'P0002' || error.message?.includes('unknown_or_revoked')) {
      await pinFehlMerken(admin, k);
      return res.status(404).json({ error: 'unknown_or_revoked' });
    }
    if (error.message?.includes('invalid_pin_format')) return res.status(400).json({ error: 'invalid_pin_format' });
    console.error('[qr-signin] pin-toggle', error.code ?? '');
    return res.status(500).json({ error: 'checkin_fehlgeschlagen' });
  }
  const r = (Array.isArray(data) ? data[0] : data) as
    { member_id?: string; name?: string; is_present?: boolean; needs_family_modal?: boolean } | null;
  if (!r?.member_id) {
    await pinFehlMerken(admin, k);
    return res.status(404).json({ error: 'unknown_or_revoked' });
  }
  return res.status(200).json({
    member_id: r.member_id,
    name: r.name ?? '',
    is_present: !!r.is_present,
    needs_family_modal: !!r.needs_family_modal,
  });
}

// ─── Bewerten am Tablet ───────────────────────────────────────────────────
async function handleKioskRate(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
  k: PinKontext,
) {
  const pin = String(req.body?.pin ?? '').trim();
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'invalid_pin' });
  if (await pinGebremst(admin, k)) {
    return res.status(429).json({ error: 'zu_viele_fehlversuche' });
  }

  const b = req.body ?? {};
  const note = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const werte = {
    p_chemie: note(b.chemie), p_luftbewegung: note(b.luftbewegung),
    p_wedeltechnik: note(b.wedeltechnik), p_hitzeniveau: note(b.hitzeniveau),
    p_musik: note(b.musik), p_duftentwicklung: note(b.duftentwicklung),
  };
  if (Object.values(werte).some((v) => v === null)) {
    return res.status(400).json({ error: 'bewertung_unvollstaendig' });
  }
  if (!UUID_RE.test(String(b.infusion_id ?? ''))) {
    return res.status(400).json({ error: 'invalid_infusion_id' });
  }

  const { data, error } = await admin.rpc('kiosk_submit_rating', {
    p_pin: pin,
    p_infusion_id: b.infusion_id,
    ...werte,
    p_comment: typeof b.comment === 'string' ? b.comment.slice(0, 500) : null,
  });
  if (error) return res.status(500).json({ error: error.message });
  if (data === 'pin_unbekannt') await pinFehlMerken(admin, k);
  if (data !== 'ok') return res.status(400).json({ error: String(data) });

  // Frische Liste zurückgeben — nach dem Speichern ist mindestens eine
  // weitere Stunde blockiert, das soll die Oberfläche sofort zeigen.
  return res.status(200).json({ ok: true, bewertbar: await ladeBewertbar(admin, pin) });
}

async function ladeBewertbar(admin: SupabaseClient, pin: string) {
  const { data, error } = await admin.rpc('kiosk_ratable', { p_pin: pin });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

// ─── Schnell-Signup am Sauna-Tablet ───────────────────────────────────────
async function handleTabletSignup(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
  ip: string,
) {
  const { name, email, dsgvo, ref, fassung } = req.body as {
    name?: string; email?: string; dsgvo?: boolean; ref?: string; fassung?: unknown;
  };
  // Fassung der Datenschutzhinweise, die das Tablet angezeigt hat (JJJJ-MM-TT).
  // handle_new_user legt das Konto an, der Trigger aus 0186 übernimmt sie nach
  // members.datenschutz_fassung. Alte Tablet-Bundles schicken keine → leer.
  const datenschutzFassung =
    typeof fassung === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fassung) ? fassung : undefined;
  const cleanName = (name ?? '').trim().slice(0, 80);
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) return res.status(400).json({ error: 'name_required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ error: 'valid_email_required' });
  }
  if (!dsgvo) return res.status(400).json({ error: 'dsgvo_required' });

  // Bremse je IP: der Endpunkt legt Konten an und verschickt Mails — ohne
  // Anmeldung. 30 je Stunde reichen auch für einen vollen Saunafest-Eingang.
  if (await gebremst(admin, 'signup', ip, SIGNUP_MAX, SIGNUP_FENSTER_S)) {
    return res.status(429).json({ error: 'zu_viele_anmeldungen' });
  }
  await versuchMerken(admin, 'signup', ip);

  // Prüfen ob die E-Mail schon ein Konto hat. Dann gibt es die PIN NICHT am
  // Bildschirm (sonst bekäme jeder, der eine Mitglieds-E-Mail kennt, deren
  // PIN — Befund 24.09.2026), sondern nur per Mail an die hinterlegte Adresse.
  // listUsers ist paginiert (Default 50!) — ohne Loop würde ab User 51 die
  // Wiederanmeldung eines Bestands-Gasts fehlschlagen (createUser → email exists).
  let existing: User | undefined;
  for (let page = 1; page <= 40; page++) {
    const { data: userPage, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (listErr) return res.status(500).json({ error: 'user lookup failed: ' + listErr.message });
    const users = userPage?.users ?? [];
    existing = users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existing || users.length < 500) break;
  }
  const gastMeta = {
    name: cleanName,
    signup_kind: 'gast',
    gast_referral: (typeof ref === 'string' && ref.trim() ? ref.trim() : 'Tablet').slice(0, 80),
    gast_origin: 'tablet_signup',
    ...(datenschutzFassung ? { datenschutz_fassung: datenschutzFassung } : {}),
  };
  let userId: string;
  if (existing) {
    const { data: memberRow } = await admin
      .from('members')
      .select('id, checkin_pin, name, email, revoked_at')
      .eq('auth_user_id', existing.id)
      .maybeSingle();
    // Eine offene (nie bestätigte) Anmeldung übernimmt das Tablet nur, wenn sie
    // selbst eine Gast-Anmeldung ohne Einladung war. Eine offene Registrierung
    // über /login (evtl. mit Einladungs-Code) bleibt, wie sie ist — die Person
    // bestätigt sie über ihre eigene Mail.
    const meta0 = (existing.user_metadata ?? {}) as Record<string, unknown>;
    const offeneGastAnmeldung = meta0.signup_kind === 'gast' && !meta0.invite_code;
    if (memberRow || existing.email_confirmed_at || !offeneGastAnmeldung) {
      // Kein Einchecken und keine PIN ohne PIN-Nachweis: die Person bekommt ihre
      // Zugangsdaten per Mail und checkt danach wie alle mit der PIN ein.
      // Höchstens eine Mail je Konto in 10 Minuten (sonst Mail-Bombe per Tablet).
      let mailSent = true;
      if (memberRow && memberRow.checkin_pin && !memberRow.revoked_at) {
        const mailKey = emailSchluessel(cleanEmail);
        if (!(await gebremst(admin, 'signup_mail', mailKey, 1, SIGNUP_MAIL_FENSTER_S))) {
          await versuchMerken(admin, 'signup_mail', mailKey);
          mailSent = await sendGastAccessMail(admin, {
            memberId: memberRow.id,
            // Adresse aus der Datenbank, nicht aus dem Formular.
            email: (memberRow.email ?? cleanEmail).trim().toLowerCase(),
            name: memberRow.name,
            pin: memberRow.checkin_pin,
            isReturning: true,
          });
        }
      }
      return res.status(200).json({ existing: true, mailSent });
    }
    // Angefangen, aber nie bestätigt (z. B. QR-Anmeldung ohne Klick auf den
    // Link): seit 0189 gibt es dafür noch kein Mitglieds-Konto und keine PIN.
    // Die Person steht jetzt am Eingangs-Tablet — wie eine Neuanmeldung
    // behandeln. Erst die Angaben, DANN bestätigen: beim Bestätigen legt
    // handle_new_user das Gast-Konto aus genau diesen Angaben an.
    // Neues Zufallspasswort: Wer die offene Anmeldung angelegt hat, hätte sonst
    // nach dem Bestätigen hier ein bestätigtes Konto mit SEINEM Passwort für eine
    // fremde Adresse (die Adresse wurde ja nie per Mail nachgewiesen). Die
    // echte Person setzt ihr Passwort über den Link in der Zugangs-Mail.
    const { error: metaErr } = await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...gastMeta, invite_code: null },
      password: cryptoRandomPassword(),
    });
    const { error: confErr } = metaErr
      ? { error: metaErr }
      : await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    if (confErr) {
      console.error('[qr-signin] tablet-signup: offene Anmeldung nicht übernommen', confErr.status ?? '', ohneAdressen(confErr.message));
      return res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
    userId = existing.id;
  } else {
    // Neuen Auth-User erstellen mit signup_kind=gast Metadata. Bestätigt
    // angelegt (die Person steht am Tablet) → handle_new_user legt das
    // Gast-Konto samt PIN sofort an.
    const tempPassword = cryptoRandomPassword();
    const { data: signupData, error: signupErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: gastMeta,
    });
    if (signupErr || !signupData.user) {
      console.error('[qr-signin] tablet-signup: createUser fehlgeschlagen', signupErr?.status ?? '', ohneAdressen(signupErr?.message));
      return res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
    userId = signupData.user.id;
  }

  // Kurz warten + Member-PIN abholen (Trigger sollte sofort gefeuert haben)
  let pin: string | null = null;
  let memberId: string | null = null;
  let attempts = 0;
  while (!pin && attempts < 5) {
    const { data: m } = await admin
      .from('members')
      .select('id, checkin_pin')
      .eq('auth_user_id', userId)
      .maybeSingle();
    pin = m?.checkin_pin ?? null;
    memberId = m?.id ?? null;
    if (!pin) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
  }
  if (!pin) return res.status(500).json({ error: 'pin_generation_failed' });

  // Für heute angemeldet = anwesend. Ohne das startet der Gast ohne
  // attendance_event in den Tag und get_ratable_infusions liefert nichts.
  if (memberId) await markPresent(admin, memberId);

  const mailSent = await sendGastAccessMail(admin, {
    memberId,
    email: cleanEmail,
    name: cleanName,
    pin,
    isReturning: false,
  });

  return res.status(200).json({
    existing: false,
    pin,
    name: cleanName,
    email: cleanEmail,
    mailSent,
    bewertbar: await ladeBewertbar(admin, pin),
  });
}

// ─── Admin: Zugangsdaten erneut schicken ──────────────────────────────────
// Für den Fall, dass die Mail bei der Anmeldung untergegangen ist oder im
// Spam landete. Schickt PIN + frischen Passwort-Link an die hinterlegte
// Adresse — die Adresse kommt aus der Datenbank, NICHT aus dem Request:
// sonst wäre das ein Weg, sich fremde Zugangsdaten zuschicken zu lassen.
async function handleResendAccess(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
) {
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'nur_admin' });

  const memberId = String(req.body?.member_id ?? '').trim();
  if (!UUID_RE.test(memberId)) return res.status(400).json({ error: 'invalid_member_id' });

  const { data: m, error } = await admin
    .from('members')
    .select('id, name, email, checkin_pin, revoked_at')
    .eq('id', memberId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!m || m.revoked_at) return res.status(404).json({ error: 'unknown_or_revoked' });
  if (!m.email) return res.status(400).json({ error: 'no_email_on_member' });
  if (!m.checkin_pin) return res.status(400).json({ error: 'no_pin_on_member' });

  const ok = await sendGastAccessMail(admin, {
    memberId: m.id,
    email: m.email,
    name: m.name,
    pin: m.checkin_pin,
    isReturning: true,
  });
  if (!ok) return res.status(502).json({ error: 'mail_failed' });
  return res.status(200).json({ ok: true, email: m.email });
}

// is_present + last_scan_at wie beim PIN-Checkin setzen. last_scan_at ist
// Pflicht: ohne den Zeitstempel schreibt log_infusion_attendance_on_scan
// Anwesenheiten für bereits vergangene Aufgüsse.
async function markPresent(admin: SupabaseClient, memberId: string): Promise<void> {
  await admin
    .from('members')
    .update({ is_present: true, last_scan_at: new Date().toISOString() })
    .eq('id', memberId);
}

// Zugangsdaten-Mail von info@sauna-fds.de: PIN fürs Tablet + einmaliger
// Passwort-Link für die App. Der Account wird mit einem Zufallspasswort
// angelegt, das niemand kennt — ohne diese Mail bleibt die App für den Gast
// verschlossen. Ein Fehlschlag darf die Anmeldung NICHT scheitern lassen:
// der PIN steht dann trotzdem auf dem Tablet, und der Admin kann die Mail
// später erneut auslösen.
async function sendGastAccessMail(
  admin: SupabaseClient,
  p: { memberId: string | null; email: string; name: string; pin: string; isReturning: boolean },
): Promise<boolean> {
  const appLink = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: p.email,
      options: { redirectTo: `${appLink}/reset-password` },
    });
    const passwordLink = linkData?.properties?.action_link;
    if (linkErr || !passwordLink) throw new Error(linkErr?.message ?? 'no_action_link');

    const brand = await getBrandSettings(admin);
    const { html, text, subject } = renderGastAccessEmail({
      recipientName: p.name,
      pin: p.pin,
      passwordLink,
      appLink,
      isReturning: p.isReturning,
      brand,
    });
    await sendSystemMail({ to: p.email, subject, html, text });
    await logEmailSend(admin, {
      recipient: p.email,
      subject,
      templateName: 'gast-access',
      status: 'sent',
      memberId: p.memberId ?? undefined,
      senderEmail: process.env.SAUNA_SMTP_USER,
    });
    return true;
  } catch (e) {
    // Ohne Adresse ins Log (Audit 25.09.2026) — wer betroffen ist, steht über
    // memberId im email_log; nodemailer nennt die Adresse teils in der Meldung.
    console.warn('[qr-signin] gast-access Mail fehlgeschlagen', p.memberId ?? 'neu', ohneAdressen((e as Error).message));
    await logEmailSend(admin, {
      recipient: p.email,
      subject: 'Gast-Zugang',
      templateName: 'gast-access',
      status: 'failed',
      error: (e as Error).message,
      memberId: p.memberId ?? undefined,
      senderEmail: process.env.SAUNA_SMTP_USER,
    }).catch(() => undefined);
    return false;
  }
}

function cryptoRandomPassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#=*';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((n) => charset[n % charset.length]).join('');
}
