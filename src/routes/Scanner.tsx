import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { togglePresenceByCode, togglePresenceByEntryCode, usePresentMembers, useCurrentMember } from '@/lib/api';
import { fmtClock } from '@/lib/time';

type Toast = { kind: 'ok' | 'err' | 'info'; text: string };
type Mode = 'idle' | 'scan' | 'code';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 2;
const LOCKOUT_MS = 2 * 60 * 1000;

function extractCode(payload: string): string | null {
  if (UUID_RE.test(payload)) return payload;
  try {
    const u = new URL(payload);
    const c = u.searchParams.get('c') ?? u.searchParams.get('code');
    if (c && UUID_RE.test(c)) return c;
    const m = u.pathname.match(/\/m\/([0-9a-f-]{36})/i);
    if (m && UUID_RE.test(m[1])) return m[1];
  } catch { /* not a URL */ }
  return null;
}

function fmtCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function Scanner() {
  const present = usePresentMembers();
  const currentMember = useCurrentMember();
  const isAdmin = currentMember.data?.role === 'admin';
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [now, setNow] = useState(Date.now());

  // Rate-limiting state (in-memory, resets on page reload)
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setAttempts(0);
      }
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }

  function playBeep() {
    try {
      new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAA==').play().catch(() => {});
    } catch { /* ignore */ }
  }

  async function handleQrCode(payload: string) {
    const code = extractCode(payload.trim());
    if (!code) {
      showToast({ kind: 'err', text: 'QR ungültig — keine Mitglieds-ID erkannt.' });
      return;
    }
    const n = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && n - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { code, at: n };

    try {
      const r = await togglePresenceByCode(code);
      playBeep();
      showToast({ kind: 'ok', text: `${r.name}: ${r.is_present ? 'eingecheckt ✅' : 'ausgecheckt 👋'}` });
      await present.refetch();
    } catch (e) {
      const msg = (e as Error).message ?? 'Fehler';
      showToast({ kind: 'err', text: msg.includes('unknown_or_revoked') ? 'Ausweis unbekannt oder gesperrt.' : msg });
    }
  }

  async function handleEntryCode(e: React.FormEvent) {
    e.preventDefault();
    if (lockedUntil) return;

    const trimmed = codeInput.trim();
    if (!trimmed) return;

    try {
      const r = await togglePresenceByEntryCode(trimmed);
      playBeep();
      showToast({ kind: 'ok', text: `${r.name}: ${r.is_present ? 'eingecheckt ✅' : 'ausgecheckt 👋'}` });
      setCodeInput('');
      setAttempts(0);
      await present.refetch();
    } catch (e) {
      const msg = (e as Error).message ?? 'Fehler';
      if (msg.includes('unknown_or_revoked')) {
        const newAttempts = attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setAttempts(0);
          setCodeInput('');
          showToast({ kind: 'err', text: 'Zu viele Fehlversuche. Gerät für 2 Minuten gesperrt.' });
        } else {
          setAttempts(newAttempts);
          showToast({ kind: 'err', text: `Unbekannter Code (${newAttempts}/${MAX_ATTEMPTS} Versuche).` });
          setCodeInput('');
        }
      } else {
        showToast({ kind: 'err', text: msg });
      }
    }
  }

  async function startCamera() {
    if (!videoRef.current || scannerRef.current) return;
    try {
      const s = new QrScanner(
        videoRef.current,
        (r) => handleQrCode(r.data),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
        }
      );
      await s.start();
      scannerRef.current = s;
    } catch (err) {
      showToast({ kind: 'err', text: `Kamera-Fehler: ${(err as Error).message}` });
      setMode('idle');
    }
  }

  function stopCamera() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }

  useEffect(() => {
    if (mode === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [mode]);

  useEffect(() => () => stopCamera(), []);

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - now) : 0;

  function printList() {
    window.print();
  }

  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100 flex flex-col">

      {/* Gesperrt-Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-40 bg-rose-950/95 flex flex-col items-center justify-center text-center p-6">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-black uppercase tracking-wider text-rose-100 mb-2">Gesperrt</h2>
          <p className="text-rose-200 mb-6">Zu viele Fehlversuche.</p>
          <div className="text-5xl font-black tabular-nums text-rose-300">{fmtCountdown(remainingMs)}</div>
          <p className="mt-4 text-sm text-rose-300/70">Entsperrung in {fmtCountdown(remainingMs)} Minuten</p>
        </div>
      )}

      <header className="no-print border-b border-forest-800/40 bg-forest-950/95 backdrop-blur px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-forest-100">Saunafreunde — Check-in</h1>
        <p className="text-xs text-forest-300/70 mt-0.5">QR-Karte scannen oder persönlichen Code eingeben</p>
      </header>

      <div className="no-print flex flex-col flex-1 max-w-xl mx-auto w-full p-4 gap-4">

        {/* Modus-Auswahl */}
        {mode === 'idle' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <button
              onClick={() => setMode('scan')}
              className="rounded-2xl bg-forest-600/20 ring-2 ring-forest-500/40 p-6 text-center hover:bg-forest-600/30 transition"
            >
              <div className="text-5xl mb-3">📷</div>
              <div className="text-lg font-bold text-forest-100">QR scannen</div>
              <div className="text-xs text-forest-300/70 mt-1">Mitgliedsausweis vor Kamera halten</div>
            </button>
            <button
              onClick={() => { setMode('code'); setCodeInput(''); }}
              className="rounded-2xl bg-forest-600/20 ring-2 ring-forest-500/40 p-6 text-center hover:bg-forest-600/30 transition"
            >
              <div className="text-5xl mb-3">🔑</div>
              <div className="text-lg font-bold text-forest-100">Code eingeben</div>
              <div className="text-xs text-forest-300/70 mt-1">Persönlichen Einlass-Code tippen</div>
            </button>
          </div>
        )}

        {/* QR-Scan-Modus */}
        {mode === 'scan' && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: 'none' }} muted playsInline />
            </div>
            <button
              onClick={() => setMode('idle')}
              className="w-full rounded-xl bg-forest-900/80 px-4 py-3 text-sm font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
            >
              ← Zurück
            </button>
          </div>
        )}

        {/* Code-Modus */}
        {mode === 'code' && (
          <div className="space-y-4 mt-4">
            <form onSubmit={handleEntryCode} className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 space-y-4">
              <h2 className="text-base font-semibold text-forest-100 text-center">Einlass-Code eingeben</h2>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Dein persönlicher Code…"
                autoFocus
                autoComplete="off"
                className="w-full rounded-xl bg-forest-900/80 px-4 py-4 text-xl text-center font-mono ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              {attempts > 0 && (
                <p className="text-xs text-rose-300 text-center">
                  {attempts}/{MAX_ATTEMPTS} Fehlversuche — noch {MAX_ATTEMPTS - attempts} übrig.
                </p>
              )}
              <button
                type="submit"
                disabled={!codeInput.trim()}
                className="w-full rounded-xl bg-forest-500 px-5 py-4 text-base font-bold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
              >
                Anmelden
              </button>
            </form>
            <button
              onClick={() => { setMode('idle'); setCodeInput(''); setAttempts(0); }}
              className="w-full rounded-xl bg-forest-900/80 px-4 py-3 text-sm font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
            >
              ← Zurück
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`rounded-xl px-4 py-4 text-base font-semibold text-center ring-1 ${
            toast.kind === 'ok'  ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40' :
            toast.kind === 'err' ? 'bg-rose-500/20 text-rose-100 ring-rose-400/40' :
                                   'bg-forest-900/70 text-forest-200 ring-forest-700/50'
          }`}>
            {toast.text}
          </div>
        )}

        {/* Anwesendenliste — nur für Admins */}
        {isAdmin && <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur mt-auto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-forest-100">
              Anwesend ({present.data?.length ?? 0})
            </h2>
            <button onClick={printList} className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
              Liste drucken
            </button>
          </div>
          <ul className="max-h-48 overflow-y-auto space-y-1.5">
            {!present.data?.length && (
              <li className="text-xs text-forest-300/60">Noch niemand eingecheckt.</li>
            )}
            {(present.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-forest-900/60 px-3 py-1.5 ring-1 ring-forest-800/40">
                <span className="text-sm">{p.name}</span>
                <span className="text-[10px] text-forest-300/60 tabular-nums">
                  {p.last_scan_at ? fmtClock(p.last_scan_at) : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>}
      </div>

      {/* Druckansicht */}
      <div className="hidden print:block p-8 text-black">
        <h1 className="text-2xl font-bold">Evakuierungsliste — {fmtClock(new Date())}</h1>
        <p className="mt-1 text-sm">Saunafreunde Schwarzwald · Stand: {new Date().toLocaleString('de-DE')}</p>
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1 pr-4">#</th>
              <th className="text-left py-1 pr-4">Name</th>
              <th className="text-left py-1">Letzter Scan</th>
            </tr>
          </thead>
          <tbody>
            {(present.data ?? []).map((p, i) => (
              <tr key={p.id} className="border-b border-black/40">
                <td className="py-1 pr-4 align-top">{i + 1}</td>
                <td className="py-1 pr-4">{p.name}</td>
                <td className="py-1">{p.last_scan_at ? new Date(p.last_scan_at).toLocaleString('de-DE') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-xs">Anzahl: {present.data?.length ?? 0}</p>
      </div>
    </div>
  );
}
