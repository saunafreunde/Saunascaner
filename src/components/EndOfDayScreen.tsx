import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Infusion } from '@/types/database';
import type { MeisterDirectoryEntry } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { OIL_BY_ID } from '@/lib/oils';

/**
 * Tagesabschluss-Screen für die TV-Tafel — wird angezeigt wenn alle
 * Aufgüsse des Tages vorbei sind und es noch vor dem 21-Uhr-Wechsel
 * auf den nächsten Tag ist. Statt einer leeren Tafel sieht man:
 *   - Verabschiedung + gute Heimfahrt
 *   - Heutige Aufgießer mit Avatar + Aufguss-Anzahl
 *   - Top-Öle des Tages
 *   - Top-Besonderheiten des Tages
 *   - Daten + Fakten
 */
export function EndOfDayScreen({
  infusions,
  meisterDir,
}: {
  /** Alle Aufgüsse (gleicher Stand wie die Tafel — wird intern auf "heute" gefiltert). */
  infusions: Infusion[];
  meisterDir: MeisterDirectoryEntry[];
}) {
  // Heutige nicht-personal-fallback Aufgüsse (also wirklich abgehaltene Aufgüsse)
  const todayInfs = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    return infusions.filter((i) => {
      if (i.is_personal_fallback) return false;
      const s = new Date(i.start_time);
      return s >= today && s < tomorrow;
    });
  }, [infusions]);

  // Pro Aufgießer: Anzahl + Meta
  const meisterStats = useMemo(() => {
    const map = new Map<string, { count: number; entry: MeisterDirectoryEntry }>();
    for (const i of todayInfs) {
      if (!i.saunameister_id) continue;
      const entry = meisterDir.find((m) => m.id === i.saunameister_id);
      if (!entry) continue;
      const cur = map.get(entry.id) ?? { count: 0, entry };
      cur.count += 1;
      map.set(entry.id, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [todayInfs, meisterDir]);

  // Top-Öle des Tages
  const topOils = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of todayInfs) {
      for (const o of (i.oils ?? [])) {
        if (!o) continue;
        m.set(o, (m.get(o) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .map(([id, count]) => ({ id, count, meta: OIL_BY_ID[id] }))
      .filter((x) => !!x.meta)
      .sort((a, b) => b.count - a.count);
  }, [todayInfs]);

  // Top-Besonderheiten des Tages
  const topAttrs = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of todayInfs) {
      for (const a of i.attributes ?? []) {
        m.set(a, (m.get(a) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .map(([id, count]) => ({ id, count, meta: ATTR_BY_ID[id as InfusionAttribute] }))
      .filter((x) => !!x.meta)
      .sort((a, b) => b.count - a.count);
  }, [todayInfs]);

  const totalAufguesse = todayInfs.length;
  const teamCount = todayInfs.filter((i) => i.team_infusion).length;

  const todayLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      className="flex flex-1 min-w-0 min-h-0 flex-col items-center justify-start overflow-y-auto py-8 px-12 text-slate-800"
    >
      {/* Header: Verabschiedung */}
      <div className="text-center mb-8">
        <div className="text-7xl mb-3">🌙</div>
        <h1 className="text-5xl font-black text-slate-900 leading-tight">
          Feierabend!
        </h1>
        <p className="mt-2 text-xl text-slate-700">
          Gute Heimfahrt 🚗 — bis bald in der Sauna!
        </p>
        <p className="mt-1 text-sm text-slate-500 uppercase tracking-widest">{todayLabel}</p>
      </div>

      {/* Daten + Fakten Hauptzahl */}
      {totalAufguesse > 0 ? (
        <div className="text-center mb-8 rounded-3xl bg-white/85 backdrop-blur-md ring-1 ring-amber-500/30 px-8 py-5 shadow-lg">
          <div className="text-5xl font-black text-amber-700 tabular-nums">
            {totalAufguesse}
          </div>
          <div className="text-base font-medium text-slate-700 mt-1">
            {totalAufguesse === 1 ? 'Aufguss heute' : 'Aufgüsse heute'}
            {meisterStats.length > 0 && (
              <> · {meisterStats.length} {meisterStats.length === 1 ? 'Aufgießer' : 'Aufgießer'}</>
            )}
            {teamCount > 0 && <> · {teamCount} 👥 Team</>}
          </div>
        </div>
      ) : (
        <div className="text-center mb-8 text-slate-600 italic">
          Heute kein Aufguss-Tag — bis zum nächsten Mal!
        </div>
      )}

      {/* Aufgießer-Galerie */}
      {meisterStats.length > 0 && (
        <section className="w-full max-w-5xl mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 text-center">
            🧖 Heute am Aufguss-Eimer
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {meisterStats.map(({ entry, count }) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center"
              >
                <Avatar
                  name={entry.sauna_name || entry.name}
                  avatarPath={entry.avatar_path}
                  size="lg"
                  isAufgieser
                  isGuest={entry.role === 'guest_aufgieser'}
                />
                <div className="mt-2 text-center max-w-[140px]">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {entry.sauna_name || entry.name}
                  </p>
                  <p className="text-xs text-amber-700 font-bold tabular-nums">
                    {count}× heute
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Zwei-Spalten: Öle + Besonderheiten */}
      {(topOils.length > 0 || topAttrs.length > 0) && (
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Öle */}
          {topOils.length > 0 && (
            <div className="rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-amber-500/30 overflow-hidden shadow-md">
              <div className="bg-amber-500/20 text-amber-800 font-bold uppercase tracking-widest text-xs px-4 py-2">
                🌿 Heute verwendete Öle
              </div>
              <ul className="p-4 space-y-1.5">
                {topOils.map(({ id, count, meta }) => (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="text-base flex-shrink-0">{meta.emoji}</span>
                    <span className="flex-1 truncate text-slate-700">
                      <span className="text-amber-800/60 tabular-nums">#{meta.number}</span> {meta.name}
                    </span>
                    <span className="text-amber-800 font-bold tabular-nums text-xs">
                      {count}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Besonderheiten */}
          {topAttrs.length > 0 && (
            <div className="rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-slate-400/30 overflow-hidden shadow-md">
              <div className="bg-slate-500/15 text-slate-700 font-bold uppercase tracking-widest text-xs px-4 py-2">
                ⚡ Heute gewählte Besonderheiten
              </div>
              <ul className="p-4 space-y-1.5">
                {topAttrs.map(({ id, count, meta }) => (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="text-base flex-shrink-0">{meta.emoji}</span>
                    <span className="flex-1 truncate text-slate-700">{meta.label}</span>
                    <span className="text-slate-800 font-bold tabular-nums text-xs">
                      {count}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Verabschiedung Footer */}
      <div className="text-center mt-auto pt-6 text-sm text-slate-500 italic">
        Saunafreunde Schwarzwald e.V. · Genießt den Abend 🥂
      </div>
    </motion.div>
  );
}
