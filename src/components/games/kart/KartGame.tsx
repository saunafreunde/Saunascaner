import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentMember } from '@/lib/api';
import {
  STRECKEN, STRECKE_BY_ID, TEX_SIZE, bauStreckenWelt,
  M_BAHN, M_TURBO, M_BREMS, M_RAMPE,
  type KartStrecke, type StreckenWelt,
} from '@/lib/kart/strecken';
import { ladeKartAssets, skinFuer, type KartAssets, type SchlittenPosen } from '@/lib/kart/assets';

// ─── Sauna-Kart ──────────────────────────────────────────────────────────────
// Mode-7-Rennen im Stil der 16-Bit-Ära: der Boden ist eine perspektivisch
// gekippte Textur, pro Bildzeile einmal abgetastet. Alles ist programmatisch
// gezeichnet — kein Asset, kein CDN, der Chunk bleibt unter dem einer
// mittleren Foto-Datei.
//
// Mehrspieler = GEISTER: die beste Fahrt jedes Mitglieds liegt als
// Positions-Aufzeichnung in kart_ghosts (Migration 0146); die schnellsten
// drei fahren als durchscheinende Schlitten mit. Echtzeit-Rennen über
// Supabase wäre Latenz-Lotterie — gegen Hannes' Geist zu verlieren fühlt
// sich trotzdem exakt wie verlieren an.
//
// Steuerung (Touch-Leitlinie 16.08.2026): Daumen links = links lenken,
// Daumen rechts = rechts lenken, Gas automatisch. Keine Knöpfe im Bild.

const W = 360;                    // interne Auflösung — CSS skaliert hoch,
const H = 480;                    // image-rendering: pixelated = Retro-Look
const HORIZONT = Math.floor(H * 0.40);
const FOKAL = 220;                // Projektions-Brennweite in Pixeln
const KAM_HOEHE = 34;             // Kamera-Höhe in Welteinheiten
const KAM_ABSTAND = 52;           // Kamera hinter dem Kart

// Rundenlänge ≈ 2350 Welteinheiten (Kelo-Kurve). 130 u/s ergibt ~20 s pro
// saubere Runde, mit Fehlern 25–35 s — zwei Runden passen damit genau in die
// Saunapause. (230 u/s sah im Test gut aus, machte die Runde aber zum
// 10-Sekunden-Sprint und riss die 20-s-Untergrenze des Servers.)
const V_MAX = 130;                // Welteinheiten/s auf der Bahn
const V_MAX_WIESE = 55;           // abseits: der Sud versickert im Moos
const BESCHL = 1.6;               // Annäherung an v_max (1/s)
const LENKRATE = 2.6;             // rad/s bei voller Fahrt

const GHOST_DT = 100;             // Aufzeichnungs-Takt in ms
const MAX_LAUFZEIT_MS = 480_000;  // danach gilt die Fahrt als aufgegeben

// ─── Rallye-Elemente (16.08.2026) ────────────────────────────────────────────
// ALLES hier ist eine pure Funktion von Rennzeit + Strecke — kein Zufall.
// Nur so bleibt das Geister-Modell fair: der Rekordhalter hatte exakt
// dieselben Stämme, Turbos und Pfützen vor der Nase.
const TURBO_FAKTOR = 1.6;         // Höchsttempo im Boost
const TURBO_DAUER_S = 2.0;
const BREMS_FAKTOR = 0.5;         // Pfütze: halbes Tempo
const FLUG_DAUER_S = 0.65;        // Sprungdauer ab Rampe
const FLUG_MIN_TEMPO = 0.62;      // unter 62 % vom Maximum hebt nichts ab
const FLUG_HOEHE = 46;            // Scheitel in Bildpixeln
const STAMM_RADIUS = 15;          // Kollisionsradius in Welteinheiten
const STAMM_TREFFER_FAKTOR = 0.3; // Resttempo nach Einschlag
const TAUMEL_S = 0.7;             // Sekunden Schlingern nach Treffer
const SCHONFRIST_S = 1.2;         // Unverwundbarkeit nach Treffer

type GhostSamples = { v: 1; dt: number; pts: [number, number, number][] };

type TopGhost = {
  member_id: string;
  name: string;
  zeit_ms: number;
  created_at: string;
  samples: GhostSamples | null;
};

function fmtZeit(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')},${String(t).padStart(3, '0')}`;
}

// ─── Datenzugriff ────────────────────────────────────────────────────────────

function useTopGhosts(streckeId: string) {
  return useQuery({
    queryKey: ['kart-ghosts', streckeId],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase nicht konfiguriert');
      const { data, error } = await supabase.rpc('kart_top_ghosts', {
        p_strecke: streckeId, p_limit: 8, p_mit_samples: true,
      });
      if (error) throw error;
      return (data ?? []) as TopGhost[];
    },
    staleTime: 30_000,
  });
}

function useSubmitGhost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { strecke: string; zeit_ms: number; samples: GhostSamples }) => {
      if (!supabase) throw new Error('Supabase nicht konfiguriert');
      const { data, error } = await supabase.rpc('kart_submit_ghost', {
        p_strecke: i.strecke, p_zeit_ms: i.zeit_ms, p_samples: i.samples,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (_d, i) => qc.invalidateQueries({ queryKey: ['kart-ghosts', i.strecke] }),
  });
}

// ─── Streckenwahl ────────────────────────────────────────────────────────────

export default function KartGame() {
  const [streckeId, setStreckeId] = useState<string | null>(null);
  if (!streckeId) return <StreckenWahl onWahl={setStreckeId} />;
  const strecke = STRECKE_BY_ID[streckeId];
  return <Rennen strecke={strecke} onZurueck={() => setStreckeId(null)} />;
}

function StreckenWahl({ onWahl }: { onWahl: (id: string) => void }) {
  const me = useCurrentMember();
  return (
    <div className="mx-auto max-w-md p-4 space-y-3">
      <p className="text-sm text-forest-300">
        🛷 Saunatuch-Schlitten, Schwarzwald, Bestzeit. Die schnellsten drei des
        Vereins fahren als Geister mit — überhol sie.
      </p>
      {STRECKEN.map((s) => (
        <StreckenKarte key={s.id} strecke={s} meineId={me.data?.id ?? null} onWahl={onWahl} />
      ))}
      <p className="text-xs text-forest-400 text-center">
        Daumen links/rechts lenkt · Gas gibt's automatisch · 2 Runden
      </p>
    </div>
  );
}

function StreckenKarte({ strecke, meineId, onWahl }: {
  strecke: KartStrecke; meineId: string | null; onWahl: (id: string) => void;
}) {
  const top = useTopGhosts(strecke.id);
  const [bildKaputt, setBildKaputt] = useState(false);
  const beste = top.data?.[0];
  const meine = top.data?.find((g) => g.member_id === meineId);
  return (
    <button
      onClick={() => onWahl(strecke.id)}
      className="w-full rounded-2xl bg-forest-900/60 p-3 text-left ring-1 ring-forest-800/50 hover:bg-forest-900/80 transition active:scale-[0.99]"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex items-center gap-3">
        {!bildKaputt && (
          <img
            src={`/kart/vorschau-${strecke.id}.jpg`}
            alt=""
            aria-hidden
            draggable={false}
            onError={() => setBildKaputt(true)}
            className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-forest-700/50"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-forest-100">{strecke.name}</span>
            <span className="text-[11px] text-forest-400">{strecke.runden} Runden</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-xs">
            <span className="text-amber-200/90">
              {beste ? <>👑 {beste.name} · {fmtZeit(beste.zeit_ms)}</> : 'Noch kein Streckenrekord — fahr ihn.'}
            </span>
            {meine && <span className="text-forest-300 tabular-nums">Du: {fmtZeit(meine.zeit_ms)}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Das Rennen ──────────────────────────────────────────────────────────────

type Phase = 'countdown' | 'fahren' | 'ziel';

function Rennen({ strecke, onZurueck }: { strecke: KartStrecke; onZurueck: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const me = useCurrentMember();
  const top = useTopGhosts(strecke.id);
  const submit = useSubmitGhost();
  const [phase, setPhase] = useState<Phase>('countdown');
  const [ergebnis, setErgebnis] = useState<{ zeit: number; neueBestzeit: boolean } | null>(null);
  const [hud, setHud] = useState({ zeit: 0, runde: 1, countdown: 3 });
  const neustartRef = useRef(0);
  const [neustart, setNeustart] = useState(0);

  // Erst die fal.ai-Grafiken laden (mit Timeout + Fallback), DANN die Welt
  // bauen — die Bahn-Textur wird beim Bau eingebacken. Der Lader liefert nie
  // einen Fehler; ohne Bilder entsteht die programmatische Fassung.
  const [assets, setAssets] = useState<KartAssets | null>(null);
  useEffect(() => {
    let lebt = true;
    ladeKartAssets().then((a) => { if (lebt) setAssets(a); });
    return () => { lebt = false; };
  }, []);

  const welt = useMemo(
    () => (assets ? bauStreckenWelt(strecke, assets.boden[strecke.id]) : null),
    [strecke, assets],
  );

  // Geister der Top-Fahrer (ohne den eigenen — gegen sich selbst zu fahren
  // wäre doppelt demoralisierend), maximal drei fürs Bild.
  const geister = useMemo(() => {
    const meineId = me.data?.id;
    return (top.data ?? [])
      .filter((g) => g.samples && g.member_id !== meineId)
      .slice(0, 3);
  }, [top.data, me.data?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !welt || !assets) return;
    const stop = starteRennen({
      canvas, welt, geister, assets,
      spielerSkin: skinFuer(me.data?.id, 3),
      onHud: (h) => setHud(h),
      onPhase: (p) => setPhase(p),
      onZiel: (zeitMs, samples) => {
        const vorher = (top.data ?? []).find((g) => g.member_id === me.data?.id)?.zeit_ms;
        setErgebnis({ zeit: zeitMs, neueBestzeit: !vorher || zeitMs < vorher });
        submit.mutate({ strecke: strecke.id, zeit_ms: zeitMs, samples });
      },
    });
    return stop;
    // top.data absichtlich NICHT in den Deps: die Geister eines laufenden
    // Rennens sollen nicht mitten in der Kurve ausgetauscht werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welt, geister, assets, neustart]);

  return (
    <div className="mx-auto max-w-md p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <button onClick={onZurueck}
          className="rounded-lg bg-forest-900/60 px-3 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50"
          style={{ touchAction: 'manipulation' }}>
          ← Strecken
        </button>
        <span className="font-semibold text-forest-100">{strecke.name}</span>
        <span className="tabular-nums text-forest-300 text-xs">
          Runde {Math.min(hud.runde, strecke.runden)}/{strecke.runden}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl ring-1 ring-forest-700/50 shadow-2xl shadow-black/60 select-none">
        {!welt && (
          <div className="grid place-items-center text-forest-300 text-sm"
            style={{ aspectRatio: `${W}/${H}` }}>
            Lade Strecke…
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={welt ? 'block w-full' : 'hidden'}
          style={{ imageRendering: 'pixelated', touchAction: 'none', aspectRatio: `${W}/${H}` }}
          aria-label="Sauna-Kart — Daumen links oder rechts auf das Bild lenkt"
        />

        {/* Zeit-HUD */}
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/45 px-2 py-1 font-mono text-sm tabular-nums text-white">
          {fmtZeit(hud.zeit)}
        </div>

        {phase === 'countdown' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="text-7xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {hud.countdown > 0 ? hud.countdown : 'LOS!'}
            </span>
          </div>
        )}

        {phase === 'ziel' && ergebnis && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-forest-950/95 p-4 text-center ring-1 ring-forest-700/60">
              <p className="text-3xl" aria-hidden>🏁</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-forest-100">
                {fmtZeit(ergebnis.zeit)}
              </p>
              <p className="mt-1 text-sm text-forest-300">
                {ergebnis.neueBestzeit ? '✨ Neue persönliche Bestzeit!' : 'Nicht schneller als dein Geist.'}
              </p>
              {submit.isError && (
                <p className="mt-1 text-xs text-rose-300">{(submit.error as Error).message}</p>
              )}
              <div className="mt-3 space-y-1 text-left">
                {(top.data ?? []).slice(0, 5).map((g, i) => (
                  <div key={g.member_id} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-forest-400">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-forest-100">{g.name}</span>
                    <span className="font-mono tabular-nums text-amber-200">{fmtZeit(g.zeit_ms)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => { neustartRef.current += 1; setErgebnis(null); setNeustart(neustartRef.current); }}
                  className="flex-1 rounded-xl bg-amber-500/80 px-4 py-2.5 text-sm font-bold text-forest-950"
                  style={{ touchAction: 'manipulation' }}>
                  ↺ Nochmal
                </button>
                <button
                  onClick={onZurueck}
                  className="flex-1 rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm text-forest-200 ring-1 ring-forest-700/50"
                  style={{ touchAction: 'manipulation' }}>
                  Strecken
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-forest-400">
        Daumen links/rechts lenkt · Pfeile = Turbo · Rampe springt über die Pfütze ·
        rollenden Stämmen ausweichen! Tacho: <span className="text-amber-300">Fahrt</span> ·{' '}
        <span className="text-rose-300">gebremst</span> · <span className="text-cyan-300">Turbo</span>
      </p>
    </div>
  );
}

// ─── Engine ──────────────────────────────────────────────────────────────────

function starteRennen(opts: {
  canvas: HTMLCanvasElement;
  welt: StreckenWelt;
  geister: TopGhost[];
  assets: KartAssets;
  spielerSkin: number;
  onHud: (h: { zeit: number; runde: number; countdown: number }) => void;
  onPhase: (p: Phase) => void;
  onZiel: (zeitMs: number, samples: GhostSamples) => void;
}): () => void {
  const { canvas, welt, geister, assets, spielerSkin, onHud, onPhase, onZiel } = opts;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const { strecke, maske, linie } = welt;

  // Textur einmal als Uint32 lesen — der Boden wird pro Pixel abgetastet.
  const texCtx = welt.textur.getContext('2d')!;
  const texDaten = new Uint32Array(texCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data.buffer);
  const bild = ctx.createImageData(W, H - HORIZONT);
  const bildDaten = new Uint32Array(bild.data.buffer);
  const WALD = packFarbe(16, 34, 20);

  // Panorama. Mit fal.ai-Bild füllt der Himmel den KOMPLETTEN Bereich über
  // dem Horizont: das Bild wird auf Horizont-Höhe skaliert und einmal
  // GESPIEGELT danebengelegt — die Naht existiert dadurch konstruktionsbedingt
  // nicht, egal wie unsauber die Bildränder kacheln. Ohne Bild bleibt der
  // alte Weg: Verlauf + programmatische Silhouette (60px-Streifen).
  const panoVollbild = !!assets.panorama;
  const panorama = (() => {
    if (!assets.panorama) return bauPanorama();
    const img = assets.panorama as HTMLImageElement;
    const b = Math.max(W, Math.round((img.width as number ?? W) * (HORIZONT / (img.height as number ?? HORIZONT))));
    const c = document.createElement('canvas');
    c.width = b * 2; c.height = HORIZONT;
    const g2 = c.getContext('2d')!;
    g2.drawImage(img, 0, 0, b, HORIZONT);
    g2.save();
    g2.translate(b * 2, 0);
    g2.scale(-1, 1);
    g2.drawImage(img, 0, 0, b, HORIZONT);
    g2.restore();
    return c;
  })();

  // Sprites je Skin (drei Posen) — null = programmatische Zeichnung.
  const spielerPosen = assets.schlitten[spielerSkin] ?? null;
  const geistPosen = geister.map((g) => assets.schlitten[skinFuer(g.member_id, 3)] ?? null);
  const stammSprite = assets.stamm;

  // ─── Zustand ───────────────────────────────────────────────────────────
  const start = linie[0];
  const st = {
    x: start.x, y: start.y, richtung: start.winkel, v: 0,
    lenken: 0,
    lenkGlatt: 0,            // geglätteter Lenkwert für Pose + Kamera
    countdownMs: 3000,
    zeitMs: 0,
    letzterIdx: 0,
    fortschritt: 0,          // in Linien-Indizes, monoton wachsend
    runde: 1,
    fertig: false,
    samples: [] as [number, number, number][],
    naechsteProbe: 0,
    // Rallye-Zustand
    turboRestS: 0,
    flugRestS: 0,
    taumelRestS: 0,
    schonfristS: 0,
    gebremst: false,         // fürs Tacho: gerade Pfütze/Wiese/Taumel?
    letzterMaskenWert: M_BAHN,
  };

  // ─── Eingabe: Daumen-Hälften + Pfeiltasten ─────────────────────────────
  const zeiger = new Map<number, -1 | 1>();
  function lenkenAusZeigern() {
    let l = 0;
    zeiger.forEach((seite) => { l += seite; });
    st.lenken = Math.max(-1, Math.min(1, l));
  }
  function aufPointerDown(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    zeiger.set(e.pointerId, e.clientX - r.left < r.width / 2 ? -1 : 1);
    lenkenAusZeigern();
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function aufPointerEnde(e: PointerEvent) {
    zeiger.delete(e.pointerId);
    lenkenAusZeigern();
  }
  const tasten = new Set<string>();
  function aufTaste(e: KeyboardEvent, unten: boolean) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (unten) tasten.add(e.key); else tasten.delete(e.key);
    st.lenken = (tasten.has('ArrowRight') ? 1 : 0) - (tasten.has('ArrowLeft') ? 1 : 0);
    e.preventDefault();
  }
  const tasteAb = (e: KeyboardEvent) => aufTaste(e, true);
  const tasteAuf = (e: KeyboardEvent) => aufTaste(e, false);
  canvas.addEventListener('pointerdown', aufPointerDown);
  canvas.addEventListener('pointerup', aufPointerEnde);
  canvas.addEventListener('pointercancel', aufPointerEnde);
  window.addEventListener('keydown', tasteAb);
  window.addEventListener('keyup', tasteAuf);

  // ─── Schleife ──────────────────────────────────────────────────────────
  let raf = 0;
  let vorher = performance.now();
  let laeuft = true;

  function schritt(jetzt: number) {
    if (!laeuft) return;
    const dt = Math.min(0.05, (jetzt - vorher) / 1000);
    vorher = jetzt;

    if (st.countdownMs > 0) {
      st.countdownMs -= dt * 1000;
      onHud({ zeit: 0, runde: st.runde, countdown: Math.ceil(Math.max(0, st.countdownMs / 1000)) });
      if (st.countdownMs <= 0) onPhase('fahren');
    } else if (!st.fertig) {
      simuliere(dt);
    }

    zeichne();
    raf = requestAnimationFrame(schritt);
  }

  /** Position eines Stamms zur Rennzeit t — Dreieckswelle quer zur Bahn.
   *  Pure Funktion: gleicher Zeitpunkt = gleiche Position, in jedem Lauf. */
  function stammPosition(planIdx: number, zeitMs: number): { x: number; y: number; quer: number } {
    const plan = strecke.staemme[planIdx];
    const p = linie[plan.idx];
    const u = ((zeitMs / plan.periodeMs + plan.phase) % 1 + 1) % 1;
    const dreieck = 4 * Math.abs(u - 0.5) - 1; // 1 → -1 → 1
    const amp = strecke.breite + 26;
    const qx = -Math.sin(p.winkel), qy = Math.cos(p.winkel);
    const quer = dreieck * amp;
    return { x: p.x + qx * quer, y: p.y + qy * quer, quer };
  }

  function simuliere(dt: number) {
    st.zeitMs += dt * 1000;

    // Zeitgeber der Rallye-Elemente.
    st.turboRestS = Math.max(0, st.turboRestS - dt);
    st.flugRestS = Math.max(0, st.flugRestS - dt);
    st.taumelRestS = Math.max(0, st.taumelRestS - dt);
    st.schonfristS = Math.max(0, st.schonfristS - dt);

    // Oberfläche unterm Kart — in der Luft zählt sie nicht (wer springt,
    // fliegt über Pfütze und Wiese hinweg).
    const mx = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(st.x)));
    const my = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(st.y)));
    const wert = maske[my * TEX_SIZE + mx];
    const fliegt = st.flugRestS > 0;

    let vmax = wert >= M_BAHN ? V_MAX : V_MAX_WIESE;
    st.gebremst = false;
    if (!fliegt) {
      if (wert === M_TURBO) st.turboRestS = TURBO_DAUER_S;
      if (wert === M_BREMS) { vmax *= BREMS_FAKTOR; st.gebremst = true; }
      if (wert < M_BAHN) st.gebremst = true;
      // Rampe: nur die Vorderkante zündet (Wert-Wechsel auf M_RAMPE), sonst
      // würde jeder Frame auf der Rampe neu abheben.
      if (wert === M_RAMPE && st.letzterMaskenWert !== M_RAMPE && st.v > FLUG_MIN_TEMPO * V_MAX) {
        st.flugRestS = FLUG_DAUER_S;
      }
    }
    st.letzterMaskenWert = wert;
    if (st.turboRestS > 0) vmax *= TURBO_FAKTOR;
    if (st.taumelRestS > 0) { vmax *= 0.75; st.gebremst = true; }

    st.v += (vmax - st.v) * Math.min(1, BESCHL * dt);

    // Lenken: in der Luft wirkungslos, im Taumel halbiert plus Schlingern.
    let lenkEingabe = fliegt ? 0 : st.lenken;
    if (st.taumelRestS > 0) {
      lenkEingabe = lenkEingabe * 0.5 + Math.sin(st.zeitMs / 40) * 0.5;
    }
    st.richtung += lenkEingabe * LENKRATE * Math.min(1, st.v / V_MAX) * dt;
    st.lenkGlatt += (st.lenken - st.lenkGlatt) * Math.min(1, 9 * dt);
    st.x += Math.cos(st.richtung) * st.v * dt;
    st.y += Math.sin(st.richtung) * st.v * dt;

    // Stämme: Kollision nur am Boden und außerhalb der Schonfrist.
    if (!fliegt && st.schonfristS <= 0) {
      for (let si = 0; si < strecke.staemme.length; si++) {
        const s = stammPosition(si, st.zeitMs);
        const dx = s.x - st.x, dy = s.y - st.y;
        if (dx * dx + dy * dy < STAMM_RADIUS * STAMM_RADIUS) {
          st.v *= STAMM_TREFFER_FAKTOR;
          st.taumelRestS = TAUMEL_S;
          st.schonfristS = SCHONFRIST_S;
          break;
        }
      }
    }

    // Weltrand: sanft zurückschieben statt hart stoppen.
    st.x = Math.max(8, Math.min(TEX_SIZE - 8, st.x));
    st.y = Math.max(8, Math.min(TEX_SIZE - 8, st.y));

    // Fortschritt entlang der Mittellinie (Fenster-Suche um den letzten Punkt
    // — global suchen würde bei einer Acht die gegenüberliegende Passage
    // finden und Runden schenken).
    const n = linie.length;
    let besterIdx = st.letzterIdx, bester = Infinity;
    for (let o = -30; o <= 60; o++) {
      const i = ((st.letzterIdx + o) % n + n) % n;
      const p = linie[i];
      const d = (p.x - st.x) * (p.x - st.x) + (p.y - st.y) * (p.y - st.y);
      if (d < bester) { bester = d; besterIdx = i; }
    }
    let delta = besterIdx - st.letzterIdx;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    st.fortschritt += delta;
    st.letzterIdx = besterIdx;
    const runde = Math.floor(st.fortschritt / n) + 1;
    if (runde !== st.runde) st.runde = runde;

    // Geist aufzeichnen (10 Hz Spielzeit).
    if (st.zeitMs >= st.naechsteProbe && st.samples.length < 4800) {
      st.naechsteProbe += GHOST_DT;
      st.samples.push([
        Math.round(st.x * 10), Math.round(st.y * 10), Math.round(st.richtung * 100),
      ]);
    }

    onHud({ zeit: st.zeitMs, runde: st.runde, countdown: 0 });

    if (st.fortschritt >= n * strecke.runden) {
      st.fertig = true;
      onPhase('ziel');
      onZiel(Math.round(st.zeitMs), { v: 1, dt: GHOST_DT, pts: st.samples });
    }
    if (st.zeitMs > MAX_LAUFZEIT_MS) {
      // Aufgegeben — zurück zur Streckenwahl wäre Bevormundung; die Fahrt
      // läuft weiter, nur aufgezeichnet wird nichts mehr (Server lehnt
      // Überlängen ohnehin ab).
      st.samples.length = Math.min(st.samples.length, 4800);
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────
  const cos = Math.cos, sin = Math.sin;

  function zeichne() {
    // Die KAMERA hinkt dem Lenken minimal hinterher — der Trick, der Mode-7
    // „echt" anfühlen lässt: das Bild schwenkt weich, während die Physik
    // exakt bleibt.
    const rh = st.richtung - st.lenkGlatt * 0.09;

    // Himmel + Panorama (scrollt mit der Blickrichtung).
    const panX = Math.floor(((rh / (Math.PI * 2)) % 1 + 1) * panorama.width) % panorama.width;
    if (panoVollbild) {
      const teil = Math.min(panorama.width - panX, W);
      ctx.drawImage(panorama, panX, 0, teil, HORIZONT, 0, 0, teil, HORIZONT);
      if (teil < W) {
        ctx.drawImage(panorama, 0, 0, W - teil, HORIZONT, teil, 0, W - teil, HORIZONT);
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, HORIZONT);
      g.addColorStop(0, '#0e1a2b');
      g.addColorStop(0.7, '#27425f');
      g.addColorStop(1, '#4e6a83');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, HORIZONT);
      ctx.drawImage(panorama, panX, 0, Math.min(panorama.width - panX, W), 60, 0, HORIZONT - 60, Math.min(panorama.width - panX, W), 60);
      if (panorama.width - panX < W) {
        ctx.drawImage(panorama, 0, 0, W - (panorama.width - panX), 60, panorama.width - panX, HORIZONT - 60, W - (panorama.width - panX), 60);
      }
    }

    // Kamera hinter dem Kart — mit der verzögerten Blickrichtung.
    const kx = st.x - cos(rh) * KAM_ABSTAND;
    const ky = st.y - sin(rh) * KAM_ABSTAND;
    const fx = cos(rh), fy = sin(rh);
    const rx = -fy, ry = fx;

    // Boden: pro Bildzeile eine Distanz, pro Pixel ein Textur-Sample.
    let z = 0;
    for (let sy = 0; sy < H - HORIZONT; sy++) {
      const dist = (KAM_HOEHE * FOKAL) / (sy + 1);
      const cxw = kx + fx * dist;
      const cyw = ky + fy * dist;
      const schrittQuer = dist / FOKAL;
      let wx = cxw + rx * (-W / 2) * schrittQuer;
      let wy = cyw + ry * (-W / 2) * schrittQuer;
      const sxq = rx * schrittQuer, syq = ry * schrittQuer;
      for (let sx = 0; sx < W; sx++) {
        const tx = wx | 0, ty = wy | 0;
        bildDaten[z++] = (tx >= 0 && ty >= 0 && tx < TEX_SIZE && ty < TEX_SIZE)
          ? texDaten[ty * TEX_SIZE + tx]
          : WALD;
        wx += sxq; wy += syq;
      }
    }
    ctx.putImageData(bild, 0, HORIZONT);

    // Rollende Stämme — Billboards, deterministisch aus der Rennzeit.
    if (st.countdownMs <= 0 && !st.fertig) {
      for (let si = 0; si < strecke.staemme.length; si++) {
        const s = stammPosition(si, st.zeitMs);
        const dxw = s.x - kx, dyw = s.y - ky;
        const tiefe = dxw * fx + dyw * fy;
        if (tiefe < KAM_ABSTAND * 0.5 || tiefe > 620) continue;
        const quer = dxw * rx + dyw * ry;
        const sy = HORIZONT + (KAM_HOEHE * FOKAL) / tiefe;
        const sx = W / 2 + (quer * FOKAL) / tiefe;
        const skala = Math.min(1.4, 46 / tiefe * 3.6);
        zeichneStamm(ctx, stammSprite, sx, sy, skala, s.quer / 9);
      }
    }

    // Geister — hinter dem Spieler-Sprite gezeichnet, durchscheinend.
    if (st.countdownMs <= 0 && !st.fertig) {
      for (let gi = 0; gi < geister.length; gi++) {
        const geist = geister[gi];
        const p = geistPosition(geist.samples!, st.zeitMs);
        if (!p) continue;
        const dxw = p.x - kx, dyw = p.y - ky;
        const tiefe = dxw * fx + dyw * fy;
        if (tiefe < KAM_ABSTAND * 0.6 || tiefe > 620) continue;
        const quer = dxw * rx + dyw * ry;
        const sy = HORIZONT + (KAM_HOEHE * FOKAL) / tiefe;
        const sx = W / 2 + (quer * FOKAL) / tiefe;
        const skala = Math.min(1.15, 46 / tiefe * 3.2);
        zeichneFahrer(ctx, geistPosen[gi], sx, sy, skala, p.lenk, true);
        if (tiefe < 240) {
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillText(geist.name, sx, sy - 34 * skala);
        }
      }
    }

    // Spieler-Kart: rutscht beim Lenken leicht zur Kurveninnenseite und hebt
    // im Sprung ab — der Schatten bleibt dabei am Boden, DAS verkauft die Höhe.
    const flugAnteil = st.flugRestS > 0 ? st.flugRestS / FLUG_DAUER_S : 0;
    const hoehe = flugAnteil > 0 ? FLUG_HOEHE * 4 * flugAnteil * (1 - flugAnteil) : 0;
    const spielerX = W / 2 + st.lenkGlatt * 16;
    if (hoehe > 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(spielerX, H - 46, 24 * (1 - hoehe / (FLUG_HOEHE * 2.2)), 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    zeichneFahrer(ctx, spielerPosen, spielerX, H - 58 - hoehe, 1.15, st.lenkGlatt, false);

    // Farb-Tacho unten rechts: Füllung = Tempo, Farbe = Zustand.
    zeichneTacho(ctx, st.v, st.turboRestS > 0, st.gebremst);
  }

  raf = requestAnimationFrame(schritt);
  return () => {
    laeuft = false;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', aufPointerDown);
    canvas.removeEventListener('pointerup', aufPointerEnde);
    canvas.removeEventListener('pointercancel', aufPointerEnde);
    window.removeEventListener('keydown', tasteAb);
    window.removeEventListener('keyup', tasteAuf);
  };
}

/** Lineare Interpolation in der Geister-Aufzeichnung. `lenk` (-1…1) wird aus
 *  der Drehrate der aufgezeichneten Blickrichtung geschätzt — damit legen
 *  sich auch die Geister mit der richtigen Pose in die Kurve. */
function geistPosition(s: GhostSamples, zeitMs: number): { x: number; y: number; lenk: number } | null {
  const idx = zeitMs / s.dt;
  const i0 = Math.floor(idx);
  if (i0 >= s.pts.length - 1) return null;  // Geist ist im Ziel — er verschwindet
  const f = idx - i0;
  const a = s.pts[i0], b = s.pts[i0 + 1];
  let dh = (b[2] - a[2]) / 100;              // rad pro Sample
  if (dh > Math.PI) dh -= Math.PI * 2;
  if (dh < -Math.PI) dh += Math.PI * 2;
  const drehRate = dh / (s.dt / 1000);       // rad/s
  return {
    x: (a[0] + (b[0] - a[0]) * f) / 10,
    y: (a[1] + (b[1] - a[1]) * f) / 10,
    lenk: Math.max(-1, Math.min(1, drehRate / LENKRATE)),
  };
}

/** Rollender Baumstamm: Sprite dreht sich mit dem zurückgelegten Querweg —
 *  ohne Sprite eine gezeichnete Walze mit Jahresringen. */
function zeichneStamm(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  x: number, y: number, skala: number, rollwinkel: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(skala, skala);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 8, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (sprite) {
    // Ein liegender Stamm rollt um seine LÄNGSACHSE — die Silhouette bleibt
    // stehen, nur ein leichtes Ruckeln verrät die Bewegung. Volle Rotation
    // sähe aus wie ein Propeller.
    ctx.rotate(Math.sin(rollwinkel) * 0.07);
    ctx.drawImage(sprite, -32, -32, 64, 64);
  } else {
    ctx.rotate(rollwinkel);
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6540';
    ctx.lineWidth = 3;
    for (const r of [6, 12, 17]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

/** Der Farb-Tacho (unten rechts im Bild, Canvas statt React — 60 fps):
 *  Füllbogen = Tempo, Farbe = Zustand. Bernstein fährt, Rot bremst
 *  (Wiese, Pfütze, Taumel), Cyan ist Turbo — man sieht auf einen Blick,
 *  WARUM man gerade schnell oder langsam ist. */
function zeichneTacho(ctx: CanvasRenderingContext2D, v: number, turbo: boolean, gebremst: boolean) {
  const cx = W - 44, cy = H - 36, r = 26;
  const von = Math.PI * 0.75, bis = Math.PI * 2.25;
  const anteil = Math.min(1, v / (V_MAX * TURBO_FAKTOR));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(cx, cy, r, von, bis); ctx.stroke();
  ctx.strokeStyle = turbo ? '#4be3d8' : gebremst ? '#e5484d' : '#e8b34b';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, r, von, von + (bis - von) * anteil); ctx.stroke();
  if (turbo) {
    // Turbo pulsiert als äußerer Ring — Puls aus dem Tempo-Anteil, kein Timer.
    ctx.strokeStyle = 'rgba(75,227,216,0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r + 7, von, bis); ctx.stroke();
  }
  ctx.restore();
}

/** Fahrer zeichnen: fal.ai-Posen wenn geladen, sonst die Canvas-Pfade.
 *
 *  Die Pose folgt dem GEGLÄTTETEN Lenkwert (Rallye-Runde 16.08.2026):
 *  ab |0,3| wechselt das Sprite auf die eingelegte Kurven-Pose, dazu bleibt
 *  eine Rest-Rotation — zusammen liest sich das als echtes Einlenken statt
 *  als gekipptes Standbild. Unter der Schwelle und beim Fehlen der Pose
 *  greift die Geradeaus-Fassung mit Rotation (kein Flackern an der Schwelle,
 *  weil der Lenkwert selbst schon träge ist). */
function zeichneFahrer(
  ctx: CanvasRenderingContext2D,
  posen: SchlittenPosen | null,
  x: number, y: number, skala: number, lean: number, geist: boolean,
) {
  const sprite = !posen ? null
    : lean < -0.3 && posen.links ? posen.links
      : lean > 0.3 && posen.rechts ? posen.rechts
        : posen.gerade;
  if (!sprite) {
    zeichneSchlitten(ctx, x, y, skala, lean, geist);
    return;
  }
  const hatPose = (lean < -0.3 && sprite === posen!.links) || (lean > 0.3 && sprite === posen!.rechts);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(skala, skala);
  // Mit Kurven-Pose reicht eine kleine Rest-Rotation; ohne sie trägt die
  // Rotation den ganzen Effekt.
  ctx.rotate(lean * (hatPose ? 0.06 : 0.14));
  ctx.globalAlpha = geist ? 0.45 : 1;
  // Kein zusätzlicher Schatten: das fal.ai-Sprite bringt seinen eigenen
  // Boden-Tupfer mit — ein zweiter darunter sah wie ein Druckfehler aus.
  // 76×76-Box, Unterkante knapp unterm Ankerpunkt (wie die Pfad-Fassung).
  ctx.drawImage(sprite, -38, -62, 76, 76);
  ctx.restore();
}

/** Der Saunatuch-Schlitten — Rückansicht, reine Canvas-Pfade.
 *  `lean` (-1…1) kippt ihn beim Lenken; `geist` rendert durchscheinend. */
function zeichneSchlitten(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, skala: number, lean: number, geist: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(skala, skala);
  ctx.rotate(lean * 0.14);
  ctx.globalAlpha = geist ? 0.42 : 1;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 12, 26, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Saunatuch (das Fahrzeug): gerollter Bug + Streifen.
  ctx.fillStyle = geist ? '#9fc4e8' : '#e8ddc8';
  rund(ctx, -26, -2, 52, 14, 6); ctx.fill();
  ctx.fillStyle = geist ? '#7ba7d0' : '#c8b898';
  ctx.fillRect(-26, 3, 52, 3);
  ctx.fillStyle = geist ? '#6a96c0' : '#b04a3a';
  ctx.fillRect(-26, 7, 52, 2.5);

  // Figur: Rücken, Kopf, Filzhut — die Sauna-Silhouette.
  ctx.fillStyle = geist ? '#b8d4ee' : '#d9a06b';
  rund(ctx, -12, -26, 24, 26, 9); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = geist ? '#dcebf8' : '#f0ead8';
  ctx.beginPath(); ctx.ellipse(0, -38, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -41, 6, Math.PI, 0); ctx.fill();

  // Aufguss-Dampf hinterm Schlitten (zwei Tupfer, kein Animations-Loop —
  // die Bewegung des Bodens verkauft die Geschwindigkeit).
  if (!geist) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-20, 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 11, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function rund(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Schwarzwald-Silhouette für den Horizont — einmal gezeichnet, dann nur noch
 *  horizontal gescrollt. */
function bauPanorama(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 60;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#16241d';
  let x = 0;
  let i = 0;
  while (x < c.width) {
    // Deterministische „Zufalls"-Tannen, damit das Band nahtlos kachelt.
    const h = 22 + ((i * 37) % 23);
    const b = 16 + ((i * 53) % 14);
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x + b / 2, 60 - h);
    ctx.lineTo(x + b, 60);
    ctx.closePath();
    ctx.fill();
    x += b * 0.62;
    i++;
  }
  return c;
}

function packFarbe(r: number, g: number, b: number): number {
  // Canvas-ImageData ist plattformabhängig little-endian: ABGR im Uint32.
  return (255 << 24) | (b << 16) | (g << 8) | r;
}
