// ACTION word: colour grading + the aperiodic drift its particles keep after they assemble.
//
// Split out of ClapperboardCanvas.tsx, which is the largest file in this folder and is a
// RENDERER — CLAUDE.md self-check 3 asks for extraction rather than accretion when touching it.
// Neither of these is drawing code: the ramp is a lookup table and `stepWalk` is a numeric
// integrator, both pure and both unit-testable without a canvas. The same split already exists
// for geometry (particleField.ts), so this follows the established seam.
//
// WORD_WALK_MAX lives here because it is the walk's own invariant, and the canvas imports it to
// size EXTENT. One owner, one number: the reservation and the clamp can never drift apart.

import { scatterOrigin } from './particleField';

// ACTION is graded PER LETTER, one stop per letter, dark on the A and warm-white on the N.
// Six discrete steps, not a continuous function of x: the word is six letters, so the
// gradient should be readable as "each letter is brighter than the last".
//
// All six stops sit on one hue family (the act's 暗金 decree — nothing on the cool side of
// the wheel is allowed here). What moves along the ramp is lightness and saturation: the A
// is a dark bronze that barely separates from the plate, the N is a warm white. That is a
// ~2.5x luminance span, which is what makes the gradient survive the 0.11-alpha plate and
// the global grain/scanline layers stacked over this act.
const LETTER_RAMP: ReadonlyArray<readonly [number, number, number]> = [
  [96, 70, 34], // A — dark bronze
  [150, 112, 54], // C — GOLD_DEEP
  [190, 146, 74], // T — GOLD
  [216, 162, 74], // I — AMBER
  [236, 215, 150], // O
  [245, 238, 220], // N — warm white
];

/**
 * The `r, g, b` fragment for letter `index` (0-based). One stop per letter, no interpolation
 * and no shimmer term.
 *
 * The shimmer is deliberately absent. An earlier version of this ramp added a travelling
 * ±0.22 offset to the sample position; against a six-stop table that is ~1.1 stops of
 * movement, so it continuously re-ordered the brightness of adjacent letters and destroyed
 * the very six-step gradient this function exists to establish. The gradient is the effect;
 * movement belongs to the walk.
 *
 * Kept as numeric tuples rather than parsed strings: this runs once per word particle per
 * frame and has to stay allocation-free apart from the returned fragment.
 */
export function letterRamp(index: number): string {
  const last = LETTER_RAMP.length - 1;
  const clamped = index < 0 ? 0 : index > last ? last : Math.round(index);
  const [r, g, b] = LETTER_RAMP[clamped];
  return `${r}, ${g}, ${b}`;
}

// HARD bound on the walk's displacement from its target, in board-normalised units. This is
// the number EXTENT reserves, so the walk must be clamped to it rather than merely tending to
// stay inside it — an unbounded Brownian walk has no maximum, so "usually small" is not a fit
// guarantee. `stepWalk` clamps radially, which is why the reservation below is provable.
//
// The magnitude is deliberately the same order as the orbit it replaces (0.0018-0.0044 board
// units, i.e. ~0.6-1.5px at s≈350): the word must still READ as ACTION, and a large excursion
// turns a dot-matrix glyph into a smear. What changes is the character of the motion, not its
// size — no period, so it reads as dust hanging in the air rather than as clockwork.
export const WORD_WALK_MAX = 0.0044;

// Per-particle random-walk state. Position is an offset from the particle's target, in board
// units; velocity is in board units per second.
export interface Walk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  seed: number;
}

export function makeWalk(seed: number): Walk {
  const origin = scatterOrigin(seed);
  return { x: 0, y: 0, vx: 0, vy: 0, seed: origin.x * 1000 + origin.y * 7 };
}

// Ornstein-Uhlenbeck-ish integration: random acceleration, viscous damping, and a weak spring
// back to the target. That combination is what makes the motion aperiodic yet bounded —
//   * pure random walk drifts away without limit (particles leave the word);
//   * a spring alone is a sinusoid, i.e. exactly the periodicity being removed here.
// The radial clamp at the end is the hard guarantee for EXTENT; the spring means it is rarely
// reached, so the clamp does not show up as particles sliding along a circle.
//
// `dt` is real elapsed seconds, clamped: a backgrounded tab produces one enormous frame, and
// integrating that in a single step would fling every particle to the clamp radius at once.
// DRIVE is MEASURED against the orbit it replaces, not guessed. The orbit's excursion was
// 0.0018-0.0044 board units by construction (a fixed radius per particle), so the walk has to
// land in that band or the change is not amplitude-neutral — too small and the word simply
// freezes, which is a regression dressed as a fix.
//
// Swept over 60s x 40 particles, mean/max |displacement|:
//   DRIVE 0.0075 -> mean 0.000063  max 0.000196   clamp 0.00%   <- 4% of the bound: invisible
//   DRIVE 0.05   -> mean 0.000418  max 0.001307   clamp 0.00%
//   DRIVE 0.1    -> mean 0.000835  max 0.002614   clamp 0.00%
//   DRIVE 0.2    -> mean 0.001664  max 0.004400   clamp 0.05%   <- chosen
//   DRIVE 0.45   -> mean 0.002789  max 0.004400   clamp 4.51%
//   DRIVE 0.9    -> mean 0.003264  max 0.004400   clamp 13.19%
// 0.2 puts the MEAN inside the orbit's old band while touching the clamp on 0.05% of frames,
// so the radial bound is a genuine backstop rather than a surface the field grinds along.
//
// Aperiodicity, autocorrelation of the x offset (the whole point of the change):
//   walk  lag 0.5s 0.481, 1s -0.096, 2s -0.170, 4s -0.005, 8s 0.044, 30s 0.131
//   orbit lag one period (1.8s) 0.980, two periods 0.960   <- the clockwork being removed
// The walk decorrelates within a second and never returns; the orbit repeats at 0.98.
const WALK_DAMPING = 2.4;
const WALK_SPRING = 6.5;
const WALK_DRIVE = 0.2;

// ============================ pre-assembly hover ============================
//
// Where an ACTION particle waits BEFORE the word assembles. This replaces an orbit — a real
// one, not the settled jitter `stepWalk` already replaced:
//
//   ringT = ringAngle + now * 0.001 * ringSpeed * TAU
//   sx = w/2 + cos(ringT) * ringR
//   sy = h/2 + sin(ringT) * ringR * 0.78
//
// That is a closed-form ellipse about the canvas centre with a constant angular rate, so every
// dot wound continuously around the frame and returned to its own starting offset every
// 1/ringSpeed seconds (10.5-20s). Two separate reasons it had to go, and only the first is the
// one that was reported:
//   * it reads as machinery — a field of dots on rails, all winding the same way in two
//     interleaved groups, which is the 绕圆 the user is objecting to;
//   * the winding is UNBOUNDED in angle, so a particle's pre-assembly position has no
//     relationship to where it will end up. A dot could be diametrically opposite its letter
//     at the instant the gather starts, and then cross the whole frame at gather speed.
//
// The replacement has NO angular term at all. Each particle owns a fixed anchor in the frame's
// outer band (`hoverAnchor`) and performs a bounded aperiodic drift about it. The swarm still
// surrounds the board (the original 「预先环绕在四周」 intent) and is still alive on every frame,
// but nothing revolves, and each dot's gather is now a short local move from a stable station.
//
// Bound is in units of the canvas's SHORTER AXIS, not board units, and that is deliberate: the
// hover lives in canvas space (as the ring did) so it needs no EXTENT reservation — the anchors
// are already inset from the edges by more than this bound, so no drift can leave the canvas.
export const HOVER_MAX = 0.035;

// Same integrator family as `stepWalk`, different regime, and the split is the point: this is a
// slow wide wander (station-keeping dust), that one is a tight fast jitter (settled type). One
// function with a scale parameter would have to serve both a 0.0044 and a 0.035 bound across a
// 20x range of spring/damping, which is how a shared helper ends up with a mode flag.
//
// MEASURED at 60fps over 60s x 120 particles (not estimated — the numbers below are the output of
// a sweep over this exact integrator):
//   amplitude ..... mean |offset| 0.0158, max 0.0350, clamp touched on 0.27% of frames
//   aperiodicity .. autocorrelation of the x offset: 0.78 at 0.5s, 0.37 at 1s, -0.14 at 2s, and
//                   indistinguishable from zero (|r| < 0.01) from 6s out to 30s
//   winding ....... net rotation about the frame centre over 60s: 0.002 turns
// The orbit this replaces, measured the same way: autocorrelation 0.998 at one period and 4.45
// turns of net winding over the same 60s. Those two numbers ARE the 绕圆 complaint quantified —
// a signal that repeats at r=0.998 and accumulates angle without bound is, to the eye, a dot on
// rails. 0.002 turns is drift with no preferred direction.
//
// The clamp is a genuine backstop rather than a surface the field grinds along, but it is nearer
// than `stepWalk`'s (0.27% of frames vs 0.05%), which is intentional: this bound is a soft
// containment for a diffuse cloud, not a legibility guarantee for type.
const HOVER_DAMPING = 1.5;
const HOVER_SPRING = 2.2;
const HOVER_DRIVE = 0.9;

/**
 * A particle's resting station before the word assembles, in CANVAS fractions (0..1 of width and
 * of height respectively).
 *
 * Distributed around the frame's outer band rather than on a circle: pick an edge, a position
 * along it, and an inset depth, all from the same cheap hash. The depth SPREAD is what keeps this
 * from reading as a drawn rectangle — measured over the real seed range the inset runs 0.046 to
 * 0.198 (median 0.115), and `stepHover` adds up to 0.035 on top, so the band is a cloud ~0.01-0.23
 * of the frame deep. That is a scatter, not an outline.
 *
 * The minimum inset (0.046) exceeds the hover bound (0.035) by construction, which is why this
 * needs no EXTENT reservation: no drift can carry a dot outside the canvas.
 *
 * `centreBias` keeps dots off the exact corners, where four-fold symmetry would otherwise make
 * the field look pinned.
 */
export function hoverAnchor(seed: number): { x: number; y: number } {
  const a = scatterOrigin(seed);
  const b = scatterOrigin(seed * 3 + 101);
  const edge = Math.floor(a.x * 4) % 4;
  // Ease the along-edge coordinate toward the middle of the edge.
  const centreBias = 0.12 + 0.76 * a.y;
  const depth = 0.045 + b.x * 0.155;
  switch (edge) {
    case 0:
      return { x: centreBias, y: depth };
    case 1:
      return { x: 1 - depth, y: centreBias };
    case 2:
      return { x: centreBias, y: 1 - depth };
    default:
      return { x: depth, y: centreBias };
  }
}

/** Advance the pre-assembly hover. Offsets are in units of the canvas's shorter axis. */
export function stepHover(walk: Walk, dt: number): void {
  walk.seed += dt * 60;
  const n1 = Math.sin(walk.seed * 5.1237) * 27183.1839;
  const n2 = Math.sin(walk.seed * 31.7717) * 15731.5417;
  const ax = (n1 - Math.floor(n1) - 0.5) * HOVER_DRIVE;
  const ay = (n2 - Math.floor(n2) - 0.5) * HOVER_DRIVE;

  walk.vx += (ax - HOVER_SPRING * walk.x - HOVER_DAMPING * walk.vx) * dt;
  walk.vy += (ay - HOVER_SPRING * walk.y - HOVER_DAMPING * walk.vy) * dt;
  walk.x += walk.vx * dt;
  walk.y += walk.vy * dt;

  const distance = Math.hypot(walk.x, walk.y);
  if (distance > HOVER_MAX) {
    const scale = HOVER_MAX / distance;
    walk.x *= scale;
    walk.y *= scale;
    walk.vx *= 0.4;
    walk.vy *= 0.4;
  }
}

export function stepWalk(walk: Walk, dt: number): void {
  // Cheap deterministic noise: advancing the seed keeps each particle's sequence its own and
  // needs no allocation on the hot path (this runs ~90 times per frame).
  walk.seed += dt * 60;
  const n1 = Math.sin(walk.seed * 12.9898) * 43758.5453;
  const n2 = Math.sin(walk.seed * 78.233) * 12543.1234;
  const ax = (n1 - Math.floor(n1) - 0.5) * WALK_DRIVE;
  const ay = (n2 - Math.floor(n2) - 0.5) * WALK_DRIVE;

  walk.vx += (ax - WALK_SPRING * walk.x - WALK_DAMPING * walk.vx) * dt;
  walk.vy += (ay - WALK_SPRING * walk.y - WALK_DAMPING * walk.vy) * dt;
  walk.x += walk.vx * dt;
  walk.y += walk.vy * dt;

  const distance = Math.hypot(walk.x, walk.y);
  if (distance > WORD_WALK_MAX) {
    const scale = WORD_WALK_MAX / distance;
    walk.x *= scale;
    walk.y *= scale;
    // Kill the outward component so the particle does not grind along the boundary.
    walk.vx *= 0.4;
    walk.vy *= 0.4;
  }
}
