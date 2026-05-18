import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentMember } from '@/lib/api';
import { isAufgieser } from '@/lib/roles';
import { CheckinFamilyModal } from '@/components/CheckinFamilyModal';
import { supabase } from '@/lib/supabase';

// /checkin/rate — Bestätigungs-Page nach erfolgreichem Tablet-PIN-Check-in.
// Tablet bewertet NICHT mehr (siehe Migration 0082) — Bewerten geht nur noch
// in der App auf dem eigenen Smartphone. Diese Page bestätigt nur den Check-in
// und erinnert ans Bewerten in der App.
//
// Auto-Logout nach 15s (Page ist statisch, kein Input erwartet).
// CheckinFamilyModal bleibt — Familien-Buchung läuft weiter.
export default function CheckinRate() {
  const nav = useNavigate();
  const me = useCurrentMember();
  const [timeLeft, setTimeLeft] = useState(15);
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

  // Auto-Logout nach 15s — pausiert wenn Familie-Modal offen
  useEffect(() => {
    if (familyModal) {
      setTimeLeft(15);
      return;
    }
    const startedAt = Date.now();
    const target = startedAt + 15_000;
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(iv);
        void handleLogout();
      }
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyModal]);

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {});
    nav('/checkin');
  }

  if (me.isLoading) {
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

  const firstName = (me.data.name ?? '').split(' ')[0] || me.data.name || 'du';
  const isAufg = isAufgieser(me.data);
  const fristText = isAufg
    ? 'Du hast 3 Stunden nach jedem Aufguss-Ende Zeit zum Bewerten.'
    : 'Du hast bis morgen 12:00 Uhr Zeit zum Bewerten.';

  return (
    <div className="min-h-screen bg-schwarzwald-soft p-6 flex flex-col items-center justify-center">
      <main className="w-full max-w-xl space-y-5">
        {/* Big confirmation card */}
        <section className="rounded-3xl bg-gradient-to-br from-emerald-900/40 via-forest-950/90 to-forest-950/90 ring-1 ring-emerald-500/40 backdrop-blur-xl p-8 text-center shadow-2xl shadow-emerald-950/40">
          <div className="text-7xl mb-3" aria-hidden>✅</div>
          <h1 className="text-3xl font-bold text-forest-100 mb-2">
            Eingecheckt, {firstName}!
          </h1>
          <p className="text-base text-forest-300/90">
            Schön dass du da bist. Genieß deine Aufgüsse 🧖
          </p>
        </section>

        {/* Bewerten-Hinweis */}
        <section className="rounded-2xl bg-amber-900/15 ring-1 ring-amber-500/40 backdrop-blur-md p-5 text-center">
          <div className="text-3xl mb-2" aria-hidden>📱</div>
          <h2 className="text-base font-semibold text-amber-100 mb-1">
            Bewerten geht ganz bequem in der App
          </h2>
          <p className="text-sm text-forest-200/90 leading-relaxed">
            {fristText}
            <br />
            <span className="text-xs text-forest-400 mt-1 inline-block">
              Du kriegst nach jedem Aufguss eine Push-Erinnerung — bewerte in Ruhe in der App auf deinem Handy.
            </span>
          </p>
        </section>

        {/* Logout-Button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleLogout}
            className="rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-6 py-3 text-sm font-semibold text-forest-200 hover:bg-forest-800 transition"
          >
            🔓 Tablet freigeben
          </button>
          <span className="text-[10px] text-forest-500 tabular-nums">
            Auto-Logout in {timeLeft}s
          </span>
        </div>
      </main>

      {/* Familien-Modal (nach PIN-Checkin, wenn Mitglied Familie konfiguriert hat) */}
      {familyModal && (
        <CheckinFamilyModal
          open
          memberName={familyModal.name}
          familyHasPartner={familyModal.partner}
          familyChildrenCount={familyModal.childrenCount}
          onClose={() => setFamilyModal(null)}
        />
      )}
    </div>
  );
}
