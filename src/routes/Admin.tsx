import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSaunas, useToggleSauna,
  useAllMembers, useAddMember, useUpdateMember,
  useTvSettings, useUpdateTvSettings,
  uploadAsset, deleteAsset, publicAssetUrl,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { downloadBadge } from '@/lib/badge';

type Tab = 'saunas' | 'members' | 'ads';

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

      <nav className="flex gap-2 px-4 pt-3">
        {(['saunas', 'members', 'ads'] as Tab[]).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
              tab === t
                ? 'bg-forest-500 text-forest-950 ring-forest-400'
                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
            }`}
          >
            {t === 'saunas' ? 'Saunen' : t === 'members' ? 'Mitglieder' : 'Werbung'}
          </button>
        ))}
      </nav>

      <div className="mx-auto max-w-5xl p-4">
        {tab === 'saunas' && <SaunasTab />}
        {tab === 'members' && <MembersTab />}
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
