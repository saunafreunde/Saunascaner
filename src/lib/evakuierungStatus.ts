// Versandstand des Evakuierungsalarms lesen (evacuation_events.telegram_status)
// — Audit-Runde 3 (25.09.2026, Migration 0199).
//
// Der Server (api/send-evacuation.ts) schreibt seit 0199:
//   'gesendet k/n · push a/b'        k ≥ 1 Chats haben die Nachricht angenommen
//   'fehlgeschlagen 0/n · push a/b'  kein einziger Chat
//   'keine_chats · push …', 'kein_token · push …', 'fehler · push …'
//   statt 'push a/b' auch 'push fehlt:<grund>' (vapid, abos, zeit, fehler)
// Ältere Werte ohne Push-Teil ('gesendet k/n', 'keine_chats', 'kein_token')
// bleiben lesbar. 'sende' bzw. NULL (läuft noch) behandelt der Aufrufer.
//
// Bewusst ohne Importe: wird vom Evakuierungs-Vollbild und von
// src/lib/telegram.ts genutzt (keine Import-Zyklen).

export type TelegramStand =
  | { art: 'zugestellt'; ok: number; gesamt: number }
  | { art: 'keine_chats' }
  | { art: 'kein_token' }
  | { art: 'fehler' }
  | { art: 'unbekannt'; roh: string };

export type PushStand =
  | { art: 'zugestellt'; ok: number; gesamt: number }
  | { art: 'fehlt'; grund: string }
  /** Alter Status ohne Push-Teil (vor 0199). */
  | { art: 'unbekannt' };

export type VersandStand = { telegram: TelegramStand; push: PushStand };

const TG_ZAHL_RE = /^(?:gesendet|fehlgeschlagen) (\d+)\/(\d+)$/;
const PUSH_ZAHL_RE = /^push (\d+)\/(\d+)$/;
const PUSH_FEHLT_RE = /^push fehlt:(.+)$/;

/** Endstatus zerlegen. Für 'sende'/NULL nicht gedacht (läuft noch). */
export function versandStandLesen(status: string): VersandStand {
  const [tgRoh, pushRoh] = status.split(' · ').map((s) => s.trim());
  let telegram: TelegramStand;
  const tg = TG_ZAHL_RE.exec(tgRoh ?? '');
  if (tg) telegram = { art: 'zugestellt', ok: Number(tg[1]), gesamt: Number(tg[2]) };
  else if (tgRoh === 'keine_chats') telegram = { art: 'keine_chats' };
  else if (tgRoh === 'kein_token') telegram = { art: 'kein_token' };
  else if (tgRoh === 'fehler') telegram = { art: 'fehler' };
  else telegram = { art: 'unbekannt', roh: status };

  let push: PushStand = { art: 'unbekannt' };
  const pz = PUSH_ZAHL_RE.exec(pushRoh ?? '');
  const pf = PUSH_FEHLT_RE.exec(pushRoh ?? '');
  if (pz) push = { art: 'zugestellt', ok: Number(pz[1]), gesamt: Number(pz[2]) };
  else if (pf) push = { art: 'fehlt', grund: pf[1] };
  return { telegram, push };
}

/**
 * Anzeige-Text. warnung = true, sobald Telegram nicht an alle Chats ging oder
 * kein Push zugestellt wurde — dann ohne „✓“ und mit Aufforderung zum
 * telefonischen Alarmieren.
 */
export function versandStandText(stand: VersandStand): { text: string; warnung: boolean } {
  // Unbekannter Wert (z. B. neuerer Server): roh zeigen, nichts behaupten.
  if (stand.telegram.art === 'unbekannt') return { text: `Versand: ${stand.telegram.roh}`, warnung: false };
  const teile: string[] = [];
  let warnung = false;
  let telegramProblem = false;

  const p = stand.push;
  if (p.art === 'zugestellt') {
    if (p.ok > 0) teile.push(`Push an ${p.ok}/${p.gesamt} Geräte`);
    else {
      warnung = true;
      teile.push(p.gesamt > 0 ? `⚠️ Push an KEIN Gerät zugestellt (0/${p.gesamt})` : '⚠️ kein Push zugestellt (kein Gerät angemeldet)');
    }
  } else if (p.art === 'fehlt') {
    warnung = true;
    teile.push(p.grund === 'vapid' ? '⚠️ Push ist nicht eingerichtet'
      : p.grund === 'zeit' ? '⚠️ Push nicht bestätigt (Zeitgrenze)'
        : '⚠️ Push fehlgeschlagen');
  } else {
    teile.push('Push verschickt');
  }

  const t = stand.telegram;
  if (t.art === 'zugestellt') {
    if (t.ok === 0) {
      warnung = telegramProblem = true;
      teile.push(`⚠️ Telegram an KEINEN Chat zugestellt (0/${t.gesamt})`);
    } else if (t.ok < t.gesamt) {
      warnung = telegramProblem = true;
      teile.push(`⚠️ Telegram nur an ${t.ok} von ${t.gesamt} Chats zugestellt`);
    } else {
      teile.push(`Telegram an ${t.gesamt === 1 ? 'den Chat' : `alle ${t.gesamt} Chats`}`);
    }
  } else if (t.art === 'keine_chats') {
    // Seit 0199 werden tote Chats pausiert — sind ALLE pausiert (oder die
    // Liste nicht lesbar), ist beim Alarm niemand per Telegram erreicht.
    warnung = telegramProblem = true;
    teile.push('⚠️ kein aktiver Telegram-Chat (alle pausiert oder keiner eingerichtet)');
  } else if (t.art === 'kein_token') {
    warnung = telegramProblem = true;
    teile.push('⚠️ Telegram ist nicht eingerichtet');
  } else {
    warnung = telegramProblem = true;
    teile.push('⚠️ Telegram-Versand abgebrochen');
  }

  const text = teile.join(' · ');
  if (!warnung) return { text: `✓ ${text}.`, warnung };
  return {
    text: telegramProblem
      ? `${text} — bitte im Telegram-Chat prüfen und telefonisch alarmieren.`
      : `${text} — im Zweifel telefonisch alarmieren.`,
    warnung,
  };
}
