import fs from 'node:fs';
import path from 'node:path';
import { motionValue } from 'framer-motion';
import ts from 'typescript';
import type { AnimatePhase } from '../../types';
import {
  ACT2_BOARD_GATE_MS,
  ACT2_LIGHT_GATE_MS,
  ACT2_LIGHT_LAYERS,
  ACT2_LIGHT_SET_DELAY_MS,
} from '../../../site/src/components/temporal-drag/SlateLightRig';
import {
  ACT2_BOARD_TIMING_MS,
  BOARD_ENTER_MS,
  ClapperboardCanvas,
} from '../../../site/src/components/temporal-drag/clapperboard/ClapperboardCanvas';
import {
  CLAPPER_EXTENT,
  computeClapperExtent,
} from '../../../site/src/components/temporal-drag/clapperboard/fitGeometry';
import {
  BOARD_GEOMETRY,
  buildWordDecorTargets,
  buildWordTargets,
  WORD_BAND,
  WORD_DECOR_BOX,
} from '../../../site/src/components/temporal-drag/clapperboard/particleField';
import {
  HOVER_MAX,
  hoverAnchor,
  letterRamp,
  makeWalk,
  stepHover,
  stepWalk,
  WORD_WALK_MAX,
} from '../../../site/src/components/temporal-drag/clapperboard/wordMotion';

const ROOT = path.resolve(__dirname, '../../..');
const CANVAS_FILE = path.join(
  ROOT,
  'site/src/components/temporal-drag/clapperboard/ClapperboardCanvas.tsx'
);
const SCENE_FILE = path.join(ROOT, 'site/src/components/temporal-drag/SceneSlate.tsx');
const LIGHT_FILE = path.join(ROOT, 'site/src/components/temporal-drag/SlateLightRig.tsx');

// The SITE's React, not the framework root's. `site/` has its own node_modules, so importing
// `react` here resolves a DIFFERENT copy from the one ClapperboardCanvas closes over, and
// rendering it through a foreign renderer throws "Invalid hook call" before a single frame is
// drawn. Required by path so the component and the root share one instance.
/* eslint-disable @typescript-eslint/no-var-requires */
const siteReact = require(path.join(ROOT, 'site/node_modules/react')) as typeof import('react');
const siteReactDom = require(
  path.join(ROOT, 'site/node_modules/react-dom/client')
) as typeof import('react-dom/client');
/* eslint-enable @typescript-eslint/no-var-requires */
const { createElement } = siteReact;
const { createRoot } = siteReactDom;
const reactAct = (
  siteReact as unknown as { unstable_act: (callback: () => Promise<void>) => Promise<void> }
).unstable_act;

function parse(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function stripComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('/drag W2 clapperboard contract', () => {
  /**
   * Where the SLATE'S OWN chain ends: gate + board. DERIVED from its two owners rather than a
   * ceiling they must fit inside, and deliberately NOT called tSelf — see below.
   *
   * Both terms moved this pass: the gate 1600 -> 1100 (返工「继续加快act2画板入场时间」) and the
   * board 3600 -> 3560 (its table traded 280ms of convergence for a 240ms held-board beat).
   */
  const ACT2_BOARD_CHAIN_END_MS = 4370;

  /**
   * The ACT's tSelf, which is a DIFFERENT number from the one above and is why 3560 is not a
   * shortfall. tSelf is max(delayMs + enterMs) over ALL lanes; the binding lane is the bokeh
   * ambient at 300 + 4900. Neither compression touched the ambient four, so this never moved.
   *
   * An earlier revision of this suite conflated the two, asserting `gate + board === 5200` under
   * the name tSelf. That equation held only while gate was 1600 and board 3600, and reading it as
   * a law is what makes the 40ms between 3560 and a round 3600 look like dead air to pad back.
   * Nothing waits on the board to finish, so there is no gap: 540ms of key-light ramp is still
   * playing after the slate's chain is done. Both numbers are pinned separately below.
   */
  const ACT2_TSELF_MS = 5200;

  // The whole authored budget, as a table rather than as a set of range checks.
  //
  // The 40-50% ratio loop below used to be the ONLY constraint on these numbers, and a ratio
  // band cannot pin a budget: set could have been 2800/1200 (the pre-compression values, still
  // 43%) and every assertion stayed green while the gate silently went back to overflowing
  // tSelf. Exact values are what make a retune visible to the suite.
  const EXPECTED_LIGHT_LANES = [
    { id: 's02-light-haze', delayMs: 220, enterMs: 4900, exitMs: 1960 },
    { id: 's02-light-set', delayMs: 260, enterMs: 1100, exitMs: 480 },
    { id: 's02-light-beam', delayMs: 0, enterMs: 4800, exitMs: 1920 },
    { id: 's02-light-pool', delayMs: 160, enterMs: 4900, exitMs: 1960 },
    { id: 's02-light-bokeh', delayMs: 300, enterMs: 4900, exitMs: 1960 },
  ] as const;

  it('keeps the measured five-layer light rig and reversible exit budgets', () => {
    expect(
      ACT2_LIGHT_LAYERS.map((layer) => ({
        id: layer.id,
        delayMs: layer.delayMs,
        enterMs: layer.enterMs,
        exitMs: layer.exitMs,
      }))
    ).toEqual(EXPECTED_LIGHT_LANES.map((lane) => ({ ...lane })));
    expect(ACT2_LIGHT_LAYERS.some((layer) => layer.id.includes('spill'))).toBe(false);

    // Kept as a derived check on top of the exact table: it states the RULE the numbers were
    // chosen to satisfy, so a future retune of the table is also held to the reversibility
    // budget instead of just to "whatever the table now says".
    for (const layer of ACT2_LIGHT_LAYERS) {
      const ratio = layer.exitMs / layer.enterMs;
      expect(ratio).toBeGreaterThanOrEqual(0.4);
      expect(ratio).toBeLessThanOrEqual(0.5);
    }

    // The ambient layers must OUTLAST the gate — that overlap is what stops act 2 reading as
    // two slideshow steps (a lit stage, then a board). Asserted as a relation so it survives a
    // legitimate retune of either side.
    for (const layer of ACT2_LIGHT_LAYERS) {
      if (layer.id === 's02-light-set') continue;
      expect(layer.delayMs + layer.enterMs).toBeGreaterThan(ACT2_LIGHT_GATE_MS);
    }

    const haze = ACT2_LIGHT_LAYERS.find((layer) => layer.id === 's02-light-haze');
    const pool = ACT2_LIGHT_LAYERS.find((layer) => layer.id === 's02-light-pool');
    expect(haze?.from).toEqual({ opacity: 0 });
    expect(pool?.from).toEqual({ opacity: 0 });
  });

  it('keeps the no-gap 3-2-1 board budget as one 3560ms source of truth', () => {
    expect(ACT2_BOARD_TIMING_MS).toEqual({
      form: 620,
      settle: 240,
      countBeat: 720,
      countChars: ['3', '2', '1'],
      reform: 100,
      clap: 180,
      word: 260,
    });
    expect(BOARD_ENTER_MS).toBe(3560);
    expect(
      ACT2_BOARD_TIMING_MS.form +
        ACT2_BOARD_TIMING_MS.settle +
        ACT2_BOARD_TIMING_MS.countBeat * ACT2_BOARD_TIMING_MS.countChars.length +
        ACT2_BOARD_TIMING_MS.reform +
        ACT2_BOARD_TIMING_MS.clap +
        ACT2_BOARD_TIMING_MS.word
    ).toBe(BOARD_ENTER_MS);
    // 720ms per numeral is the authored read speed the whole budget was rebuilt around (it had
    // decayed to 216ms when the fractions and the denominator lived in different files). Stated
    // separately from the table so the failure names the symptom.
    expect(ACT2_BOARD_TIMING_MS.countBeat * ACT2_BOARD_TIMING_MS.countChars.length).toBe(2160);

    // THE HELD BOARD, asserted as its own claim: 「需要完全展示后才执行倒计时」. `settle` is the beat
    // in which the assembled slate is on screen and STILL, and it is the segment the countdown is
    // anchored off. Zero here (or the countdown re-anchored at FORM_END) is the regression where
    // the last particles to arrive are immediately recruited into the numeral "3", so the board is
    // never seen as a board. Stated separately from the table for the same reason countBeat is:
    // the failure should name the symptom, not just "the object changed".
    expect(ACT2_BOARD_TIMING_MS.settle).toBeGreaterThan(0);
    // The entrance is FASTER than the beat it feeds: 620 of convergence against 240 of stillness.
    // This ordering is what 「继续加快act2画板入场时间」 bought — the hold may not grow until it
    // outweighs the convergence, which would read as a stalled entrance rather than a held board.
    expect(ACT2_BOARD_TIMING_MS.form).toBeGreaterThan(ACT2_BOARD_TIMING_MS.settle);

    // The table's own segments are the ONLY things in the sum: no slack, no overflow. Asserted
    // structurally rather than trusted, since the canvas derives every fraction from this total —
    // a segment missing from the sum silently re-prices every beat after it.
    const canvas = stripComments(fs.readFileSync(CANVAS_FILE, 'utf8'));
    expect(canvas).toMatch(
      /export const BOARD_ENTER_MS =\s*FORM_MS \+ SETTLE_MS \+ COUNT_BEAT_MS \* COUNT_BEAT_CHARS\.length \+ REFORM_MS \+ CLAP_MS \+ WORD_MS;/
    );
    // The countdown is anchored on the END of the hold, not on the end of the convergence.
    expect(canvas).toContain('const SETTLE_END = FORM_END + seg(SETTLE_MS);');
    expect(canvas).toContain('start: SETTLE_END + seg(COUNT_BEAT_MS * index),');
  });

  it('runs the slate chain inside the act, under an ambient ramp that outlasts it', () => {
    expect(ACT2_LIGHT_GATE_MS).toBe(1100);
    expect(ACT2_LIGHT_SET_DELAY_MS).toBe(260);
    expect(ACT2_BOARD_GATE_MS).toBe(810);
    expect(BOARD_ENTER_MS).toBe(3560);
    expect(ACT2_BOARD_GATE_MS + BOARD_ENTER_MS).toBe(ACT2_BOARD_CHAIN_END_MS);

    // The act's REAL clock, and the relation that makes 3560 correct rather than 40ms short.
    // Computed from the lane table rather than restated, so it tracks a legitimate retune.
    const tSelf = Math.max(...ACT2_LIGHT_LAYERS.map((layer) => layer.delayMs + layer.enterMs));
    expect(tSelf).toBe(ACT2_TSELF_MS);
    // The slate finishes BEFORE the act does. This is the assertion that would have caught the
    // "pad the board back to 3600 to close a 40ms gap" repair: there is no gap to close, and the
    // board is not what the act is waiting on.
    expect(ACT2_BOARD_CHAIN_END_MS).toBeLessThan(tSelf);
    // ...and the surplus is real ramp, not rounding: the key light is still climbing for over
    // half a second after the ACTION word has landed.
    expect(tSelf - ACT2_BOARD_CHAIN_END_MS).toBe(830);

    // The gate IS the set layer's enter. This is the invariant the locked order 灯光入场 →
    // 再出现 canvas rests on: shorter and the board starts after the light has finished (a
    // visible stall), longer and particles gather over an unlit stage.
    const set = ACT2_LIGHT_LAYERS.find((layer) => layer.id === 's02-light-set');
    expect(set?.enterMs).toBe(ACT2_LIGHT_GATE_MS);
    expect(set?.delayMs).toBe(ACT2_LIGHT_SET_DELAY_MS);
    expect(ACT2_BOARD_GATE_MS).toBe(
      (set?.delayMs ?? Number.NaN) + (set?.enterMs ?? Number.NaN) * 0.5
    );

    // ONE owner for the number, enforced at the source level. The pair used to be a literal
    // `const LIGHT_GATE_MS = 1600` in SceneSlate matching `enterMs: 1600` in SlateLightRig:
    // internally consistent in both files, so retuning either alone left the suite green while
    // breaking the order. The rig exports it, the scene imports it, and neither file may spell
    // the beat as a bare literal again.
    const scene = stripComments(fs.readFileSync(SCENE_FILE, 'utf8'));
    const light = stripComments(fs.readFileSync(LIGHT_FILE, 'utf8'));
    expect(scene).toContain("import { ACT2_BOARD_GATE_MS, SlateLightRig } from './SlateLightRig'");
    expect(scene).toContain('timeline={{ delay: timing.delay(ACT2_BOARD_GATE_MS) }}');
    expect(scene).toContain('enter: timing.duration(BOARD_ENTER_MS)');
    expect(scene).not.toMatch(/LIGHT_GATE_MS\s*=/);
    expect(light).toContain('enterMs: ACT2_LIGHT_GATE_MS');
    expect(light).toContain('delayMs: ACT2_LIGHT_SET_DELAY_MS');
    // Exactly one literal spelling of the gate in the rig: its own declaration.
    expect(light.match(/\b1100\b/g)).toEqual(['1100']);
    expect(light).toMatch(/export const ACT2_LIGHT_GATE_MS = 1100;/);
    expect(light).toContain(
      'export const ACT2_BOARD_GATE_MS = ACT2_LIGHT_SET_DELAY_MS + ACT2_LIGHT_GATE_MS * 0.5'
    );

    // The board's exit. Not exported (nothing else consumes it), so it is pinned at the source
    // level — 900ms against a 3560ms enter is the same ~25% reversibility budget the rig's lanes
    // carry, and it is the one number in this lane the design table fixes independently.
    expect(scene).toMatch(/const BOARD_EXIT_MS = 900;/);
    expect(scene).toContain('exit: timing.duration(BOARD_EXIT_MS)');
  });

  it('fits the open board and decoration without widening the particle hull', () => {
    const withoutDecor = computeClapperExtent(false);
    const withDecor = computeClapperExtent(true);

    expect(withoutDecor).toEqual({
      minX: expect.closeTo(-0.0920224388, 9),
      minY: expect.closeTo(-0.4058457372, 9),
      w: expect.closeTo(1.0610224388, 9),
      h: expect.closeTo(1.6462457372, 9),
    });
    expect(withDecor).toEqual(CLAPPER_EXTENT);
    expect(withDecor.w).toBeCloseTo(withoutDecor.w, 12);
    expect(withDecor.h).toBeGreaterThan(withoutDecor.h);
    expect(withDecor.h).toBeCloseTo(1.6738457372, 9);

    const decor = buildWordDecorTargets();
    expect(Math.min(...decor.map((point) => point.x))).toBeGreaterThanOrEqual(WORD_DECOR_BOX.x0);
    expect(Math.max(...decor.map((point) => point.x))).toBeLessThanOrEqual(WORD_DECOR_BOX.x1);
    expect(WORD_BAND.top).toBeGreaterThan(BOARD_GEOMETRY.bodyBottom);

    // EXACT composition of the set dressing, not a floor.
    //
    // `length > 100` and `rules > 50` were both satisfied by half the dressing: dropping one of
    // the two rails leaves 79 points / 57 rules, which passes both. The spec (§3.2) is a rail
    // ABOVE and BELOW the word plus scattered dust, so the two-ness is the claim and it is
    // asserted as the y-level structure below.
    const rails = decor.filter((point) => point.role === 'rule');
    const dust = decor.filter((point) => point.role === 'frame');
    expect(decor.length).toBe(136);
    expect(rails.length).toBe(114);
    expect(dust.length).toBe(22);

    // 25 ticks per rail, each on a shared x ladder, with a major tick every 4th position carrying
    // an extra inward step. Reconstructed from the points: 6 distinct y levels = 2 rails x (the
    // rail line + 2 inward steps), and the per-x tick depth alternates 3,2,2,2 across the ladder.
    const railYs = [...new Set(rails.map((point) => Number(point.y.toFixed(6))))].sort(
      (a, b) => a - b
    );
    expect(railYs.length).toBe(6);
    // Upper rail: line at railTop with two steps DOWNWARD (inward, toward the word). Lower rail:
    // line at railBottom with two steps UPWARD. Ticks point inward by design — outward ticks
    // would push the hull 0.019 further down for no legibility gain.
    expect(railYs[0]).toBeCloseTo(WORD_DECOR_BOX.railTop, 6);
    expect(railYs[5]).toBeCloseTo(WORD_DECOR_BOX.railBottom, 6);
    expect(railYs[1]).toBeCloseTo(WORD_DECOR_BOX.railTop + 0.009, 6);
    expect(railYs[2]).toBeCloseTo(WORD_DECOR_BOX.railTop + 0.018, 6);
    expect(railYs[4]).toBeCloseTo(WORD_DECOR_BOX.railBottom - 0.009, 6);
    expect(railYs[3]).toBeCloseTo(WORD_DECOR_BOX.railBottom - 0.018, 6);

    for (const [railY, inward] of [
      [WORD_DECOR_BOX.railTop, 1],
      [WORD_DECOR_BOX.railBottom, -1],
    ] as const) {
      // This rail's own three y levels: the line plus two inward steps. Used to attribute a
      // point to a rail, since both rails live at positive y and cannot be told apart by sign.
      const belongsToRail = (point: { y: number }): boolean => {
        const offset = (point.y - railY) * inward;
        return offset > -1e-9 && offset < 0.018 + 1e-9;
      };
      const onRail = rails.filter((point) => Math.abs(point.y - railY) < 1e-9);
      expect(onRail.length).toBe(25);
      const xs = onRail.map((point) => point.x).sort((a, b) => a - b);
      expect(xs[0]).toBeCloseTo(WORD_BAND.left, 9);
      expect(xs[24]).toBeCloseTo(WORD_BAND.right, 9);
      // Evenly spaced ladder.
      const step = (WORD_BAND.right - WORD_BAND.left) / 24;
      for (let index = 0; index < 25; index += 1) {
        expect(xs[index]).toBeCloseTo(WORD_BAND.left + step * index, 9);
      }
      // Depth per x: 3 for a major tick (every 4th), 2 otherwise — the full sequence, so a
      // change to `majorEvery` or `majorSteps` cannot pass.
      const depths = xs.map(
        (x) => rails.filter((point) => Math.abs(point.x - x) < 1e-9 && belongsToRail(point)).length
      );
      expect(depths).toEqual([
        3, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 3,
      ]);
    }

    // Dust sits OUTSIDE the type's own box (rejection-sampled), otherwise it reads as noise
    // inside the letters.
    const bandBottom = WORD_BAND.top + WORD_BAND.height;
    for (const point of dust) {
      const insideType =
        point.x > 0.12 &&
        point.x < 0.88 &&
        point.y > WORD_BAND.top - 0.015 &&
        point.y < bandBottom + 0.015;
      expect(insideType).toBe(false);
    }
  });

  it('renders ACTION as six 7x9 particle letters on one dark-gold ramp', () => {
    const targets = buildWordTargets('ACTION');
    expect(targets.map((point) => point.letter ?? -1).sort((a, b) => a - b)[0]).toBe(0);
    expect(new Set(targets.map((point) => point.letter))).toEqual(new Set([0, 1, 2, 3, 4, 5]));

    // Reconstruct each letter's stencil from the emitted points and assert its SHAPE.
    //
    // The row count alone (the previous assertion) is a 9 that 7x9, 5x9 and a single lit column
    // all satisfy: it counts distinct y values and says nothing about the stencils. The spec
    // (§3.2) is "7x9 with TWO-CELL strokes" — 2/9 ≈ 22% stroke-to-cap-height, against the 1/7
    // ≈ 14% hairline it replaced — so the width and the stroke thickness are the actual claims,
    // and both are checked below on the reconstructed grid.
    const cellW = (WORD_BAND.right - WORD_BAND.left) / 52;
    const cellH = WORD_BAND.height / 9;
    const hairlineCounts: number[] = [];
    const litCounts: number[] = [];
    for (let letter = 0; letter < 6; letter += 1) {
      const points = targets.filter((point) => point.letter === letter);
      // Cell CENTRES are emitted (`(row + 0.5) * cellH`), so the index is the floor of the
      // normalised offset. Rounding would land on row + 1 for every point.
      const rowOf = (point: { y: number }): number =>
        Math.floor((point.y - WORD_BAND.top) / cellH + 1e-9);
      const rows = [...new Set(points.map(rowOf))];
      expect(rows.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

      const originX = Math.min(...points.map((point) => point.x));
      // `originX` is the first LIT cell's centre, so column offsets are already integers here.
      const columnOf = (point: { x: number }): number => Math.round((point.x - originX) / cellW);
      const cells = new Set(points.map((point) => `${rowOf(point)}:${columnOf(point)}`));
      // Every letter spans the full 7-column box: max column index is exactly 6.
      const columns = points.map(columnOf);
      expect(Math.min(...columns)).toBe(0);
      expect(Math.max(...columns)).toBe(6);

      // TWO-CELL strokes: every lit cell belongs to at least one solid 2x2 block, i.e. there is
      // no single-cell hairline anywhere. This is the assertion that fails if the stencils are
      // swapped back to the 5x7 single-cell set, and it cannot be satisfied by a wider-but-thin
      // glyph the way a column-count check can.
      const inBlock = (row: number, column: number): boolean => {
        for (const [dr, dc] of [
          [0, 0],
          [-1, 0],
          [0, -1],
          [-1, -1],
        ] as const) {
          const r = row + dr;
          const c = column + dc;
          if (
            cells.has(`${r}:${c}`) &&
            cells.has(`${r + 1}:${c}`) &&
            cells.has(`${r}:${c + 1}`) &&
            cells.has(`${r + 1}:${c + 1}`)
          ) {
            return true;
          }
        }
        return false;
      };
      const hairlines = [...cells].filter((key) => {
        const [row, column] = key.split(':').map(Number);
        return !inBlock(row, column);
      });
      hairlineCounts.push(hairlines.length);
      litCounts.push(points.length);
    }

    // A, C and N each carry exactly two diagonal-joint cells that no 2x2 block covers (A's apex
    // shoulders, C's terminals, N's diagonal); T, I and O are fully two-cell. Asserted as the
    // exact vector plus the exact per-letter ink, so thinning ANY stencil back toward a hairline
    // is red rather than absorbed into a tolerance.
    expect(hairlineCounts).toEqual([2, 2, 0, 0, 0, 2]);
    expect(litCounts).toEqual([42, 34, 35, 43, 44, 42]);

    // Total lit cells, so a wholesale stencil swap (any set that still happens to be 7 wide and
    // 9 tall with thick strokes) is still a red test.
    expect(targets.length).toBe(240);

    // The six RGB stops, exactly, in order. Plus the property they were chosen for: monotonically
    // rising luminance across the word (A dark bronze → N warm white), all on the warm side of
    // the wheel — the 暗金不要用青色 decree, expressed as r > g > b on every stop.
    const stops = Array.from({ length: 6 }, (_, index) => letterRamp(index));
    expect(stops).toEqual([
      '96, 70, 34',
      '150, 112, 54',
      '190, 146, 74',
      '216, 162, 74',
      '236, 215, 150',
      '245, 238, 220',
    ]);
    const luminance = stops.map((stop) => {
      const [r, g, b] = stop.split(', ').map(Number);
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    for (let index = 1; index < luminance.length; index += 1) {
      expect(luminance[index]).toBeGreaterThan(luminance[index - 1]);
    }
    // Clamped at both ends, so an out-of-range letter index cannot silently pick a neighbour's
    // stop: the canvas indexes this table directly with `target.letter`.
    expect(letterRamp(-3)).toBe(stops[0]);
    expect(letterRamp(99)).toBe(stops[5]);
  });

  it('keeps both aperiodic walks moving inside their hard bounds', () => {
    const settled = Array.from({ length: 12 }, (_, seed) => makeWalk(seed + 100));
    const hovering = Array.from({ length: 12 }, (_, seed) => makeWalk(seed + 500));
    let maxSettled = 0;
    let maxHover = 0;

    for (let frame = 0; frame < 60 * 30; frame += 1) {
      for (const walk of settled) {
        stepWalk(walk, 1 / 60);
        maxSettled = Math.max(maxSettled, Math.hypot(walk.x, walk.y));
      }
      for (const walk of hovering) {
        stepHover(walk, 1 / 60);
        maxHover = Math.max(maxHover, Math.hypot(walk.x, walk.y));
      }
    }

    expect(maxSettled).toBeGreaterThan(WORD_WALK_MAX * 0.2);
    expect(maxSettled).toBeLessThanOrEqual(WORD_WALK_MAX + Number.EPSILON);
    expect(maxHover).toBeGreaterThan(HOVER_MAX * 0.2);
    expect(maxHover).toBeLessThanOrEqual(HOVER_MAX + Number.EPSILON);

    for (let seed = 0; seed < 100; seed += 1) {
      const anchor = hoverAnchor(seed);
      const inset = Math.min(anchor.x, 1 - anchor.x, anchor.y, 1 - anchor.y);
      expect(inset).toBeGreaterThan(HOVER_MAX);
    }
  });

  // Drives the REAL draw loop against a recording 2D context, so the colour grading is checked as
  // behaviour rather than as source text.
  //
  // This exists because the structural checks could not tell a graded word from a flat one. The
  // AST test counted `letterRamp` calls (`toBe(1)`), which `letterRamp(0)` satisfies — and a
  // constant index paints all six letters the same colour, i.e. precisely the 字太平 / flat-WARM
  // bug §3.2 records. Only running the loop and reading back the fills can catch that.
  it('paints each ACTION letter its own ramp stop when the draw loop runs', async () => {
    const fills: string[] = [];
    const rects: Array<{ x: number; y: number; fill: string }> = [];
    const context = {
      setTransform: (): void => {},
      clearRect: (): void => {},
      fillRect: (x: number, y: number): void => {
        rects.push({ x, y, fill: String(context.fillStyle) });
        fills.push(String(context.fillStyle));
      },
      beginPath: (): void => {},
      moveTo: (): void => {},
      lineTo: (): void => {},
      stroke: (): void => {},
      fillStyle: '' as string | CanvasGradient | CanvasPattern,
      strokeStyle: '' as string | CanvasGradient | CanvasPattern,
      lineWidth: 0,
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalRect = HTMLCanvasElement.prototype.getBoundingClientRect;
    const originalObserver = globalThis.ResizeObserver;
    HTMLCanvasElement.prototype.getContext = function getContext(): typeof context {
      return context;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getBoundingClientRect = function rect(): DOMRect {
      return { width: 390, height: 560, top: 0, left: 0, right: 390, bottom: 560 } as DOMRect;
    };
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof globalThis.ResizeObserver;

    try {
      // Progress parked at 1: the board has landed, so the ACTION word is fully assembled and
      // every letter is at full alpha — the frame the grading claim is about.
      const progress = motionValue(1);
      const phase = motionValue<AnimatePhase>('entered');
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await reactAct(async () => {
        root.render(createElement(ClapperboardCanvas, { progress, phase }));
      });

      expect(fills.length).toBeGreaterThan(0);
      const stops = Array.from({ length: 6 }, (_, index) => letterRamp(index));
      // Every ramp stop actually reaches the canvas. A constant index (letterRamp(0)) produces
      // exactly ONE of these, so this is the assertion that kills that mutation.
      const used = stops.filter((stop) => fills.some((fill) => fill.startsWith(`rgba(${stop},`)));
      expect(used).toEqual(stops);

      // And the stops are laid out left-to-right in ramp order, which is what "per LETTER" means:
      // grading by a constant, or by a shuffled index, would break the ordering even if all six
      // colours appeared somewhere. Compared by each stop's mean x across the frame.
      const meanX = stops.map((stop) => {
        const matching = rects.filter((entry) => entry.fill.startsWith(`rgba(${stop},`));
        expect(matching.length).toBeGreaterThan(0);
        return matching.reduce((sum, entry) => sum + entry.x, 0) / matching.length;
      });
      for (let index = 1; index < meanX.length; index += 1) {
        expect(meanX[index]).toBeGreaterThan(meanX[index - 1]);
      }

      await reactAct(async () => {
        root.unmount();
      });
      container.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.getBoundingClientRect = originalRect;
      globalThis.ResizeObserver = originalObserver;
    }
  });

  it('wires shared geometry, particle motion, light descriptors, and the phase gate', () => {
    const canvas = parse(CANVAS_FILE);
    const calls = new Map<string, number>();
    walk(canvas, (node) => {
      if (!ts.isCallExpression(node)) return;
      const name = node.expression.getText();
      calls.set(name, (calls.get(name) ?? 0) + 1);
    });

    expect(calls.get('buildWordTargets')).toBe(1);
    expect(calls.get('buildWordDecorTargets')).toBe(1);
    expect(calls.get('hoverAnchor')).toBeGreaterThanOrEqual(2);
    expect(calls.get('stepHover')).toBeGreaterThanOrEqual(2);
    expect(calls.get('stepWalk')).toBeGreaterThanOrEqual(2);
    expect(calls.get('letterRamp')).toBe(1);
    // WHICH index that single call passes. `toBe(1)` counts calls and says nothing about the
    // argument, so `letterRamp(0)` — a flat word, the exact colour bug §3.2 was written to fix —
    // satisfied it. The runtime behaviour is pinned by the draw-loop test below; this is the
    // cheap structural half: the argument must be the particle's own letter field.
    const letterRampArgs: string[] = [];
    walk(canvas, (node) => {
      if (!ts.isCallExpression(node)) return;
      if (node.expression.getText() !== 'letterRamp') return;
      letterRampArgs.push(node.arguments.map((argument) => argument.getText()).join(', '));
    });
    expect(letterRampArgs).toEqual(['part.letter']);

    const runtime = stripComments(fs.readFileSync(CANVAS_FILE, 'utf8'));
    expect(runtime).toContain("buildWordTargets('ACTION')");
    expect(runtime).toContain('(width * 0.96) / CLAPPER_EXTENT.w');
    expect(runtime).toContain('(height * 0.96) / CLAPPER_EXTENT.h');
    expect(runtime).toContain("paused = nextPhase === 'exited' || nextPhase === 'idle'");
    expect(runtime).toContain("phase.on('change', applyPhase)");
    expect(runtime).toContain('cancelAnimationFrame(rafRef.current)');
    expect(runtime).not.toMatch(/ringAngle|ringSpeed/);

    const lightRuntime = stripComments(fs.readFileSync(LIGHT_FILE, 'utf8'));
    expect(lightRuntime).toContain('ACT2_LIGHT_LAYERS.map((layer) =>');
    expect(lightRuntime).toContain('animateId={layer.id}');
    expect(lightRuntime).not.toContain('loopAnimation');
    expect(lightRuntime).not.toContain('s02-light-spill');
  });
});
