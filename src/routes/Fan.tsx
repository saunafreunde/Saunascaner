import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import {
  useCurrentMember, useBrandSettings, brandAssetUrl,
  useOrgNews, useApprovedAromaRecipes,
} from '@/lib/api';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { PageBackground } from '@/components/PageBackground';
import { MemberStatsCard } from '@/components/MemberStatsCard';
import { MemberAchievementsGallery } from '@/components/MemberAchievementsGallery';
import { GastProfileHeader } from '@/components/GastProfileHeader';
import { PushPermission } from '@/components/PushPermission';
import { MyCheckinPinCard } from '@/components/MyCheckinPinCard';
import { PendingRatingsBlock } from '@/components/PendingRatingsBlock';
import { isAdmin, isFan, isPaidMembershipExpiringSoon } from '@/lib/roles';
import { downloadBadge } from '@/lib/badge';

// /fan — interner Bereich für Fördernde Mitglieder (Rolle 'fan').
// Premium-Vorteile gegenüber Gast: Vereins-News-Feed, exklusive Aroma-Rezepte,
// Fan-Ausweis-PDF. Conversion-Pfad: Gast → Fan via Self-Antrag (Migration 0061).
//
// Auch für Admins zur Vorschau über /fan?preview=fan aufrufbar.
export default function Fan() {
  const me = useCurrentMember();
  const [params] = useSearchParams();
  const previewMode = (params.get('preview') === '1' || params.get('preview') === 'fan') && isAdmin(me.data);
  const isReallyFan = isFan(me.data);

  const brand = useBrandSettings();
  const news = useOrgNews();
  const recipes = useApprovedAromaRecipes();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';
  const frontBgUrl = brandAssetUrl(brand.data?.badge?.front_bg);
  const backBgUrl  = brandAssetUrl(brand.data?.badge?.back_bg);

  const daysUntilExpiry = useMemo(() => {
    if (!me.data?.paid_until) return null;
    return differenceInDays(new Date(me.data.paid_until), new Date());
  }, [me.data?.paid_until]);

  const expiringSoon = isPaidMembershipExpiringSoon(me.data);
  const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;

  return (
    <PageBackground page="guest" variant="soft" className="min-h-screen">
      {previewMode && (
        <div className="sticky top-0 z-40 bg-violet-500/20 ring-1 ring-violet-400/40 text-violet-100 px-4 py-2 text-xs text-center">
          🔍 Admin-Vorschau: So sieht ein <strong>Fan</strong> diesen Bereich.
        </div>
      )}

      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-forest-100 truncate">
            Hallo {me.data?.name ?? 'Fan'} 🤝
          </h1>
          <p className="text-[11px] text-forest-400 truncate">
            Förderer · {orgName}
          </p>
        </div>
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* 1. Profil-Header mit Avatar + Motto */}
        {me.data && <GastProfileHeader member={me.data} />}

        {/* 2. Beitrags-Status-Card — prominent oben */}
        {isReallyFan && me.data && (
          <section className={`rounded-3xl p-5 ring-1 ${
            expired
              ? 'bg-rose-950/30 ring-rose-500/40'
              : expiringSoon
              ? 'bg-amber-950/30 ring-amber-500/40'
              : 'bg-forest-950/85 ring-pink-400/30'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-pink-300/90">
                  🏅 Förderer-Status
                </h2>
                <p className="text-xs text-forest-300/80 mt-1">
                  {expired
                    ? `Dein Beitrag ist seit ${Math.abs(daysUntilExpiry!)} Tagen abgelaufen. Bitte melde dich beim Verein.`
                    : me.data.paid_until
                    ? `Förderer-Mitgliedschaft gültig bis ${new Date(me.data.paid_until).toLocaleDateString('de-DE')}${expiringSoon ? ` — in ${daysUntilExpiry} Tagen läuft sie ab` : ''}`
                    : 'Beitragszeitraum noch nicht eingetragen — wir melden uns.'}
                </p>
                {me.data.fan_since && (
                  <p className="text-[11px] text-forest-400/70 mt-1">
                    Fan seit {new Date(me.data.fan_since).toLocaleDateString('de-DE')}
                  </p>
                )}
              </div>
              {me.data && (
                <button
                  onClick={() => downloadBadge({
                    name: me.data!.name,
                    memberCode: me.data!.member_code,
                    memberNumber: me.data!.member_number,
                    role: 'fan',
                    organization: orgName,
                    frontBgUrl,
                    backBgUrl,
                    logoUrl,
                  })}
                  className="rounded-xl bg-pink-500/30 px-4 py-2.5 text-sm font-semibold text-pink-100 ring-1 ring-pink-400/50 hover:bg-pink-500/40"
                >
                  🏅 Fan-Ausweis
                </button>
              )}
            </div>
          </section>
        )}

        {/* 3. Vereins-News-Feed — Premium-Inhalt */}
        <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
              📣 Aus dem Verein
            </h2>
            <span className="text-[10px] text-forest-400">Exklusiv für Förderer</span>
          </div>
          {news.isLoading ? (
            <p className="text-xs text-forest-400">Lade…</p>
          ) : (news.data ?? []).length === 0 ? (
            <p className="text-xs text-forest-400/70 text-center py-4">
              Aktuell keine Vereins-News. Sobald wir was Neues haben, kommt eine Push-Nachricht.
            </p>
          ) : (
            <ul className="space-y-3">
              {(news.data ?? []).map((n) => (
                <li key={n.id} className={`rounded-2xl p-4 ring-1 ${
                  n.pinned
                    ? 'bg-amber-950/30 ring-amber-500/40'
                    : 'bg-forest-900/60 ring-forest-800/40'
                }`}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-forest-100">
                      {n.pinned && '📌 '}{n.title}
                    </h3>
                    <time className="text-[10px] text-forest-400 whitespace-nowrap">
                      {new Date(n.published_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </time>
                  </div>
                  <p className="text-xs text-forest-200/90 whitespace-pre-line leading-relaxed">
                    {n.body}
                  </p>
                  {n.created_by_name && (
                    <p className="text-[10px] text-forest-500 mt-2">— {n.created_by_name}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Aroma-Rezepte der Saunameister — Premium-Inhalt */}
        <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
              🌿 Aroma-Rezepte unserer Saunameister
            </h2>
            <span className="text-[10px] text-forest-400">Exklusiv für Förderer</span>
          </div>
          {recipes.isLoading ? (
            <p className="text-xs text-forest-400">Lade…</p>
          ) : (recipes.data ?? []).length === 0 ? (
            <p className="text-xs text-forest-400/70 text-center py-4">
              Noch keine Rezepte freigegeben — die Saunameister teilen ihre Lieblings-Mischungen demnächst.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(recipes.data ?? []).map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Eigene Stats + Achievements — bleibt erhalten (waren auch im Gast-Bereich) */}
        <PendingRatingsBlock />

        {me.data && <MyCheckinPinCard />}

        {me.data && <MemberStatsCard memberId={me.data.id} />}

        {me.data && <MemberAchievementsGallery memberId={me.data.id} />}

        {/* 6. Push-Aktivierung — wichtig für News-Benachrichtigungen */}
        {me.data && (
          <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              🔔 Benachrichtigungen
            </h2>
            <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
              Bei neuen Vereins-News und Aufgüssen deiner Lieblings-Aufgießer sofort informiert werden.
            </p>
            <PushPermission memberId={me.data.id} />
          </section>
        )}

        {/* 7. Quick-Links */}
        <section className="grid grid-cols-3 gap-3">
          <Link to="/aufgieser" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">🌟</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">Aufgießer</div>
          </Link>
          <Link to="/feed" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">📸</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">Feed</div>
          </Link>
          <Link to="/wm" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">🏆</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">WM</div>
          </Link>
        </section>
      </main>
    </PageBackground>
  );
}

function RecipeCard({ recipe }: { recipe: { id: string; title: string; description: string | null; ingredients: { name: string; drops?: number }[]; sauna_type: string | null; temperature_c: number | null; created_by_name: string | null } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl bg-forest-900/60 ring-1 ring-forest-800/40 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-forest-100">{recipe.title}</h3>
        {recipe.sauna_type && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
            {recipe.sauna_type}
          </span>
        )}
      </div>
      {recipe.temperature_c && (
        <p className="text-[10px] text-forest-400 mb-2">🌡️ {recipe.temperature_c}°C</p>
      )}
      <ul className="text-xs text-forest-200/90 space-y-0.5 mb-2">
        {recipe.ingredients.map((ing, i) => (
          <li key={i}>
            • {ing.name}{ing.drops ? ` · ${ing.drops} Tropfen` : ''}
          </li>
        ))}
      </ul>
      {recipe.description && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-amber-300/80 hover:text-amber-200"
          >
            {expanded ? '⌃ Weniger' : '⌄ Anleitung'}
          </button>
          {expanded && (
            <p className="text-[11px] text-forest-300 mt-2 whitespace-pre-line leading-relaxed">
              {recipe.description}
            </p>
          )}
        </>
      )}
      {recipe.created_by_name && (
        <p className="text-[10px] text-forest-500 mt-2 italic">— {recipe.created_by_name}</p>
      )}
    </div>
  );
}
