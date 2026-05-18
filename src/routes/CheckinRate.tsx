import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInMinutes } from 'date-fns';
import {
  useCurrentMember, useRatableInfusions, useMeisterDirectory, useSaunas,
  type RatableInfusion,
} from '@/lib/api';
import { RatingForm } from '@/components/RatingForm';
import { CheckinFamilyModal } from '@/components/CheckinFamilyModal';
import { supabase } from '@/lib/supabase';
import { fmtClock } from '@/lib/time';

// /checkin/rate — am Tablet eingeloggter Gast sieht seine bewertbaren Aufgüsse.
// Auto-Logout nach 30s Inaktivität wenn kein Rating-Modal offen ist.
// Nach Submit eines Ratings: Karte wird grün, andere bleiben offen.
// "Fertig"-Button beendet die Session.
export default function CheckinRate() {
  const nav = useNavigate();
  const me = useCurrentMember();
  const infusionsQ = useRatableInfusions(me.data?.id);
  const meisterDir = useMeisterDirectory();
  const saunas = useSaunas();
  const [activeInfusion, setActiveInfusion] = useState<RatableInfusion | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [autoLogoutAt, setAutoLogoutAt] = useState<number>(() => Date.now() + 30_000);
  const [timeLeft, setTimeLeft] = useState(30);
  // Familien-Modal nach PIN-Check-in (Daten kommen via sessionStorage aus /checkin)
  const [familyModal, setFamilyModal] = useState<{ name: string; partner: boolean; childrenCount: number } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pending_family_modal');
      if (!raw) return;
      sessionStorage.removeItem('pending_family_modal');
      const parsed = JSON.parse(raw) as { name?: string; family_has_partner?: boolean; family_children_count?: number };
      setFamilyModal({
        name: parsed.name ?? 'Gast',
        partner: !!parsed.family_has_partner,
        childrenCount: parsed.family_children_count ?? 0,
      });
    } catch { /* ignore */ }
  }, []);

  // Idle-Timer: 30s ohne Aktivität → Logout. Bei aktivem Modal pausiert.
  const resetIdle = () => setAutoLogoutAt(Date.now() + 30_000);

  useEffect(() => {
    if (activeInfusion) return; // Pause während Bewertung
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.round((autoLogoutAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleLogout();
      }
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLogoutAt, activeInfusion]);

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {});
    nav('/checkin');
  }

  const meisterName = (id: string | null) =>
    (id && meisterDir.data?.find((m) => m.id === id)?.name) || 'Aufgießer:in';
  const saunaById = (id: string) => saunas.data?.find((s) => s.id === id);

  if (me.isLoading || infusionsQ.isLoading) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft grid place-items-center">
        <p className="text-forest-300">Lädt…</p>
      </div>
    );
  }

  if (!me.data) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft grid place-items-center p-6 text-center">
        <div>
          <p className="text-forest-300">Nicht eingeloggt. Bitte erneut PIN eingeben.</p>
          <button
            onClick={() => nav('/checkin')}
            className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950"
          >
            Zurück zur PIN-Eingabe
          </button>
        </div>
      </div>
    );
  }

  const list = (infusionsQ.data ?? []).filter((i) => !i.already_rated || submittedIds.has(i.id));
  const ratableNow = list.filter((i) => !submittedIds.has(i.id));

  return (
    <div className="min-h-screen bg-schwarzwald-soft p-4" onTouchStart={resetIdle} onMouseMove={resetIdle}>
      <header className="mx-auto max-w-3xl flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-forest-100">Hallo {me.data.name} 👋</h1>
          <p className="text-sm text-forest-300/80">Welche Aufgüsse möchtest du bewerten?</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleLogout}
            className="rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-2 text-sm text-forest-200 hover:bg-forest-800"
          >
            ✓ Fertig
          </button>
          {!activeInfusion && (
            <span className="text-[10px] text-forest-500 tabular-nums">
              Auto-Logout in {timeLeft}s
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3">
        {ratableNow.length === 0 ? (
          <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-6 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-lg font-semibold text-forest-100">
              {submittedIds.size > 0 ? 'Danke, alle bewertet!' : 'Keine bewertbaren Aufgüsse gerade'}
            </h2>
            <p className="mt-2 text-sm text-forest-300/80">
              {submittedIds.size > 0
                ? `Du hast ${submittedIds.size} Bewertung${submittedIds.size === 1 ? '' : 'en'} abgegeben.`
                : 'Komm später wieder — Aufgüsse erscheinen hier sobald sie zu Ende sind.'}
            </p>
            <button
              onClick={handleLogout}
              className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 font-semibold text-amber-950"
            >
              Schließen
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((i) => {
              const sauna = saunaById(i.sauna_id);
              const submitted = submittedIds.has(i.id);
              const minsAgo = differenceInMinutes(new Date(), new Date(i.end_time));
              return (
                <li key={i.id}>
                  <button
                    onClick={() => {
                      if (submitted) return;
                      resetIdle();
                      setActiveInfusion(i);
                    }}
                    disabled={submitted}
                    className={`w-full text-left rounded-2xl ring-1 px-4 py-3 transition ${
                      submitted
                        ? 'bg-emerald-950/40 ring-emerald-500/40 cursor-default'
                        : 'bg-forest-950/85 ring-forest-800/60 hover:ring-amber-500/40 hover:bg-forest-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-2 rounded-full flex-shrink-0"
                        style={{ background: sauna?.accent_color ?? '#22c55e' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-forest-100 truncate">
                            {i.title || 'Aufguss'}
                          </span>
                          <span className="text-sm text-forest-400">· {meisterName(i.saunameister_id)}</span>
                        </div>
                        <div className="text-xs text-forest-400">
                          {sauna?.name ?? 'Sauna'} · {fmtClock(i.start_time)}–{fmtClock(i.end_time)} · vor {minsAgo} Min
                        </div>
                      </div>
                      {submitted ? (
                        <span className="rounded-full bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-500/50 px-3 py-1 text-xs font-semibold">
                          ✓ Bewertet
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-1 text-xs font-semibold">
                          ⭐ Bewerten
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Rating-Modal */}
      {activeInfusion && me.data && (
        <RatingForm
          infusion={activeInfusion}
          meisterName={meisterName(activeInfusion.saunameister_id)}
          memberId={me.data.id}
          onClose={() => { setActiveInfusion(null); resetIdle(); }}
          onSuccess={() => {
            setSubmittedIds((s) => {
              const next = new Set(s);
              next.add(activeInfusion.id);
              return next;
            });
            setActiveInfusion(null);
            resetIdle();
          }}
        />
      )}

      {/* Familien-Modal (nach PIN-Checkin, wenn Mitglied Familie konfiguriert hat) */}
      {familyModal && (
        <CheckinFamilyModal
          open
          memberName={familyModal.name}
          familyHasPartner={familyModal.partner}
          familyChildrenCount={familyModal.childrenCount}
          onClose={() => { setFamilyModal(null); resetIdle(); }}
        />
      )}
    </div>
  );
}
