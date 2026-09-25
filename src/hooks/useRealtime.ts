import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setRealtimeKernAktiv } from '@/lib/realtimeStatus';

// Realtime → React-Query-Caches invalidieren. Einmal nahe der App-Wurzel mounten.
//
// Audit 25.09.2026: Der frühere EINE Kanal abonnierte zwölf Tabellen, die nie
// in der Publication supabase_realtime standen (u. a. members). Der Server legt
// alle Abos eines Kanals in einer Transaktion an und rollt beim ersten
// unbekannten Tisch ALLES zurück — seit Mai kam deshalb kein einziges Ereignis
// an, auch nicht für Saunen, Aufgüsse oder die Evakuierung. Der Client meldete
// trotzdem „SUBSCRIBED" (die Ablehnung kommt nur als 'system'-Nachricht).
// Die Kommentare an den 3-/5-s-Polls („Supabase parkt den Tenant") hatten die
// falsche Ursache im Blick.
//
// Jetzt:
//  • Getrennte Kanäle je Themenbereich — lehnt der Server einen ab (z. B. weil
//    eine Migration fehlt), laufen die anderen weiter.
//  • Nur Tabellen, die in supabase_realtime stehen (Stand Migration 0182).
//    Neue Tabelle? Erst per Migration veröffentlichen, dann hier eintragen.
//    members bleibt bewusst draußen (persönliche Daten, Spaltenrechte).
//  • Mitglieder-Kanäle nur mit Anmeldung — die anonyme Tafel sieht die Zeilen
//    per RLS ohnehin nicht, der Server müsste sie trotzdem für sie prüfen.
//  • 'system'-Nachricht auswerten: erst „Subscribed to PostgreSQL" heißt, dass
//    Ereignisse wirklich kommen. Das steuert die Poll-Takte (lib/realtimeStatus).
//  • Nach einer Wiederverbindung die Daten des Kanals einmal nachladen —
//    Ereignisse aus der Lücke sind sonst verloren.
//  • Ereignisse werden kurz gebündelt: der nächtliche Materialisierer legt viele
//    Aufgüsse in einem Rutsch an, das soll EIN Nachladen auslösen, nicht fünfzig.
//
// FIX 0107 bleibt: bei CHANNEL_ERROR/CLOSED/TIMED_OUT Kanal entfernen und mit
// Backoff neu aufbauen.

type Bindung = {
  tabelle: string;
  event?: '*' | 'INSERT' | 'UPDATE';
  /** Diese Query-Keys (Präfixe) werden bei jedem Ereignis invalidiert. */
  keys: QueryKey[];
};

type KanalSpec = {
  name: string;
  /** Kernkanal der Displays: sein Zustand steuert die Poll-Takte. */
  kern?: boolean;
  bindungen: Bindung[];
};

// ─── Für alle, auch die anonyme Tafel und die Kiosk-Tablets ─────────────────
const OEFFENTLICHE_KANAELE: KanalSpec[] = [
  {
    name: 'tafel',
    kern: true,
    bindungen: [
      { tabelle: 'saunas', keys: [['saunas']] },
      { tabelle: 'infusions', keys: [['infusions']] },
      // Team-Partner treten meist erst am Aufgusstag bei — ohne dieses Abo sah
      // die Tafel sie nie (Schlüssel hängt nur an den Aufguss-IDs).
      { tabelle: 'infusion_co_aufgieser', keys: [['co-aufgieser']] },
      // anon sieht per RLS nur tv_settings + brand_settings (Info-Karten,
      // Hintergründe); schedule_settings kommt nur bei Admins an.
      { tabelle: 'system_config', keys: [['tv-settings'], ['brand-settings'], ['schedule-settings']] },
      { tabelle: 'evacuation_events', keys: [['evacuation']] },
      // TV-Bühne (Migration 0071): Admin steuert vom Handy, Tafel reagiert live
      { tabelle: 'tv_stage_state', keys: [['tv-stage-state']] },
    ],
  },
  {
    // Migration 0182 — eigener Kanal, damit ein fehlendes Einspielen nicht die Tafel trifft.
    name: 'kalender',
    bindungen: [
      // Saunafest: „Plan bestätigen", neue Festtage, Meldeschluss
      { tabelle: 'saunafest_tage', keys: [['saunafest-tage']] },
      { tabelle: 'holidays', keys: [['holidays']] },
    ],
  },
];

// ─── Nur für angemeldete Personen ─────────────────────────────────────────
const MITGLIEDER_KANAELE: KanalSpec[] = [
  {
    name: 'mitglied',
    bindungen: [
      // Saunafest (Migration 0163): eigene Zeiträume (Admin: alle) + Tagesübersicht
      { tabelle: 'saunafest_verfuegbarkeit', keys: [['saunafest-zeitraeume'], ['saunafest-uebersicht']] },
      // Game-Hub (Migration 0073): Lobby + Active-List; einzelne Matches haben
      // in /spiele/match/:id einen eigenen Kanal (lib/games.ts)
      { tabelle: 'games_match', keys: [['games-active-mine'], ['games-open']] },
      // Posteingang (Migration 0077; Lese-Policy für eigene Zeilen seit 0182).
      // Nur INSERT/UPDATE (neu, gelesen): DELETE-Ereignisse prüft Realtime nicht
      // per RLS und schickt sie an ALLE Abonnenten — das Aufräumen alter
      // Benachrichtigungen wäre sonst ein Schwall für jedes Handy.
      { tabelle: 'notification_queue', event: 'INSERT', keys: [['my-notifications'], ['my-notifications-unread']] },
      { tabelle: 'notification_queue', event: 'UPDATE', keys: [['my-notifications'], ['my-notifications-unread']] },
      // Feed-Kommentare (Migration 0078)
      { tabelle: 'feed_post_comments', keys: [['feed-comments']] },
      // DM-Liste + Zähler (Migration 0079); eine offene Unterhaltung hat in
      // /dm/:id einen eigenen Kanal
      { tabelle: 'dm_messages', keys: [['dm-conversations'], ['dm-unread']] },
      // Geteilte Postfächer (Migration 0080): Sperren + Statuswechsel live bei allen Admins
      { tabelle: 'email_tickets', keys: [['account-tickets'], ['my-shared-accounts']] },
    ],
  },
  {
    // Migration 0182 — eigener Kanal, damit ein fehlendes Einspielen nicht die übrigen trifft.
    name: 'sozial',
    bindungen: [
      { tabelle: 'member_achievements', event: 'INSERT', keys: [['achievements'], ['member-stats-full']] },
      { tabelle: 'aufgieser_comments', keys: [['aufgieser-comments']] },
      { tabelle: 'aufgieser_comment_likes', keys: [['aufgieser-comments']] },
      { tabelle: 'aufgieser_photos', keys: [['aufgieser-photos']] },
      { tabelle: 'infusion_reactions', keys: [['infusion-reactions']] },
      { tabelle: 'infusion_announcements', keys: [['infusion-announcements']] },
      { tabelle: 'aufguss_wishes', keys: [['aufguss-wishes']] },
      { tabelle: 'aufguss_wish_likes', keys: [['aufguss-wishes']] },
    ],
  },
];

/** So lange werden Ereignisse gesammelt, bevor invalidiert wird. */
const BUENDEL_MS = 600;
/** Backoff für den Neuaufbau: 2 s · 5 s · 10 s · 30 s · max 60 s */
const BACKOFF_MS = [2_000, 5_000, 10_000, 30_000, 60_000];

type SystemNachricht = { extension?: string; status?: string; message?: unknown };

/** Ist gerade jemand angemeldet? Ändert sich nur beim An-/Abmelden
 *  (Token-Refresh baut die Kanäle nicht neu auf). */
function useAngemeldet(): boolean {
  const [angemeldet, setAngemeldet] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let lebt = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (lebt) setAngemeldet(!!data.session); })
      .catch(() => { /* ohne Sitzung bleibt es bei den öffentlichen Kanälen */ });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (lebt) setAngemeldet(!!s);
    });
    return () => {
      lebt = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return angemeldet;
}

/** Startet die Kanäle und liefert die Aufräum-Funktion. */
function kanaeleStarten(specs: KanalSpec[], qc: QueryClient): () => void {
  const sb = supabase;
  if (!sb) return () => {};

  // Invalidierungen bündeln (ein kurzer Einmal-Timer je Schub, kein Dauertakt).
  const offen = new Map<string, QueryKey>();
  let buendelTimer: ReturnType<typeof setTimeout> | null = null;
  const invalidieren = (keys: QueryKey[]): void => {
    for (const k of keys) offen.set(JSON.stringify(k), k);
    if (buendelTimer) return;
    buendelTimer = setTimeout(() => {
      buendelTimer = null;
      const alle = [...offen.values()];
      offen.clear();
      for (const k of alle) void qc.invalidateQueries({ queryKey: k });
    }, BUENDEL_MS);
  };

  // removeChannel liefert ein Promise — Fehler schlucken, kein unhandled rejection nach Unmount.
  const sicherEntfernen = (ch: RealtimeChannel): void => {
    try {
      const res = sb.removeChannel(ch);
      if (res && typeof (res as Promise<unknown>).then === 'function') {
        (res as Promise<unknown>).catch(() => { /* ignorieren */ });
      }
    } catch { /* ignorieren */ }
  };

  const stopper = specs.map((spec) => {
    let beendet = false;
    let aktuell: RealtimeChannel | null = null;
    let versuche = 0;
    let warSchonAktiv = false;
    let neuTimer: ReturnType<typeof setTimeout> | null = null;
    const alleKeys = spec.bindungen.flatMap((b) => b.keys);
    const aktivMelden = (aktiv: boolean) => { if (spec.kern) setRealtimeKernAktiv(aktiv); };

    const aufbauen = (): void => {
      if (beendet) return;
      const ch = sb.channel(`${spec.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      for (const b of spec.bindungen) {
        ch.on('postgres_changes', { event: b.event ?? '*', schema: 'public', table: b.tabelle },
          () => invalidieren(b.keys));
      }
      // realtime-js meldet SUBSCRIBED schon beim Beitritt. Ob der Server die
      // Abos wirklich angelegt hat, steht erst in dieser Nachricht.
      ch.on('system', {}, (p: SystemNachricht) => {
        if (beendet || aktuell !== ch || p?.extension !== 'postgres_changes') return;
        if (p.status === 'ok') {
          versuche = 0;
          // Nach einer Lücke (Wiederverbindung) einmal alles nachladen.
          if (warSchonAktiv) invalidieren(alleKeys);
          warSchonAktiv = true;
          aktivMelden(true);
        } else if (p.status === 'error') {
          // Bewusst KEIN Neuaufbau: das ist fast immer ein Konfigurationsfehler
          // (Tabelle nicht veröffentlicht) und endete in einer Schleife. Die
          // Polls übernehmen im kurzen Takt.
          // eslint-disable-next-line no-console
          console.warn(`[realtime] Kanal „${spec.name}": Server lehnt die Abos ab`, p.message);
          aktivMelden(false);
        }
      });
      aktuell = ch;
      ch.subscribe((status) => {
        // Nachzügler eines schon ersetzten oder selbst entfernten Kanals ignorieren
        // (removeChannel löst CLOSED aus — sonst doppelter Backoff oder der neue
        // Kanal würde gleich wieder abgeräumt).
        if (beendet || aktuell !== ch) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // eslint-disable-next-line no-console
          console.warn(`[realtime] Kanal „${spec.name}" getrennt:`, status, '· Versuch', versuche);
          aktivMelden(false);
          aktuell = null;
          sicherEntfernen(ch);
          const warte = BACKOFF_MS[Math.min(versuche, BACKOFF_MS.length - 1)];
          versuche += 1;
          if (neuTimer) clearTimeout(neuTimer);
          neuTimer = setTimeout(aufbauen, warte);
        }
      });
    };

    aufbauen();

    return () => {
      beendet = true;
      if (neuTimer) clearTimeout(neuTimer);
      if (aktuell) sicherEntfernen(aktuell);
      aktuell = null;
      aktivMelden(false);
    };
  });

  return () => {
    for (const stop of stopper) stop();
    if (buendelTimer) clearTimeout(buendelTimer);
    offen.clear();
  };
}

export function useRealtimeSync() {
  const qc = useQueryClient();
  const angemeldet = useAngemeldet();

  useEffect(() => kanaeleStarten(OEFFENTLICHE_KANAELE, qc), [qc]);

  useEffect(() => {
    if (!angemeldet) return;
    return kanaeleStarten(MITGLIEDER_KANAELE, qc);
  }, [qc, angemeldet]);
}
