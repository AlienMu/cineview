import { motion, useTransform, type MotionValue } from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import { useTemporalMotion } from './TemporalMotion';

// Ambient light layer — ACT 1 ONLY (locked spec: 环境光只在第一屏，且随 drag 沉入).
//
// The scenes paint opaque black, so a layer BEHIND them is occluded: this sits
// ABOVE the scenes but below the grain texture and uses mix-blend-mode:screen, so
// it only ADDS light — dark pixels contribute nothing (center type stays crisp)
// while the empty voids fill with a drifting key-light, a slow projector ray sweep,
// and floating dust motes.
//
// It is mounted OUTSIDE the CineView tree (it is chrome, not scene content), which
// means the framework has no phase to gate it against — so the gating is explicit:
// `active` is true only while act 1 is the live scene, and `sink` is the act-1 drag
// progress. Both come from the root, which owns the only place that knows the
// current scene index (onSceneWillChange) . Previously this layer had neither and lit
// all five acts uniformly, which flattened every scene's own lighting — most
// visibly act 2, whose whole point is a single hard key light on the slate.
//
// Sink-on-drag: as the finger carries act 1 out, the whole rig loses intensity and
// scales down slightly, so the room light *sinks into* the scene rather than
// hard-cutting when the scene commits.

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

type AmbientStageProps = {
  /**
   * Sink amount 0..1 — 0 = full room light, 1 = the light has sunk fully into the
   * scene. Driven by the act-1 drag while the finger is down, then tweened to
   * completion by the root across the scene transition.
   */
  sink: MotionValue<number>;
};

export const AmbientStage = memo(function AmbientStage({ sink }: AmbientStageProps): JSX.Element {
  const { reduced } = useTemporalMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // "沉入场景" is a physical read, not a dimmer knob, so the mapping is NOT linear
  // and NOT a uniform shrink. Three things happen together:
  //   - opacity falls away EARLY, so the light leaves with the set rather than after it;
  //   - y pushes DOWN into the frame — the source sinks below the stage;
  //   - the cone contracts toward a point, so the source visibly collapses.
  //
  // Everything here is tuned for the FIRST THIRD of the range, because that is the only
  // part a finger ever drives: commit fires between 0.15 and 0.32 (velocity-dependent
  // threshold), and past that the root's tween finishes the travel. Two review rounds
  // failed on the previous curve for exactly that reason:
  //   - it held bright late ([0,0.5,0.82,1]→[1,0.78,0.42,0.04]), so at mid-sink act 1's
  //     content had already exited while the rig still sat at 0.846 — two thirds of the
  //     frame became an empty amber field with two grey shafts, reading as "the set was
  //     struck and someone left the work-lights on", the exact inverse of the intent;
  //   - travel over the finger-driven span measured 8-21px and 0.6-1.4% scale, i.e. below
  //     perception, so 沉入 WAS a dimmer during the only part the user feels. The 59px
  //     figure only arrived after release.
  // So: opacity front-loaded, and travel/contraction raised enough to register inside
  // that same 0.15-0.32 window (~7-15% of viewport height, 3-7% scale).
  const sinkOpacity = useTransform(sink, [0, 0.25, 0.6, 1], [1, 0.55, 0.2, 0.02]);
  const sinkY = useTransform(sink, [0, 1], ['0%', '22%']);
  const sinkScale = useTransform(sink, [0, 1], [1, 0.82]);

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

  // NOTE: this component no longer decides whether it should exist. The root owns
  // the mount lifetime, because unmounting on the scene-change event is exactly what
  // produced the hard cut: onSceneWillChange fires at the START of the 720ms
  // transition, so at a 15%-threshold release the rig vanished at ~87% opacity with
  // zero frames of falloff. The root now keeps it mounted and tweens `sink` to 1
  // first, unmounting only once the light has actually sunk. Acts 2-5 still get NO
  // ambient wash — the difference is only in HOW act 1's light leaves.
  // The sink transform rides an INNER layer, never .tp-ambient itself. The outer box
  // screen-blends, so transforming it pulled its own edges in from the viewport and that
  // boundary showed up as a hard bright line sliding down the frame (measured 19.6 →
  // 57.6 luminance across 4 device px at the top edge). A straight rectangular edge
  // travelling down the screen is the opposite of a light source sinking into a scene.
  // The outer box also no longer clips (see the CSS): every child already overscans and
  // fades to transparent well before its own edge, so there was nothing for the clip to
  // contain — it only existed to hide edges that the transform then exposed.
  return (
    <div className="tp-ambient" aria-hidden="true">
      <motion.div
        className="tp-ambient__rig"
        // Under reduced-motion the rig keeps the OPACITY sink and drops only the
        // travel (y/scale). Passing `undefined` here — the previous behaviour — left
        // the light at full brightness for the whole drag and then made it vanish at
        // settle, i.e. the harshest possible cut, on the very setting meant to reduce
        // harshness; the locked "随 drag 沉入" read was simply absent there.
        // prefers-reduced-motion is about suppressing SELF-RUNNING motion (the
        // breathing cones, the ray sweep, the dust rAF — all still disabled above and
        // in the CSS media block). A brightness change the user's own finger is
        // driving 1:1 has no vestibular component: there is no travel, no parallax,
        // nothing to induce motion sickness. Removing it did not make the path safer,
        // only worse-looking.
        style={
          reduced ? { opacity: sinkOpacity } : { opacity: sinkOpacity, y: sinkY, scale: sinkScale }
        }
      >
        <div className="tp-ambient__key" />
        <div className="tp-ambient__fill" />
        <div className="tp-ambient__ray" />
        <div className="tp-ambient__ray tp-ambient__ray--2" />
        <canvas ref={canvasRef} className="tp-ambient__dust" />
      </motion.div>
    </div>
  );
});
