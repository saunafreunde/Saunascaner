import { useState } from 'react';
import { useStaffAttendance } from '@/lib/api';

// Anwesenheits-Export für CP-Verantwortliche
// Datums-Range wählen → Daten laden → CSV downloaden
// (PDF-Export wäre nice-to-have, hier nur CSV als Basis-Variante)

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AttendanceExportSection() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState<string>(isoDate(monthAgo));
  const [to, setTo] = useState<string>(isoDate(today));
  const [enabled, setEnabled] = useState(false);

  const data = useStaffAttendance(from, to, enabled);

  const exportCsv = () => {
    const rows: string[][] = [
      ['Mitarbeiter', 'Rolle', 'Check-In', 'Check-Out', 'Dauer (Min)'],
      ...(data.data ?? []).map((r) => [
        r.name,
        r.role,
        new Date(r.check_in_at).toLocaleString('de-DE'),
        r.check_out_at ? new Date(r.check_out_at).toLocaleString('de-DE') : '—',
        String(r.duration_minutes ?? ''),
      ]),
    ];
    downloadCsv(`anwesenheit_${from}_bis_${to}.csv`, rows);
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        📥 Anwesenheits-Export
      </h2>
      <p className="text-xs text-forest-300/80 mb-4">
        Personal-Anwesenheit für den gewählten Zeitraum als CSV exportieren.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-forest-300">
          Von
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setEnabled(false); }}
            className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
        </label>
        <label className="text-xs text-forest-300">
          Bis
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setEnabled(false); }}
            className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
        </label>
      </div>

      {!enabled ? (
        <button
          onClick={() => setEnabled(true)}
          className="w-full rounded-lg bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-2 text-sm font-semibold hover:bg-amber-500/30"
        >
          🔍 Daten laden
        </button>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-forest-300">
            {data.isLoading ? 'Lade…' : `${data.data?.length ?? 0} Einträge gefunden`}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportCsv}
              disabled={!data.data?.length}
              className="rounded-lg bg-amber-500/30 text-amber-100 ring-1 ring-amber-500/50 px-3 py-2 text-sm font-semibold hover:bg-amber-500/40 disabled:opacity-40"
            >
              📥 Als CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={!data.data?.length}
              className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-2 text-sm font-semibold text-forest-200 hover:ring-amber-500/40 disabled:opacity-40"
            >
              🖨️ Drucken / PDF
            </button>
          </div>

          {(data.data?.length ?? 0) > 0 && (
            <div className="overflow-x-auto -mx-1 px-1 mt-3">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-forest-400 text-left">
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Check-In</th>
                    <th className="px-2 py-1">Check-Out</th>
                    <th className="px-2 py-1 text-right">Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.data ?? []).slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-forest-800/30">
                      <td className="px-2 py-1 text-forest-100 truncate max-w-[120px]">{r.name}</td>
                      <td className="px-2 py-1 text-forest-300 font-mono">{new Date(r.check_in_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-2 py-1 text-forest-300 font-mono">{r.check_out_at ? new Date(r.check_out_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-2 py-1 text-amber-200 text-right font-mono">{r.duration_minutes ?? '—'} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.data?.length ?? 0) > 50 && (
                <div className="text-[10px] text-forest-500 text-center mt-2">
                  Anzeige beschränkt auf 50 Einträge — CSV enthält alle.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
