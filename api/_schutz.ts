// Schutz-Helfer für öffentliche Endpunkte (Audit 25.09.2026, Migration 0189).
// Nur serverseitig — nicht aus dem Frontend importieren.
//
//  * clientIp: die IP, die Vercel selbst setzt (lässt sich nicht vorgeben)
//  * ipSchluessel: dieselbe IP als Drossel-Schlüssel (IPv6 je /64-Präfix)
//  * drosselBuchen: Bremse in der Datenbank (gilt für alle Instanzen)
//  * kioskGeraet: gekoppeltes Kiosk-Gerät aus dem Header x-kiosk-geraet (0177)
//  * geraeteartGekoppelt / kioskUebergangOffen: Übergangsregeln für
//    ungekoppelte Geräte (PIN-Töpfe bzw. Tablet-Anmeldung)
//  * ohneAdressen: E-Mail-Adressen aus Log-Texten entfernen
import type { VercelRequest } from '@vercel/node';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Client-IP laut Vercel: x-real-ip bzw. der erste Eintrag von x-forwarded-for. */
export function clientIp(req: VercelRequest): string {
  const real = req.headers['x-real-ip'];
  const r = Array.isArray(real) ? real[0] : real;
  if (r && r.trim()) return r.trim();
  const fwd = req.headers['x-forwarded-for'];
  const f = Array.isArray(fwd) ? fwd[0] : fwd;
  return f?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Drossel-Schlüssel für die Client-IP (Audit-Runde 2, 25.09.2026): IPv4 wie
 * sie ist, IPv6 zusammengefasst auf das /64-Präfix. Ein einzelner
 * IPv6-Anschluss hat Milliarden Adressen im selben /64 — je volle Adresse
 * gezählt, bekäme ein Angreifer mit EINEM Anschluss beliebig viele Töpfe.
 */
export function ipSchluessel(req: VercelRequest): string {
  const ip = clientIp(req);
  if (!ip.includes(':')) return ip;
  const roh = ip.split('%')[0].toLowerCase();
  const v4 = roh.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  const doppelt = roh.indexOf('::');
  let teile: string[];
  if (doppelt >= 0) {
    const links = roh.slice(0, doppelt).split(':').filter(Boolean);
    const rechts = roh.slice(doppelt + 2).split(':').filter(Boolean);
    const fehlend = Math.max(0, 8 - links.length - rechts.length);
    teile = [...links, ...Array<string>(fehlend).fill('0'), ...rechts];
  } else {
    teile = roh.split(':');
  }
  const praefix = teile.slice(0, 4);
  if (praefix.length < 4 || praefix.some((t) => !/^[0-9a-f]{1,4}$/.test(t))) return ip;
  return `${praefix.map((t) => t.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/** sha256 der (kleingeschriebenen) E-Mail — Drossel-Schlüssel, nie die Adresse selbst. */
export function emailSchluessel(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Entfernt E-Mail-Adressen und Zeilenumbrüche aus Texten für die Server-Logs
 *  (Fehlermeldungen von nodemailer/GoTrue enthalten die Adresse teils selbst). */
export function ohneAdressen(s: unknown): string {
  return String(s ?? '')
    .replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+/g, '<email>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

/** Ein Zähl-Topf: höchstens `max` Buchungen je `fensterS` Sekunden (höchstens 1 Tag). */
export type Topf = { schluessel: string; max: number; fensterS: number };

/**
 * Bucht einen Versuch in allen Töpfen — oder in keinem, wenn einer voll ist
 * (public.api_drossel_buchen, 0189; nur service_role).
 * Ergebnis: 0 = gebucht, n = der n-te Topf (1-basiert) ist voll,
 * null = Datenbankfehler (der Aufrufer entscheidet: durchlassen oder sperren).
 */
export async function drosselBuchen(
  sb: SupabaseClient,
  // 'tg_meldung' seit 0194 (Vereins-Meldungen über /api/send-notification).
  art: 'ki_titel' | 'mail' | 'pin_fehl' | 'signup' | 'signup_mail' | 'tg_meldung',
  toepfe: Topf[],
): Promise<number | null> {
  const { data, error } = await sb.rpc('api_drossel_buchen', {
    p_art: art,
    p_schluessel: toepfe.map((t) => t.schluessel),
    p_max: toepfe.map((t) => t.max),
    p_fenster_sekunden: toepfe.map((t) => t.fensterS),
  });
  if (error) {
    console.error('[schutz] api_drossel_buchen fehlgeschlagen', error.code ?? '', ohneAdressen(error.message));
    return null;
  }
  return typeof data === 'number' ? data : Number(data ?? 0);
}

/** Gekoppeltes Kiosk-Gerät (Header x-kiosk-geraet, Migration 0177): Art und ein
 *  Drossel-Schlüssel (sha256 des Tokens, nicht das Token selbst) — sonst null. */
export async function kioskGeraet(
  sb: SupabaseClient,
  req: VercelRequest,
): Promise<{ art: string; schluessel: string } | null> {
  const h = req.headers['x-kiosk-geraet'];
  const token = Array.isArray(h) ? h[0] : h;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await sb.rpc('kiosk_geraet_art', { p_token: token });
  if (error || typeof data !== 'string' || !data) return null;
  return { art: data, schluessel: createHash('sha256').update(token).digest('hex').slice(0, 40) };
}

// Ob schon ein Gerät einer Art gekoppelt ist, ändert sich selten — eine
// Minute im Speicher der Instanz genügt und spart je Anfrage eine Abfrage.
const gekoppeltCache = new Map<string, { wert: boolean; bis: number }>();

/** Ist mindestens ein (nicht widerrufenes) Gerät dieser Art gekoppelt?
 *  Seit 0191 zählt nur ein EINGELÖSTER Kopplungscode (token_hash gesetzt) —
 *  ein nur angelegter oder abgelaufener Code ist noch kein Gerät.
 *  Bei einem Datenbankfehler: false (die Übergangsregel bleibt dann offen). */
export async function geraeteartGekoppelt(sb: SupabaseClient, art: string): Promise<boolean> {
  const c = gekoppeltCache.get(art);
  if (c && c.bis > Date.now()) return c.wert;
  const { count, error } = await sb
    .from('kiosk_geraete')
    .select('id', { count: 'exact', head: true })
    .eq('art', art)
    .not('token_hash', 'is', null)
    .is('widerrufen_at', null);
  if (error) {
    console.error('[schutz] kiosk_geraete zählen fehlgeschlagen', error.code ?? '');
    return false;
  }
  const wert = (count ?? 0) > 0;
  gekoppeltCache.set(art, { wert, bis: Date.now() + 60_000 });
  return wert;
}

// ─── Übergang für ungekoppelte Kiosk-Geräte (Audit-Runde 3, 25.09.2026) ──
// Frist: 09.10.2026 00:00 Europe/Berlin (MESZ = UTC+2) — dieselbe wie
// evakuierung_uebergang_offen (0191). Danach gilt die Sperre in jedem Fall.
const KIOSK_UEBERGANG_FRIST_MS = Date.parse('2026-10-08T22:00:00Z');

// „Je gekoppelt" ist eine Sperrklinke: ein eingelöster Code bleibt in
// kiosk_geraete stehen (Widerruf setzt nur widerrufen_at, gelöscht wird nie).
// Ein true gilt darum für immer, ein false eine Minute.
const jeGekoppeltCache = new Map<string, { wert: boolean; bis: number }>();

/** Wurde JE ein Gerät dieser Art eingelöst (token_hash gesetzt) — auch wenn es
 *  inzwischen widerrufen ist? Anders als geraeteartGekoppelt (PIN-Töpfe) öffnet
 *  ein Widerruf hier nichts wieder. Bei einem Datenbankfehler: true — lieber
 *  sperren als einen Endpunkt, der Konten anlegt, offen lassen. */
export async function geraeteartJeGekoppelt(sb: SupabaseClient, art: string): Promise<boolean> {
  const c = jeGekoppeltCache.get(art);
  if (c && c.bis > Date.now()) return c.wert;
  const { count, error } = await sb
    .from('kiosk_geraete')
    .select('id', { count: 'exact', head: true })
    .eq('art', art)
    .not('token_hash', 'is', null);
  if (error) {
    console.error('[schutz] kiosk_geraete (je gekoppelt) zählen fehlgeschlagen', error.code ?? '');
    return true;
  }
  const wert = (count ?? 0) > 0;
  jeGekoppeltCache.set(art, { wert, bis: wert ? Number.POSITIVE_INFINITY : Date.now() + 60_000 });
  return wert;
}

/** Ist der Übergang für ungekoppelte Geräte dieser Art noch offen? Nur vor der
 *  Frist (09.10.2026) UND nur, solange noch nie ein Gerät dieser Art eingelöst
 *  wurde. Wie evakuierung_uebergang_offen (0191), nur für eine beliebige Art. */
export async function kioskUebergangOffen(sb: SupabaseClient, art: string): Promise<boolean> {
  if (Date.now() >= KIOSK_UEBERGANG_FRIST_MS) return false;
  return !(await geraeteartJeGekoppelt(sb, art));
}
