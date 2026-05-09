import { useEffect, useState } from 'react';
import { fetchVapidPublicKey, subscribePush, sendTestPush } from '@/lib/api';

interface Props {
  memberId: string;
}

function urlB64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushPermission({ memberId }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((s) => setSubscribed(!!s))
    );
  }, []);

  if (!supported) {
    return (
      <div className="rounded-2xl bg-forest-950/50 ring-1 ring-forest-800/40 p-4 text-xs text-forest-400 italic">
        Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
      </div>
    );
  }

  async function enable() {
    setBusy(true); setFeedback(null);
    try {
      // Permission anfragen
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setFeedback('Berechtigung nicht erteilt.');
        return;
      }
      // Service-Worker bereit
      const reg = await navigator.serviceWorker.ready;
      // Public Key holen
      const publicKey = await fetchVapidPublicKey();
      // Subscription erstellen
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });
      // Server speichern
      await subscribePush(memberId, sub);
      setSubscribed(true);
      setFeedback('✅ Push aktiviert. Du wirst benachrichtigt bei Evakuierung, Tipp-Reminder, Bewertungs-Fenster.');
    } catch (e) {
      setFeedback(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setFeedback(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setSubscribed(false);
      setFeedback('Push deaktiviert.');
    } catch (e) {
      setFeedback(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true); setFeedback(null);
    try {
      await sendTestPush(memberId);
      setFeedback('Test-Push gesendet. Wenn du nichts siehst, prüfe Browser-Benachrichtigungen.');
    } catch (e) {
      setFeedback(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-950/30 to-forest-950/40 ring-1 ring-amber-700/30 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">🔔</span>
        <h3 className="text-sm font-bold text-amber-200">Push-Benachrichtigungen</h3>
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-rose-300 italic">Browser-Berechtigung verweigert. Aktiviere sie in den Browser-Einstellungen.</p>
      )}
      {!subscribed && permission !== 'denied' && (
        <p className="text-xs text-forest-300">Bekomme Live-Erinnerungen für Evakuierung, neue Aufgüsse, Tipp-Reminder & ablaufende Bewertungs-Fenster.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <button onClick={enable} disabled={busy || permission === 'denied'}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-50">
            {busy ? 'Aktiviere…' : '🔔 Aktivieren'}
          </button>
        ) : (
          <>
            <span className="rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300">✓ Aktiv</span>
            <button onClick={test} disabled={busy}
              className="rounded-lg bg-forest-800 hover:bg-forest-700 px-3 py-1.5 text-xs text-forest-200">
              Test-Push
            </button>
            <button onClick={disable} disabled={busy}
              className="rounded-lg bg-rose-500/20 hover:bg-rose-500/30 ring-1 ring-rose-500/40 px-3 py-1.5 text-xs text-rose-300">
              Deaktivieren
            </button>
          </>
        )}
      </div>
      {feedback && <p className="text-xs text-amber-200">{feedback}</p>}
    </div>
  );
}
