import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInMinutes } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { useAuth } from '@/hooks/useAuth';
import {
  useCurrentMember, useMyFollowing, useAufgieserStars, useInfusions, useSaunas,
  useBrandSettings, brandAssetUrl, useDeleteMyAccount,
} from '@/lib/api';
import { StarTradingCard } from '@/components/StarTradingCard';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { LogoutButton } from '@/components/LogoutButton';
import { PageBackground } from '@/components/PageBackground';
import { MemberStatsCard } from '@/components/MemberStatsCard';
import { MemberAchievementsGallery } from '@/components/MemberAchievementsGallery';
import { MemberAttendanceChart } from '@/components/MemberAttendanceChart';
import { GastProfileHeader } from '@/components/GastProfileHeader';
import { PushPermission } from '@/components/PushPermission';
import { MyCheckinPinCard } from '@/components/MyCheckinPinCard';
import { PendingRatingsBlock } from '@/components/PendingRatingsBlock';
import { FanUpgradeCTA } from '@/components/gast/FanUpgradeCTA';
import { GastLiveNow } from '@/components/gast/GastLiveNow';
import { isAdmin, isGast } from '@/lib/roles';
import { lookupMemberName } from '@/lib/memberDisplay';
import { fmtClock, berlinYmd } from '@/lib/time';

// /gast — interner Bereich für Sauna-Besucher (Rolle 'gast').
// Auch für Admins zur Vorschau über /gast?preview=1 aufrufbar.
export default function Gast() {
  const me = useCurrentMember();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const deleteAccount = useDeleteMyAccount();
  const [params] = useSearchParams();
  // Preview-Modus akzeptiert sowohl ?preview=1 (alte URLs) als auch ?preview=gast (neu)
  const previewMode = (params.get('preview') === '1' || params.get('preview') === 'gast') && isAdmin(me.data);
  const isReallyGast = isGast(me.data);

  // GDPR-Self-Delete (RPC delete_my_account, nur für gast+fan erlaubt) —
  // löst das Versprechen aus dem Signup-Consent ein („jederzeit löschbar").
  const handleDeleteAccount = async () => {
    const ok1 = window.confirm(
      'Gäste-Account wirklich löschen?\n\n' +
      'Alle deine Daten werden unwiderruflich entfernt:\n' +
      '• Profil, Bewertungen, Favoriten, Badges\n' +
      '• Feed-Beiträge, Kommentare, Reactions\n' +
      '• Nachrichten und Spielstände'
    );
    if (!ok1) return;
    const ok2 = window.confirm('Wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden.');
    if (!ok2) return;
    try {
      await deleteAccount.mutateAsync();
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      window.alert(`Löschen fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  const stars = useAufgieserStars();
  const following = useMyFollowing();
  const infusions = useInfusions();
  const saunas = useSaunas();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const shortName = brand.data?.org?.short_name ?? 'Saunafreunde';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  const followedIds = useMemo(
    () => new Set((following.data ?? []).map((f) => f.followee_id)),
    [following.data]
  );

  const followedStars = useMemo(
    () => (stars.data ?? []).filter((s) => followedIds.has(s.id)),
    [stars.data, followedIds]
  );

  // Tickende Uhr (30s) für Live/Vergangen-Status UND die Zeit-Filter unten —
  // ein eingefrorenes Date.now() im useMemo würde gestartete Aufgüsse mit
  // negativem Countdown („in -30m") in der Favoriten-Liste stehen lassen.
  const now = useNow(30_000);

  const upcomingFromFavorites = useMemo(() => {
    const nowMs = now.getTime();
    return (infusions.data ?? [])
      .filter((i) => i.saunameister_id && followedIds.has(i.saunameister_id))
      .filter((i) => new Date(i.start_time).getTime() > nowMs && !i.is_personal_fallback)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      .slice(0, 8);
  }, [infusions.data, followedIds, now]);

  // Aufgüsse des heutigen Berliner Kalendertags — komplett (auch vergangene),
  // damit der Tagesverlauf sichtbar bleibt. Live/Vergangen wird beim Rendern
  // über `now` markiert statt hier weggefiltert.
  const todayAufgusse = useMemo(() => {
    const todayYmd = berlinYmd(now);
    return (infusions.data ?? [])
      .filter((i) => !i.is_personal_fallback && i.saunameister_id)
      .filter((i) => berlinYmd(i.start_time) === todayYmd)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [infusions.data, now]);

  const saunaById = useMemo(() => {
    const m = new Map<string, { name: string; accent_color: string }>();
    (saunas.data ?? []).forEach((s) => m.set(s.id, { name: s.name, accent_color: s.accent_color }));
    return m;
  }, [saunas.data]);

  const meisterName = (id: string | null) =>
    lookupMemberName(stars.data, id, 'Aufgießer:in');

  return (
    <PageBackground page="guest" variant="soft" className="min-h-screen">
      {previewMode && (
        <div className="sticky top-0 z-40 bg-violet-700 text-white text-center text-xs font-semibold py-1.5 ring-1 ring-violet-400">
          🔍 Admin-Vorschau · So sehen Gäste den Bereich · <Link to="/admin" className="underline">zurück zum Admin</Link>
        </div>
      )}

      <header className="sticky top-[28px] z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-forest-100 truncate">
              Hallo {me.data?.name ?? 'Gast'} 👋
            </h1>
            <p className="text-[11px] text-forest-400 truncate">{shortName} · Dein Bereich</p>
          </div>
        </div>
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
        <LogoutButton />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-8">
        {/* Profil-Header ganz oben (Avatar + Name + Motto editierbar) */}
        {me.data && <GastProfileHeader member={me.data} />}

        {/* Live-Hero: läuft gerade ein Aufguss? Wann kommt der nächste? */}
        <GastLiveNow
          infusions={infusions.data ?? []}
          saunaById={saunaById}
          meisterName={meisterName}
          followedIds={followedIds}
        />

        {/* Noch zu bewertende Aufgüsse (vom letzten Sauna-Tag) */}
        <PendingRatingsBlock />

        {/* Eigener Checkin-PIN für Tablet */}
        <MyCheckinPinCard />

        {/* Begrüßungs-Block für brandneue Gäste */}
        {isReallyGast && followedStars.length === 0 && !previewMode && (
          <section className="rounded-3xl bg-gradient-to-br from-amber-900/30 via-forest-950/85 to-forest-950/85 ring-1 ring-amber-500/30 p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold text-amber-100">Willkommen in der Community!</h2>
            <p className="mt-2 text-sm text-forest-200/90 leading-relaxed max-w-2xl">
              Schön dass du da bist. Such dir Aufgießer aus, die du magst — du kriegst dann eine
              Nachricht wenn sie das nächste Mal an der Sauna stehen.
            </p>
            <div className="mt-4">
              <Link
                to="/aufgieser"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-amber-900/30 hover:from-amber-400 hover:to-amber-500"
              >
                🌟 Aufgießer entdecken →
              </Link>
            </div>
          </section>
        )}

        {/* Meine Lieblings-Aufgießer */}
        {followedStars.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
                ❤️ Deine Favoriten ({followedStars.length})
              </h2>
              <Link to="/aufgieser" className="text-xs text-forest-400 hover:text-amber-300 underline">
                Mehr entdecken →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {followedStars.map((star) => (
                <StarTradingCard
                  key={star.id}
                  star={star}
                  size="compact"
                  showFollow={false}
                  href={`/aufgieser/${star.id}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Nächste Aufgüsse deiner Favoriten */}
        {upcomingFromFavorites.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              🔥 Wann deine Favoriten gießen
            </h2>
            <ul className="space-y-2">
              {upcomingFromFavorites.map((i) => {
                const sauna = saunaById.get(i.sauna_id);
                const minsLeft = differenceInMinutes(new Date(i.start_time), new Date());
                return (
                  <li key={i.id}>
                    <Link
                      to={`/aufgieser/${i.saunameister_id}`}
                      className="flex items-center gap-3 rounded-xl bg-forest-950/85 ring-1 ring-forest-800/60 px-4 py-3 hover:ring-amber-500/40 transition"
                    >
                      <div
                        className="h-10 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: sauna?.accent_color ?? '#22c55e' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-forest-100">
                            {i.title || 'Aufguss'}
                          </span>
                          <span className="text-xs text-forest-400">· von {meisterName(i.saunameister_id)}</span>
                        </div>
                        <div className="text-xs text-forest-300/80">
                          {sauna?.name ?? 'Sauna'} ·{' '}
                          {new Date(i.start_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                          · {fmtClock(i.start_time)}
                          {i.temperature_c && <> · {i.temperature_c}°C</>}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-semibold px-2.5 py-1 ring-1 ring-amber-500/30 tabular-nums whitespace-nowrap">
                        in {minsLeft < 60 ? `${minsLeft}m` : minsLeft < 1440 ? `${Math.round(minsLeft/60)}h` : `${Math.round(minsLeft/1440)}d`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Heute in der Sauna — kompletter Tagesverlauf mit Live-Status */}
        {todayAufgusse.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
                📅 Heute in der Sauna ({todayAufgusse.length})
              </h2>
              <Link to="/dashboard" className="text-xs text-forest-400 hover:text-amber-300 underline">
                Zur Tafel →
              </Link>
            </div>
            <ul className="space-y-2">
              {todayAufgusse.map((i) => {
                const sauna = saunaById.get(i.sauna_id);
                const isFav = i.saunameister_id ? followedIds.has(i.saunameister_id) : false;
                const startMs = new Date(i.start_time).getTime();
                const endMs = new Date(i.end_time).getTime();
                const isLive = now.getTime() >= startMs && now.getTime() < endMs;
                const isPast = now.getTime() >= endMs;
                return (
                  <li key={i.id}>
                    <Link
                      to={i.saunameister_id ? `/aufgieser/${i.saunameister_id}` : '/aufgieser'}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1 transition ${
                        isLive
                          ? 'bg-emerald-900/25 ring-emerald-500/40 hover:bg-emerald-900/35'
                          : isFav
                            ? 'bg-amber-900/20 ring-amber-500/30 hover:bg-amber-900/30'
                            : 'bg-forest-950/70 ring-forest-800/40 hover:ring-forest-700'
                      } ${isPast ? 'opacity-50' : ''}`}
                    >
                      <span className="text-sm tabular-nums text-forest-200 font-semibold">
                        {fmtClock(i.start_time)}
                      </span>
                      <div
                        className="h-6 w-1 rounded-full"
                        style={{ background: sauna?.accent_color ?? '#22c55e' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-forest-100 truncate">
                          {i.title || 'Aufguss'} <span className="text-forest-400">· {meisterName(i.saunameister_id)}</span>
                        </div>
                        <div className="text-[11px] text-forest-400">{sauna?.name ?? 'Sauna'}</div>
                      </div>
                      {isLive && (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-950">
                          Live
                        </span>
                      )}
                      {isFav && <span className="text-base">❤️</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Quick-Actions — alle Gast-Bereiche auf einen Blick */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
            🚀 Entdecken
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <Link to="/aufgieser" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">🌟</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">Aufgießer</div>
              <div className="text-[10px] text-forest-400">entdecken</div>
            </Link>
            <Link to="/feed" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">📸</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">Feed</div>
              <div className="text-[10px] text-forest-400">Community</div>
            </Link>
            <Link to="/spiele" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">🎮</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">Spiele</div>
              <div className="text-[10px] text-forest-400">14 Games</div>
            </Link>
            <Link to="/wm" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">🏆</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">WM-Tipspiel</div>
              <div className="text-[10px] text-forest-400">mittippen</div>
            </Link>
            <Link to="/dashboard" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">📺</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">Tafel</div>
              <div className="text-[10px] text-forest-400">aktueller Plan</div>
            </Link>
            <Link to="/hilfe" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
              <div className="text-2xl">📖</div>
              <div className="mt-1 text-xs font-semibold text-forest-100">Handbuch</div>
              <div className="text-[10px] text-forest-400">Anleitung</div>
            </Link>
          </div>
        </section>

        {/* ── Mein Sauna-Jahr: Stats · Aktivität · Erfolge ── */}
        {me.data && <MemberStatsCard memberId={me.data.id} />}
        {me.data && <MemberAttendanceChart memberId={me.data.id} />}
        {me.data && <MemberAchievementsGallery memberId={me.data.id} />}

        {/* Fan-Upgrade-CTA — milestone-getriggert (≥5 Bewertungen oder ≥3 Sauna-Tage).
            Zeigt auch Status-Card wenn Antrag schon läuft. Echte Gäste only. */}
        <FanUpgradeCTA />

        {/* Benachrichtigungen — Push-Aktivierung */}
        {me.data && (
          <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              🔔 Benachrichtigungen
            </h2>
            <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
              Aktiviere Push-Benachrichtigungen, damit du sofort erfährst wenn deine
              Lieblings-Aufgießer einen neuen Aufguss planen.
            </p>
            <PushPermission memberId={me.data.id} />
          </section>
        )}

        {/* GDPR — Recht auf Vergessen. Nur für echte Gäste sichtbar (analog Fan.tsx). */}
        {isReallyGast && (
          <section className="rounded-3xl bg-forest-950/40 ring-1 ring-forest-800/40 p-5">
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-forest-400 hover:text-forest-200 list-none flex items-center gap-2">
                <span className="transition group-open:rotate-90">▸</span>
                Datenschutz & Account-Löschung
              </summary>
              <div className="mt-3 space-y-3 text-xs text-forest-300/80 leading-relaxed">
                <p>
                  Du kannst deinen Gäste-Account jederzeit selbst löschen. Alle Daten werden
                  sofort und vollständig entfernt — Profil, Bewertungen, Favoriten, Badges,
                  Feed-Beiträge, Nachrichten und Spielstände. Es bleibt nichts zurück.
                  Details in der{' '}
                  <Link to="/datenschutz" className="underline text-forest-200 hover:text-amber-300">
                    Datenschutzerklärung
                  </Link>.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccount.isPending}
                  className="rounded-lg bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  {deleteAccount.isPending ? 'Lösche…' : '🗑 Gäste-Account endgültig löschen'}
                </button>
              </div>
            </details>
          </section>
        )}
      </main>
    </PageBackground>
  );
}
