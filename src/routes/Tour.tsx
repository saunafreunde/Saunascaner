import { Link } from 'react-router-dom';
import { useBrandSettings, publicAssetUrl } from '@/lib/api';

// Welcome-Tour für Mitglieder-Präsentation. Public-Route /tour.
// Vertikal scroll-snap, 8 Sektionen, Glassmorphism, Pure-CSS-Animationen
// (Prefix tour-*). Lese-Zeit ~3-5 Min, Mitglieder scannen QR auf Tafel
// und sehen sie auf eigenem Handy.

type RoleCard = {
  emoji: string;
  title: string;
  color: string;
  bullets: string[];
  cta: { label: string; to: string };
};

const ROLES: RoleCard[] = [
  {
    emoji: '👋',
    title: 'Gast',
    color: '#22c55e',
    bullets: [
      'Aufgüsse ansehen, Aufgießer kennenlernen',
      'Aufgüsse bewerten und Sterne vergeben',
      'Wünsche und Anregungen schicken',
    ],
    cta: { label: 'Gast werden', to: '/gast-signup' },
  },
  {
    emoji: '🤝',
    title: 'Fan / Förderer',
    color: '#f97316',
    bullets: [
      'Alle Gast-Funktionen + exklusive Inhalte',
      'Aroma-Rezepte einsehen, Vereins-News',
      'Fan-Ausweis als PDF zum Download',
    ],
    cta: { label: 'Mehr erfahren', to: '/login' },
  },
  {
    emoji: '🧖',
    title: 'Aufgießer',
    color: '#ef4444',
    bullets: [
      'Deine Aufgüsse planen und verwalten',
      'Eigenes Profil mit Specialty, Sterne sammeln',
      'Helfer für Team-Aufgüsse anfragen',
    ],
    cta: { label: 'Anmelden', to: '/login' },
  },
  {
    emoji: '🤝',
    title: 'Helfer',
    color: '#3b82f6',
    bullets: [
      'Bei Vereinsarbeit unterstützen',
      'Aufgaben einsehen und übernehmen',
      'Aufgießer bei Team-Aufgüssen begleiten',
    ],
    cta: { label: 'Anmelden', to: '/login' },
  },
  {
    emoji: '⚙️',
    title: 'Admin',
    color: '#a855f7',
    bullets: [
      'Alle Mitglieder + Aufgüsse verwalten',
      'Tafel-Bühne steuern (Themes, Effekte)',
      'Statistiken, Branding, Module',
    ],
    cta: { label: 'Anmelden', to: '/login' },
  },
];

export default function Tour() {
  const brand = useBrandSettings();
  const logoPath = brand.data?.logo?.banner ?? brand.data?.logo?.icon;
  const logoUrl = logoPath ? publicAssetUrl(logoPath) : null;

  return (
    <div className="tour-root bg-schwarzwald text-slate-100 min-h-screen">
      <style>{`
        .tour-root {
          scroll-snap-type: y mandatory;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .tour-section {
          scroll-snap-align: start;
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 2rem 1.5rem;
          position: relative;
          text-align: center;
        }
        .tour-glass {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.4);
          border-radius: 1.5rem;
        }
        @keyframes tour-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%      { transform: translateY(8px); opacity: 1; }
        }
        @keyframes tour-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-12px) scale(1.04); }
        }
        @keyframes tour-fade-up {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes tour-spin-slow {
          from { transform: rotate(0); }
          to   { transform: rotate(360deg); }
        }
        @keyframes tour-snowfall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.7; }
          100% { transform: translate3d(20px, 110vh, 0); opacity: 0; }
        }
        @keyframes tour-glow {
          0%, 100% { filter: drop-shadow(0 0 6px currentColor); }
          50%      { filter: drop-shadow(0 0 16px currentColor); }
        }
        .tour-scroll-arrow {
          position: absolute;
          bottom: 1.5rem; left: 50%;
          transform: translateX(-50%);
          font-size: 2rem; opacity: 0.5;
          animation: tour-bounce 2s ease-in-out infinite;
        }
        .tour-float { animation: tour-float 4s ease-in-out infinite; will-change: transform; }
        .tour-fade-up { animation: tour-fade-up 0.8s ease-out forwards; }
        .tour-glow { animation: tour-glow 2.5s ease-in-out infinite; }
        .tour-spin { animation: tour-spin-slow 30s linear infinite; will-change: transform; }
        .tour-snowflake {
          position: absolute; top: 0;
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,0.85);
          will-change: transform, opacity;
          animation: tour-snowfall 12s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tour-root { scroll-snap-type: none; }
          .tour-bounce, .tour-float, .tour-fade-up, .tour-glow, .tour-spin, .tour-snowflake { animation: none; }
          .tour-scroll-arrow { animation: none; }
        }
      `}</style>

      {/* ── 1. HERO ── */}
      <section className="tour-section">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 25 }, (_, i) => (
            <span key={i} className="tour-snowflake"
              style={{
                left: `${(i * 41) % 100}%`,
                animationDelay: `${-((i * 0.7) % 12)}s`,
                animationDuration: `${10 + ((i * 1.3) % 6)}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6 tour-fade-up">
          {logoUrl && (
            <img src={logoUrl} alt="Saunafreunde Schwarzwald" className="h-32 w-auto rounded-2xl tour-float drop-shadow-2xl" />
          )}
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            Saunafreunde Schwarzwald
          </h1>
          <p className="text-xl text-forest-200/85 max-w-md leading-relaxed">
            Unsere neue Vereins-App.<br />
            <span className="text-amber-300 font-semibold">Wisch nach unten</span> für eine kurze Tour.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 2. AUFGUSS-TAFEL ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-8 tour-fade-up">
          <div className="text-7xl mb-4">🧖</div>
          <h2 className="text-3xl font-bold mb-3 text-white">Die Aufguss-Tafel</h2>
          <p className="text-lg text-forest-200/85 leading-relaxed mb-4">
            Immer sehen, <strong className="text-amber-300">wer wann gießt</strong>.<br />
            Live im Verein auf dem großen TV.
          </p>
          <p className="text-sm text-forest-300/75">
            Aufgießer planen, Mitglieder schauen — kein Aushang, kein WhatsApp-Chaos.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 3. BEWERTEN & STARS ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-8 tour-fade-up">
          <div className="text-7xl mb-4 tour-glow text-amber-400">⭐</div>
          <h2 className="text-3xl font-bold mb-3 text-white">Bewerten & Sterne</h2>
          <p className="text-lg text-forest-200/85 leading-relaxed mb-4">
            Jeder Aufguss zählt.<br />
            Nach dem Aufguss eine Bewertung — die Aufgießer sammeln <strong className="text-amber-300">Sterne</strong>.
          </p>
          <div className="flex justify-center gap-1 text-3xl">⭐⭐⭐⭐⭐</div>
          <p className="text-sm text-forest-300/75 mt-3">
            Du bekommst eigene Stats: wie viele Aufgüsse, welche Specialty, deine Lieblings-Aufgießer.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 4. FEED & FOTOS ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-8 tour-fade-up">
          <div className="text-7xl mb-4 tour-float">📸</div>
          <h2 className="text-3xl font-bold mb-3 text-white">Feed & Fotos</h2>
          <p className="text-lg text-forest-200/85 leading-relaxed mb-4">
            Mini-Insta nur für den Verein.<br />
            Teile <strong className="text-amber-300">Momente, Aromen, Bühnen-Vibes</strong>.
          </p>
          <p className="text-sm text-forest-300/75">
            1 Bild · 280 Zeichen · 5 Reaktionen · alles bleibt unter uns Saunafreunden.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 5. BADGES ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-8 tour-fade-up">
          <div className="flex justify-center gap-2 mb-4 text-5xl">
            <span className="tour-float" style={{ animationDelay: '0s' }}>🏆</span>
            <span className="tour-float" style={{ animationDelay: '-1s' }}>🎖️</span>
            <span className="tour-float" style={{ animationDelay: '-2s' }}>🥇</span>
          </div>
          <h2 className="text-3xl font-bold mb-3 text-white">Badges & Auszeichnungen</h2>
          <p className="text-lg text-forest-200/85 leading-relaxed mb-4">
            Über <strong className="text-amber-300">Auszeichnungen</strong> für deine Vereinsaktivität — für Aufgüsse, Anwesenheit, Mithilfe und mehr.
          </p>
          <p className="text-sm text-forest-300/75">
            Spielerisch dabei sein, Mitspieler kennenlernen.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 6. BÜHNE ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-8 tour-fade-up">
          <div className="text-7xl mb-4 tour-spin inline-block">🎭</div>
          <h2 className="text-3xl font-bold mb-3 text-white">Die Bühne lebt</h2>
          <p className="text-lg text-forest-200/85 leading-relaxed mb-4">
            Die Tafel wechselt automatisch mit der Jahreszeit:<br />
            🎄 Weihnachten · 🎃 Halloween · 🌸 Frühling · 🍂 Herbst …
          </p>
          <p className="text-sm text-forest-300/75">
            Plus Live-Effekte: Feuerwerk, Konfetti, Monster-Schreck — vom Admin per Klick.
          </p>
        </div>
        <span className="tour-scroll-arrow" aria-hidden>⌄</span>
      </section>

      {/* ── 7. WELCHE ROLLE? ── */}
      <section className="tour-section" style={{ minHeight: 'auto', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="max-w-2xl w-full tour-fade-up">
          <h2 className="text-3xl font-bold mb-2 text-center text-white">Welche Rolle bist du?</h2>
          <p className="text-sm text-forest-300/70 text-center mb-8">5 Möglichkeiten, mitzumachen</p>
          <div className="flex flex-col gap-3">
            {ROLES.map((r) => (
              <div
                key={r.title}
                className="tour-glass p-5 text-left flex gap-4 items-center"
                style={{ borderLeft: `4px solid ${r.color}` }}
              >
                <div className="text-5xl flex-shrink-0">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-1.5" style={{ color: r.color }}>{r.title}</h3>
                  <ul className="text-sm text-forest-200/80 leading-snug space-y-0.5">
                    {r.bullets.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={r.cta.to}
                  className="flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition active:scale-95"
                  style={{ background: `${r.color}cc`, boxShadow: `0 4px 16px ${r.color}55` }}
                >
                  {r.cta.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. CALL-TO-ACTION ── */}
      <section className="tour-section">
        <div className="tour-glass max-w-md p-10 tour-fade-up">
          <div className="text-7xl mb-4 tour-glow text-amber-400">✨</div>
          <h2 className="text-4xl font-bold mb-4 text-white">Jetzt mitmachen!</h2>
          <p className="text-base text-forest-200/85 leading-relaxed mb-6">
            Schon Mitglied? Direkt anmelden.<br />
            Noch nicht? Schnell als Gast registrieren — kostenlos.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              className="rounded-xl bg-amber-500 px-6 py-4 text-base font-bold text-amber-950 hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/30"
            >
              🔑 Anmelden (Mitglied)
            </Link>
            <Link
              to="/gast-signup"
              className="rounded-xl bg-forest-600 px-6 py-4 text-base font-bold text-white hover:bg-forest-500 active:scale-95 transition shadow-lg shadow-forest-600/30"
            >
              👋 Als Gast beitreten
            </Link>
            <Link
              to="/dashboard"
              className="rounded-xl bg-forest-900/60 ring-1 ring-forest-700/50 px-6 py-3 text-sm font-semibold text-forest-200 hover:bg-forest-800 active:scale-95 transition"
            >
              📺 Nur die Tafel ansehen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
