import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { SceneSync } from '../../../site/src/components/temporal-drag/SceneSync';
import {
  ACT3_FIRST_SELECTION_START_MS,
  ACT3_CLIP_DURATION_SECONDS,
  ACT3_MEDIA_CLOCK_MS,
  ACT3_MEDIA_SCRUB_DURATION_MS,
  ACT3_MEDIA_SCRUB_START_MS,
  clipSelectionStartMs,
  resolveAct3MediaState,
} from '../../../site/src/components/temporal-drag/act3MediaTimeline';

const ROOT = path.resolve(__dirname, '../../..');
const ACT3_MEDIA_FILE = path.join(ROOT, 'site/src/components/temporal-drag/Act3Media.tsx');
const ACT3_CSS_FILE = path.join(ROOT, 'site/src/styles/temporal-scenes-03-05.css');

/** Authored beats, mirrored from `act3MediaTimeline.ts` so the hold FRACTION can be asserted
 *  rather than transcribed as a magic number here. */
const SELECT_LEAD_MS = 220;
const SEGMENT_MS = 2000;

interface CapturedAnimateProps {
  animateId?: string;
  enterAnimation?: {
    initial?: Record<string, unknown>;
    /** `transition` is read for the `times` arrays — a keyframe track's SHAPE is part of the
     *  contract, not just its endpoints. */
    animate?: Record<string, unknown> & {
      transition?: { x?: { times?: number[] } };
    };
  };
  exitAnimation?: {
    exit?: Record<string, unknown>;
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
/**
 * V1 only, and **clips 2/3 only**. V2 subtitles are placed, not assembled.
 *
 * Clip 1 has no demo lane by design: its authored `left` is 0 and `CLIP_ASSEMBLY_LEFT` is also
 * 0, so its push distance is exactly zero — a stroke lane for it would animate `x` to `0%`,
 * which is both a no-op and a violation of this file's own `toBeLessThan(0)` assertion.
 * (It used to sit at `left: 0.02` and perform a redundant first stroke; the block now lands
 * flush with the track's left edge and only clips 2/3 travel to lap onto it.)
 */
const DRAGGED_IDS = V1_IDS.slice(1);
const DEMO_IDS = DRAGGED_IDS.map((id) => `${id}-demo`);
const SELECTION_IDS = DRAGGED_IDS.map((id) => `${id}-selection`);
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

// Root Jest and the linked site package resolve separate React instances. Keep this structural
// contract at the SceneSync boundary; native media behavior is covered by pure timeline tests
// below and by real-browser acceptance.
jest.mock('../../../site/src/components/temporal-drag/Act3Media', () => ({
  Act3Media: () => <video data-s03-preview-video="" />,
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

/**
 * The LAST keyframe of an `x` track, as a number.
 *
 * The demo lane authors `x` as a keyframe array now, not a single value: it holds at `0%` for
 * the selection lead, then strokes to the pushed position (`['0%', '0%', pushed]` with a
 * `times` array). The end state is the requirement here — where the block LANDS — so read the
 * final entry. A bare string is still accepted so this helper works on the V2 lanes too.
 */
function endPercent(value: unknown): number {
  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error('Empty keyframe array for x');
    return percent(value[value.length - 1]);
  }
  return percent(value);
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

  it('drags each block once, in order, with one selection overlay lane per clip', () => {
    const { container } = render(<SceneSync />);

    /**
     * One selection overlay per clip — now driven by its OWN lane, not by a stage-level
     * `data-active-selection` CSS match.
     *
     * The overlay used to be a static `<span data-s03-clip-selection={index}>` that CSS
     * revealed by matching the stage's single active index. It is now wrapped in a
     * `${clip}-selection` Animate lane whose opacity keyframes own the reveal, so the index
     * attribute (and the three CSS index rules that consumed it) are gone. Asserting on that
     * attribute would be pinning a mechanism that no longer exists; assert the lane instead.
     */
    expect(container.querySelectorAll('.s03-clip__select')).toHaveLength(DRAGGED_IDS.length);
    for (const id of DRAGGED_IDS) {
      const selection = lane(`${id}-selection`);
      // Reveals and retracts within its own segment: 0 → 1 → 1 → 0.
      expect(selection.enterAnimation?.animate?.opacity).toEqual([0, 1, 1, 0]);
      expect(selection.infiniteAnimation).toBeUndefined();

      /**
       * The overlay must stay WELDED to the stroke it annotates — same start, same span.
       *
       * Added after a mutation survived: detaching this lane (`timeline: { delay: 0 }`) made the
       * highlight flash once at the top of the act, completely decoupled from the drag it is
       * supposed to mark, and all 11 cases still passed. The lane was new in this rework and its
       * two load-bearing properties (start, span) were the only ones nobody asserted.
       */
      const pairedDemo = lane(`${id}-demo`);
      expect(selection.timeline?.delay).toBe(pairedDemo.timeline?.delay);
      expect(selection.duration?.enter).toBe(pairedDemo.duration?.enter);
    }

    for (const animateId of DEMO_IDS) {
      const demo = lane(animateId);

      // ONE-SHOT, not a loop: 「不是持续动画，而是入场动画」. An `infiniteAnimation` here is the
      // exact regression — it would also re-introduce the anonymous wrapper node that once
      // collapsed clip 2 to 2px tall.
      expect(demo.infiniteAnimation).toBeUndefined();

      // Leftward travel, and `x` in percent (of the block's own box) so the lap survives every
      // viewport width — a px stroke would only assemble correctly at one track width.
      expect(sortedKeys(demo.enterAnimation?.initial)).toEqual(['opacity', 'x']);
      expect(percent(demo.enterAnimation?.initial?.x)).toBe(0);

      /**
       * The WHOLE `x` track, not just its end.
       *
       * Two mutations survived an end-frame-only check and are the reason this is exhaustive:
       *  - middle keyframe set to `pushed` → the block teleports within the first 11% and then
       *    sits still for the remaining 89% (visually: a jump, not a drag);
       *  - the `times` midpoint set to 0 → the 220ms "selected, then dragged" hold disappears.
       * Neither is expressible as a claim about the last frame, so both used to pass.
       *
       * Shape is asserted UNCONDITIONALLY (`toHaveLength(3)`), not behind `if (Array.isArray)`:
       * a guard that only fires when the value is already an array cannot catch the structure
       * collapsing back to a bare string.
       */
      const xTrack = demo.enterAnimation?.animate?.x;
      expect(Array.isArray(xTrack)).toBe(true);
      const track = xTrack as string[];
      expect(track).toHaveLength(3);
      expect(percent(track[0])).toBe(0);
      // Beat 2 still parked: this is the hold that makes the block read as SELECTED first.
      expect(percent(track[1])).toBe(0);
      expect(percent(track[2])).toBeLessThan(0);

      // The hold's LENGTH, as a fraction of the lane — the authored 220ms lead over a 2000ms
      // segment. Without this the hold can be zeroed while every other assertion stays green.
      expect(demo.enterAnimation?.animate?.transition?.x?.times).toEqual([
        0,
        SELECT_LEAD_MS / SEGMENT_MS,
        1,
      ]);

      // Opacity pinned on both ends: the stroke moves the block, it does not re-fade it.
      expect(demo.enterAnimation?.initial?.opacity).toBe(1);
      expect(demo.enterAnimation?.animate?.opacity).toBe(1);
    }

    /**
     * The two strokes are EXACTLY CONTIGUOUS — stroke 2 begins on the frame stroke 1 lands.
     *
     * This restores a check that an earlier round deleted. Its replacement (a seam-vs-its-own-
     * stroke ordering assertion) is strictly weaker and a mutation proved it: halving the demo
     * lane duration opened a 1000ms dead gap between the two strokes — contradicting the file
     * header's "Each stroke starts on the exact frame the previous one lands" — and everything
     * stayed green, because the seam check only constrains a seam against its own stroke and
     * says nothing about the relationship BETWEEN strokes.
     */
    const strokeStarts = DEMO_IDS.map((id) => lane(id).timeline?.delay ?? 0);
    const strokeSpans = DEMO_IDS.map((id) => lane(id).duration?.enter ?? 0);
    for (let i = 1; i < strokeStarts.length; i++) {
      expect(strokeStarts[i]).toBeGreaterThan(strokeStarts[i - 1]);
      expect(strokeStarts[i]).toBe(strokeStarts[i - 1] + strokeSpans[i - 1]);
    }
  });

  it('lands the three blocks lapped together, and marks each lap with a badge', () => {
    const { container } = render(<SceneSync />);

    // The END STATE is the requirement («拖成三块并拢重叠»), so it is reconstructed here from the
    // authored geometry and the authored strokes rather than trusted: final left edge =
    // slot left + (push% of slot width). The old looping version returned to its start, so the
    // track never reached an assembled state at all and this check is what pins that shut.
    const slots = readV1Slots(container);
    // Clip 1 has NO demo lane (authored flush at left: 0, zero push) — its contribution to the
    // assembly walk is a literal 0. Only clips 2/3 carry a stroke. Indexing DEMO_IDS by the
    // slot index would read past its end here and throw on `undefined`.
    const assembled = slots.map((slot, index) => {
      const push =
        index === 0
          ? 0
          : endPercent(lane(`${V1_IDS[index]}-demo`).enterAnimation?.animate?.x) / 100;
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
      // Seam N marks the lap between clip N and clip N+1, so it waits on clip N+1's stroke —
      // which is `DEMO_IDS[index]` now that DEMO_IDS starts at clip 2.
      const strokeLane = lane(DEMO_IDS[index]);
      const strokeEnd = (strokeLane.timeline?.delay ?? 0) + (strokeLane.duration?.enter ?? 0);
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
    // Exhaustive by design: an unexpected lane here means a new animated property slipped in.
    // `-selection` lanes are the overlay reveals for the two dragged clips (see the drag test);
    // they exist because the overlay is no longer revealed by a stage-level CSS index match.
    expect(capturedMotionIds).toEqual(
      [...OUTER_IDS, ...INNER_IDS, ...DEMO_IDS, ...SELECTION_IDS].sort()
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
      expect(lane(animateId).timeline?.delay).toBe(clipSelectionStartMs(V2_IDS.indexOf(animateId)));
    }
  });

  it('uses one extended media clock and mounts the native preview video', () => {
    const { container } = render(<SceneSync />);

    expect(lane('s03-media-clock').duration?.enter).toBe(ACT3_MEDIA_CLOCK_MS);
    expect(ACT3_MEDIA_CLOCK_MS).toBe(ACT3_MEDIA_SCRUB_START_MS + ACT3_MEDIA_SCRUB_DURATION_MS);
    expect(container.querySelector('[data-s03-preview-video]')).not.toBeNull();
  });

  it('puts the V2 copy on the picture and frames the video as a centered viewport cover', () => {
    const { container } = render(<SceneSync />);
    const surface = container.querySelector('[data-s03-preview-surface]');
    const pictureSubtitles = Array.from(
      surface?.querySelectorAll<HTMLElement>('[data-s03-preview-subtitle]') ?? []
    );
    const css = fs.readFileSync(ACT3_CSS_FILE, 'utf8');

    expect(pictureSubtitles.map((node) => node.textContent)).toEqual([
      'dragTemporal.s03.sub1',
      'dragTemporal.s03.sub2',
      'dragTemporal.s03.sub3',
    ]);
    expect(css).toMatch(
      /\.s03-cut-stage > \[data-cineview-animate-id='s03-preview'\][^{]*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s
    );
    expect(css).toMatch(
      /\[data-cineview-animate-id='s03-preview-media'\] > video[^{]*\{[^}]*object-fit:\s*cover;[^}]*object-position:\s*center;/s
    );
  });

  it('uses scrub transport only, with no closing native playback owner', () => {
    const source = fs.readFileSync(ACT3_MEDIA_FILE, 'utf8');

    expect(source).not.toMatch(/\.play\s*\(/);
    expect(source).not.toContain('requestVideoFrameCallback');
    expect(source).not.toContain('playbackGate');
    expect(source).not.toMatch(/addEventListener\(\s*['"]ended['"]/);
  });

  it('blurs and fades the fullscreen video plate on exit', () => {
    render(<SceneSync />);

    expect(lane('s03-preview').enterAnimation?.animate).toMatchObject({
      opacity: 1,
      filter: 'blur(0px)',
    });
    expect(lane('s03-preview').exitAnimation?.exit).toMatchObject({
      opacity: 0,
      filter: 'blur(24px)',
    });
  });
});

describe('Act 3 media timeline', () => {
  it('keeps V1 one stroke ahead of three contiguous two-second media ranges', () => {
    expect(resolveAct3MediaState(ACT3_FIRST_SELECTION_START_MS - 1)).toEqual({
      mode: 'idle',
      mediaIndex: null,
      mediaTimeSeconds: 0,
    });

    for (let index = 0; index < 3; index += 1) {
      const mediaStart = ACT3_MEDIA_SCRUB_START_MS + index * ACT3_CLIP_DURATION_SECONDS * 1000;
      expect(resolveAct3MediaState(mediaStart)).toEqual({
        mode: 'scrub',
        mediaIndex: index,
        mediaTimeSeconds: index * 2,
      });

      expect(resolveAct3MediaState(mediaStart + (ACT3_CLIP_DURATION_SECONDS * 1000) / 2)).toEqual(
        expect.objectContaining({
          mode: 'scrub',
          mediaIndex: index,
          mediaTimeSeconds: index * 2 + 1,
        })
      );
    }

    const finalScrub = resolveAct3MediaState(ACT3_MEDIA_CLOCK_MS - 1);
    expect(finalScrub.mode).toBe('scrub');
    expect(finalScrub.mediaTimeSeconds).toBeCloseTo(6, 2);
  });

  it('holds the final frame when the third scrub completes', () => {
    expect(resolveAct3MediaState(ACT3_MEDIA_CLOCK_MS)).toEqual({
      mode: 'complete',
      mediaIndex: null,
      mediaTimeSeconds: 6,
    });
  });
});
