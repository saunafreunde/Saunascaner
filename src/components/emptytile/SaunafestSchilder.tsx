import type { SaunafestTag } from '@/lib/api';
import { festRaster, hhmm, type FestStunde } from '@/lib/saunafestPlan';

/** Zwei Schilder zu den Saunafesten für die TV-Tafel (25.09.2026).
 *
 *  Ersetzen das Info-Karten-Video „Sechs Saunafeste" (public/tafel/
 *  saunafeste.mp4). Das Video hatte drei Schwächen: die Termine waren
 *  eingebrannt (nach jedem Fest musste eine neue Fassung hochgeladen werden),
 *  der Ablauf darin war veraltet („ab 14 Uhr … ab 17 Uhr", seit 0163 beginnt
 *  das Fest um 10:30), und jede Kachel mit Video ist ein Decoder mehr für den
 *  TV-Stick. Diese Schilder rechnen live aus saunafest_tage — dieselbe Quelle,
 *  aus der der Planer das Fest-Raster baut. Stimmt der Plan, stimmt das Schild.
 *
 *    „tag"     — So läuft ein Festtag: die große 31 und das Raster aller
 *                Aufgüsse von 10:30 bis 23:30, Stunde für Stunde, in denen
 *                erst eine, dann zwei, dann drei Saunen dran sind. Die Farbe
 *                wird zum Abend hin heißer. Am Festtag selbst läuft ein
 *                „jetzt"-Strich mit, Vergangenes wird leiser.
 *    „termine" — das nächste Fest groß mit Motto und Countdown, dahinter die
 *                weiteren Termine auf dem „Glutweg".
 *
 *  Beide erscheinen im Wechsel in freien Kacheln (SlotCarousel) und in der
 *  großen Einblendung (InfoEinblendung). Maße in cqh/cqw: dieselbe
 *  Komposition trägt die 920×301-Kachel, die schmalere Kachel am Festtag
 *  (drei Spalten) und die 78vw-Einblendung.
 *
 *  Tafel-Regeln: Endlos-Bewegung nur als CSS-Keyframes auf transform/opacity
 *  (Glut-Welle, wandernde Glut, atmender Schein), kein JS-Timer — `now` kommt
 *  aus dem Sekundentakt des Dashboards. Alles steht ab dem ersten Bild voll da;
 *  bewegt wird nur Licht. prefers-reduced-motion schaltet alles ab.
 */

export type SchildVariante = 'tag' | 'termine';

const MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const MONATE_3 = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

function lokalesDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tageBisFest(fest: SaunafestTag, jetzt: Date): number {
  const ziel = new Date(`${fest.datum}T00:00:00`);
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  return Math.round((ziel.getTime() - heute.getTime()) / 86_400_000);
}

function minutenVon(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Phase einer Stunde: 1 = eine Sauna im Wechsel, 2 = zwei, 3 = alle drei. */
const PHASE_FARBE: Record<1 | 2 | 3, { kern: string; rand: string; schein: string }> = {
  1: { kern: '#fde68a', rand: '#f59e0b', schein: 'rgba(251,191,36,0.55)' },
  2: { kern: '#fdba74', rand: '#f97316', schein: 'rgba(249,115,22,0.55)' },
  3: { kern: '#fca5a5', rand: '#ef4444', schein: 'rgba(239,68,68,0.55)' },
};

const CSS = `
.sf-schild {
  position: absolute; inset: 0; overflow: hidden; container-type: size;
  color: #f3f7f2; font-family: 'Inter', system-ui, sans-serif;
  font-feature-settings: 'tnum' 1, 'ss01' 1;
  background:
    radial-gradient(110% 150% at 0% 0%, rgba(251,146,60,0.20), transparent 55%),
    radial-gradient(80% 120% at 100% 100%, rgba(16,185,129,0.13), transparent 60%),
    linear-gradient(128deg, #08170f 0%, #0c2217 52%, #1b1109 100%);
}
.sf-schild::after {
  /* Glutlinie am unteren Rand — die gemeinsame Signatur beider Schilder. */
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.4cqh;
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 45%, #ef4444 100%);
  opacity: 0.85;
}
.sf-innen {
  position: absolute; inset: 0; box-sizing: border-box;
  padding: 9cqh 5cqw 8cqh 5.4cqw;
  display: grid; align-items: center; column-gap: 4cqw;
}
.sf-eyebrow {
  font-size: min(4.4cqh, 1.9cqw); font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: rgba(253,230,138,0.92);
}
.sf-leise { color: rgba(220,236,226,0.72); }

/* ── Schild „tag" ── */
.sf-tag .sf-innen { grid-template-columns: minmax(0, 30cqw) minmax(0, 1fr); }
.sf-zahlzeile { display: flex; align-items: center; gap: 1.6cqw; margin-top: 2.5cqh; position: relative; }
.sf-zahl-rahmen { position: relative; display: inline-block; }
.sf-zahl {
  position: relative; z-index: 1; display: inline-block; font-weight: 900; line-height: 0.82; letter-spacing: -0.045em;
  font-size: min(44cqh, 15cqw);
  background: linear-gradient(180deg, #fff7e0 0%, #fbbf24 55%, #f97316 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sf-zahl-schein {
  position: absolute; z-index: 0; left: -14%; top: -20%; width: 128%; height: 140%;
  background: radial-gradient(closest-side, rgba(249,115,22,0.42), transparent 72%);
  animation: sf-atmen 6s ease-in-out infinite; transform-origin: 50% 50%;
}
.sf-zahltext { font-size: min(7.6cqh, 3cqw); font-weight: 800; line-height: 1.04; }
.sf-spanne { margin-top: 3.2cqh; font-size: min(4.6cqh, 2cqw); font-weight: 600; line-height: 1.35; }
.sf-spanne b { color: #fde68a; font-weight: 800; }

.sf-raster { position: relative; display: grid; grid-template-rows: minmax(0, 1fr) auto auto auto auto; height: 100%; min-height: 0; }
.sf-phasen, .sf-saeulen, .sf-achse, .sf-zeiten { display: grid; grid-template-columns: repeat(var(--sf-n), minmax(0, 1fr)); }
.sf-phase {
  font-size: min(3.7cqh, 1.55cqw); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0 0.5cqw 0.2cqh; margin-bottom: 1.6cqh; align-self: end; overflow: hidden;
  border-left: 0.25cqw solid currentColor; line-height: 1.1;
}
.sf-saeulen { align-items: end; min-height: 0; }
.sf-saeule { display: flex; flex-direction: column-reverse; align-items: center; gap: min(2.2cqh, 0.8cqw); padding-bottom: 1.6cqh; }
.sf-punkt {
  width: min(9.4cqh, 3.1cqw); aspect-ratio: 1; border-radius: 999px;
  animation: sf-punkt-ein 520ms cubic-bezier(0.2, 0.9, 0.3, 1.35) both;
  transform-origin: 50% 50%;
}
.sf-achse { height: 0.5cqh; background: linear-gradient(90deg, rgba(253,230,138,0.55), rgba(239,68,68,0.55)); border-radius: 999px; }
.sf-zeiten { margin-top: 1.5cqh; }
.sf-zeit { font-size: min(4.2cqh, 1.7cqw); font-weight: 700; text-align: center; white-space: nowrap; }
.sf-zeit.sf-rand { color: #fde68a; font-weight: 900; }
.sf-welle {
  position: absolute; top: 0; bottom: 0; left: 0; width: 100%; pointer-events: none;
  background: radial-gradient(ellipse 9% 48% at 50% 62%, rgba(255,214,130,0.24), rgba(255,214,130,0.08) 55%, transparent 100%);
  animation: sf-welle 9s ease-in-out infinite; transform-origin: 50% 50%;
}
.sf-jetzt { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.3cqw solid #f3f7f2; opacity: 0.9; }
.sf-jetzt span {
  position: absolute; top: -0.4cqh; left: 0.6cqw; font-size: min(3.4cqh, 1.4cqw); font-weight: 800;
  letter-spacing: 0.14em; text-transform: uppercase; background: #f3f7f2; color: #0c2217;
  padding: 0.2cqh 0.7cqw; border-radius: 999px;
}

/* ── Schild „termine" ── */
.sf-termine .sf-innen { grid-template-columns: minmax(0, 40cqw) minmax(0, 1fr); }
.sf-datum { margin-top: 2.2cqh; font-size: min(25cqh, 9cqw); font-weight: 900; line-height: 0.95; letter-spacing: -0.03em; }
.sf-motto { margin-top: 1.8cqh; font-size: min(9.6cqh, 3.6cqw); font-weight: 700; color: #fcd34d; line-height: 1.1; }
.sf-pille {
  display: inline-flex; align-items: center; gap: 0.8cqw; margin-top: 3.4cqh;
  font-size: min(4.6cqh, 1.9cqw); font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 1.1cqh 1.6cqw; border-radius: 999px; color: #1b1109;
  background: linear-gradient(90deg, #fde68a, #fb923c);
}
.sf-pille i { width: 1.2cqw; aspect-ratio: 1; border-radius: 999px; background: #1b1109; animation: sf-atmen 2.6s ease-in-out infinite; }
.sf-weg { position: relative; display: flex; flex-direction: column; justify-content: center; height: 100%; min-height: 0; }
.sf-weg-kopf { font-size: min(4.2cqh, 1.7cqw); font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
.sf-stationen { position: relative; display: grid; grid-template-columns: repeat(var(--sf-n), minmax(0, 1fr)); margin-top: 3cqh; }
.sf-linie { position: absolute; left: 0; right: 0; top: 6.675cqh; height: 0.45cqh; border-radius: 999px;
  background: linear-gradient(90deg, rgba(253,230,138,0.5), rgba(249,115,22,0.5)); }
.sf-glut {
  position: absolute; top: 4.4cqh; left: 0; width: 100%; height: 5cqh; pointer-events: none;
  animation: sf-wandern 14s linear infinite; transform-origin: 0 50%;
}
.sf-glut::before {
  content: ''; position: absolute; left: 0; top: 0; height: 100%; aspect-ratio: 1; border-radius: 999px;
  background: radial-gradient(closest-side, #fff7e0, rgba(251,191,36,0.9) 35%, rgba(249,115,22,0) 100%);
  transform: translateX(-50%);
}
.sf-station { display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 0; padding: 0 0.4cqw; }
.sf-station-wt { height: 4.4cqh; line-height: 4.4cqh; font-size: min(3.4cqh, 1.4cqw); font-weight: 700; letter-spacing: 0.16em; }
.sf-station-knopfzeile { height: 5cqh; display: flex; align-items: center; justify-content: center; margin-bottom: 1.4cqh; }
.sf-station-knopf { width: min(3.4cqh, 1.4cqw); aspect-ratio: 1; border-radius: 999px;
  background: #0c2217; box-shadow: 0 0 0 0.4cqh #fbbf24; position: relative; z-index: 1; }
.sf-station-tag { font-size: min(13cqh, 4.6cqw); font-weight: 900; line-height: 1; letter-spacing: -0.02em; }
.sf-station-mon { font-size: min(3.6cqh, 1.5cqw); font-weight: 800; letter-spacing: 0.16em; margin-top: 0.6cqh; }
.sf-station-motto { font-size: min(4.4cqh, 1.7cqw); font-weight: 600; color: #fcd34d; margin-top: 1cqh; line-height: 1.15;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sf-fuss { margin-top: 4.2cqh; font-size: min(5.4cqh, 2.2cqw); font-weight: 600; }
.sf-fuss b { color: #fde68a; font-weight: 800; }

@container (max-aspect-ratio: 5/2) {
  .sf-station-motto { display: none; }
  .sf-station { padding: 0; }
}

@keyframes sf-punkt-ein { from { opacity: 0; transform: scale(0.35); } to { opacity: 1; transform: scale(1); } }
@keyframes sf-welle { 0% { transform: translateX(-62%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateX(62%); opacity: 0; } }
@keyframes sf-atmen { 0%, 100% { opacity: 0.55; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.04); } }
@keyframes sf-wandern { 0% { transform: translateX(0); opacity: 0; } 8% { opacity: 1; } 92% { opacity: 1; } 100% { transform: translateX(100%); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .sf-punkt, .sf-welle, .sf-zahl-schein, .sf-pille i, .sf-glut { animation: none; }
  .sf-welle, .sf-glut { display: none; }
}
`;

function Stil() {
  return <style>{CSS}</style>;
}

// ─── „tag": So läuft ein Festtag ─────────────────────────────────────────
function FestTagSchild({ fest, now }: { fest: SaunafestTag; now: Date }) {
  const raster = festRaster(fest);
  const gesamt = raster.reduce((s, r) => s + r.anzahl, 0);
  const n = raster.length;
  const erster = hhmm(fest.erster_slot);
  const letzter = hhmm(fest.letzter_slot);
  const heute = fest.datum === lokalesDatum(now);

  // Phasen als zusammenhängende Abschnitte (für die Beschriftung oben).
  const phasen: { anzahl: 1 | 2 | 3; von: number; laenge: number }[] = [];
  raster.forEach((r, i) => {
    const letzte = phasen[phasen.length - 1];
    if (letzte && letzte.anzahl === r.anzahl) letzte.laenge += 1;
    else phasen.push({ anzahl: r.anzahl, von: i, laenge: 1 });
  });
  const phasenText = (p: { anzahl: 1 | 2 | 3; von: number; laenge: number }) =>
    p.anzahl === 1 ? (p.laenge >= 3 ? '1 Sauna im Wechsel' : '1 Sauna')
      : p.anzahl === 2 ? '2 Saunen' : 'alle 3 Saunen';

  // Beschriftete Uhrzeiten: Anfang, jeder Phasenwechsel, Ende.
  const beschriftet = new Set<number>([0, n - 1, ...phasen.map((p) => p.von)]);

  // Am Festtag: „jetzt"-Strich in Spaltenbreiten ab dem ersten Aufguss.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = minutenVon(fest.erster_slot);
  const spalte = (nowMin - start) / 60; // 0 = Beginn der ersten Spalte (Aufgussbeginn)
  const zeigeJetzt = heute && spalte >= 0 && spalte < n;
  const vorbei = (i: number) => heute && nowMin >= start + i * 60 + 20; // Fest-Aufguss dauert 20 min

  let punktNr = 0;
  return (
    <div className="sf-schild sf-tag">
      <Stil />
      <div className="sf-innen">
        <div className="min-w-0">
          <div className="sf-eyebrow">{heute ? 'Heute Saunafest' : 'Ein Saunafest-Tag'}</div>
          <div className="sf-zahlzeile">
            <span className="sf-zahl-rahmen">
              <span className="sf-zahl-schein" aria-hidden />
              <span className="sf-zahl">{gesamt}</span>
            </span>
            <span className="sf-zahltext">Aufgüsse<br />an einem<br />Tag</span>
          </div>
          <div className="sf-spanne sf-leise">
            <b>{erster}</b> erster Aufguss<br />
            <b>{letzter}</b> letzter Aufguss
          </div>
        </div>

        <div className="sf-raster" style={{ ['--sf-n' as string]: n }}>
          <div aria-hidden />
          <div className="sf-phasen">
            {phasen.map((p) => (
              <div
                key={p.von}
                className="sf-phase"
                style={{ gridColumn: `${p.von + 1} / span ${p.laenge}`, color: PHASE_FARBE[p.anzahl].rand }}
              >
                {phasenText(p)}
              </div>
            ))}
          </div>

          <div className="sf-saeulen">
            {raster.map((r: FestStunde, i) => {
              const f = PHASE_FARBE[r.anzahl];
              const leise = vorbei(i);
              return (
                <div key={r.zeit} className="sf-saeule" style={leise ? { opacity: 0.3 } : undefined}>
                  {Array.from({ length: r.anzahl }, (_, k) => {
                    const nr = punktNr++;
                    return (
                      <span
                        key={k}
                        className="sf-punkt"
                        style={{
                          animationDelay: `${120 + nr * 38}ms`,
                          background: `radial-gradient(circle at 38% 34%, #fffaf0 0%, ${f.kern} 32%, ${f.rand} 100%)`,
                          boxShadow: `0 0 min(3cqh, 1.1cqw) ${f.schein}`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="sf-achse" />
          <div className="sf-zeiten">
            {raster.map((r, i) => (
              <div key={r.zeit} className={`sf-zeit ${i === 0 || i === n - 1 ? 'sf-rand' : 'sf-leise'}`}>
                {beschriftet.has(i) ? r.zeit : ''}
              </div>
            ))}
          </div>

          <div className="sf-welle" aria-hidden />
          {zeigeJetzt && (
            <div className="sf-jetzt" style={{ left: `${((spalte + 0.5) / n) * 100}%` }}>
              <span>jetzt</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── „termine": nächstes Fest + Glutweg ──────────────────────────────────
function TermineSchild({ fest, alle, now }: { fest: SaunafestTag; alle: SaunafestTag[]; now: Date }) {
  const d = new Date(`${fest.datum}T12:00:00`);
  const tage = tageBisFest(fest, now);
  const weitere = alle.filter((f) => f.datum > fest.datum).slice(0, 5);
  const raster = festRaster(fest);
  const gesamt = raster.reduce((s, r) => s + r.anzahl, 0);
  const erster = hhmm(fest.erster_slot);
  const letzter = hhmm(fest.letzter_slot);

  const pille = tage <= 0 ? `Heute · ${erster}–${letzter}`
    : tage === 1 ? 'Morgen'
      : `noch ${tage} Tage`;

  return (
    <div className="sf-schild sf-termine">
      <Stil />
      <div className="sf-innen">
        <div className="min-w-0">
          <div className="sf-eyebrow">{tage <= 0 ? 'Heute ist Saunafest' : 'Nächstes Saunafest · Samstag'}</div>
          <div className="sf-datum">{d.getDate()}. {MONATE_KURZ[d.getMonth()]}</div>
          <div className="sf-motto">„{fest.motto}“</div>
          <div className="sf-pille"><i aria-hidden />{pille}</div>
        </div>

        <div className="sf-weg">
          {weitere.length > 0 ? (
            <>
              <div className="sf-weg-kopf sf-leise">Danach · jeweils 2. Samstag</div>
              <div className="sf-stationen" style={{ ['--sf-n' as string]: weitere.length }}>
                <div className="sf-linie" aria-hidden />
                <div className="sf-glut" aria-hidden />
                {weitere.map((f) => {
                  const fd = new Date(`${f.datum}T12:00:00`);
                  return (
                    <div key={f.datum} className="sf-station">
                      <span className="sf-station-wt sf-leise">SA</span>
                      <span className="sf-station-knopfzeile" aria-hidden><span className="sf-station-knopf" /></span>
                      <span className="sf-station-tag">{fd.getDate()}</span>
                      <span className="sf-station-mon sf-leise">
                        {MONATE_3[fd.getMonth()]}{fd.getFullYear() !== d.getFullYear() ? ` ${String(fd.getFullYear()).slice(2)}` : ''}
                      </span>
                      <span className="sf-station-motto">{f.motto}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="sf-weg-kopf sf-leise">Letztes Fest der Saison</div>
          )}
          <div className="sf-fuss sf-leise">
            <b>{gesamt} Aufgüsse</b> von <b>{erster}</b> bis <b>{letzter}</b> Uhr
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ein Saunafest-Schild. `fest` = das nächste Fest (heute zählt mit),
 *  `alle` = alle Festtage sortiert (useSaunafestTage). */
export function SaunafestSchild({ variante, fest, alle, now }: {
  variante: SchildVariante;
  fest: SaunafestTag;
  alle: SaunafestTag[];
  now: Date;
}) {
  return variante === 'tag'
    ? <FestTagSchild fest={fest} now={now} />
    : <TermineSchild fest={fest} alle={alle} now={now} />;
}
