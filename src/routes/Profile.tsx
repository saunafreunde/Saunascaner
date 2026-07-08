import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { PageBackground } from '@/components/PageBackground';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { MeisterRadarWidget } from '@/components/MeisterRadarWidget';
import { WmStandMini } from '@/components/WmStandMini';
import BadgeShowcase from '@/components/BadgeShowcase';
import { MemberStatsCard } from '@/components/MemberStatsCard';
import { MemberAchievementsGallery } from '@/components/MemberAchievementsGallery';
import { GameStatsCard } from '@/components/games/GameStatsCard';
import { MyCheckinPinCard } from '@/components/MyCheckinPinCard';
import { PushPermission } from '@/components/PushPermission';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import {
  useCurrentMember, useMember, useMemberStats,
  useAttendanceStreak, useWmLeaderboard,
  useFavoriteOils, useSignatureInfusion, useSetMotto,
  useSetMyAutoCheckin,
} from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { Avatar } from '@/components/Avatar';
import AvatarPicker from '@/components/AvatarPicker';
import { FollowButton } from '@/components/FollowButton';
import { DmButton } from '@/components/DmButton';

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
  const favOilsQ = useFavoriteOils(memberId);
  const sigInfQ = useSignatureInfusion(memberId);
  const setMotto = useSetMotto();
  const [editingMotto, setEditingMotto] = useState(false);
  const [mottoDraft, setMottoDraft] = useState('');
  const [mottoError, setMottoError] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (!editingMotto) setMottoDraft(m?.motto ?? '');
  }, [m?.motto, editingMotto]);

  async function saveMotto() {
    setMottoError(null);
    try {
      await setMotto.mutateAsync(mottoDraft);
      setEditingMotto(false);
    } catch (e) { setMottoError((e as Error).message); }
  }

  const wmEntry = (lbQ.data ?? []).find((e) => e.member_id === memberId);
  const wmRank = wmEntry ? (lbQ.data ?? []).findIndex((e) => e.member_id === memberId) + 1 : null;

  // Today birthday check
  const todayMD = formatInTimeZone(new Date(), 'Europe/Berlin', 'MM-dd');
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
            {isAdmin ? (
              <AdminQuickNav variant="icons" />
            ) : (
              <MemberQuickNav myMemberId={me.data?.id} />
            )}
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
            <div className="relative">
              <Avatar
                name={m.name}
                avatarPath={m.avatar_path}
                size="xl"
                isAufgieser={m.is_aufgieser}
              />
              {isMyself && (
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(true)}
                  title="Avatar ändern"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-forest-500 text-forest-950 ring-2 ring-forest-950 shadow-lg hover:bg-forest-400 transition"
                  aria-label="Avatar ändern"
                >
                  ✏️
                </button>
              )}
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
            {!isMyself && me.data && (
              <div className="shrink-0 flex flex-col gap-2">
                <FollowButton memberId={m.id} />
                <DmButton memberId={m.id} compact />
              </div>
            )}
          </div>

          {/* Motto */}
          <div className="mt-4 border-t border-forest-800/40 pt-4">
            {!isMyself ? (
              m.motto ? (
                <p className="text-sm sm:text-base italic text-forest-200/90 leading-relaxed">
                  „{m.motto}"
                </p>
              ) : null
            ) : editingMotto ? (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-forest-400/80">Mein Motto</label>
                <textarea
                  value={mottoDraft}
                  onChange={(e) => setMottoDraft(e.target.value.slice(0, 200))}
                  rows={2}
                  maxLength={200}
                  placeholder="z.B. Hitze ist Heimat. — Ein Spruch, der dich als Aufgieser ausmacht."
                  className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-forest-500 tabular-nums">{mottoDraft.length}/200</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingMotto(false); setMottoError(null); }}
                      className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={saveMotto}
                      disabled={setMotto.isPending}
                      className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
                    >
                      {setMotto.isPending ? 'Speichere…' : 'Speichern'}
                    </button>
                  </div>
                </div>
                {mottoError && <p className="mt-1 text-xs text-rose-300">{mottoError}</p>}
              </div>
            ) : (
              <button
                onClick={() => setEditingMotto(true)}
                className="group w-full text-left"
              >
                {m.motto ? (
                  <p className="text-sm sm:text-base italic text-forest-200/90 leading-relaxed group-hover:text-forest-100 transition">
                    „{m.motto}"
                    <span className="ml-2 text-[10px] text-forest-500 group-hover:text-forest-300">✏️ bearbeiten</span>
                  </p>
                ) : (
                  <p className="text-sm text-forest-400/70 italic group-hover:text-forest-300 transition">
                    + Motto hinzufügen — was macht dich als Saunafreund aus?
                  </p>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Stats Bento — für Personal (role='staff') ausgeblendet: gemachte Aufgüsse sind kein Personal-Thema */}
        {statsQ.data && m.role !== 'staff' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Aufgüsse gesamt" value={statsQ.data.total_infusions} icon="🔥" />
            <StatTile label="Team-Aufgüsse" value={statsQ.data.team_infusions} icon="🤝" />
            <StatTile label="Diesen Monat" value={statsQ.data.monthly_infusions} icon="📅" />
            <StatTile label="Streak (Wochen)" value={streakQ.data ?? 0} icon="🔥" highlight={(streakQ.data ?? 0) >= 4} />
          </div>
        )}

        {/* Aufgieser-Identität: Signatur-Aufguss + Lieblings-Öle (nur für Aufgieser) */}
        {m.is_aufgieser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-forest-950/60 ring-1 ring-amber-700/30 p-5">
              <h3 className="text-[11px] font-bold text-amber-300/80 uppercase tracking-[0.12em] mb-2 flex items-center gap-2">
                <span>🔥</span><span>Signatur-Aufguss</span>
              </h3>
              {sigInfQ.isLoading ? (
                <p className="text-sm text-forest-400/60">Lade…</p>
              ) : sigInfQ.data ? (
                <div>
                  <p className="text-lg font-semibold text-forest-100">{sigInfQ.data.title}</p>
                  <p className="text-xs text-forest-400 mt-0.5">{sigInfQ.data.count}× gemeistert</p>
                </div>
              ) : (
                <p className="text-sm text-forest-400/60 italic">
                  Noch kein Stammgast-Aufguss — wird sichtbar ab 2× gleicher Titel.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-forest-950/60 ring-1 ring-amber-700/30 p-5">
              <h3 className="text-[11px] font-bold text-amber-300/80 uppercase tracking-[0.12em] mb-2 flex items-center gap-2">
                <span>🌿</span><span>Lieblings-Öle</span>
              </h3>
              {favOilsQ.isLoading ? (
                <p className="text-sm text-forest-400/60">Lade…</p>
              ) : (favOilsQ.data ?? []).length > 0 ? (
                <ul className="space-y-1.5">
                  {favOilsQ.data!.map((row, i) => {
                    const o = OIL_BY_ID[row.oil_id];
                    return (
                      <li key={row.oil_id} className="flex items-center gap-2 text-sm">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-200 ring-1 ring-amber-400/30 tabular-nums shrink-0">
                          {i + 1}
                        </span>
                        {o ? (
                          <>
                            <span aria-hidden className="text-base">{o.emoji}</span>
                            <span className="text-forest-100 flex-1 truncate">{o.name}</span>
                            <span className="text-xs text-forest-400 tabular-nums">×{row.usage_count}</span>
                          </>
                        ) : (
                          <span className="text-forest-400 italic">{row.oil_id}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-forest-400/60 italic">
                  Noch keine Öle in Aufgüssen vermerkt.
                </p>
              )}
            </div>
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

        {/* Sauna-Tablet-PIN (nur eigenes Profil) */}
        {isMyself && <MyCheckinPinCard />}
        {isMyself && me.data && <AutoCheckinToggleCard enabled={me.data.auto_checkin_enabled} />}

        {/* Auszeichnungen */}
        <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-700/30 p-5">
          <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
            <span>🏅</span><span>Auszeichnungen</span>
          </h3>
          <BadgeShowcase memberId={m.id} />
        </div>

        {/* Stats + komplette Galerie nur beim eigenen Profil, NICHT für Gäste
            (die haben das alles in /gast — Duplikat-Vermeidung) */}
        {isMyself && m.role !== 'gast' && (
          <>
            <MemberStatsCard memberId={m.id} />
            <GameStatsCard memberId={m.id} />
            <MemberAchievementsGallery memberId={m.id} />
          </>
        )}
        {isMyself && m.role === 'gast' && (
          <div className="rounded-2xl bg-sky-900/20 ring-1 ring-sky-500/30 p-4 text-center">
            <p className="text-sm text-forest-200">Statistik &amp; Auszeichnungen findest du in deinem Bereich.</p>
            <a
              href="/gast"
              className="mt-2 inline-block rounded-xl bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40 px-4 py-2 text-sm font-semibold hover:bg-sky-500/30"
            >
              🏡 Zu meinem Bereich
            </a>
          </div>
        )}

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

      {showAvatarPicker && isMyself && m && (
        <AvatarPicker
          member={{
            id: m.id,
            name: m.name,
            sauna_name: m.sauna_name,
            avatar_path: m.avatar_path,
            is_aufgieser: m.is_aufgieser,
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </PageBackground>
  );
}

// Auto-Check-in via WLAN-Subnet (Migration 0108+0109)
// Opt-in: wenn aktiv und User im Sauna-WLAN → silent toggle is_present=true
function AutoCheckinToggleCard({ enabled }: { enabled: boolean }) {
  const setAuto = useSetMyAutoCheckin();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onToggle(next: boolean) {
    setBusy(true); setErr(null);
    try { await setAuto.mutateAsync(next); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="text-forest-100 font-semibold">Automatischer Check-in</h3>
          </div>
          <p className="text-xs text-forest-400 mt-1 leading-relaxed">
            Wenn aktiv: Sobald du dich mit deinem Handy ins Sauna-WLAN einloggst, wirst du automatisch eingecheckt — kein PIN, kein Tap.
            {' '}Sicher: erkennt das Sauna-Netz am Subnet, dein Standort wird nicht abgefragt.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(!enabled)}
          className={`relative shrink-0 w-12 h-7 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-forest-800'} ${busy ? 'opacity-50' : ''}`}
          aria-pressed={enabled}
          aria-label="Auto-Check-in aktivieren oder deaktivieren"
        >
          <span className={`absolute top-1 transition-all w-5 h-5 rounded-full bg-white shadow ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      {err && <p className="text-xs text-rose-300 mt-2">{err}</p>}
    </div>
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
