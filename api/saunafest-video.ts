// api/saunafest-video.ts — KI-Video je Saunafest-Aufguss (Migrationen 0164/0165).
//
// Nach der Planbestätigung trägt der eingeteilte Aufgießer Titel, Thema,
// Bildidee und Öle seines Fest-Aufgusses ein. Daraus baut dieser Endpunkt über
// fal.ai zuerst ein Standbild (nano-banana-2, 21:9) und aus dem Standbild einen
// nahtlosen 5-s-Loop (MiniMax H3 Max Turbo, Start- = Endbild). Beides landet im
// öffentlichen Bucket „assets" unter saunafest-videos/<datum>/ und läuft am
// Festtag als Hintergrund der Aufguss-Karte auf der TV-Tafel.
//
// Aktionen (?action=):
//   start     POST, Bearer — Admin immer; der eingeteilte Aufgießer erst nach
//             der Planbestätigung. Body { infusion_id, erzwingen? }.
//             erzwingen = auch bei unveränderten Angaben neu erzeugen. Das darf
//             bewusst auch der Aufgießer (Knopf „Video neu erzeugen“ — ein
//             misslungenes Video soll sich neu würfeln lassen); seine Starts
//             deckelt max_versuche über versuche_aufgiesser (Admin-Läufe zählen
//             dort nicht, Migration 0166), alle zusammen max_je_fest.
//   webhook   POST von fal — geschützt über inf + Einmal-Token (in der DB steht
//             nur der sha256-Hash). Das Ergebnis wird NICHT aus dem Body
//             genommen, sondern mit FAL_KEY über response_url geholt.
//   poll      GET/POST ohne Anmeldung (pg_cron alle 5 min, Migration 0165) —
//             nimmt KEINE Eingaben, arbeitet nur liegengebliebene Aufträge ab
//             und räumt die Dateien gelöschter Fest-Aufgüsse weg (0166).
//   diagnose  GET, Bearer, nur Admin — ist FAL_KEY gesetzt? (nie der Schlüssel)
//
// Ablauf: start → fal-Bild → Webhook: Standbild speichern + fal-Video einreichen
//         → Webhook: Video speichern, alte Dateien weg, Nachricht an den Aufgießer.
// Jeder Schritt bekommt ein neues Token (der Poll hat das alte nicht im Klartext).
//
// Env: FAL_KEY (Pflicht; wird NIE geloggt oder ausgegeben), SUPABASE_SERVICE_ROLE_KEY,
//      VITE_SUPABASE_URL/SUPABASE_URL, PUBLIC_APP_URL (Ziel des Webhooks — nie aus
//      dem Host-Header: Vorschau-Deployments stehen hinter dem Vercel-Login, und
//      fal wertet jede Weiterleitung als endgültigen Fehler).
//
// Vercel: Request/Response höchstens 4,5 MB — Dateien gehen deshalb nie durch
// die Antwort, sondern direkt von fal nach Storage. api/ steht nicht in der
// tsconfig und wird von @vercel/node ohne strictNullChecks kompiliert: flache
// Typen, keine Imports aus src/, relative Imports mit .js-Suffix, kein
// `instanceof` auf eigene Fehlerklassen.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { authenticate, serviceClient } from './_auth.js';

// ─── Einstellungen ───────────────────────────────────────────────────────
const MODELL_BILD = 'fal-ai/nano-banana-2';
const MODELL_VIDEO = 'minimax/h3-max-turbo/image-to-video';
const FAL_QUEUE = 'https://queue.fal.run/';
const BUCKET = 'assets';
const ORDNER = 'saunafest-videos';
const APP_URL_VORGABE = 'https://app.sauna-fds.de';
/** Titel, den saunafest_einteilen setzt — sagt dem Bildmodell nichts. */
const PLATZHALTER_TITEL = 'Saunafest-Aufguss';

const MIN = 60_000;
const LAEUFT_MAX_MS = 15 * MIN;       // start: jünger → „läuft schon"
const POLL_AB_MS = 3 * MIN;           // poll: erst Aufträge, die so lange still sind
const SCHRITT_MAX_MS = 20 * MIN;      // poll: danach Zeitüberschreitung
const ARBEIT_MAX_MS = 10 * MIN;       // poll: hängender ':arbeit'-Anspruch
const POLL_MAX_AUFTRAEGE = 5;
const POLL_MAX_NACHLAUF = 10;         // poll: so viele gelöschte Aufgüsse je Lauf aufräumen
const POLL_ZEITBUDGET_MS = 35_000;    // danach keinen neuen Auftrag anfangen (maxDuration 60 s)

const BILD_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;   // wie VIDEO_MAX_BYTES in src/lib/api.ts (TV-Stick)

const VORGABE_MAX_VERSUCHE = 3;       // system_config.saunafest_video (0165)
const VORGABE_MAX_JE_FEST = 120;

/** Anhang an fal_request_id, solange ein Aufruf den Auftrag bearbeitet. */
const ARBEIT = ':arbeit';

const MELDUNG_GESTARTET = 'Dein Video wird erstellt — das dauert etwa 1–2 Minuten.';
const MELDUNG_LAEUFT = 'Dein Video wird gerade schon erstellt — das dauert etwa 1–2 Minuten.';
const MELDUNG_LAEUFT_ALT = 'Gerade entsteht noch das Video aus deinen vorherigen Angaben — deine Änderung ist darin noch nicht enthalten. Sobald es fertig ist, tippe unten auf „Video neu erzeugen“.';
const MELDUNG_UNVERAENDERT = 'Fürs Video hat sich nichts geändert (Musik und Requisiten fließen nicht ins Video ein) — es bleibt, wie es ist.';
const MELDUNG_ZEIT = 'Zeitüberschreitung — bitte neu erzeugen';

// ─── Typen (flach — @vercel/node prüft ohne strictNullChecks) ─────────────
type AufgussZeile = {
  id: string;
  title: string | null;
  description: string | null;
  oils: (string | null)[] | null;
  saunameister_id: string | null;
  start_time: string;
  end_time: string;
  is_personal_fallback: boolean | null;
};

type FestZeile = { datum: string; motto: string | null; plan_bestaetigt_at: string | null };

type InfoZeile = { thema: string | null; bildidee: string | null; oele: string[] | null };

type VideoZeile = {
  infusion_id: string;
  status: string;
  poster_pfad: string | null;
  video_pfad: string | null;
  versuche: number | null;              // alle Starts (für max_je_fest)
  versuche_aufgiesser: number | null;   // nur Starts von Nicht-Admins (für max_versuche, 0166)
  eingaben_hash: string | null;
  updated_at: string;
};

/** Gelöschter Fest-Aufguss, dessen Dateien noch weg müssen (Migration 0166). */
type NachlaufZeile = { infusion_id: string; fest_datum: string };

type AuftragZeile = {
  infusion_id: string;
  token_hash: string;
  schritt: string;
  fal_modell: string | null;
  fal_request_id: string | null;
  fal_status_url: string | null;
  fal_response_url: string | null;
  prompt_bild: string | null;
  prompt_video: string | null;
  eingaben_hash: string | null;
  gestartet_von: string | null;
  gestartet_at: string;
  aktualisiert_at: string;
};

/** Was in Prompt und eingaben_hash eingeht. */
type Angaben = {
  titel: string | null;
  beschreibung: string | null;
  thema: string | null;
  bildidee: string | null;
  oele: string[];            // lesbare Namen
  motto: string | null;
};

type FalAuftrag = { requestId: string; statusUrl: string; responseUrl: string };
type FalFehler = Error & { falStatus: number };
type Download = { bytes: Buffer; typ: string };
type Grenzen = { maxVersuche: number; maxJeFest: number };

// ─── Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = ersterWert(req.query.action);
  try {
    if (action === 'start') return await start(req, res);
    if (action === 'webhook') return await webhook(req, res);
    if (action === 'poll') return await poll(req, res);
    if (action === 'diagnose') return await diagnose(req, res);
    return res.status(400).json({ error: 'Unbekannte Aktion.' });
  } catch (e) {
    protokoll('Fehler in', action, fehlerText(e));
    // fal wiederholt jeden Nicht-2xx-Webhook — der Poll räumt ohnehin auf.
    if (action === 'webhook') return res.status(200).json({ ok: false });
    return res.status(500).json({ error: 'Da ist etwas schiefgegangen — bitte später noch einmal versuchen.' });
  }
}

// ─── start ───────────────────────────────────────────────────────────────
async function start(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt.' });

  const auth = await authenticate(req);
  if (!auth.ok) {
    const s = anmeldeStatus(auth);
    return res.status(s).json({ error: anmeldeFehler(s) });
  }
  const sb = auth.service;
  const ich = auth.member;
  const istAdmin = ich.role === 'admin';

  const body = bodyLesen(req);
  const infusionId = typeof body.infusion_id === 'string' ? body.infusion_id.trim() : '';
  // Auch Aufgießer (Knopf „Video neu erzeugen“) — gedeckelt über max_versuche, s. Kopf.
  const erzwingen = body.erzwingen === true;
  if (!istUuid(infusionId)) return res.status(400).json({ error: 'Kein gültiger Aufguss angegeben.' });

  if (!falKey()) {
    return res.status(503).json({ error: 'Die Video-Erzeugung ist noch nicht eingerichtet — bitte einem Admin Bescheid geben.' });
  }

  // Aufguss + Festtag
  const { data: infRoh, error: infErr } = await sb
    .from('infusions')
    .select('id, title, description, oils, saunameister_id, start_time, end_time, is_personal_fallback')
    .eq('id', infusionId)
    .maybeSingle();
  if (infErr) throw new Error('infusions: ' + infErr.message);
  const inf = infRoh as AufgussZeile | null;
  if (!inf) return res.status(404).json({ error: 'Diesen Aufguss gibt es nicht mehr.' });

  const datum = berlinDatum(inf.start_time);
  const { data: festRoh, error: festErr } = await sb
    .from('saunafest_tage')
    .select('datum, motto, plan_bestaetigt_at')
    .eq('datum', datum)
    .maybeSingle();
  if (festErr) throw new Error('saunafest_tage: ' + festErr.message);
  const fest = festRoh as FestZeile | null;
  if (!fest) return res.status(400).json({ error: 'Das ist kein Aufguss eines Saunafests.' });
  if (inf.is_personal_fallback) return res.status(400).json({ error: 'Für einen freien Platz gibt es kein Video.' });

  if (!istAdmin) {
    if (inf.saunameister_id !== ich.id) return res.status(403).json({ error: 'Das ist nicht dein Aufguss.' });
    if (!fest.plan_bestaetigt_at) {
      return res.status(403).json({ error: 'Der Plan ist noch nicht bestätigt — das Video gibt es erst danach.' });
    }
  }
  if (Date.parse(inf.end_time) < Date.now()) return res.status(400).json({ error: 'Dieser Aufguss ist schon vorbei.' });

  // Angaben (fehlt die Zeile noch, zählen die Öle aus infusions)
  const { data: infoRoh, error: infoErr } = await sb
    .from('saunafest_aufguss_info')
    .select('thema, bildidee, oele')
    .eq('infusion_id', inf.id)
    .maybeSingle();
  if (infoErr) throw new Error('saunafest_aufguss_info: ' + infoErr.message);
  const info = infoRoh as InfoZeile | null;
  const oelIds: (string | null)[] = info && Array.isArray(info.oele) && info.oele.length > 0
    ? info.oele
    : (Array.isArray(inf.oils) ? inf.oils : []);
  const angaben: Angaben = {
    titel: leerZuNull(inf.title),
    beschreibung: leerZuNull(inf.description),
    thema: leerZuNull(info ? info.thema : null),
    bildidee: leerZuNull(info ? info.bildidee : null),
    oele: await oelNamen(sb, oelIds),
    motto: leerZuNull(fest.motto),
  };
  const eingabenHash = sha256(stabilesJson(angaben));

  // Stand des Videos
  const { data: vidRoh, error: vidErr } = await sb
    .from('saunafest_video')
    .select('infusion_id, status, poster_pfad, video_pfad, versuche, versuche_aufgiesser, eingaben_hash, updated_at')
    .eq('infusion_id', inf.id)
    .maybeSingle();
  if (vidErr) throw new Error('saunafest_video: ' + vidErr.message);
  const vid = vidRoh as VideoZeile | null;
  if (vid && (vid.status === 'bild' || vid.status === 'video') && Date.now() - Date.parse(vid.updated_at) < LAEUFT_MAX_MS) {
    // Entsteht das laufende Video aus anderen Angaben als den gerade
    // gespeicherten? Dann ehrlich sagen, dass die Änderung fehlt (sonst hält
    // der Aufgießer das fertige Video für aktuell). Lesefehler → Meldung wie
    // bisher, veraltet bleibt offen (der Dialog warnt dann vorsichtshalber).
    const { data: laufRoh, error: laufErr } = await sb
      .from('saunafest_video_auftrag')
      .select('eingaben_hash')
      .eq('infusion_id', inf.id)
      .maybeSingle();
    if (laufErr) {
      protokoll('Auftrag nicht lesbar', inf.id, laufErr.message);
      return res.status(200).json({ status: 'laeuft', meldung: MELDUNG_LAEUFT });
    }
    const laufHash = (laufRoh as { eingaben_hash: string | null } | null)?.eingaben_hash ?? null;
    if (laufHash === null) return res.status(200).json({ status: 'laeuft', meldung: MELDUNG_LAEUFT });
    const veraltet = laufHash !== eingabenHash;
    return res.status(200).json({ status: 'laeuft', veraltet, meldung: veraltet ? MELDUNG_LAEUFT_ALT : MELDUNG_LAEUFT });
  }
  if (vid && vid.status === 'fertig' && vid.eingaben_hash === eingabenHash && !erzwingen) {
    return res.status(200).json({ status: 'unveraendert', meldung: MELDUNG_UNVERAENDERT });
  }

  // Kostenbremse: max_versuche zählt nur die Starts des Aufgießers (Admin-Läufe
  // verbrauchen sein Kontingent nicht), max_je_fest alle Starts.
  const grenzen = await grenzenLesen(sb);
  const bisher = vid && typeof vid.versuche === 'number' ? vid.versuche : 0;
  const bisherAufg = vid && typeof vid.versuche_aufgiesser === 'number' ? vid.versuche_aufgiesser : 0;
  if (!istAdmin && bisherAufg >= grenzen.maxVersuche) {
    return res.status(200).json({
      status: 'gesperrt',
      meldung: `Du hast das Video schon ${bisherAufg}-mal erzeugen lassen — mehr geht nicht. Soll es trotzdem ein neues sein, frag bitte einen Admin.`,
    });
  }
  const amFest = await versucheAmFesttag(sb, datum);
  if (amFest >= grenzen.maxJeFest) {
    return res.status(200).json({
      status: 'gesperrt',
      meldung: 'Für dieses Saunafest ist die Obergrenze an erzeugten Videos erreicht. Bitte sprich mit einem Admin.',
    });
  }

  // Anspruch: nur ein Start gewinnt (versuche + status als Sperre).
  const jetztIso = jetzt();
  if (vid) {
    const { data: geholt, error } = await sb
      .from('saunafest_video')
      .update({
        status: 'bild',
        versuche: bisher + 1,
        ...(istAdmin ? {} : { versuche_aufgiesser: bisherAufg + 1 }),
        fehler: null,
        updated_at: jetztIso,
      })
      .eq('infusion_id', inf.id)
      .eq('status', vid.status)
      .eq('versuche', bisher)
      .select('infusion_id');
    if (error) throw new Error('saunafest_video update: ' + error.message);
    if (!geholt || geholt.length === 0) return res.status(200).json({ status: 'laeuft', meldung: MELDUNG_LAEUFT });
  } else {
    const { error } = await sb
      .from('saunafest_video')
      .insert({
        infusion_id: inf.id,
        status: 'bild',
        versuche: 1,
        versuche_aufgiesser: istAdmin ? 0 : 1,
        fehler: null,
        updated_at: jetztIso,
      });
    if (error) {
      if (error.code === '23505') return res.status(200).json({ status: 'laeuft', meldung: MELDUNG_LAEUFT });
      throw new Error('saunafest_video insert: ' + error.message);
    }
  }

  // Auftrag anlegen + Bild bei fal einreichen. Bis die fal-Antwort da ist,
  // steht ein Platzhalter-Hash im Auftrag: ein (theoretisch) früher Webhook
  // bekommt 401 und fal stellt ihn später erneut zu — statt „ignoriert".
  const token = randomBytes(32).toString('hex');
  const platzhalterHash = sha256(randomBytes(32).toString('hex'));
  const promptBild = bildPrompt(angaben, inf.start_time, datum);
  let eingereicht = false;
  try {
    const { error: aufErr } = await sb.from('saunafest_video_auftrag').upsert({
      infusion_id: inf.id,
      token_hash: platzhalterHash,
      schritt: 'bild',
      fal_modell: MODELL_BILD,
      fal_request_id: null,
      fal_status_url: null,
      fal_response_url: null,
      prompt_bild: promptBild,
      prompt_video: videoPrompt(angaben),
      eingaben_hash: eingabenHash,
      gestartet_von: ich.id,
      gestartet_at: jetztIso,
      aktualisiert_at: jetztIso,
    }, { onConflict: 'infusion_id' });
    if (aufErr) throw new Error('saunafest_video_auftrag upsert: ' + aufErr.message);

    const fal = await falEinreichen(
      MODELL_BILD,
      { prompt: promptBild, num_images: 1, aspect_ratio: '21:9', output_format: 'jpeg' },
      webhookUrl(inf.id, token),
    );
    eingereicht = true;

    const { data: gesetzt, error: idErr } = await sb
      .from('saunafest_video_auftrag')
      .update({
        token_hash: sha256(token),
        fal_request_id: fal.requestId,
        fal_status_url: fal.statusUrl,
        fal_response_url: fal.responseUrl,
        aktualisiert_at: jetzt(),
      })
      .eq('infusion_id', inf.id)
      .eq('token_hash', platzhalterHash)
      .select('infusion_id');
    if (idErr) throw new Error('saunafest_video_auftrag update: ' + idErr.message);
    if (!gesetzt || gesetzt.length === 0) throw new Error('Auftrag wurde inzwischen neu gestartet');
  } catch (e) {
    const falStatus = falStatusVon(e);
    // Zurückzählen nur, wenn sicher nichts bei fal läuft: Fehler vor dem
    // Einreichen oder fal hat mit einem HTTP-Fehler abgelehnt (falStatus > 0).
    // Netz-/Zeitfehler beim Einreichen (0) könnten trotzdem Kosten verursacht haben.
    const erstatten = !eingereicht && falStatus !== 0;
    const meldung = falStatus !== null
      ? falMeldung('bild', fehlerText(e), falStatus)
      : 'Das Video konnte nicht gestartet werden — bitte später noch einmal versuchen.';
    protokoll('start fehlgeschlagen', inf.id, fehlerText(e));
    const felder: Record<string, unknown> = { status: 'fehler', fehler: meldung, updated_at: jetzt() };
    if (erstatten) {
      felder.versuche = bisher;
      if (!istAdmin) felder.versuche_aufgiesser = bisherAufg;
    }
    const { error: fErr } = await sb.from('saunafest_video').update(felder).eq('infusion_id', inf.id);
    if (fErr) protokoll('Fehlerstand nicht gespeichert', inf.id, fErr.message);
    return res.status(200).json({ status: 'fehler', meldung });
  }

  return res.status(200).json({ status: 'gestartet', meldung: MELDUNG_GESTARTET });
}

// ─── webhook ─────────────────────────────────────────────────────────────
async function webhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const infusionId = ersterWert(req.query.inf);
  const token = ersterWert(req.query.t);
  if (!istUuid(infusionId) || !/^[0-9a-f]{64}$/.test(token)) {
    return res.status(401).json({ error: 'nicht berechtigt' });
  }

  const sb = serviceClient();
  if (!sb) {
    protokoll('webhook: Supabase-Env fehlt');
    return res.status(200).json({ ok: false });
  }

  const { data: aRoh, error } = await sb
    .from('saunafest_video_auftrag')
    .select('*')
    .eq('infusion_id', infusionId)
    .maybeSingle();
  if (error) {
    protokoll('webhook: Auftrag nicht lesbar', infusionId, error.message);
    return res.status(200).json({ ok: false });   // der Poll holt das Ergebnis später
  }
  const a = aRoh as AuftragZeile | null;
  // Kein Auftrag = Aufguss gelöscht (start() legt ihn vor dem Einreichen an,
  // ON DELETE CASCADE nimmt ihn mit). 200, damit fal nicht endlos neu zustellt.
  if (!a) return res.status(200).json({ ok: true, ignoriert: true });
  if (!tokenPasst(token, a.token_hash)) return res.status(401).json({ error: 'nicht berechtigt' });

  const body = bodyLesen(req);
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  if (!requestId || requestId !== a.fal_request_id) return res.status(200).json({ ok: true, ignoriert: true });

  // Zustellungen kommen doppelt: nur wer den Auftrag beansprucht, arbeitet.
  const beansprucht = await beanspruchen(sb, a.infusion_id, requestId);
  if (!beansprucht) return res.status(200).json({ ok: true, ignoriert: true });

  const falFehlerRoh = body.status === 'ERROR' ? webhookFehlerText(body) : null;
  const ergebnis = await schrittAbschliessen(sb, beansprucht, falFehlerRoh);
  return res.status(200).json({ ok: true, ergebnis });
}

// ─── poll (Sicherheitsnetz, ohne Eingaben) ───────────────────────────────
async function poll(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET oder POST' });
  const sb = serviceClient();
  if (!sb) return res.status(500).json({ error: 'env missing' });

  const t0 = Date.now();
  // Zuerst aufräumen — sonst liefe es nie, wenn gerade kein Auftrag offen ist.
  const aufgeraeumt = await nachlaufAufraeumen(sb);

  const { data: vidsRoh, error: vErr } = await sb
    .from('saunafest_video')
    .select('infusion_id, updated_at')
    .in('status', ['bild', 'video'])
    .order('updated_at', { ascending: true })
    .limit(50);
  if (vErr) throw new Error('saunafest_video: ' + vErr.message);
  const offen = (vidsRoh ?? []) as { infusion_id: string; updated_at: string }[];
  if (offen.length === 0) return res.status(200).json({ ok: true, geprueft: 0, aufgeraeumt });

  const ids = offen.map((v) => v.infusion_id);
  const { data: aufRoh, error: aErr } = await sb
    .from('saunafest_video_auftrag')
    .select('*')
    .in('infusion_id', ids);
  if (aErr) throw new Error('saunafest_video_auftrag: ' + aErr.message);
  const auftraege = (aufRoh ?? []) as AuftragZeile[];
  const mitAuftrag = auftraege.map((a) => a.infusion_id);
  const ergebnisse: string[] = [];

  // In Arbeit, aber ohne Auftrag (Abbruch zwischen Anspruch und Auftrag).
  const zeitGrenze = new Date(Date.now() - SCHRITT_MAX_MS).toISOString();
  for (const v of offen) {
    if (mitAuftrag.indexOf(v.infusion_id) >= 0) continue;
    if (Date.parse(v.updated_at) >= Date.now() - SCHRITT_MAX_MS) continue;
    const { error: uErr } = await sb
      .from('saunafest_video')
      .update({ status: 'fehler', fehler: MELDUNG_ZEIT, updated_at: jetzt() })
      .eq('infusion_id', v.infusion_id)
      .in('status', ['bild', 'video'])
      .lt('updated_at', zeitGrenze);
    if (uErr) protokoll('poll: Fehlerstand nicht gespeichert', v.infusion_id, uErr.message);
    ergebnisse.push('ohne_auftrag');
  }

  const stillSeit = Date.now() - POLL_AB_MS;
  const kandidaten = auftraege
    .filter((a) => Date.parse(a.aktualisiert_at) < stillSeit)
    .sort((x, y) => Date.parse(x.aktualisiert_at) - Date.parse(y.aktualisiert_at))
    .slice(0, POLL_MAX_AUFTRAEGE);

  for (const a of kandidaten) {
    if (Date.now() - t0 > POLL_ZEITBUDGET_MS) break;
    try {
      ergebnisse.push(await pollEiner(sb, a));
    } catch (e) {
      protokoll('poll: Auftrag fehlgeschlagen', a.infusion_id, fehlerText(e));
      ergebnisse.push('fehler');
    }
  }
  return res.status(200).json({ ok: true, geprueft: kandidaten.length, ergebnisse, aufgeraeumt });
}

/** Dateien gelöschter Fest-Aufgüsse entfernen (saunafest_austeilen & Co. löschen
 *  die Aufgusszeile; ON DELETE CASCADE nimmt saunafest_video mit, die Dateien
 *  im Bucket blieben sonst verwaist und öffentlich lesbar). Die Zeile bleibt —
 *  nur markiert —, weil ihre Versuche weiter für max_je_fest zählen.
 *  Wirft nie; fehlt die Tabelle (0166 noch nicht eingespielt), passiert nichts. */
async function nachlaufAufraeumen(sb: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await sb
      .from('saunafest_video_nachlauf')
      .select('infusion_id, fest_datum')
      .is('aufgeraeumt_at', null)
      .order('erfasst_at', { ascending: true })
      .limit(POLL_MAX_NACHLAUF);
    if (error) {
      protokoll('poll: Nachlauf nicht lesbar', error.message);
      return 0;
    }
    let n = 0;
    for (const z of (data ?? []) as NachlaufZeile[]) {
      if (!istUuid(z.infusion_id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(z.fest_datum))) continue;
      await alteDateienWeg(sb, `${ORDNER}/${z.fest_datum}`, z.infusion_id, [], null);
      const { error: uErr } = await sb
        .from('saunafest_video_nachlauf')
        .update({ aufgeraeumt_at: jetzt() })
        .eq('infusion_id', z.infusion_id);
      if (uErr) protokoll('poll: Nachlauf nicht markiert', z.infusion_id, uErr.message);
      else n++;
    }
    return n;
  } catch (e) {
    protokoll('poll: Aufräumen fehlgeschlagen', fehlerText(e));
    return 0;
  }
}

async function pollEiner(sb: SupabaseClient, a: AuftragZeile): Promise<string> {
  const alter = Date.now() - Date.parse(a.aktualisiert_at);
  const rid = a.fal_request_id;

  if (rid && rid.endsWith(ARBEIT)) {
    if (alter <= ARBEIT_MAX_MS) return 'in_arbeit';
    await fehlerSetzen(sb, a.infusion_id, rid, 'Die Verarbeitung ist abgebrochen — bitte neu erzeugen.');
    return 'abgebrochen';
  }
  if (!rid || !a.fal_status_url) {
    if (alter <= SCHRITT_MAX_MS) return 'wartet';
    await fehlerSetzen(sb, a.infusion_id, rid, MELDUNG_ZEIT);
    return 'zeitueberschreitung';
  }

  let status = '';
  let falFehlerRoh: string | null = null;
  try {
    const j = await falGet(a.fal_status_url);
    status = typeof j.status === 'string' ? j.status : '';
    falFehlerRoh = typeof j.error === 'string' && j.error ? j.error : null;
  } catch (e) {
    protokoll('poll: Status nicht lesbar', a.infusion_id, fehlerText(e));
    if (alter <= SCHRITT_MAX_MS) return 'status_unbekannt';
    await fehlerSetzen(sb, a.infusion_id, rid, MELDUNG_ZEIT);
    return 'zeitueberschreitung';
  }

  if (status === 'COMPLETED') {
    const beansprucht = await beanspruchen(sb, a.infusion_id, rid);
    if (!beansprucht) return 'vergeben';
    return await schrittAbschliessen(sb, beansprucht, falFehlerRoh);
  }
  if (alter > SCHRITT_MAX_MS) {
    await fehlerSetzen(sb, a.infusion_id, rid, MELDUNG_ZEIT);
    return 'zeitueberschreitung';
  }
  return 'laeuft';
}

// ─── diagnose ────────────────────────────────────────────────────────────
async function diagnose(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Nur GET erlaubt.' });
  const auth = await authenticate(req);
  if (!auth.ok) {
    const s = anmeldeStatus(auth);
    return res.status(s).json({ error: anmeldeFehler(s) });
  }
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins.' });
  return res.status(200).json({ falKey: falKey().length > 20, publicAppUrl: appBasis() });
}

// ─── Abschluss eines fal-Schritts (Webhook und Poll) ─────────────────────
/** `a` ist bereits beansprucht (fal_request_id endet auf ':arbeit').
 *  Wirft nie — jeder Fehler landet als deutscher Text in saunafest_video. */
async function schrittAbschliessen(sb: SupabaseClient, a: AuftragZeile, falFehlerRoh: string | null): Promise<string> {
  const anspruch = a.fal_request_id;
  const schritt = a.schritt === 'video' ? 'video' : 'bild';

  if (falFehlerRoh !== null) {
    protokoll('fal meldet Fehler', a.infusion_id, schritt, falFehlerRoh);
    await fehlerSetzen(sb, a.infusion_id, anspruch, falMeldung(schritt, falFehlerRoh, 0));
    return 'fehler';
  }

  let hochgeladen: string | null = null;   // gehört noch keinem Datensatz → bei Fehler löschen
  try {
    const { data: infRoh, error: infErr } = await sb
      .from('infusions')
      .select('id, saunameister_id, start_time')
      .eq('id', a.infusion_id)
      .maybeSingle();
    if (infErr) throw new Error('infusions: ' + infErr.message);
    const inf = infRoh as { id: string; saunameister_id: string | null; start_time: string } | null;
    if (!inf) throw new Error('Aufguss nicht gefunden');
    const ordner = `${ORDNER}/${berlinDatum(inf.start_time)}`;

    const ergebnis = await falGet(a.fal_response_url);

    if (schritt === 'bild') {
      const bildUrl = bildUrlAus(ergebnis);
      if (!bildUrl) throw falFehler('fal lieferte kein Bild', 0);
      const datei = await ladeBegrenzt(bildUrl, BILD_MAX_BYTES);
      const typ = bildTyp(datei);
      if (!typ) throw falFehler('Ergebnis ist kein Bild (' + datei.typ + ')', 0);
      const pfad = `${ordner}/${a.infusion_id}-${Date.now()}.${endung(typ)}`;
      await hochladen(sb, pfad, datei.bytes, typ);
      hochgeladen = pfad;

      // Standbild steht — Video mit neuem Token einreichen (Start- = Endbild → Loop).
      const token = randomBytes(32).toString('hex');
      let fal: FalAuftrag | null = null;
      let einreichFehler: unknown = null;
      try {
        fal = await falEinreichen(MODELL_VIDEO, {
          prompt: a.prompt_video || videoPrompt(null),
          image_url: bildUrl,
          end_image_url: bildUrl,
          duration: 5,
          resolution: '480P',
          prompt_expansion_mode: 'disabled',
        }, webhookUrl(a.infusion_id, token));
      } catch (e) {
        einreichFehler = e;
      }
      if (!fal) {
        protokoll('Video nicht eingereicht', a.infusion_id, fehlerText(einreichFehler));
        // Guthaben/Zugang als solche melden, sonst: Standbild da, Video fehlt.
        const s = falStatusVon(einreichFehler);
        const falText = s !== null && s > 0 ? falMeldung('video', fehlerText(einreichFehler), s) : '';
        const meldung = falText.indexOf('fal.ai') >= 0
          ? falText
          : 'Das Standbild ist fertig, aber das Video ließ sich nicht starten — bitte neu erzeugen.';
        if (await auftragSetzen(sb, a.infusion_id, anspruch, { fal_request_id: null, aktualisiert_at: jetzt() })) {
          hochgeladen = null;   // das Standbild bleibt als Poster stehen
          await videoSetzen(sb, a.infusion_id, { poster_pfad: pfad, status: 'fehler', fehler: meldung });
        } else {
          await dateienLoeschen(sb, [pfad]);
        }
        return 'fehler';
      }

      const uebernommen = await auftragSetzen(sb, a.infusion_id, anspruch, {
        schritt: 'video',
        fal_modell: MODELL_VIDEO,
        fal_request_id: fal.requestId,
        fal_status_url: fal.statusUrl,
        fal_response_url: fal.responseUrl,
        token_hash: sha256(token),
        aktualisiert_at: jetzt(),
      });
      if (!uebernommen) {
        protokoll('Auftrag inzwischen neu gestartet — Standbild verworfen', a.infusion_id);
        await dateienLoeschen(sb, [pfad]);
        return 'vergeben';
      }
      hochgeladen = null;
      await videoSetzen(sb, a.infusion_id, { poster_pfad: pfad, status: 'video', fehler: null });
      return 'bild_fertig';
    }

    // Schritt video
    const videoUrl = videoUrlAus(ergebnis);
    if (!videoUrl) throw falFehler('fal lieferte kein Video', 0);
    const datei = await ladeBegrenzt(videoUrl, VIDEO_MAX_BYTES);
    if (!istMp4(datei)) throw falFehler('Ergebnis ist kein MP4 (' + datei.typ + ')', 0);
    const pfad = `${ordner}/${a.infusion_id}-${Date.now()}.mp4`;
    await hochladen(sb, pfad, datei.bytes, 'video/mp4');
    hochgeladen = pfad;

    const { data: altRoh } = await sb
      .from('saunafest_video')
      .select('poster_pfad, video_pfad')
      .eq('infusion_id', a.infusion_id)
      .maybeSingle();
    const alt = altRoh as { poster_pfad: string | null; video_pfad: string | null } | null;

    if (!(await auftragSetzen(sb, a.infusion_id, anspruch, { fal_request_id: null, aktualisiert_at: jetzt() }))) {
      protokoll('Auftrag inzwischen neu gestartet — Video verworfen', a.infusion_id);
      await dateienLoeschen(sb, [pfad]);
      return 'vergeben';
    }
    hochgeladen = null;
    await videoSetzen(sb, a.infusion_id, {
      video_pfad: pfad,
      status: 'fertig',
      fehler: null,
      erzeugt_at: jetzt(),
      eingaben_hash: a.eingaben_hash,
    });

    await alteDateienWeg(sb, ordner, a.infusion_id, [pfad, alt && alt.poster_pfad ? alt.poster_pfad : ''], alt ? alt.video_pfad : null);
    await benachrichtigen(sb, inf.saunameister_id, a.infusion_id);
    return 'fertig';
  } catch (e) {
    protokoll('Abschluss fehlgeschlagen', a.infusion_id, schritt, fehlerText(e));
    if (hochgeladen) await dateienLoeschen(sb, [hochgeladen]);
    await fehlerSetzen(sb, a.infusion_id, anspruch, meldungFuer(schritt, e));
    return 'fehler';
  }
}

// ─── Datenbank-Helfer ────────────────────────────────────────────────────
/** Auftrag beanspruchen: fal_request_id X → X + ':arbeit'. Nur einer gewinnt. */
async function beanspruchen(sb: SupabaseClient, infusionId: string, requestId: string): Promise<AuftragZeile | null> {
  const { data, error } = await sb
    .from('saunafest_video_auftrag')
    .update({ fal_request_id: requestId + ARBEIT, aktualisiert_at: jetzt() })
    .eq('infusion_id', infusionId)
    .eq('fal_request_id', requestId)
    .select('*');
  if (error) throw new Error('beanspruchen: ' + error.message);
  const zeilen = (data ?? []) as AuftragZeile[];
  return zeilen.length > 0 ? zeilen[0] : null;
}

/** Auftrag ändern — nur, wenn fal_request_id noch dem erwarteten Wert
 *  entspricht (sonst hat inzwischen ein neuer Start übernommen). */
async function auftragSetzen(
  sb: SupabaseClient,
  infusionId: string,
  erwartet: string | null,
  felder: Record<string, unknown>,
): Promise<boolean> {
  let q = sb.from('saunafest_video_auftrag').update(felder).eq('infusion_id', infusionId);
  q = erwartet === null ? q.is('fal_request_id', null) : q.eq('fal_request_id', erwartet);
  const { data, error } = await q.select('infusion_id');
  if (error) throw new Error('saunafest_video_auftrag update: ' + error.message);
  return (data ?? []).length > 0;
}

async function videoSetzen(sb: SupabaseClient, infusionId: string, felder: Record<string, unknown>): Promise<void> {
  const { error } = await sb
    .from('saunafest_video')
    .update({ ...felder, updated_at: jetzt() })
    .eq('infusion_id', infusionId);
  if (error) throw new Error('saunafest_video update: ' + error.message);
}

/** Fehlerstand setzen (Auftrag freigeben + Text fürs UI). Wirft nie. */
async function fehlerSetzen(sb: SupabaseClient, infusionId: string, anspruch: string | null, meldung: string): Promise<void> {
  try {
    if (await auftragSetzen(sb, infusionId, anspruch, { fal_request_id: null, aktualisiert_at: jetzt() })) {
      await videoSetzen(sb, infusionId, { status: 'fehler', fehler: meldung });
    }
  } catch (e) {
    protokoll('Fehlerstand nicht gespeichert', infusionId, fehlerText(e));
  }
}

async function grenzenLesen(sb: SupabaseClient): Promise<Grenzen> {
  const { data, error } = await sb.from('system_config').select('value').eq('key', 'saunafest_video').maybeSingle();
  if (error) protokoll('system_config nicht lesbar', error.message);
  const zeile = data as { value?: unknown } | null;
  const wert = (zeile && zeile.value && typeof zeile.value === 'object' ? zeile.value : {}) as Record<string, unknown>;
  return {
    maxVersuche: ganzzahl(wert.max_versuche, VORGABE_MAX_VERSUCHE),
    maxJeFest: ganzzahl(wert.max_je_fest, VORGABE_MAX_JE_FEST),
  };
}

/** Summe der Versuche aller Aufgüsse dieses Festtags (Berlin-Datum), Admin-
 *  Läufe eingeschlossen. Auch gelöschte Aufgüsse (Einteilung aufgehoben)
 *  zählen mit — ihre Versuche merkt sich saunafest_video_nachlauf (0166),
 *  bezahlt ist bezahlt. */
async function versucheAmFesttag(sb: SupabaseClient, datum: string): Promise<number> {
  return (await versucheBestehend(sb, datum)) + (await versucheGeloescht(sb, datum));
}

/** Versuche gelöschter Aufgüsse dieses Festtags. Ist die Tabelle (noch) nicht
 *  lesbar, zählt nur der Bestand — die Notbremse soll nicht alle Starts sperren. */
async function versucheGeloescht(sb: SupabaseClient, datum: string): Promise<number> {
  const { data, error } = await sb
    .from('saunafest_video_nachlauf')
    .select('versuche')
    .eq('fest_datum', datum);
  if (error) {
    protokoll('saunafest_video_nachlauf nicht lesbar', error.message);
    return 0;
  }
  return ((data ?? []) as { versuche: number | null }[])
    .reduce((summe, z) => summe + (typeof z.versuche === 'number' ? z.versuche : 0), 0);
}

async function versucheBestehend(sb: SupabaseClient, datum: string): Promise<number> {
  // Großzügiges UTC-Fenster um den Tag (Sommer-/Winterzeit egal), genau
  // gefiltert wird danach über das Berlin-Datum.
  const mitte = Date.parse(`${datum}T12:00:00Z`);
  const { data: infs, error: iErr } = await sb
    .from('infusions')
    .select('id, start_time')
    .gte('start_time', new Date(mitte - 36 * 3_600_000).toISOString())
    .lt('start_time', new Date(mitte + 36 * 3_600_000).toISOString());
  if (iErr) throw new Error('infusions: ' + iErr.message);
  const amTag = ((infs ?? []) as { id: string; start_time: string }[])
    .filter((i) => berlinDatum(i.start_time) === datum)
    .map((i) => i.id);
  if (amTag.length === 0) return 0;
  const { data: vids, error } = await sb
    .from('saunafest_video')
    .select('versuche')
    .in('infusion_id', amTag);
  if (error) throw new Error('saunafest_video: ' + error.message);
  return ((vids ?? []) as { versuche: number | null }[])
    .reduce((summe, z) => summe + (typeof z.versuche === 'number' ? z.versuche : 0), 0);
}

/** Öl-IDs → lesbare Namen: Regal-Slug „orange-suess" → „orange suess",
 *  eigene Öle 'custom:<uuid>' über member_custom_oils.name. */
async function oelNamen(sb: SupabaseClient, ids: (string | null)[]): Promise<string[]> {
  const roh = ids
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  const customIds = roh
    .filter((o) => o.startsWith('custom:'))
    .map((o) => o.slice(7))
    .filter(istUuid);
  const eigene: Record<string, string> = {};
  if (customIds.length > 0) {
    const { data, error } = await sb.from('member_custom_oils').select('id, name').in('id', customIds);
    if (error) protokoll('member_custom_oils nicht lesbar', error.message);
    for (const z of (data ?? []) as { id: string; name: string | null }[]) {
      if (z.name && z.name.trim()) eigene[z.id] = z.name.trim();
    }
  }
  const namen: string[] = [];
  for (const o of roh) {
    const name = o.startsWith('custom:')
      ? (eigene[o.slice(7)] ?? '')
      : o.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (name && namen.indexOf(name) < 0) namen.push(name);
  }
  return namen.slice(0, 40);
}

async function benachrichtigen(sb: SupabaseClient, meisterId: string | null, infusionId: string): Promise<void> {
  if (!meisterId) return;
  const { error } = await sb.from('notification_queue').insert({
    kind: 'saunafest_video',
    recipient_id: meisterId,
    payload: {
      title: '🎬 Dein Saunafest-Video ist fertig',
      body: 'Schau es dir im Planer an — es läuft am Festtag hinter deinem Schild auf der Tafel.',
      url: '/planner#saunafest',
    },
    dedup_key: `saunafest_video:${infusionId}:${Date.now()}`,
  });
  if (error) protokoll('Nachricht nicht eingetragen', infusionId, error.message);
}

// ─── Storage ─────────────────────────────────────────────────────────────
async function hochladen(sb: SupabaseClient, pfad: string, bytes: Buffer, typ: string): Promise<void> {
  const { error } = await sb.storage.from(BUCKET).upload(pfad, bytes, {
    contentType: typ,
    cacheControl: '31536000',   // eindeutiger Name → die Tafel lädt die Schleife nur einmal
    upsert: false,
  });
  if (error) throw new Error('Storage-Upload: ' + error.message);
}

/** Löscht nur unter saunafest-videos/. Wirft nie. */
async function dateienLoeschen(sb: SupabaseClient, pfade: string[]): Promise<void> {
  const erlaubt = pfade.filter((p) => typeof p === 'string' && p.startsWith(ORDNER + '/'));
  if (erlaubt.length === 0) return;
  try {
    const { error } = await sb.storage.from(BUCKET).remove(erlaubt);
    if (error) protokoll('Storage-Löschen fehlgeschlagen', error.message);
  } catch (e) {
    protokoll('Storage-Löschen fehlgeschlagen', fehlerText(e));
  }
}

/** Frühere Standbilder/Videos dieses Aufgusses entfernen (auch verwaiste aus
 *  abgebrochenen Läufen). Behalten wird, was jetzt im Datensatz steht. */
async function alteDateienWeg(
  sb: SupabaseClient,
  ordner: string,
  infusionId: string,
  behalten: string[],
  altesVideo: string | null,
): Promise<void> {
  const kandidaten: string[] = [];
  try {
    const { data, error } = await sb.storage.from(BUCKET).list(ordner, { limit: 100, search: infusionId });
    if (error) protokoll('Storage-Liste fehlgeschlagen', error.message);
    for (const f of data ?? []) {
      if (f && typeof f.name === 'string' && f.name.startsWith(infusionId + '-')) kandidaten.push(`${ordner}/${f.name}`);
    }
  } catch (e) {
    protokoll('Storage-Liste fehlgeschlagen', fehlerText(e));
  }
  if (altesVideo && kandidaten.indexOf(altesVideo) < 0) kandidaten.push(altesVideo);
  const weg = kandidaten.filter((p) => behalten.indexOf(p) < 0 && p.indexOf(infusionId) >= 0);
  await dateienLoeschen(sb, weg);
}

// ─── fal.ai ──────────────────────────────────────────────────────────────
function falKey(): string {
  // Env-Werte gehen gern still kaputt (BOM aus PowerShell, Zeilenumbruch).
  return (process.env.FAL_KEY ?? '').replace(/^﻿/, '').trim();
}

function falFehler(meldung: string, status: number): FalFehler {
  const e = new Error(meldung) as FalFehler;
  e.falStatus = status;
  return e;
}

/** HTTP-Status eines fal-Fehlers (0 = Netz/Zeit/Format), null = kein fal-Fehler. */
function falStatusVon(e: unknown): number | null {
  if (!e || typeof e !== 'object') return null;
  const s = (e as { falStatus?: unknown }).falStatus;
  return typeof s === 'number' ? s : null;
}

/** Nur an fal-Adressen darf der Schlüssel gehen. */
function istFalUrl(u: string | null): boolean {
  if (!u) return false;
  try {
    const x = new URL(u);
    const h = x.hostname.toLowerCase();
    return x.protocol === 'https:' && (h === 'fal.run' || h.endsWith('.fal.run') || h === 'fal.ai' || h.endsWith('.fal.ai'));
  } catch {
    return false;
  }
}

async function falEinreichen(modell: string, eingabe: Record<string, unknown>, webhook: string): Promise<FalAuftrag> {
  const key = falKey();
  if (!key) throw falFehler('FAL_KEY fehlt', 401);
  const r = await fetch(`${FAL_QUEUE}${modell}?fal_webhook=${encodeURIComponent(webhook)}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eingabe),
    signal: AbortSignal.timeout(15_000),
  }).catch((e: unknown) => {
    throw falFehler('fal nicht erreichbar: ' + fehlerText(e), 0);
  });
  const text = await r.text().catch(() => '');
  if (!r.ok) throw falFehler(`fal ${r.status}: ${text.slice(0, 300)}`, r.status);
  let j: Record<string, unknown> = {};
  try {
    const roh: unknown = JSON.parse(text);
    if (roh && typeof roh === 'object') j = roh as Record<string, unknown>;
  } catch {
    // unten als unvollständig gemeldet
  }
  const requestId = typeof j.request_id === 'string' ? j.request_id : '';
  const statusUrl = typeof j.status_url === 'string' ? j.status_url : '';
  const responseUrl = typeof j.response_url === 'string' ? j.response_url : '';
  if (!requestId || !istFalUrl(statusUrl) || !istFalUrl(responseUrl)) {
    throw falFehler('fal-Antwort unvollständig', 0);
  }
  return { requestId, statusUrl, responseUrl };
}

async function falGet(url: string | null): Promise<Record<string, unknown>> {
  if (!url || !istFalUrl(url)) throw falFehler('ungültige fal-Adresse', 0);
  const key = falKey();
  if (!key) throw falFehler('FAL_KEY fehlt', 401);
  const r = await fetch(url, {
    headers: { Authorization: `Key ${key}` },
    signal: AbortSignal.timeout(10_000),
  }).catch((e: unknown) => {
    throw falFehler('fal nicht erreichbar: ' + fehlerText(e), 0);
  });
  const text = await r.text().catch(() => '');
  if (!r.ok) throw falFehler(`fal ${r.status}: ${text.slice(0, 300)}`, r.status);
  try {
    const roh: unknown = JSON.parse(text);
    return roh && typeof roh === 'object' ? (roh as Record<string, unknown>) : {};
  } catch {
    throw falFehler('fal-Antwort ist kein JSON', 0);
  }
}

function bildUrlAus(j: Record<string, unknown>): string | null {
  const bilder = j.images;
  if (!Array.isArray(bilder) || bilder.length === 0) return null;
  const erstes = bilder[0] as { url?: unknown } | null;
  const url = erstes && typeof erstes.url === 'string' ? erstes.url : '';
  return /^https:\/\//i.test(url) ? url : null;
}

function videoUrlAus(j: Record<string, unknown>): string | null {
  const video = j.video as { url?: unknown } | null | undefined;
  const url = video && typeof video.url === 'string' ? video.url : '';
  return /^https:\/\//i.test(url) ? url : null;
}

/** Ergebnisdatei von fal laden — mit harter Größengrenze (auch ohne Content-Length). */
async function ladeBegrenzt(url: string, maxBytes: number): Promise<Download> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch((e: unknown) => {
    throw falFehler('Download fehlgeschlagen: ' + fehlerText(e), 0);
  });
  if (!r.ok || !r.body) throw falFehler(`Download ${r.status}`, 0);
  const laenge = Number(r.headers.get('content-length') || '0');
  if (laenge > maxBytes) throw falFehler(`Datei zu groß (${laenge} Bytes)`, 0);
  const leser = r.body.getReader();
  const teile: Uint8Array[] = [];
  let summe = 0;
  for (;;) {
    const stueck = await leser.read();
    if (stueck.done) break;
    const wert = stueck.value as Uint8Array;
    summe += wert.byteLength;
    if (summe > maxBytes) {
      await leser.cancel().catch(() => undefined);
      throw falFehler('Datei zu groß', 0);
    }
    teile.push(wert);
  }
  if (summe < 1024) throw falFehler('Datei leer oder zu klein', 0);
  return { bytes: Buffer.concat(teile), typ: (r.headers.get('content-type') || '').toLowerCase() };
}

const ERLAUBTE_BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp'];

/** Bildtyp aus der Dateisignatur; der Content-Type-Header zählt nur als
 *  Rückfall und nur für diese drei Typen — kein SVG (Skript) o. Ä. im
 *  öffentlichen Bucket. */
function bildTyp(d: Download): string | null {
  const b = d.bytes;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  const kopf = d.typ.split(';')[0].trim();
  return ERLAUBTE_BILDTYPEN.indexOf(kopf) >= 0 ? kopf : null;
}

function istMp4(d: Download): boolean {
  if (d.typ.startsWith('video/mp4')) return true;
  return d.bytes.length > 12 && d.bytes.toString('ascii', 4, 8) === 'ftyp';
}

function endung(typ: string): string {
  if (typ === 'image/png') return 'png';
  if (typ === 'image/webp') return 'webp';
  return 'jpg';
}

function webhookUrl(infusionId: string, token: string): string {
  return `${appBasis()}/api/saunafest-video?action=webhook&inf=${infusionId}&t=${token}`;
}

function appBasis(): string {
  const roh = (process.env.PUBLIC_APP_URL || APP_URL_VORGABE).replace(/^﻿/, '').trim().replace(/\/+$/, '');
  // fal folgt keiner Weiterleitung (http → https wäre ein endgültiger Fehler).
  return /^https:\/\/[^/\s]+/i.test(roh) ? roh : APP_URL_VORGABE;
}

function webhookFehlerText(body: Record<string, unknown>): string {
  const fehler = typeof body.error === 'string' ? body.error : 'ERROR';
  const nutzlast = body.payload as { detail?: unknown } | null | undefined;
  let detail = '';
  if (nutzlast && typeof nutzlast === 'object' && nutzlast.detail !== undefined) {
    try {
      detail = JSON.stringify(nutzlast.detail);
    } catch {
      detail = '';
    }
  }
  return (fehler + ' ' + detail).trim().slice(0, 500);
}

/** fal-Fehler → kurzer deutscher Text für Planer und Admin. */
function falMeldung(schritt: string, roh: string, status: number): string {
  const t = roh.toLowerCase();
  if (status === 402 || /balance|credit|payment|billing|exhausted|insufficient|locked/.test(t)) {
    return 'Das fal.ai-Guthaben ist aufgebraucht — bitte einem Admin Bescheid geben.';
  }
  if (status === 401 || status === 403) return 'Der fal.ai-Zugang funktioniert nicht — bitte einem Admin Bescheid geben.';
  if (/nsfw|safety|content.?polic|moderat|flagged|inappropriate|prohibited/.test(t)) {
    return 'Die KI hat das abgelehnt (Inhaltsfilter) — bitte Thema oder Bildidee etwas anders formulieren und neu erzeugen.';
  }
  if (/timeout|timed out/.test(t)) return MELDUNG_ZEIT;
  return schritt === 'video'
    ? 'Das Video konnte nicht erzeugt werden — bitte neu erzeugen.'
    : 'Das Standbild konnte nicht erzeugt werden — bitte neu erzeugen.';
}

function meldungFuer(schritt: string, e: unknown): string {
  const s = falStatusVon(e);
  if (s !== null) return falMeldung(schritt, fehlerText(e), s);
  return schritt === 'video'
    ? 'Das Video konnte nicht gespeichert werden — bitte neu erzeugen.'
    : 'Das Standbild konnte nicht gespeichert werden — bitte neu erzeugen.';
}

// ─── Prompts (NUR hier gebaut — nie vom Client übernommen) ───────────────
/** Deutsche Angabe in Anführungszeichen: eigene Anführungszeichen raus,
 *  „Sauna" neutralisiert (lockt sonst Menschen ins Bild), gekürzt. */
function zitat(text: string, max: number): string {
  let t = text
    .replace(/["„“”«»]/g, "'")
    .replace(/sauna/gi, (m) => (m.charAt(0) === 'S' ? 'Wärme' : 'wärme'))
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > max) {
    const schnitt = t.lastIndexOf(' ', max);
    t = t.slice(0, schnitt > max * 0.6 ? schnitt : max).trim() + '…';
  }
  return `"${t}"`;
}

function jahreszeit(datum: string): string {
  const m = Number(datum.slice(5, 7));
  if (m === 12 || m === 1 || m === 2) return 'winter';
  if (m === 3) return 'early spring, last traces of winter';
  if (m === 4 || m === 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m === 11) return 'late autumn';
  return 'autumn';
}

function tageszeit(startIso: string): string {
  const h = berlinStunde(startIso);
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 17) return 'afternoon';
  if (h < 19) return 'early evening with golden light';
  if (h < 21) return 'evening, blue hour';
  return 'late evening after dark, lit by warm light';
}

function bildPrompt(g: Angaben, startIso: string, datum: string): string {
  const titel = g.titel && g.titel !== PLATZHALTER_TITEL ? g.titel : null;
  const z: string[] = [
    'Create a calm, atmospheric, cinematic wide landscape photograph in 21:9 format.',
    'It becomes the softly moving background of a sign that announces one scented steam ceremony at a small festival in the Black Forest, Germany.',
    'Turn the German notes below into ONE quiet, evocative scene. Interpret them visually; never write any of these words or letters into the image.',
  ];
  if (g.motto) z.push(`Festival motto: ${zitat(g.motto, 80)}`);
  if (titel) z.push(`Title of the ceremony: ${zitat(titel, 80)}`);
  if (g.thema) z.push(`Theme or story: ${zitat(g.thema, 500)}`);
  if (g.bildidee) z.push(`Image idea from the host (follow it most closely): ${zitat(g.bildidee, 500)}`);
  if (g.beschreibung) z.push(`Description: ${zitat(g.beschreibung, 500)}`);
  if (g.oele.length > 0) {
    z.push(`Scents used (essential oils): ${zitat(g.oele.slice(0, 12).join(', '), 400)} — let them inspire natural details such as wood, needles, fruit, blossoms, herbs or spices.`);
  }
  z.push(`Season: ${jahreszeit(datum)}. Time of day: ${tageszeit(startIso)}.`);
  z.push('Style: photorealistic, soft natural light, gentle haze and a few wisps of drifting steam, warm and inviting colours, rich natural textures, shallow depth of field, peaceful and uncluttered.');
  z.push('Composition: the upper quarter of the frame is darker and calm — a smooth, dark, low-detail area, because text will be placed there later; the main subject sits in the lower two thirds; the picture fills the whole frame edge to edge with no hard bars, stripes, borders, frames or letterboxing.');
  z.push('Strictly no people, no faces, no hands, no bodies, no human silhouettes, no text, no letters, no words, no numbers, no signs, no logos, no watermark.');
  return z.join('\n');
}

/** Stichwort → passende, langsame Umgebungsbewegung (nur aus den Texten,
 *  nicht aus den Ölen — „Sternanis" soll keine Sterne funkeln lassen). */
const BEWEGUNGEN: [RegExp, string][] = [
  [/nebel|dunst|dampf|rauch|räucher/, 'mist and smoke drifting slowly'],
  [/feuer|glut|flamme|kerze|kamin|laterne|fackel/, 'flames and candle light flickering softly'],
  [/laub|blatt|blätter|wald|baum|bäume|tanne|kiefer|fichte|zweig|gras|wiese|kräuter|blüte|blume|farn/, 'leaves, needles and grasses swaying very gently in a light breeze'],
  [/schnee|flocke|frost|raureif|\beis\b|eiskristall/, 'a few snowflakes or ice crystals drifting down slowly'],
  [/\bwasser|\bsee\b|bergsee|\bbach|fluss|\bmeer\b|welle|quelle|\bregen|tropfen/, 'gentle ripples and soft reflections on the water'],
  [/\bsterne?n?\b|sternenhimmel|sternhimmel|\bnacht|\bmond/, 'stars twinkling softly'],
];

function videoPrompt(g: Angaben | null): string {
  const text = g
    ? [g.motto, g.titel, g.beschreibung, g.thema, g.bildidee].filter((x) => !!x).join(' ').toLowerCase()
    : '';
  const bewegungen: string[] = [];
  for (const [muster, bewegung] of BEWEGUNGEN) {
    if (bewegungen.length < 3 && muster.test(text)) bewegungen.push(bewegung);
  }
  if (!bewegungen.some((b) => /mist|steam/.test(b))) bewegungen.unshift('thin wisps of steam and mist drifting slowly');
  if (bewegungen.length < 2) bewegungen.push('light shifting very softly');
  return [
    'Seamless looping ambient shot based exactly on the input image.',
    `Only slow, subtle ambient motion: ${bewegungen.slice(0, 3).join('; ')} — only where these elements are already visible.`,
    'Static locked-off camera: no camera movement, no zoom, no pan, no cuts, no transitions.',
    'Keep the composition, objects and colours exactly as in the image; no new objects appear and nothing disappears.',
    'No people, no faces, no hands, no text, no letters. Calm, meditative and slow.',
  ].join(' ');
}

// ─── Kleine Helfer ───────────────────────────────────────────────────────
function ersterWert(v: string | string[] | undefined): string {
  const w = Array.isArray(v) ? v[0] : v;
  return typeof w === 'string' ? w : '';
}

function bodyLesen(req: VercelRequest): Record<string, unknown> {
  let b: unknown;
  try {
    b = req.body;   // @vercel/node wirft im Getter bei ungültigem Content-Type
  } catch {
    return {};
  }
  let roh: unknown = b;
  try {
    if (typeof b === 'string') roh = JSON.parse(b);
    else if (Buffer.isBuffer(b)) roh = JSON.parse(b.toString('utf8'));
  } catch {
    return {};
  }
  return roh && typeof roh === 'object' && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
}

function istUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function tokenPasst(token: string, hash: string): boolean {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) return false;
  const a = Buffer.from(sha256(token), 'hex');
  const b = Buffer.from(hash.toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** JSON mit sortierten Schlüsseln — gleicher Inhalt, gleicher Hash. */
function stabilesJson(wert: unknown): string {
  if (Array.isArray(wert)) return '[' + wert.map((w) => stabilesJson(w)).join(',') + ']';
  if (wert && typeof wert === 'object') {
    const o = wert as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stabilesJson(o[k])).join(',') + '}';
  }
  return JSON.stringify(wert === undefined ? null : wert);
}

function leerZuNull(s: string | null | undefined): string | null {
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length > 0 ? t : null;
}

function ganzzahl(x: unknown, vorgabe: number): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : vorgabe;
}

function jetzt(): string {
  return new Date().toISOString();
}

/** 'YYYY-MM-DD' in Europe/Berlin. */
function berlinDatum(iso: string): string {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const teil = (typ: string) => {
    const t = teile.find((p) => p.type === typ);
    return t ? t.value : '';
  };
  return `${teil('year')}-${teil('month')}-${teil('day')}`;
}

function berlinStunde(iso: string): number {
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const t = teile.find((p) => p.type === 'hour');
  const h = t ? Number(t.value) : NaN;
  return Number.isFinite(h) ? h : 12;
}

/** HTTP-Status aus dem Fehlerfall von authenticate() — ohne Union-Verengung,
 *  die @vercel/node ohne strictNullChecks im `!auth.ok`-Zweig nicht schafft. */
function anmeldeStatus(auth: { ok: boolean }): number {
  const s = (auth as { status?: unknown }).status;
  return typeof s === 'number' ? s : 401;
}

function anmeldeFehler(status: number): string {
  if (status === 401) return 'Bitte melde dich neu an.';
  if (status === 403) return 'Dein Konto ist dafür nicht freigeschaltet.';
  return 'Der Server ist nicht vollständig eingerichtet.';
}

/** Geheimnisse aus Texten entfernen, bevor sie irgendwo landen. */
function sauber(text: string): string {
  let t = text;
  const geheim = [falKey(), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()];
  for (const g of geheim) {
    if (g && g.length >= 8) t = t.split(g).join('***');
  }
  return t
    .replace(/([?&]t=)[^&\s"']+/gi, '$1***')
    .replace(/\b[0-9a-f]{64}\b/gi, '***')
    .replace(/(Key\s+)[^\s"']+/g, '$1***');
}

function fehlerText(e: unknown): string {
  const roh = e instanceof Error ? e.message : String(e);
  return sauber(roh).slice(0, 500);
}

function protokoll(...teile: string[]): void {
  console.error('[api/saunafest-video]', ...teile.map((t) => sauber(String(t)).slice(0, 600)));
}
