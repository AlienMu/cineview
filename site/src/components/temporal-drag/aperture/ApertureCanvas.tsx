/**
 * Act 04 aperture canvas — nine iris leaves stopping down inside the eclipse ring.
 *
 * ── RULE 6 EXEMPTION, DECLARED ───────────────────────────────────────────────
 * AGENTS.md / CLAUDE.md rule 6 bans site components from building their own animation
 * drivers. Self-drawn canvas is the ONE exemption (DESIGN.md §0: a child may read a
 * MotionValue and run its own rAF, zero per-frame setState), and this is that case. Nine
 * leaves whose outline, facet shading and lit edge are all functions of one crank angle
 * cannot be expressed as framework variants: the drag lane animates exactly ten properties
 * (opacity, x, y, scale, rotate, rotateX/Y, skewX/Y, filter) and none of them can change a
 * polygon's vertices. The DOM alternative is nine clipped boxes, which §8.4 rules out — see
 * the containment note below.
 *
 * The exemption is conditional. This canvas lives INSIDE a <Scene>, so it has a framework
 * phase and MUST be gated by it — the `tp-ambient` exemption (global chrome outside every
 * Scene, no phase to gate against) does not apply here. The rAF stops on `exited` / `idle`
 * and restarts on re-entry: `applyPhase` below, the same contract `corona/CoronaCanvas.tsx`
 * and `clapperboard/ClapperboardCanvas.tsx` implement.
 *
 * ── What drives what ─────────────────────────────────────────────────────────
 *  - `timeline.progress` (a MotionValue, read not subscribed-to-React) is this lane's own
 *    enter progress, and it is the ONLY input to the mechanism: it becomes the barrel's crank
 *    angle, and the opening is a projection of that angle (`apertureBlades.ts`). The iris is
 *    therefore scrubbed by the finger and completes under settle, never self-running.
 *  - Wall-clock elapsed drives ONLY the specular travelling round the lit edges — a highlight
 *    on metal, no geometry. That is the act's 防空等 coverage now that the corona is gone:
 *    after act 04's lanes land at 2200ms the iris edges are still catching light.
 *
 * ── §8.4, and how this file avoids it ────────────────────────────────────────
 * §8.4 records that clipping a `mix-blend-mode: screen` layer renders the clip edge itself as
 * a hard bright line once a transform is applied (measured on `tp-ambient`: top-edge
 * luminance 19.6 -> 57.6). Hard-edged blades are precisely the shape that tempts the banned
 * build — `clip-path: circle()` on nine boxes, or `ctx.clip()` to the barrel before filling.
 *
 * Neither appears here. There is no `clip-path`, no `ctx.clip()`, no `ctx.save`/`restore`
 * clip pair, and the host needs no `overflow: hidden`. Containment is structural instead:
 * every vertex `apertureGeometry` can produce is at radius <= `barrel`, a disc is convex, so
 * every segment and curve between those vertices is inside it as well (the proof, including
 * why `OPEN_INRADIUS = cos(pi/9)` is the load-bearing constant, is in `apertureBlades.ts`'s
 * header). The one curved boundary — each leaf's outer edge — is drawn as an explicit
 * `ctx.arc` ON the barrel radius, which is the same circle a clip would have imposed, except
 * it is a filled path edge that antialiases normally rather than a compositing boundary.
 *
 * The host is also NOT a blend layer: unlike the corona, blades are opaque metal occluding
 * the disc, so they composite normally (`source-over`) and §8.4's failure mode has no surface
 * to appear on even if a clip were later added by accident.
 */

import type { AnimatePhase } from 'cineview';
import type { MotionValue } from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import {
  apertureGeometry,
  bladeAxis,
  bladeLambert,
  bladeSpecular,
  bowControlRadius,
  flankControl,
  shutterExitOpacity,
  BLADE_COUNT,
  BLADE_HALF_SPAN,
  BLADE_ROOT_SPREAD_RAD,
} from './apertureBlades';

interface ApertureCanvasProps {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
}

// 2026-08-15 realistic rendering: real aperture blades are near-black tempered steel (neutral-cool, slightly blue-gray tint),
// distinguished from each other by 1px-level bright edges (chamfered metal reflections), not full saturated color.
// Blade bodies are therefore compressed to the #0d-#1a range, separation handed off to the bright edges;
// the only remaining color is low-saturation teal sheen (gradient below), echoing this act's cold extreme.
// Numeric channels avoid parsing CSS strings in the per-blade loop; the static glass
// reflections live in DOM/CSS above canvas.
const EDGE_COOL: readonly [number, number, number] = [176, 205, 212]; // steel catching a teal reflection
const EDGE_HOT: readonly [number, number, number] = [242, 234, 219]; // warm-white chamfer / sunlit rim
const METAL_DARK: readonly [number, number, number] = [13, 14, 16]; // near-black quenched steel
const METAL_LIT: readonly [number, number, number] = [26, 29, 33]; // barely lighter, quenched-blue hint
// Adjacent leaves need a stable value difference in addition to moving Lambert light.
// Without it, one similarly lit pair merges and the nine-leaf iris reads as eight.
const FACET_BASE_TONES = [0.18, 0.42, 0.26, 0.5, 0.22, 0.44, 0.3, 0.54, 0.36] as const;

/** Blade fill opacity. Under 1 so the disc's radial gradient still shows through as the
 *  faintest sheen — the leaves are in front of the sun, and the sun is the light source. */
const BLADE_ALPHA = 0.97;

function mixChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

export const ApertureCanvas = memo(function ApertureCanvas({
  progress,
  phase,
}: ApertureCanvasProps): import('react').JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let bladeSheen: CanvasGradient | null = null;
    let paused = phase.get() === 'exited' || phase.get() === 'idle';
    // Tracked alongside `paused` off the same subscription rather than read inside `draw`, so a
    // frame costs no MotionValue read for it. Exit selects a separate 80%-to-open curve.
    let phaseIsExiting = phase.get() === 'exiting';
    const startedAt = performance.now();

    const draw = (): void => {
      if (width <= 0 || height <= 0) return;
      const raw = progress.get();
      const clampedRaw = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      ctx.clearRect(0, 0, width, height);
      // The lane sits at 0 through its whole delay. Cheap out before any trigonometry —
      // and before painting a wide-open iris over a ring that has not closed yet. Exit has
      // its own 80%-to-open curve, so only its completed frame is empty.
      if ((!phaseIsExiting && clampedRaw <= 0.001) || (phaseIsExiting && clampedRaw >= 0.999)) {
        ctx.globalAlpha = 1;
        canvas.dataset.stop = '0.000';
        canvas.dataset.opacity = phaseIsExiting ? '0.000' : '1.000';
        return;
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const unit = Math.min(width, height);
      const { spin, stop, barrel, inradius, vertexRadius } = apertureGeometry(
        clampedRaw,
        unit,
        phaseIsExiting
      );
      const paintOpacity = phaseIsExiting ? shutterExitOpacity(clampedRaw) : 1;
      ctx.globalAlpha = paintOpacity;
      // Solved once per frame, not per blade: all nine leaves share one opening, so they share
      // one control radius. (Not the wanted midpoint radius — see `bowControlRadius`'s note.)
      const controlRadius = bowControlRadius(inradius);
      const elapsedSeconds = (performance.now() - startedAt) / 1000;

      for (let index = 0; index < BLADE_COUNT; index += 1) {
        const axis = bladeAxis(index, spin);
        // The leading edge spans one NONAGON side: two vertices at +/- 20deg off the axis,
        // both on `vertexRadius` (<= barrel, so inside the disc by construction). Nine of
        // these edges are what make the requested nonagonal opening.
        const leadA = axis - BLADE_HALF_SPAN;
        const leadB = axis + BLADE_HALF_SPAN;
        // The roots sit further round than the edge ends, which is what makes neighbours
        // overlap instead of meeting on a visible seam.
        const rootA = leadA - BLADE_ROOT_SPREAD_RAD;
        const rootB = leadB + BLADE_ROOT_SPREAD_RAD;

        const leadAx = centerX + Math.cos(leadA) * vertexRadius;
        const leadAy = centerY + Math.sin(leadA) * vertexRadius;
        const leadBx = centerX + Math.cos(leadB) * vertexRadius;
        const leadBy = centerY + Math.sin(leadB) * vertexRadius;
        // Control point on the axis at `bowControlRadius`, which apertureBlades derives so the
        // curve's own midpoint lands at `inradius * BLADE_BOW` — bowing INWARD only. Outward
        // is both the failed corona reading and the one way a vertex could leave the barrel.
        // BLADE_BOW is now 0.985, i.e. all but straight: the hole has to stay a crisp polygon,
        // and the CURVE of a leaf lives in its flanks instead (see `flankControl`).
        const bowX = centerX + Math.cos(axis) * controlRadius;
        const bowY = centerY + Math.sin(axis) * controlRadius;

        // The two swept flanks. Rework "the shape needs to be like this": the reference's leaves are scimitars,
        // and that shape comes from the flanks bulging TANGENTIALLY round the barrel — a
        // radially-placed control point only ever yields a straighter or kinkier wedge. Both
        // flanks take the SAME `sweepSign` so the plate curves one way round the barrel rather
        // than mirroring into a symmetric leaf. The sweep scales with `stop`, so parked leaves
        // are flat slivers and the plates visibly bend as they close.
        const flankB = flankControl(centerX, centerY, leadB, rootB, vertexRadius, barrel, stop, 1);
        const flankA = flankControl(centerX, centerY, leadA, rootA, vertexRadius, barrel, stop, 1);

        ctx.beginPath();
        ctx.moveTo(leadAx, leadAy);
        ctx.quadraticCurveTo(bowX, bowY, leadBx, leadBy);
        // Trailing flank out to the barrel wall (curved), the outer arc along it, and the far
        // flank back in (curved). `ctx.arc` here is the leaf's own edge, NOT a clip: same
        // circle, but a filled path boundary that antialiases instead of a compositing edge
        // (§8.4).
        ctx.quadraticCurveTo(
          flankB.x,
          flankB.y,
          centerX + Math.cos(rootB) * barrel,
          centerY + Math.sin(rootB) * barrel
        );
        ctx.arc(centerX, centerY, barrel, rootB, rootA, true);
        ctx.quadraticCurveTo(flankA.x, flankA.y, leadAx, leadAy);
        ctx.closePath();

        const lambert = bladeLambert(axis);
        const bodyAmount = Math.min(1, (FACET_BASE_TONES[index] ?? 0.3) + lambert * 0.35);
        const r = mixChannel(METAL_DARK[0], METAL_LIT[0], bodyAmount);
        const g = mixChannel(METAL_DARK[1], METAL_LIT[1], bodyAmount);
        const b = mixChannel(METAL_DARK[2], METAL_LIT[2], bodyAmount);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${BLADE_ALPHA})`;
        ctx.fill();

        // The lit leading edge, in two passes over the SAME three points (no geometry
        // change): first a soft warm rim — the nine leading edges ARE the opening polygon,
        // so this is where light through the hole lands on the leaf edges, widening and
        // brightening as the iris shuts (`stop`) because the same light concentrates in a
        // smaller opening; then the crisp bevel line, whose brightness is the facet's
        // Lambert term plus the travelling specular. Blade-to-blade separation now lives
        // here, not in the body fill.
        const specular = bladeSpecular(axis, elapsedSeconds);
        const edgeAlpha = (0.12 + lambert * 0.2 + specular * 0.45) * (0.4 + stop * 0.6);
        const rimAlpha = 0.08 + stop * 0.24 + specular * 0.12;
        const channels = specular > 0.45 ? EDGE_HOT : EDGE_COOL;
        ctx.strokeStyle = `rgba(${EDGE_HOT[0]}, ${EDGE_HOT[1]}, ${EDGE_HOT[2]}, ${rimAlpha.toFixed(4)})`;
        ctx.lineWidth = Math.max(2, unit * 0.011);
        ctx.lineCap = 'round';
        // Stroke the leading edge ONLY — re-tracing the same three points rather than stroking
        // the whole path, because a stroked flank would draw a bright line down each overlap
        // seam and a stroked outer arc would ring the barrel, competing with the ring's own arc.
        ctx.beginPath();
        ctx.moveTo(leadAx, leadAy);
        ctx.quadraticCurveTo(bowX, bowY, leadBx, leadBy);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${edgeAlpha.toFixed(4)})`;
        ctx.lineWidth = Math.max(0.75, unit * 0.0035);
        ctx.beginPath();
        ctx.moveTo(leadAx, leadAy);
        ctx.quadraticCurveTo(bowX, bowY, leadBx, leadBy);
        ctx.stroke();
      }

      // One cached optical sheen across the assembled blade surface. `source-atop` confines it
      // to already-painted metal without clipping the canvas or allocating a gradient per leaf.
      if (bladeSheen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = paintOpacity * 0.48;
        ctx.fillStyle = bladeSheen;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = paintOpacity;
      }

      // Published for the acceptance lane so the iris can be asserted from the DOM instead of
      // from a screenshot: `stop` is how far shut it is, `spin` the crank angle that caused it.
      canvas.dataset.stop = stop.toFixed(3);
      canvas.dataset.spin = spin.toFixed(4);
      canvas.dataset.opacity = paintOpacity.toFixed(3);
      canvas.dataset.paused = paused ? '1' : '0';
    };

    const tick = (): void => {
      if (paused) {
        rafRef.current = 0;
        return;
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = (): void => {
      if (!paused && rafRef.current === 0) rafRef.current = requestAnimationFrame(tick);
    };

    // PHASE GATE (rule 6). `exited` / `idle` means act 04 is off screen: stop the rAF rather
    // than leaving nine leaves shading themselves behind whatever act the user is now looking
    // at, and clear the canvas so no frozen iris is left painted on a dead scene.
    const applyPhase = (nextPhase: AnimatePhase): void => {
      paused = nextPhase === 'exited' || nextPhase === 'idle';
      // Set BEFORE the draw below, so the first exit frame uses the dedicated curve and starts
      // at exactly the 80% geometry the entrance left behind.
      phaseIsExiting = nextPhase === 'exiting';
      if (paused) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        if (width > 0 && height > 0) ctx.clearRect(0, 0, width, height);
        canvas.dataset.paused = '1';
      } else {
        draw();
        start();
      }
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bladeSheen = ctx.createRadialGradient(
        width * 0.34,
        height * 0.22,
        0,
        width * 0.48,
        height * 0.5,
        Math.max(width, height) * 0.66
      );
      // 2026-08-15 realistic rendering: sheen compressed from four-stop bright teal gradient (starting at 0.95)
      // to extremely low-saturation cool steel reflection — blade bodies are already near-black, sheen no longer
      // carries "make blades show color" responsibility, only leaves a thin layer of teal environment reflection
      // (echoing this act's cold extreme); outer ring falls to near-black, incidentally tightening the lens barrel toward black.
      bladeSheen.addColorStop(0, 'rgba(150, 190, 198, 0.14)');
      bladeSheen.addColorStop(0.22, 'rgba(64, 155, 168, 0.07)');
      bladeSheen.addColorStop(0.58, 'rgba(12, 30, 34, 0.1)');
      bladeSheen.addColorStop(1, 'rgba(0, 6, 8, 0.45)');
      if (!paused) draw();
    };

    resize();
    // ResizeObserver rather than window.resize: the canvas is a child of `.s04-clock`, whose
    // box follows the copy around it, so it can change size without the window changing
    // (font swap, language toggle, dynamic viewport bars).
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    applyPhase(phase.get());
    const unsubscribePhase = phase.on('change', applyPhase);

    return () => {
      observer.disconnect();
      unsubscribePhase();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [phase, progress]);

  // Sized INLINE rather than from a stylesheet, and that is load-bearing: a bare <canvas> is
  // an inline-block with a 300x150 intrinsic size, so with no CSS present `getBoundingClientRect`
  // below would report 300x150 and the whole iris would be resolved against the wrong box (an
  // ellipse in a letterbox, off-centre in the clock). `display: block` also drops the inline
  // baseline gap. The class is kept as the styling hook for anything cosmetic.
  return (
    <canvas
      ref={canvasRef}
      className="s04-aperture-canvas"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
});
