import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentMember } from '@/lib/api';
import {
  STRECKEN, STRECKE_BY_ID, TEX_SIZE, bauStreckenWelt,
  type KartStrecke, type StreckenWelt,
} from '@/lib/kart/strecken';
import { ladeKartAssets, skinFuer, type KartAssets } from '@/lib/kart/assets';

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
        Daumen links = links lenken · Daumen rechts = rechts · abseits der Bahn wird's zäh
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

  // Sprites je Skin — null = programmatische Zeichnung.
  const spielerSprite = assets.schlitten[spielerSkin] ?? null;
  const geistSprites = geister.map((g) => assets.schlitten[skinFuer(g.member_id, 3)] ?? null);

  // ─── Zustand ───────────────────────────────────────────────────────────
  const start = linie[0];
  const st = {
    x: start.x, y: start.y, richtung: start.winkel, v: 0,
    lenken: 0,
    countdownMs: 3000,
    zeitMs: 0,
    letzterIdx: 0,
    fortschritt: 0,          // in Linien-Indizes, monoton wachsend
    runde: 1,
    fertig: false,
    samples: [] as [number, number, number][],
    naechsteProbe: 0,
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

  function simuliere(dt: number) {
    st.zeitMs += dt * 1000;

    // Oberfläche unterm Kart entscheidet die Höchstgeschwindigkeit.
    const mx = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(st.x)));
    const my = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(st.y)));
    const aufBahn = maske[my * TEX_SIZE + mx] === 1;
    const vmax = aufBahn ? V_MAX : V_MAX_WIESE;

    st.v += (vmax - st.v) * Math.min(1, BESCHL * dt);
    st.richtung += st.lenken * LENKRATE * Math.min(1, st.v / V_MAX) * dt;
    st.x += Math.cos(st.richtung) * st.v * dt;
    st.y += Math.sin(st.richtung) * st.v * dt;

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
    // Himmel + Panorama (scrollt mit der Blickrichtung).
    const panX = Math.floor(((st.richtung / (Math.PI * 2)) % 1 + 1) * panorama.width) % panorama.width;
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

    // Kamera hinter dem Kart.
    const kx = st.x - cos(st.richtung) * KAM_ABSTAND;
    const ky = st.y - sin(st.richtung) * KAM_ABSTAND;
    const fx = cos(st.richtung), fy = sin(st.richtung);
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
        zeichneFahrer(ctx, geistSprites[gi], sx, sy, skala, 0, true);
        if (tiefe < 240) {
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillText(geist.name, sx, sy - 34 * skala);
        }
      }
    }

    // Spieler-Kart, fest im unteren Drittel; Neigung folgt dem Lenken.
    zeichneFahrer(ctx, spielerSprite, W / 2, H - 58, 1.15, st.lenken, false);
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

/** Lineare Interpolation in der Geister-Aufzeichnung. */
function geistPosition(s: GhostSamples, zeitMs: number): { x: number; y: number } | null {
  const idx = zeitMs / s.dt;
  const i0 = Math.floor(idx);
  if (i0 >= s.pts.length - 1) return null;  // Geist ist im Ziel — er verschwindet
  const f = idx - i0;
  const a = s.pts[i0], b = s.pts[i0 + 1];
  return { x: (a[0] + (b[0] - a[0]) * f) / 10, y: (a[1] + (b[1] - a[1]) * f) / 10 };
}

/** Fahrer zeichnen: fal.ai-Sprite wenn geladen, sonst die Canvas-Pfade.
 *  Beide Wege teilen Position, Skala, Lenk-Neigung und Geist-Transparenz —
 *  auf einem Gerät ohne Bilder sieht das Rennen nur schlichter aus, nie
 *  anders in der Physik. */
function zeichneFahrer(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  x: number, y: number, skala: number, lean: number, geist: boolean,
) {
  if (!sprite) {
    zeichneSchlitten(ctx, x, y, skala, lean, geist);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(skala, skala);
  ctx.rotate(lean * 0.14);
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
