import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';

// Sperrhinweis für Konten mit members.revoked_at (Admin → „Sperren").
// Der Server lehnt für gesperrte Konten jedes Schreiben ab und sperrt die
// Anmeldung (Migration 0192); diese Seite ersetzt die Oberfläche, damit
// niemand in einer App steht, in der nichts mehr funktioniert.
export default function KontoGesperrt() {
  const { signOut, user } = useAuth();
  const member = useCurrentMember();
  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-forest-950/80 p-6 ring-1 ring-rose-700/40 backdrop-blur space-y-3">
        <h1 className="text-2xl font-semibold text-forest-100">🔒 Konto gesperrt</h1>
        <p className="text-sm text-forest-200/85">
          Hallo {member.data?.name ?? user?.email}, dein Konto bei <em>Saunafreunde Schwarzwald</em> ist
          gesperrt. Du kannst die App im Moment nicht nutzen.
        </p>
        <p className="text-xs text-forest-300/70">
          Wenn du glaubst, dass das ein Versehen ist, wende dich bitte an den Vorstand.
        </p>
        <button
          onClick={() => signOut()}
          className="w-full rounded-lg bg-forest-900/80 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
