import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from '@/routes/Dashboard';
import Guest from '@/routes/Guest';
import Admin from '@/routes/Admin';
import Scanner from '@/routes/Scanner';
import Login from '@/routes/Login';
import Planner from '@/routes/Planner';
import ForgotPassword from '@/routes/ForgotPassword';
import ResetPassword from '@/routes/ResetPassword';
import MagicEntry from '@/routes/MagicEntry';
import PendingApproval from '@/routes/PendingApproval';
import { useRealtimeSync } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function App() {
  useRealtimeSync();
  return (
    <Routes>
      <Route path="/" element={<Guest />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/planner"   element={<RequireAuth><Planner /></RequireAuth>} />
      <Route path="/admin"     element={<RequireRole role="super_admin"><Admin /></RequireRole>} />
      <Route path="/scanner"   element={<RequireAuth><Scanner /></RequireAuth>} />
      <Route path="/login"          element={<Login />} />
      <Route path="/forgot"         element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/m/:code"        element={<MagicEntry />} />
      <Route path="/dev"       element={<DevIndex />} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || (user && member.isLoading)) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (member.data && !member.data.approved) return <PendingApproval />;
  return <>{children}</>;
}

function RequireRole({ children, role }: { children: React.ReactNode; role: 'super_admin' | 'manager' }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || member.isLoading) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  const r = member.data?.role;
  const ok = role === 'super_admin' ? r === 'super_admin' : r === 'super_admin' || r === 'manager';
  if (!ok) return <NoAccess />;
  return <>{children}</>;
}

function Splash() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 text-forest-300/70">
      Lädt…
    </div>
  );
}

function NoAccess() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 p-8 text-center">
      <div className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50">
        <h1 className="text-xl font-semibold text-forest-100">Kein Zugriff</h1>
        <p className="mt-2 text-sm text-forest-300/80">
          Diese Seite ist nur für Admins. Wende dich an einen Super-Admin.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-forest-300 underline">Zurück zur Startseite</Link>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 p-8 text-center">
      <div className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 max-w-md">
        <h1 className="text-xl font-semibold text-forest-100">Backend nicht konfiguriert</h1>
        <p className="mt-2 text-sm text-forest-300/80">
          Setze <code className="text-forest-300">VITE_SUPABASE_URL</code> und{' '}
          <code className="text-forest-300">VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </p>
      </div>
    </div>
  );
}

function DevIndex() {
  const links = [
    ['/', 'Gäste-App'],
    ['/dashboard', 'TV-Dashboard'],
    ['/planner', 'Aufguss-Planung (Saunameister)'],
    ['/admin', 'Admin (Super-Admin)'],
    ['/scanner', 'Scanner'],
    ['/login', 'Login'],
  ] as const;
  return (
    <div className="bg-schwarzwald-soft min-h-full p-8 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4 text-forest-100">Saunafreunde — Dev Index</h1>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="text-forest-300 hover:text-forest-100 underline">
              {label} <span className="text-forest-500">({to})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
