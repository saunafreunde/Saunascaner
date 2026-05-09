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
}

export function ParticleCanvas({ activeSaunaCount }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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
    let rafId: number;
    let frame = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      for (const p of particles) {
        p.life++;
        const t = p.life / p.maxLife;
        p.opacity = t < 0.2
          ? (t / 0.2) * p.maxOpacity
          : t < 0.7
          ? p.maxOpacity
          : ((1 - t) / 0.3) * p.maxOpacity;

        p.x += p.vx + Math.sin(p.life * 0.04 + p.x * 0.01) * 0.3;
        p.y += p.vy;

        if (p.life >= p.maxLife) {
          const fresh = p.type === 'steam' ? mkSteam() : mkEmber();
          Object.assign(p, fresh);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (p.type === 'steam') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          g.addColorStop(0, 'rgba(255,255,255,0.9)');
          g.addColorStop(1, 'rgba(200,220,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const flicker = 0.7 + Math.sin(frame * 0.35 + p.x * 0.1) * 0.3;
          ctx.globalAlpha = p.opacity * flicker;
          ctx.fillStyle = EMBER_COLORS[Math.floor((p.x + p.y) * 0.1) % EMBER_COLORS.length];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    tick();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [activeSaunaCount]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
