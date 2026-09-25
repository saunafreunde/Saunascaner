// Admin → Handbuch → Telegram: wer bekommt die Vereins-Meldungen? (Migration 0187, 25.09.2026)
//
// Vorher trug /start beim Bot JEDEN Chat sofort in den Verteiler ein — auch
// Unbekannte bekamen dann Evakuierungslisten mit Namen, Geburtstage und
// Umfrageergebnisse. Jetzt landet ein neuer Chat hier als Anfrage; erst nach
// „Freigeben“ bekommt er Rundnachrichten. Die Admins werden über neue Anfragen
// benachrichtigt (Glocke/Push). Bestehende Chats blieben unverändert aktiv.
// „Entfernen“ nimmt einen Chat aus dem Verteiler und merkt ihn als abgelehnt,
// damit ein erneutes /start nicht wieder eine Anfrage auslöst.
//
// Audit-Runde 3 (0199): Chats, die Telegram dauerhaft ablehnt (Bot blockiert,
// Telegram-Konto gelöscht, Bot aus der Gruppe entfernt, Chat nicht gefunden),
// pausiert der Server automatisch — sie bleiben im Verteiler, bekommen aber
// nichts, damit nicht jeder Rundruf und jeder Alarm einen Teilausfall meldet.
// Hier sichtbar unter „Pausiert“; „Wieder aktivieren“ hebt die Pause auf, ein
// /start aus dem Chat ebenfalls.

import { useState } from 'react';
import {
  useTelegramChatsAdmin, useTelegramChatEntscheiden, useTelegramChatReaktivieren, type TelegramChatEintrag,
} from '@/lib/api';

const PAUSE_GRUND: Record<string, string> = {
  blockiert: 'Bot wurde blockiert',
  konto_geloescht: 'Telegram-Konto gelöscht',
  entfernt: 'Bot aus der Gruppe entfernt',
  nicht_gefunden: 'Chat nicht gefunden',
  nicht_gestartet: 'Bot nie gestartet',
};

function zeitText(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function chatName(c: TelegramChatEintrag): string {
  const teile: string[] = [];
  if (c.mitglied_name) teile.push(c.mitglied_name);
  if (c.vorname && c.vorname !== c.mitglied_name) teile.push(c.vorname);
  if (c.benutzername) teile.push(`@${c.benutzername}`);
  if (teile.length === 0) teile.push(c.chat_id < 0 ? 'Gruppe' : 'Unbekannter Chat');
  return teile.join(' · ');
}

function Zeile({ c, onEntscheiden, onReaktivieren, busy }: {
  c: TelegramChatEintrag;
  onEntscheiden: (aktion: 'freigeben' | 'ablehnen') => void;
  onReaktivieren?: () => void;
  busy: boolean;
}) {
  const pausiert = c.status === 'pausiert';
  const istGruppe = c.chat_id < 0 || (c.chat_typ !== null && c.chat_typ !== 'private');
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/40">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-forest-100">
          {istGruppe ? '👥 ' : '👤 '}{chatName(c)}
        </p>
        <p className="text-[11px] text-forest-400">
          {c.mitglied_name ? 'mit App-Konto verknüpft' : 'nicht mit einem App-Konto verknüpft'}
          {c.mitglied_gesperrt ? ' · ⚠️ Konto gesperrt (bekommt nichts)' : ''}
          {c.angefragt_at ? ` · angefragt ${zeitText(c.angefragt_at)}` : ''}
        </p>
        {pausiert && (
          <p className="text-[11px] text-amber-300">
            ⏸ nicht erreichbar{c.deaktiviert_grund ? ` (${PAUSE_GRUND[c.deaktiviert_grund] ?? c.deaktiviert_grund})` : ''}
            {c.deaktiviert_at ? ` · seit ${zeitText(c.deaktiviert_at)}` : ''} — bekommt nichts
          </p>
        )}
      </div>
      {pausiert && onReaktivieren && (
        <button
          type="button"
          disabled={busy}
          onClick={onReaktivieren}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          ↻ Wieder aktivieren
        </button>
      )}
      {c.status !== 'aktiv' && !pausiert && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onEntscheiden('freigeben')}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          ✓ Freigeben
        </button>
      )}
      {c.status !== 'abgelehnt' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onEntscheiden('ablehnen')}
          className="rounded-lg bg-rose-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {c.status === 'aktiv' || pausiert ? 'Entfernen' : 'Ablehnen'}
        </button>
      )}
    </li>
  );
}

export function TelegramChatsKarte() {
  const liste = useTelegramChatsAdmin();
  const entscheiden = useTelegramChatEntscheiden();
  const reaktivieren = useTelegramChatReaktivieren();
  const [fehler, setFehler] = useState<string | null>(null);
  const [abgelehnteOffen, setAbgelehnteOffen] = useState(false);

  const alle = liste.data ?? [];
  const wartend = alle.filter((c) => c.status === 'wartet');
  const aktiv = alle.filter((c) => c.status === 'aktiv');
  const pausiert = alle.filter((c) => c.status === 'pausiert');
  const abgelehnt = alle.filter((c) => c.status === 'abgelehnt');
  const busy = entscheiden.isPending || reaktivieren.isPending;

  async function los(c: TelegramChatEintrag, aktion: 'freigeben' | 'ablehnen') {
    setFehler(null);
    if (aktion === 'ablehnen' && (c.status === 'aktiv' || c.status === 'pausiert')
      && !confirm(`„${chatName(c)}" aus dem Telegram-Verteiler nehmen? Der Chat bekommt dann keine Vereins-Meldungen mehr.`)) return;
    try {
      await entscheiden.mutateAsync({ chat_id: c.chat_id, aktion });
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function wiederAktivieren(c: TelegramChatEintrag) {
    setFehler(null);
    try {
      await reaktivieren.mutateAsync(c.chat_id);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-3 border-t border-forest-800/50 pt-3">
      <div>
        <h3 className="text-sm font-bold text-forest-100">
          🔐 Wer bekommt die Vereins-Meldungen?
          {wartend.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-amber-950">
              {wartend.length} wartet
            </span>
          )}
        </h3>
        <p className="mt-1 text-xs text-forest-300/70">
          Über den Bot gehen Personal-Aufgüsse, Geburtstage, Umfrageergebnisse und im Notfall die Liste der
          Anwesenden raus. Wer beim Bot <code className="text-amber-300">/start</code> sendet, erscheint hier und
          bekommt erst nach deiner Freigabe etwas. Gib nur Chats frei, die du kennst.
        </p>
      </div>

      {liste.isLoading && <p className="text-xs text-forest-400">Lade…</p>}
      {liste.error && <p className="text-xs text-rose-300">Liste konnte nicht geladen werden: {(liste.error as Error).message}</p>}
      {fehler && <p className="text-xs text-rose-300">{fehler}</p>}

      {wartend.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Warten auf Freigabe</p>
          <ul className="space-y-2">
            {wartend.map((c) => (
              <Zeile key={c.chat_id} c={c} busy={busy} onEntscheiden={(a) => los(c, a)} />
            ))}
          </ul>
        </div>
      )}

      {!liste.isLoading && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-300">
            Freigegeben ({aktiv.length})
          </p>
          {aktiv.length === 0 ? (
            <p className="text-xs text-forest-400">Noch kein Chat freigegeben.</p>
          ) : (
            <ul className="space-y-2">
              {aktiv.map((c) => (
                <Zeile key={c.chat_id} c={c} busy={busy} onEntscheiden={(a) => los(c, a)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {pausiert.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            Pausiert — nicht erreichbar ({pausiert.length})
          </p>
          <p className="text-[11px] text-forest-300/70">
            Telegram hat die Zustellung an diese Chats dauerhaft abgelehnt. Sie bekommen nichts, bis du sie wieder
            aktivierst oder der Chat beim Bot erneut <code className="text-amber-300">/start</code> sendet.
          </p>
          <ul className="space-y-2">
            {pausiert.map((c) => (
              <Zeile key={c.chat_id} c={c} busy={busy} onEntscheiden={(a) => los(c, a)} onReaktivieren={() => wiederAktivieren(c)} />
            ))}
          </ul>
        </div>
      )}

      {abgelehnt.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAbgelehnteOffen((o) => !o)}
            className="text-xs text-forest-400 underline hover:text-forest-200"
          >
            {abgelehnteOffen ? '▾' : '▸'} Abgelehnt / entfernt ({abgelehnt.length})
          </button>
          {abgelehnteOffen && (
            <ul className="space-y-2">
              {abgelehnt.map((c) => (
                <Zeile key={c.chat_id} c={c} busy={busy} onEntscheiden={(a) => los(c, a)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
