import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// /willkommen — Landing-Page für das 3. Tablet im Gäste-Bereich (Eingang Sauna).
// Anonym, zwei große Buttons:
//   🆕 Neu hier? Anmelden → /checkin/signup
//   📝 PIN eingeben & einchecken → /checkin
//
// Tablet bewertet NICHT mehr — Bewerten geht ausschließlich in der App
// (siehe Migration 0082). /checkin/rate wurde zur Bestätigungs-Page.
export default function Willkommen() {
  const nav = useNavigate();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  // Beim Mounten: Falls noch eine Tablet-Session aktiv ist → ausloggen (Kiosk-Pattern).
  useEffect(() => {
    supabase?.auth.signOut().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-schwarzwald-soft flex flex-col items-center justify-center p-6">
      <header className="text-center mb-10">
        <img
          src={logoUrl ?? '/icons/icon-512.png'}
          alt={orgName}
          className="mx-auto h-24 w-24 rounded-2xl object-cover ring-2 ring-amber-500/40 shadow-xl shadow-black/40 mb-5"
        />
        <h1 className="text-3xl sm:text-4xl font-bold text-forest-100">
          Willkommen!
        </h1>
        <p className="text-sm text-forest-300 mt-1">{orgName}</p>
      </header>

      <main className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => nav('/checkin/signup')}
          className="group rounded-3xl bg-gradient-to-br from-amber-900/40 via-forest-950/90 to-forest-950/95 ring-1 ring-amber-500/40 hover:ring-amber-400/70 backdrop-blur-xl p-6 min-h-[180px] text-center shadow-xl shadow-amber-950/30 transition active:scale-[0.98]"
        >
          <div className="text-6xl mb-3" aria-hidden>🆕</div>
          <h2 className="text-xl font-bold text-amber-100 mb-1">
            Neu hier?
          </h2>
          <p className="text-sm text-forest-300/90 leading-snug">
            Schnell anmelden — Name + E-Mail, schon kannst du loslegen.
          </p>
        </button>

        <button
          onClick={() => nav('/checkin')}
          className="group rounded-3xl bg-gradient-to-br from-emerald-900/40 via-forest-950/90 to-forest-950/95 ring-1 ring-emerald-500/40 hover:ring-emerald-400/70 backdrop-blur-xl p-6 min-h-[180px] text-center shadow-xl shadow-emerald-950/30 transition active:scale-[0.98]"
        >
          <div className="text-6xl mb-3" aria-hidden>📝</div>
          <h2 className="text-xl font-bold text-emerald-100 mb-1">
            Schon registriert?
          </h2>
          <p className="text-sm text-forest-300/90 leading-snug">
            PIN eingeben & einchecken. Bewerten geht später in der App.
          </p>
        </button>
      </main>

      <footer className="mt-10 text-center">
        <p className="text-[11px] text-forest-500">
          Tablet im Gäste-Bereich · Bitte freilassen wenn du fertig bist
        </p>
      </footer>
    </div>
  );
}
