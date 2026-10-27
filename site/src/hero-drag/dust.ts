// v1 AmbientStage dust (site/src/components/temporal-drag/AmbientStage.tsx), the effect body verbatim:
// motes rise and twinkle while the scene is live, paused when its lane is idle/exited or hidden.
import { raf as requestAnimationFrame, cancel as cancelAnimationFrame } from './values';
import type { AnimatePhase, MotionValue } from './values';

interface Mote {
  x: number;
  y: number;
  z: number;
  drift: number;
  rise: number;
  twinkle: number;
}

export function mountDust(canvas: HTMLCanvasElement, phase: MotionValue<AnimatePhase>): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

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

  const inactive = (next: AnimatePhase): boolean => next === 'idle' || next === 'exited';
  let raf = 0;
  let phasePaused = inactive(phase.get());
  let hidden = document.visibilityState !== 'visible';
  let last = performance.now();

  const tick = (now: number): void => {
    raf = 0;
    if (phasePaused || hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (const mote of motes) {
      mote.x += (mote.drift * dt) / width;
      mote.y -= (mote.rise * (0.4 + mote.z) * dt) / height;
      if (mote.y < -0.02) {
        mote.y = 1.02;
        mote.x = Math.random();
      }
      if (mote.x < -0.02) mote.x = 1.02;
      if (mote.x > 1.02) mote.x = -0.02;

      const shimmer = 0.5 + 0.5 * Math.sin(now / 900 + mote.twinkle);
      ctx.globalAlpha = (0.05 + mote.z * 0.18) * shimmer;
      ctx.fillStyle = '#ece3d0';
      ctx.beginPath();
      ctx.arc(mote.x * width, mote.y * height, 0.6 + mote.z * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (raf || phasePaused || hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stop = (): void => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const applyPhase = (next: AnimatePhase): void => {
    phasePaused = inactive(next);
    if (phasePaused) stop();
    else start();
  };
  const onVisibility = (): void => {
    hidden = document.visibilityState !== 'visible';
    if (hidden) stop();
    else start();
  };

  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribePhase = phase.on('change', applyPhase);
  start();

  return () => {
    stop();
    unsubscribePhase();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
