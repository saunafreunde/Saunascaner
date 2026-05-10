import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import type { Template } from '@/lib/api';

type TabId = 'mine' | 'team' | 'templates';

interface AtelierTabsProps {
  myInfusions: Infusion[];
  joinableTeamInfusions: Infusion[];
  templates: Template[];
  saunas: Sauna[];
  meisterName: (id: string | null) => string;
  getCoNames: (infusionId: string) => string[];
  isJoined: (infusionId: string) => boolean;
  onDeleteInfusion: (id: string) => void;
  onJoinTeam: (id: string) => void;
  onLeaveTeam: (id: string) => void;
  onApplyTemplate: (t: Template) => void;
  onDeleteTemplate: (id: string) => void;
  isAdmin?: boolean;
  now?: Date;
}

export function AtelierTabs({
  myInfusions,
  joinableTeamInfusions,
  templates,
  saunas,
  meisterName,
  getCoNames,
  isJoined,
  onDeleteInfusion,
  onJoinTeam,
  onLeaveTeam,
  onApplyTemplate,
  onDeleteTemplate,
  isAdmin = false,
  now,
}: AtelierTabsProps) {
  const currentTime = now ?? new Date();
  const canDelete = (i: Infusion) => isAdmin && new Date(i.end_time) > currentTime;
  const handleDelete = (i: Infusion) => {
    const ok = window.confirm(
      `Aufguss "${i.title}" am ${dayLabel(i.start_time)} ${fmtClock(i.start_time)} wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`,
    );
    if (ok) onDeleteInfusion(i.id);
  };
  const [tab, setTab] = useState<TabId>('mine');

  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';
  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '?';

  const tabs: { id: TabId; icon: string; label: string; count: number; pulse?: boolean }[] = [
    { id: 'mine',      icon: '📋', label: 'Geplant',     count: myInfusions.length },
    { id: 'team',      icon: '🤝', label: 'Team',        count: joinableTeamInfusions.length, pulse: joinableTeamInfusions.length > 0 },
    { id: 'templates', icon: '⚡', label: 'Vorlagen',    count: templates.length },
  ];

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-forest-900/40 ring-1 ring-forest-800/30">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition"
            >
              {active && (
                <motion.div
                  layoutId="atelier-active"
                  className="absolute inset-0 rounded-lg bg-forest-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative flex items-center justify-center gap-1.5 ${active ? 'text-forest-950' : 'text-forest-300'}`}>
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.count > 0 && (
                  <motion.span
                    animate={t.pulse ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className={`text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 ${
                      active
                        ? 'bg-forest-950/30 text-forest-950'
                        : t.pulse ? 'bg-amber-500 text-amber-950' : 'bg-forest-800 text-forest-200'
                    }`}
                  >
                    {t.count}
                  </motion.span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content with slide animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
          className="min-h-[120px]"
        >
          {tab === 'mine' && (
            myInfusions.length === 0 ? (
              <EmptyState emoji="🌬️" title="Noch leer hier" subtitle="Trag deinen ersten Aufguss oben ein!" />
            ) : (
              <ul className="space-y-2">
                {myInfusions.map((i) => {
                  const coNames = getCoNames(i.id);
                  return (
                    <li key={i.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-forest-900/60 px-3 py-2.5 ring-1 ring-forest-800/40 hover:ring-forest-600/40 transition"
                      style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {i.title}{i.team_infusion && <span className="ml-1.5 text-xs text-amber-300">👥 Team</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-forest-300/70">
                          <span>{dayLabel(i.start_time)} · {fmtClock(i.start_time)}</span>
                          <span>·</span>
                          <span style={{ color: saunaColor(i.sauna_id) }} className="font-semibold">{saunaName(i.sauna_id)}</span>
                          <span>· {i.duration_minutes} Min</span>
                          {(i.attributes as InfusionAttribute[]).map((a) => (
                            <span key={a} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                          ))}
                        </div>
                        {coNames.length > 0 && <div className="text-xs text-amber-300/80 mt-0.5">+ {coNames.join(', ')}</div>}
                      </div>
                      {canDelete(i) && (
                        <button onClick={() => handleDelete(i)}
                          title="Admin: Aufguss löschen"
                          className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 flex-shrink-0 ring-1 ring-rose-500/20">🗑 Löschen</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === 'team' && (
            joinableTeamInfusions.length === 0 ? (
              <EmptyState emoji="🌿" title="Aktuell keine Team-Aufgüsse" subtitle="Wenn jemand einen 👥-Aufguss anlegt, kannst du beitreten." />
            ) : (
              <ul className="space-y-2">
                {joinableTeamInfusions.map((i) => {
                  const joined = isJoined(i.id);
                  const coNames = getCoNames(i.id);
                  return (
                    <li key={i.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-amber-900/30 px-3 py-2.5 ring-1 ring-amber-800/40"
                      style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate text-amber-50">{i.title}</div>
                        <div className="mt-0.5 text-xs text-amber-200/70">
                          {dayLabel(i.start_time)} · {fmtClock(i.start_time)} · {saunaName(i.sauna_id)}
                        </div>
                        <div className="text-xs text-amber-200/50 mt-0.5">
                          {meisterName(i.saunameister_id)}{coNames.length > 0 && ` + ${coNames.join(', ')}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {joined ? (
                          <button onClick={() => onLeaveTeam(i.id)}
                            className="rounded-md px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 whitespace-nowrap ring-1 ring-rose-500/30">
                            Verlassen
                          </button>
                        ) : (
                          <button onClick={() => onJoinTeam(i.id)}
                            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 whitespace-nowrap">
                            Beitreten
                          </button>
                        )}
                        {canDelete(i) && (
                          <button onClick={() => handleDelete(i)}
                            title="Admin: Aufguss löschen"
                            className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 ring-1 ring-rose-500/20">🗑</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === 'templates' && (
            templates.length === 0 ? (
              <EmptyState emoji="💾" title="Noch keine Vorlagen" subtitle={'„Als Vorlage" speichert die aktuelle Eingabe für später.'} />
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-forest-900/60 px-3 py-2.5 ring-1 ring-forest-800/40 hover:ring-forest-500/40 transition">
                    <button type="button" onClick={() => onApplyTemplate(t)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-forest-300/70">
                        <span>{t.duration_minutes} Min</span>
                        {(t.attributes as InfusionAttribute[]).map((a) => (
                          <span key={a} title={ATTR_BY_ID[a]?.label} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                        ))}
                      </div>
                    </button>
                    <button onClick={() => onDeleteTemplate(t.id)}
                      className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">✕</button>
                  </li>
                ))}
              </ul>
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring' }}
        className="text-4xl mb-2"
      >
        {emoji}
      </motion.div>
      <p className="text-sm font-medium text-forest-200">{title}</p>
      <p className="text-xs text-forest-400 mt-1">{subtitle}</p>
    </div>
  );
}
