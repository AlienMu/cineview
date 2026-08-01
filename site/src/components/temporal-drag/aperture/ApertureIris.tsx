import { Animate, useAnimateTimeline } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from '../TemporalMotion';
import { ApertureCanvas } from './ApertureCanvas';

/**
 * Act 04's back half — the iris that stops down once the ring has closed.
 *
 * ── What this replaces, and why ──────────────────────────────────────────────
 * The corona held this slot: 72 filaments fired OUTWARD from the ring. On real hardware it
 * read as a starburst rather than as light, and it was cut. This is 方案 C in its place: a
 * eight-leaf aperture closing INWARD inside the same barrel. Nothing here travels outward and
 * nothing radiates — the silhouette is eight hard-edged plates converging on a shrinking
 * octagon, which is the opposite reading to the one that failed.
 *
 * ── OWN LANE, not a child of the ring's ──────────────────────────────────────
 * Separate `<Animate>` for the same reason the corona had one: its schedule starts where the
 * ring's ends. The ring is delay 0 + enter 1200, so this lane opens at 1300 — 100ms of clear
 * air past the ring's completion, on the same element clock both lanes read. It runs 2400ms
 * from there, so the act's tSelf stays 1300 + 2400 = 3700ms exactly, unchanged from the
 * corona it replaces (设计档 §4 act 04 lane budget).
 *
 * ── Driven by the lane, never self-running ───────────────────────────────────
 * `timeline.progress` under the drag driver IS the gesture, rescaled: while the finger is
 * down `useElementTrack` pegs the scene's element clock to the drag percentage, and at
 * release the settle animation keeps writing the same MotionValue on to 1. So the iris
 * scrubs with the finger and completes on release without reading the pointer value at all
 * (the trap `EclipseGraphic`'s header documents: raw `dragProgress` resets to 0 at release,
 * which would spring the iris back open at the exact moment it should finish shutting).
 */
function ApertureStage(): JSX.Element {
  const timeline = useAnimateTimeline();
  return <ApertureCanvas progress={timeline.progress} phase={timeline.phase} />;
}

/** 1300 = ring completion (0 + 1200) + 100ms of air. Same slot the corona lane held. */
const IRIS_START_MS = 1300;
/**
 * 900ms — the whole exposure, cut from 2400 (返工:「快门时间太慢了」).
 *
 * This is HALF the fix and it does not work alone. 2400ms was slow, but a faster
 * monotonic stop-down is still a stop-down: `apertureBlades.ts` had `stop` rise 0 → 1 and
 * stay there, so the act ended on a half-shut lens no matter how quickly it got there.
 * The curve is now close → hold → settle at 80% (`shutterCycle`), and 900ms is what makes that
 * curve read as a shutter firing rather than as a slow wink:
 *
 *   close    0.24 x 900 = 216ms   (fast full closure)
 *   shut     0.08 x 900 =  72ms   (the exposure frame)
 *   settle   0.28 x 900 = 252ms   (reopen to 80% closure)
 *   rest     0.40 x 900 = 360ms   (hold at 80% closure)
 *
 * The phase split lives in `apertureBlades.ts` as fractions that sum to 1, so this number is
 * the only place the exposure's total is stated and the four beats cannot drift out of it.
 *
 * ── The act's tSelf moves, deliberately: 3700 → 2200ms ────────────────────
 * The iris was the act's longest lane (1300 + 2400 = 3700), so shortening it re-prices the
 * act's own clock to 1300 + 900 = 2200ms. That is the intended consequence rather than
 * collateral: the exposure IS the act's closing beat, and stretching the act out to 3700 with
 * nothing happening after 2200 would re-introduce the 空等 the budget table exists to prevent.
 * Every other lane is untouched (ring/timecode 0+1200, streams 100+1400, label 240+500), so
 * the ring still closes before the shutter fires — the mechanical order the act depends on.
 */
const IRIS_ENTER_MS = 900;
/**
 * 240ms, the SHORTEST exit budget in act 04 (label 300, ring 380, timecode 400).
 *
 * That is deliberate and it is an ordering handle, not a taste value. The outgoing drag lane
 * ignores per-lane delay entirely — exit localProgress is
 * `clamp(renderProgress * transitionDuration / exitDuration)` — so budget LENGTH is the only
 * way to order an exit, and shorter leaves sooner. The iris is the LAST thing to arrive, so
 * it must be the FIRST to leave, which is also the right mechanical reading: the shutter
 * releases and springs open as the act slides away. Well under the act's 720ms
 * `transitionDuration`, so it is finished leaving before the slide is.
 */
const IRIS_EXIT_MS = 240;

export const ApertureIris = memo(function ApertureIris(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId="s04-aperture"
      // ── ENTER HOLDS opacity 1 ON BOTH ENDS, deliberately ──────────────────
      // Omitting `opacity` would NOT mean "no opacity animation": `getDefaultValue` supplies
      // 0 -> 1 across the whole 900ms budget (animateInterpolation.ts:90-91), which would ghost
      // the blades in over the entire exposure and read as a fade rather than as a mechanism —
      // and worse now than at 2400ms, because the fade would still be climbing while the
      // shutter is already shut. The leaves are metal that was always in the barrel: at
      // progress 0 the geometry parks them as slivers against the barrel wall, so the CLOSING
      // is the entrance and no fade is wanted.
      //
      // No transform either. The canvas resolves every length from its own box, so a `scale`
      // here would fight the drawing instead of adding to it (the same reason the corona lane
      // carried opacity alone), and a `rotate` would double the crank the geometry already
      // turns.
      //
      // ── EXIT opens, then fades ──────────────────────────────────────────────
      // The canvas owns the ordered exit: its first 72% opens from the entrance's terminal
      // 80% closure to fully open, and only the remaining 28% fades its drawn pixels. The
      // framework holder stays opaque so a concurrent host fade cannot hide the mechanism.
      enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
      exitAnimation={{ exit: { opacity: 1 } }}
      duration={{
        enter: timing.duration(IRIS_ENTER_MS),
        exit: timing.duration(IRIS_EXIT_MS),
      }}
      timeline={{ delay: timing.delay(IRIS_START_MS) }}
    >
      {/* Fills the clock box exactly — NO overscan, unlike the corona shell's `inset: -50%`:
          nothing the iris draws reaches outward, so the canvas needs no room past the barrel.
          NOT a blend layer and NOT clipped: blades are opaque metal compositing normally over
          the disc, so §8.4's clipped-screen-layer failure has no surface here (§8.4).

          ── ONE REQUIRED CSS RULE, and it cannot be done from in here ─────────────
          The leaves must paint IN FRONT of the moon's disc: `.s04-eclipse__disc` is a 94%-opaque
          near-black circle covering exactly the barrel area, and the ring's lane
          (`[data-cineview-animate-id='s04-progress-ring']`) carries `z-index: 1`. A lane at
          `auto` loses to 1 no matter the document order, so the iris would render invisible
          behind that disc. The fix has to sit on THIS lane's own wrapper, keyed by animate-id,
          exactly as the corona's did:

            .drag-temporal .s04-clock > [data-cineview-animate-id='s04-aperture'] { z-index: 2; }

          Setting it on the div below instead does NOT work, and that is worth recording so the
          next reader does not "simplify" it back: `Animate` exposes no style/className for its
          wrapper, and the wrapper is a `motion.div` carrying the drag lane's transform stack, so
          it is (or may at any time become) a stacking context — a z-index below it is trapped
          inside and never competes with the ring's. z 2 is the slot the corona lane held: above
          the ring, below the timecode (z 3), which is also the right physical order — shutter in
          front of the sun, readout in front of everything. */}
      <div className="s04-aperture-shell" style={{ width: '100%', height: '100%' }}>
        <ApertureStage />
        <div className="s04-lens-reflections" aria-hidden="true">
          <span className="s04-lens__mark s04-lens__mark--top">CINEVIEW OPTICAL</span>
          <span className="s04-lens__mark s04-lens__mark--left">20-35 MM</span>
          <span className="s04-lens__mark s04-lens__mark--right">T 2.8</span>
          <span className="s04-lens-reflection s04-lens-reflection--broad" />
          <span className="s04-lens-reflection s04-lens-reflection--strip" />
          <span className="s04-lens-reflection s04-lens-reflection--flare" />
        </div>
      </div>
    </Animate>
  );
});
