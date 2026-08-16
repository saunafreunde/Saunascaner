import { useOrgNews } from '@/lib/api';

// Vereins-News im Gast-Bereich. Bis 0132 lagen die hinter der Rolle 'fan' —
// die gibt es nicht mehr, und die Tabelle war ohnehin leer. Was der Vorstand
// hier einstellt, sehen jetzt alle mit einem freigegebenen Zugang; Beiträge
// mit target_min_role='member' filtert die RLS weiterhin heraus.
export function VereinsNews() {
  const news = useOrgNews();
  const eintraege = news.data ?? [];

  // Ohne Inhalte gar nichts zeigen — eine dauerhaft leere Karte im
  // Gast-Bereich sieht nach kaputt aus, nicht nach „noch nichts da".
  if (news.isLoading || eintraege.length === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        📣 Aus dem Verein
      </h2>
      <ul className="space-y-3">
        {eintraege.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl p-4 ring-1 ${
              n.pinned
                ? 'bg-amber-950/30 ring-amber-500/40'
                : 'bg-forest-900/60 ring-forest-800/40'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold text-forest-100">
                {n.pinned && '📌 '}{n.title}
              </h3>
              <time className="text-[10px] text-forest-400 whitespace-nowrap">
                {new Date(n.published_at).toLocaleDateString('de-DE', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                })}
              </time>
            </div>
            <p className="text-xs text-forest-200/90 whitespace-pre-line leading-relaxed">
              {n.body}
            </p>
            {n.created_by_name && (
              <p className="text-[10px] text-forest-500 mt-2">— {n.created_by_name}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
