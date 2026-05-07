import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from '@/routes/Dashboard';
import Guest from '@/routes/Guest';
import Admin from '@/routes/Admin';
import Scanner from '@/routes/Scanner';
import Login from '@/routes/Login';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Guest />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/scanner" element={<Scanner />} />
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
    ['/admin', 'Admin'],
    ['/scanner', 'Scanner'],
    ['/login', 'Login'],
  ] as const;
  return (
    <div className="min-h-full p-8">
      <h1 className="text-2xl font-semibold mb-4">Saunafreunde — Dev Index</h1>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="text-heat-400 hover:text-heat-500 underline">
              {label} <span className="text-slate-500">({to})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
