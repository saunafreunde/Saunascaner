import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Rückweg aus einem Sackgassen-Bildschirm (16.08.2026).
//
// Manche Seiten haben weder Kopfzeile noch Zurück-Knopf — der Leer-Zustand von
// /bewerten („Alles bewertet — danke!") war so eine: gelesen, verstanden, und
// dann steht man da. Statt einen weiteren Knopf danebenzustellen, zieht hier
// zwei Sekunden lang Wasserdampf über das Bild, und danach ist man wieder in
// seinem Bereich.
//
// Der Dampf ist nicht Dekoration, sondern die Fortschrittsanzeige: er sagt
// „gleich passiert etwas", bevor es passiert. Ein Sprung ohne Vorwarnung
// fühlt sich wie ein Absturz an.
export function DampfRueckkehr({
  ziel,
  verzoegerungMs = 2000,
}: { ziel: string; verzoegerungMs?: number }) {
  const nav = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => {
      // replace: sonst wirft der Zurück-Knopf einen sofort wieder in die
      // Sackgasse, aus der wir gerade herausgeholt haben.
      nav(ziel, { replace: true });
    }, verzoegerungMs);
    return () => window.clearTimeout(t);
  }, [nav, ziel, verzoegerungMs]);

  return (
    <>
      {/* Für Screenreader: die Bewegung allein erklärt nichts. */}
      <p className="sr-only" role="status">
        Du wirst gleich zurück in deinen Bereich gebracht.
      </p>
      <div className="dampf-buehne" aria-hidden="true">
        <div className="dampf-schleier" />
        {/* Vier Schwaden mit unterschiedlichem Start und Tempo — gleichmäßig
            wirkt wie Nebelmaschine, ungleichmäßig wie Aufguss. */}
        <span className="dampf-schwade" style={{ left: '-18%', bottom: '-24%', animationDelay: '0ms', animationDuration: '2000ms' }} />
        <span className="dampf-schwade" style={{ left: '18%', bottom: '-32%', animationDelay: '160ms', animationDuration: '1840ms' }} />
        <span className="dampf-schwade" style={{ left: '48%', bottom: '-20%', animationDelay: '80ms', animationDuration: '1920ms' }} />
        <span className="dampf-schwade" style={{ left: '72%', bottom: '-30%', animationDelay: '240ms', animationDuration: '1760ms' }} />
      </div>
    </>
  );
}
