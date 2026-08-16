import { useWuenscheAnMich, useResolveWunsch } from '@/lib/api';
import { oelName } from '@/components/gast/DuftWunsch';
import { fmtClock } from '@/lib/time';

// Duft-Wünsche an die eigenen Aufgüsse (Migration 0133).
//
// Steht auf dem eigenen Star-Profil, direkt neben „Deine Fans" — zusammen
// ergibt das die eine Seite, auf der ein Aufgießer sein Publikum sieht.
//
// „Erfüllt" ist bewusst ein Knopf und kein Automatismus: nur der Aufgießer
// weiß, ob das Öl wirklich in den Kübel kommt. Und der Gast bekommt die
// Rückmeldung nur, wenn sie stimmt.
export function WuenscheAnMich() {
  const wuensche = useWuenscheAnMich();
  const antworten = useResolveWunsch();
  const alle = wuensche.data ?? [];
  const offene = alle.filter((w) => w.status === 'offen');

  if (wuensche.isLoading || alle.length === 0) return null;

  return (
    <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        🌿 Duft-Wünsche an dich{offene.length > 0 ? ` (${offene.length} offen)` : ''}
      </h3>
      <ul className="space-y-2">
        {alle.map((w) => (
          <li
            key={w.id}
            className={`rounded-xl px-3 py-2.5 ring-1 ${
              w.status === 'offen'
                ? 'bg-amber-950/20 ring-amber-500/30'
                : 'bg-forest-900/50 ring-forest-800/40 opacity-70'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-forest-100">
                  <strong>{oelName(w.oil_key)}</strong>
                  <span className="text-forest-400"> · von {w.gast_name}</span>
                </div>
                <div className="text-[11px] text-forest-400">
                  {fmtClock(w.infusion_start)} Uhr
                  {w.sauna_name ? ` · ${w.sauna_name}` : ''}
                  {w.infusion_title ? ` · ${w.infusion_title}` : ''}
                </div>
              </div>
              {w.status === 'offen' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => antworten.mutate({ wunschId: w.id, status: 'erfuellt' })}
                    disabled={antworten.isPending}
                    className="rounded-lg bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/35 disabled:opacity-50"
                  >
                    ✓ Nehm ich mit
                  </button>
                  <button
                    onClick={() => antworten.mutate({ wunschId: w.id, status: 'abgelehnt' })}
                    disabled={antworten.isPending}
                    className="rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-800 disabled:opacity-50"
                  >
                    Passt nicht
                  </button>
                </div>
              ) : (
                <span className={`text-[11px] font-semibold ${
                  w.status === 'erfuellt' ? 'text-emerald-300' : 'text-forest-500'
                }`}>
                  {w.status === 'erfuellt' ? '✓ erfüllt' : 'abgelehnt'}
                </span>
              )}
            </div>
            {w.notiz && (
              <div className="mt-1 text-xs text-forest-300/80 italic">„{w.notiz}"</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
