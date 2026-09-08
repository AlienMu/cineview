import { Animate } from 'cineview';
import { memo, type ReactNode } from 'react';
import { useTemporalMotion } from './TemporalMotion';

// Scene 02 — the light rig BEHIND the particle slate.
//
// What this replaces: a static `.s02-set` block whose key light was a
// `clip-path: polygon(...)` cone with `filter: blur(9px)`. CSS applies the filter
// first and clips afterwards, so the blur was sliced off along two straight lines —
// that pair of hard diagonals was the "crude lighting with sharp edges" read. The whole block
// was also completely static (no continuous motion) and everything in it sat in the
// same focal plane (1px hairlines, crisp type), so the frame had no depth.
//
// Framework first (AGENTS.md rule 6). Everything temporal here belongs to CineView:
//   - enter / exit are `<Animate>` variants, so each layer is drag-scrubbed, plays out
//     its remainder on release and reverses on a backward drag;
//   - settled light is intentionally static. A real-browser profile showed that continuously
//     transforming the full-frame masked beam over the other gradients doubled p95 frame time.
// Nothing here imports framer-motion, spawns a rAF, or holds React state per frame.
//
// The framework does not draw, so the *shapes* are CSS (soft conic/radial gradients +
// gradient masks, no clipping anywhere) and the depth-of-field is a STATIC blur on the
// far layers — static so it is rasterised once instead of being re-filtered per frame.
// Only opacity/transform are animated.

export type Act2LightLayerSpec = {
  id: string;
  className: string;
  /** Enter start state; the resting state is always opacity 1 / no transform. */
  from: Record<string, number | string>;
  /** Exit target. Light dissolves upward/outward, the floor pool contracts. */
  exit: Record<string, number | string>;
  enterMs: number;
  /** Exit budget, held at 40-50% of this layer's own enter.
   *
   *  It used to be 380-700ms against enters of 3400-7000ms — a ratio of about 1:10. Under
   *  drag that is not a fade, it is a cut: the exit is scrubbed by the same gesture as the
   *  enter, so a budget that small is consumed in a frame or two of finger travel and the
   *  whole rig blinks out while the board is still leaving. Reversing an entrance should
   *  cost a comparable fraction of the gesture, hence the fixed ratio. */
  exitMs: number;
  delayMs: number;
  children?: ReactNode;
};

/** The set hardware's own 1100ms entrance. Kept separate from the board gate below: the board
 * now starts when this layer is halfway visible, not when it has completely landed. */
export const ACT2_LIGHT_GATE_MS = 1100;
export const ACT2_LIGHT_SET_DELAY_MS = 260;

/** Scene-clock instant at which the set layer reaches 50% of its entrance. This is the board's
 * single source of truth, so changing the light delay or duration cannot desynchronise it. */
export const ACT2_BOARD_GATE_MS = ACT2_LIGHT_SET_DELAY_MS + ACT2_LIGHT_GATE_MS * 0.5;

// Painted back-to-front: atmosphere → hardware silhouettes → key beam → floor pool →
// out-of-focus specks nearest the lens.
//
// There is no head-spill layer. It was measured as the single biggest contributor to the
// reported visible layering: with luminance smoothed over a 10px baseline (390x844, band =
// cssY 14-32 vs floor = cssY 44-58), the band-to-floor step was 7.39 with all layers on,
// 4.94 with the spill stretched to 70% vertical radius, and 3.76 with the spill hidden
// outright. Deleting it is therefore better than the tuned version, and it does not bring
// back the flat-void problem the layer was added for — haze still supplies the gradient and
// the ground plane.
//
// Budgets are 1100-4900ms and deliberately NOT all equal. The element clock advances 10ms
// per 1% of drag (framework default scale) and commit fires at 15-32%, so a gesture spends
// only 150-320ms of element time before the act lands: essentially all of every ramp plays
// out AFTER landing, at real time, via useElementTrack's settle. The two jobs that set the
// spread, and they pull in OPPOSITE directions — which is why the numbers are not uniform:
//  - SET (short): the board starts at `ACT2_BOARD_GATE_MS`, exactly halfway through this
//    layer's entrance. Both values derive from the same delay and duration constants. This
//    layer alone was cut
//    2800 -> 1600 (to buy the countdown its 720ms/numeral) and then 1600 -> 1100 (to speed up
//    the act's opening) — see the constant's own note above; it is the ONLY layer that moved
//    either time, because it is the only one the gate depends on.
//  - VISIBLE RAMP (long): beam/pool/haze/bokeh stay far longer than the gate (4800-4900ms,
//    unchanged) so the light is still measurably brightening after the board appears. When
//    every layer finished at the gate the rig was ~90% up at landing and a pixel probe could
//    barely see it rise — the "no light entrance animation" report. Shortening these to match
//    the new gate would re-introduce exactly that, so the compression was deliberately NOT
//    spread across them: the four ambient layers now simply overlap the board's gather, which
//    is what keeps the act from reading as two discrete slideshow steps.
//
// The settled composition is static. Profiling at 1440x900 showed that continuously
// transforming the masked beam over the other full-frame gradients drops p95 frame pacing
// from ~17ms to ~33ms even though each layer is cheap in isolation.
export const ACT2_LIGHT_LAYERS: Act2LightLayerSpec[] = [
  {
    id: 's02-light-haze',
    className: 's02-light__haze',
    // Fade only, no scale. It used to enter at scale 1.14 and exit at 1.18, and on a layer
    // whose whole substance IS a soft gradient that does not read as atmosphere moving — it
    // reads as a MASK being resized, because the only visible feature is the gradient's own
    // falloff edge sliding outward. Air does not have an edge to expand.
    from: { opacity: 0 },
    exit: { opacity: 0 },
    enterMs: 4900,
    exitMs: 1960,
    delayMs: 220,
  },
  {
    id: 's02-light-set',
    className: 's02-light__set',
    from: { opacity: 0, y: '3.5%' },
    exit: { opacity: 0, y: '-1.5%' },
    // The set layer. SceneSlate consumes `ACT2_BOARD_GATE_MS`, derived from this layer's delay
    // plus half this duration, so the board begins at exactly 50% visibility.
    //
    // Shortened 2800 -> 1600 -> 1100 across two passes, each time to speed up the act's opening
    // (see the constant's own note for this pass's arithmetic). Nothing is lost from the LOOK of
    // the strike: the stands' fade is a 1.1s ramp instead of a 2.8s one, still starting 260ms in,
    // and the layers that actually carry the key light (beam/pool/haze/bokeh) keep ramping past
    // the gate — see the note above about the visible ramp deliberately outliving it.
    enterMs: ACT2_LIGHT_GATE_MS,
    // 480, cut from 720 WITH the enter rather than as a separate decision. Every lane in this rig
    // holds its exit to 40-50% of its enter (the reversibility budget the contract test states as
    // a rule, not just as a table), and 720 against the new 1100 is 65% — an exit longer than the
    // slide it has to finish inside. 480/1100 is 43.6%, back in the band the other four sit in.
    exitMs: 480,
    delayMs: ACT2_LIGHT_SET_DELAY_MS,
    // No loop: these are rigid stands. Swaying steel would read as an earthquake, not as
    // light. All the movement in this rig is light movement.
    //
    // The viewfinder frame and the `02` scene number that used to sit here are gone with
    // the rest of the scene-labelling chrome: they named the act instead of lighting it.
    children: (
      <>
        <span className="s02-light__stand s02-light__stand--left" />
        <span className="s02-light__stand s02-light__stand--right" />
      </>
    ),
  },
  {
    id: 's02-light-beam',
    className: 's02-light__beam',
    from: { opacity: 0, scale: 0.86, y: '-7%' },
    exit: { opacity: 0, scale: 1.12, y: '-3%' },
    enterMs: 4800,
    exitMs: 1920,
    delayMs: 0,
  },
  // `s02-light-spill` used to sit here — the lamp-head glow at the top of the frame. It is
  // GONE, and that is a measured decision rather than a simplification.
  //
  // The layer was the single largest contributor to the reported visible layering: a bright
  // horizontal stratum across the top of the frame with a visible floor under it. Measured on a
  // settled act 2 (390x844, luminance smoothed over a 10px baseline to remove the scanline's own
  // 3px ripple, band = cssY 14-32 vs floor = cssY 44-58):
  //   all layers on ....... band 41.13  floor 33.74  delta 7.39
  //   spill stretched 70% .. band 40.49  floor 35.55  delta 4.94
  //   spill HIDDEN ......... band 29.81  floor 26.05  delta 3.76   <- best
  // Stretching the gradient (the previous fix) halved the step; deleting the layer beats it
  // outright. The beam and the pool already carry the key light, so nothing else was lost —
  // this is why the removal is pure gain and does not bring the layered read back.
  {
    id: 's02-light-pool',
    className: 's02-light__pool',
    // Fade only, no scale — same reasoning as the haze above. Entering from scale 0.78 made
    // the pool's soft edge sweep outward across the floor, which reads as a spotlight mask
    // opening rather than as a light coming up.
    from: { opacity: 0 },
    exit: { opacity: 0 },
    enterMs: 4900,
    exitMs: 1960,
    delayMs: 160,
  },
  {
    id: 's02-light-bokeh',
    className: 's02-light__bokeh',
    from: { opacity: 0, scale: 1.12 },
    exit: { opacity: 0, scale: 1.14 },
    enterMs: 4900,
    exitMs: 1960,
    delayMs: 300,
    children: (
      <>
        <span className="s02-light__mote s02-light__mote--1" />
        <span className="s02-light__mote s02-light__mote--2" />
        <span className="s02-light__mote s02-light__mote--3" />
        <span className="s02-light__mote s02-light__mote--4" />
      </>
    ),
  },
];

export const SlateLightRig = memo(function SlateLightRig(): import('react').JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="s02-light" aria-hidden="true">
      {ACT2_LIGHT_LAYERS.map((layer) => (
        <Animate
          key={layer.id}
          animateId={layer.id}
          enterAnimation={{ initial: layer.from, animate: { opacity: 1, scale: 1, x: 0, y: 0 } }}
          exitAnimation={{ exit: layer.exit }}
          duration={{
            enter: timing.duration(layer.enterMs),
            exit: timing.duration(layer.exitMs),
          }}
          timeline={{ delay: timing.delay(layer.delayMs) }}
        >
          <div className={`s02-light__layer ${layer.className}`}>{layer.children}</div>
        </Animate>
      ))}
    </div>
  );
});
