import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSaunas, useToggleSauna,
  useAllMembers, useAddMember, useUpdateMember,
  useTvSettings, useUpdateTvSettings,
  usePresentMembers,
  useStatsByMeister, useStatsByMonth, useStatsPresenceByDay,
  uploadAsset, deleteAsset, publicAssetUrl,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { downloadBadge } from '@/lib/badge';
import { downloadStatsPdf } from '@/lib/statsPdf';
import { fmtClock } from '@/lib/time';

type Tab = 'saunas' | 'members' | 'presence' | 'stats' | 'ads';

export default function Admin() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('saunas');

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold text-forest-100">Admin</h1>
          <p className="text-xs text-forest-300/80">Super-Admin · Stammdaten & Steuerung</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="text-xs text-forest-300 hover:text-forest-100 underline">Tafel</Link>
          <button onClick={() => signOut()} className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
            Abmelden
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 px-4 pt-3">
        {(['saunas', 'members', 'presence', 'stats', 'ads'] as Tab[]).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
              tab === t
                ? 'bg-forest-500 text-forest-950 ring-forest-400'
                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
            }`}
          >
            {t === 'saunas' ? 'Saunen' : t === 'members' ? 'Mitglieder' : t === 'presence' ? 'Anwesenheit' : t === 'stats' ? 'Statistik' : 'Werbung'}
          </button>
        ))}
      </nav>

      <div className="mx-auto max-w-5xl p-4">
        {tab === 'saunas' && <SaunasTab />}
        {tab === 'members' && <MembersTab />}
        {tab === 'presence' && <PresenceTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'ads' && <AdsTab />}
      </div>
    </div>
  );
}

function SaunasTab() {
  const saunasQ = useSaunas();
  const toggle = useToggleSauna();
  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
      <h2 className="text-base font-semibold text-forest-100">Saunen</h2>
      <p className="mt-1 text-xs text-forest-300/70">
        Aktive Saunen erscheinen auf der Tafel. Layout passt sich automatisch an die Anzahl an.
      </p>
      <ul className="mt-3 space-y-2">
        {(saunasQ.data ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-3 ring-1 ring-forest-800/40"
              style={{ borderLeft: `4px solid ${s.accent_color}` }}>
            <div>
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-forest-300/70">{s.temperature_label}</div>
            </div>
            <button
              onClick={() => toggle.mutate({ id: s.id, is_active: !s.is_active })}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${
                s.is_active
                  ? 'bg-emerald-500 text-emerald-950 ring-emerald-400'
                  : 'bg-forest-900/80 text-forest-300 ring-forest-700/50'
              }`}
            >
              {s.is_active ? 'Aktiv' : 'Inaktiv'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MembersTab() {
  const membersQ = useAllMembers();
  const add = useAddMember();
  const update = useUpdateMember();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'saunameister' | 'manager' | 'super_admin' | 'guest_staff'>('saunameister');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name fehlt.');
    try {
      await add.mutateAsync({ name: name.trim(), email: email.trim() || null, role });
      setName(''); setEmail(''); setRole('saunameister');
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
        <h2 className="text-base font-semibold text-forest-100">Mitglied anlegen</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail (optional)"
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'saunameister' | 'manager' | 'super_admin' | 'guest_staff')}
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
            <option value="saunameister">Saunameister</option>
            <option value="manager">Manager</option>
            <option value="super_admin">Super-Admin</option>
            <option value="guest_staff">Service-Personal</option>
          </select>
        </div>
        {error && <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">{error}</div>}
        <button type="submit" disabled={add.isPending}
          className="rounded-lg bg-forest-500 px-4 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
          {add.isPending ? 'Speichere…' : 'Anlegen'}
        </button>
        <p className="text-[11px] text-forest-300/60">
          Hinweis: Damit sich die Person anmelden kann, muss sie sich auf <code>/login</code> selbst registrieren —
          danach wird ihr <code>auth_user_id</code> automatisch verknüpft (Email-Trigger).
        </p>
      </form>

      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h2 className="text-base font-semibold text-forest-100">
          Mitglieder ({membersQ.data?.length ?? 0})
        </h2>
        <ul className="mt-3 divide-y divide-forest-800/40">
          {(membersQ.data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-forest-300/70">
                  {m.role}
                  {m.email && <> · {m.email}</>}
                  {m.is_present && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 text-[10px] font-bold text-emerald-200">anwesend</span>}
                  {m.revoked_at && <span className="ml-2 rounded-full bg-rose-500/20 px-2 text-[10px] font-bold text-rose-200">gesperrt</span>}
                </div>
                <div className="font-mono text-[10px] text-forest-300/50">{m.member_code}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => downloadBadge(m.name, m.member_code, m.role)}
                  className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-500">
                  Ausweis-PDF
                </button>
                <button
                  onClick={() => update.mutate({ id: m.id, revoked_at: m.revoked_at ? null : new Date().toISOString() })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                    m.revoked_at
                      ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30 hover:bg-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-200 ring-rose-500/30 hover:bg-rose-500/30'
                  }`}
                >
                  {m.revoked_at ? 'Entsperren' : 'Sperren'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AdsTab() {
  const tvQ = useTvSettings();
  const update = useUpdateTvSettings();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ads = tvQ.data?.ads ?? [];

  async function onUpload(file: File, slot: number) {
    setBusy(true); setErr(null);
    try {
      const path = await uploadAsset(file, 'ads');
      const next = [...ads];
      // Replace at slot, keep others
      next[slot] = { image_path: path };
      // Remove old asset if was set
      const old = ads[slot]?.image_path;
      if (old) await deleteAsset(old).catch(() => {});
      await update.mutateAsync({
        ads: next,
        background_path: tvQ.data?.background_path ?? null,
        logo_path: tvQ.data?.logo_path ?? null,
      });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onClear(slot: number) {
    setBusy(true); setErr(null);
    try {
      const old = ads[slot]?.image_path;
      const next = ads.filter((_, i) => i !== slot);
      await update.mutateAsync({
        ads: next,
        background_path: tvQ.data?.background_path ?? null,
        logo_path: tvQ.data?.logo_path ?? null,
      });
      if (old) await deleteAsset(old).catch(() => {});
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
      <h2 className="text-base font-semibold text-forest-100">Werbung auf der Tafel</h2>
      <p className="mt-1 text-xs text-forest-300/70">
        Bis zu 4 Bilder werden im Mittelblock gezeigt (sichtbar wenn ≤ 2 Saunen aktiv sind).
      </p>
      {err && <div className="mt-2 rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">{err}</div>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => {
          const url = publicAssetUrl(ads[slot]?.image_path);
          return (
            <div key={slot} className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 grid place-items-center">
                {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-forest-300/50">Slot {slot + 1}</span>}
              </div>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg bg-forest-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-forest-500">
                  {url ? 'Ersetzen' : 'Hochladen'}
                  <input
                    type="file" accept="image/*" hidden disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, slot); e.target.value = ''; }}
                  />
                </label>
                {url && (
                  <button onClick={() => onClear(slot)} disabled={busy}
                    className="rounded-lg bg-rose-500/20 px-2 py-1.5 text-xs text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/30">
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PresenceTab() {
  const present = usePresentMembers();
  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-forest-100">Aktuell anwesend</h2>
          <p className="text-xs text-forest-300/70">Echtzeit aus Scanner-Eincheck.</p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/40">
          {present.data?.length ?? 0}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-forest-800/40">
        {!present.data?.length && <li className="py-4 text-sm text-forest-300/60">Niemand eingecheckt.</li>}
        {(present.data ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2.5">
            <span className="text-sm">{p.name}</span>
            <span className="text-xs text-forest-300/60 tabular-nums">
              {p.last_scan_at ? `seit ${fmtClock(p.last_scan_at)}` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatsTab() {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [mode, setMode] = useState<'month' | 'year'>('month');

  const range = useMemo(() => {
    if (mode === 'year') {
      return {
        from: new Date(Date.UTC(year, 0, 1)),
        to: new Date(Date.UTC(year + 1, 0, 1)),
        label: `${year}`,
      };
    }
    return {
      from: new Date(Date.UTC(year, month - 1, 1)),
      to: new Date(Date.UTC(year, month, 1)),
      label: `${String(month).padStart(2, '0')}/${year}`,
    };
  }, [mode, year, month]);

  const byMeister = useStatsByMeister(range.from, range.to);
  const byMonth = useStatsByMonth(year);
  const presence = useStatsPresenceByDay(range.from, range.to);

  function exportPdf() {
    downloadStatsPdf({
      title: mode === 'year' ? 'Jahresübersicht' : 'Monatsübersicht',
      rangeLabel: range.label,
      byMeister: byMeister.data ?? [],
      byMonth: mode === 'year' ? byMonth.data ?? [] : undefined,
      presence: presence.data ?? [],
    });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-forest-100">Statistik</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg ring-1 ring-forest-800/50 overflow-hidden">
              {(['month', 'year'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    mode === m ? 'bg-forest-500 text-forest-950' : 'bg-forest-900/60 text-forest-200 hover:bg-forest-900'
                  }`}>
                  {m === 'month' ? 'Monat' : 'Jahr'}
                </button>
              ))}
            </div>
            {mode === 'month' && (
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs ring-1 ring-forest-700/50">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            )}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs ring-1 ring-forest-700/50">
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={exportPdf}
              className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-semibold text-forest-950 hover:bg-forest-400">
              📄 PDF Export
            </button>
          </div>
        </div>
        <p className="text-xs text-forest-300/70">Zeitraum: {range.label}</p>
      </div>

      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h3 className="text-sm font-semibold text-forest-100">Aufgüsse pro Saunameister</h3>
        <ul className="mt-3 space-y-1.5">
          {!byMeister.data?.length && <li className="text-xs text-forest-300/60">Keine Aufgüsse im Zeitraum.</li>}
          {(byMeister.data ?? []).map((r) => {
            const max = Math.max(...(byMeister.data ?? []).map((x) => Number(x.count)));
            const pct = max > 0 ? (Number(r.count) / max) * 100 : 0;
            return (
              <li key={r.member_id} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm">{r.name}</span>
                <div className="relative flex-1 h-5 rounded bg-forest-900/60 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-forest-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right text-sm tabular-nums">{r.count}</span>
              </li>
            );
          })}
          {(byMeister.data?.length ?? 0) > 0 && (
            <li className="mt-2 pt-2 border-t border-forest-800/40 flex justify-between text-sm">
              <span className="font-semibold">Summe</span>
              <span className="tabular-nums font-semibold">
                {(byMeister.data ?? []).reduce((s, r) => s + Number(r.count), 0)}
              </span>
            </li>
          )}
        </ul>
      </div>

      {mode === 'year' && (
        <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
          <h3 className="text-sm font-semibold text-forest-100">Aufgüsse pro Monat</h3>
          <div className="mt-3 grid grid-cols-12 gap-1 h-40">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const row = (byMonth.data ?? []).find((x) => x.month === m);
              const c = row ? Number(row.count) : 0;
              const max = Math.max(1, ...(byMonth.data ?? []).map((x) => Number(x.count)));
              const h = (c / max) * 100;
              const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
              return (
                <div key={m} className="flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-forest-300/70">{c || ''}</span>
                  <div className="w-full bg-forest-500 rounded-t" style={{ height: `${h}%`, minHeight: c > 0 ? 2 : 0 }} />
                  <span className="text-[10px] text-forest-300/70">{MN[m-1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h3 className="text-sm font-semibold text-forest-100">Anwesenheit (nächtliche Reset-Zählung)</h3>
        <ul className="mt-3 space-y-1 text-sm">
          {!presence.data?.length && <li className="text-xs text-forest-300/60">Keine Daten — Cron-Job noch nicht gelaufen.</li>}
          {(presence.data ?? []).map((r) => (
            <li key={r.day} className="flex justify-between">
              <span className="tabular-nums">{r.day}</span>
              <span className="tabular-nums">{r.count} Personen</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
