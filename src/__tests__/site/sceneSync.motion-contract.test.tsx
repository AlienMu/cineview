import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SceneSync } from '../../../site/src/components/temporal-drag/SceneSync';

interface CapturedAnimateProps {
  animateId?: string;
  enterAnimation?: {
    initial?: Record<string, unknown>;
    animate?: Record<string, unknown>;
  };
  duration?: { enter?: number; exit?: number };
  timeline?: { delay?: number };
  infiniteAnimation?: unknown;
  children?: ReactNode;
}

const mockAnimateProps: CapturedAnimateProps[] = [];
const V1_IDS = ['s03-v1-clip-1', 's03-v1-clip-2', 's03-v1-clip-3'] as const;
const V2_IDS = ['s03-v2-sub-1', 's03-v2-sub-2', 's03-v2-sub-3'] as const;
const OUTER_IDS = [...V1_IDS, ...V2_IDS] as const;
const INNER_IDS = OUTER_IDS.map((id) => `${id}-fade`);
// V1 only: each block is selected, then dragged. V2 subtitles are placed, not assembled.
const DEMO_IDS = V1_IDS.map((id) => `${id}-demo`);
const SELECT_IDS = V1_IDS.map((id) => `${id}-select`);
// One badge per adjacent pair — two pairs for three clips.
const SEAM_IDS = ['s03-clip-seam-1', 's03-clip-seam-2'] as const;

jest.mock(
  'cineview',
  () => ({
    Animate: (props: CapturedAnimateProps) => {
      mockAnimateProps.push(props);
      return <>{props.children}</>;
    },
    useAnimateTimeline: () => ({
      progress: { get: () => 0, on: () => () => undefined },
      phase: { get: () => 'entered', on: () => () => undefined },
    }),
  }),
  { virtual: true }
);

jest.mock('../../../site/src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../site/src/components/temporal-drag/TemporalMotion', () => ({
  useTemporalMotion: () => ({
    reduced: false,
    duration: (milliseconds: number) => milliseconds,
    delay: (milliseconds: number) => milliseconds,
    stagger: (milliseconds: number) => milliseconds,
    seconds: (seconds: number) => seconds,
  }),
}));

jest.mock('../../../site/src/components/temporal-drag/TimelinePlayhead', () => ({
  TimelinePlayhead: () => null,
}));

jest.mock('../../../site/src/components/temporal-drag/waveform/WaveformCanvas', () => ({
  WaveformCanvas: () => null,
}));

function lane(animateId: string): CapturedAnimateProps {
  const match = mockAnimateProps.find((props) => props.animateId === animateId);
  if (!match) throw new Error(`Missing Animate lane: ${animateId}`);
  return match;
}

function sortedKeys(value: Record<string, unknown> | undefined): string[] {
  return Object.keys(value ?? {}).sort();
}

/** `"-44.444%"` -> -44.444. Throws rather than returning NaN, so a lane that stopped authoring
 *  a percentage fails loudly instead of silently comparing NaN. */
function percent(value: unknown): number {
  if (typeof value !== 'string' || !value.endsWith('%')) {
    throw new Error(`Expected a percentage string, got ${JSON.stringify(value)}`);
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) throw new Error(`Unparseable percentage: ${value}`);
  return parsed;
}

/** The authored (separated) track layout, read from the DOM rather than imported: the slots carry
 *  `--s03-slot-left` / `--s03-slot-width` as fractions of the track, which is the same geometry
 *  the push percentages are computed against. */
function readV1Slots(container: HTMLElement): { left: number; width: number }[] {
  return V1_IDS.map((_, index) => {
    const slot = container.querySelectorAll<HTMLElement>('.s03-clip-slot')[index];
    if (!slot) throw new Error(`Missing V1 slot ${index}`);
    return {
      left: Number.parseFloat(slot.style.getPropertyValue('--s03-slot-left')) / 100,
      width: Number.parseFloat(slot.style.getPropertyValue('--s03-slot-width')) / 100,
    };
  });
}

describe('SceneSync motion contract', () => {
  beforeEach(() => {
    mockAnimateProps.length = 0;
  });

  it('shows all three V1 blocks in place before anything is dragged', () => {
    render(<SceneSync />);

    // 「直接出现全部内容」 — the appear lane carries NO horizontal travel. It used to enter at
    // `x: -36`, which fused the entrance and the drag into one motion so the cut was never seen
    // before a hand moved it. The stroke is now a separate lane (`-demo`, asserted below).
    for (const animateId of V1_IDS) {
      const appear = lane(animateId);
      expect(appear.enterAnimation).toEqual({
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
      });
      expect(sortedKeys(appear.enterAnimation?.initial)).toEqual(['opacity', 'scale']);
      expect(appear.enterAnimation?.initial).not.toHaveProperty('x');
      expect(appear.enterAnimation?.animate).not.toHaveProperty('x');
    }

    // Every appear lane completes before the FIRST stroke begins, or a block would still be
    // fading up while being dragged.
    const lastAppearEnd = Math.max(
      ...V1_IDS.map((id) => (lane(id).timeline?.delay ?? 0) + (lane(id).duration?.enter ?? 0))
    );
    const firstStrokeStart = Math.min(...DEMO_IDS.map((id) => lane(id).timeline?.delay ?? 0));
    expect(firstStrokeStart).toBeGreaterThanOrEqual(lastAppearEnd);
  });

  it('drags each block once, in order, with selection leading each stroke', () => {
    render(<SceneSync />);

    const strokeStarts = DEMO_IDS.map((id) => lane(id).timeline?.delay ?? 0);

    for (const [index, animateId] of DEMO_IDS.entries()) {
      const demo = lane(animateId);

      // ONE-SHOT, not a loop: 「不是持续动画，而是入场动画」. An `infiniteAnimation` here is the
      // exact regression — it would also re-introduce the anonymous wrapper node that once
      // collapsed clip 2 to 2px tall.
      expect(demo.infiniteAnimation).toBeUndefined();

      // Leftward travel, and `x` in percent (of the block's own box) so the lap survives every
      // viewport width — a px stroke would only assemble correctly at one track width.
      expect(sortedKeys(demo.enterAnimation?.initial)).toEqual(['opacity', 'x']);
      expect(percent(demo.enterAnimation?.initial?.x)).toBe(0);
      expect(percent(demo.enterAnimation?.animate?.x)).toBeLessThan(0);

      // Opacity pinned on both ends: the stroke moves the block, it does not re-fade it.
      expect(demo.enterAnimation?.initial?.opacity).toBe(1);
      expect(demo.enterAnimation?.animate?.opacity).toBe(1);

      // Selection precedes the stroke it belongs to («选中第一块拖一下»).
      const select = lane(SELECT_IDS[index]);
      expect(select.timeline?.delay ?? 0).toBeLessThan(strokeStarts[index]);
      expect(select.enterAnimation).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      });
    }

    // Three strictly sequential strokes: each finishes before the next starts, so the track
    // reads as a hand working left to right rather than as three blocks sliding at once.
    for (let index = 1; index < strokeStarts.length; index += 1) {
      const previousEnd =
        strokeStarts[index - 1] + (lane(DEMO_IDS[index - 1]).duration?.enter ?? 0);
      expect(strokeStarts[index]).toBeGreaterThan(strokeStarts[index - 1]);
      expect(strokeStarts[index]).toBeGreaterThanOrEqual(previousEnd);
    }
  });

  it('lands the three blocks lapped together, and marks each lap with a badge', () => {
    const { container } = render(<SceneSync />);

    // The END STATE is the requirement («拖成三块并拢重叠»), so it is reconstructed here from the
    // authored geometry and the authored strokes rather than trusted: final left edge =
    // slot left + (push% of slot width). The old looping version returned to its start, so the
    // track never reached an assembled state at all and this check is what pins that shut.
    const slots = readV1Slots(container);
    const assembled = slots.map((slot, index) => {
      const push = percent(lane(DEMO_IDS[index]).enterAnimation?.animate?.x) / 100;
      const left = slot.left + push * slot.width;
      return { left, right: left + slot.width };
    });

    // The run closes up on the track's left edge.
    expect(assembled[0].left).toBeCloseTo(0, 3);

    // Every adjacent pair OVERLAPS, by the same amount — the lap is one constant in the source,
    // so two different overlaps here would mean the assembly walk had been hand-transcribed.
    const laps = assembled.slice(1).map((block, index) => assembled[index].right - block.left);
    for (const lap of laps) expect(lap).toBeGreaterThan(0);
    expect(laps[0]).toBeCloseTo(laps[1], 3);

    // One badge per lap, each appearing only once its own stroke has landed.
    expect(SEAM_IDS).toHaveLength(laps.length);
    for (const [index, seamId] of SEAM_IDS.entries()) {
      const seam = lane(seamId);
      expect(seam.infiniteAnimation).toBeUndefined();
      const strokeEnd =
        (lane(DEMO_IDS[index + 1]).timeline?.delay ?? 0) +
        (lane(DEMO_IDS[index + 1]).duration?.enter ?? 0);
      expect(seam.timeline?.delay ?? 0).toBeGreaterThanOrEqual(strokeEnd);
    }
  });

  it('keeps the 10% fast fade on inner lanes without another animated property', () => {
    render(<SceneSync />);

    const capturedMotionIds = mockAnimateProps
      .map((props) => props.animateId)
      .filter(
        (id): id is string =>
          typeof id === 'string' && (id.startsWith('s03-v1-clip-') || id.startsWith('s03-v2-sub-'))
      )
      .sort();
    expect(capturedMotionIds).toEqual(
      [...OUTER_IDS, ...INNER_IDS, ...DEMO_IDS, ...SELECT_IDS].sort()
    );

    for (const outerId of OUTER_IDS) {
      const outer = lane(outerId);
      const inner = lane(`${outerId}-fade`);

      expect(inner.enterAnimation).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      });
      expect(sortedKeys(inner.enterAnimation?.initial)).toEqual(['opacity']);
      expect(sortedKeys(inner.enterAnimation?.animate)).toEqual(['opacity']);
      expect(inner.duration?.enter).toBe((outer.duration?.enter ?? Number.NaN) * 0.1);
    }
  });

  it('keeps a complete horizontal stroke on the V2 subtitles', () => {
    render(<SceneSync />);

    // V2 is unchanged by the V1 rework: a subtitle is PLACED under its shot, so it keeps the
    // pull-in-from-the-left entrance. Only the blur was removed (a CSS concern, asserted in the
    // stylesheet's own contract).
    for (const animateId of V2_IDS) {
      expect(lane(animateId).enterAnimation).toEqual({
        initial: { opacity: 1, x: -24 },
        animate: { opacity: 1, x: 0 },
      });
      expect(lane(animateId).duration?.enter).toBe(500);
    }
  });
});
