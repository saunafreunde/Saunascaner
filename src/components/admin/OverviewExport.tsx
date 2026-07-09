import { useMemo, useState } from 'react';
import { useInfusionsRange, useMeisterDirectory } from '@/lib/api';
import { aggregateOverview } from '@/lib/overviewStats';
import { generateEndOfDayPdf, shareEndOfDayPdf, downloadBlob, type EndOfDayPdfData } from '@/lib/endOfDayPdf';

// Admin-Übersichten im „Feierabend"-Design als PDF — Tag / Woche / Monat.
// Aggregiert echte Aufgüsse des Zeitraums (wer hat aufgegossen, Öle,
// Besonderheiten) und bietet Download + Teilen (System/WhatsApp/E-Mail).

type Period = 'day' | 'week' | 'month';

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type RangeInfo = {
  from: Date;
  to: Date;
  periodLabel: string;
  periodWord: string;
  title: string;
  subtitle: string;
  footerNote: string;
  fileTag: string;
};

function periodRange(period: Period, offset: number): RangeInfo {
  const today = startOfDay(new Date());
  if (period === 'day') {
    const from = addDays(today, offset);
    const to = addDays(from, 1);
    const weekday = from.toLocaleDateString('de-DE', { weekday: 'long' });
    return {
      from, to,
      periodLabel: from.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      periodWord: offset === 0 ? 'heute' : offset === -1 ? 'gestern' : weekday,
      title: 'Tagesabschluss',
      subtitle: 'Wer hat aufgegossen',
      footerNote: 'Genießt den Abend',
      fileTag: `Tag-${isoDate(from)}`,
    };
  }
  if (period === 'week') {
    const from = addDays(mondayOf(today), offset * 7);
    const to = addDays(from, 7);
    const end = addDays(from, 6);
    return {
      from, to,
      periodLabel: `${from.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      periodWord: 'diese Woche',
      title: 'Wochen-Übersicht',
      subtitle: 'Aufguss-Übersicht der Woche',
      footerNote: 'Danke für die Woche',
      fileTag: `Woche-${isoDate(from)}`,
    };
  }
  // month
  const from = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return {
    from, to,
    periodLabel: `${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
    periodWord: 'diesen Monat',
    title: 'Monats-Übersicht',
    subtitle: 'Aufguss-Übersicht des Monats',
    footerNote: 'Danke für den Monat',
    fileTag: `Monat-${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
  };
}

export function OverviewExport() {
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0); // 0 = aktuell, -1 = vorherige …

  const range = useMemo(() => periodRange(period, offset), [period, offset]);
  const infs = useInfusionsRange(range.from, range.to);
  const meisterDir = useMeisterDirectory();

  const agg = useMemo(
    () => aggregateOverview(infs.data ?? [], meisterDir.data ?? []),
    [infs.data, meisterDir.data]
  );

  const pdfData: EndOfDayPdfData = {
    todayLabel: range.periodLabel,
    title: range.title,
    subtitle: range.subtitle,
    periodWord: range.periodWord,
    footerNote: range.footerNote,
    ...agg,
  };

  const [busy, setBusy] = useState<null | 'download' | 'share'>(null);

  function handleDownload() {
    setBusy('download');
    try {
      const blob = generateEndOfDayPdf(pdfData);
      downloadBlob(blob, `${range.title}-${range.fileTag}.pdf`);
    } finally {
      setBusy(null);
    }
  }
  async function handleShare() {
    setBusy('share');
    try {
      const blob = generateEndOfDayPdf(pdfData);
      await shareEndOfDayPdf(blob, `${range.title} ${range.periodLabel}`);
    } finally {
      setBusy(null);
    }
  }

  const shareText = `📊 ${range.title} · ${range.periodLabel} — Saunafreunde Schwarzwald\n\n${agg.totalAufguesse} Aufgüsse · ${agg.meisters.length} Aufgießer${agg.teamCount > 0 ? ` · ${agg.teamCount} Team-Aufguss${agg.teamCount === 1 ? '' : 'e'}` : ''}`;
  function handleWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${range.title} ${range.periodLabel}`)}&body=${encodeURIComponent(shareText)}`;
  }

  const PERIODS: { key: Period; label: string; icon: string }[] = [
    { key: 'day', label: 'Tag', icon: '🌙' },
    { key: 'week', label: 'Woche', icon: '🗓️' },
    { key: 'month', label: 'Monat', icon: '📆' },
  ];

  const loading = infs.isLoading || meisterDir.isLoading;

  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
      <div>
        <h2 className="text-base font-semibold text-forest-100">📊 Aufguss-Übersichten (PDF)</h2>
        <p className="mt-1 text-xs text-forest-300/70">
          Wer hat wann aufgegossen, welche Öle &amp; Besonderheiten — im „Feierabend"-Design.
          Als PDF herunterladen oder direkt teilen.
        </p>
      </div>

      {/* Zeitraum-Typ */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriod(p.key); setOffset(0); }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition ${
              period === p.key
                ? 'bg-amber-500/25 text-amber-100 ring-amber-500/50'
                : 'bg-forest-900/60 text-forest-300 ring-forest-800/40 hover:bg-forest-800'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Zeitraum-Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOffset((o) => o - 1)}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 hover:ring-amber-500/40"
        >
          ←
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-forest-100">{range.periodLabel}</div>
          <div className="text-[11px] text-forest-400">
            {loading ? 'lädt…' : `${agg.totalAufguesse} Aufgüsse · ${agg.meisters.length} Aufgießer${agg.teamCount > 0 ? ` · ${agg.teamCount} Team` : ''}`}
          </div>
        </div>
        <button
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 hover:ring-amber-500/40 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* Aktionen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={handleDownload}
          disabled={busy !== null || loading}
          className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-400/50 hover:bg-amber-500 disabled:opacity-50"
        >
          {busy === 'download' ? 'Erstelle…' : '📥 Als PDF'}
        </button>
        <button
          onClick={handleShare}
          disabled={busy !== null || loading}
          className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-400/50 hover:bg-amber-500 disabled:opacity-50"
        >
          {busy === 'share' ? 'Teile…' : '📤 Teilen…'}
        </button>
        <button
          onClick={handleWhatsapp}
          className="rounded-lg bg-forest-900/60 text-forest-200 px-3 py-2 text-sm font-semibold ring-1 ring-forest-800/40 hover:bg-forest-800"
        >
          💬 WhatsApp
        </button>
        <button
          onClick={handleEmail}
          className="rounded-lg bg-forest-900/60 text-forest-200 px-3 py-2 text-sm font-semibold ring-1 ring-forest-800/40 hover:bg-forest-800"
        >
          ✉️ E-Mail
        </button>
      </div>
      <p className="text-[10px] text-forest-500">
        „Teilen…" öffnet auf dem Handy das System-Menü (Instagram, Telegram, …). WhatsApp/E-Mail
        senden Text + Zahlen; das PDF selbst hängst du per „Als PDF" bzw. „Teilen…" an.
      </p>
    </section>
  );
}
