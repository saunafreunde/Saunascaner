import { useMemo, useState } from 'react';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WmAdminTab } from '@/components/admin/WmAdminTab';
import { RecurringAdminTab } from '@/components/admin/RecurringAdminTab';
import { InvitationsTab } from '@/components/admin/InvitationsTab';
import { PostfachDialog } from '@/components/admin/PostfachDialog';
import { BrandingTab } from '@/components/admin/BrandingTab';
import { HandbookTab } from '@/components/admin/HandbookTab';
import { useAdminEmailAccounts, useBrandSettings, brandAssetUrl } from '@/lib/api';
import {
  useSaunas, useToggleSauna,
  useAllMembers, useAddMember, useUpdateMember, useDeleteMember,
  usePendingMembers, useApproveMember, useCurrentMember,
  usePresentMembers,
  useStatsByMeister, useStatsByMonth, useStatsPresenceByDay,
  useAllPolls, useCreatePoll, useTogglePoll, fetchPollResults,
  useMyCustomAttrs, useAdminDeleteCustomAttr, useToggleCustomAttrsEnabled,
  useMyBadges,
  type PollAnswerType, type Member,
} from '@/lib/api';
import { ALL_BADGES } from '@/lib/badges';
import BadgeChip from '@/components/BadgeChip';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isWmAdmin } from '@/lib/roles';
import { downloadBadge } from '@/lib/badge';
import { downloadStatsPdf } from '@/lib/statsPdf';
import { fmtClock } from '@/lib/time';

type Tab = 'saunas' | 'members' | 'invitations' | 'recurring' | 'presence' | 'stats' | 'branding' | 'handbook' | 'polls' | 'wm';

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  saunas:      { label: 'Saunen',       icon: '🔥' },
  members:     { label: 'Mitglieder',   icon: '👥' },
  invitations: { label: 'Einladungen',  icon: '✉️' },
  recurring:   { label: 'Stamm-Slots',  icon: '📅' },
  presence:    { label: 'Anwesenheit',  icon: '🟢' },
  stats:       { label: 'Statistik',    icon: '📊' },
  branding:    { label: 'Branding',     icon: '🎨' },
  handbook:    { label: 'Handbuch',     icon: '📖' },
  polls:       { label: 'Abfragen',     icon: '📋' },
  wm:          { label: 'WM-Tipps',     icon: '🏆' },
};

export default function Admin() {
  const { signOut } = useAuth();
  const me = useCurrentMember();
  const fullAdmin = isAdmin(me.data);
  const wmOnly = !fullAdmin && isWmAdmin(me.data);
  const visibleTabs = useMemo<Tab[]>(
    () => wmOnly ? ['wm'] : (Object.keys(TAB_META) as Tab[]),
    [wmOnly]
  );
  const [tab, setTab] = useState<Tab>(wmOnly ? 'wm' : 'saunas');

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      {/* Sticky modern header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-forest-500 to-forest-700 text-base shadow-lg shadow-forest-900/50">
              ⚙️
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-forest-100 leading-tight">Admin</h1>
              <p className="text-[10px] sm:text-xs text-forest-400 truncate">Stammdaten · Steuerung · Branding</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <AdminQuickNav variant="icons" />
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Modern segmented tab bar */}
        <div className="mx-auto max-w-6xl px-4 pb-2 -mt-1">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {visibleTabs.map((t) => {
              const active = tab === t;
              const meta = TAB_META[t];
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? 'bg-forest-500 text-forest-950 shadow-md ring-1 ring-forest-400'
                      : 'text-forest-300 hover:bg-forest-900/60 hover:text-forest-100'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {tab === 'saunas' && <SaunasTab />}
        {tab === 'members' && <MembersTab />}
        {tab === 'invitations' && <InvitationsTab />}
        {tab === 'recurring' && <RecurringAdminTab />}
        {tab === 'presence' && <PresenceTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'branding' && <BrandingTab />}
        {tab === 'handbook' && <HandbookTab />}
        {tab === 'polls' && <PollsTab />}
        {tab === 'wm' && <WmAdminTab />}
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

function MemberCustomAttrsRow({ memberId }: { memberId: string; memberName?: string }) {
  const attrsQ = useMyCustomAttrs(memberId);
  const deleteAttr = useAdminDeleteCustomAttr();
  const toggleEnabled = useToggleCustomAttrsEnabled();
  const membersQ = useAllMembers();
  const member = membersQ.data?.find((m) => m.id === memberId);
  const enabled = member?.custom_attrs_enabled !== false;
  const attrs = attrsQ.data ?? [];

  if (!member?.is_aufgieser) return null;

  return (
    <div className="mt-2 pt-2 border-t border-forest-800/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] text-forest-400/70 uppercase tracking-wider">Eigene Buttons</span>
        <button
          onClick={() => toggleEnabled.mutate({ id: memberId, enabled: !enabled })}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold ring-1 transition ${
            enabled ? 'bg-forest-700/40 text-forest-200 ring-forest-600/30 hover:bg-forest-700/60' : 'bg-rose-500/20 text-rose-300 ring-rose-500/30 hover:bg-rose-500/30'
          }`}
        >
          {enabled ? 'Erlaubt' : 'Gesperrt'}
        </button>
      </div>
      {attrs.length === 0 ? (
        <p className="text-[10px] text-forest-400/50">Keine eigenen Buttons.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {attrs.map((a) => (
            <div key={a.id} className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-semibold ring-1 ring-white/10"
              style={{ background: a.color, color: '#0b1f10' }}>
              <span>{a.emoji}</span>
              <span>{a.label}</span>
              <button
                onClick={() => deleteAttr.mutate({ id: a.id, member_id: memberId })}
                title="Löschen"
                className="ml-0.5 rounded-full bg-black/20 px-1 hover:bg-black/40 text-[10px] font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberBadgesRow({ memberId }: { memberId: string }) {
  const badgesQ = useMyBadges(memberId);
  const achievements = badgesQ.data ?? [];
  if (!achievements.length) return null;
  const earnedBadges = ALL_BADGES.filter((b) => achievements.some((a) => a.badge_id === b.id));
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {earnedBadges.map((badge) => (
        <BadgeChip key={badge.id} badge={badge} size="sm" earnedAt={achievements.find((a) => a.badge_id === badge.id)?.earned_at} />
      ))}
    </div>
  );
}

type MembersFilter = 'all' | 'member' | 'aufgieser' | 'guest_aufgieser' | 'gast' | 'staff' | 'admin' | 'revoked';

const MEMBER_FILTER_META: Record<MembersFilter, { label: string; icon: string }> = {
  all:             { label: 'Alle',           icon: '👥' },
  member:          { label: 'Mitglieder',     icon: '✅' },
  aufgieser:       { label: 'Aufgießer',      icon: '🧖' },
  guest_aufgieser: { label: 'Gast-Aufgießer', icon: '🌍' },
  gast:            { label: 'Gäste',          icon: '👋' },
  staff:           { label: 'Personal',       icon: '👨‍🍳' },
  admin:           { label: 'Admins',         icon: '⚙️' },
  revoked:         { label: 'Gesperrt',       icon: '🚫' },
};

function memberMatchesFilter(m: Member, f: MembersFilter): boolean {
  if (f === 'all') return !m.revoked_at;
  if (f === 'revoked') return !!m.revoked_at;
  if (m.revoked_at) return false;
  switch (f) {
    case 'member':          return m.role === 'member' && !m.is_aufgieser;
    case 'aufgieser':       return m.role === 'member' && m.is_aufgieser;
    case 'guest_aufgieser': return m.role === 'guest_aufgieser';
    case 'gast':            return m.role === 'gast';
    case 'staff':           return m.role === 'staff';
    case 'admin':           return m.role === 'admin';
    default: return true;
  }
}

function MembersTab() {
  const membersQ = useAllMembers();
  const pendingQ = usePendingMembers();
  const accountsQ = useAdminEmailAccounts();
  const add = useAddMember();
  const update = useUpdateMember();
  const approve = useApproveMember();
  const del = useDeleteMember();
  const me = useCurrentMember();
  const brandQ = useBrandSettings();
  const frontBgUrl = brandAssetUrl(brandQ.data?.badge?.front_bg);
  const backBgUrl  = brandAssetUrl(brandQ.data?.badge?.back_bg);
  const logoUrl    = brandAssetUrl(brandQ.data?.logo?.icon);
  const orgName    = brandQ.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Member['role']>('member');
  const [error, setError] = useState<string | null>(null);
  const [postfachMember, setPostfachMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState<MembersFilter>('all');

  const allMembers = membersQ.data ?? [];
  const counts = useMemo(() => {
    const c = {} as Record<MembersFilter, number>;
    (Object.keys(MEMBER_FILTER_META) as MembersFilter[]).forEach((f) => {
      c[f] = allMembers.filter((m) => memberMatchesFilter(m, f)).length;
    });
    return c;
  }, [allMembers]);
  const filteredMembers = useMemo(
    () => allMembers.filter((m) => memberMatchesFilter(m, filter)),
    [allMembers, filter]
  );

  const emailAccountFor = (memberId: string) => accountsQ.data?.find((a) => a.member_id === memberId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name fehlt.');
    try {
      await add.mutateAsync({ name: name.trim(), email: email.trim() || null, role: newRole });
      setName(''); setEmail(''); setNewRole('member');
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <section className="space-y-4">
      {(pendingQ.data?.length ?? 0) > 0 && (
        <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-950/30 p-4 ring-1 ring-amber-500/30 backdrop-blur">
          <h2 className="text-base font-bold text-amber-100">⏳ Wartet auf Freigabe ({pendingQ.data?.length})</h2>
          <p className="mt-1 text-xs text-amber-200/80">Diese User haben sich registriert und warten auf Aktivierung.</p>
          <ul className="mt-3 divide-y divide-amber-500/20">
            {(pendingQ.data ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-50">{m.name}</div>
                  <div className="text-xs text-amber-200/80">{m.email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => approve.mutate({ id: m.id, role: 'gast', is_aufgieser: false })}
                    className="rounded-lg bg-sky-600/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-600/30 ring-1 ring-sky-500/40">
                    👋 Gast
                  </button>
                  <button onClick={() => approve.mutate({ id: m.id, role: 'member', is_aufgieser: false })}
                    className="rounded-lg bg-forest-800/60 px-3 py-1.5 text-xs font-semibold text-forest-100 hover:bg-forest-700 ring-1 ring-forest-600/40">
                    ✅ Mitglied
                  </button>
                  <button onClick={() => approve.mutate({ id: m.id, role: 'member', is_aufgieser: true })}
                    className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-600/30 ring-1 ring-amber-500/40">
                    🧖 Aufgieser
                  </button>
                  <button onClick={() => approve.mutate({ id: m.id, role: 'guest_aufgieser', is_aufgieser: false })}
                    className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/30 ring-1 ring-emerald-500/40">
                    🌍 Gast-Aufgießer
                  </button>
                  <button onClick={() => approve.mutate({ id: m.id, role: 'staff', is_aufgieser: false })}
                    className="rounded-lg bg-slate-600/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600/30 ring-1 ring-slate-500/40">
                    👨‍🍳 Personal
                  </button>
                  <button onClick={() => approve.mutate({ id: m.id, role: 'admin', is_aufgieser: false })}
                    className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-violet-400">
                    ⚙️ Admin
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
        <h2 className="text-base font-semibold text-forest-100">Mitglied vorab anlegen (optional)</h2>
        <p className="text-xs text-forest-300/70">Normalerweise reicht: User registriert sich selbst → hier oben freigeben.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail (optional)"
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Member['role'])}
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
            <option value="gast">Gast</option>
            <option value="member">Mitglied</option>
            <option value="guest_aufgieser">Gast-Aufgießer</option>
            <option value="staff">Personal</option>
            <option value="admin">Admin</option>
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
          Mitglieder ({allMembers.length})
        </h2>

        {/* Filter-Reiter */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(MEMBER_FILTER_META) as MembersFilter[]).map((f) => {
            const meta = MEMBER_FILTER_META[f];
            const active = filter === f;
            const cnt = counts[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  active
                    ? 'bg-forest-500 text-forest-950 ring-forest-400 shadow-sm'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70 hover:text-forest-100'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-forest-950/30' : 'bg-forest-950/60 text-forest-400'}`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {filteredMembers.length === 0 ? (
          <p className="mt-6 text-center text-sm text-forest-400/70">Keine Mitglieder in dieser Kategorie.</p>
        ) : (
        <ul className="mt-3 divide-y divide-forest-800/40">
          {filteredMembers.map((m) => (
            <li key={m.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <EditableName member={m} />
                    {m.sauna_name && <span className="text-xs text-forest-300/60">({m.sauna_name})</span>}
                    {m.role === 'admin' && (
                      <span className="rounded-full bg-violet-500/20 px-2 text-[10px] font-bold text-violet-200">⚙️ Admin</span>
                    )}
                    {m.role === 'guest_aufgieser' && (
                      <span className="rounded-full bg-emerald-500/20 px-2 text-[10px] font-bold text-emerald-200">
                        🌍 Gast-Aufgießer{m.home_group ? ` · ${m.home_group}` : ''}
                      </span>
                    )}
                    {m.role === 'staff' && (
                      <span className="rounded-full bg-slate-500/20 px-2 text-[10px] font-bold text-slate-200">👨‍🍳 Personal</span>
                    )}
                    {m.role === 'gast' && (
                      <span className="rounded-full bg-sky-500/20 px-2 text-[10px] font-bold text-sky-200">
                        👋 Gast{m.gast_referral_source ? ` · ${m.gast_referral_source}` : ''}
                      </span>
                    )}
                    {m.is_aufgieser && m.role === 'member' && (
                      <span className="rounded-full bg-amber-500/20 px-2 text-[10px] font-bold text-amber-200">🧖 Aufgieser</span>
                    )}
                  </div>
                  <div className="text-xs text-forest-300/70">
                    {m.email}
                    {m.is_present && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 text-[10px] font-bold text-emerald-200">anwesend</span>}
                    {m.revoked_at && <span className="ml-2 rounded-full bg-rose-500/20 px-2 text-[10px] font-bold text-rose-200">gesperrt</span>}
                  </div>
                  <div className="font-mono text-[10px] text-forest-300/50">
                    {m.member_number ? `FDS-${String(m.member_number).padStart(3, '0')}` : m.member_code.slice(0, 8)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Postfach-Vergabe */}
                  {(() => {
                    const acc = emailAccountFor(m.id);
                    return (
                      <button
                        onClick={() => setPostfachMember(m)}
                        title={acc ? `Postfach: ${acc.email_address}` : 'Postfach vergeben'}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                          acc
                            ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-900'
                        }`}
                      >
                        {acc ? '📧 Postfach' : '+ 📧'}
                      </button>
                    );
                  })()}
                  {/* Aufgieser-Toggle */}
                  <button
                    onClick={() => update.mutate({ id: m.id, is_aufgieser: !m.is_aufgieser })}
                    title={m.is_aufgieser ? 'Aufgieser-Status entfernen' : 'Als Aufgieser markieren'}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                      m.is_aufgieser
                        ? 'bg-amber-500/20 text-amber-200 ring-amber-500/30 hover:bg-amber-500/30'
                        : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-900'
                    }`}
                  >
                    {m.is_aufgieser ? '🔥 Aufgieser' : '+ Aufgieser'}
                  </button>
                  {/* WM-Admin-Toggle */}
                  <button
                    onClick={() => update.mutate({ id: m.id, is_wm_admin: !m.is_wm_admin })}
                    title={m.is_wm_admin ? 'WM-Admin-Rechte entziehen' : 'Als WM-Admin markieren (darf Spiele/Tipps verwalten)'}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                      m.is_wm_admin
                        ? 'bg-heat-500/20 text-heat-200 ring-heat-500/30 hover:bg-heat-500/30'
                        : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-900'
                    }`}
                  >
                    {m.is_wm_admin ? '🏆 WM-Admin' : '+ WM-Admin'}
                  </button>
                  <button onClick={() => downloadBadge({
                    name: m.name, memberCode: m.member_code, memberNumber: m.member_number,
                    role: m.role, organization: orgName,
                    frontBgUrl, backBgUrl, logoUrl,
                  })}
                    className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-500">
                    Ausweis-PDF
                  </button>
                  <button
                    onClick={() => {
                      const becomingAdmin = m.role !== 'admin';
                      const ok = window.confirm(
                        becomingAdmin
                          ? `"${m.name}" zum Admin machen? Admins haben Vollzugriff auf alle Saunen, Mitglieder, WM und Branding.`
                          : `Admin-Rechte von "${m.name}" entfernen?`,
                      );
                      if (!ok) return;
                      update.mutate({ id: m.id, role: becomingAdmin ? 'admin' : 'member' });
                    }}
                    disabled={m.id === me.data?.id}
                    title={m.id === me.data?.id ? 'Du kannst dich nicht selbst degradieren' : undefined}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                      m.role === 'admin'
                        ? 'bg-forest-500/30 text-forest-100 ring-forest-400/40 hover:bg-forest-500/50'
                        : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-800'
                    }`}
                  >
                    {m.role === 'admin' ? '👑 Admin entfernen' : '+ Admin'}
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
                  <button
                    onClick={async () => {
                      const numLabel = m.member_number ? `FDS-${String(m.member_number).padStart(3, '0')}` : '';
                      const ok = window.confirm(
                        `Mitglied "${m.name}" ${numLabel} wirklich endgültig löschen?\n\n` +
                        `• Alle Tipps, Fotos, Bewertungen, Badges, Anwesenheit dieses Mitglieds werden gelöscht.\n` +
                        `• Aufgüsse bleiben erhalten (Saunameister wird auf "unbekannt" gesetzt).\n` +
                        `• Die Mitgliedsnummer wird beim nächsten Neuzugang neu vergeben.\n` +
                        `• Die E-Mail-Adresse wird wieder frei für eine Neu-Registrierung.\n\n` +
                        `Diese Aktion kann nicht rückgängig gemacht werden.`,
                      );
                      if (!ok) return;
                      const ok2 = window.confirm(`Sicher? Tippe noch einmal OK, um "${m.name}" endgültig zu löschen.`);
                      if (!ok2) return;
                      try {
                        await del.mutateAsync(m.id);
                      } catch (e) {
                        window.alert(`Löschen fehlgeschlagen: ${(e as Error).message}`);
                      }
                    }}
                    disabled={del.isPending}
                    title="Mitglied endgültig löschen"
                    className="rounded-lg bg-rose-600/30 px-3 py-1.5 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/40 hover:bg-rose-600/50 disabled:opacity-60"
                  >
                    {del.isPending ? '…' : '🗑 Löschen'}
                  </button>
                </div>
              </div>
              {m.is_aufgieser && <MemberCustomAttrsRow memberId={m.id} memberName={m.name} />}
              {m.is_aufgieser && <MemberBadgesRow memberId={m.id} />}
            </li>
          ))}
        </ul>
        )}
      </div>

      {postfachMember && (
        <PostfachDialog
          member={postfachMember}
          existing={emailAccountFor(postfachMember.id) ?? null}
          onClose={() => setPostfachMember(null)}
        />
      )}
    </section>
  );
}

// Inline-Edit für Mitgliedsnamen im Admin-Bereich.
// Klick aufs ✏️ wechselt in den Edit-Modus; Enter speichert, Escape bricht ab.
function EditableName({ member }: { member: Member }) {
  const update = useUpdateMember();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.name);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      window.alert('Name darf nicht leer sein.');
      return;
    }
    if (trimmed === member.name) {
      setEditing(false);
      return;
    }
    try {
      await update.mutateAsync({ id: member.id, name: trimmed });
      setEditing(false);
    } catch (e) {
      window.alert(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  function cancel() {
    setDraft(member.name);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-sm font-semibold">{member.name}</span>
        <button
          onClick={() => { setDraft(member.name); setEditing(true); }}
          title="Name bearbeiten"
          className="text-[11px] text-forest-300/50 hover:text-forest-200 transition-colors"
        >
          ✏️
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        disabled={update.isPending}
        className="rounded-md bg-forest-900/80 px-2 py-0.5 text-sm font-semibold ring-1 ring-forest-600/50 focus:outline-none focus:ring-2 focus:ring-forest-400 min-w-[160px] disabled:opacity-60"
      />
      <button
        onClick={save}
        disabled={update.isPending}
        title="Speichern (Enter)"
        className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-60"
      >
        {update.isPending ? '…' : '✓'}
      </button>
      <button
        onClick={cancel}
        disabled={update.isPending}
        title="Abbrechen (Escape)"
        className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30 disabled:opacity-60"
      >
        ✕
      </button>
    </span>
  );
}

function PollsTab() {
  const pollsQ = useAllPolls();
  const createPoll = useCreatePoll();
  const togglePoll = useTogglePoll();
  const allMembers = useAllMembers();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [answerType, setAnswerType] = useState<PollAnswerType>('text');
  const [choices, setChoices] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [results, setResults] = useState<{ member_name: string; member_number: number | null; answer: string; answered_at: string }[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const choicesArr = answerType === 'choice'
        ? choices.split('\n').map((c) => c.trim()).filter(Boolean)
        : null;
      await createPoll.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        answer_type: answerType,
        choices: choicesArr,
        deadline: deadline || null,
        created_by: '',
      });
      setTitle(''); setDescription(''); setChoices(''); setDeadline('');
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  async function loadResults(pollId: string) {
    setSelectedPollId(pollId);
    setLoadingResults(true);
    setResults([]);
    setTelegramMsg(null);
    try {
      const data = await fetchPollResults(pollId);
      setResults(data);
    } catch (e) { alert((e as Error).message); }
    finally { setLoadingResults(false); }
  }

  async function sendToTelegram() {
    const poll = (pollsQ.data ?? []).find((p) => p.id === selectedPollId);
    if (!poll) return;
    setSendingTelegram(true);
    setTelegramMsg(null);
    try {
      const r = await fetch('/api/send-poll-results', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pollTitle: poll.title,
          pollDescription: poll.description,
          answerType: poll.answer_type,
          results,
          totalMembers: allMembers.data?.length ?? 0,
        }),
      });
      const data = await r.json();
      setTelegramMsg(data.sent > 0
        ? `✅ An ${data.sent} Telegram-Chat(s) gesendet.`
        : `ℹ️ ${data.note ?? 'Keine Chats konfiguriert.'}`);
    } catch (e) { setTelegramMsg(`Fehler: ${(e as Error).message}`); }
    finally { setSendingTelegram(false); }
  }

  const selectedPoll = (pollsQ.data ?? []).find((p) => p.id === selectedPollId);

  return (
    <div className="space-y-6">
      {/* Neue Abfrage erstellen */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50">
        <h2 className="text-base font-semibold text-forest-100 mb-4">Neue Abfrage erstellen</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Frage / Titel *"
            required
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreibung / Details (optional)"
            rows={2}
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-forest-300/70 mb-1 block">Antworttyp</label>
              <select
                value={answerType} onChange={(e) => setAnswerType(e.target.value as PollAnswerType)}
                className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              >
                <option value="text">Freitext</option>
                <option value="yesno">Ja / Nein</option>
                <option value="choice">Auswahl</option>
                <option value="number">Zahl</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-forest-300/70 mb-1 block">Deadline (optional)</label>
              <input
                type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
          </div>
          {answerType === 'choice' && (
            <div>
              <label className="text-xs text-forest-300/70 mb-1 block">Auswahloptionen (eine pro Zeile)</label>
              <textarea
                value={choices} onChange={(e) => setChoices(e.target.value)}
                placeholder={"Saunatuch 15€\nBademantel 35€\nNichts"}
                rows={3}
                className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
          )}
          <button type="submit" disabled={busy || !title.trim()}
            className="rounded-xl bg-forest-500 px-5 py-2.5 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
            {busy ? 'Erstelle…' : 'Abfrage erstellen & aktivieren'}
          </button>
        </form>
      </section>

      {/* Bestehende Abfragen */}
      <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50">
        <h2 className="text-base font-semibold text-forest-100 mb-4">Alle Abfragen</h2>
        {(pollsQ.data ?? []).length === 0 && (
          <p className="text-sm text-forest-300/60">Noch keine Abfragen angelegt.</p>
        )}
        <ul className="space-y-3">
          {(pollsQ.data ?? []).map((poll) => (
            <li key={poll.id} className="rounded-xl bg-forest-900/60 p-3 ring-1 ring-forest-800/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${poll.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-forest-800 text-forest-400'}`}>
                      {poll.active ? 'aktiv' : 'inaktiv'}
                    </span>
                    <span className="text-xs text-forest-300/50">{poll.answer_type}</span>
                  </div>
                  <p className="text-sm font-semibold text-forest-100 mt-1">{poll.title}</p>
                  {poll.description && <p className="text-xs text-forest-300/60">{poll.description}</p>}
                  {poll.deadline && <p className="text-xs text-amber-400/70">Bis: {new Date(poll.deadline).toLocaleDateString('de-DE')}</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => togglePoll.mutate({ id: poll.id, active: !poll.active })}
                    className="rounded-lg bg-forest-800 px-3 py-1 text-xs text-forest-200 hover:bg-forest-700 ring-1 ring-forest-700/50">
                    {poll.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button
                    onClick={() => loadResults(poll.id)}
                    className="rounded-lg bg-forest-600 px-3 py-1 text-xs text-white hover:bg-forest-500">
                    Ergebnisse
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Ergebnisse einer Abfrage */}
      {selectedPollId && (
        <section className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-forest-100">Ergebnisse</h2>
              {selectedPoll && <p className="text-xs text-forest-300/60">{selectedPoll.title}</p>}
            </div>
            <button
              onClick={sendToTelegram}
              disabled={sendingTelegram || results.length === 0}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60 flex items-center gap-2"
            >
              {sendingTelegram ? 'Sende…' : '📨 An Telegram senden'}
            </button>
          </div>
          {telegramMsg && (
            <p className="mb-3 text-sm text-forest-200 bg-forest-900/60 rounded-lg px-3 py-2">{telegramMsg}</p>
          )}
          {loadingResults && <p className="text-sm text-forest-300/60">Lade Ergebnisse…</p>}
          {!loadingResults && results.length === 0 && (
            <p className="text-sm text-forest-300/60">Noch keine Antworten.</p>
          )}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-forest-300/60 border-b border-forest-800/50">
                    <th className="pb-2 pr-4">Nr.</th>
                    <th className="pb-2 pr-4">Mitglied</th>
                    <th className="pb-2 pr-4">Antwort</th>
                    <th className="pb-2">Uhrzeit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-800/30">
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-xs text-forest-300/50">
                        {r.member_number ? `FDS-${String(r.member_number).padStart(3, '0')}` : '—'}
                      </td>
                      <td className="py-2 pr-4 font-medium">{r.member_name}</td>
                      <td className="py-2 pr-4 text-forest-200">{r.answer}</td>
                      <td className="py-2 text-xs text-forest-300/50">{fmtClock(r.answered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-forest-300/50">{results.length} von {allMembers.data?.filter(m => m.approved).length ?? '?'} Mitgliedern haben geantwortet</p>
            </div>
          )}
        </section>
      )}
    </div>
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

