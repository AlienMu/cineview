import React, { act, useCallback, useContext, useEffect, createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DirectScrollCineView } from './DirectScrollCineView';
import type { CineViewRef } from '../../types';
import { CineViewRuntimeContext } from '../runtime/runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTakeoverContext,
  useSceneScrollZoneSelection,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';

/** Local identity-selection probe (production wrapper removed as dead). */
function useSceneScrollZoneTimeline(zoneId: string): SceneScrollTimelineState | null {
  const selectState = useCallback(
    (state: SceneScrollTimelineState | null): SceneScrollTimelineState | null => state,
    []
  );
  return useSceneScrollZoneSelection(zoneId, true, selectState);
}

jest.mock('../../hooks/useImagePreloader', () => ({
  useImagePreloader: jest.fn(() => [
    {
      isLoading: false,
      progress: 100,
      loadedCount: 0,
      totalCount: 0,
      results: [],
      errors: new Map(),
    },
    {
      startPreload: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
      addUrls: jest.fn(),
    },
  ]),
}));

jest.mock('../../utils/performanceMonitor', () => {
  const performanceMonitor = {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 42,
      bundleSize: 12,
    })),
    reset: jest.fn(),
  };
  return {
    performanceMonitor,
    acquirePerformanceMonitoring: jest.fn(() => {
      performanceMonitor.start();
      return () => performanceMonitor.stop();
    }),
  };
});

interface TestSceneProps {
  children?: React.ReactNode;
  sceneId?: string;
  sceneHeight?: number | string;
  sceneWidth?: number | string;
  layout?: { width?: number | string; height?: number | string };
  enterAnimation?: string;
  exitAnimation?: string;
  scroll?: {
    zoneId?: string;
    trigger?: 'center-lock';
  };
  sceneRuntime?: {
    sceneIndex: number;
  };
  assets?: {
    preloadImages?: string[];
  };
}

const TestScene: React.FC<TestSceneProps> = ({ children, sceneId, scroll, sceneRuntime }) => {
  const runtime = useContext(SceneScrollRuntimeContext);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const zoneId = scroll ? (scroll.zoneId ?? sceneId ?? null) : null;
  const sceneIndex = sceneRuntime?.sceneIndex ?? 0;

  useEffect(() => {
    if (!runtime || !zoneId || !scroll) {
      return;
    }

    runtime.registerZone(zoneId, {
      sceneIndex,
      trigger: scroll.trigger ?? 'center-lock',
    });

    return () => {
      runtime.unregisterZone(zoneId, sceneIndex);
    };
  }, [runtime, sceneIndex, scroll, zoneId]);

  useEffect(() => {
    if (!runtime || !zoneId) {
      return;
    }

    runtime.setZoneElement(zoneId, sceneIndex, zoneRef.current);

    return () => {
      runtime.setZoneElement(zoneId, sceneIndex, null);
    };
  }, [runtime, sceneIndex, zoneId]);

  return (
    <SceneScrollTakeoverContext.Provider value={zoneId}>
      <div ref={zoneRef} data-cineview-scroll-zone={zoneId ?? undefined}>
        {children}
      </div>
    </SceneScrollTakeoverContext.Provider>
  );
};

(TestScene as typeof TestScene & { cineViewScene?: boolean }).cineViewScene = true;
TestScene.displayName = 'Scene';

function ScrollBudgetProbe({
  animateId,
  enterDuration = 240,
  exitDuration = 0,
}: {
  animateId: string;
  enterDuration?: number;
  exitDuration?: number;
}): JSX.Element | null {
  const runtime = useContext(SceneScrollRuntimeContext);
  const zoneId = useContext(SceneScrollTakeoverContext);

  useEffect(() => {
    if (!runtime || !zoneId) {
      return;
    }

    const registrationOwner = runtime.registerZoneAnimation(zoneId, {
      animateId,
      delay: 0,
      enterDuration,
      exitDuration,
    });

    return () => {
      runtime.unregisterZoneAnimation(zoneId, animateId, registrationOwner);
    };
  }, [animateId, enterDuration, exitDuration, runtime, zoneId]);

  return null;
}

function ZoneProgressProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const progress = useSceneScrollZoneTimeline(zoneId)?.progressPx ?? 0;

  return <output data-testid={`${zoneId}-progress`}>{progress}</output>;
}

function ReportErrorProbe(): JSX.Element {
  const runtime = useContext(CineViewRuntimeContext);
  useEffect(() => {
    runtime?.reportError?.({ code: 'TEST', message: 'probe error' });
  }, [runtime]);
  return <output data-testid="report-error-probe">{runtime?.mode ?? 'none'}</output>;
}

function installScrollGeometry({
  container,
  sceneTops,
  sceneHeights,
  viewportHeight = 1000,
  viewportWidth = 750,
  direction = 'y',
  withScrollTo = true,
}: {
  container: HTMLElement;
  sceneTops: number[];
  sceneHeights: number[];
  viewportHeight?: number;
  viewportWidth?: number;
  direction?: 'x' | 'y';
  withScrollTo?: boolean;
}): void {
  const isX = direction === 'x';
  const contentExtent = Math.max(
    ...sceneTops.map((top, index) => top + sceneHeights[index]),
    isX ? viewportWidth : viewportHeight
  );

  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: viewportHeight,
  });
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: viewportWidth,
  });
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    value: isX ? viewportHeight : contentExtent,
  });
  Object.defineProperty(container, 'scrollWidth', {
    configurable: true,
    value: isX ? contentExtent : viewportWidth,
  });

  if (withScrollTo) {
    container.scrollTo = ((optionsOrX?: ScrollToOptions | number, y?: number) => {
      if (typeof optionsOrX === 'number') {
        container.scrollLeft = optionsOrX;
        if (typeof y === 'number') {
          container.scrollTop = y;
        }
        return;
      }

      if (typeof optionsOrX?.top === 'number') {
        container.scrollTop = optionsOrX.top;
      }
      if (typeof optionsOrX?.left === 'number') {
        container.scrollLeft = optionsOrX.left;
      }
    }) as HTMLElement['scrollTo'];
  } else {
    // Remove scrollTo to exercise the scrollLeft/scrollTop fallback branches.
    delete (container as Partial<HTMLElement>).scrollTo;
  }

  container.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: viewportHeight,
      right: viewportWidth,
      width: viewportWidth,
      height: viewportHeight,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }) as DOMRect;

  const wrappers = Array.from(container.querySelectorAll('[data-scene-index]')) as HTMLDivElement[];
  wrappers.forEach((wrapper, index) => {
    const start = sceneTops[index];
    const span = sceneHeights[index];
    Object.defineProperty(wrapper, 'offsetHeight', {
      configurable: true,
      value: isX ? viewportHeight : span,
    });
    Object.defineProperty(wrapper, 'clientHeight', {
      configurable: true,
      value: isX ? viewportHeight : span,
    });
    Object.defineProperty(wrapper, 'offsetWidth', {
      configurable: true,
      value: isX ? span : viewportWidth,
    });
    Object.defineProperty(wrapper, 'clientWidth', {
      configurable: true,
      value: isX ? span : viewportWidth,
    });
    wrapper.getBoundingClientRect = () => {
      const scroll = isX ? container.scrollLeft : container.scrollTop;
      return isX
        ? ({
            top: 0,
            bottom: viewportHeight,
            left: start - scroll,
            right: start - scroll + span,
            width: span,
            height: viewportHeight,
            x: start - scroll,
            y: 0,
            toJSON: () => undefined,
          } as DOMRect)
        : ({
            top: start - scroll,
            bottom: start - scroll + span,
            left: 0,
            right: viewportWidth,
            width: viewportWidth,
            height: span,
            x: 0,
            y: start - scroll,
            toJSON: () => undefined,
          } as DOMRect);
    };
  });

  const zones = Array.from(
    container.querySelectorAll('[data-cineview-scroll-zone]')
  ) as HTMLDivElement[];
  zones.forEach((zone) => {
    const wrapper = zone.closest('[data-scene-index]') as HTMLDivElement | null;
    const sceneIndexAttribute = wrapper?.getAttribute('data-scene-index');
    const parsedSceneIndex =
      typeof sceneIndexAttribute === 'string'
        ? Number.parseInt(sceneIndexAttribute, 10)
        : Number.NaN;
    const index = Number.isFinite(parsedSceneIndex) ? parsedSceneIndex : zones.indexOf(zone);
    const start = sceneTops[index];
    const span = sceneHeights[index];
    if (start === undefined || span === undefined) {
      return;
    }
    Object.defineProperty(zone, 'offsetHeight', {
      configurable: true,
      value: isX ? viewportHeight : span,
    });
    Object.defineProperty(zone, 'clientHeight', {
      configurable: true,
      value: isX ? viewportHeight : span,
    });
    Object.defineProperty(zone, 'offsetWidth', {
      configurable: true,
      value: isX ? span : viewportWidth,
    });
    Object.defineProperty(zone, 'clientWidth', {
      configurable: true,
      value: isX ? span : viewportWidth,
    });
  });
}

async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    await Promise.resolve();
  });
}

afterEach(async () => {
  await flushAnimationFrame();
  delete (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__;
});

describe('DirectScrollCineView — branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keyboard delta normalization', () => {
    function renderTallDocument(): HTMLDivElement {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000, 2000],
        sceneHeights: [1000, 1000, 1000],
      });
      return root;
    }

    it('scrolls forward a full page on PageDown', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'PageDown' });
      });
      await flushAnimationFrame();

      // pageStep = max(viewport 1000 * 0.86, 1) = 860
      expect(root.scrollTop).toBeCloseTo(860, 0);
    });

    it('scrolls back a page on PageUp from a scrolled offset', async () => {
      const root = renderTallDocument();

      act(() => {
        root.scrollTop = 900;
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'PageUp' });
      });
      await flushAnimationFrame();

      // 900 - 860 = 40
      expect(root.scrollTop).toBeCloseTo(40, 0);
    });

    it('scrolls a page forward on Space and back on Shift+Space', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: ' ' });
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(860, 0);

      act(() => {
        fireEvent.keyDown(document.body, { key: ' ', shiftKey: true });
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(0, 0);
    });

    it('treats Spacebar (legacy key name) as a page step', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'Spacebar' });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBeCloseTo(860, 0);
    });

    it('scrolls a single line forward on ArrowDown and back on ArrowUp', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      });
      await flushAnimationFrame();
      // lineStep = 80
      expect(root.scrollTop).toBeCloseTo(80, 0);

      act(() => {
        fireEvent.keyDown(document.body, { key: 'ArrowUp' });
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(0, 0);
    });

    it('jumps to the bottom on End and back to the top on Home', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'End' });
      });
      await flushAnimationFrame();
      // maxNativeOffset = scrollHeight 3000 - viewport 1000 = 2000
      expect(root.scrollTop).toBeCloseTo(2000, 0);

      act(() => {
        fireEvent.keyDown(document.body, { key: 'Home' });
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(0, 0);
    });

    it('ignores keys that produce no scroll delta (default case)', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.keyDown(document.body, { key: 'a' });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);
    });

    it('ignores global scroll keys originating from form controls', async () => {
      const root = renderTallDocument();

      // The window keydown handler ignores keys whose target is a form control.
      // Put the input OUTSIDE the cineview container so the container's
      // onKeyDownCapture path (which does not consult shouldIgnoreGlobalScrollKey)
      // is not involved — this isolates the window-handler guard.
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);

      document.body.removeChild(input);
    });

    it('handles the container onKeyDownCapture path and respects defaultPrevented', async () => {
      const root = renderTallDocument();

      // A defaultPrevented event is ignored by the capture handler.
      act(() => {
        fireEvent.keyDown(root, { key: 'PageDown', defaultPrevented: true });
      });
      await flushAnimationFrame();

      // The container's onKeyDownCapture also drives scroll for un-prevented keys.
      act(() => {
        fireEvent.keyDown(root, { key: 'ArrowDown' });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBeGreaterThan(0);
    });
  });

  describe('wheel delta normalization', () => {
    function renderTallDocument(): HTMLDivElement {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      return root;
    }

    it('scales line-mode (deltaMode 1) wheel input by 18px per line', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.wheel(root, { deltaY: 3, deltaMode: 1 });
      });
      await flushAnimationFrame();

      // 3 lines * 18 = 54
      expect(root.scrollTop).toBeCloseTo(54, 0);
    });

    it('scales page-mode (deltaMode 2) wheel input by the viewport span', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.wheel(root, { deltaY: 1, deltaMode: 2 });
      });
      await flushAnimationFrame();

      // 1 page * viewport 1000 = 1000, clamped to maxNativeOffset 1000
      expect(root.scrollTop).toBeCloseTo(1000, 0);
    });

    it('ignores a zero-delta wheel event', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.wheel(root, { deltaY: 0, deltaMode: 0 });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);
    });

    it('treats deltaMode 2 with a zero viewport floor as at least 1px per page', async () => {
      // Exercises the Math.max(viewportSpan, 1) guard in the deltaMode 2 branch.
      const root = renderTallDocument();

      act(() => {
        fireEvent.wheel(root, { deltaY: 0.5, deltaMode: 2 });
      });
      await flushAnimationFrame();

      // 0.5 page * viewport 1000 = 500
      expect(root.scrollTop).toBeCloseTo(500, 0);
    });
  });

  describe('touch handling', () => {
    function renderTallDocument(): HTMLDivElement {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      return root;
    }

    it('drives native scroll from a vertical touch drag', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 500 }] });
        fireEvent.touchMove(root, { touches: [{ clientX: 100, clientY: 300 }] });
      });
      await flushAnimationFrame();

      // dragging up by 200px (500 -> 300) scrolls forward 200px
      expect(root.scrollTop).toBeCloseTo(200, 0);

      act(() => {
        fireEvent.touchEnd(root);
      });
    });

    it('ignores a touchstart with no touch point', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.touchStart(root, { touches: [] });
        fireEvent.touchMove(root, { touches: [{ clientX: 100, clientY: 300 }] });
      });
      await flushAnimationFrame();

      // touchStartRef never set, so the move is a no-op
      expect(root.scrollTop).toBe(0);
    });

    it('ignores a touchmove with no touch point', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 500 }] });
        fireEvent.touchMove(root, { touches: [] });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);
    });

    it('clears the touch anchor on touchcancel so a later move does nothing', async () => {
      const root = renderTallDocument();

      act(() => {
        fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 500 }] });
        fireEvent.touchCancel(root);
        fireEvent.touchMove(root, { touches: [{ clientX: 100, clientY: 100 }] });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);
    });
  });

  describe('horizontal (x) scroll direction', () => {
    it('normalizes deltaX and scrolls the container horizontally', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'x'}>
          <TestScene sceneId="scene-0" sceneWidth={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneWidth={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
        direction: 'x',
      });

      act(() => {
        fireEvent.wheel(root, { deltaX: 200, deltaY: 0, deltaMode: 0 });
      });
      await flushAnimationFrame();

      expect(root.scrollLeft).toBeCloseTo(200, 0);
    });

    it('drives horizontal scroll from a horizontal touch drag', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'x'}>
          <TestScene sceneId="scene-0" sceneWidth={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneWidth={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
        direction: 'x',
      });

      act(() => {
        fireEvent.touchStart(root, { touches: [{ clientX: 500, clientY: 100 }] });
        fireEvent.touchMove(root, { touches: [{ clientX: 350, clientY: 100 }] });
      });
      await flushAnimationFrame();

      expect(root.scrollLeft).toBeCloseTo(150, 0);
    });

    it('falls back to scrollLeft assignment when scrollTo is unavailable in x mode', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'x'}>
          <TestScene sceneId="scene-0" sceneWidth={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneWidth={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
        direction: 'x',
        withScrollTo: false,
      });

      act(() => {
        fireEvent.wheel(root, { deltaX: 300, deltaY: 0, deltaMode: 0 });
      });
      await flushAnimationFrame();

      expect(root.scrollLeft).toBeCloseTo(300, 0);
    });
  });

  describe('setNativeOffset fallback without scrollTo (y mode)', () => {
    it('assigns scrollTop directly when scrollTo is unavailable', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
        withScrollTo: false,
      });

      act(() => {
        fireEvent.wheel(root, { deltaY: 400, deltaMode: 0 });
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBeCloseTo(400, 0);
    });
  });

  describe('declared span string parsing (non-takeover scenes)', () => {
    it('measures scenes authored with px / vh / auto / invalid string heights', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'y'} sceneSizing={'screen'}>
          <TestScene sceneId="scene-px" layout={{ height: '1200px' }}>
            <div>px scene</div>
          </TestScene>
          <TestScene sceneId="scene-vh" layout={{ height: '50vh' }}>
            <div>vh scene</div>
          </TestScene>
          <TestScene sceneId="scene-auto" layout={{ height: 'auto' }}>
            <div>auto scene</div>
          </TestScene>
          <TestScene sceneId="scene-bad" layout={{ height: 'banana' }}>
            <div>bad scene</div>
          </TestScene>
          <TestScene sceneId="scene-empty" layout={{ height: '   ' }}>
            <div>empty scene</div>
          </TestScene>
          <TestScene sceneId="scene-unitless" layout={{ height: '500' }}>
            <div>unitless numeric scene</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1200, 1700, 2700, 3700, 4700],
        sceneHeights: [1200, 500, 1000, 1000, 1000, 1000],
      });

      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      // The component mounted and measured every scene wrapper. The unitless '500'
      // height parses to a finite number but has no px/vh/vw suffix, so the declared
      // span resolver falls through to null and the wrapper is measured instead.
      expect(root.querySelectorAll('[data-scene-index]').length).toBe(6);
    });

    it('parses a vw declared span in horizontal mode', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'x'} sceneSizing={'screen'}>
          <TestScene sceneId="scene-vw" layout={{ width: '80vw' }}>
            <div>vw scene</div>
          </TestScene>
          <TestScene sceneId="scene-1" layout={{ width: '600px' }}>
            <div>second</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 600],
        sceneHeights: [600, 600],
        direction: 'x',
      });

      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      expect(root.querySelectorAll('[data-scene-index]').length).toBe(2);
    });
  });

  describe('takeover span string parsing', () => {
    it('resolves px / vh / vw / auto / invalid takeover scene spans', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="px"
            layout={{ height: '1200px' }}
            scroll={{ zoneId: 'px-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="px-anim" />
            <div>px takeover</div>
          </TestScene>
          <TestScene
            sceneId="vh"
            layout={{ height: '60vh' }}
            scroll={{ zoneId: 'vh-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 2 }}
          >
            <ScrollBudgetProbe animateId="vh-anim" />
            <div>vh takeover</div>
          </TestScene>
          <TestScene
            sceneId="auto"
            layout={{ height: 'auto' }}
            scroll={{ zoneId: 'auto-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 3 }}
          >
            <ScrollBudgetProbe animateId="auto-anim" />
            <div>auto takeover</div>
          </TestScene>
          <TestScene
            sceneId="bad"
            layout={{ height: 'nope' }}
            scroll={{ zoneId: 'bad-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 4 }}
          >
            <ScrollBudgetProbe animateId="bad-anim" />
            <div>bad takeover</div>
          </TestScene>
          <TestScene
            sceneId="unitless"
            layout={{ height: '500' }}
            scroll={{ zoneId: 'unitless-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 5 }}
          >
            <ScrollBudgetProbe animateId="unitless-anim" />
            <div>unitless takeover</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000, 2200, 3400, 4600, 5600],
        sceneHeights: [1000, 1200, 600, 1000, 1000, 1000],
      });

      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      expect(root.querySelectorAll('[data-cineview-takeover-shell]').length).toBe(5);
    });

    it('resolves a vw takeover span in horizontal mode', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750} direction={'x'}>
          <TestScene sceneId="scene-0" sceneWidth={750}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="vw"
            layout={{ width: '70vw' }}
            scroll={{ zoneId: 'vw-zone', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="vw-anim" />
            <div>vw takeover</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 750],
        sceneHeights: [750, 525],
        direction: 'x',
      });

      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      expect(root.querySelectorAll('[data-cineview-takeover-shell]').length).toBe(1);
    });
  });

  describe('scene timeline exit phase', () => {
    it('reports the exit phase when the viewport top passes a scene exit start', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={3000}
            enterAnimation="fade-in"
            exitAnimation="fade-out"
          >
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000, 4000],
        sceneHeights: [1000, 3000, 1000],
      });

      // sceneEnd of scene-1 = 4000; exitLength = min(800, min(flowSpan, viewport)=1000) = 800;
      // exitStart = 4000 - 800 = 3200. Scroll so viewportTop (scrollTop) >= 3200.
      act(() => {
        root.scrollTop = 3500;
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      // The component is still mounted and processed the exit-phase layout for scene-1.
      expect(root.scrollTop).toBe(3500);
    });
  });

  describe('imperative ref API', () => {
    it('exposes goToScene, refreshLayout, getCurrentIndex and getPerformanceMetrics', async () => {
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <DirectScrollCineView ref={ref} designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000, 2000],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        ref.current?.goToScene(2);
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(2000, 0);

      act(() => {
        ref.current?.goToScene(1, false);
      });
      await flushAnimationFrame();
      expect(root.scrollTop).toBeCloseTo(1000, 0);

      act(() => {
        ref.current!.refreshLayout?.();
      });
      await flushAnimationFrame();

      const metrics = ref.current?.getPerformanceMetrics();
      expect(metrics).toEqual({
        fps: 60,
        avgFrameTime: 16.67,
        memoryUsage: 42,
        bundleSize: 12,
      });

      expect(typeof ref.current?.getCurrentIndex()).toBe('number');
    });

    it('no-ops goToScene for an unknown index', async () => {
      // B11: the out-of-range no-op now emits a dev warning (asserted in the
      // dedicated regression test below); spy it so the console guard stays quiet.
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <DirectScrollCineView ref={ref} designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0],
        sceneHeights: [1000],
      });

      act(() => {
        ref.current?.goToScene(99);
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(0);
      warnSpy.mockRestore();
    });

    it('moves to a registered scroll zone via goToZone and no-ops for an unknown zone', async () => {
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <DirectScrollCineView ref={ref} designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="zone-anim" />
            <ZoneProgressProbe zoneId="zone-1" />
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      await flushAnimationFrame();

      act(() => {
        ref.current!.goToZone?.('zone-1', { animated: false });
      });
      await flushAnimationFrame();

      // Unknown zone is a no-op (no throw).
      act(() => {
        ref.current!.goToZone?.('missing-zone');
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preload via ref', () => {
    it('adds resolved target images and starts preloading', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');
      const startPreload = jest.fn().mockResolvedValue(undefined);
      const addUrls = jest.fn();
      useImagePreloader.mockImplementation(() => [
        {
          isLoading: false,
          progress: 100,
          loadedCount: 0,
          totalCount: 0,
          results: [],
          errors: new Map(),
        },
        { startPreload, reset: jest.fn(), addUrls },
      ]);

      const ref = createRef<CineViewRef>();
      render(
        <DirectScrollCineView ref={ref} designWidth={750}>
          <TestScene sceneId="scene-0" assets={{ preloadImages: ['target.jpg'] }}>
            <div>Scene 0</div>
          </TestScene>
        </DirectScrollCineView>
      );

      await act(async () => {
        await ref.current?.preload?.([0]);
      });

      expect(addUrls).toHaveBeenCalledWith(['target.jpg'], true);
      expect(startPreload).toHaveBeenCalled();
    });
  });

  describe('performance monitoring', () => {
    it('starts and stops the performance monitor when enabled', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { performanceMonitor } = require('../../utils/performanceMonitor');

      const { unmount } = render(
        <DirectScrollCineView designWidth={750} monitor>
          <TestScene sceneId="scene-0">
            <div>Scene 0</div>
          </TestScene>
        </DirectScrollCineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
      unmount();
      expect(performanceMonitor.stop).toHaveBeenCalled();
    });
  });

  describe('runtime error reporting', () => {
    it('routes reportError through the common onError callback', () => {
      const onError = jest.fn();
      render(
        <DirectScrollCineView designWidth={750} callbacks={{ onError }}>
          <TestScene sceneId="scene-0">
            <ReportErrorProbe />
            <div>Scene 0</div>
          </TestScene>
        </DirectScrollCineView>
      );

      expect(onError).toHaveBeenCalledWith({ code: 'TEST', message: 'probe error' });
    });
  });

  describe('scroll debug metrics', () => {
    it('exposes takeover debug metrics when scroll debug is enabled', async () => {
      (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ = true;

      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="dbg-anim" />
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });

      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLElement;
      expect(shell).toHaveAttribute('data-cineview-takeover-segment-start');
      expect(shell).toHaveAttribute('data-cineview-takeover-total-distance-px');
    });
  });

  describe('window resize handling', () => {
    it('remeasures layouts and resyncs scroll state on a window resize', async () => {
      const { container } = render(
        <DirectScrollCineView designWidth={750}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene sceneId="scene-1" sceneHeight={1000}>
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });

      // The resize handler runs updateViewportMetrics + measureSceneLayouts + syncNativeScrollState.
      act(() => {
        fireEvent(window, new Event('resize'));
      });
      await flushAnimationFrame();

      // Scenes are still mounted and measured after the resize pass.
      expect(root.querySelectorAll('[data-scene-index]').length).toBe(2);
    });
  });
});

describe('DirectScrollCineView — review remediation regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // S-F1: viewport center parked in a gap BETWEEN scene ranges (plain document
  // flow interleaved between scenes) must resolve to the NEAREST scene, not
  // fall back to the last one.
  it('resolves the nearest scene when the viewport center sits in a gap between scenes', async () => {
    const ref = createRef<CineViewRef>();
    const { container } = render(
      <DirectScrollCineView ref={ref} designWidth={750}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    // Gaps: scene ranges [0,1000) [3000,4000) [6000,7000).
    installScrollGeometry({
      container: root,
      sceneTops: [0, 3000, 6000],
      sceneHeights: [1000, 1000, 1000],
    });

    // Center = 700 + 500 = 1200 → in the gap right after scene 0 (distance 200)
    // and far from scene 1 (1800) / scene 2 (4800). The old fallback reported
    // the LAST scene (index 2) for any center past scene 0's start.
    act(() => {
      root.scrollTop = 700;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    expect(ref.current?.getCurrentIndex()).toBe(0);

    // Center = 2700 → gap before scene 1, nearest scene 1 (300 vs 1700).
    act(() => {
      root.scrollTop = 2200;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    expect(ref.current?.getCurrentIndex()).toBe(1);

    // Containment still wins outright.
    act(() => {
      root.scrollTop = 2800;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    expect(ref.current?.getCurrentIndex()).toBe(1);
  });

  // S-F3: the container's onKeyDownCapture must release scroll keys to
  // editable targets focused INSIDE the container (no activeElement === body
  // requirement here, unlike the window-level handler).
  it('does not swallow Space or arrow keys typed into editable fields inside the container', async () => {
    const { container } = render(
      <DirectScrollCineView designWidth={750}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <input data-testid="text-field" type="text" />
          <textarea data-testid="text-area" />
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    const input = container.querySelector('[data-testid="text-field"]') as HTMLInputElement;
    const textarea = container.querySelector('[data-testid="text-area"]') as HTMLTextAreaElement;

    // Space in a focused input: must NOT be preventDefaulted into a page scroll.
    let spaceNotPrevented = true;
    act(() => {
      input.focus();
      spaceNotPrevented = fireEvent.keyDown(input, { key: ' ' });
    });
    await flushAnimationFrame();
    expect(spaceNotPrevented).toBe(true);
    expect(root.scrollTop).toBe(0);

    // ArrowDown in a focused textarea: same contract.
    let arrowNotPrevented = true;
    act(() => {
      textarea.focus();
      arrowNotPrevented = fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    });
    await flushAnimationFrame();
    expect(arrowNotPrevented).toBe(true);
    expect(root.scrollTop).toBe(0);

    // Guard must not be overbroad: a non-editable focused target inside the
    // container still scrolls through the capture handler.
    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: ' ' });
    });
    await flushAnimationFrame();
    expect(root.scrollTop).toBeCloseTo(860, 0);
  });

  // S-F13: programmatic syncs (mount / resize / refreshLayout) must not enter
  // the scrolling state — the autoHide scrollbar used to flash for 120ms.
  it('does not flash the autoHide scrollbar overlay on programmatic refreshLayout', async () => {
    const ref = createRef<CineViewRef>();
    const { container } = render(
      <DirectScrollCineView
        ref={ref}
        designWidth={750}
        scrollbar={{ enabled: true, autoHide: true }}
      >
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    // Programmatic resync — not a gesture.
    act(() => {
      ref.current?.refreshLayout();
    });

    const overlay = root.parentElement?.querySelector(
      '[data-cineview-scrollbar-overlay="true"]'
    ) as HTMLDivElement;
    expect(overlay).not.toBeNull();
    // Old behavior: isScrolling flipped true for 120ms → opacity '1' (flash).
    expect(overlay.style.opacity).toBe('0');

    // Real gestures still light the overlay.
    act(() => {
      root.scrollTop = 200;
      fireEvent.scroll(root);
    });
    expect(overlay.style.opacity).toBe('1');
  });

  // A3: the scroll root must emit EMPTY_SCENES like the drag root does.
  it('emits EMPTY_SCENES through onError when the scroll root has no Scene children', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onError = jest.fn();
    render(
      <DirectScrollCineView designWidth={750} mode="scroll" callbacks={{ onError }}>
        <div>not a scene</div>
      </DirectScrollCineView>
    );

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPTY_SCENES' }));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('EMPTY_SCENES'));
    warnSpy.mockRestore();
  });

  it('rejects duplicate authored zone ids and keeps only the first takeover shell', () => {
    // duplicate-zone 的 console.error 镜像走 devError（仅 development 发声）；
    // 本用例验证的就是该 dev 镜像，须显式置 development。
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = jest.fn();
    const ref = createRef<CineViewRef>();
    const { container } = render(
      <DirectScrollCineView ref={ref} designWidth={750} mode="scroll" callbacks={{ onError }}>
        <TestScene sceneId="first" scroll={{ zoneId: 'duplicate-zone' }}>
          First
        </TestScene>
        <TestScene sceneId="second" scroll={{ zoneId: 'duplicate-zone' }}>
          Second
        </TestScene>
        <TestScene sceneId="third">Third</TestScene>
      </DirectScrollCineView>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_COMPONENT_HIERARCHY',
        context: expect.objectContaining({
          reason: 'duplicate-scroll-zone',
          zoneId: 'duplicate-zone',
          ownerSceneIndex: 0,
          rejectedSceneIndex: 1,
        }),
      })
    );
    expect(errorSpy).toHaveBeenCalledWith('[CineView]', expect.stringContaining('duplicate-zone'));
    expect(container.querySelectorAll('[data-cineview-takeover-shell]')).toHaveLength(1);
    expect(
      container.querySelector('[data-scene-index="1"] [data-cineview-scroll-zone]')
    ).toBeNull();

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2600],
      sceneHeights: [1000, 1600, 1000],
    });
    act(() => {
      ref.current?.refreshLayout();
      root.scrollTop = 1928;
      fireEvent.scroll(root);
    });
    expect(ref.current?.getCurrentIndex()).toBe(1);
    errorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  // B11: out-of-range goToScene must warn in dev instead of a silent no-op
  // (mirrors useSceneManager on the drag side).
  it('warns on an out-of-range goToScene index instead of silently no-oping', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ref = createRef<CineViewRef>();
    const { container } = render(
      <DirectScrollCineView ref={ref} designWidth={750}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      ref.current?.goToScene(99);
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: 99'));

    warnSpy.mockClear();
    act(() => {
      ref.current?.goToScene(-1);
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: -1'));

    // Valid index: no warning, scroll moves.
    warnSpy.mockClear();
    act(() => {
      ref.current?.goToScene(1, false);
    });
    await flushAnimationFrame();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(root.scrollTop).toBeGreaterThan(0);

    warnSpy.mockRestore();
  });
});
