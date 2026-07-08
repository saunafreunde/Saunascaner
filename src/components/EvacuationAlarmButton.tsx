import { useState } from 'react';
import {
  useCurrentMember, useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
  usePresentMembers, sendBroadcastPush,
} from '@/lib/api';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationList } from '@/lib/telegram';

// Großer Evakuierungs-Alarm-Button — NUR für Admin sichtbar (Betriebsentscheidung:
// Personal löst nicht selbst aus). Bei aktiver Evakuierung: Status + Abbrechen.
export function EvacuationAlarmButton() {
  const me = useCurrentMember();
  const evac = useActiveEvacuation();
  const trig = useTriggerEvacuation();
  const end = useEndEvacuation();
  const present = usePresentMembers();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isActive = !!evac.data;

  // Nur Admin darf den Alarm sehen/auslösen (auf /mitarbeiter, /cp, /unterstuetzer verborgen).
  if (me.data?.role !== 'admin') return null;

  async function triggerAlarm() {
    if (!me.data) return;
    if (!confirm('Evakuierungsalarm WIRKLICH auslösen?\n\nDies sendet sofort Push-Benachrichtigungen an alle Mitglieder und eine Liste der Anwesenden an Telegram.')) return;
    setBusy(true);
    setToast(null);
    try {
      const presentNames = (present.data ?? []).map((p) => p.name);
      const ev = await trig.mutateAsync({ triggered_by: me.data.id, present_names: presentNames });
      broadcastEvac({ type: 'start', triggeredBy: me.data.name, triggeredAt: Date.parse(ev.triggered_at) });
      sendEvacuationList({ triggeredBy: me.data.name, triggeredAt: new Date(ev.triggered_at), presentNames }).catch(() => {});
      sendBroadcastPush({
        title: '🚨 EVAKUIERUNG',
        body: `Bitte sofort das Gebäude verlassen — ausgelöst von ${me.data.name}`,
        url: '/dashboard',
        tag: 'evacuation',
        requireInteraction: true,
      }).catch(() => {});
      setToast(`Alarm ausgelöst (${presentNames.length} Personen).`);
    } catch (e) {
      setToast(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelAlarm() {
    if (!evac.data) return;
    if (!confirm('Evakuierungsalarm beenden?')) return;
    setBusy(true);
    try {
      await end.mutateAsync(evac.data.id);
      broadcastEvac({ type: 'stop' });
      setToast('Alarm beendet.');
    } catch (e) {
      setToast(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl ring-2 backdrop-blur p-5 transition"
      style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(239,68,68,0.35), rgba(8,18,12,0.85))'
          : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(8,18,12,0.85))',
        borderColor: isActive ? '#ef4444' : '#ef4444aa',
        boxShadow: isActive ? '0 0 24px #ef444466, inset 0 0 0 1px #ef4444' : 'inset 0 0 0 1px #ef444466',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-red-300 mb-1">
            🚨 Notfall-Alarm
          </h3>
          {isActive ? (
            <p className="text-sm text-red-100">
              <strong>EVAKUIERUNG AKTIV</strong> — bitte Gebäude sofort verlassen!
            </p>
          ) : (
            <p className="text-xs text-forest-300/80 leading-relaxed">
              Nur im echten Notfall benutzen. Sendet Push an alle + Telegram-Liste der Anwesenden.
            </p>
          )}
        </div>
        {isActive ? (
          <button
            onClick={cancelAlarm}
            disabled={busy}
            className="rounded-2xl bg-forest-900 text-forest-200 px-4 py-3 font-semibold ring-1 ring-forest-700/50 hover:bg-forest-800 whitespace-nowrap disabled:opacity-50"
          >
            Alarm beenden
          </button>
        ) : (
          <button
            onClick={triggerAlarm}
            disabled={busy}
            className="rounded-2xl bg-red-600 text-white px-5 py-3 font-bold shadow-lg shadow-red-900/40 hover:bg-red-500 active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            🚨 Alarm
          </button>
        )}
      </div>
      {toast && (
        <p className="mt-3 text-xs text-red-200">{toast}</p>
      )}
    </section>
  );
}
