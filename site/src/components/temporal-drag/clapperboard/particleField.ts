// Procedurally generates the clapperboard target points that particles converge
// onto. Pure module, zero assets (v3 §5 decision: 纯程序生成粒子). Coordinates are
// normalized 0..1 in a 4:3 board box; the canvas maps them to device pixels.
//
// The board outline = top diagonal-striped clapper bar + body rectangle + a few
// horizontal info rows (SCENE / TAKE / ROLL grid lines). Points are sampled along
// these strokes so the assembled figure reads as a clapperboard.

export interface TargetPoint {
  x: number; // 0..1
  y: number; // 0..1
}

function sampleLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  count: number,
  out: TargetPoint[]
): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
  }
}

// Board layout in normalized space. Body spans most of the box; the clapper bar
// (angled sticks) sits on top.
const BODY = { left: 0.08, right: 0.92, top: 0.3, bottom: 0.92 };
const BAR = { top: 0.08, bottom: 0.24 };

export function buildClapperTargets(): TargetPoint[] {
  const pts: TargetPoint[] = [];

  // Body rectangle border.
  sampleLine(BODY.left, BODY.top, BODY.right, BODY.top, 40, pts);
  sampleLine(BODY.left, BODY.bottom, BODY.right, BODY.bottom, 40, pts);
  sampleLine(BODY.left, BODY.top, BODY.left, BODY.bottom, 26, pts);
  sampleLine(BODY.right, BODY.top, BODY.right, BODY.bottom, 26, pts);

  // Clapper bar top & bottom edges.
  sampleLine(BODY.left, BAR.top, BODY.right, BAR.top, 36, pts);
  sampleLine(BODY.left, BAR.bottom, BODY.right, BAR.bottom, 36, pts);

  // Diagonal stripes across the clapper bar (the signature striped look).
  const stripes = 7;
  for (let s = 0; s < stripes; s++) {
    const x0 = BODY.left + ((BODY.right - BODY.left) * s) / stripes;
    const x1 = x0 + (BODY.right - BODY.left) / stripes;
    sampleLine(x0, BAR.bottom, x1, BAR.top, 10, pts);
  }

  // Info rows inside the body (SCENE / TAKE / ROLL horizontal guide lines).
  const rows = [0.46, 0.62, 0.78];
  for (const y of rows) {
    sampleLine(BODY.left + 0.05, y, BODY.right - 0.05, y, 24, pts);
  }

  return pts;
}

// Deterministic scatter origin for each particle (seeded, so it doesn't jitter
// every frame). Uses a cheap hash of the index → stable pseudo-random in 0..1.
export function scatterOrigin(index: number): TargetPoint {
  const h1 = Math.sin(index * 12.9898) * 43758.5453;
  const h2 = Math.sin(index * 78.233) * 12543.1234;
  return { x: h1 - Math.floor(h1), y: h2 - Math.floor(h2) };
}

// Per-particle phase offset for staggered convergence (铁屑被磁化 effect).
// Lag spread trimmed 0.35 → 0.22 so the board reads EARLIER during the incoming
// scrub: the scene-01→02 handoff had a void window (~50–62% drag) where scene 01
// had left but the particles were still invisible. A tighter spread pulls the
// legible board forward so the next scene visibly takes over sooner.
export function convergePhase(index: number, total: number): number {
  return (index / total) * 0.22; // last particles lag up to 0.22 of progress
}
