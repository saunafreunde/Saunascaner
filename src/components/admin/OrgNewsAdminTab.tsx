import { useState } from 'react';
import {
  useOrgNews, useCreateOrgNews, useDeleteOrgNews,
  type OrgNews,
} from '@/lib/api';

// Admin-Tab: Vereins-News erstellen, ansehen, löschen.
// Bei Insert wird automatisch Push an alle berechtigten Member geschickt (DB-Trigger).
export function OrgNewsAdminTab() {
  const news = useOrgNews();
  const create = useCreateOrgNews();
  const del = useDeleteOrgNews();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<OrgNews['target_min_role']>('fan');
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError('Titel und Inhalt sind erforderlich.');
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        target_min_role: target,
        pinned,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setTitle(''); setBody(''); setTarget('fan'); setPinned(false); setExpiresAt('');
      setShowForm(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <div>
            <h2 className="text-base font-semibold text-forest-100">📣 Vereins-News</h2>
            <p className="text-xs text-forest-300/70">
              Ankündigungen für Mitglieder. Push-Benachrichtigung wird automatisch ausgelöst.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-semibold text-forest-950 hover:bg-forest-400"
            >
              + Neue News
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-forest-800/40 pt-4 mt-4">
            <label className="block text-xs text-forest-300">
              Titel *
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </label>
            <label className="block text-xs text-forest-300">
              Inhalt *
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                required
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                placeholder="Markdown wird (noch) nicht gerendert — einfacher Text mit Umbrüchen."
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs text-forest-300">
                Sichtbar ab
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as OrgNews['target_min_role'])}
                  className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
                >
                  <option value="gast">👋 Gäste & höher (öffentlich)</option>
                  <option value="fan">🤝 Fans & höher (Premium)</option>
                  <option value="member">✅ Aktiv-Mitglieder & höher (intern)</option>
                </select>
              </label>
              <label className="text-xs text-forest-300">
                Sichtbar bis (optional)
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-forest-300 mt-5">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4"
                />
                📌 Oben festpinnen
              </label>
            </div>
            {error && <div className="text-xs text-rose-200 bg-rose-500/20 ring-1 ring-rose-500/40 rounded px-2 py-1">{error}</div>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={create.isPending}
                className="rounded-lg bg-forest-500 px-4 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-50"
              >
                {create.isPending ? 'Speichere…' : '📣 Veröffentlichen + Push senden'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="rounded-lg bg-forest-900/60 px-3 py-2 text-sm text-forest-300 ring-1 ring-forest-700/40"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h3 className="text-sm font-semibold text-forest-100 mb-3">
          Aktive News ({news.data?.length ?? 0})
        </h3>
        {news.isLoading ? (
          <p className="text-xs text-forest-400">Lade…</p>
        ) : (news.data ?? []).length === 0 ? (
          <p className="text-xs text-forest-400/70">Noch keine veröffentlichten News.</p>
        ) : (
          <ul className="space-y-2 divide-y divide-forest-800/40">
            {(news.data ?? []).map((n) => (
              <li key={n.id} className="pt-2 first:pt-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-forest-100">
                    {n.pinned && '📌 '}{n.title}
                    <span className="ml-2 text-[10px] text-forest-400">
                      [{n.target_min_role === 'gast' ? '👋 öffentlich' : n.target_min_role === 'fan' ? '🤝 Fans+' : '✅ Mitglieder+'}]
                    </span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <time className="text-[10px] text-forest-400">
                      {new Date(n.published_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </time>
                    <button
                      onClick={() => {
                        if (!window.confirm(`News "${n.title}" wirklich löschen?`)) return;
                        del.mutate(n.id);
                      }}
                      title="Löschen"
                      className="text-[10px] text-rose-300 hover:text-rose-200"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <p className="text-xs text-forest-300/80 whitespace-pre-line leading-relaxed">
                  {n.body}
                </p>
                {n.expires_at && (
                  <p className="text-[10px] text-forest-500 mt-1 italic">
                    Läuft ab am {new Date(n.expires_at).toLocaleDateString('de-DE')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
