import { useMemo } from 'react';
import type { Infusion, Sauna } from '@/types/database';
import type { OelraumSettings } from '@/types/branding';
import { AusschnittBild } from '@/components/AusschnittBild';
import { zutatenStatus, type ZutatenStatus } from '@/lib/aufgussRegeln';
import {
  zutatenFuer, besonderheitenFuer, sammelListe,
  type RegalKatalog, type RegalEintrag, type SammelEintrag,
} from '@/lib/oelraumZutaten';
import { HaltenKnopf } from '@/components/oelraum/HaltenKnopf';

/** Die Wand-Anzeige im Öl-Raum — das „Head-Pad" (Vorgabe 14.08.2026).
 *
 *  Sie beantwortet genau eine Frage: WELCHER Aufguss braucht WELCHE Öle?
 *  Deshalb trägt jede Sauna-Karte ihre eigenen Öle mit großer Regalnummer —
 *  damit am Regal niemand die falsche Flasche für die falsche Sauna greift.
 *  Nur wenn zwei oder drei Saunen ZUR SELBEN ZEIT starten, kommt darunter
 *  der Sammel-Lauf dazu: jede Zutat einmal, mit Sauna-Zuordnung, für den
 *  einen Gang ans Regal.
 *
 *  Bewegung: ausschließlich Pure-CSS, keine JS-Timer. Das Gerät läuft im
 *  Dauerbetrieb; der einzige Takt kommt von `now` (siehe OilRoom.tsx).
 */

export interface AnzeigeAufguss {
  inf: Infusion;
  sauna: Sauna | undefined;
  meister: string;
  meisterDa: boolean;
  zutaten: RegalEintrag[];
  besonderheiten: ReturnType<typeof besonderheitenFuer>;
  status: ZutatenStatus;
  /** Minuten bis Start. Negativ = läuft bereits. */
  minuten: number;
}

function minutenText(m: number): string {
  if (m < 0) return `läuft seit ${Math.abs(m)} Min`;
  if (m === 0) return 'jetzt';
  if (m < 60) return `in ${m} Min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `in ${h} Std` : `in ${h}:${String(rest).padStart(2, '0')} Std`;
}

function uhr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function OelraumAnzeige({
  now, infusions, saunas, katalog, nameFuer, anwesend, einstellungen,
  logoUrl, hintergrundUrl, onEintragen, fusszeile,
}: {
  now: Date;
  infusions: readonly Infusion[];
  saunas: readonly Sauna[];
  katalog: RegalKatalog;
  nameFuer: (memberId: string | null) => string;
  anwesend: ReadonlySet<string>;
  einstellungen: OelraumSettings;
  logoUrl: string | null;
  hintergrundUrl: string | null;
  onEintragen: (vorgabe?: { saunaId: string; startTime: string }) => void;
  fusszeile?: React.ReactNode;
}) {
  const { laufend, naechste, danach } = useMemo(() => {
    const jetzt = now.getTime();
    const horizont = jetzt + einstellungen.vorlauf_stunden * 3_600_000;

    const bauen = (i: Infusion): AnzeigeAufguss => {
      const start = Date.parse(i.start_time);
      return {
        inf: i,
        sauna: saunas.find((s) => s.id === i.sauna_id),
        meister: nameFuer(i.saunameister_id),
        meisterDa: !!i.saunameister_id && anwesend.has(i.saunameister_id),
        zutaten: zutatenFuer(i, katalog),
        besonderheiten: besonderheitenFuer(i, katalog),
        status: zutatenStatus(i.attributes, i.oils),
        minuten: Math.round((start - jetzt) / 60_000),
      };
    };

    // Personal-Fallbacks sind Platzhalter, die der nächtliche Cron acht Wochen
    // im Voraus anlegt — sie haben grundsätzlich keine Zutaten. Wer sie hier
    // mitzählt, baut ein Tablet, das rund um die Uhr etwas anmahnt, das
    // niemand eintragen kann. Sie fliegen deshalb komplett raus.
    const echt = infusions.filter((i) => !i.is_personal_fallback && i.saunameister_id);

    const laufendeListe = echt
      .filter((i) => Date.parse(i.start_time) <= jetzt && Date.parse(i.end_time) > jetzt)
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
      .map(bauen);

    const kommend = echt
      .filter((i) => Date.parse(i.start_time) > jetzt && Date.parse(i.start_time) <= horizont)
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

    // „Egal ob 2 oder 3 Saunen gleichzeitig aufgießen": die nächste Gruppe ist
    // alles, was zur selben Zeit startet — nicht der eine nächste Aufguss.
    const ersteZeit = kommend.length ? Date.parse(kommend[0].start_time) : null;
    const gruppe = ersteZeit === null
      ? []
      : kommend.filter((i) => Date.parse(i.start_time) === ersteZeit).map(bauen);
    const rest = ersteZeit === null
      ? []
      : kommend.filter((i) => Date.parse(i.start_time) !== ersteZeit).map(bauen);

    return { laufend: laufendeListe, naechste: gruppe, danach: rest };
  }, [now, infusions, saunas, katalog, nameFuer, anwesend, einstellungen.vorlauf_stunden]);

  const hintergrund = hintergrundUrl ? (
    <div className="absolute inset-0 -z-10">
      <AusschnittBild url={hintergrundUrl} ausschnitt={einstellungen.ausschnitt} />
      <div className="absolute inset-0 bg-slate-950/72" />
    </div>
  ) : null;

  // ─── Ruhe: nichts steht an ────────────────────────────────────────────────
  // „In der Zeit, wo keine Aufgüsse stattfinden, soll nur das Logo erscheinen."
  // Wörtlich genommen: kein Countdown, kein Hinweis, keine Kachel. Das Logo
  // selbst ist der Weg in die Eingabe — so bleibt der Bildschirm leer und
  // trotzdem bedienbar.
  if (laufend.length === 0 && naechste.length === 0) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
        {hintergrund}
        <HaltenKnopf
          onFertig={() => onEintragen()}
          titel="Gedrückt halten, um einen Aufguss einzutragen"
          className="rounded-3xl p-8"
          ringFarbe="rgba(148,163,184,0.14)"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              draggable={false}
              className="oel-ruhe max-h-[46vh] max-w-[70vw] object-contain"
            />
          ) : (
            <span className="oel-ruhe text-[clamp(2rem,7vw,4.5rem)] font-black tracking-[0.2em] text-forest-200/70">
              SAUNAFREUNDE
            </span>
          )}
        </HaltenKnopf>
        {fusszeile}
      </div>
    );
  }

  // ─── Vorbereitung ─────────────────────────────────────────────────────────
  const gruppe = naechste.length > 0 ? naechste : laufend;
  const istLaufend = naechste.length === 0;
  const kopfZeit = gruppe[0] ? uhr(gruppe[0].inf.start_time) : '';
  const kopfMinuten = gruppe[0]?.minuten ?? 0;

  // Was fehlt — über den ganzen Horizont, nicht nur die nächste Gruppe: wer um
  // 15:00 aufgießt, kann für 17:00 gleich mit eintragen, solange er ohnehin
  // hier steht.
  const fehlend = [...gruppe, ...danach].filter((a) => a.status !== 'vollstaendig');
  const dringend = fehlend.some((a) => a.minuten <= einstellungen.mahnung_ab_minuten);

  const griff = sammelListe(gruppe.map((a) => a.zutaten));

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {hintergrund}

      {/* Kopfzeile */}
      <header className="flex items-baseline justify-between gap-4 px-[3vw] pt-[2.5vh] pb-[1.5vh]">
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="text-[clamp(0.7rem,1.5vw,1rem)] font-semibold uppercase tracking-[0.22em] text-forest-400/80">
            {istLaufend ? 'Läuft gerade' : 'Als Nächstes'}
          </span>
          <span className="text-[clamp(2.2rem,6vw,4.5rem)] font-black leading-none tabular-nums text-forest-100">
            {kopfZeit}
          </span>
        </div>
        <span className={`text-[clamp(0.95rem,2.4vw,1.9rem)] font-bold tabular-nums whitespace-nowrap ${
          kopfMinuten <= 15 && kopfMinuten >= 0 ? 'text-amber-300' : 'text-forest-300/80'
        }`}>
          {minutenText(kopfMinuten)}
        </span>
      </header>

      {/* Forderung — nimmt sich so viel Platz, wie übrig ist. Steht nichts
          anderes an, füllt sie den Bildschirm; sonst bleibt sie ein Band. */}
      {fehlend.length > 0 && (
        <MahnBand
          fehlend={fehlend}
          dringend={dringend}
          alleinig={griff.length === 0}
          onEintragen={onEintragen}
        />
      )}

      {/* Die Saunen der aktuellen Gruppe — jede Karte trägt IHRE Öle */}
      {gruppe.length > 0 && (
        <div
          className={`grid gap-[1.2vw] px-[3vw] ${gruppe.length > 1 ? '' : 'flex-1 min-h-0 content-start'}`}
          style={{ gridTemplateColumns: `repeat(${Math.min(gruppe.length, 3)}, minmax(0, 1fr))` }}
        >
          {gruppe.map((a) => <SaunaKarte key={a.inf.id} a={a} />)}
        </div>
      )}

      {/* Der Sammel-Lauf — NUR bei gleichzeitigen Saunen. Welche Öle zu
          welchem Aufguss gehören, steht auf den Karten; hier steht, was man
          beim einen Gang ans Regal zusammen mitnimmt. */}
      {gruppe.length > 1 && griff.length > 0 && (
        <section className="mt-[2vh] flex-1 min-h-0 px-[3vw] pb-[1vh]">
          <h2 className="mb-[1.2vh] text-[clamp(0.7rem,1.5vw,1rem)] font-semibold uppercase tracking-[0.22em] text-amber-400/80">
            Einmal ans Regal
            <span className="ml-2 normal-case tracking-normal text-forest-400/70">
              — alles für {gruppe.length} Saunen in einem Gang
            </span>
          </h2>
          <div className="flex flex-wrap gap-[1vw]">
            {griff.map((z) => (
              <Etikett key={z.key} z={z} gruppe={gruppe} />
            ))}
          </div>
        </section>
      )}

      {/* Was danach kommt */}
      {danach.length > 0 && (
        <div className="border-t border-forest-900/60 px-[3vw] py-[1.2vh] flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="text-[clamp(0.6rem,1.2vw,0.8rem)] font-semibold uppercase tracking-[0.2em] text-forest-500/80">
            Danach
          </span>
          {danach.map((a) => (
            <span key={a.inf.id} className="text-[clamp(0.75rem,1.5vw,1.05rem)] text-forest-300/85 tabular-nums">
              {uhr(a.inf.start_time)} <span className="text-forest-400/70">{a.sauna?.name ?? ''}</span>
              {/* Auch hier schon die Öle zeigen — wer früh ans Regal geht,
                  greift sonst nach Gedächtnis. */}
              {a.zutaten.slice(0, 4).map((z) => (
                <span key={z.key} className="ml-1 font-semibold" style={{ color: z.farbe }}>
                  {z.nummer !== null ? `#${z.nummer}` : z.emoji}
                </span>
              ))}
              {a.status !== 'vollstaendig' && (
                <span className="ml-1 font-semibold text-rose-400">· Öle fehlen</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Eintragen + Fußzeile */}
      <div className="flex items-center justify-between gap-4 px-[3vw] pb-[2vh] pt-[1vh]">
        <HaltenKnopf
          onFertig={() => onEintragen()}
          titel="Gedrückt halten"
          ringFarbe="rgba(34,197,94,0.45)"
          className="rounded-2xl bg-forest-800/70 px-[2.5vw] py-[1.6vh] text-[clamp(0.85rem,1.8vw,1.2rem)] font-bold text-forest-50 ring-1 ring-forest-600/50"
        >
          🧴 Aufguss eintragen
          <span className="text-[0.7em] font-normal text-forest-300/70">— halten</span>
        </HaltenKnopf>
        {fusszeile}
      </div>
    </div>
  );
}

// ─── Bausteine ────────────────────────────────────────────────────────────────

function MahnBand({
  fehlend, dringend, alleinig, onEintragen,
}: {
  fehlend: AnzeigeAufguss[];
  dringend: boolean;
  alleinig: boolean;
  onEintragen: (vorgabe?: { saunaId: string; startTime: string }) => void;
}) {
  return (
    <section
      className={`mx-[3vw] mb-[1.5vh] rounded-2xl px-[2vw] py-[1.8vh] ring-2 ${
        dringend
          ? 'oel-mahnung bg-rose-950/70 ring-rose-500/70'
          : 'bg-amber-950/45 ring-amber-600/45'
      } ${alleinig ? 'flex-1 flex flex-col justify-center' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-[clamp(1.4rem,3.5vw,2.6rem)] leading-none">
          {dringend ? '⚠️' : '📝'}
        </span>
        <h2 className={`text-[clamp(1rem,2.6vw,2rem)] font-black leading-tight ${
          dringend ? 'text-rose-100' : 'text-amber-100'
        }`}>
          {fehlend.length === 1 ? 'Ein Aufguss hat noch keine Öle' : `${fehlend.length} Aufgüsse haben noch keine Öle`}
        </h2>
      </div>

      <p className={`mt-1 text-[clamp(0.72rem,1.5vw,1rem)] ${dringend ? 'text-rose-200/85' : 'text-amber-200/80'}`}>
        Ohne Öl-Eintrag weiß am Regal niemand, was gebraucht wird — und der
        Verbrauch lässt sich nicht auswerten. Bitte jetzt nachtragen.
      </p>

      <div className={`mt-[1.4vh] grid gap-[0.8vw] ${alleinig ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {fehlend.slice(0, 6).map((a) => (
          <HaltenKnopf
            key={a.inf.id}
            onFertig={() => onEintragen({ saunaId: a.inf.sauna_id, startTime: a.inf.start_time })}
            titel="Gedrückt halten, um für diesen Slot einzutragen"
            ringFarbe={dringend ? 'rgba(244,63,94,0.4)' : 'rgba(245,158,11,0.35)'}
            className={`rounded-xl px-4 py-[1.3vh] text-left ring-1 ${
              dringend ? 'bg-rose-900/50 ring-rose-500/50' : 'bg-amber-900/35 ring-amber-600/40'
            }`}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[clamp(0.9rem,2vw,1.4rem)] font-bold tabular-nums text-slate-50">
                  {uhr(a.inf.start_time)} · {a.sauna?.name ?? '—'}
                </span>
                <span className="block truncate text-[clamp(0.68rem,1.3vw,0.9rem)] text-slate-300/85">
                  {a.meister}
                  {a.status === 'nur_besonderheiten' && ' — Besonderheiten da, Öle fehlen'}
                </span>
              </span>
              <span aria-hidden className="text-[clamp(0.9rem,2vw,1.4rem)] opacity-70">→</span>
            </span>
          </HaltenKnopf>
        ))}
      </div>
    </section>
  );
}

function SaunaKarte({ a }: { a: AnzeigeAufguss }) {
  const akzent = a.sauna?.accent_color ?? '#22c55e';
  return (
    <article
      className="rounded-2xl bg-slate-900/55 px-[1.4vw] py-[1.6vh] ring-1 ring-forest-900/70 backdrop-blur-[2px]"
      style={{ borderLeft: `4px solid ${akzent}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[clamp(1rem,2.4vw,1.8rem)] font-black leading-tight" style={{ color: akzent }}>
          {a.sauna?.name ?? 'Sauna'}
        </h3>
        <span className="shrink-0 text-[clamp(0.65rem,1.3vw,0.95rem)] font-semibold tabular-nums text-forest-300/75">
          {a.sauna?.temperature_label ?? ''}
        </span>
      </div>

      <p className="mt-0.5 flex items-center gap-1.5 text-[clamp(0.75rem,1.6vw,1.15rem)] font-semibold text-forest-100">
        {/* Anwesenheit sichtbar machen: wer hier einträgt, wird automatisch
            eingecheckt — dann muss man auch sehen können, dass es passiert ist. */}
        <span
          aria-hidden
          title={a.meisterDa ? 'ist eingecheckt' : 'noch nicht eingecheckt'}
          className={a.meisterDa ? 'text-emerald-400' : 'text-forest-600'}
        >
          {a.meisterDa ? '●' : '○'}
        </span>
        <span className="truncate">{a.meister}</span>
      </p>

      <p className="mt-1 truncate text-[clamp(0.7rem,1.5vw,1.05rem)] italic text-forest-300/80">
        {a.inf.title}
      </p>

      {/* Die Öle DIESES Aufgusses — das Kernstück der Karte (Vorgabe
          14.08.2026): jeder sieht, welcher Aufguss welche Öle hat, damit am
          Regal nicht die falschen gegriffen werden. */}
      {a.zutaten.length > 0 ? (
        <ul className="mt-[1vh] space-y-[0.6vh]">
          {a.zutaten.map((z) => (
            <li key={z.key} className="flex items-center gap-2">
              <span
                className="grid h-[clamp(1.9rem,5vh,3.2rem)] w-[clamp(1.9rem,5vh,3.2rem)] shrink-0 place-items-center rounded-lg text-[clamp(1rem,2.7vh,1.8rem)] font-black tabular-nums leading-none"
                style={{
                  background: `${z.farbe}22`,
                  color: z.nummer !== null ? z.farbe : undefined,
                  boxShadow: `inset 0 0 0 2px ${z.farbe}66`,
                }}
              >
                {z.nummer ?? <span aria-hidden>{z.emoji}</span>}
              </span>
              <span className="min-w-0 truncate text-[clamp(0.85rem,1.9vw,1.3rem)] font-bold text-slate-50">
                {z.nummer !== null && <span aria-hidden className="mr-1">{z.emoji}</span>}
                {z.name}
              </span>
              <span className="ml-auto shrink-0 text-[clamp(0.55rem,1vw,0.75rem)] uppercase tracking-wider text-forest-400/75">
                {artLabel(z.art)}
              </span>
            </li>
          ))}
        </ul>
      ) : a.status !== 'vollstaendig' ? (
        <p className="mt-[1vh] text-[clamp(0.8rem,1.7vw,1.15rem)] font-bold text-rose-300">
          Noch keine Öle eingetragen
        </p>
      ) : null}

      {a.besonderheiten.length > 0 && (
        <div className="mt-[0.9vh] flex flex-wrap gap-1">
          {a.besonderheiten.map((b) => (
            <span
              key={b.key}
              className="rounded-full px-2 py-0.5 text-[clamp(0.58rem,1.1vw,0.78rem)] text-forest-100/90 ring-1 ring-forest-700/50"
              style={b.farbe ? { background: `${b.farbe}33` } : { background: 'rgba(20,83,45,0.4)' }}
            >
              <span aria-hidden>{b.emoji}</span> {b.label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function artLabel(art: RegalEintrag['art']): string {
  return art === 'oel' ? 'Öl' : art === 'eigenes_oel' ? 'eigenes Öl'
    : art === 'sud' ? 'Sud' : art === 'raeucher' ? 'Räucherwerk' : 'Schnaps';
}

/** Ein Regal-Etikett im Sammel-Lauf. Steht IMMER dabei, für welche Sauna —
 *  genau hier wurden sonst die falschen Flaschen gegriffen. */
function Etikett({
  z, gruppe,
}: {
  z: SammelEintrag;
  gruppe: AnzeigeAufguss[];
}) {
  return (
    <div
      className="flex items-center gap-[0.9vw] rounded-2xl bg-slate-900/70 px-[1.2vw] py-[1.1vh] ring-1"
      style={{ boxShadow: `inset 0 0 0 1px ${z.farbe}44`, borderColor: 'transparent' }}
    >
      {z.nummer !== null ? (
        <span
          className="grid h-[clamp(2.6rem,7vh,4.4rem)] w-[clamp(2.6rem,7vh,4.4rem)] shrink-0 place-items-center rounded-xl text-[clamp(1.3rem,3.6vh,2.4rem)] font-black tabular-nums leading-none"
          style={{ background: `${z.farbe}22`, color: z.farbe, boxShadow: `inset 0 0 0 2px ${z.farbe}66` }}
        >
          {z.nummer}
        </span>
      ) : (
        <span
          aria-hidden
          className="grid h-[clamp(2.6rem,7vh,4.4rem)] w-[clamp(2.6rem,7vh,4.4rem)] shrink-0 place-items-center rounded-xl text-[clamp(1.3rem,3.6vh,2.2rem)] leading-none"
          style={{ background: `${z.farbe}22`, boxShadow: `inset 0 0 0 2px ${z.farbe}55` }}
        >
          {z.emoji}
        </span>
      )}

      <span className="min-w-0">
        <span className="block truncate text-[clamp(0.85rem,1.9vw,1.35rem)] font-bold text-slate-50">
          {z.nummer !== null && <span aria-hidden className="mr-1">{z.emoji}</span>}
          {z.name}
        </span>
        <span className="block text-[clamp(0.58rem,1.1vw,0.8rem)] uppercase tracking-wider text-forest-400/75">
          {artLabel(z.art)}
          <span className="ml-1 normal-case tracking-normal text-forest-300/70">
            · {z.fuer.length === gruppe.length
              ? `alle ${gruppe.length} Saunen`
              : z.fuer.map((i) => gruppe[i]?.sauna?.name ?? '?').join(' + ')}
          </span>
        </span>
      </span>
    </div>
  );
}
