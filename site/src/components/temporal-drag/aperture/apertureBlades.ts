/**
 * Act 04 aperture geometry — the eight-leaf shutter that fires one exposure.
 *
 * GEOMETRY ONLY. Nothing here touches a canvas, a MotionValue or the DOM; the drawing
 * lives in `ApertureCanvas.tsx`. Same split as act 02's `particleField.ts` /
 * `ClapperboardCanvas.tsx` and act 03's `waveformField.ts` / `WaveformCanvas.tsx`, for the
 * reason in CLAUDE.md self-check 3: the canvas file stays small enough to read and the
 * geometry stays testable as pure functions.
 *
 * ── 返工: this is now ONE EXPOSURE, not a slow stop-down ──────────────────────
 * 用户原话:「快门时间太慢了，出现的时候需要较快的完全闭拢，然后再分开。来表达进行了一次拍摄。」
 *
 * Two things were wrong and they were separate faults:
 *
 *  1. It never CLOSED. `CLOSED_INRADIUS` was 0.42, so the deepest the iris ever reached was a
 *     42%-of-barrel hole — a lens stopping down, which is an exposure SETTING, not an exposure.
 *     A shutter that never meets in the middle cannot read as a frame being taken. It is now
 *     `FULLY_SHUT_INRADIUS`, small enough that the eight leading edges meet.
 *  2. It was MONOTONIC. `stop` rose 0 → 1 across the lane and stayed there, so the aperture
 *     ended the act shut. The approved gesture is now open → fully shut → reopen to 80%
 *     closure and hold. `shutterCycle` below is therefore non-monotonic and has a stable
 *     terminal value rather than returning fully open.
 *
 * The lane it runs in was also shortened 2400 → 900ms (see `ApertureIris.tsx`); 那 900ms is the
 * whole take. Speed alone would not have fixed it, because a fast slow-stop-down is still a
 * stop-down; the shape of the curve is what carries the reading.
 *
 * ── ONE degree of freedom, and it is still the visible one ───────────────────
 * This is the act-01 idiom («指针带动刻度»): the thing you see moving must BE the cause of the
 * thing you see changing, not a second animation that happens to agree. The chain is unchanged
 * in structure — only its input curve is new:
 *
 *   cycle(p)   = shutterCycle(p)                  <- close, expose, settle at 80%. THE input.
 *   spin(cycle) = asin(cycle) projection          <- the barrel cranks over AND BACK.
 *   stop(spin)  = sin(spin / SPIN_TOTAL * pi/2)   <- crank-slider projection of that rotation.
 *   inradius    = lerp(OPEN, SHUT, stop)          <- the opening, DERIVED from the rotation.
 *
 * Nothing else is animated. Every blade's outline, its facet brightness and its lit edge are
 * pure functions of `spin`. That is why the leaves cannot drift out of agreement with each
 * other or with the barrel: there is no second clock to disagree with. Note the ordering is
 * load-bearing — the cycle drives the SPIN and the spin drives the opening, so when the shutter
 * reopens the barrel visibly cranks back. Deriving `stop` from progress directly and leaving
 * `spin` monotonic would have the leaves retreat while the ring kept turning one way, which is
 * the exact class of "two animations that merely agree" this file exists to prevent.
 *
 * ── EIGHT leaves, curved, octagonal opening (返工: 「形状需要是这样的」) ────────
 * Was six leaves with near-straight flanks. The reference is a stills shutter: eight blades
 * whose bodies sweep as scimitars round the barrel, leaving a clean OCTAGON of light at the
 * centre. Two constants carry that and they are independent:
 *   - `BLADE_COUNT = 8` gives the octagon (the opening's side count IS the blade count).
 *   - `FLANK_SWEEP` bows the trailing flanks, which is what makes a leaf read as a curved
 *     plate rather than a pie wedge. The LEADING edge stays nearly straight (`BLADE_BOW` close
 *     to 1) precisely so the hole stays a crisp polygon — curving both would round the opening
 *     off into a circle and lose the shape being asked for.
 *
 * ── §8.4: no clip, and it is a proof rather than a promise ───────────────────
 * §8.4 («mix-blend-mode: screen 图层不能加 overflow: hidden») bit the corona shell because a
 * clip edge on a blended layer renders as a hard bright line under transform. Blades are the
 * exact shape that invites the same mistake — the obvious build is "a rectangle clipped to a
 * circle", via `clip-path` or `ctx.clip()`.
 *
 * There is no clip anywhere in this module or its canvas, and containment is instead
 * guaranteed by construction: EVERY vertex or control point a blade path can produce lies at
 * radius <= `barrel`, and a disc is convex, so every straight segment, arc and quadratic
 * between those points is inside the disc too. Concretely, the extreme radii are
 *
 *   - the flank roots and the outer arc, which sit exactly ON the barrel (radius = barrel);
 *   - the leading-edge vertices, at `vertexRadius = inradius / cos(pi/8)`, which is at most
 *     `barrel` because `OPEN_INRADIUS` IS `cos(pi/8)` — the fully-open octagon is the one
 *     inscribed in the barrel;
 *   - the flank control points, at `flankControlRadius <= barrel` by construction below.
 *
 * `apertureGeometry` asserts that upper bound in its own arithmetic (see `vertexRadius`), so
 * the invariant is visible at the place it is relied on. The canvas therefore needs no
 * overscan, no blend layer and no clip: nothing it draws can reach the canvas edge.
 */

/** Eight leaves. A real stills shutter is 5-9; eight is what makes the opening an OCTAGON,
 *  which is the shape in the reference, and it divides 360 evenly so the parked (wide-open)
 *  leaves tile the barrel exactly. The opening's side count and this number are the same fact
 *  stated once — there is no separate "octagon" constant to fall out of step with it. */
export const BLADE_COUNT = 8;

/** Half the angular width of one polygon side, radians: pi / BLADE_COUNT = 22.5deg. */
export const BLADE_HALF_SPAN = Math.PI / BLADE_COUNT;

/**
 * Barrel radius as a fraction of `min(canvasWidth, canvasHeight)`.
 *
 * The supplied lens reference needs a real barrel around the glass. The aperture canvas still
 * fills `.s04-clock`, but the blade roots now sit at 36% of its short side, leaving the outer
 * 14% radius for knurl, compression rings, and markings.
 */
export const BARREL_RADIUS_RATIO = 0.36;

/**
 * Octagon inradius, as a fraction of the barrel, with the shutter wide open.
 *
 * This is `cos(pi/8)` and NOT a tuned taste value: it is the inradius at which the octagon's
 * VERTICES sit exactly on the barrel, so the parked leaves are slivers against the barrel
 * wall and no vertex can exceed the barrel. It is the containment proof in the file header.
 */
export const OPEN_INRADIUS = Math.cos(BLADE_HALF_SPAN);

/**
 * Octagon inradius, as a fraction of the barrel, at FULL CLOSURE.
 *
 * 返工: this was `CLOSED_INRADIUS = 0.42`, and 0.42 is why the act never read as a photograph
 * being taken — the leaves stopped a long way short of each other and the frame simply had a
 * smaller hole in it. 「需要较快的完全闭拢」 means the eight edges have to MEET.
 *
 * Not exactly 0, and the reason is mechanical rather than defensive: at 0 every leading-edge
 * vertex collapses onto the centre point, so all eight paths degenerate to zero area on the
 * same frame and the canvas antialiases a shimmering dot. 0.015 of the barrel is ~2px on a
 * 390px-wide phone — visually shut, still a real polygon. The old note here worried about the
 * centre readout being covered; that is now the POINT, and it is covered for ~90ms.
 */
export const FULLY_SHUT_INRADIUS = 0.015;

/** Crank travel across a full closure, radians (~24deg). Enough that the eight lit edges
 *  visibly slew round the barrel — the rotation IS the mechanism, so it has to be seen — and
 *  small enough that it reads as a shutter firing, not as a spinning graphic. Traversed twice
 *  per exposure now: over on the close, back on the release. */
export const SPIN_TOTAL_RAD = 0.42;

/** Angular overlap of adjacent leaves at their roots, radians (~12deg). Real leaves overlap;
 *  without it the eight flanks meet on a seam and daylight shows through the joins. */
export const BLADE_ROOT_SPREAD_RAD = 0.209;

/**
 * Where the leading edge's MIDPOINT sits, as a fraction of the octagon inradius.
 *
 * Under 1 = bowed INWARD (the edge dips toward the centre), which is the only direction
 * allowed: outward bowing is both the failed corona reading and the one way a vertex could
 * escape the barrel.
 *
 * 0.985, i.e. very nearly straight, and it was RAISED from 0.94 as part of the shape rework.
 * The opening has to read as a hard-edged OCTAGON; a 6%-deep dish on each of eight sides
 * rounds the hole off into a circle and throws away the very shape the reference is about.
 * The curved reading now comes from the flanks instead (`FLANK_SWEEP`), which is where a real
 * blade's curve actually is — the edge that forms the hole is straight-ground steel.
 *
 * NOTE this is the midpoint, not the bezier control point; see `bowControlRadius`, which is
 * where the two get confused and where the arithmetic therefore lives.
 */
export const BLADE_BOW = 0.985;

/**
 * How far the trailing flanks sweep, as a fraction of the barrel.
 *
 * This is the constant that makes a leaf a curved plate rather than a pie wedge, and it is
 * what the reference image's shape is: eight scimitars overlapping round the barrel. Each
 * flank is a quadratic from its leading-edge vertex out to its root ON the barrel, with the
 * control point pulled TANGENTIALLY (round the barrel, in the direction the blade sweeps)
 * rather than radially — a radially-placed control point just makes a straighter or kinkier
 * wedge, never a curve.
 *
 * Contained by the same convexity argument as everything else: the control radius is capped at
 * `barrel` in `flankControl` below, so the point is inside the disc and a bezier never leaves
 * its control hull.
 */
export const FLANK_SWEEP = 0.42;

/** Fixed key light, radians. Up and to the left, matching act 02's rig, so the eight facets
 *  differ in brightness and the opening reads as eight plates instead of one ring. */
export const LIGHT_ANGLE_RAD = -Math.PI * 0.75;

/** Radians per second for the specular travelling round the lit edges. ~12.5s a revolution:
 *  slow enough to read as light moving over metal, and it is the act's 防空等 cover — after
 *  tSelf the shutter holds at 80% closure while its eight edges keep catching light. */
export const SPECULAR_RAD_PER_SECOND = 0.5;

/** Tightness of that specular lobe. Higher = a smaller, harder hot spot. */
export const SPECULAR_EXPONENT = 8;

/** Blade 0's axis points at 12 o'clock, where the ring's own dash starts. */
const BLADE_PHASE_RAD = -Math.PI / 2;

// ── The exposure's shape, as fractions of the lane's own budget ──────────────
// One statement of the arithmetic: the three phases are authored as fractions that SUM TO 1,
// and every boundary below is chained off its predecessor, so no gap can exist between them.
// (Act 02's archived 倒计时结束卡顿 was exactly a 0.01 gap between two such boundaries, in
// which no phase matched and the geometry jumped in a single frame.)
//
// The entrance has four explicit phases: close quickly, register one fully-shut frame,
// reopen to the approved resting closure, then hold it. Fractions sum to one by derivation.
const CLOSE_FRACTION = 0.24;
const SHUT_HOLD_FRACTION = 0.08;
const SETTLE_FRACTION = 0.28;
const REST_FRACTION = 1 - CLOSE_FRACTION - SHUT_HOLD_FRACTION - SETTLE_FRACTION;

/** 80% means closure amount: 0 is fully open, 1 fully shut. */
export const RESTING_CLOSURE = 0.8;

/** During exit the blades open first; only the final portion is reserved for the canvas fade. */
export const EXIT_OPEN_FRACTION = 0.72;
const EXIT_FADE_FRACTION = 1 - EXIT_OPEN_FRACTION;

/** Boundaries, derived. `SHUT_START` is where the close ends AND the hold begins — one value,
 *  so a gap between the two is unrepresentable. */
const SHUT_START = CLOSE_FRACTION;
const SHUT_END = SHUT_START + SHUT_HOLD_FRACTION;
const REST_START = 1 - REST_FRACTION;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Decelerating: maximum velocity on the first frame. A shutter is spring-RELEASED, so the
 *  blades are already at speed the instant they are let go and slow into their stop. */
function easeOutQuad(value: number): number {
  return 1 - (1 - value) * (1 - value);
}

/** Accelerating out of rest. The release begins from a dead stop (the leaves are held shut),
 *  so its first frame must have ZERO velocity — the same continuity requirement that act 02's
 *  `clapFall` documents, and for the same reason: a velocity step at a phase boundary reads as
 *  a stutter even though every frame time is fine. */
function easeInQuad(value: number): number {
  return value * value;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

/**
 * How far through the exposure the mechanism is at lane progress `p`: 0 = wide open,
 * 1 = fully shut. It passes through 1, settles at 0.8, and holds there.
 *
 * NON-MONOTONIC, which is the entire 返工. This is the only place the close-hold-open shape is
 * stated; `spin` and therefore `stop` and the opening are all projections of it, so there is no
 * second curve anywhere that could disagree about when the shutter is shut.
 */
export function shutterCycle(progress: number): number {
  const p = clamp01(progress);
  if (p <= 0) return 0;
  if (p < SHUT_START) return easeOutQuad(p / CLOSE_FRACTION);
  if (p < SHUT_END) return 1;
  if (p < REST_START) {
    const local = (p - SHUT_END) / SETTLE_FRACTION;
    return 1 - (1 - RESTING_CLOSURE) * smoothstep(local);
  }
  return RESTING_CLOSURE;
}

/** Exit is not the entrance mirrored. It starts exactly at the entrance's 80% terminal
 * geometry, opens completely during the first 72%, and then remains open. */
export function shutterExitCycle(progress: number): number {
  const p = clamp01(progress);
  if (p >= EXIT_OPEN_FRACTION) return 0;
  return RESTING_CLOSURE * (1 - easeOutQuad(p / EXIT_OPEN_FRACTION));
}

/** Canvas opacity holds until the mechanism is fully open, then fades over the exit tail. */
export function shutterExitOpacity(progress: number): number {
  const p = clamp01(progress);
  if (p <= EXIT_OPEN_FRACTION) return 1;
  return 1 - easeInQuad((p - EXIT_OPEN_FRACTION) / EXIT_FADE_FRACTION);
}

/**
 * The crank angle at lane progress `p`, radians.
 *
 * Derived from the active closure curve, NOT linear in progress. The inverse-sine projection
 * makes `apertureStop(apertureSpin(...))` equal the authored closure amount exactly.
 */
export function apertureSpin(progress: number, exiting = false): number {
  const closure = exiting ? shutterExitCycle(progress) : shutterCycle(progress);
  return SPIN_TOTAL_RAD * ((Math.asin(closure) * 2) / Math.PI);
}

/**
 * How far shut the shutter is (0 = wide open, 1 = fully shut) for a given crank angle.
 *
 * A crank-slider projection, `sin(theta)`, taken over the quarter turn the linkage uses. This
 * is the ONLY place the closure amount comes from, and it takes `spin` — not progress — so
 * the opening is by construction a function of the rotation the viewer can see.
 */
export function apertureStop(spin: number): number {
  const turned = spin / SPIN_TOTAL_RAD;
  const clamped = clamp01(turned);
  return Math.sin(clamped * (Math.PI / 2));
}

export interface ApertureGeometry {
  /** Crank angle, radians — also the rotation applied to every blade axis. */
  readonly spin: number;
  /** 0 = wide open, 1 = fully shut. */
  readonly stop: number;
  /** Barrel radius in canvas px. Blade roots and the outer arc ride exactly this. */
  readonly barrel: number;
  /** Inradius of the octagonal opening, canvas px. */
  readonly inradius: number;
  /** Radius of the octagon's vertices, canvas px. Always <= `barrel` (see file header). */
  readonly vertexRadius: number;
}

/**
 * Resolve the whole shutter for one frame from lane progress and the canvas's short side.
 *
 * `unit` is `min(width, height)` in CSS px, so every length below is already in the canvas's
 * own coordinates and the caller does no arithmetic.
 */
export function apertureGeometry(
  progress: number,
  unit: number,
  exiting = false
): ApertureGeometry {
  const spin = apertureSpin(progress, exiting);
  const stop = apertureStop(spin);
  const barrel = unit * BARREL_RADIUS_RATIO;
  const inradiusRatio = OPEN_INRADIUS + (FULLY_SHUT_INRADIUS - OPEN_INRADIUS) * stop;
  const inradius = barrel * inradiusRatio;
  // The containment invariant, stated where it is used rather than only in the header:
  // dividing by cos(pi/8) is exactly undoing OPEN_INRADIUS, so at stop=0 this is `barrel`
  // and it only shrinks from there. `Math.min` is a guard, not a correction — if it ever
  // clamps, the constants above have been edited into an inconsistent pair.
  const vertexRadius = Math.min(barrel, inradius / OPEN_INRADIUS);
  return { spin, stop, barrel, inradius, vertexRadius };
}

/** Axis of blade `index`: the direction its leading edge faces, including the crank turn. */
export function bladeAxis(index: number, spin: number): number {
  return BLADE_PHASE_RAD + spin + (index * (Math.PI * 2)) / BLADE_COUNT;
}

/**
 * Radius at which to place the quadratic control point for a bowed leading edge, so that the
 * curve's midpoint lands exactly on `inradius * BLADE_BOW`.
 *
 * A quadratic bezier does NOT pass through its control point: at t=0.5 it reaches
 * `(P0 + 2C + P2) / 4`. With the two endpoints on `vertexRadius` at +/- BLADE_HALF_SPAN off the
 * axis, their average projects onto the axis at `vertexRadius * cos(BLADE_HALF_SPAN)`, which is
 * exactly `inradius` (that identity is what `OPEN_INRADIUS = cos(pi/8)` buys). So, solving for
 * the control radius `c` that puts the midpoint at the wanted radius `m`:
 *
 *   m = (inradius + c) / 2   =>   c = 2m - inradius
 *
 * Using the wanted midpoint radius directly as the control radius — the obvious mistake, and
 * the one this function exists to prevent — lands the curve only halfway to the intended bow.
 *
 * Contained by the same convexity argument as everything else: `BLADE_BOW <= 1` gives
 * `c <= inradius <= vertexRadius <= barrel`, so the control point is inside the disc and a
 * bezier never leaves its control hull.
 */
export function bowControlRadius(inradius: number): number {
  return 2 * (inradius * BLADE_BOW) - inradius;
}

/** A point in canvas coordinates. */
export interface BladePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Control point for one trailing flank — the curve that makes a leaf a swept plate.
 *
 * The flank runs from a leading-edge vertex (at `vertexRadius`, on `edgeAngle`) out to its root
 * on the barrel (at `rootAngle`). A control point placed on the bisector at some radius gives a
 * straighter or kinkier WEDGE; what produces the scimitar in the reference is displacing it
 * TANGENTIALLY — round the barrel, in the sweep direction — so the flank bulges sideways.
 *
 * `sweepSign` is +1 or -1 for the two flanks of a leaf, so the pair curves the same way round
 * the barrel rather than mirroring into a leaf shape. The magnitude is scaled by `stop` so the
 * curve is fullest when the shutter is shut: parked leaves are slivers at the barrel wall where
 * a sweep would be invisible, and animating it means the plates visibly bend into the frame.
 *
 * CONTAINMENT: the radius is clamped to `barrel`, so the control point is inside the disc and
 * the bezier stays inside it by the convex-hull property (file header).
 */
export function flankControl(
  centerX: number,
  centerY: number,
  edgeAngle: number,
  rootAngle: number,
  vertexRadius: number,
  barrel: number,
  stop: number,
  sweepSign: number
): BladePoint {
  const midAngle = (edgeAngle + rootAngle) / 2;
  const midRadius = (vertexRadius + barrel) / 2;
  // Tangential displacement, expressed as an angular offset: an arc length of
  // `FLANK_SWEEP * barrel * stop` at radius `midRadius` is that length over the radius.
  const tangentialArc = FLANK_SWEEP * barrel * stop * sweepSign;
  const angle = midAngle + tangentialArc / midRadius;
  const radius = Math.min(barrel, midRadius);
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
}

/**
 * Lambert term for one blade's facet, 0..1, against the fixed key light. Pure function of the
 * blade's axis, so it changes as the crank turns — the plates re-shade while they close,
 * which is what stops the closure from reading as a flat mask sliding in.
 */
export function bladeLambert(axis: number): number {
  return 0.5 + 0.5 * Math.cos(axis - LIGHT_ANGLE_RAD);
}

/**
 * Specular bump on one blade's lit edge, 0..1, for the given wall-clock elapsed seconds.
 * Wall clock and not progress: this is the one thing in the act still moving after tSelf.
 */
export function bladeSpecular(axis: number, elapsedSeconds: number): number {
  const sweep = elapsedSeconds * SPECULAR_RAD_PER_SECOND;
  const lobe = Math.cos(axis - sweep);
  return lobe <= 0 ? 0 : Math.pow(lobe, SPECULAR_EXPONENT);
}
