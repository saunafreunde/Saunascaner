import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember, useBrandSettings, brandAssetUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type Mode = 'magic' | 'signin' | 'signup' | 'bootstrap';

export default function Login() {
  const { user, ready, signIn, signUp } = useAuth();
  const member = useCurrentMember();
  const brand = useBrandSettings();
  const loc = useLocation();
  const nav = useNavigate();
  // Default-Landing pro Rolle:
  // - gast            → /gast
  // - staff           → /mitarbeiter
  // - member ohne is_aufgieser → /unterstuetzer
  // - alle anderen (Aufgießer, Gast-Aufgießer, Admin) → /planner
  const role = member.data?.role;
  const isAufgieserFlag = member.data?.is_aufgieser;
  const defaultNext =
    role === 'gast'  ? '/gast' :
    role === 'staff' ? '/mitarbeiter' :
    role === 'member' && !isAufgieserFlag ? '/unterstuetzer' :
    '/planner';
  const rawNext = new URLSearchParams(loc.search).get('next') ?? defaultNext;
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : defaultNext;
  const inviteCode = new URLSearchParams(loc.search).get('invite');

  const [mode, setMode] = useState<Mode>(inviteCode ? 'signup' : 'magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (member.isLoading) return;
    if (!member.data) { setNeedsBootstrap(true); return; }
    nav(next, { replace: true });
  }, [ready, user, member.data, member.isLoading, next, nav]);

  if (ready && user && member.data) return <Navigate to={next} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'magic') {
        const r = await fetch('/api/email?action=magic-link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            redirect_to: `${window.location.origin}${next}`,
            invite_code: inviteCode ?? undefined,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Magic-Link konnte nicht gesendet werden');
        setInfo(data.is_signup
          ? '✨ Wir haben dir einen Aktivierungs-Link geschickt. Bitte E-Mail prüfen.'
          : '✨ Login-Link wurde an deine E-Mail geschickt. Bitte E-Mail prüfen.');
      } else if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, name || email, inviteCode);
        if (error) throw error;
        setInfo(inviteCode
          ? 'Konto mit Einladung angelegt — du bist direkt freigeschaltet. Bitte jetzt anmelden.'
          : 'Konto angelegt. Du kannst dich jetzt anmelden.');
        setMode('signin');
      } else if (mode === 'bootstrap') {
        if (!supabase) throw new Error('Supabase nicht verfügbar');
        const { error } = await supabase.rpc('bootstrap_super_admin', { p_name: name || email });
        if (error) throw error;
        setInfo('Du bist jetzt Super-Admin. Wirst weitergeleitet…');
        setTimeout(() => nav(next, { replace: true }), 800);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showBootstrap = needsBootstrap || mode === 'bootstrap';
  const logoUrl = brand.data?.logo?.icon
    ? brandAssetUrl(brand.data.logo.icon) ?? '/icons/icon-512.png'
    : '/icons/icon-512.png';
  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const shortName = brand.data?.org?.short_name ?? 'Saunafreunde';
  const location = brand.data?.org?.location ?? 'Freudenstadt';

  return (
    <div className="login-stage min-h-full flex flex-col items-center justify-start sm:justify-center px-4 py-6 relative overflow-hidden">
      {/* Schwarzwald-Hintergrund: gestaffelte Bergsilhouetten + sanfter Verlauf */}
      <BackgroundLayers />

      <div className="relative z-10 w-full max-w-md">
        {/* Hero: Logo + Headline */}
        <div className="text-center mb-6 sm:mb-8">
          <img
            src={logoUrl}
            alt="Saunafreunde Schwarzwald"
            className="mx-auto mb-4 h-32 w-32 sm:h-40 sm:w-40 object-contain rounded-2xl drop-shadow-[0_8px_32px_rgba(251,191,36,0.45)]"
          />
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent drop-shadow-lg">
            {shortName}
          </h1>
          <p className="mt-1 text-sm sm:text-base font-medium text-forest-200/90 uppercase tracking-[0.3em]">
            Schwarzwald · {location}
          </p>
        </div>

        {/* Form-Card */}
        <form onSubmit={submit} className="rounded-3xl bg-forest-950/80 backdrop-blur-xl ring-1 ring-amber-500/15 shadow-2xl shadow-black/40 p-5 sm:p-7 space-y-4">
          {/* Mode-Tabs (wenn nicht Bootstrap und nicht Invite-Signup) */}
          {!showBootstrap && !(mode === 'signup' && inviteCode) && (
            <ModeTabs mode={mode} setMode={(m) => { setMode(m); setError(null); setInfo(null); }} />
          )}

          {/* Headline pro Modus */}
          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold text-forest-100">
              {showBootstrap
                ? '🌲 Erste Einrichtung'
                : mode === 'magic'
                  ? '✨ Anmelden per E-Mail'
                  : mode === 'signin'
                    ? '🔑 Mit Passwort anmelden'
                    : '🌲 Konto anlegen'}
            </h2>
            {mode === 'magic' && !showBootstrap && (
              <p className="mt-1 text-xs text-forest-300/80">Kein Passwort merken — Link aus der Mail klicken, fertig.</p>
            )}
          </div>

          {showBootstrap ? (
            <>
              <p className="text-xs text-forest-300/80 leading-relaxed">
                Du bist angemeldet, aber noch kein Super-Admin im System. Wenn du der Erste bist, klicke auf <em>„Als Super-Admin einrichten"</em>.
              </p>
              <Input value={name} onChange={setName} placeholder="Dein Name (für Anzeige)" />
              <PrimaryButton onClick={() => setMode('bootstrap')} busy={busy}>
                Als Super-Admin einrichten
              </PrimaryButton>
            </>
          ) : (
            <>
              {mode === 'signup' && inviteCode && (
                <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 px-4 py-3 text-xs text-amber-100 ring-1 ring-amber-500/40">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>✉️</span><span>Einladungs-Code:</span>
                    <span className="font-mono bg-amber-950/40 px-1.5 py-0.5 rounded">{inviteCode.toUpperCase()}</span>
                  </p>
                  <p className="mt-1 text-amber-200/80">Du wirst automatisch mit der passenden Rolle freigeschaltet.</p>
                </div>
              )}

              {mode === 'signup' && (
                <Input value={name} onChange={setName} placeholder="Name" autoComplete="name" />
              )}

              <Input
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="E-Mail-Adresse"
                autoComplete="email"
                required
              />

              {mode !== 'magic' && (
                <Input
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Passwort"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                />
              )}

              <PrimaryButton busy={busy}>
                {mode === 'magic'
                  ? '✨ Login-Link schicken'
                  : mode === 'signin'
                    ? '🔑 Anmelden'
                    : '🌲 Konto anlegen'}
              </PrimaryButton>

              {mode === 'signin' && (
                <div className="text-center">
                  <Link to="/forgot" className="text-xs text-forest-400/80 hover:text-forest-200 underline">
                    Passwort vergessen?
                  </Link>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/15 px-3 py-2.5 text-xs text-rose-200 ring-1 ring-rose-500/30">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-xl bg-emerald-500/15 px-3 py-2.5 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
              {info}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="mt-6 text-center space-y-0.5">
          <p className="text-[11px] font-semibold text-forest-300/80 tracking-wider">
            {orgName}
          </p>
          <p className="text-[10px] text-forest-400/60 tracking-wider">
            {location} · Made with 🔥
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs (Magic / Passwort / Neu) ──────────────────────────────────────
function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const tabs: { value: Mode; label: string; icon: string }[] = [
    { value: 'magic',  label: 'Login-Link', icon: '✨' },
    { value: 'signin', label: 'Passwort',   icon: '🔑' },
    { value: 'signup', label: 'Neu',        icon: '🌲' },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-forest-900/70 ring-1 ring-forest-800/50">
      {tabs.map((t) => {
        const active = mode === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setMode(t.value)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition ${
              active
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 shadow-lg shadow-amber-900/40'
                : 'text-forest-300 hover:bg-forest-800/60 hover:text-forest-100'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="leading-none">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Input + Button-Helper ──────────────────────────────────────────────
function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <input
      type={props.type ?? 'text'}
      autoComplete={props.autoComplete}
      required={props.required}
      minLength={props.minLength}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className="w-full rounded-xl bg-forest-900/70 px-4 py-3.5 text-base text-forest-50 placeholder:text-forest-400/60 ring-1 ring-forest-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:bg-forest-900 transition"
    />
  );
}

function PrimaryButton({ busy, onClick, children }: { busy?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      disabled={busy}
      onClick={onClick}
      className="w-full rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 px-4 py-4 text-base font-bold text-amber-950 shadow-xl shadow-amber-900/30 ring-1 ring-amber-300/40 transition disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
    >
      {busy ? 'Bitte warten…' : children}
    </button>
  );
}

// ─── Hintergrund: Bergsilhouetten + Verlauf ──────────────────────────────
function BackgroundLayers() {
  return (
    <>
      {/* Tiefer Wald-Verlauf */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at top, #1a3024 0%, #0a1810 50%, #04100a 100%)',
        }}
      />
      {/* Bergsilhouetten — drei Schichten gestaffelt */}
      <svg
        aria-hidden
        viewBox="0 0 800 300"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 -z-10 w-full h-[300px] opacity-90"
      >
        {/* Hintere Bergkette */}
        <path
          d="M0,200 L80,140 L150,170 L230,110 L310,150 L390,90 L470,130 L550,100 L630,140 L710,110 L800,150 L800,300 L0,300 Z"
          fill="#1a2820"
          opacity="0.6"
        />
        {/* Mittlere Bergkette */}
        <path
          d="M0,240 L100,180 L180,210 L270,150 L360,190 L450,140 L540,180 L630,150 L720,190 L800,160 L800,300 L0,300 Z"
          fill="#142018"
          opacity="0.85"
        />
        {/* Vordere Bergkette mit Schneekappen */}
        <path
          d="M0,280 L120,210 L200,240 L290,180 L380,220 L470,170 L560,210 L650,180 L740,210 L800,200 L800,300 L0,300 Z"
          fill="#0a1610"
        />
        {/* Schneekappen-Akzente */}
        <path
          d="M120,210 L135,215 L150,213 L165,218 L180,216 M290,180 L305,185 L320,183 M470,170 L485,175 L500,173 M650,180 L665,184 L680,182"
          stroke="#e8f5e8"
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />
      </svg>
      {/* Sterne / Funken oben */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-1/2 opacity-30">
        <div className="login-sparks" />
      </div>
      <style>{`
        .login-stage {
          background: linear-gradient(to bottom, #0a1810 0%, #0d2018 100%);
        }
        .login-sparks {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20% 30%, rgba(251,191,36,0.6), transparent),
            radial-gradient(1px 1px at 60% 20%, rgba(251,191,36,0.4), transparent),
            radial-gradient(1px 1px at 80% 50%, rgba(251,191,36,0.5), transparent),
            radial-gradient(1px 1px at 35% 60%, rgba(251,191,36,0.3), transparent),
            radial-gradient(1px 1px at 90% 15%, rgba(251,191,36,0.7), transparent),
            radial-gradient(1px 1px at 10% 80%, rgba(251,191,36,0.4), transparent);
        }
      `}</style>
    </>
  );
}
