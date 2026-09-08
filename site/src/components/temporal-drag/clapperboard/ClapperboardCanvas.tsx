import { memo, useEffect, useRef } from 'react';
import { type MotionValue } from 'framer-motion';
import type { AnimatePhase } from 'cineview';
import {
  BOARD_GEOMETRY,
  buildClapperTargets,
  buildCountdownDigit,
  buildWordDecorTargets,
  buildWordTargets,
  convergePhase,
  countdownGlyphRect,
  HINGE,
  scatterOrigin,
  WORD_BAND,
  WORD_DECOR_BOX,
} from './particleField';
import {
  CLAPPER_BOARD_DOT_PAD,
  CLAPPER_EXTENT,
  CLAPPER_MAX_OPEN_RAD,
  CLAPPER_WORD_DOT_PAD,
} from './fitGeometry';
import { hoverAnchor, letterRamp, makeWalk, stepHover, stepWalk } from './wordMotion';

interface ClapperboardCanvasProps {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
}

// Dark-gold grade only. The teal that used to colour the body/value particles is
// gone by decree ("change colour to dark gold, no teal"): three golds plus a warm white
// highlight, nothing on the cool side of the wheel.
const GOLD_DEEP = '150, 112, 54';
const GOLD = '190, 146, 74';
const WARM = '236, 227, 208';
const AMBER = '216, 162, 74';

// ============================ act 2 board budget ============================
//
// The board's enter budget lives HERE, not in SceneSlate, and the durations are authored in
// MILLISECONDS with the TOTAL as their sum — the arrow is
// deliberately this way round rather than "budget, then fractions of it". The budget is exported
// and SceneSlate consumes it, so the file that owns the beats owns the total, and the no-slack /
// no-overflow property is structural instead of something a comment has to promise: the segments
// cannot fail to fill the enter, because the enter IS what they add up to. There is no second
// number left for them to disagree with.
//
// Sub-segment durations, in ms of element-clock time. Every segment starts on the frame the
// previous one ends (each boundary below is chained off its predecessor), so no interval exists
// in which nothing is happening.
export const ACT2_BOARD_TIMING_MS = {
  form: 620,
  settle: 240,
  countBeat: 720,
  countChars: ['3', '2', '1'] as const,
  reform: 100,
  clap: 180,
  word: 260,
} as const;

// 620, cut from 900 (rework: "continue to speed up act2 board entrance time, accelerate particle fade-in scale animation"). This is the
// convergence itself — scattered dust walking into the open slate — and it is the segment the
// entrance speed IS. The particle-level ramps nested inside it (APPEAR_MS, SWARM_IN_*) were cut
// in the same proportion; they have to move together, because they are windows INSIDE this
// number and leaving them at 300/200-700 against a 620ms form would put the swarm's fade-in
// (700) past the end of the convergence it is supposed to precede.
const FORM_MS = ACT2_BOARD_TIMING_MS.form;
/**
 * The BOARD IS FULLY ASSEMBLED AND STILL. New segment, and it is the whole of
 * "must fully display before executing countdown".
 *
 * The countdown used to start on the exact frame the convergence ended — `COUNT_BEATS[0].start`
 * was `FORM_END` — so the last particles to arrive were immediately recruited into the numeral
 * "3". The board was therefore never seen as a board: assembly handed straight over to
 * re-assembly, and the object the act is about existed for zero frames.
 *
 * That is not a lead-in gap of the kind act 02's archived "countdown end stutter" was about (that was a
 * 0.01 boundary gap in which `countIndex` fell to -1 mid-countdown and the geometry jumped a
 * frame). Here -1 is the CORRECT state and the geometry is continuous through it: `form` is
 * clamped at 1 across this whole window, so every particle holds the board position it just
 * reached and nothing moves. The stillness is the point.
 *
 * 240ms ≈ 6 frames at 25fps — long enough to read as a held frame rather than a hesitation.
 */
const SETTLE_MS = ACT2_BOARD_TIMING_MS.settle;
// 720ms per numeral — the authored read speed for a 3-2-1, restored from the 216ms the
// fraction map had decayed to. This is the number the whole budget is built around: 3 x 720
// = 2160ms is 60% of the enter, so everything else had to be sized around it rather than the
// other way round.
const COUNT_BEAT_MS = ACT2_BOARD_TIMING_MS.countBeat;
const COUNT_BEAT_CHARS = ACT2_BOARD_TIMING_MS.countChars;
const REFORM_MS = ACT2_BOARD_TIMING_MS.reform;
const CLAP_MS = ACT2_BOARD_TIMING_MS.clap;
const WORD_MS = ACT2_BOARD_TIMING_MS.word;

/**
 * The board's enter budget: 620 + 240 + 3x720 + 100 + 180 + 260 = 3560ms.
 *
 * Rework: 3600 -> 3560, and note WHAT moved. The convergence was cut 900 -> 620 ("continue to speed up act2 board
 * entrance time") and a 240ms held-board beat was added after it ("must fully display before executing countdown"), so the
 * entrance is 280ms faster while the countdown itself is untouched at 720ms/numeral. The two
 * changes are near-offsetting by arithmetic, not by design — the total is a consequence of the
 * table, which is the whole reason the sum is written as an expression over it.
 *
 * ── 3560 IS NOT A SHORTFALL AGAINST ANY CEILING ───────────────────────────
 * Stated explicitly because the arithmetic invites a wrong repair. An earlier revision of this
 * lane read `gate 1600 + board 3600 = 5200 = tSelf`, and against THAT equation 3560 looks like
 * 40ms of dead air to be padded back. It is not, for two independent reasons:
 *
 *  1. The gate is no longer 1600. It was cut 1600 -> 1100 by the same rework that cut the
 *     convergence (see `ACT2_LIGHT_GATE_MS` in SlateLightRig), so the chain is 1100 + 3560 =
 *     4660. Padding the board to 3600 would give 4700, which matches nothing.
 *  2. `gate + board` was never the act's tSelf in the first place — it is one chain among the
 *     act's lanes. tSelf is `max(delayMs + enterMs)` over ALL lanes, and the binding lane is the
 *     bokeh ambient at 300 + 4900 = 5200. The 5200 the old comment attributed to gate + board was
 *     that number, reached by a different route. The ambient layers deliberately outlast the
 *     board (they keep brightening under the countdown), so the board finishing at 4660 leaves
 *     no dead air: 540ms of key-light ramp is still playing.
 *
 * So this total is DERIVED and free to move with the table. The invariant the suite pins is the
 * sum being an expression over the segments (no second literal to drift), plus the gate/ambient
 * ORDERING relations — not any particular round number.
 *
 * Consumed by SceneSlate as the `<Animate duration.enter>` for the board lane, which is what makes
 * the ms table above literally true — the canvas is driven by `timeline.progress` (0..1 over the
 * enter), so a segment's real duration is its fraction times whatever THIS number is. Previously it
 * was declared in SceneSlate while the fractions were hard-coded here, and that split is the
 * mechanism behind "countdown too fast": cutting the budget 8000 -> 2400 for the `scale: 10` clock re-priced
 * every beat silently, taking the countdown from 720ms/numeral to 216ms without contradicting
 * anything written in either file.
 */
export const BOARD_ENTER_MS =
  FORM_MS + SETTLE_MS + COUNT_BEAT_MS * COUNT_BEAT_CHARS.length + REFORM_MS + CLAP_MS + WORD_MS;

/** ms -> fraction of the enter. The single conversion in this file. */
function seg(ms: number): number {
  return ms / BOARD_ENTER_MS;
}

// Two windows NESTED INSIDE form, not extra segments — they overlap it rather than following
// it, so they are deliberately excluded from the sum above.
//
// APPEAR is the board field's own alpha ramp: "is this field on screen at all", as opposed to
// the convergence term's "has this particle arrived". It is anchored at 0, which is a real
// change and not a transcription: it used to be `local(raw, FORM_START - 0.02, FORM_START + 0.1)`
// against FORM_START = 0.04, so with form now starting at the very first frame of the enter that
// same expression would evaluate to 0.167 immediately — 100+ dots appearing at a sixth of full
// strength in ONE frame instead of fading up from nothing. Anchoring it at 0 is what lets
// FORM_START be 0 without trading the old dead lead-in for a pop.
//
// 200, cut from 300 — "accelerate particle fade-in scale animation". Both windows below were cut in the same ~0.69
// proportion as FORM (900 → 620), and that proportionality is required rather than tidy: they
// are windows INSIDE form, so holding them fixed while form shortens changes their MEANING.
// SWARM_IN_END_MS at its old 700 against a 620ms form is the sharp case — the swarm's fade-in
// would end 80ms AFTER the convergence it is supposed to precede, so the ACTION dust would
// still be fading up while the board was already assembled.
const APPEAR_MS = 200;
// The swarm's fade-in: the ACTION particles are visible as loose dust well before they
// assemble, so the eye has accepted them as part of the scene by the time they move. Inside
// FORM by construction (480 < 620), the same relationship the old pair had (700 < 900).
const SWARM_IN_START_MS = 140;
const SWARM_IN_END_MS = 480;

// Derived fractions. Board particles gather first, from scattered origins into the open slate.
const FORM_START = 0;
const FORM_END = seg(FORM_MS);
const APPEAR_END = seg(APPEAR_MS);
const SWARM_IN_START = seg(SWARM_IN_START_MS);
const SWARM_IN_END = seg(SWARM_IN_END_MS);
// THE HELD BOARD. `form` is clamped at 1 from FORM_END onward, so across this window every
// particle stays exactly where the convergence left it and the assembled slate is simply on
// screen, still. Chained off FORM_END rather than written as its own decimal, like every other
// boundary in this file.
const SETTLE_END = FORM_END + seg(SETTLE_MS);
// 3 -> 2 -> 1, each formed by the value-column particles re-organising, each exactly
// COUNT_BEAT_MS long. Generated rather than transcribed so the three cannot drift apart.
//
// ANCHORED AT SETTLE_END, NOT FORM_END — this is "must fully display before executing countdown" in one token.
// Anchoring at FORM_END is what made the countdown start on the same frame the convergence
// finished, so the board handed straight from assembly into re-assembly and was never seen
// whole. Every beat below is chained off this anchor, so the hold cannot be skipped for one
// numeral and honoured for the others.
const COUNT_BEATS = COUNT_BEAT_CHARS.map((char, index) => ({
  char,
  start: SETTLE_END + seg(COUNT_BEAT_MS * index),
  end: SETTLE_END + seg(COUNT_BEAT_MS * (index + 1)),
}));
// Value particles walk back to the slate's own numbers just before the stick falls.
//
// REFORM_START must EQUAL the last beat's end. It used to be 0.84 against a beat ending at
// 0.83, and that 0.01 gap (160ms of authored time) was the reported "countdown end stutter": inside it
// no beat matches and `raw < REFORM_START`, so countIndex fell to -1 and every value
// particle jumped from the "1" straight back to its slate position in a SINGLE frame. It was
// never a dropped frame — measured max frame time through the whole countdown is 18ms and
// d(progress)/dt is flat at 0.125/s — it was a geometric discontinuity, which reads as a
// jolt precisely because the framerate is fine.
//
// Chaining every boundary off the previous one (rather than writing six independent decimals)
// makes that class of gap unrepresentable.
const REFORM_START = COUNT_BEATS[COUNT_BEATS.length - 1].end;
const REFORM_END = REFORM_START + seg(REFORM_MS);
const CLAP_START = REFORM_END;
const CLAP_END = CLAP_START + seg(CLAP_MS);
// ACTION is particles too, gathering under the board once the stick has landed.
const WORD_START = CLAP_END;
// Chained off WORD_START like every other boundary, rather than written as the literal 1 it
// evaluates to. It is provably 1: BOARD_ENTER_MS is defined as the sum of the same terms this
// chain adds, so the last boundary lands on the total by construction. Writing `1` here would be
// a second statement of that fact, and the whole point of deriving the budget from the table is
// that there is no second statement left to fall out of agreement with the first.
const WORD_END = WORD_START + seg(WORD_MS);

const CONVERGE_LAG_SPAN = 0.18;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function local(value: number, start: number, end: number): number {
  return clamp01((value - start) / (end - start));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

// The stick's fall, 0 = fully open, 1 = shut. This is deliberately NOT easeOutCubic, which
// is what it used to be, and that substitution is the whole "stutter" bug:
//
//   d/dt (1 - (1-t)^3) at t=0  =  3      <- maximum velocity on the very first frame
//
// So the stick sat motionless through the countdown and then, at the frame CLAP_START is
// crossed, jumped straight to its top angular speed. An adversarial audit measured the
// inter-frame pixel delta at the 0.865 boundary as 33-45x the local median (25.4% on phone,
// 11.7 / 10.2 on the laptops) while the frames either side eased smoothly — a velocity step,
// not a dropped frame, which is why frame-time probes kept coming back clean at 17ms.
//
// A clapperboard stick is a rod pivoting under gravity: it starts at rest and accelerates
// into the impact. t^2 is that, and it makes the first frame's velocity ZERO, which is
// exactly what the continuity of the countdown → clap handover requires. The hard stop at
// t=1 is the impact itself and is intended — it lands with the flash on the same frame.
function clapFall(value: number): number {
  return value * value;
}

export const ClapperboardCanvas = memo(function ClapperboardCanvas({
  progress,
  phase,
}: ClapperboardCanvasProps): import('react').JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targets = buildClapperTargets();
    const total = targets.length;
    const parts = targets.map((target, index) => {
      const origin = scatterOrigin(index);
      const angle = Math.atan2(target.y - 0.52, target.x - 0.5) + (origin.x - 0.5) * 1.4;
      const speed = 0.72 + origin.y * 0.72;
      return {
        target,
        origin,
        lag: convergePhase(index, total),
        ex: Math.cos(angle) * speed,
        ey: Math.sin(angle) * speed,
        // Filled in below for value-column particles: where this particle sits in
        // each countdown numeral.
        count: null as { x: number; y: number }[] | null,
      };
    });

    // Countdown targets. The digits are built from the board's OWN particles inside the
    // value column ("3 2 1 reassembled from particles"), so nothing is drawn on top of the slate.
    //
    // Recruited: the value glyphs (135 points) AND the grid-rule segments that cross the
    // value column (~135 more). Two reasons: the numeral needs the density to read as a
    // solid digit rather than a dotted ghost — 135 points spread over a 5x7 stencil is
    // visibly thin — and pulling the rules out clears the area the numeral occupies, so
    // the digit is not competing with the furniture it sits on. They walk back when the
    // countdown ends.
    // Only the value glyphs are recruited. The grid rules were recruited too for density,
    // but the user's read was "too many particles, too thick" — the numeral became a slab. 135 points on a
    // single-cell stencil is a light dot-matrix digit, which is what a slate shows.
    const countParts = parts.filter((part) => part.target.role === 'value');
    const digits = COUNT_BEATS.map((beat) => buildCountdownDigit(beat.char, countParts.length));
    countParts.forEach((part, index) => {
      part.count = digits.map((points) => {
        if (!points.length) return { x: part.target.x, y: part.target.y };
        // 1:1 — buildCountdownDigit returns exactly one point per recruited particle.
        return points[Math.min(points.length - 1, index)];
      });
    });

    // ACTION word — its own particle set, drawn under the board. Separate from the board
    // field so it can gather after the clap without disturbing the slate's own particles.
    //
    // Each particle also carries the data for the two motions requested on top of the
    // gather ("add swirl animation and particle gradient animation on canvas, need to use dark gold color"):
    //  - walk: a mean-reverting random walk, so after landing every point keeps drifting
    //    instead of freezing. This REPLACES a circular orbit. The orbit was periodic by
    //    construction — every particle returned to the same offset on a fixed cycle — and a
    //    field of ~90 dots each running its own little circle reads as machinery, not as dust
    //    in the air. The walk has no period at all; see `stepWalk` for the bound that keeps it
    //    inside the space EXTENT reserved.
    //  - grade: WHICH LETTER this particle belongs to, 0..5. The word is graded per letter
    //    (six brightness stops of one hue) rather than as a continuous function of x. The old
    //    version keyed the ramp off `target.x`, which cannot produce six discrete steps: the
    //    inter-letter gaps make the boundaries uneven, so adjacent letters came out nearly the
    //    same colour while a single wide letter spanned two stops. It stays dark-gold to warm
    //    end-to-end — the word used to be flat WARM (#ece3d0), the warm-white NEUTRAL rather
    //    than a gold, which was the reported colour bug.
    const wordTargets = buildWordTargets('ACTION');
    const wordParts = wordTargets.map((target, index) => {
      const origin = scatterOrigin(index + 7919);
      const angle = Math.atan2(target.y - 1.1, target.x - 0.5) + (origin.x - 0.5) * 1.2;
      const speed = 0.6 + origin.y * 0.5;
      return {
        target,
        origin,
        lag: (index / Math.max(1, wordTargets.length)) * 0.28,
        ex: Math.cos(angle) * speed,
        ey: Math.sin(angle) * speed,
        walk: makeWalk(index + 7919),
        // The LETTER INDEX itself, not a 0..1 normalisation of it: LETTER_RAMP has exactly one
        // stop per letter, so the index IS the lookup key. Normalising first and rescaling in
        // the ramp would be two conversions that have to agree, which is the kind of duplicated
        // arithmetic this file has already been bitten by.
        letter: target.letter ?? 0,
        // PRE-ASSEMBLY STATION ("action particles hover around the periphery first, then assemble at the end").
        // Before the word assembles each particle waits in the frame's outer band, so the letters
        // are present as loose dust long before they mean anything — they used to be gated behind
        // `wordIn > 0.005`, so 100+ dots appeared from nothing in one frame (the reported "sudden appearance").
        //
        // The waiting is a fixed anchor plus a bounded aperiodic drift, NOT a circle. What was here
        // before advanced an angle at a constant rate about the canvas centre, i.e. every dot wound
        // around the frame on rails and repeated every 10-20s — the "circular motion" being removed. `hoverAnchor`
        // scatters the stations around the four edges instead, and `stepHover` wanders each one about
        // its own station with no angular term anywhere. See wordMotion.ts for the measured
        // autocorrelation / net-winding numbers.
        anchor: hoverAnchor(index + 7919),
        hover: makeWalk(index + 5011),
      };
    });

    // Set dressing around the word: the two tick rails and the loose dust. Its geometry comes
    // from particleField (buildWordDecorTargets), so this file only draws it — the canvas is
    // already the largest module in the folder and CLAUDE.md self-check 3 asks for extraction
    // rather than accretion when touching it.
    //
    // It shares the word's walk so the dressing breathes with the type instead of sitting
    // dead-still next to moving dots, but at a third of the amplitude: rails read as measured
    // marks, and marks that wander as much as the dust stop reading as a scale.
    const decorParts = buildWordDecorTargets().map((target, index) => {
      const origin = scatterOrigin(index + 2237);
      return {
        target,
        origin,
        // Rails resolve early and together (they are the frame the word lands in); dust
        // trickles in over the whole assembly.
        lag: target.role === 'rule' ? (index % 5) * 0.02 : 0.1 + origin.y * 0.5,
        rail: target.role === 'rule',
        walk: makeWalk(index + 2237),
        // Same pre-assembly treatment as the word, for the same reason: the dressing used to
        // wind around the canvas centre on the identical ellipse (`ringT = origin.x * TAU +
        // now * 0.00005`), so leaving it alone would have kept a second, slower ring turning
        // underneath a word that had stopped orbiting.
        anchor: hoverAnchor(index + 2237),
        hover: makeWalk(index + 3313),
      };
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let drawCount = 0;
    let currentPhase: AnimatePhase = phase.get();
    let paused = currentPhase === 'exited' || currentPhase === 'idle';

    // Fit uses the shared full particle hull from fitGeometry.ts. Geometry generation,
    // rendering, and contract tests therefore consume one calculation.
    const boxOf = (): { ox: number; oy: number; s: number } => {
      // Two different jobs, and conflating them is what made the board look off-centre.
      //
      // SCALE comes from the full hull (EXTENT), which includes the open stick's swing. That
      // is what guarantees nothing is ever clipped, at any point in the sequence.
      //
      // POSITION must NOT come from the same hull. The stick's swing reaches x = -0.083,
      // left of the body, but only while the board is OPEN — which is a few hundred ms of a
      // nine-second act. Centring the hull therefore parked a permanent reservation of empty
      // canvas on the left: measured on the settled frame, 50px of air left of the board
      // against 11px on the right. The eye reads the SETTLED composition, so that is what
      // gets centred: the body plus the word band, i.e. the art that is on screen the rest of
      // the time.
      //
      // The clamp is what keeps both true at once — it slides the origin back if centring the
      // settled art would push any part of the open hull outside the box. So on a wide canvas
      // the board is optically centred, and on a tight one it gives up centring rather than
      // clipping. Fit stays provable; the composition stops paying for a transient pose.
      // The same 0.96 inset on BOTH axes. It used to be width-only, and the missing vertical
      // inset is why the settled board sat bottom-heavy: with height as the binding dimension
      // the hull filled the box exactly, so the clamp below had zero slack, pinned `oy` at its
      // maximum, and centring could not act at all — measured 296 device px of air above the
      // board against 7 below. Insetting height too leaves the clamp room to actually centre.
      const s = Math.min((width * 0.96) / CLAPPER_EXTENT.w, (height * 0.96) / CLAPPER_EXTENT.h);

      const centreOn = (
        lo: number,
        hi: number,
        hullLo: number,
        hullHi: number,
        box: number
      ): number => {
        const origin = (box - (hi - lo) * s) / 2 - lo * s;
        // Keep the whole hull inside [0, box]; when it cannot fit, bias to showing the start.
        const min = -hullLo * s;
        const max = box - hullHi * s;
        return max < min ? min : Math.min(Math.max(origin, min), max);
      };

      const g = BOARD_GEOMETRY;
      return {
        ox: centreOn(
          Math.min(g.left, WORD_BAND.left) - CLAPPER_BOARD_DOT_PAD,
          Math.max(g.right, WORD_BAND.right) + CLAPPER_BOARD_DOT_PAD,
          CLAPPER_EXTENT.minX,
          CLAPPER_EXTENT.minX + CLAPPER_EXTENT.w,
          width
        ),
        // The SETTLED composition now ends at the lower tick rail, not at the word band: the
        // rails are part of the parked picture, so leaving them out of the centring target
        // would centre the band and let the lower rail hang below the optical centre.
        oy: centreOn(
          g.barTop - CLAPPER_BOARD_DOT_PAD,
          WORD_DECOR_BOX.railBottom + CLAPPER_WORD_DOT_PAD,
          CLAPPER_EXTENT.minY,
          CLAPPER_EXTENT.minY + CLAPPER_EXTENT.h,
          height
        ),
        s,
      };
    };

    // NO background of any kind is painted here. The canvas draws particles and the clap
    // flash, nothing else. It used to fill a large radial "key glow" rect, which read on
    // device as a lighter box sitting behind the slate with visible edges — the canvas
    // announcing its own bounds. All lighting belongs to the DOM rig (SlateLightRig),
    // which spans the whole scene and therefore has no box to give away.

    // Last (progress, phase) actually painted. The rAF below runs for the whole
    // time the scene owns the frame, but progress only moves while a finger is
    // scrubbing or a settle/exit tween is flying — once act 2 has landed it holds
    // at 1.0 indefinitely. Redrawing that unchanged state was ~54 full repaints
    // per second of a 1.2Mpx canvas (measured drawCount 131 → 565 over 8 idle
    // seconds) with zero visual difference. Skipping identical frames keeps the
    // loop armed (so the next scrub is picked up on the very next frame) while
    // costing nothing when the value is parked.
    //
    // EXCEPTION: once the ACTION word is on screen it has its own continuous motion
    // (the orbit below), whose input is the clock, not `progress`. Skipping on an
    // unchanged progress would freeze that orbit the instant the drag parks at 1.0 —
    // which is exactly when the word is fully formed and the motion is meant to be
    // seen. So the guard also asks whether anything time-driven is currently visible.
    let lastRaw = -1;
    let lastDrawnPhase: AnimatePhase | null = null;
    let lastNow = 0;

    const draw = (force = false): void => {
      const raw = clamp01(progress.get());
      const now = performance.now();
      // Real elapsed seconds, because the random walk integrates and therefore needs a step
      // size — unlike the orbit it replaces, which was a closed-form function of `now` and so
      // needed none.
      //
      // The clamp is load-bearing in two directions. Upper bound 1/30s: the draw loop is
      // skipped entirely while nothing is time-driven and pauses outright on `exited`/`idle`,
      // so `now - lastNow` can be seconds or minutes across a tab switch or a parked drag.
      // Integrating that in one step would fling every particle to its clamp radius on the
      // first visible frame — the walk would arrive as a pop. Lower bound 0: `lastNow` is 0
      // before the first frame, which would otherwise make dt the page's whole lifetime.
      const dt = lastNow === 0 ? 1 / 60 : Math.min(1 / 30, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      // Time-driven content on screen? The word band qualifies from the moment its particles
      // start SWARMING, not from the moment they assemble. The bound used to be
      // `raw > WORD_START` (0.93), which predates the pre-orbit: the swarm is alive from
      // FORM_START+0.06 (0.10), so any parked drag between 0.10 and 0.93 would have frozen a
      // ring of dots mid-air — a still frame that looks like a rendering bug, and precisely the
      // range a real gesture parks in. Below the swarm's start the canvas is still a pure
      // function of (progress, phase) and idle frames cost nothing.
      const timeDriven = currentPhase !== 'exiting' && raw > SWARM_IN_START;
      if (!force && !timeDriven && raw === lastRaw && currentPhase === lastDrawnPhase) return;
      lastRaw = raw;
      lastDrawnPhase = currentPhase;
      const exiting = currentPhase === 'exiting';
      const form = exiting ? 1 - raw : local(raw, FORM_START, FORM_END);
      const clap = exiting ? 1 : local(raw, CLAP_START, CLAP_END);
      const openAngle = CLAPPER_MAX_OPEN_RAD * (1 - clapFall(clap));

      ctx.clearRect(0, 0, width, height);
      const { ox, oy, s } = boxOf();
      const g = BOARD_GEOMETRY;
      const hingeX = ox + HINGE.x * s;
      const hingeY = oy + HINGE.y * s;
      const bodyLeft = ox + g.left * s;
      const bodyRight = ox + g.right * s;

      // Anchored at FORM_START (= 0) rather than 0.02 before it. The old expression
      // (`FORM_START - 0.02` with FORM_START = 0.04) had 0.02 of lead-in to fade up through;
      // with form starting on the enter's first frame that lead-in is clamped away and the same
      // expression evaluates to 0.167 immediately, i.e. the whole field appears at a sixth of
      // full alpha in one frame. See APPEAR_MS.
      const appear = local(raw, FORM_START, APPEAR_END);
      const cosA = Math.cos(-openAngle);
      const sinA = Math.sin(-openAngle);
      const explodeDist = s * 1.12;

      // Which countdown numeral the value column is currently spelling, and how far it
      // has walked there. `blend` 0 = the slate's own numbers, 1 = the numeral. Beats
      // hand over to each other directly (ease in over the first 45% of the beat, hold
      // for the rest), so 3 → 2 → 1 reads as one continuous re-organisation instead of
      // three separate fades.
      let countIndex = -1;
      let countBlend = 0;
      let countFrom = -1;
      if (!exiting) {
        for (let index = 0; index < COUNT_BEATS.length; index++) {
          const beat = COUNT_BEATS[index];
          if (raw >= beat.start && raw < beat.end) {
            countIndex = index;
            countFrom = index - 1;
            countBlend = easeInOut(
              local(raw, beat.start, beat.start + (beat.end - beat.start) * 0.45)
            );
            break;
          }
        }
        if (countIndex === -1 && raw >= REFORM_START && raw < REFORM_END) {
          // Snap back to the slate's own numbers before the stick falls.
          countIndex = COUNT_BEATS.length - 1;
          countFrom = COUNT_BEATS.length - 1;
          countBlend = 1 - easeInOut(local(raw, REFORM_START, REFORM_END));
        }
      }
      const countChar = countIndex >= 0 && countBlend > 0.02 ? COUNT_BEATS[countIndex].char : '';
      // The numeral's rect in BOARD-NORMALISED units, used below to dim the slate's own
      // furniture underneath the digit. Same source of truth as the drawing and the probes.
      const glyphBoardRect =
        countIndex >= 0 ? countdownGlyphRect(COUNT_BEATS[countIndex].char) : null;

      for (const part of parts) {
        let tx = ox + part.target.x * s;
        let ty = oy + part.target.y * s;
        // Countdown re-organisation, applied BEFORE the rigid-body rotation branch so a
        // value particle's board position and its numeral position are one target.
        if (countIndex >= 0 && part.count) {
          const to = part.count[countIndex];
          const from = countFrom >= 0 && countFrom !== countIndex ? part.count[countFrom] : null;
          const baseX = from ? ox + from.x * s : tx;
          const baseY = from ? oy + from.y * s : ty;
          tx = baseX + (ox + to.x * s - baseX) * countBlend;
          ty = baseY + (oy + to.y * s - baseY) * countBlend;
        }
        if (part.target.bar) {
          const dx = tx - hingeX;
          const dy = ty - hingeY;
          tx = hingeX + dx * cosA - dy * sinA;
          ty = hingeY + dx * sinA + dy * cosA;
        }

        let x: number;
        let y: number;
        let alpha: number;
        if (exiting) {
          const explosion = easeOutCubic(raw);
          x = tx + part.ex * explodeDist * explosion;
          y = ty + part.ey * explodeDist * explosion;
          alpha = Math.pow(1 - raw, 2);
        } else {
          const convergence = clamp01(
            (local(raw, FORM_START, FORM_END) - part.lag) / (1 - CONVERGE_LAG_SPAN)
          );
          const eased = easeOutCubic(convergence);
          x = part.origin.x * width + (tx - part.origin.x * width) * eased;
          y = part.origin.y * height + (ty - part.origin.y * height) * eased;
          alpha = appear * (0.28 + 0.72 * convergence);
        }
        if (alpha <= 0.01) continue;

        const isWarm = part.target.bar || part.target.role === 'label';
        const warmEdge =
          part.target.role === 'hinge' ||
          part.target.role === 'frame' ||
          part.target.x < g.left + 0.045 ||
          part.target.x > g.right - 0.045;
        const counting = part.count !== null && countBlend > 0.02;
        // Clear the numeral's own area of everything that is NOT the numeral.
        //
        // Only the value-text dots (`02`/`01`/`A01`, 135 of them) are recruited into the
        // digit. The three horizontal grid rules span the FULL board width — y = 0.40 /
        // 0.58 / 0.76, and the glyph rect covers y 0.415..0.93 — so two of them run straight
        // through the numeral and stay lit underneath it. Measured on a hold frame: ink
        // inside the glyph rect rises 1079 -> 2417 as the digit forms while ink outside it
        // is unchanged (2769 settled vs 2364 counting), i.e. the digit is drawn correctly
        // and then has ruled lines crossing it. On screen the "3" reads as a numeral with
        // two bars through it, which is what "countdown illegible" comes down to.
        //
        // The fade is distance-based rather than a hard test against the rect: a binary cut
        // would make each rule stop dead at the rect edge and restart on the other side,
        // trading a crossed digit for two amputated lines. Falloff over half a glyph cell
        // reads as the rule passing BEHIND the numeral. It is tied to countBlend, so the
        // furniture is at full strength whenever no digit is formed and returns as the
        // numeral dissolves — this is the "they walk back when the countdown ends" the
        // comment above the recruitment claimed but never implemented.
        let occlusion = 1;
        if (countBlend > 0.02 && part.count === null && glyphBoardRect) {
          const feather = (glyphBoardRect.x1 - glyphBoardRect.x0) / 10;
          const insideX =
            Math.min(part.target.x - glyphBoardRect.x0, glyphBoardRect.x1 - part.target.x) /
            feather;
          const insideY =
            Math.min(part.target.y - glyphBoardRect.y0, glyphBoardRect.y1 - part.target.y) /
            feather;
          const depth = clamp01(Math.min(insideX, insideY));
          occlusion = 1 - 0.88 * countBlend * depth;
        }
        // While counting, the numeral is the subject: its particles grow and take the
        // brightest gold so the digit reads at a glance.
        const size = counting
          ? 1.9 + 0.5 * countBlend
          : part.target.role === 'value'
            ? 2
            : isWarm
              ? 1.95
              : 1.65;
        if (!isWarm && warmEdge) {
          ctx.fillStyle = `rgba(${GOLD_DEEP}, ${alpha * 0.55 * occlusion})`;
          ctx.fillRect(x - size, y - size, size * 2, size * 2);
        }
        const body = counting ? AMBER : isWarm ? WARM : GOLD;
        ctx.fillStyle = `rgba(${body}, ${counting ? Math.min(1, alpha * (1 + countBlend)) : alpha * occlusion})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }

      // ACTION, in particles, under the board. The word ASSEMBLES after the clap
      // (WORD_START), but its particles are on screen long before that, hovering in the frame's
      // outer band (see `anchor`/`hover` above). `wordIn` is the assembly amount only;
      // visibility is independent of it, so nothing pops into existence.
      const wordIn = exiting ? 1 - raw : local(raw, WORD_START, WORD_END);
      // The swarm fades in early (while the board is still forming) and is fully present well
      // before assembly starts, so the eye has already accepted the dots as part of the scene
      // by the time they move. Window is authored in ms (SWARM_IN_*_MS) rather than as an offset
      // from FORM_START, so it keeps its real duration if the budget changes.
      const swarmIn = exiting ? 0 : local(raw, SWARM_IN_START, SWARM_IN_END);
      if (wordIn > 0.005 || swarmIn > 0.005) {
        const explodeWord = s * 0.9;
        for (const part of wordParts) {
          const tx = ox + part.target.x * s;
          const ty = oy + part.target.y * s;
          let x: number;
          let y: number;
          let alpha: number;
          if (exiting) {
            const explosion = easeOutCubic(raw);
            x = tx + part.ex * explodeWord * explosion;
            y = ty + part.ey * explodeWord * explosion;
            alpha = Math.pow(1 - raw, 2);
          } else {
            const gather = easeOutCubic(clamp01((wordIn - part.lag) / (1 - 0.28)));
            // Where the particle is BEFORE it assembles: parked at its own station in the
            // frame's outer band, drifting about it. Deliberately in canvas space, not
            // board-normalised space — the anchors are insets of the canvas box and the drift
            // bound is a fraction of the shorter axis, so the swarm is inside the box by
            // construction and needs no EXTENT reservation (unlike the settled walk, which is
            // in board units and does).
            //
            // NOT an orbit. The previous version advanced an angle at a constant rate about the
            // canvas centre, which wound every dot around the frame on a fixed period — the
            // "circular motion" being removed here. There is no angle in this path at all.
            //
            // Integrated only while the station still influences the position. At gather = 1 the
            // lerp below discards `sx/sy` entirely, so advancing the hover would be ~120 wasted
            // integrations per frame for the whole time the word is parked — which is most of the
            // act. The settled type's motion is `stepWalk`, further down, and that one does run.
            if (gather < 1) {
              stepHover(part.hover, dt);
            }
            const minAxis = Math.min(width, height);
            const sx = part.anchor.x * width + part.hover.x * minAxis;
            const sy = part.anchor.y * height + part.hover.y * minAxis;
            // The gather is a straight interpolation FROM the live swarm point, so assembly
            // starts wherever the dot actually is at that instant. No teleport, and no second
            // origin: the old `part.origin`-based flight path was the thing that made the word
            // appear from nowhere, because it was only ever evaluated once gather > 0.
            x = sx + (tx - sx) * gather;
            y = sy + (ty - sy) * gather;
            // Dim while swarming (background texture), full strength once assembled.
            alpha = Math.max(swarmIn * 0.5 * (1 - gather), gather);
          }
          if (alpha <= 0.01) continue;
          // The word's own continuous life: a mean-reverting random WALK about the target,
          // replacing the circular orbit. Scaled by `gather` so it does not fight the incoming
          // flight path, and by `s` so the amplitude is resolution-independent.
          //
          // Why not the orbit: circling is periodic, and ~90 dots each on its own fixed cycle
          // read as clockwork. Air-borne dust has no period. `stepWalk` keeps the excursion
          // inside WALK_MAX, which is exactly what EXTENT reserved, so the change is amplitude-
          // neutral — nothing new can reach the canvas edge.
          const settled = exiting ? 0 : wordIn;
          if (settled > 0.01) {
            stepWalk(part.walk, dt);
            x += part.walk.x * s * settled;
            y += part.walk.y * s * settled;
          }
          const size = 2.1;
          // Six discrete brightness stops of ONE hue, one per letter (A dark bronze → N warm
          // white). `part.letter` indexes LETTER_RAMP directly.
          //
          // No shimmer term: see letterRamp's note. A travelling offset on the sample position
          // re-orders the brightness of adjacent letters, which destroys the six-step gradient
          // that is the whole point of this table. Colour is the gradient; motion is the walk.
          ctx.fillStyle = `rgba(${letterRamp(part.letter)}, ${alpha})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }

        // Set dressing: tick rails above/below the word plus scattered dust. Drawn after the
        // type and dimmer than it, so it frames the word without competing with it. Same
        // gather/walk treatment, so it arrives with the word rather than being a static plate.
        for (const part of decorParts) {
          const tx = ox + part.target.x * s;
          const ty = oy + part.target.y * s;
          let x: number;
          let y: number;
          let alpha: number;
          if (exiting) {
            const explosion = easeOutCubic(raw);
            x = tx + (part.origin.x - 0.5) * explodeWord * explosion;
            y = ty + (part.origin.y - 0.5) * explodeWord * explosion;
            alpha = Math.pow(1 - raw, 2);
          } else {
            const gather = easeOutCubic(clamp01((wordIn - part.lag) / (1 - 0.28)));
            // Same station-keeping as the word's own particles, for the same reason: this branch
            // held the identical ellipse (a slower one, 0.00005 rad/ms) and would have left the
            // rails and gutter dust winding around the frame after the type stopped — a partial
            // fix that reads as a bug, since the two fields sit in the same band.
            if (gather < 1) {
              stepHover(part.hover, dt);
            }
            const minAxis = Math.min(width, height);
            const sx = part.anchor.x * width + part.hover.x * minAxis;
            const sy = part.anchor.y * height + part.hover.y * minAxis;
            x = sx + (tx - sx) * gather;
            y = sy + (ty - sy) * gather;
            alpha = Math.max(swarmIn * 0.3 * (1 - gather), gather) * (part.rail ? 0.52 : 0.34);
          }
          if (alpha <= 0.01) continue;
          const settled = exiting ? 0 : wordIn;
          if (settled > 0.01) {
            stepWalk(part.walk, dt);
            // A third of the type's amplitude: a measuring rail that drifts as much as the
            // dust stops reading as a rail.
            x += part.walk.x * s * settled * 0.34;
            y += part.walk.y * s * settled * 0.34;
          }
          const size = part.rail ? 1.5 : 1.3;
          ctx.fillStyle = `rgba(${part.rail ? GOLD : GOLD_DEEP}, ${alpha})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }

      // The ACTION hit: the seam flares as the stick lands. Kept at the hinge line
      // (moving it into the stripes used to slice the bar in half).
      if (!exiting && clap > 0.8) {
        const flash = local(clap, 0.8, 1);
        ctx.strokeStyle = `rgba(255, 245, 224, ${flash})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bodyLeft, hingeY);
        ctx.lineTo(bodyRight, hingeY);
        ctx.stroke();
        // A short warm bloom either side of the seam, so the snap registers as impact
        // rather than as a line appearing.
        ctx.strokeStyle = `rgba(${AMBER}, ${flash * 0.45})`;
        ctx.lineWidth = 8 * flash;
        ctx.beginPath();
        ctx.moveTo(bodyLeft, hingeY);
        ctx.lineTo(bodyRight, hingeY);
        ctx.stroke();
      }

      drawCount += 1;
      canvas.dataset.openDeg = ((openAngle * 180) / Math.PI).toFixed(1);
      canvas.dataset.exiting = exiting ? '1' : '0';
      canvas.dataset.progress = raw.toFixed(3);
      canvas.dataset.form = form.toFixed(3);
      // Published for the acceptance probes: which numeral is on the board right now
      // and how fully it has formed. Written, never read by the render.
      canvas.dataset.count = countChar;
      canvas.dataset.countBlend = countBlend.toFixed(3);
      canvas.dataset.word = wordIn.toFixed(3);
      canvas.dataset.drawCount = String(drawCount);
      // The live board box, in CSS px relative to the canvas. Published so acceptance
      // probes can map board-normalised coordinates (WORD_BAND, BOARD_GEOMETRY) to pixels
      // by reading them instead of re-deriving them.
      //
      // This exists because a probe DID re-derive them: act2-word-probe hardcoded a copy of
      // an older boxOf (`s = min(w*0.96, h*0.78)`, oy centred on `s*1.24`). When the extent
      // fix changed the real fit, the probe kept sampling the old band, found the word
      // outside it, and reported "wordReadsAsSixLetters: false" — a false alarm about a
      // regression that had not happened. A duplicated formula is a probe that silently
      // stops testing the thing it names.
      canvas.dataset.boxOx = ox.toFixed(2);
      canvas.dataset.boxOy = oy.toFixed(2);
      canvas.dataset.boxS = s.toFixed(2);
      // The countdown numeral's rect, in CSS px relative to the canvas. Same motivation as the
      // box above, one level finer: a probe that wants to read the digit needs the DIGIT's
      // rect, and the one that guessed a crop of the value column ended up measuring the
      // numeral plus the slate's three ruled rows.
      //
      // Published UNCONDITIONALLY, and that matters. The rect is identical for 3, 2 and 1 —
      // every stencil is 5x7, so countdownGlyphRect returns the same box for each — which is
      // why keying it to "whichever digit is on screen now" bought nothing and cost the
      // legibility probe outright: that probe's baseline frame is deliberately the SETTLED
      // board (no numeral, so the digit-only ink can be isolated by difference). Publishing
      // conditionally deleted the keys on exactly that frame, grabMask returned null, and all
      // nine assertions failed while reporting nothing about the glyphs. A field that a probe
      // needs on a frame where the feature is absent must not be gated on the feature.
      const glyphRect = countdownGlyphRect(COUNT_BEATS[0].char);
      if (glyphRect) {
        canvas.dataset.glyphX0 = (ox + glyphRect.x0 * s).toFixed(2);
        canvas.dataset.glyphY0 = (oy + glyphRect.y0 * s).toFixed(2);
        canvas.dataset.glyphX1 = (ox + glyphRect.x1 * s).toFixed(2);
        canvas.dataset.glyphY1 = (oy + glyphRect.y1 * s).toFixed(2);
      }
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // force: the backing store was just resized and cleared, so the previous
      // frame is gone even though progress has not moved.
      if (!paused) draw(true);
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

    const applyPhase = (nextPhase: AnimatePhase): void => {
      currentPhase = nextPhase;
      paused = nextPhase === 'exited' || nextPhase === 'idle';
      if (paused) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      } else {
        draw();
        start();
      }
    };

    resize();
    // ResizeObserver, not window.resize: the canvas is a stretched child of a grid row
    // whose height follows the copy above/below it, so the box can change without the
    // window changing (font swap, language toggle, dynamic viewport bars). A stale box
    // now also means stale cached light gradients, not just stale particle mapping.
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
  }, [progress, phase]);

  return <canvas ref={canvasRef} className="s02-clapper-canvas" aria-hidden="true" />;
});
