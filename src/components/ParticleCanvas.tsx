import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  opacity: number; maxOpacity: number;
  life: number; maxLife: number;
  type: 'steam' | 'ember';
}

interface ParticleCanvasProps {
  activeSaunaCount: number;
  /** Nichts zeichnen (Joker-Sperre/Nacht). Die Schleife steht dann ganz still. */
  pausiert?: boolean;
}

// Audit 25.09.2026 — die Tafel läuft 24/7 auf schwacher Hardware:
//  • Die Schleife steht still, solange die Tafel unter dem Joker liegt
//    (`pausiert`) oder der Tab verborgen ist. display:none am #root hält
//    requestAnimationFrame NICHT an — vorher lief sie die ganze Nacht mit.
//  • 30 statt 60 Bilder/s; die Bewegung je Bild ist dafür doppelt so groß,
//    das Bild bleibt gleich. Dampf ist langsam, die Hälfte der Arbeit fällt weg.
//  • Das Dampf-Wölkchen wird EINMAL vorgerendert und nur noch skaliert
//    gezeichnet — vorher entstanden pro Bild ~40 neue RadialGradients
//    (≈ 2.400 Objekte/s für den Garbage Collector).
const BILD_MS = 1000 / 30;
const SCHRITT = 2;          // Simulationsschritte je gezeichnetem Bild (60-Hz-Takt beibehalten)
const SPRITE_R = 32;        // Radius des vorgerenderten Dampf-Sprites in px

function dampfSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_R * 2;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(200,220,220,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(SPRITE_R, SPRITE_R, SPRITE_R, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function ParticleCanvas({ activeSaunaCount, pausiert = false }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (pausiert) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const sprite = dampfSprite();
    const intensity = Math.max(0.4, Math.min(1, activeSaunaCount / 3));
    const steamCount = Math.floor(40 * intensity);
    const emberCount = Math.floor(25 * intensity);

    const mkSteam = (scattered = false): Particle => ({
      x: Math.random() * canvas.width,
      y: scattered ? Math.random() * canvas.height : canvas.height + Math.random() * 50,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.3 + Math.random() * 0.5),
      radius: 4 + Math.random() * 6,
      opacity: 0, maxOpacity: 0.06 + Math.random() * 0.12,
      life: scattered ? Math.random() * 150 : 0, maxLife: 120 + Math.random() * 180,
      type: 'steam',
    });

    const mkEmber = (scattered = false): Particle => ({
      x: Math.random() * canvas.width,
      y: scattered ? Math.random() * canvas.height : canvas.height + Math.random() * 30,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(1.2 + Math.random() * 0.8),
      radius: 1.5 + Math.random() * 1.5,
      opacity: 0, maxOpacity: 0.5 + Math.random() * 0.35,
      life: scattered ? Math.random() * 60 : 0, maxLife: 60 + Math.random() * 80,
      type: 'ember',
    });

    const particles: Particle[] = [];
    for (let i = 0; i < steamCount; i++) particles.push(mkSteam(true));
    for (let i = 0; i < emberCount; i++) particles.push(mkEmber(true));

    const EMBER_COLORS = ['#f08020', '#fbbf24', '#ef4444', '#fb923c'];
    let rafId: number | null = null;
    let frame = 0;
    let letztesBild = 0;

    const zeichnen = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame += SCHRITT;

      for (const p of particles) {
        p.life += SCHRITT;
        const t = p.life / p.maxLife;
        p.opacity = t < 0.2
          ? (t / 0.2) * p.maxOpacity
          : t < 0.7
          ? p.maxOpacity
          : ((1 - t) / 0.3) * p.maxOpacity;

        p.x += (p.vx + Math.sin(p.life * 0.04 + p.x * 0.01) * 0.3) * SCHRITT;
        p.y += p.vy * SCHRITT;

        if (p.life >= p.maxLife) {
          const fresh = p.type === 'steam' ? mkSteam() : mkEmber();
          Object.assign(p, fresh);
          continue;
        }

        if (p.type === 'steam') {
          ctx.globalAlpha = p.opacity;
          ctx.drawImage(sprite, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
        } else {
          const flicker = 0.7 + Math.sin(frame * 0.35 + p.x * 0.1) * 0.3;
          ctx.globalAlpha = p.opacity * flicker;
          ctx.fillStyle = EMBER_COLORS[Math.floor((p.x + p.y) * 0.1) % EMBER_COLORS.length];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (zeit: number) => {
      rafId = requestAnimationFrame(tick);
      if (zeit - letztesBild < BILD_MS) return;
      letztesBild = zeit;
      zeichnen();
    };

    const starten = () => {
      if (rafId == null && document.visibilityState !== 'hidden') rafId = requestAnimationFrame(tick);
    };
    const anhalten = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    };
    const sichtbarkeit = () => { if (document.visibilityState === 'hidden') anhalten(); else starten(); };

    starten();
    document.addEventListener('visibilitychange', sichtbarkeit);
    return () => {
      anhalten();
      document.removeEventListener('visibilitychange', sichtbarkeit);
      window.removeEventListener('resize', resize);
    };
  }, [activeSaunaCount, pausiert]);

  // Pausiert: gar keine Fläche — auch kein stehengebliebenes letztes Bild.
  if (pausiert) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
