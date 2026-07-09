import { useMemo, useState } from 'react';
import {
  useActivityLog, useActivityLogCount, useAllMembers,
  type ActivityLogRow,
} from '@/lib/api';

// Admin-Tab: Audit-Log aller wichtigen Vereins-Aktionen.
// Filter: Zeit (heute/Woche/Monat/custom) + Aktor + Aktions-Kategorie.

type RangePreset = 'today' | 'week' | 'month' | 'all' | 'custom';

const ACTION_GROUPS: Record<string, { label: string; icon: string; prefix: string }> = {
  all:      { label: 'Alle',          icon: '📋',  prefix: '' },
  member:   { label: 'Mitglieder',    icon: '👥',  prefix: 'member.' },
  infusion: { label: 'Aufgüsse',      icon: '🔥',  prefix: 'infusion.' },
  fan:      { label: 'Fan-Anträge',   icon: '🤝',  prefix: 'fan.' },
  news:     { label: 'News',          icon: '📣',  prefix: 'news.' },
  recipe:   { label: 'Rezepte',       icon: '🌿',  prefix: 'recipe.' },
  evac:     { label: 'Notfall',       icon: '🚨',  prefix: 'evacuation.' },
};

// Aktions-Label: aus dem action-Pattern menschenlesbares Label machen
const ACTION_LABELS: Record<string, string> = {
  'member.create':              '+ Mitglied angelegt',
  'member.delete':              '🗑 Mitglied gelöscht',
  'member.role_change':         '🎭 Rolle gewechselt',
  'member.aufgieser_grant':     '🔥 Aufgießer-Status vergeben',
  'member.aufgieser_revoke':    '🔥 Aufgießer-Status entzogen',
  'member.cp_grant':            '🛠️ CP-V vergeben',
  'member.cp_revoke':           '🛠️ CP-V entzogen',
  'member.lock':                '🚫 Mitglied gesperrt',
  'member.unlock':              '✓ Sperre aufgehoben',
  'member.approve':             '✓ Freigegeben',
  'member.paid_until_change':   '💳 Beitragszeitraum geändert',
  'infusion.create':            '+ Aufguss angelegt',
  'infusion.delete':            '🗑 Aufguss gelöscht',
  'infusion.takeover':          '🙋 Aufguss übernommen',
  'infusion.reassign':          '↔ Aufgießer-Wechsel',
  'fan.request':                '📨 Fan-Antrag gestellt',
  'fan.approved':               '✓ Fan-Antrag bestätigt',
  'fan.rejected':               '✕ Fan-Antrag abgelehnt',
  'news.publish':               '📣 News veröffentlicht',
  'news.delete':                '🗑 News gelöscht',
  'recipe.submit':              '🌿 Rezept eingereicht',
  'recipe.approve':             '✓ Rezept freigegeben',
  'recipe.delete':              '🗑 Rezept gelöscht',
  'evacuation.alarm':           '🚨 Notfall-Alarm ausgelöst',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function rangePresetToIso(preset: RangePreset, customFrom: string, customUntil: string): { from: string | null; until: string | null } {
  const now = new Date();
  if (preset === 'all') return { from: null, until: null };
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), until: null };
  }
  if (preset === 'week') {
    const start = new Date(now);
    const dayOfWeek = (start.getDay() + 6) % 7; // Montag = 0
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), until: null };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), until: null };
  }
  // custom
  return {
    from: customFrom ? new Date(customFrom).toISOString() : null,
    until: customUntil ? new Date(customUntil + 'T23:59:59').toISOString() : null,
  };
}

export function ActivityLogTab() {
  const members = useAllMembers();
  const [rangePreset, setRangePreset] = useState<RangePreset>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [actorId, setActorId] = useState<string>('');
  const [actionGroup, setActionGroup] = useState<keyof typeof ACTION_GROUPS>('all');

  const { from, until } = useMemo(
    () => rangePresetToIso(rangePreset, customFrom, customUntil),
    [rangePreset, customFrom, customUntil]
  );

  const filter = useMemo(() => ({
    from, until,
    actor_id: actorId || null,
    action_prefix: ACTION_GROUPS[actionGroup].prefix || null,
    limit: 500,
  }), [from, until, actorId, actionGroup]);

  const logs = useActivityLog(filter);
  const count = useActivityLogCount({
    from, until,
    actor_id: actorId || null,
    action_prefix: ACTION_GROUPS[actionGroup].prefix || null,
  });

  const sortedMembers = useMemo(
    () => (members.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [members.data]
  );

  return (
    <section className="space-y-4">
      {/* Header + Filter */}
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-forest-100">📋 Aktivitäts-Log</h2>
            <p className="text-xs text-forest-300/70">
              Audit-Trail aller wichtigen Vereins-Aktionen — wer hat was wann gemacht.
            </p>
          </div>
          <span className="text-xs text-forest-400 tabular-nums">
            {logs.isLoading ? '…' : `${count.data ?? 0} Einträge`}
          </span>
        </div>

        {/* Zeit-Range-Presets */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries({
            today:  { label: 'Heute',         icon: '📅' },
            week:   { label: 'Diese Woche',   icon: '📆' },
            month:  { label: 'Dieser Monat',  icon: '🗓️' },
            all:    { label: 'Alle',          icon: '∞' },
            custom: { label: 'Custom',        icon: '⚙️' },
          }) as Array<[RangePreset, { label: string; icon: string }]>).map(([key, meta]) => {
            const active = rangePreset === key;
            return (
              <button
                key={key}
                onClick={() => setRangePreset(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  active
                    ? 'bg-forest-500 text-forest-950 ring-forest-400'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                }`}
              >
                <span>{meta.icon}</span><span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom-Range: nur wenn aktiv */}
        {rangePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-forest-300">
              Von
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50"
              />
            </label>
            <label className="text-xs text-forest-300">
              Bis
              <input
                type="date"
                value={customUntil}
                onChange={(e) => setCustomUntil(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50"
              />
            </label>
          </div>
        )}

        {/* Aktor-Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-forest-300">
            Mitglied (Aktor)
            <select
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50"
            >
              <option value="">— Alle Mitglieder —</option>
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-forest-300">
            Aktions-Kategorie
            <select
              value={actionGroup}
              onChange={(e) => setActionGroup(e.target.value as keyof typeof ACTION_GROUPS)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50"
            >
              {Object.entries(ACTION_GROUPS).map(([key, meta]) => (
                <option key={key} value={key}>{meta.icon} {meta.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Log-Liste */}
      <div className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 backdrop-blur overflow-hidden">
        {logs.isLoading ? (
          <p className="p-6 text-center text-sm text-forest-400">Lade…</p>
        ) : (logs.data ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-forest-400/70">
            Keine Einträge im ausgewählten Zeitraum.
          </p>
        ) : (
          <ul className="divide-y divide-forest-800/40">
            {(logs.data ?? []).map((row) => (
              <LogRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>

      {(count.data ?? 0) > (logs.data ?? []).length && (
        <p className="text-center text-xs text-forest-400/80">
          Es gibt {count.data} Einträge — angezeigt werden die {(logs.data ?? []).length} neuesten.
          Schränke den Zeitraum oder Aktor ein, um mehr zu sehen.
        </p>
      )}
    </section>
  );
}

function LogRow({ row }: { row: ActivityLogRow }) {
  const dt = new Date(row.occurred_at);
  const dateStr = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <li className="px-4 py-2.5 hover:bg-forest-900/30 transition">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-forest-100">
            <span className="font-semibold">{actionLabel(row.action)}</span>
            {row.target_label && (
              <span className="text-forest-300"> · {row.target_label}</span>
            )}
          </div>
          <div className="text-[11px] text-forest-400 mt-0.5">
            {row.actor_name ?? 'System'}
            {row.actor_role && <span className="text-forest-500"> · {row.actor_role}</span>}
            {' · '}
            {dateStr} · {timeStr}
          </div>
          {row.details && Object.keys(row.details).length > 0 && (
            <details className="mt-1">
              <summary className="text-[10px] text-forest-500 cursor-pointer hover:text-forest-300">
                Details
              </summary>
              <pre className="mt-1 text-[10px] text-forest-300 font-mono bg-forest-900/60 rounded p-2 overflow-x-auto">
                {JSON.stringify(row.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
