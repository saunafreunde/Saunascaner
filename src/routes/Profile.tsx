import { useParams, Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { PageBackground } from '@/components/PageBackground';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MeisterRadarWidget } from '@/components/MeisterRadarWidget';
import { WmStandMini } from '@/components/WmStandMini';
import BadgeShowcase from '@/components/BadgeShowcase';
import { PushPermission } from '@/components/PushPermission';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import {
  useCurrentMember, useMember, useMemberStats,
  useAttendanceStreak, useWmLeaderboard,
} from '@/lib/api';

export default function Profile() {
  const { memberId } = useParams<{ memberId: string }>();
  const { signOut } = useAuth();
  const me = useCurrentMember();
  const memberQ = useMember(memberId);
  const statsQ = useMemberStats(memberId);
  const streakQ = useAttendanceStreak(memberId);
  const lbQ = useWmLeaderboard();

  const m = memberQ.data;
  const isAdmin = me.data?.role === 'admin';
  const isMyself = me.data?.id === memberId;

  const wmEntry = (lbQ.data ?? []).find((e) => e.member_id === memberId);
  const wmRank = wmEntry ? (lbQ.data ?? []).findIndex((e) => e.member_id === memberId) + 1 : null;

  // Today birthday check
  const todayMD = format(new Date(), 'MM-dd');
  const birthdayMD = m?.birthday ? format(parse(m.birthday, 'yyyy-MM-dd', new Date()), 'MM-dd') : null;
  const isBirthdayToday = birthdayMD === todayMD;

  if (memberQ.isLoading) {
    return (
      <PageBackground page="planner">
        <div className="grid min-h-screen place-items-center text-forest-300">Lade Profil…</div>
      </PageBackground>
    );
  }

  if (!m) {
    return (
      <PageBackground page="planner">
        <div className="grid min-h-screen place-items-center text-forest-300">
          Mitglied nicht gefunden.
          <Link to="/planner" className="mt-2 text-amber-400 underline">Zurück</Link>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground page="planner" className="min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/planner" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition" title="Zurück">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100 truncate">Profil</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && <AdminQuickNav variant="icons" />}
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-5">
        {/* Profil-Header-Card */}
        <div className="relative rounded-3xl bg-gradient-to-br from-forest-950/80 via-forest-950/60 to-forest-900/40 ring-1 ring-forest-700/40 backdrop-blur-md overflow-hidden p-6 sm:p-8">
          {isBirthdayToday && (
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500/30 to-transparent px-6 py-3 text-amber-200 font-bold text-sm animate-pulse">
              🎂 Heute Geburtstag!
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-forest-300 via-forest-500 to-forest-800 text-3xl sm:text-4xl font-black text-forest-950 shadow-xl shadow-forest-900/50 ring-2 ring-forest-400/30">
              {m.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-forest-100 truncate">{m.name}</h2>
              {m.sauna_name && <p className="text-sm sm:text-base text-amber-300 font-medium mt-0.5">„{m.sauna_name}"</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-forest-400">
                {m.member_number && <span>FDS-{String(m.member_number).padStart(3, '0')}</span>}
                {m.is_aufgieser && <span className="text-amber-300">· Aufgieser</span>}
                {m.role === 'admin' && <span className="text-violet-300">· Admin</span>}
                {birthdayMD && <span className="text-pink-300">· 🎂 {format(parse(m.birthday!, 'yyyy-MM-dd', new Date()), 'd. MMMM', { locale: de })}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bento */}
        {statsQ.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Aufgüsse gesamt" value={statsQ.data.total_infusions} icon="🔥" />
            <StatTile label="Team-Aufgüsse" value={statsQ.data.team_infusions} icon="🤝" />
            <StatTile label="Diesen Monat" value={statsQ.data.monthly_infusions} icon="📅" />
            <StatTile label="Streak (Wochen)" value={streakQ.data ?? 0} icon="🔥" highlight={(streakQ.data ?? 0) >= 4} />
          </div>
        )}

        {/* Widgets-Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bewertungs-Radar (nur Aufgieser) */}
          {m.is_aufgieser && (
            <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-700/30 p-5">
              <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
                <span>📡</span><span>Bewertungs-Profil</span>
              </h3>
              <MeisterRadarWidget memberId={m.id} size="lg" />
            </div>
          )}

          {/* WM-Tipspiel-Stand */}
          <div>
            <WmStandMini memberId={m.id} />
            {wmEntry && wmRank && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-forest-950/40 ring-1 ring-amber-700/20 p-2">
                  <div className="text-forest-400">Rang</div>
                  <div className="text-amber-200 font-bold tabular-nums text-lg">{wmRank}</div>
                </div>
                <div className="rounded-lg bg-forest-950/40 ring-1 ring-amber-700/20 p-2">
                  <div className="text-forest-400">Tipps</div>
                  <div className="text-forest-200 font-bold tabular-nums text-lg">{wmEntry.tips_correct}/{wmEntry.tips_total}</div>
                </div>
                <div className="rounded-lg bg-forest-950/40 ring-1 ring-amber-700/20 p-2">
                  <div className="text-forest-400">Streak-Bonus</div>
                  <div className="text-amber-300 font-bold tabular-nums text-lg">+{wmEntry.streak_bonus}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auszeichnungen */}
        <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-700/30 p-5">
          <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
            <span>🏅</span><span>Auszeichnungen</span>
          </h3>
          <BadgeShowcase memberId={m.id} />
        </div>

        {/* PWA Install + Push (nur bei eigenem Profil) */}
        {isMyself && (
          <>
            <PWAInstallButton />
            <PushPermission memberId={m.id} />
          </>
        )}

        {isMyself && (
          <p className="text-center text-xs text-forest-500 italic">Das bist du. Aktivere Karten findest du im Mitgliederbereich.</p>
        )}
      </div>
    </PageBackground>
  );
}

function StatTile({ label, value, icon, highlight = false }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl ring-1 p-4 transition ${highlight ? 'bg-amber-950/40 ring-amber-500/40' : 'bg-forest-950/60 ring-forest-800/40'}`}>
      <div className="flex items-center gap-2 text-xs text-forest-400 uppercase tracking-wider">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-2 text-3xl font-black tabular-nums ${highlight ? 'text-amber-300' : 'text-forest-100'}`}>{value}</div>
    </div>
  );
}
