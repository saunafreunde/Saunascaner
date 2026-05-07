import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { togglePresenceByCode, usePresentMembers } from '@/lib/api';
import { fmtClock } from '@/lib/time';

type Toast = { kind: 'ok' | 'err' | 'info'; text: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractCode(payload: string): string | null {
  // Accept either the raw UUID or a URL with ?c=<uuid> or /m/<uuid>
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

export default function Scanner() {
  const present = usePresentMembers();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [manual, setManual] = useState('');

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }

  async function handleCode(payload: string) {
    const code = extractCode(payload.trim());
    if (!code) {
      showToast({ kind: 'err', text: 'QR ungültig (keine Mitglieds-ID erkannt).' });
      return;
    }
    // De-dupe rapid re-scans of the same code (camera fires repeatedly)
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { code, at: now };

    try {
      const r = await togglePresenceByCode(code);
      showToast({
        kind: 'ok',
        text: `${r.name}: ${r.is_present ? 'eingecheckt ✅' : 'ausgecheckt 👋'}`,
      });
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAA==').play().catch(() => {}); } catch { /* */ }
      // Refresh present list — useQuery polls realtime via app realtime sync, but force refetch:
      await present.refetch();
    } catch (e) {
      const msg = (e as Error).message ?? 'Fehler';
      showToast({ kind: 'err', text: msg.includes('unknown_or_revoked') ? 'Ausweis unbekannt oder gesperrt.' : msg });
    }
  }

  async function start() {
    if (!videoRef.current) return;
    if (scannerRef.current) return;
    try {
      const s = new QrScanner(
        videoRef.current,
        (r) => handleCode(r.data),
        { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true }
      );
      await s.start();
      scannerRef.current = s;
      setRunning(true);
    } catch (e) {
      showToast({ kind: 'err', text: `Kamera-Fehler: ${(e as Error).message}` });
    }
  }

  function stop() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setRunning(false);
  }

  useEffect(() => {
    return () => stop();
  }, []);

  function printList() {
    window.print();
  }

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      <header className="no-print border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold text-forest-100">Scanner</h1>
          <p className="text-xs text-forest-300/80">QR-Ausweise einchecken / auschecken</p>
        </div>
        <Link to="/planner" className="text-xs sm:text-sm text-forest-300 hover:text-forest-100 underline">← Planner</Link>
      </header>

      <div className="no-print mx-auto grid max-w-5xl gap-4 p-3 sm:p-6 lg:grid-cols-[3fr_2fr]">
        {/* Linke Spalte: Kamera + Manuell */}
        <section className="space-y-4">
          <div className="rounded-2xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50 backdrop-blur">
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black grid place-items-center">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!running && (
                <div className="absolute text-sm text-forest-300/70 pointer-events-none">Kamera nicht aktiv</div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {!running ? (
                <button onClick={start} className="flex-1 rounded-xl bg-forest-500 px-4 py-3 font-semibold text-forest-950 hover:bg-forest-400">
                  Kamera starten
                </button>
              ) : (
                <button onClick={stop} className="flex-1 rounded-xl bg-forest-900/80 px-4 py-3 font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900">
                  Stoppen
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); if (manual) { handleCode(manual); setManual(''); } }}
            className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur"
          >
            <h2 className="text-sm font-semibold text-forest-100">Manuell eingeben</h2>
            <p className="mt-1 text-xs text-forest-300/70">Falls QR unlesbar — Mitglieds-ID (UUID).</p>
            <div className="mt-2 flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm font-mono ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              <button type="submit" className="rounded-lg bg-forest-600 px-3 py-2 text-sm font-semibold text-white hover:bg-forest-500">
                Senden
              </button>
            </div>
          </form>

          {toast && (
            <div className={`rounded-xl px-4 py-3 text-base font-medium ring-1 ${
              toast.kind === 'ok'  ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40' :
              toast.kind === 'err' ? 'bg-rose-500/20 text-rose-100 ring-rose-400/40' :
                                     'bg-forest-900/70 text-forest-200 ring-forest-700/50'
            }`}>
              {toast.text}
            </div>
          )}
        </section>

        {/* Rechte Spalte: Anwesendenliste */}
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-forest-100">
              Anwesend ({present.data?.length ?? 0})
            </h2>
            <button onClick={printList} className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
              Evakuierungsliste drucken
            </button>
          </div>
          <ul className="mt-3 max-h-[60vh] overflow-y-auto space-y-1.5">
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
        </section>
      </div>

      {/* Druckansicht: nur Liste, schwarz/weiß */}
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
