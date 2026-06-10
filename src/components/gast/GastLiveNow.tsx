import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { fmtClock, berlinYmd } from '@/lib/time';
import type { Infusion } from '@/types/database';

type SaunaLite = { name: string; accent_color: string };

interface Props {
  infusions: Infusion[];
  saunaById: Map<string, SaunaLite>;
  meisterName: (id: string | null) => string;
  followedIds: Set<string>;
}

// „Jetzt in der Sauna" — Live-Hero für den Gäste-Bereich.
// Beantwortet die wichtigste Gast-Frage auf einen Blick:
//   • Läuft gerade ein Aufguss? → LIVE-Badge + Fortschrittsbalken
//   • Wann kommt der nächste?   → Countdown
//   • Nichts mehr heute?        → freundlicher Tagesabschluss
// Re-rendert nur per useNow-Tick (30s) — kein JS-Animations-Loop.
export function GastLiveNow({ infusions, saunaById, meisterName, followedIds }: Props) {
  const now = useNow(30_000);

  const { live, next, hadToday } = useMemo(() => {
    const todayYmd = berlinYmd(now);
    const nowMs = now.getTime();
    const todays = infusions
      .filter((i) => !i.is_personal_fallback && i.saunameister_id)
      .filter((i) => berlinYmd(i.start_time) === todayYmd)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    const liveInf = todays.find(
      (i) => new Date(i.start_time).getTime() <= nowMs && nowMs < new Date(i.end_time).getTime(),
    );
    const nextInf = todays.find((i) => new Date(i.start_time).getTime() > nowMs);
    return { live: liveInf ?? null, next: nextInf ?? null, hadToday: todays.length > 0 };
  }, [infusions, now]);

  const inf = live ?? next;
  const sauna = inf ? saunaById.get(inf.sauna_id) : null;
  const accent = sauna?.accent_color ?? '#22c55e';
  const isFav = !!inf?.saunameister_id && followedIds.has(inf.saunameister_id);

  // Fortschritt des laufenden Aufgusses (0..100) für den Balken
  const progress = useMemo(() => {
    if (!live) return 0;
    const start = new Date(live.start_time).getTime();
    const end = new Date(live.end_time).getTime();
    if (end <= start) return 0;
    return Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
  }, [live, now]);

  // Countdown-Label für den nächsten Aufguss
  const countdown = useMemo(() => {
    if (!next) return '';
    const mins = Math.max(1, Math.round((new Date(next.start_time).getTime() - now.getTime()) / 60_000));
    if (mins < 100) return `in ${mins} Min`;
    return `um ${fmtClock(next.start_time)} Uhr`;
  }, [next, now]);

  // ── Leerer Zustand: heute nichts (mehr) ─────────────────────────────────
  if (!inf) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-forest-900/40 via-forest-950/85 to-forest-950/85 ring-1 ring-forest-700/40 p-5 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{hadToday ? '🌙' : '🌱'}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-forest-100">
              {hadToday ? 'Das war’s für heute!' : 'Heute sind noch keine Aufgüsse eingetragen'}
            </h2>
            <p className="mt-0.5 text-xs text-forest-300/80">
              {hadToday
                ? 'Alle Aufgüsse von heute sind durch — bis zum nächsten Mal.'
                : 'Schau später nochmal rein oder wirf einen Blick auf die Tafel.'}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 rounded-xl bg-forest-900/70 px-3 py-2 text-xs font-semibold text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          >
            📺 Tafel
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-950/90 via-forest-950/80 to-forest-950/90 p-5 backdrop-blur"
      style={{ boxShadow: `inset 4px 0 0 ${accent}, 0 0 32px ${accent}18, 0 0 0 1px ${accent}55` }}
    >
      {/* Akzent-Glow oben links */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-14 -left-14 h-36 w-36 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: accent }}
      />

      <div className="relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-950">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-900 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-950" />
              </span>
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-500/40">
              ⏳ Als Nächstes
            </span>
          )}
          <span className="text-[11px] uppercase tracking-widest text-forest-400 font-semibold">
            {live ? 'Jetzt in der Sauna' : countdown}
          </span>
        </div>
        <span className="text-sm font-mono tabular-nums font-bold text-forest-200">
          {fmtClock(inf.start_time)}–{fmtClock(inf.end_time)}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-forest-50 leading-tight truncate">
            {inf.title || 'Aufguss'} {isFav && <span title="Dein Favorit">❤️</span>}
          </h2>
          <p className="mt-1 text-sm text-forest-300/90">
            <span style={{ color: accent }} className="font-semibold">{sauna?.name ?? 'Sauna'}</span>
            {' · '}von {meisterName(inf.saunameister_id)}
          </p>
        </div>
        {inf.saunameister_id && (
          <Link
            to={`/aufgieser/${inf.saunameister_id}`}
            className="shrink-0 rounded-xl bg-amber-500 px-3.5 py-2.5 text-xs font-bold text-amber-950 hover:bg-amber-400 transition"
          >
            Zum Profil →
          </Link>
        )}
      </div>

      {/* Fortschrittsbalken nur bei laufendem Aufguss */}
      {live && (
        <div className="relative mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-forest-900/80 ring-1 ring-forest-800/60">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, #fbbf24)` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-forest-400 tabular-nums">
            läuft noch bis {fmtClock(inf.end_time)} Uhr
          </p>
        </div>
      )}
    </section>
  );
}
