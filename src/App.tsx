import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from '@/routes/Dashboard';
import Guest from '@/routes/Guest';
import Admin from '@/routes/Admin';
import Scanner from '@/routes/Scanner';
import Login from '@/routes/Login';
import Planner from '@/routes/Planner';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Guest />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/planner" element={<Planner />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dev" element={<DevIndex />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DevIndex() {
  const links = [
    ['/', 'Gäste-App'],
    ['/dashboard', 'TV-Dashboard'],
    ['/planner', 'Aufguss-Planung (Saunameister)'],
    ['/admin', 'Admin'],
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
