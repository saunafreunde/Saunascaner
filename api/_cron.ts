// api/_cron.ts — Prüfung des Cron-Geheimnisses für alle Server-zu-Server-Aufrufe
// (Unterstrich: Vercel liefert die Datei nicht als Route aus).
//
// CRON_SECRET (Vercel, nur production, sensitive) trägt denselben Wert wie der
// Supabase-Vault-Eintrag 'cron_secret'. pg_cron liest ihn bei jedem Lauf aus dem
// Vault und schickt ihn als Header x-cron-secret bzw. Authorization: Bearer
// (Migrationen 0168/0169); den Vercel-Cron birthday-cron versorgt Vercel selbst
// mit „Authorization: Bearer <CRON_SECRET>".
//
// Fail closed: fehlt CRON_SECRET oder ist es kürzer als 32 Zeichen, gilt KEIN
// Aufruf als Cron. Verglichen wird zeitkonstant; beide Seiten werden vorher
// gehasht, damit ungleiche Längen weder werfen noch auffallen. Es zählen nur
// Header, nie Query-Parameter (die landen in Logs und Verläufen).

import type { VercelRequest } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';

const MIN_LAENGE = 32;

/** Zeitkonstanter Vergleich eines Header-/Query-Werts mit einem Geheimnis.
 *  Leeres Geheimnis oder leerer Wert → false. Auch für das Telegram-Webhook-Geheimnis. */
export function geheimnisGleich(got: unknown, erwartet: string): boolean {
  if (!erwartet) return false;
  const wert = Array.isArray(got) ? got[0] : got;
  if (typeof wert !== 'string' || wert.length === 0) return false;
  const a = createHash('sha256').update(wert).digest();
  const b = createHash('sha256').update(erwartet).digest();
  return timingSafeEqual(a, b);
}

function stimmt(got: unknown): boolean {
  const erwartet = process.env.CRON_SECRET ?? '';
  if (erwartet.length < MIN_LAENGE) return false;
  return geheimnisGleich(got, erwartet);
}

/** Header `x-cron-secret: <CRON_SECRET>` (pg_cron-Jobs). */
export function cronHeaderOk(req: VercelRequest): boolean {
  return stimmt(req.headers['x-cron-secret']);
}

/** Header `Authorization: Bearer <CRON_SECRET>` (Vercel-Cron, pg_cron push-reminder-30min). */
export function cronBearerOk(req: VercelRequest): boolean {
  const auth = req.headers.authorization ?? '';
  return auth.startsWith('Bearer ') && stimmt(auth.slice(7));
}

/** true, wenn CRON_SECRET fehlt oder zu kurz ist — dann lehnen alle Cron-Endpunkte ab. Nur fürs Log. */
export function cronSecretFehlt(): boolean {
  return (process.env.CRON_SECRET ?? '').length < MIN_LAENGE;
}
