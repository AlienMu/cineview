/**
 * Independent unit tests for directScrollHelpers.
 *
 * These pure functions were originally inline in DirectScrollCineView.tsx, covered only indirectly by component tests.
 * After phase 1 extraction and phase 2 span parser merge, these tests directly cover the core algorithms:
 *  - resolveScrollIntentOffset: center-lock skip prevention reducer (design.md rule 13)
 *  - resolveScrollSceneDeclaredSpan / resolveTakeoverSceneSpan: equivalence across branches after merge
 *    (number/px design conversion, floor-to-1 difference, vh/vw, auto/invalid)
 *  - normalizeWheelDeltaPx / normalizeKeyboardDeltaPx: input normalization boundaries
 *  - buildSceneTimelineState: phase determination and sceneProgress
 */

import {
  buildSceneTimelineState,
  clamp,
  resolveDesignDimensions,
  normalizeKeyboardDeltaPx,
  normalizeTouchDeltaPx,
  normalizeWheelDeltaPx,
  resolveScrollIntentOffset,
  resolveScrollSceneDeclaredSpan,
  resolveTakeoverSceneSpan,
  shouldDeferToNestedScrollable,
  shouldIgnoreGlobalScrollKey,
  isSceneElement,
  isLegacyDisplayNameSceneElement,
  isScrollDebugEnabled,
  type CenterLockSegment,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
} from './directScrollHelpers';
import { createElement, forwardRef, memo } from 'react';

describe('clamp', () => {
  it('clamps to [min, max] range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('isScrollDebugEnabled', () => {
  it('lets the CineView entry switch explicitly override the global probe', () => {
    const previous = (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean })
      .__CINEVIEW_SCROLL_DEBUG__;
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ = true;
    expect(isScrollDebugEnabled(false)).toBe(false);
    expect(isScrollDebugEnabled(true)).toBe(true);
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ =
      previous;
  });
});

describe('resolveScrollIntentOffset', () => {
  it('returns clamped current offset when deltaPx is 0', () => {
    expect(resolveScrollIntentOffset({ currentOffset: 50, deltaPx: 0, maxNativeOffset: 100 })).toBe(
      50
    );
    expect(
      resolveScrollIntentOffset({ currentOffset: 150, deltaPx: 0, maxNativeOffset: 100 })
    ).toBe(100);
  });

  it('advances linearly by delta and clamps when no segments', () => {
    expect(
      resolveScrollIntentOffset({ currentOffset: 10, deltaPx: 30, maxNativeOffset: 100 })
    ).toBe(40);
    expect(
      resolveScrollIntentOffset({ currentOffset: 90, deltaPx: 30, maxNativeOffset: 100 })
    ).toBe(100);
  });

  it('Infinity / -Infinity jumps directly to boundary (Home/End keys)', () => {
    expect(
      resolveScrollIntentOffset({
        currentOffset: 50,
        deltaPx: Number.POSITIVE_INFINITY,
        maxNativeOffset: 100,
      })
    ).toBe(100);
    expect(
      resolveScrollIntentOffset({
        currentOffset: 50,
        deltaPx: Number.NEGATIVE_INFINITY,
        maxNativeOffset: 100,
      })
    ).toBe(0);
  });

  it('forward large input crossing complete segment clamps to segmentStart+1 (rule 13: produce at least one in-segment frame)', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // from before segment (50) jumping to after segment (400), must first land inside segment at segmentStart+1=101
    const result = resolveScrollIntentOffset({
      currentOffset: 50,
      deltaPx: 350,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(101);
  });

  it('forward input from inside segment crossing segmentEnd clamps to segmentEnd', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // currently inside segment (150), target crosses segment end (400) → clamps to segmentEnd=300
    const result = resolveScrollIntentOffset({
      currentOffset: 150,
      deltaPx: 250,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(300);
  });

  it('forward from segmentStart crossing complete segment enters segment first', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    const result = resolveScrollIntentOffset({
      currentOffset: 100,
      deltaPx: 1000,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(101);
  });

  it('reverse large input crossing complete segment clamps to segmentEnd-1', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // from after segment (400) jumping to before segment (50), must first land inside segment at segmentEnd-1=299
    const result = resolveScrollIntentOffset({
      currentOffset: 400,
      deltaPx: -350,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(299);
  });

  it('reverse input from inside segment crossing segmentStart clamps to segmentStart', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // currently inside segment (250), target crosses segment start (50) → clamps to segmentStart=100
    const result = resolveScrollIntentOffset({
      currentOffset: 250,
      deltaPx: -200,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(100);
  });

  it('reverse from segmentEnd crossing complete segment enters segment first', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    const result = resolveScrollIntentOffset({
      currentOffset: 300,
      deltaPx: -1000,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(299);
  });

  it('small input (< boundary epsilon) returns target directly without triggering segment detection', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    const result = resolveScrollIntentOffset({
      currentOffset: 150,
      deltaPx: 0.3,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBeCloseTo(150.3, 5);
  });

  it('does not repeat the entry frame when native scrolling rounds a fractional boundary', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100.5, segmentEnd: 300.5 }];
    // Native scrollLeft rounds 299.5 to 300. That is an interior frame, not a
    // fresh crossing, so the next reverse input must continue to the start.
    expect(
      resolveScrollIntentOffset({
        currentOffset: 300,
        deltaPx: -1000,
        maxNativeOffset: 1000,
        segments,
      })
    ).toBe(100.5);
    // The corresponding half-pixel interior frame must also advance forward.
    expect(
      resolveScrollIntentOffset({
        currentOffset: 101,
        deltaPx: 1000,
        maxNativeOffset: 1000,
        segments,
      })
    ).toBe(300.5);
  });
});

describe('span parsers: declared vs takeover branch equivalence/differences', () => {
  const makeProps = (size: number | string): SceneAuthoringCompatProps =>
    ({ layout: { height: size } }) as SceneAuthoringCompatProps;

  describe('resolveScrollSceneDeclaredSpan (no design conversion, no floor)', () => {
    it('returns number as-is', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps(500), 'y', 375, 667)).toBe(500);
    });

    it('returns px as-is', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('480px'), 'y', 375, 667)).toBe(480);
    });

    it('converts vh by viewport height', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('50vh'), 'y', 375, 667)).toBeCloseTo(
        333.5,
        5
      );
    });

    it('returns null for auto / invalid / non-positive', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('auto'), 'y', 375, 667)).toBeNull();
      expect(resolveScrollSceneDeclaredSpan(makeProps('abc'), 'y', 375, 667)).toBeNull();
      expect(resolveScrollSceneDeclaredSpan(makeProps(0), 'y', 375, 667)).toBeNull();
    });
  });

  describe('resolveTakeoverSceneSpan (approach A single ruler: absolute values no conversion→null, only vh/vw preserved)', () => {
    it('returns null for number (absolute design value) → caller falls back to DOM measurement', () => {
      // Under single ruler model, there is no independent height ruler, takeover absolute values always null.
      expect(resolveTakeoverSceneSpan(1000, 375, 667)).toBeNull();
    });

    it('returns null for px (absolute pixels) as well', () => {
      expect(resolveTakeoverSceneSpan('1000px', 375, 667)).toBeNull();
    });

    it('preserves vh with viewport conversion (no design ruler needed)', () => {
      // 50vh @ viewport height 667 → 333.5, floored to ≥1
      expect(resolveTakeoverSceneSpan('50vh', 375, 667)).toBeCloseTo(333.5, 5);
    });

    it('preserves vw with viewport conversion', () => {
      // 80vw @ viewport width 375 → 300
      expect(resolveTakeoverSceneSpan('80vw', 375, 667)).toBeCloseTo(300, 5);
    });

    it('floors vh result to ≥1 (extremely small values)', () => {
      // 0.1vh @ 667 ≈ 0.667 → floors to 1
      expect(resolveTakeoverSceneSpan('0.1vh', 375, 667)).toBe(1);
    });

    it('returns null for auto / invalid', () => {
      expect(resolveTakeoverSceneSpan('auto', 375, 667)).toBeNull();
      expect(resolveTakeoverSceneSpan(undefined, 375, 667)).toBeNull();
    });
  });
});

describe('normalizeWheelDeltaPx', () => {
  it('returns pixel value as-is when deltaMode=0', () => {
    expect(normalizeWheelDeltaPx(40, 0, 667)).toBe(40);
  });

  it('multiplies by 18 when deltaMode=1 (lines)', () => {
    expect(normalizeWheelDeltaPx(3, 1, 667)).toBe(54);
  });

  it('multiplies by viewport span when deltaMode=2 (pages)', () => {
    expect(normalizeWheelDeltaPx(2, 2, 667)).toBe(1334);
  });

  it('returns 0 for zero or non-finite values', () => {
    expect(normalizeWheelDeltaPx(0, 0, 667)).toBe(0);
    expect(normalizeWheelDeltaPx(Number.NaN, 0, 667)).toBe(0);
  });
});

describe('normalizeTouchDeltaPx', () => {
  it('returns finite values as-is, returns 0 for non-finite', () => {
    expect(normalizeTouchDeltaPx(25)).toBe(25);
    expect(normalizeTouchDeltaPx(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('normalizeKeyboardDeltaPx', () => {
  it('PageDown/PageUp are ±0.86 viewport span', () => {
    expect(normalizeKeyboardDeltaPx('PageDown', false, 1000)).toBe(860);
    expect(normalizeKeyboardDeltaPx('PageUp', false, 1000)).toBe(-860);
  });

  it('spacebar direction determined by shift key', () => {
    expect(normalizeKeyboardDeltaPx(' ', false, 1000)).toBe(860);
    expect(normalizeKeyboardDeltaPx(' ', true, 1000)).toBe(-860);
  });

  it('arrow keys have fixed line step ±80', () => {
    expect(normalizeKeyboardDeltaPx('ArrowDown', false, 1000)).toBe(80);
    expect(normalizeKeyboardDeltaPx('ArrowUp', false, 1000)).toBe(-80);
  });

  it('Home/End are ∓Infinity', () => {
    expect(normalizeKeyboardDeltaPx('Home', false, 1000)).toBe(Number.NEGATIVE_INFINITY);
    expect(normalizeKeyboardDeltaPx('End', false, 1000)).toBe(Number.POSITIVE_INFINITY);
  });

  it('other keys return 0', () => {
    expect(normalizeKeyboardDeltaPx('Enter', false, 1000)).toBe(0);
  });
});

describe('shouldDeferToNestedScrollable', () => {
  function setupNestedScroller(): {
    root: HTMLDivElement;
    scroller: HTMLDivElement;
    child: HTMLButtonElement;
  } {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    const child = document.createElement('button');
    scroller.style.overflowY = 'auto';
    scroller.appendChild(child);
    root.appendChild(scroller);
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 500 });
    return { root, scroller, child };
  }

  it('keeps forward input in a nested scroller until its lower boundary', () => {
    const { root, scroller, child } = setupNestedScroller();
    scroller.scrollTop = 120;
    expect(shouldDeferToNestedScrollable(child, root, 'y', 80)).toBe(true);

    scroller.scrollTop = 400;
    expect(shouldDeferToNestedScrollable(child, root, 'y', 80)).toBe(false);
  });

  it('keeps reverse input in a nested scroller until its upper boundary', () => {
    const { root, scroller, child } = setupNestedScroller();
    scroller.scrollTop = 120;
    expect(shouldDeferToNestedScrollable(child, root, 'y', -80)).toBe(true);

    scroller.scrollTop = 0;
    expect(shouldDeferToNestedScrollable(child, root, 'y', -80)).toBe(false);
  });

  it('does not defer non-element or zero-delta input', () => {
    const { root, child } = setupNestedScroller();
    expect(shouldDeferToNestedScrollable(null, root, 'y', 80)).toBe(false);
    expect(shouldDeferToNestedScrollable(child, root, 'y', 0)).toBe(false);
  });

  it('supports horizontal nested scroll ownership', () => {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    const child = document.createElement('button');
    scroller.style.overflowX = 'auto';
    scroller.appendChild(child);
    root.appendChild(scroller);
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 500 });
    scroller.scrollLeft = 120;

    expect(shouldDeferToNestedScrollable(child, root, 'x', 80)).toBe(true);
    scroller.scrollLeft = 400;
    expect(shouldDeferToNestedScrollable(child, root, 'x', 80)).toBe(false);
  });
});

describe('scene discovery and keyboard ownership helpers', () => {
  it('recognizes explicit and wrapped Scene markers without relying on displayName', () => {
    function MarkedScene(): React.JSX.Element {
      return createElement('div');
    }
    (MarkedScene as typeof MarkedScene & { cineViewScene?: boolean }).cineViewScene = true;

    function NamedScene(): React.JSX.Element {
      return createElement('div');
    }
    (NamedScene as typeof NamedScene & { displayName?: string }).displayName = 'Scene';

    const Wrapped = memo(MarkedScene);
    const WrappedNamedScene = memo(NamedScene);
    const PlainScene = (): React.JSX.Element => createElement('div');
    const LegacyRender = (): React.JSX.Element => createElement('div');
    (LegacyRender as typeof LegacyRender & { displayName?: string }).displayName = 'Scene';
    const ForwardLegacyScene = forwardRef<HTMLDivElement>(LegacyRender);

    expect(isSceneElement(createElement(MarkedScene))).toBe(true);
    expect(isSceneElement(createElement(NamedScene))).toBe(false);
    expect(isSceneElement(createElement(Wrapped))).toBe(true);
    expect(isSceneElement(createElement('div'))).toBe(false);
    expect(isSceneElement('scene')).toBe(false);

    expect(isLegacyDisplayNameSceneElement(createElement(MarkedScene))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement(NamedScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(WrappedNamedScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(ForwardLegacyScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(Wrapped))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement(PlainScene))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement('div'))).toBe(false);
    expect(isLegacyDisplayNameSceneElement('scene')).toBe(false);
  });

  it('keeps space keys on controls and editable fields', () => {
    const button = document.createElement('button');
    const input = document.createElement('input');
    const section = document.createElement('section');

    expect(
      shouldIgnoreGlobalScrollKey(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    ).toBe(false);
    Object.defineProperty(button, 'tagName', { value: 'BUTTON' });
    Object.defineProperty(input, 'tagName', { value: 'INPUT' });
    const keyEvent = (key: string, target: Element): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      Object.defineProperty(event, 'target', { configurable: true, value: target });
      return event;
    };
    expect(shouldIgnoreGlobalScrollKey(keyEvent(' ', button))).toBe(true);
    expect(shouldIgnoreGlobalScrollKey(keyEvent('ArrowDown', input))).toBe(true);
    expect(shouldIgnoreGlobalScrollKey(keyEvent('ArrowDown', section))).toBe(false);
  });
});

describe('buildSceneTimelineState', () => {
  const layout: SceneLayoutInfo = {
    sceneStart: 100,
    sceneEnd: 500,
    visualSpan: 400,
    flowSpan: 400,
    timelineDistancePx: 0,
    centerLockOffset: 0,
    segmentStart: 0,
    segmentEnd: 0,
    enterLength: 100,
    exitLength: 100,
    stackMode: 'cover',
  };

  it('returns null when layout is null', () => {
    expect(buildSceneTimelineState(null, 0, 667)).toBeNull();
  });

  it('phase=before when viewport is before scene', () => {
    const state = buildSceneTimelineState(layout, 0, 50);
    expect(state?.phase).toBe('before');
  });

  it('phase=after when viewport completely passes scene, enter/exit progress=1', () => {
    const state = buildSceneTimelineState(layout, 600, 100);
    expect(state?.phase).toBe('after');
    expect(state?.enterProgress).toBe(1);
    expect(state?.exitProgress).toBe(1);
  });

  it('sceneProgress linear based on viewport center relative to scene range', () => {
    // viewport center = 300+667/2... use small viewport for easier assertion: scrollOffset=200,span=100 → center=250
    const state = buildSceneTimelineState(layout, 200, 100);
    // (250-100)/(500-100)=150/400=0.375
    expect(state?.sceneProgress).toBeCloseTo(0.375, 5);
  });
});

describe('resolveDesignDimensions (A2: config fallback + invalid size recovery)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Invalid size goes to console.error (preserving drag root's existing 'Invalid designWidth' diagnostic contract).
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('falls back to 750 when designWidth is missing, without diagnostic (missing is valid usage)', () => {
    // Before fix: designWidth directly dereferenced old config.size path.
    expect(resolveDesignDimensions(undefined)).toEqual({ designSize: 750 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('falls back to 750 when designWidth is not provided, without diagnostic', () => {
    expect(resolveDesignDimensions(undefined)).toEqual({ designSize: 750 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('falls back to 750 for designWidth=0 with dev diagnostic (0 ?? 750 === 0 would produce Infinity scale)', () => {
    expect(resolveDesignDimensions(0)).toEqual({ designSize: 750 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid designWidth'));
  });

  it('falls back to 750 for negative / NaN / Infinity', () => {
    expect(resolveDesignDimensions(-10)).toEqual({ designSize: 750 });
    expect(resolveDesignDimensions(Number.NaN)).toEqual({ designSize: 750 });
    expect(resolveDesignDimensions(Number.POSITIVE_INFINITY)).toEqual({
      designSize: 750,
    });
  });

  it('returns valid positive number as-is, without diagnostic', () => {
    expect(resolveDesignDimensions(600)).toEqual({ designSize: 600 });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
