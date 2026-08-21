import { act } from 'react';
import { render } from '@testing-library/react';
import { createKeyedScrollExternalStore } from '../CineView/scrollExternalStore';
import type { SceneScrollTimelineState, SceneScrollZoneRuntime } from '../Scene/sceneScrollRuntime';
import { useAnimateScroll } from './useAnimateScroll';

function createZoneState(progressPx: number): SceneScrollTimelineState {
  return {
    zoneId: 'zone-hotpath',
    sceneIndex: 0,
    progressPx,
    totalBudgetPx: 100,
    active: progressPx > 0 && progressPx < 100,
    direction: progressPx > 0 ? 'forward' : null,
    approach: 'inside',
    sequence: {
      totalDurationMs: 100,
      totalBudgetPx: 100,
      budgets: {
        probe: {
          animateId: 'probe',
          startMs: 0,
          enterStartMs: 0,
          enterEndMs: 100,
          exitStartMs: null,
          exitEndMs: null,
          totalEndMs: 100,
          startPx: 0,
          enterStartPx: 0,
          enterEndPx: 100,
          exitStartPx: null,
          exitEndPx: null,
          totalEndPx: 100,
          hasExit: false,
        },
      },
    },
  };
}

describe('useAnimateScroll progress hot path', () => {
  it('updates visual MotionValue without rerendering the React consumer per frame', () => {
    const initialState = createZoneState(0);
    const store = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({ 'zone-hotpath': initialState }, (snapshot, zoneId) => snapshot[zoneId]);
    const runtime: SceneScrollZoneRuntime = {
      zoneStates: {},
      store,
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };
    let renderCount = 0;
    const resultRef = { current: null as ReturnType<typeof useAnimateScroll> | null };

    function Probe(): JSX.Element {
      renderCount += 1;
      resultRef.current = useAnimateScroll({
        sceneContext: null,
        zoneRuntime: runtime,
        zoneId: 'zone-hotpath',
        enterVariant: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: {} },
        exitVariant: null,
        hasAuthoredEnterAnimation: true,
        hasAuthoredExitAnimation: false,
        componentId: 'probe',
        duration: { enter: 100, exit: 0 },
        timeline: { driver: 'scroll', delay: 0 },
        visibility: { replayOnReenter: true },
      });
      return <output data-testid="render-count">{renderCount}</output>;
    }

    render(<Probe />);
    expect(resultRef.current).not.toBeNull();
    const settledRenderCount = renderCount;

    act(() => {
      store.setSnapshot({ 'zone-hotpath': createZoneState(50) });
    });

    expect(resultRef.current?.visualMotion.get()).toBeCloseTo(0.5);
    expect(renderCount).toBe(settledRenderCount);

    act(() => {
      store.setSnapshot({ 'zone-hotpath': createZoneState(75) });
    });
    expect(resultRef.current?.visualMotion.get()).toBeCloseTo(0.75);
    expect(renderCount).toBe(settledRenderCount);

    act(() => {
      store.setSnapshot({ 'zone-hotpath': createZoneState(100) });
    });
    expect(resultRef.current?.visualMotion.get()).toBe(1);
    // This probe has no infiniteAnimation. Reaching the enter boundary must not
    // run a second per-frame zone consumer or trigger an unused React state flip.
    expect(renderCount).toBe(settledRenderCount);
  });

  it('gates scroll infinite lanes from the production keyed store shape', () => {
    const store = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({ 'zone-hotpath': createZoneState(0) }, (snapshot, zoneId) => snapshot[zoneId]);
    const runtime: SceneScrollZoneRuntime = {
      zoneStates: {},
      store,
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };
    const resultRef = { current: null as ReturnType<typeof useAnimateScroll> | null };

    function Probe(): JSX.Element {
      resultRef.current = useAnimateScroll({
        sceneContext: null,
        zoneRuntime: runtime,
        zoneId: 'zone-hotpath',
        enterVariant: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: {} },
        exitVariant: null,
        hasAuthoredEnterAnimation: true,
        hasAuthoredExitAnimation: false,
        hasInfiniteAnimation: true,
        componentId: 'probe',
        duration: { enter: 100, exit: 0 },
        timeline: { driver: 'scroll', delay: 0 },
        visibility: { replayOnReenter: true },
      });
      return <output data-testid="infinite-probe" />;
    }

    render(<Probe />);
    expect(resultRef.current?.shouldRunInfinite).toBe(false);
    act(() => {
      store.setSnapshot({ 'zone-hotpath': createZoneState(100) });
    });
    // The authored enter segment is complete; the real provider has no
    // zoneStates object, so this assertion catches accidental fallback reads.
    expect(resultRef.current?.shouldRunInfinite).toBe(true);
  });
});
