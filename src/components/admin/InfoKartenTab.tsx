import { useEffect, useRef, useState } from 'react';
import {
  useBrandSettings, useUpdateBrandSettings,
  uploadAsset, uploadVideo, publicAssetUrl,
} from '@/lib/api';
import { InfoKarteView } from '@/components/infokarte/InfoKarteView';
import { useNow } from '@/hooks/useNow';
import { AUSSCHNITT_DEFAULT } from '@/types/branding';
import {
  neueKarte, LEINWAND_V, HINTERGRUND_DEFAULT,
  type InfoKarte, type KartenElement, type TextElement, type CountdownElement,
} from '@/types/infokarten';

/** Editor für frei gestaltete Info-Karten auf der TV-Tafel.
 *
 *  Aufbau: links die Kartenliste, rechts die Leinwand mit den Ebenen. Die
 *  Vorschau ist KEIN Nachbau, sondern dieselbe Komponente, die auch auf der
 *  Tafel läuft (InfoKarteView) — Abweichungen zwischen Editor und Ergebnis
 *  sind damit ausgeschlossen. Genau daran krankte das Namensschild einmal.
 *
 *  Gespeichert wird in brand_settings.info_karten. Kein eigener
 *  system_config-Key: die Lese-Policy zählt die erlaubten Keys einzeln auf,
 *  ein neuer wäre für die anonyme Tafel unsichtbar.
 */
export function InfoKartenTab() {
  const brandQ = useBrandSettings();
  const update = useUpdateBrandSettings();
  const now = useNow(1000);

  const [karten, setKarten] = useState<InfoKarte[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // NUR beim ersten Laden aus der Datenbank übernehmen. Danach führt der
  // lokale State — sonst würde die Antwort eines gerade laufenden Speicherns
  // die Eingaben zurücksetzen, an denen man weiterarbeitet (Regler springt).
  const geladen = useRef(false);
  useEffect(() => {
    if (brandQ.data && !geladen.current) {
      geladen.current = true;
      setKarten(brandQ.data.info_karten);
      setGewaehlt((g) => g ?? brandQ.data!.info_karten[0]?.id ?? null);
    }
  }, [brandQ.data]);

  const karte = karten.find((k) => k.id === gewaehlt) ?? null;

  // Gebündeltes Speichern. Ein Schieberegler feuert bei jeder Mausbewegung —
  // ungebremst wären das Dutzende Schreibvorgänge pro Sekunde auf denselben
  // jsonb-Blob. Die Anzeige folgt sofort, die Datenbank eine Dreiviertel-
  // sekunde nach der letzten Änderung.
  const timer = useRef<number | null>(null);
  const offen = useRef<InfoKarte[] | null>(null);

  function speichern(next: InfoKarte[]) {
    setKarten(next);
    offen.current = next;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(schreiben, 750);
  }

  async function schreiben() {
    const next = offen.current;
    if (!next || !brandQ.data) return;
    offen.current = null;
    setFehler(null);
    try {
      await update.mutateAsync({ ...brandQ.data, info_karten: next });
      setGespeichert(true);
      window.setTimeout(() => setGespeichert(false), 1500);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  // Beim Verlassen des Tabs nachziehen, was noch aussteht — sonst geht die
  // letzte Änderung verloren, wenn man direkt nach dem Schieben wegklickt.
  useEffect(() => () => { if (offen.current) void schreiben(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const aendern = (patch: Partial<InfoKarte>) => {
    if (!karte) return;
    speichern(karten.map((k) => (k.id === karte.id ? { ...k, ...patch } : k)));
  };

  function anlegen() {
    const k = neueKarte(crypto.randomUUID());
    speichern([...karten, k]);
    setGewaehlt(k.id);
  }

  function loeschen(id: string) {
    if (!confirm('Diese Karte wirklich löschen?')) return;
    const next = karten.filter((k) => k.id !== id);
    speichern(next);
    if (gewaehlt === id) setGewaehlt(next[0]?.id ?? null);
  }

  if (brandQ.isLoading) return <p className="text-forest-300/70 text-sm">Lade…</p>;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-forest-100">📣 Info-Karten für die Tafel</h1>
          <p className="text-xs text-forest-300/70">
            Kurzfristige Ansagen — frei gestaltet, mit Text, Bildern, Video und Countdown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gespeichert && <span className="text-xs text-emerald-300">✓ Gespeichert</span>}
          <button
            onClick={anlegen}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-2 text-sm font-bold text-amber-950"
          >
            + Neue Karte
          </button>
        </div>
      </header>

      {fehler && <p className="text-xs text-rose-300">⚠️ {fehler}</p>}

      {karten.length === 0 ? (
        <p className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-6 text-sm text-forest-300/80">
          Noch keine Karte. „+ Neue Karte" legt eine an — sie erscheint erst auf der Tafel,
          wenn du sie aktiv schaltest.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          {/* Kartenliste */}
          <div className="space-y-1.5">
            {karten.map((k) => (
              <button
                key={k.id}
                onClick={() => setGewaehlt(k.id)}
                className={`w-full text-left rounded-xl px-3 py-2 ring-1 transition ${
                  k.id === gewaehlt
                    ? 'bg-forest-900 ring-amber-500/50'
                    : 'bg-forest-950/60 ring-forest-800/50 hover:bg-forest-900/70'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${k.aktiv ? 'bg-emerald-400' : 'bg-forest-600'}`} />
                  <span className="text-sm text-forest-100 truncate">{k.titel}</span>
                  {k.wichtig && <span title="Wird groß eingeblendet">📢</span>}
                </div>
                <div className="text-[10px] text-forest-400 mt-0.5">
                  {k.aktiv ? zeitraumText(k) : 'aus'}
                </div>
              </button>
            ))}
          </div>

          {karte && (
            <div className="space-y-4">
              <KartenKopf karte={karte} aendern={aendern} onLoeschen={() => loeschen(karte.id)} />
              <Leinwand karte={karte} now={now} aendern={aendern} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function zeitraumText(k: InfoKarte): string {
  if (!k.von && !k.bis) return 'läuft dauerhaft';
  const d = (s: string) => s.split('-').reverse().join('.');
  if (k.von && k.bis) return `${d(k.von)} – ${d(k.bis)}`;
  if (k.von) return `ab ${d(k.von)}`;
  return `bis ${d(k.bis!)}`;
}

// ─── Kopfzeile: Name, Schalter, Zeitraum ─────────────────────────────────
function KartenKopf({
  karte, aendern, onLoeschen,
}: {
  karte: InfoKarte;
  aendern: (p: Partial<InfoKarte>) => void;
  onLoeschen: () => void;
}) {
  return (
    <div className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={karte.titel}
          onChange={(e) => aendern({ titel: e.target.value })}
          placeholder="Name der Karte (nur intern)"
          className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button onClick={onLoeschen} className="text-xs text-rose-300 hover:text-rose-200 underline">
          Löschen
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={karte.aktiv} onChange={(e) => aendern({ aktiv: e.target.checked })}
            className="h-4 w-4 accent-emerald-500" />
          <span className="text-sm text-forest-100">Auf der Tafel zeigen</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={karte.wichtig} onChange={(e) => aendern({ wichtig: e.target.checked })}
            className="h-4 w-4 accent-amber-500" />
          <span className="text-sm text-forest-100">📢 Wichtig</span>
        </label>
      </div>
      <p className="text-[11px] text-forest-400/80 leading-snug">
        Ohne „Wichtig" erscheint die Karte nur in leeren Kacheln — an vollen Tagen gibt es keine.
        Mit „Wichtig" wird sie zusätzlich alle 5 Minuten für 20 Sekunden groß über die ganze
        Tafel gelegt.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Ab (optional)</label>
          <input type="date" value={karte.von ?? ''} onChange={(e) => aendern({ von: e.target.value || null })}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Bis (optional)</label>
          <input type="date" value={karte.bis ?? ''} onChange={(e) => aendern({ bis: e.target.value || null })}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50" />
        </div>
      </div>
    </div>
  );
}

// ─── Leinwand mit Ebenen ─────────────────────────────────────────────────
function Leinwand({
  karte, now, aendern,
}: {
  karte: InfoKarte;
  now: Date;
  aendern: (p: Partial<InfoKarte>) => void;
}) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const zieht = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const el = karte.elemente.find((e) => e.id === aktiv) ?? null;

  const setzeElement = (id: string, patch: Partial<KartenElement>) =>
    aendern({
      elemente: karte.elemente.map((e) => (e.id === id ? ({ ...e, ...patch } as KartenElement) : e)),
    });

  /** Ziehen in Prozent der Leinwand — dieselbe Einheit, in der gespeichert
   *  wird. Über Pointer-Events statt HTML5-Drag: das liefert keine brauchbare
   *  Position während der Bewegung und kein Verhalten auf Touch. */
  function starte(e: React.PointerEvent, id: string) {
    const box = buehne.current?.getBoundingClientRect();
    const ziel = karte.elemente.find((k) => k.id === id);
    if (!box || !ziel) return;
    setAktiv(id);
    zieht.current = {
      id,
      dx: ((e.clientX - box.left) / box.width) * 100 - ziel.x,
      dy: ((e.clientY - box.top) / box.height) * 100 - ziel.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function bewege(e: React.PointerEvent) {
    const z = zieht.current;
    const box = buehne.current?.getBoundingClientRect();
    if (!z || !box) return;
    const x = ((e.clientX - box.left) / box.width) * 100 - z.dx;
    const y = ((e.clientY - box.top) / box.height) * 100 - z.dy;
    setzeElement(z.id, {
      x: Math.round(Math.min(115, Math.max(-15, x))),
      y: Math.round(Math.min(115, Math.max(-15, y))),
    });
  }

  function hinzu(typ: KartenElement['typ']) {
    const id = crypto.randomUUID();
    const basis = { id, x: 20, y: 40, breite: 60, deckkraft: 1 };
    let neu: KartenElement;
    if (typ === 'text') {
      neu = { ...basis, typ: 'text', text: 'Neuer Text', groesse: 14, farbe: '#ffffff',
        fett: true, kursiv: false, ausrichtung: 'center', schatten: true };
    } else if (typ === 'countdown') {
      const inEinerWoche = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 16);
      neu = { ...basis, typ: 'countdown', ziel: inEinerWoche, label: 'Noch bis zum Fest',
        groesse: 18, farbe: '#fde68a', fertigText: 'Heute ist es so weit!', schatten: true };
    } else if (typ === 'bild') {
      neu = { ...basis, typ: 'bild', path: '', hoehe: 50, radius: 8, ausschnitt: { ...AUSSCHNITT_DEFAULT } };
    } else {
      neu = { ...basis, typ: 'video', path: '', hoehe: 50, radius: 8 };
    }
    aendern({ elemente: [...karte.elemente, neu] });
    setAktiv(id);
  }

  return (
    <div className="space-y-3">
      {/* Vorschau. Dieselbe Komponente wie auf der Tafel, darüber nur die
          Anfasser zum Verschieben. */}
      <div
        ref={buehne}
        className="relative w-full rounded-2xl overflow-hidden ring-1 ring-forest-700/60"
        style={{ aspectRatio: `${LEINWAND_V}` }}
        onPointerMove={bewege}
        onPointerUp={() => { zieht.current = null; }}
        onPointerLeave={() => { zieht.current = null; }}
      >
        <InfoKarteView karte={karte} now={now} />

        {karte.elemente.map((e) => (
          <div
            key={e.id}
            onPointerDown={(ev) => starte(ev, e.id)}
            className={`absolute cursor-move ${e.id === aktiv ? 'ring-2 ring-amber-400' : 'ring-1 ring-white/25 hover:ring-white/60'}`}
            style={{
              left: `${e.x}%`, top: `${e.y}%`, width: `${e.breite}%`,
              height: e.typ === 'bild' || e.typ === 'video' ? `${e.hoehe}%` : undefined,
              minHeight: e.typ === 'text' || e.typ === 'countdown' ? `${e.groesse}%` : undefined,
              borderRadius: 4,
              touchAction: 'none',
            }}
            title={beschriftung(e)}
          />
        ))}

        {/* Sichere Zone: bei 4 Aufgüssen pro Spalte ist die Kachel schmaler
            (4,11:1 statt 3:1) und schneidet oben und unten ab. Was hier drin
            steht, überlebt jede Aufteilung. */}
        <div
          aria-hidden
          className="absolute inset-x-0 pointer-events-none ring-1 ring-dashed ring-white/20"
          style={{ top: '13%', bottom: '13%' }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] text-forest-400 self-center mr-1">Ebene hinzufügen:</span>
        {([['text', '🔤 Text'], ['countdown', '⏳ Countdown'], ['bild', '🖼️ Bild'], ['video', '🎬 Video']] as const)
          .map(([typ, label]) => (
            <button key={typ} onClick={() => hinzu(typ)}
              className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900">
              {label}
            </button>
          ))}
      </div>

      <HintergrundPanel karte={karte} aendern={aendern} />

      {/* Ebenenliste + Einstellungen der gewählten Ebene */}
      <div className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-4">
        <div className="text-[10px] uppercase tracking-wider text-forest-500 mb-2">Ebenen</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {karte.elemente.length === 0 && (
            <span className="text-xs text-forest-400/70">Noch keine Ebene.</span>
          )}
          {karte.elemente.map((e) => (
            <button
              key={e.id}
              onClick={() => setAktiv(e.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                e.id === aktiv ? 'bg-amber-500 text-amber-950 font-semibold' : 'bg-forest-900/60 text-forest-200 ring-1 ring-forest-800/50'
              }`}
            >
              {beschriftung(e)}
            </button>
          ))}
        </div>

        {el ? (
          <ElementPanel
            el={el}
            onChange={(p) => setzeElement(el.id, p)}
            onLoeschen={() => {
              aendern({ elemente: karte.elemente.filter((e) => e.id !== el.id) });
              setAktiv(null);
            }}
            onNachVorn={() => {
              const rest = karte.elemente.filter((e) => e.id !== el.id);
              aendern({ elemente: [...rest, el] });
            }}
          />
        ) : (
          <p className="text-xs text-forest-400/70">Ebene anklicken zum Bearbeiten.</p>
        )}
      </div>
    </div>
  );
}

function beschriftung(e: KartenElement): string {
  if (e.typ === 'text') return '🔤 ' + (e.text.slice(0, 14) || 'Text');
  if (e.typ === 'countdown') return '⏳ Countdown';
  if (e.typ === 'bild') return '🖼️ Bild';
  return '🎬 Video';
}

// ─── Hintergrund ─────────────────────────────────────────────────────────
function HintergrundPanel({
  karte, aendern,
}: {
  karte: InfoKarte;
  aendern: (p: Partial<InfoKarte>) => void;
}) {
  const h = karte.hintergrund;
  const setH = (p: Partial<InfoKarte['hintergrund']>) => aendern({ hintergrund: { ...h, ...p } });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function datei(f: File) {
    setBusy(true); setFehler(null);
    try {
      const istVideo = f.type.startsWith('video/');
      const path = istVideo ? await uploadVideo(f) : await uploadAsset(f, 'info-karten');
      setH({ path, typ: istVideo ? 'video' : 'bild' });
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-forest-500">Hintergrund</div>
      <div className="flex flex-wrap gap-1.5">
        {([['farbe', 'Einfarbig'], ['verlauf', 'Verlauf'], ['bild', 'Bild'], ['video', 'Video']] as const)
          .map(([typ, label]) => (
            <button key={typ} onClick={() => setH({ typ })}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                h.typ === typ ? 'bg-forest-500 text-forest-950 font-semibold' : 'bg-forest-900/60 text-forest-200 ring-1 ring-forest-800/50'
              }`}>
              {label}
            </button>
          ))}
      </div>

      {(h.typ === 'farbe' || h.typ === 'verlauf') && (
        <div className="flex items-center gap-3">
          <Farbe label="Farbe" wert={h.farbe} onChange={(v) => setH({ farbe: v })} />
          {h.typ === 'verlauf' && <Farbe label="Zweite Farbe" wert={h.farbe2} onChange={(v) => setH({ farbe2: v })} />}
        </div>
      )}

      {(h.typ === 'bild' || h.typ === 'video') && (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-100 ring-1 ring-forest-700/50 cursor-pointer hover:bg-forest-900">
            {busy ? 'Lädt…' : h.path ? '📤 Anderes wählen' : '📤 Datei wählen'}
            <input type="file" accept={h.typ === 'video' ? 'video/mp4,video/webm' : 'image/*'} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) datei(f); e.target.value = ''; }} />
          </label>
          {h.typ === 'video' && (
            <p className="text-[10px] text-forest-400/80">
              MP4 oder WebM, höchstens 20 MB. Läuft stumm in Dauerschleife — halte es kurz,
              die Tafel läuft rund um die Uhr.
            </p>
          )}
          <Regler label="Abdunkeln" wert={h.schleier} min={0} max={0.9}
            onChange={(v) => setH({ schleier: v })}
            hint="Ohne Abdunkeln verschwindet heller Text auf hellen Bildstellen." />
        </div>
      )}
      {fehler && <p className="text-[11px] text-rose-300">{fehler}</p>}
      {h.path && (
        <button onClick={() => setH({ path: null, typ: 'verlauf', ausschnitt: { ...HINTERGRUND_DEFAULT.ausschnitt } })}
          className="text-[10px] text-rose-300 underline">Hintergrundbild entfernen</button>
      )}
    </div>
  );
}

// ─── Einstellungen der gewählten Ebene ───────────────────────────────────
function ElementPanel({
  el, onChange, onLoeschen, onNachVorn,
}: {
  el: KartenElement;
  onChange: (p: Partial<KartenElement>) => void;
  onLoeschen: () => void;
  onNachVorn: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function datei(f: File) {
    setBusy(true); setFehler(null);
    try {
      const path = el.typ === 'video' ? await uploadVideo(f) : await uploadAsset(f, 'info-karten');
      onChange({ path } as Partial<KartenElement>);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-forest-800/40 pt-3">
      {el.typ === 'text' && (
        <>
          <textarea
            value={(el as TextElement).text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<KartenElement>)}
            rows={2}
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Farbe label="Schriftfarbe" wert={(el as TextElement).farbe}
              onChange={(v) => onChange({ farbe: v } as Partial<KartenElement>)} />
            <Schalter an={(el as TextElement).fett} label="Fett"
              onChange={(v) => onChange({ fett: v } as Partial<KartenElement>)} />
            <Schalter an={(el as TextElement).kursiv} label="Kursiv"
              onChange={(v) => onChange({ kursiv: v } as Partial<KartenElement>)} />
            <Schalter an={(el as TextElement).schatten} label="Schatten"
              onChange={(v) => onChange({ schatten: v } as Partial<KartenElement>)} />
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} onClick={() => onChange({ ausrichtung: a } as Partial<KartenElement>)}
                  className={`rounded px-2 py-1 text-xs ${
                    (el as TextElement).ausrichtung === a ? 'bg-amber-500 text-amber-950' : 'bg-forest-900/60 text-forest-200'
                  }`}>
                  {a === 'left' ? '⬅' : a === 'center' ? '⬌' : '➡'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {el.typ === 'countdown' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Zielzeitpunkt</label>
            <input type="datetime-local"
              value={(el as CountdownElement).ziel.slice(0, 16)}
              onChange={(e) => onChange({ ziel: new Date(e.target.value).toISOString() } as Partial<KartenElement>)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Text darüber</label>
            <input value={(el as CountdownElement).label}
              onChange={(e) => onChange({ label: e.target.value } as Partial<KartenElement>)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-forest-300 font-semibold">Wenn erreicht</label>
            <input value={(el as CountdownElement).fertigText}
              onChange={(e) => onChange({ fertigText: e.target.value } as Partial<KartenElement>)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50" />
          </div>
          <Farbe label="Farbe" wert={(el as CountdownElement).farbe}
            onChange={(v) => onChange({ farbe: v } as Partial<KartenElement>)} />
        </div>
      )}

      {(el.typ === 'bild' || el.typ === 'video') && (
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-100 ring-1 ring-forest-700/50 cursor-pointer hover:bg-forest-900">
            {busy ? 'Lädt…' : el.path ? '📤 Andere Datei' : '📤 Datei wählen'}
            <input type="file" accept={el.typ === 'video' ? 'video/mp4,video/webm' : 'image/*'} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) datei(f); e.target.value = ''; }} />
          </label>
          {el.path && (
            <p className="text-[10px] text-forest-400/70 truncate">{publicAssetUrl(el.path)?.split('/').pop()}</p>
          )}
          <Regler label="Höhe" wert={el.hoehe} min={5} max={110} einheit="%"
            onChange={(v) => onChange({ hoehe: v } as Partial<KartenElement>)} />
          <Regler label="Ecken abrunden" wert={el.radius} min={0} max={50}
            onChange={(v) => onChange({ radius: v } as Partial<KartenElement>)} />
        </div>
      )}

      {fehler && <p className="text-[11px] text-rose-300">{fehler}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Regler label="Breite" wert={el.breite} min={4} max={110} einheit="%"
          onChange={(v) => onChange({ breite: v } as Partial<KartenElement>)} />
        {(el.typ === 'text' || el.typ === 'countdown') && (
          <Regler label="Schriftgröße" wert={el.groesse} min={3} max={60}
            onChange={(v) => onChange({ groesse: v } as Partial<KartenElement>)} />
        )}
        <Regler label="Transparenz" wert={el.deckkraft} min={0.05} max={1}
          onChange={(v) => onChange({ deckkraft: v } as Partial<KartenElement>)}
          hint="Jede Ebene einzeln — so lässt sich ein Bild zurücknehmen, ohne den Text zu schwächen." />
      </div>

      <div className="flex gap-3">
        <button onClick={onNachVorn} className="text-[11px] text-forest-300 underline hover:text-forest-100">
          nach vorn holen
        </button>
        <button onClick={onLoeschen} className="text-[11px] text-rose-300 underline hover:text-rose-200">
          Ebene löschen
        </button>
      </div>
    </div>
  );
}

// ─── Kleinteile ──────────────────────────────────────────────────────────
function Farbe({ label, wert, onChange }: { label: string; wert: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-forest-400">{label}</span>
      <input type="color" value={wert} onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded bg-forest-900 ring-1 ring-forest-700/60" />
    </label>
  );
}

function Schalter({ an, label, onChange }: { an: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!an)}
      className={`rounded px-2.5 py-1 text-xs ${an ? 'bg-amber-500 text-amber-950 font-semibold' : 'bg-forest-900/60 text-forest-200'}`}>
      {label}
    </button>
  );
}

function Regler({
  label, wert, min, max, onChange, einheit = '', hint,
}: {
  label: string; wert: number; min: number; max: number;
  onChange: (v: number) => void; einheit?: string; hint?: string;
}) {
  // Schrittweite aus dem Wertebereich: 0–1 braucht 0,05er-Schritte,
  // 0–110 ganze Zahlen. Sonst wäre der eine Regler unbrauchbar grob und der
  // andere unnötig fein.
  const fein = max <= 1;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-forest-400">{label}</span>
        <span className="text-[10px] tabular-nums text-forest-300">
          {fein ? Math.round(wert * 100) + ' %' : Math.round(wert) + einheit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={fein ? 0.05 : 1} value={wert}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400" />
      {hint && <p className="text-[10px] text-forest-400/70 leading-snug">{hint}</p>}
    </div>
  );
}
