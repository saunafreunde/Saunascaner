import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';

export default function PendingApproval() {
  const { signOut, user } = useAuth();
  const member = useCurrentMember();
  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-forest-950/80 p-6 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
        <h1 className="text-2xl font-semibold text-forest-100">⏳ Konto wartet auf Freigabe</h1>
        <p className="text-sm text-forest-200/85">
          Hallo {member.data?.name ?? user?.email}, dein Konto wurde angelegt aber noch nicht freigegeben.
          Ein Admin von <em>Saunafreunde Schwarzwald</em> muss dich noch bestätigen.
        </p>
        <p className="text-xs text-forest-300/70">
          Du wirst automatisch reingelassen, sobald die Freigabe erfolgt ist — einfach diese Seite refreshen.
        </p>
        <button onClick={() => signOut()} className="w-full rounded-lg bg-forest-900/80 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
          Abmelden
        </button>
      </div>
    </div>
  );
}
