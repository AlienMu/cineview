// Procedurally generates the clapperboard target points that particles converge
// onto. Pure module, zero assets. Coordinates are normalized 0..1 in the board
// box; the canvas maps them to device pixels.

export type TargetRole = 'bar' | 'frame' | 'rule' | 'label' | 'value' | 'hinge';

export interface TargetPoint {
  x: number;
  y: number;
  bar: boolean;
  role: TargetRole;
  /**
   * Index of the letter this point belongs to, for word targets only. The ACTION word is
   * graded per LETTER (six stops of one hue, dark → warm), so the colour lookup needs to
   * know which letter a particle spells. Deriving it from `x` in the draw loop — which is
   * what the previous continuous ramp did — cannot express "six discrete steps": the two
   * blank columns between letters make the boundaries uneven, so letters 2 and 3 came out
   * nearly the same colour while the gap inside `N` spanned two stops.
   */
  letter?: number;
}

const HINGE_Y = 0.3;

export const BOARD_GEOMETRY = {
  left: 0.04,
  right: 0.96,
  bodyTop: HINGE_Y,
  bodyBottom: 0.94,
  barTop: 0.08,
  barBottom: HINGE_Y,
  gridX: 0.38,
  rows: [0.49, 0.67, 0.85] as const,
  rules: [0.4, 0.58, 0.76] as const,
};

export const HINGE = { x: BOARD_GEOMETRY.left, y: HINGE_Y };

const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '010', '010', '111'],
  '2': ['111', '001', '001', '111', '100', '100', '111'],
  '3': ['111', '001', '001', '111', '001', '001', '111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
};

function sampleLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  count: number,
  out: TargetPoint[],
  role: TargetRole = 'frame'
): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push({
      x: x0 + (x1 - x0) * t,
      y: y0 + (y1 - y0) * t,
      bar: role === 'bar',
      role,
    });
  }
}

function sampleWord(
  word: string,
  x0: number,
  x1: number,
  centerY: number,
  height: number,
  out: TargetPoint[],
  role: 'label' | 'value'
): void {
  const glyphs = [...word].map((character) => GLYPHS[character]).filter(Boolean);
  if (!glyphs.length) return;

  const columns = glyphs.reduce((sum, glyph) => sum + glyph[0].length, 0) + glyphs.length - 1;
  const cellW = (x1 - x0) / columns;
  const cellH = height / 7;
  let cursor = x0;

  for (const glyph of glyphs) {
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < glyph[row].length; column++) {
        if (glyph[row][column] !== '1') continue;
        out.push({
          x: cursor + (column + 0.5) * cellW,
          y: centerY - height / 2 + (row + 0.5) * cellH,
          bar: false,
          role,
        });
      }
    }
    cursor += (glyph[0].length + 1) * cellW;
  }
}

function sampleLineClippedX(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  count: number,
  out: TargetPoint[]
): void {
  const { left, right } = BOARD_GEOMETRY;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const x = x0 + (x1 - x0) * t;
    if (x < left || x > right) continue;
    out.push({ x, y: y0 + (y1 - y0) * t, bar: true, role: 'bar' });
  }
}

export function buildClapperTargets(): TargetPoint[] {
  const pts: TargetPoint[] = [];
  const g = BOARD_GEOMETRY;

  // Dense perimeter and rules create a rigid silhouette before the vector backing
  // reaches full opacity. The old 44/28-point outline read as isolated dust.
  sampleLine(g.left, g.bodyTop, g.right, g.bodyTop, 92, pts);
  sampleLine(g.left, g.bodyBottom, g.right, g.bodyBottom, 92, pts);
  sampleLine(g.left, g.bodyTop, g.left, g.bodyBottom, 58, pts);
  sampleLine(g.right, g.bodyTop, g.right, g.bodyBottom, 58, pts);
  sampleLine(g.gridX, g.rules[0], g.gridX, g.bodyBottom, 48, pts, 'rule');
  for (const y of g.rules) sampleLine(g.left, y, g.right, y, 72, pts, 'rule');

  // Labels are real 5×7 particle glyphs rather than anonymous dash runs.
  sampleWord('SCENE', g.left + 0.035, g.gridX - 0.035, g.rows[0], 0.085, pts, 'label');
  sampleWord('TAKE', g.left + 0.035, g.gridX - 0.035, g.rows[1], 0.085, pts, 'label');
  sampleWord('ROLL', g.left + 0.035, g.gridX - 0.035, g.rows[2], 0.085, pts, 'label');
  sampleWord('02', g.gridX + 0.055, g.right - 0.08, g.rows[0], 0.1, pts, 'value');
  sampleWord('01', g.gridX + 0.055, g.right - 0.08, g.rows[1], 0.1, pts, 'value');
  sampleWord('A01', g.gridX + 0.055, g.right - 0.08, g.rows[2], 0.1, pts, 'value');

  // Hinge ring: explicit, warm-edged, and dense enough to read as hardware.
  for (let ring = 0; ring < 2; ring++) {
    const radius = 0.018 + ring * 0.013;
    const count = ring === 0 ? 18 : 28;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      pts.push({
        x: HINGE.x + Math.cos(angle) * radius,
        y: HINGE.y + Math.sin(angle) * radius,
        bar: false,
        role: 'hinge',
      });
    }
  }

  // Clapper stick outline and diagonal stripe ribs.
  sampleLine(g.left, g.barTop, g.right, g.barTop, 88, pts, 'bar');
  sampleLine(g.left, g.barBottom, g.right, g.barBottom, 88, pts, 'bar');
  sampleLine(g.left, g.barTop, g.left, g.barBottom, 26, pts, 'bar');
  sampleLine(g.right, g.barTop, g.right, g.barBottom, 26, pts, 'bar');

  const stripes = 8;
  const stripeW = (g.right - g.left) / stripes;
  for (let stripe = 0; stripe < stripes; stripe++) {
    const x0 = g.left + stripeW * stripe;
    sampleLineClippedX(x0, g.barBottom, x0 + stripeW, g.barTop, 18, pts);
    sampleLineClippedX(x0 + stripeW * 0.48, g.barBottom, x0 + stripeW * 1.48, g.barTop, 18, pts);
  }

  return pts;
}

// The countdown box = the value column of the slate (the red frame in the locked
// reference): right of the grid divider, spanning the three data rows. The 3-2-1
// countdown is formed by the SAME particles that spell the value column, so the
// digits are a re-organisation of the board rather than an overlay.
export const VALUE_BOX = {
  x0: BOARD_GEOMETRY.gridX + 0.02,
  x1: BOARD_GEOMETRY.right - 0.02,
  y0: BOARD_GEOMETRY.rules[0] + 0.015,
  y1: BOARD_GEOMETRY.bodyBottom - 0.015,
};

// Countdown numerals are their OWN 5x7 stencils, not the 3-wide glyphs the slate's value
// text uses. History worth keeping:
//  - 3 columns made "2" and "3" differ by two cells out of twenty-one, indistinguishable
//    at particle resolution;
//  - two-cell-thick strokes fixed an audit complaint about the narrow "1" but the user
//    then reported too many particles, too thick — a dot-matrix numeral filling half the
//    value column reads as a slab. Back to single-cell strokes at 5 columns: distinct
//    silhouettes, light ink.
const COUNTDOWN_GLYPHS: Record<string, string[]> = {
  '1': ['00100', '01100', '10100', '00100', '00100', '00100', '11111'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
};

/**
 * One countdown digit, centred in the value column, as EXACTLY `count` points so the
 * value-column particles map 1:1.
 *
 * Points sit on an ALIGNED sub-grid inside each glyph cell. Two earlier attempts failed
 * and both failure modes are worth keeping written down:
 *  - a fixed sub-grid (side × side per cell) needs `count` to be a multiple of
 *    cells × side²; at 135 particles over 160 slots the 25 unused slots fell in whole
 *    rows, so the "3" lost its lower bar and read as a 7;
 *  - jittering each point inside its cell (golden-ratio offsets) filled every cell but
 *    destroyed the stroke edges — the numeral read as a speckle cloud, not a digit.
 * So: keep the grid alignment (crisp edges) and instead thin the FULL grid down to
 * `count` by taking a low-discrepancy subset of the slot list. The dropped slots are
 * scattered evenly over the whole numeral, which reads as a dot-matrix digit.
 */
// The rect a countdown numeral occupies, in BOARD-NORMALISED units — the single source of
// truth for "where is the digit", shared by the builder below and by the acceptance probes
// (ClapperboardCanvas republishes it on the canvas element; see its dataset writes).
//
// This is exported because act2-digit-legibility used to hardcode its own crop of the value
// column (0.37..0.97 x, 0.38..0.96 y of a guessed board box). That crop covered the whole
// right-hand data area, so the "digit" it compared against the 5x7 stencil was actually the
// numeral PLUS the slate's three ruled value rows: the measured bbox filled the entire crop
// (96x88 of a 96-cell grid) and every legibility score collapsed to ~0.5-0.69 against a 0.75
// bar. Three separate probes had each guessed a different board box (0.78, 0.86, 1.24), and
// all three silently decayed the moment the real fit changed. A probe that re-derives
// geometry is a probe that tests its own arithmetic.
export function countdownGlyphRect(character: string): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} | null {
  const glyph = COUNTDOWN_GLYPHS[character];
  if (!glyph) return null;
  const rows = glyph.length;
  const columns = glyph[0].length;
  const boxH = (VALUE_BOX.y1 - VALUE_BOX.y0) * 0.74;
  const boxW = (VALUE_BOX.x1 - VALUE_BOX.x0) * 0.74;
  const cell = Math.min(boxH / rows, boxW / columns);
  const glyphW = cell * columns;
  const glyphH = cell * rows;
  const x0 = (VALUE_BOX.x0 + VALUE_BOX.x1) / 2 - glyphW / 2;
  const y0 = (VALUE_BOX.y0 + VALUE_BOX.y1) / 2 - glyphH / 2;
  return { x0, y0, x1: x0 + glyphW, y1: y0 + glyphH };
}

export function buildCountdownDigit(character: string, count: number): TargetPoint[] {
  const glyph = COUNTDOWN_GLYPHS[character];
  if (!glyph || count <= 0) return [];
  const rows = glyph.length;
  const columns = glyph[0].length;
  const cells: Array<{ row: number; column: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (glyph[row][column] === '1') cells.push({ row, column });
    }
  }
  if (!cells.length) return [];

  // Fit by the TIGHTER axis and centre in both, so the wider 5-column stencil cannot
  // spill past the value column (the 3-wide version only ever needed a height fit).
  //
  // The 0.74 scale is a legibility/weight trade-off, not decoration: strokes are one cell
  // thick (the user rejected two-cell strokes as too thick), and 135 particles spread over a
  // full-height numeral leave visible gaps in every stroke. Shrinking the numeral packs the
  // same particles into shorter strokes, so it reads as a continuous thin digit.
  //
  // Rect comes from countdownGlyphRect so the published geometry and the drawn geometry are
  // the same arithmetic, not two copies of it.
  const rect = countdownGlyphRect(character);
  if (!rect) return [];
  const cell = (rect.x1 - rect.x0) / columns;
  const originX = rect.x0;
  const originY = rect.y0;

  const side = Math.max(2, Math.ceil(Math.sqrt(count / cells.length)));
  const slots: TargetPoint[] = [];
  for (const { row, column } of cells) {
    for (let sy = 0; sy < side; sy++) {
      for (let sx = 0; sx < side; sx++) {
        slots.push({
          x: originX + (column + (sx + 0.5) / side) * cell,
          y: originY + (row + (sy + 0.5) / side) * cell,
          bar: false,
          role: 'value',
        });
      }
    }
  }

  if (slots.length <= count) return slots;
  // Low-discrepancy thinning: rank every slot by frac(i·φ⁻¹) and keep the lowest
  // `count`. Deterministic, and spread over the whole shape rather than by row.
  const ranked = slots
    .map((point, index) => ({ point, key: (index * 0.6180339887) % 1 }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count);
  return ranked.map((entry) => entry.point);
}

// The ACTION word is drawn as particles too (locked: "action is also made of particles, placed a
// bit below the board"), so it lives in the same normalised board space: y > 1 is BELOW the board body.
//
// 7x9 stencils with TWO-CELL strokes. The previous set was 5x7 with single-cell strokes,
// i.e. a stroke-to-cap-height ratio of 1/7 ≈ 14%; film title cards sit at 20-25%, and the
// word read as a hairline wireframe rather than as type. Two cells of nine is 22%.
//
// Note this costs nothing geometrically: the band's box (WORD_BAND) is unchanged, the rows
// are simply subdivided into 9 instead of 7, so cap height is identical and only the stroke
// gets thicker. The letter box does get finer horizontally (52 columns of the same band
// width instead of 40), which keeps the cells near-square — 0.01385 x 0.01444 board units
// against the old 0.018 x 0.01857 — so the type is not stretched.
//
// Centred stems (T, I) are three cells wide, not two: 7 is odd, so a two-cell stem cannot
// be centred, and an off-centre stem in a dot-matrix reads as a defect rather than as a
// lighter weight.
const WORD_GLYPHS: Record<string, string[]> = {
  A: [
    '0011100',
    '0111110',
    '1100011',
    '1100011',
    '1111111',
    '1111111',
    '1100011',
    '1100011',
    '1100011',
  ],
  C: [
    '0111110',
    '1111111',
    '1100000',
    '1100000',
    '1100000',
    '1100000',
    '1100000',
    '1111111',
    '0111110',
  ],
  I: [
    '1111111',
    '1111111',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
    '1111111',
    '1111111',
  ],
  N: [
    '1100011',
    '1110011',
    '1110011',
    '1101011',
    '1101011',
    '1100111',
    '1100111',
    '1100011',
    '1100011',
  ],
  O: [
    '0111110',
    '1111111',
    '1100011',
    '1100011',
    '1100011',
    '1100011',
    '1100011',
    '1111111',
    '0111110',
  ],
  T: [
    '1111111',
    '1111111',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
    '0011100',
  ],
};

const WORD_ROWS = 9;
/** Blank columns of letter spacing. At this stroke weight one column closes the word up. */
const WORD_LETTER_GAP = 2;

/** Vertical band, in board-normalised units, that the ACTION word occupies. */
export const WORD_BAND = { top: 1.1, height: 0.13, left: 0.14, right: 0.86 };

/**
 * Particle targets for a word rendered under the board. One point per lit stencil cell
 * (no up-sampling): the word is decoration for a headline, so a light dot-matrix reads
 * better than a solid slab, and it keeps the particle count small.
 *
 * Each point carries the index of the letter it belongs to, because the word is graded per
 * LETTER (six brightness stops of one hue) rather than by a continuous function of x.
 */
export function buildWordTargets(word: string): TargetPoint[] {
  const glyphs = [...word.toUpperCase()]
    .map((character) => WORD_GLYPHS[character])
    .filter(Boolean) as string[][];
  if (!glyphs.length) return [];

  const columns =
    glyphs.reduce((sum, glyph) => sum + glyph[0].length, 0) + (glyphs.length - 1) * WORD_LETTER_GAP;
  const cellW = (WORD_BAND.right - WORD_BAND.left) / columns;
  const cellH = WORD_BAND.height / WORD_ROWS;
  const out: TargetPoint[] = [];
  let cursor = WORD_BAND.left;
  for (let letter = 0; letter < glyphs.length; letter++) {
    const glyph = glyphs[letter];
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < glyph[row].length; column++) {
        if (glyph[row][column] !== '1') continue;
        out.push({
          x: cursor + (column + 0.5) * cellW,
          y: WORD_BAND.top + (row + 0.5) * cellH,
          bar: false,
          role: 'label',
          letter,
        });
      }
    }
    cursor += (glyph[0].length + WORD_LETTER_GAP) * cellW;
  }
  return out;
}

/**
 * The box the decoration below/above the word can occupy, in board-normalised units, and the
 * single source of truth for it: `buildWordDecorTargets` generates inside these bounds and the
 * canvas's `EXTENT` reserves exactly them. Two copies of this arithmetic is the failure mode
 * already recorded for the probes (a duplicated formula silently stops describing the drawing).
 *
 * `x0`/`x1` are deliberately INSIDE the board's own hull (which reaches -0.092..0.969 once the
 * open stick and the dot padding are counted), so the decoration cannot raise `EXTENT.w` — the
 * binding dimension — and therefore cannot shrink the board.
 */
export const WORD_DECOR_BOX = {
  x0: 0.05,
  x1: 0.95,
  railTop: WORD_BAND.top - 0.055,
  railBottom: WORD_BAND.top + WORD_BAND.height + 0.032,
  /** Dust reaches this far above the upper rail. */
  dustRise: 0.06,
};

/**
 * Set dressing around the ACTION band: a tick rail above and below the word, plus a loose
 * scatter of dots in the gutters. Generated here rather than in the canvas so the canvas
 * stays a renderer (CLAUDE.md self-check 3 — it is the largest file in this folder and the
 * `buildWordTargets` split already draws that line).
 *
 * Two hard constraints, both from the fit arithmetic in the canvas (`EXTENT`):
 *
 *  1. NOTHING may sit outside x = [0.05, 0.95]. The canvas fits the whole drawing by
 *     `s = min(w*0.96/EXTENT.w, h*0.96/EXTENT.h)` and width is the binding dimension, so
 *     any horizontal growth shrinks the board itself. The board's own hull already reaches
 *     x = 0.96 + pad, so decoration inside 0.95 is free. This is why there are no side
 *     rails — a symmetric pair of vertical rules would be paid for in board size.
 *  2. Ticks point INWARD, toward the word. Pointing them outward would push the lower rail
 *     0.019 further down for no legibility gain; vertical growth is cheap (height is not
 *     binding) but it is not free, and it moves the h/w threshold at which it would become
 *     binding.
 */
export function buildWordDecorTargets(): TargetPoint[] {
  const out: TargetPoint[] = [];
  const bandBottom = WORD_BAND.top + WORD_BAND.height;
  const railTop = WORD_DECOR_BOX.railTop;
  const railBottom = WORD_DECOR_BOX.railBottom;
  const ticks = 25;
  const majorEvery = 4;
  const minorStep = 0.009;
  const majorSteps = 2;

  for (const [railY, inward] of [
    [railTop, 1],
    [railBottom, -1],
  ] as const) {
    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const x = WORD_BAND.left + (WORD_BAND.right - WORD_BAND.left) * t;
      out.push({ x, y: railY, bar: false, role: 'rule' });
      const steps = i % majorEvery === 0 ? majorSteps : 1;
      for (let step = 1; step <= steps; step++) {
        out.push({ x, y: railY + inward * minorStep * step, bar: false, role: 'rule' });
      }
    }
  }

  // Loose dust in the gutters left/right of the word and just outside the rails. Seeded from
  // the same hash as the scatter origins so re-entry retraces the same field. Rejection
  // sampling keeps it out of the type's own box, which would otherwise read as noise inside
  // the letters.
  const wanted = 22;
  const dustTop = railTop - WORD_DECOR_BOX.dustRise;
  for (let i = 0, placed = 0; i < wanted * 12 && placed < wanted; i++) {
    const h = scatterOrigin(i + 4409);
    const x = WORD_DECOR_BOX.x0 + h.x * (WORD_DECOR_BOX.x1 - WORD_DECOR_BOX.x0);
    const y = dustTop + h.y * (railBottom - dustTop);
    const insideType = x > 0.12 && x < 0.88 && y > WORD_BAND.top - 0.015 && y < bandBottom + 0.015;
    if (insideType) continue;
    out.push({ x, y, bar: false, role: 'frame' });
    placed += 1;
  }

  return out;
}

// Deterministic scatter origin for each particle (seeded, so reverse/re-entry
// retraces the same paths instead of re-rolling the field).
export function scatterOrigin(index: number): TargetPoint {
  const h1 = Math.sin(index * 12.9898) * 43758.5453;
  const h2 = Math.sin(index * 78.233) * 12543.1234;
  return {
    x: h1 - Math.floor(h1),
    y: h2 - Math.floor(h2),
    bar: false,
    role: 'frame',
  };
}

export function convergePhase(index: number, total: number): number {
  return (index / total) * 0.18;
}
