import { memo, useEffect, useRef } from 'react';
import { type MotionValue } from 'framer-motion';
import type { AnimatePhase } from 'cineview';
import { buildClapperTargets, convergePhase, scatterOrigin } from './particleField';

interface ClapperboardCanvasProps {
  // Progress MotionValue from useAnimateTimeline().progress (v3 §0/§5.4: MotionValue,
  // NOT render-prop number — the canvas reads .get() in its own rAF, zero setState).
  progress: MotionValue<number>;
  // Scene phase: entering/entered drive the staged build; exiting drives the
  // explosion; off-screen (exited/idle) pauses the rAF (v3 §5.6 离屏暂停).
  phase?: MotionValue<AnimatePhase>;
}

// Palette — kept in sync with --tp-sig-* tokens (see [[temporal-drag-palette]]).
const TEAL = '64, 155, 168'; // instrument cyan: board rules / body particles
const WARM = '236, 227, 208'; // warm white: clapper-bar stripe particles

// Staged sub-phases packed into the single 0..1 enter progress. The whole thing is
// ONE drag-scrubbed timeline, split so the beats land in strict order with no gap:
//   SPOT  spotlight rakes in on black.
//   FORM  particles fly from scatter origins and lock onto the board outline.
//   CLAP  the striped stick swings shut — snap = ACTION. Bar particles rotate WITH
//         the rigid stick about its hinge (not orbiting dust).
// Text (eyebrow/title) is a separate waitFor'd Animate, so it appears only AFTER
// this whole enter completes — matching the locked spec.
const SPOT_END = 0.2;
const FORM_START = 0.12;
const FORM_END = 0.62;
const CLAP_START = 0.62;
const CLAP_END = 0.94;
const CONVERGE_LAG_SPAN = 0.22; // matches particleField.convergePhase max lag

const MAX_OPEN_RAD = (34 * Math.PI) / 180; // clapper stick open angle before it claps

// Normalized board layout (mirrors particleField BODY/BAR). Bar particles (the
// striped clapper stick) sit above BAR_SPLIT and hinge at the bar's bottom-left.
const BAR_SPLIT = 0.27;
const HINGE = { x: 0.08, y: 0.24 };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function local(v: number, a: number, b: number): number {
  return clamp01((v - a) / (b - a));
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Clapperboard as a converging particle field (zero assets). Particles scatter in
// from across the frame, magnetize onto the board outline, then the bar particles
// swing shut for the ACTION clap. Reverse/exit blows the whole field apart.
export const ClapperboardCanvas = memo(function ClapperboardCanvas({
  progress,
  phase,
}: ClapperboardCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targets = buildClapperTargets();
    const total = targets.length;
    // Per-particle static data: scatter origin (0..1 across the frame), convergence
    // lag, whether it belongs to the rigid clapper stick, and an explosion vector.
    const parts = targets.map((tp, i) => {
      const so = scatterOrigin(i);
      const isBar = tp.y < BAR_SPLIT;
      // Explosion direction: radial from board center + a seeded jitter so the
      // scatter looks organic rather than a clean starburst.
      const ang = Math.atan2(tp.y - 0.5, tp.x - 0.5) + (so.x - 0.5) * 1.4;
      const speed = 0.7 + so.y * 0.8;
      return {
        tp,
        so,
        isBar,
        lag: convergePhase(i, total),
        ex: Math.cos(ang) * speed,
        ey: Math.sin(ang) * speed,
        warm: isBar,
      };
    });

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

    let paused = false;
    let currentPhase: AnimatePhase = phase ? phase.get() : 'entered';
    const applyPhase = (ph: AnimatePhase): void => {
      currentPhase = ph;
      paused = ph === 'exited' || ph === 'idle';
    };

    // Centered square box the normalized field maps into.
    const boxOf = (): { ox: number; oy: number; s: number } => {
      const s = Math.min(width * 0.8, height * 0.72);
      return { ox: (width - s) / 2, oy: (height - s) / 2, s };
    };

    const draw = (): void => {
      const raw = clamp01(progress.get());
      const exiting = currentPhase === 'exiting';
      ctx.clearRect(0, 0, width, height);

      const { ox, oy, s } = boxOf();
      const cx = ox + s * 0.5;
      const cy = oy + s * 0.5;
      const hingeX = ox + HINGE.x * s;
      const hingeY = oy + HINGE.y * s;

      // ── Focus light: a warm spotlight pool raked onto the board. Ramps in during
      // SPOT, holds through the build, and on exit collapses with the scatter. ──
      const spot = exiting ? 1 - raw : local(raw, 0, SPOT_END);
      if (spot > 0.001) {
        const rad = s * (0.5 + 0.28 * spot);
        const g = ctx.createRadialGradient(cx, cy - s * 0.05, s * 0.04, cx, cy, rad);
        g.addColorStop(0, `rgba(255, 241, 214, ${0.28 * spot})`);
        g.addColorStop(0.5, `rgba(214, 150, 74, ${0.12 * spot})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      // Clap close amount: 0 = open (during FORM), 1 = fully shut (ACTION).
      const clap = local(raw, CLAP_START, CLAP_END);
      const openAngle = MAX_OPEN_RAD * (1 - easeOutCubic(clap));

      // Particle appearance gate — hold the field dark until the spotlight is set,
      // then fade the dots in as they converge.
      const appear = local(raw, FORM_START - 0.02, FORM_START + 0.1);
      const cosA = Math.cos(-openAngle);
      const sinA = Math.sin(-openAngle);
      const explodeDist = s * 1.15;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        // Board-space target in device px.
        let tx = ox + p.tp.x * s;
        let ty = oy + p.tp.y * s;
        // Bar particles rotate with the rigid stick about the hinge.
        if (p.isBar) {
          const dx = tx - hingeX;
          const dy = ty - hingeY;
          tx = hingeX + dx * cosA - dy * sinA;
          ty = hingeY + dx * sinA + dy * cosA;
        }

        let x: number;
        let y: number;
        let alpha: number;

        if (exiting) {
          // Blow the assembled board apart, following the finger (raw scrubs).
          const e = easeOutCubic(raw);
          x = tx + p.ex * explodeDist * e;
          y = ty + p.ey * explodeDist * e;
          alpha = (1 - raw) * (1 - raw);
        } else {
          // Converge: fly from scatter origin onto the (possibly rotated) target.
          const pconv = clamp01(
            (local(raw, FORM_START, FORM_END) - p.lag) / (1 - CONVERGE_LAG_SPAN)
          );
          const e = easeOutCubic(pconv);
          const originX = p.so.x * width;
          const originY = p.so.y * height;
          x = originX + (tx - originX) * e;
          y = originY + (ty - originY) * e;
          alpha = appear * (0.3 + 0.7 * pconv);
        }

        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${p.warm ? WARM : TEAL}, ${alpha})`;
        const sz = p.warm ? 2.1 : 1.7;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }

      // ── ACTION flash: a bright rake across the bar the instant it snaps shut. ──
      if (!exiting && clap > 0.88) {
        const f = (clap - 0.88) / 0.12;
        ctx.strokeStyle = `rgba(255, 245, 224, ${f})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + 0.06 * s, oy + 0.16 * s);
        ctx.lineTo(ox + 0.94 * s, oy + 0.16 * s);
        ctx.stroke();
      }
    };

    let unsubscribePhase: (() => void) | undefined;
    if (phase) {
      applyPhase(phase.get());
      unsubscribePhase = phase.on('change', applyPhase);
    }

    const tick = (): void => {
      if (!paused) draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      unsubscribePhase?.();
      cancelAnimationFrame(rafRef.current);
    };
  }, [progress, phase]);

  return <canvas ref={canvasRef} className="s02-clapper-canvas" aria-hidden="true" />;
});
