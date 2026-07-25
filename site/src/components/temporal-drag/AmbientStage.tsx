import { memo, useEffect, useRef } from 'react';
import { useTemporalMotion } from './TemporalMotion';

// Global ambient light layer (2026 rework). The scenes paint opaque black, so a
// layer BEHIND them is occluded — this sits ABOVE the scenes but below the grain
// texture and uses mix-blend-mode:screen, so it only ADDS light: dark pixels
// contribute nothing (center type stays crisp) while the empty voids fill with a
// drifting key-light, a slow projector ray sweep, and floating dust motes.
//
// It is pure decoration (aria-hidden, pointer-events:none) and NOT inside the
// CineView tree, so it persists across every act. Per-scene tint rides the
// inherited --tp-sig custom property, re-read from the active scene by the CSS.

// Dust motes drift continuously on a canvas. Count scales down on small screens.
// The rAF is the ONLY continuous JS work here; the cones/rays are pure CSS.
interface Mote {
  x: number;
  y: number;
  z: number; // depth 0..1 → size + parallax speed
  drift: number; // horizontal drift px/s
  rise: number; // vertical rise px/s (motes float up toward the key light)
  twinkle: number; // phase offset for the alpha shimmer
}

export const AmbientStage = memo(function AmbientStage(): JSX.Element {
  const { reduced } = useTemporalMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const vw = window.innerWidth;
    const count = vw <= 380 ? 34 : vw <= 600 ? 48 : 70;
    const motes: Mote[] = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      drift: (Math.random() - 0.5) * 8,
      rise: 4 + Math.random() * 10,
      twinkle: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let last = performance.now();
    let running = true;
    const onVisibility = (): void => {
      running = document.visibilityState === 'visible';
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = (now: number): void => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (const m of motes) {
        // Drift + rise, wrapping around the viewport so the field never empties.
        m.x += (m.drift * dt) / width;
        m.y -= (m.rise * (0.4 + m.z) * dt) / height;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;

        const px = m.x * width;
        const py = m.y * height;
        const size = 0.6 + m.z * 1.8;
        const shimmer = 0.5 + 0.5 * Math.sin(now / 900 + m.twinkle);
        const alpha = (0.05 + m.z * 0.18) * shimmer;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ece3d0';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div className="tp-ambient" aria-hidden="true">
      <div className="tp-ambient__key" />
      <div className="tp-ambient__fill" />
      <div className="tp-ambient__ray" />
      <div className="tp-ambient__ray tp-ambient__ray--2" />
      <canvas ref={canvasRef} className="tp-ambient__dust" />
    </div>
  );
});
