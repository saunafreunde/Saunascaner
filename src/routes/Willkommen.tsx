import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// /willkommen — Landing-Page für das Gäste-Tablet am Eingang.
// Anonym, zwei große Touch-Karten:
//   🆕 Neu hier? Anmelden → /checkin/signup
//   🔢 PIN eingeben & einchecken → /checkin
//
// Atmosphäre nach Tafel-Regeln: Endlos-Loops NUR CSS-Keyframes auf
// transform/opacity (GPU), blur ist statisch gesetzt, Prefix wk-*,
// prefers-reduced-motion schaltet alles ab. Läuft im Dauerbetrieb.
//
// Tablet bewertet NICHT mehr — Bewerten geht ausschließlich in der App
// (siehe Migration 0082). /checkin/rate ist nur Bestätigungs-Page.

const BENEFITS = [
  ['🌟', 'Aufgießern folgen'],
  ['📝', 'Aufgüsse bewerten'],
  ['📸', 'Community-Feed'],
  ['🎮', 'Mini-Spiele'],
] as const;

// Zwei Tannen-Reihen als ruhige Silhouette am unteren Rand (statisch,
// bewusst wenige Bäume — Tiefe statt Dichte).
function TreeLine({ y, fill, trees }: { y: number; fill: string; trees: number[] }) {
  return (
    <g fill={fill}>
      {trees.map((x, i) => {
        const h = 46 + ((i * 37) % 28); // deterministisch, kein Math.random (SSR/Re-Render-stabil)
        const w = h * 0.62;
        return (
          <g key={i}>
            <polygon points={`${x},${y - h} ${x - w / 2},${y} ${x + w / 2},${y}`} />
            <polygon points={`${x},${y - h - 14} ${x - w / 2.7},${y - h / 2.4} ${x + w / 2.7},${y - h / 2.4}`} />
          </g>
        );
      })}
    </g>
  );
}

export default function Willkommen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  // Beim Mounten: Falls noch eine Tablet-Session aktiv ist → ausloggen (Kiosk-Pattern).
  // scope:'local' — nur das Tablet, NICHT die Member-Tokens auf anderen Geräten.
  // WICHTIG: signOut feuert SIGNED_OUT → useAuth macht qc.clear() und razt damit
  // auch die gerade ladende brand-settings-Query; auf einem Kiosk ohne
  // Fokus-Wechsel refetcht sie nie → Logo bliebe dauerhaft der Platzhalter.
  // Deshalb: nur bei echter Session ausloggen und die Brand-Query danach
  // gezielt neu laden.
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      qc.refetchQueries({ queryKey: ['brand-settings'] });
    })();
  }, [qc]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-schwarzwald-soft flex flex-col items-center justify-center p-6">
      <style>{`
        /* wk-* — Willkommen-Kiosk. Loops: nur transform/opacity (GPU). */
        @keyframes wk-drift-a {
          0%   { transform: translate3d(-8%, 2%, 0) scale(1); opacity: .07; }
          50%  { transform: translate3d(6%, -4%, 0) scale(1.15); opacity: .13; }
          100% { transform: translate3d(-8%, 2%, 0) scale(1); opacity: .07; }
        }
        @keyframes wk-drift-b {
          0%   { transform: translate3d(6%, -2%, 0) scale(1.1); opacity: .05; }
          50%  { transform: translate3d(-5%, 3%, 0) scale(0.95); opacity: .11; }
          100% { transform: translate3d(6%, -2%, 0) scale(1.1); opacity: .05; }
        }
        @keyframes wk-glow {
          0%, 100% { transform: scale(1); opacity: .35; }
          50%      { transform: scale(1.18); opacity: .6; }
        }
        @keyframes wk-cta-ring {
          0%   { transform: scale(1); opacity: .45; }
          70%  { transform: scale(1.045); opacity: 0; }
          100% { transform: scale(1.045); opacity: 0; }
        }
        @keyframes wk-in {
          from { transform: translate3d(0, 14px, 0); opacity: 0; }
          to   { transform: translate3d(0, 0, 0);   opacity: 1; }
        }
        .wk-steam-a { animation: wk-drift-a 38s ease-in-out infinite; }
        .wk-steam-b { animation: wk-drift-b 27s ease-in-out infinite; }
        .wk-logo-glow { animation: wk-glow 6.5s ease-in-out infinite; }
        .wk-cta-ring { animation: wk-cta-ring 3.2s ease-out infinite; }
        .wk-in-1 { animation: wk-in .55s ease-out both; }
        .wk-in-2 { animation: wk-in .55s ease-out .12s both; }
        .wk-in-3 { animation: wk-in .55s ease-out .24s both; }
        @media (prefers-reduced-motion: reduce) {
          .wk-steam-a, .wk-steam-b, .wk-logo-glow, .wk-cta-ring,
          .wk-in-1, .wk-in-2, .wk-in-3 { animation: none; }
        }
      `}</style>

      {/* ── Atmosphäre: Dampfschwaden + warmer Schimmer + Tannen-Silhouette ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* warmer Amber-Schimmer oben mittig (statisch) */}
        <div
          className="absolute left-1/2 top-[-18%] h-[55vh] w-[80vw] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 65%)' }}
        />
        {/* Dampf-Blobs: blur statisch, animiert werden nur transform/opacity */}
        <div
          className="wk-steam-a absolute left-[8%] top-[18%] h-[44vh] w-[44vh] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232,245,232,0.5) 0%, transparent 60%)', filter: 'blur(70px)' }}
        />
        <div
          className="wk-steam-b absolute right-[6%] top-[38%] h-[52vh] w-[52vh] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232,245,232,0.4) 0%, transparent 60%)', filter: 'blur(80px)' }}
        />
        {/* Tannen-Silhouette unten, 2 Tiefen-Ebenen */}
        <svg
          className="absolute inset-x-0 bottom-0 h-[22vh] w-full"
          viewBox="0 0 1200 150"
          preserveAspectRatio="xMidYMax slice"
        >
          <TreeLine y={150} fill="rgba(10,24,16,0.55)" trees={[40, 190, 330, 470, 620, 780, 930, 1080, 1170]} />
          <TreeLine y={150} fill="rgba(6,16,10,0.85)" trees={[110, 400, 700, 1010]} />
        </svg>
      </div>

      {/* ── Inhalt ── */}
      <header className="wk-in-1 relative z-10 text-center mb-9">
        <div className="relative mx-auto mb-5 h-24 w-24">
          {/* Glut-Glühen hinter dem Logo */}
          <div
            className="wk-logo-glow absolute -inset-5 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)' }}
            aria-hidden
          />
          <img
            src={logoUrl ?? '/icons/icon-512.png'}
            alt={orgName}
            className="relative h-24 w-24 rounded-2xl object-cover ring-2 ring-amber-500/50 shadow-xl shadow-black/40"
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-forest-50 tracking-tight">
          Schön, dass du da bist!
        </h1>
        <p className="text-sm text-forest-300 mt-2">{orgName}</p>
      </header>

      <main className="wk-in-2 relative z-10 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={() => nav('/checkin/signup')}
          className="group relative rounded-3xl bg-gradient-to-br from-amber-900/45 via-forest-950/90 to-forest-950/95 ring-1 ring-amber-500/50 backdrop-blur-xl p-7 min-h-[230px] text-center shadow-xl shadow-amber-950/30 transition-transform active:scale-[0.97]"
        >
          {/* sanft pulsierender Aufmerksamkeits-Ring (transform/opacity only) */}
          <div className="wk-cta-ring pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-amber-400/80" aria-hidden />
          <span className="absolute right-4 top-4 rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">
            ⚡ In 30 Sekunden dabei
          </span>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 ring-2 ring-amber-400/40 text-5xl" aria-hidden>
            👋
          </div>
          <h2 className="text-2xl font-bold text-amber-100 mb-1.5">Ich bin neu hier</h2>
          <p className="text-sm text-forest-300/90 leading-snug">
            Name + E-Mail eingeben — dein persönlicher PIN erscheint sofort hier auf dem Bildschirm.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
            Jetzt anmelden <span className="transition-transform group-active:translate-x-1">→</span>
          </span>
        </button>

        <button
          onClick={() => nav('/checkin')}
          className="group relative rounded-3xl bg-gradient-to-br from-emerald-900/45 via-forest-950/90 to-forest-950/95 ring-1 ring-emerald-500/50 backdrop-blur-xl p-7 min-h-[230px] text-center shadow-xl shadow-emerald-950/30 transition-transform active:scale-[0.97]"
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-400/40 text-5xl" aria-hidden>
            🔢
          </div>
          <h2 className="text-2xl font-bold text-emerald-100 mb-1.5">Ich habe einen PIN</h2>
          <p className="text-sm text-forest-300/90 leading-snug">
            4 Ziffern eintippen und du bist eingecheckt — bewerten kannst du später gemütlich zuhause.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
            Einchecken <span className="transition-transform group-active:translate-x-1">→</span>
          </span>
        </button>
      </main>

      {/* Wofür lohnt sich das? Eine ruhige Zeile, keine Ablenkung. */}
      <div className="wk-in-3 relative z-10 mt-8 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
        {BENEFITS.map(([emoji, label]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-950/70 ring-1 ring-forest-800/60 px-3 py-1.5 text-xs text-forest-300"
          >
            <span aria-hidden>{emoji}</span> {label}
          </span>
        ))}
      </div>

      <footer className="wk-in-3 relative z-10 mt-8 text-center">
        <p className="text-[11px] text-forest-500">
          Tablet im Gäste-Bereich · Bitte freilassen wenn du fertig bist
        </p>
      </footer>
    </div>
  );
}
