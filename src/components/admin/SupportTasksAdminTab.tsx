import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useOpenSupportTasks, useCreateSupportTask, useArchiveSupportTask,
  useUnarchiveSupportTask, useMarkHelperFulfilled, useTaskHelpers,
  useApproveHelper, useRejectHelper,
  SUPPORT_CATEGORY_META,
  type SupportTaskCategory, type SupportTaskVisibility, type SupportTask,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';

export function SupportTasksAdminTab() {
  const tasks = useOpenSupportTasks();
  const create = useCreateSupportTask();
  const archive = useArchiveSupportTask();
  const unarchive = useUnarchiveSupportTask();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | SupportTaskCategory>('all');
  const [error, setError] = useState<string | null>(null);

  // Form-State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportTaskCategory>('other');
  const [visibility, setVisibility] = useState<SupportTaskVisibility>('all');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxHelpers, setMaxHelpers] = useState<string>('');
  const [location, setLocation] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks.data ?? [];
    return (tasks.data ?? []).filter((t) => t.category === filter);
  }, [tasks.data, filter]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0) return setError('Titel erforderlich');
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        category,
        visibility,
        start_time: startTime || null,
        end_time: endTime || null,
        max_helpers: maxHelpers ? parseInt(maxHelpers, 10) : null,
        location: location.trim() || null,
        requires_approval: requiresApproval,
      });
      setTitle(''); setDescription(''); setCategory('other'); setVisibility('all');
      setStartTime(''); setEndTime(''); setMaxHelpers(''); setLocation('');
      setRequiresApproval(false);
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-forest-100">🤝 Helfer-Aufgaben</h2>
          <p className="text-xs text-forest-400/80 mt-0.5">
            Aufgaben für Unterstützer-Mitglieder. Termine + offene Pools.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
        >
          {showForm ? '× Abbrechen' : '+ Neue Aufgabe'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl bg-forest-950/85 ring-1 ring-amber-500/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-300">Neue Aufgabe anlegen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-forest-400 mb-1">Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-forest-400 mb-1">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportTaskCategory)}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              >
                {(['event','care','material','social','other'] as SupportTaskCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {SUPPORT_CATEGORY_META[c].emoji} {SUPPORT_CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Sichtbarkeit</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as SupportTaskVisibility)}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              >
                <option value="all">Alle Mitglieder</option>
                <option value="member_only">Nur Vereinsmitglieder</option>
                <option value="staff_only">Nur Personal</option>
                <option value="aufgieser">Nur Aufgießer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Termin Start (optional)</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Termin Ende (optional)</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Max. Helfer (leer = unbegrenzt)</label>
              <input
                type="number"
                min={1}
                value={maxHelpers}
                onChange={(e) => setMaxHelpers(e.target.value)}
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div>
              <label className="block text-xs text-forest-400 mb-1">Ort (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder='"Vereinsraum", "Sauna 2"…'
                className="w-full rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 text-sm text-forest-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-forest-600 bg-forest-900 text-amber-500"
                />
                <span>
                  <strong className="text-amber-200">🛡️ Freigabe erforderlich</strong>
                  <span className="block text-[11px] text-forest-400 mt-0.5">
                    Helfer-Anmeldungen sind erst nach deiner Zustimmung gültig. Für Events
                    mit Vorab-Auswahl oder Aufgaben die bestimmte Skills brauchen.
                  </span>
                </span>
              </label>
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-sm text-red-200">{error}</div>}
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {create.isPending ? 'Erstelle…' : 'Aufgabe veröffentlichen'}
          </button>
        </form>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs ring-1 ${filter === 'all' ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50' : 'bg-forest-900/60 text-forest-300 ring-forest-800/50'}`}
        >
          Alle ({tasks.data?.length ?? 0})
        </button>
        {(['event','care','material','social','other'] as SupportTaskCategory[]).map((c) => {
          const cnt = (tasks.data ?? []).filter((t) => t.category === c).length;
          const meta = SUPPORT_CATEGORY_META[c];
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full px-3 py-1 text-xs ring-1 ${filter === c ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50' : 'bg-forest-900/60 text-forest-300 ring-forest-800/50'}`}
            >
              {meta.emoji} {meta.label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Aufgaben-Liste */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-forest-400 py-6">
          Keine Aufgaben in dieser Kategorie. Lege oben eine neue an.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <AdminTaskRow task={t} onArchive={(reason) => archive.mutate({ id: t.id, reason })} onUnarchive={() => unarchive.mutate(t.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminTaskRow({ task, onArchive }: {
  task: SupportTask;
  onArchive: (reason?: string) => void;
  onUnarchive: () => void;
}) {
  const helpers = useTaskHelpers(task.id);
  const mark = useMarkHelperFulfilled();
  const approveHelper = useApproveHelper();
  const rejectHelper = useRejectHelper();
  const [expanded, setExpanded] = useState(task.pending_count > 0);
  const cat = SUPPORT_CATEGORY_META[task.category];

  return (
    <article className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-forest-100">{task.title}</h3>
            <span className="text-[10px] text-forest-400">{cat.label}</span>
            <span className="text-[10px] text-forest-400">· {task.visibility === 'all' ? 'alle' : task.visibility}</span>
            {task.start_time && (
              <span className="text-[10px] text-amber-300">
                · 🗓️ {new Date(task.start_time).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {task.description && <p className="mt-1 text-sm text-forest-300/80 whitespace-pre-wrap">{task.description}</p>}
          <div className="mt-1 text-[11px] text-forest-500">
            erstellt vor {formatDistanceToNow(new Date(task.created_at), { locale: de })}
            {' · '}
            <span className="text-forest-300 font-semibold">{task.helper_count}</span>
            {task.max_helpers ? ` von ${task.max_helpers}` : ''} Helfer
            {task.requires_approval && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 px-1.5 py-0.5 font-semibold">
                🛡️ Freigabe nötig
              </span>
            )}
            {task.pending_count > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-600/20 text-amber-200 ring-1 ring-amber-600/40 px-1.5 py-0.5 font-semibold animate-pulse">
                {task.pending_count} ⏳ wartet
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg bg-forest-900/70 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800"
          >
            {expanded ? 'Helfer ausblenden' : 'Helfer anzeigen'}
          </button>
          <button
            onClick={() => {
              const reason = prompt('Grund? (z.B. „erledigt" oder „abgesagt")', 'erledigt');
              if (reason !== null) onArchive(reason);
            }}
            className="rounded-lg bg-emerald-500/15 text-emerald-200 px-3 py-1 text-xs ring-1 ring-emerald-500/40 hover:bg-emerald-500/25"
          >
            ✓ Archivieren
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pl-9 space-y-3">
          {helpers.isLoading ? (
            <p className="text-xs text-forest-400">Lädt…</p>
          ) : (() => {
            const list = (helpers.data ?? []).filter((h) => !h.left_at);
            const pending = list.filter((h) => !h.approved_at && !h.rejected_at);
            const approved = list.filter((h) => h.approved_at);
            const rejected = list.filter((h) => h.rejected_at);
            if (list.length === 0) return <p className="text-xs text-forest-500">Noch keine Helfer angemeldet.</p>;
            return (
              <>
                {pending.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold mb-1.5">
                      ⏳ Warten auf Freigabe ({pending.length})
                    </div>
                    <ul className="space-y-2">
                      {pending.map((h) => (
                        <li key={h.member_id} className="flex items-center gap-2 rounded-lg bg-amber-900/15 ring-1 ring-amber-500/30 px-2.5 py-1.5">
                          <Avatar name={h.name} avatarPath={h.avatar_path} size="sm" isAufgieser={h.is_aufgieser} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-forest-100 font-medium">{h.name}</div>
                            {h.note && <div className="text-[11px] text-amber-400/90">„{h.note}"</div>}
                          </div>
                          <button
                            onClick={() => approveHelper.mutate({ taskId: task.id, memberId: h.member_id })}
                            className="rounded-lg bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/30"
                          >
                            ✓ Zuweisen
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`${h.name} ablehnen?`)) {
                                rejectHelper.mutate({ taskId: task.id, memberId: h.member_id });
                              }
                            }}
                            className="rounded-lg bg-red-900/30 text-red-300 ring-1 ring-red-700/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-red-900/50"
                          >
                            ✗ Ablehnen
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {approved.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-semibold mb-1.5">
                      ✓ Zugewiesen ({approved.length})
                    </div>
                    <ul className="space-y-2">
                      {approved.map((h) => (
                        <li key={h.member_id} className="flex items-center gap-2 rounded-lg bg-forest-900/60 px-2.5 py-1.5">
                          <Avatar name={h.name} avatarPath={h.avatar_path} size="sm" isAufgieser={h.is_aufgieser} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-forest-100 font-medium">{h.name}</div>
                            {h.note && <div className="text-[11px] text-amber-400/90">„{h.note}"</div>}
                          </div>
                          <button
                            onClick={() => mark.mutate({ taskId: task.id, memberId: h.member_id, fulfilled: !h.fulfilled_at })}
                            className={`rounded-lg px-2.5 py-1 text-[11px] ring-1 transition ${
                              h.fulfilled_at
                                ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40'
                                : 'bg-forest-900 text-forest-300 ring-forest-700/50 hover:bg-forest-800'
                            }`}
                          >
                            {h.fulfilled_at ? '✓ Erfüllt' : 'Als erfüllt markieren'}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Zuweisung von ${h.name} zurückziehen?`)) {
                                rejectHelper.mutate({ taskId: task.id, memberId: h.member_id });
                              }
                            }}
                            title="Zuweisung zurückziehen"
                            className="rounded-lg bg-forest-900 text-forest-500 ring-1 ring-forest-700/40 px-2 py-1 text-[11px] hover:bg-red-900/30 hover:text-red-300"
                          >
                            ✗
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rejected.length > 0 && (
                  <details className="text-[11px] text-forest-500">
                    <summary className="cursor-pointer hover:text-forest-300">
                      {rejected.length} abgelehnt
                    </summary>
                    <ul className="mt-1 space-y-1 ml-3">
                      {rejected.map((h) => (
                        <li key={h.member_id} className="flex items-center gap-2 opacity-70">
                          <Avatar name={h.name} avatarPath={h.avatar_path} size="xs" />
                          <span>{h.name}</span>
                          <button
                            onClick={() => approveHelper.mutate({ taskId: task.id, memberId: h.member_id })}
                            className="text-emerald-400 hover:text-emerald-300 underline text-[10px]"
                          >
                            Doch zuweisen
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
        </div>
      )}
    </article>
  );
}
