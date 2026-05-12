import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { addMinutes, isBefore, isSameDay, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useAuth } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useNow';
import { fmtClock, TZ } from '@/lib/time';
import { useSaunas, useInfusions, useMeisterDirectory, useCurrentMember } from '@/lib/api';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { PageBackground } from '@/components/PageBackground';
import { isGast } from '@/lib/roles';

const IMMINENT_MIN = 10;

export default function Guest() {
  const { user } = useAuth();
  const me = useCurrentMember();
  const now = useNow(30_000);
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const membersQ = useMeisterDirectory();

  // Defensive: eingeloggter Gast soll niemals auf der öffentlichen Aufgussliste landen
  if (user && isGast(me.data)) return <Navigate to="/gast" replace />;

  const saunas = saunasQ.data ?? [];
  const infusions = infusionsQ.data ?? [];

  const visibleToday = useMemo(() => {
    const cutoff = addMinutes(now, -5);
    const localNow = toZonedTime(now, TZ);
    return infusions
      .filter((i) => {
        const localStart = toZonedTime(i.start_time, TZ);
        if (!isSameDay(localStart, localNow)) return false;
        return isBefore(cutoff, new Date(i.end_time));
      })
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [now, infusions]);

  const sauna = (id: string) => saunas.find((s) => s.id === id);
  const meister = (id: string | null) =>
    (id && membersQ.data?.find((m) => m.id === id)?.name) || 'Saunameister:in';

  const myArea = me.data?.role === 'gast'
    ? '/gast'
    : me.data?.role === 'admin'
      ? '/admin'
      : '/planner';

  return (
    <PageBackground page="guest">
      <header className="sticky top-0 z-10 border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-5 py-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-forest-100">Aufgüsse heute</h1>
          <p className="text-sm text-forest-300/80">Saunafreunde Schwarzwald · Freudenstadt</p>
        </div>
        {user && me.data ? (
          <Link
            to={myArea}
            className="rounded-xl bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-2 text-xs font-semibold hover:bg-amber-500/30 whitespace-nowrap"
          >
            🏡 Mein Bereich
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-xl bg-forest-900/80 text-forest-200 ring-1 ring-forest-700/50 px-3 py-2 text-xs font-semibold hover:bg-forest-800 whitespace-nowrap"
          >
            🔑 Anmelden
          </Link>
        )}
      </header>

      <ul className="space-y-3 p-4">
        {visibleToday.length === 0 && (
          <li className="rounded-xl bg-forest-950/60 px-5 py-8 text-center text-forest-300/60 ring-1 ring-forest-800/40">
            Heute keine Aufgüsse mehr.
          </li>
        )}
        {visibleToday.map((i) => {
          const s = sauna(i.sauna_id);
          if (!s) return null;
          const start = new Date(i.start_time);
          const minsToStart = differenceInMinutes(start, now);
          const imminent = minsToStart >= 0 && minsToStart <= IMMINENT_MIN;
          const running = now >= start && now < new Date(i.end_time);

          return (
            <li
              key={i.id}
              className={`relative overflow-hidden rounded-xl bg-forest-950/65 ring-1 backdrop-blur ${
                imminent ? 'ring-2 animate-pulse' : 'ring-forest-800/40'
              }`}
              style={imminent ? { boxShadow: `inset 0 0 0 2px ${s.accent_color}` } : undefined}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: s.accent_color }} />
              <div className="flex gap-4 px-4 py-4 pl-5">
                <div className="w-20 shrink-0">
                  <div className="text-3xl font-semibold tabular-nums" style={{ color: s.accent_color }}>
                    {fmtClock(i.start_time)}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-forest-300/70">
                    {i.duration_minutes} Min
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-forest-950" style={{ backgroundColor: s.accent_color }}>
                      {s.name} · {s.temperature_label}
                    </span>
                    {imminent && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 ring-1 ring-rose-400/40">
                        in {minsToStart} Min
                      </span>
                    )}
                    {running && (
                      <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/40">
                        läuft
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-base font-medium text-slate-100">{i.title}</h2>
                  {i.description && <p className="text-sm text-slate-300/80">{i.description}</p>}
                  {i.attributes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(i.attributes as InfusionAttribute[]).map((a) => {
                        const m = ATTR_BY_ID[a];
                        return m ? <span key={a} title={m.label} className="text-base">{m.emoji}</span> : null;
                      })}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-forest-300/70">Aufgießer: {meister(i.saunameister_id)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </PageBackground>
  );
}
