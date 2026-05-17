import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { togglePresenceByCode, togglePresenceByEntryCode, usePresentMembers, useCurrentMember } from '@/lib/api';
import { fmtClock } from '@/lib/time';
import { useFullscreenLock } from '@/hooks/useFullscreenLock';

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

  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

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
          preferredCamera: 'user',
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

  // Tablet-Vollbild: Browser-Chrome ausblenden für sauberen Kiosk-Look
  const { isFullscreen, enterFullscreen } = useFullscreenLock();

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - now) : 0;

  function printList() {
    window.print();
  }

  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100 flex flex-col">

      {/* Vollbild-Fallback: nur sichtbar wenn nicht im Vollbild (z.B. weil Browser
          requestFullscreen blockiert hat). Verschwindet sobald der User reinkommt. */}
      {!isFullscreen && (
        <button
          onClick={enterFullscreen}
          className="fixed top-3 right-3 z-50 rounded-xl bg-amber-500/30 ring-1 ring-amber-400/60 px-3 py-2 text-xs font-semibold text-amber-100 backdrop-blur hover:bg-amber-500/40"
          title="Browser-Chrome ausblenden (volle Bildschirmfläche)"
        >
          📺 Vollbild
        </button>
      )}

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

      {/* ── Idle: 2 riesige Buttons im Querformat ── */}
      {mode === 'idle' && (
        <div className="flex h-screen w-screen gap-4 p-4">
          <button
            onClick={() => setMode('scan')}
            className="flex-1 rounded-3xl bg-forest-600/25 ring-2 ring-forest-500/50 flex flex-col items-center justify-center gap-4 hover:bg-forest-600/35 transition active:scale-[0.98]"
          >
            <div className="text-7xl sm:text-8xl">📷</div>
            <div className="text-3xl sm:text-4xl font-black text-forest-100 text-center leading-tight">
              QR-Code<br />scannen
            </div>
            <div className="text-sm sm:text-base text-forest-300/70 text-center px-4">
              Mitgliedsausweis vor Kamera halten
            </div>
          </button>

          <button
            onClick={() => { setMode('code'); setCodeInput(''); }}
            className="flex-1 rounded-3xl bg-forest-600/25 ring-2 ring-forest-500/50 flex flex-col items-center justify-center gap-4 hover:bg-forest-600/35 transition active:scale-[0.98]"
          >
            <div className="text-7xl sm:text-8xl">🔑</div>
            <div className="text-3xl sm:text-4xl font-black text-forest-100 text-center leading-tight">
              Code<br />eingeben
            </div>
            <div className="text-sm sm:text-base text-forest-300/70 text-center px-4">
              Persönlichen Einlass-Code tippen
            </div>
          </button>
        </div>
      )}

      {/* ── Scan-Modus: Landscape — Kamera links, Status rechts ── */}
      {mode === 'scan' && (
        <div className="flex h-screen w-screen">
          {/* Linke Hälfte: Kamera */}
          <div className="w-1/2 relative bg-black overflow-hidden">
            {/* Frontkamera spiegeln damit Karte richtig erscheint */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              muted
              playsInline
            />
          </div>

          {/* Rechte Hälfte: Status & Steuerung */}
          <div className="w-1/2 flex flex-col items-center justify-center p-8 gap-6">
            <div className="text-center">
              <div className="text-5xl mb-3">📱</div>
              <h2 className="text-xl font-bold text-forest-100 mb-2">QR-Karte scannen</h2>
              <p className="text-sm text-forest-300/70">Halte die Karte links in die Kamera</p>
            </div>

            {toast && (
              <div className={`w-full rounded-2xl px-5 py-4 text-base font-semibold text-center ring-1 ${
                toast.kind === 'ok'  ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40' :
                toast.kind === 'err' ? 'bg-rose-500/20 text-rose-100 ring-rose-400/40' :
                                       'bg-forest-900/70 text-forest-200 ring-forest-700/50'
              }`}>
                {toast.text}
              </div>
            )}

            <button
              onClick={() => setMode('idle')}
              className="w-full rounded-2xl bg-forest-900/80 px-6 py-4 text-base font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              ← Zurück
            </button>
          </div>
        </div>
      )}

      {/* ── Code-Modus ── */}
      {mode === 'code' && (
        <div className="flex h-screen w-screen items-center justify-center p-8">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔑</div>
              <h2 className="text-2xl font-bold text-forest-100">Einlass-Code eingeben</h2>
            </div>

            <form onSubmit={handleEntryCode} className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 space-y-4">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Dein persönlicher Code…"
                autoFocus
                autoComplete="off"
                className="w-full rounded-xl bg-forest-900/80 px-4 py-4 text-2xl text-center font-mono ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              {attempts > 0 && (
                <p className="text-xs text-rose-300 text-center">
                  {attempts}/{MAX_ATTEMPTS} Fehlversuche — noch {MAX_ATTEMPTS - attempts} übrig.
                </p>
              )}
              <button
                type="submit"
                disabled={!codeInput.trim()}
                className="w-full rounded-xl bg-forest-500 px-5 py-4 text-xl font-bold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
              >
                Anmelden
              </button>
            </form>

            {toast && (
              <div className={`rounded-xl px-4 py-4 text-base font-semibold text-center ring-1 ${
                toast.kind === 'ok'  ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40' :
                toast.kind === 'err' ? 'bg-rose-500/20 text-rose-100 ring-rose-400/40' :
                                       'bg-forest-900/70 text-forest-200 ring-forest-700/50'
              }`}>
                {toast.text}
              </div>
            )}

            <button
              onClick={() => { setMode('idle'); setCodeInput(''); setAttempts(0); }}
              className="w-full rounded-xl bg-forest-900/80 px-4 py-3 text-base font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
            >
              ← Zurück
            </button>
          </div>
        </div>
      )}

      {/* Anwesendenliste — nur für Admins, als Overlay unten rechts im Idle-Modus */}
      {mode === 'idle' && isAdmin && (
        <div className="fixed bottom-4 right-4 z-10 no-print">
          <details className="rounded-2xl bg-forest-950/90 ring-1 ring-forest-800/50 backdrop-blur overflow-hidden">
            <summary className="px-4 py-2 text-xs font-semibold text-forest-200 cursor-pointer select-none list-none">
              👥 Anwesend ({present.data?.length ?? 0})
              <button onClick={(e) => { e.preventDefault(); printList(); }} className="ml-3 text-forest-400 hover:text-forest-200 underline text-[10px]">
                Drucken
              </button>
            </summary>
            <ul className="max-h-48 overflow-y-auto px-4 pb-3 space-y-1.5 border-t border-forest-800/40 pt-2 mt-1">
              {!present.data?.length && (
                <li className="text-xs text-forest-300/60">Noch niemand eingecheckt.</li>
              )}
              {(present.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-forest-900/60 px-3 py-1.5 ring-1 ring-forest-800/40">
                  <span className="text-sm">{p.name}</span>
                  <span className="text-[10px] text-forest-300/60 tabular-nums ml-3">
                    {p.last_scan_at ? fmtClock(p.last_scan_at) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

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
