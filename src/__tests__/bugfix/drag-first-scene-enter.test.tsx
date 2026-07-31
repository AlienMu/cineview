/**
 * Acceptance lane: drag-mode first-screen cold-start enter animation.
 *
 * Black-box specs verified here (independent of implementation internals):
 *  1. Ready-gating: the first scene's Animate elements stay at their enter
 *     INITIAL frame (e.g. fade-in opacity 0) until priority assets settle,
 *     then play a single 0%->100% enter (ending at the rest/terminal value).
 *  2. Timeout: if priority assets don't settle within firstSceneTimeout, fire
 *     callbacks.common.onError with code FIRST_SCENE_TIMEOUT and a detail
 *     carrying preventDefault(). Two branches:
 *       - preventDefault() called  -> framework does NOT force enter, scene
 *         stays at its initial frame (consumer drives recovery).
 *       - preventDefault() omitted -> default static reveal (scene at terminal).
 *  3. Start: once priority assets settle, scene 0's element track starts a
 *     single enter pass (observed via the captured driver controller).
 *  4. delay ordering: multiple first-scene Animate elements honour their
 *     individual delays during the enter sweep.
 *  5. Enter not interrupted: background images settling mid-enter must not
 *     restart/reset the enter (driver runs once).
 *  6. No regression: scroll mode never triggers the first-scene driver; the
 *     enter is one-shot (driver runs exactly once).
 *
 * Determinism note: useAnimateDrag's style transforms recompute
 * resolveVisualState() from sceneContext at RENDER time (the motion-value
 * numeric input is ignored), so the resolved opacity for each committed frame
 * is a pure function of props. We therefore observe enter state by reading the
 * resolved opacity the motion.div mock applies at render, and we advance the
 * shared timeline by invoking the captured driver animate() onUpdate/onComplete
 * inside act(). No real requestAnimationFrame / per-frame timing is involved,
 * which keeps these assertions reliable under jsdom.
 */

import React, { createRef } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef, CineViewErrorDetail } from '../../types';
import { resetPreloadedImageCache } from '../../hooks/imagePreloadCache';

// ---------------------------------------------------------------------------
// Controllable Image: instances are tracked; loads/errors fire only when the
// test asks, so we can hold priority assets "pending" to exercise gating and
// timeout paths.
// ---------------------------------------------------------------------------
interface ControllableImageLike {
  _src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  fireLoad: () => void;
  fireError: () => void;
}
let imageInstances: ControllableImageLike[] = [];

class ControllableImage implements ControllableImageLike {
  _src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    imageInstances.push(this);
  }
  set src(value: string) {
    this._src = value;
  }
  get src(): string {
    return this._src;
  }
  fireLoad(): void {
    this.onload?.();
  }
  fireError(): void {
    this.onerror?.();
  }
}

function fireImageLoads(predicate: (src: string) => boolean): void {
  act(() => {
    imageInstances.filter((img) => predicate(img._src)).forEach((img) => img.fireLoad());
  });
}

// ---------------------------------------------------------------------------
// framer-motion mock. The drag/scene hooks recompute resolved styles at render
// time, so applying resolved values to real DOM style lets us read the
// committed opacity per animate id. animate() (used only by the first-scene
// driver in CineView) is captured so the test drives the timeline.
// ---------------------------------------------------------------------------
interface DriverController {
  target: number;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  stopped: boolean;
}
let driverControllers: DriverController[] = [];
// id -> latest resolved opacity applied at render
const latestOpacityById: Record<string, number> = {};

function resolveMotionLike(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { get?: unknown }).get === 'function'
  ) {
    return (value as { get: () => unknown }).get();
  }
  return value;
}

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactLib = require('react');

  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();
    return {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((listener) => listener(current));
      },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') return () => undefined;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  const MotionDiv = ReactLib.forwardRef(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, style, onPanStart, onPan, onPanEnd, ...props }: any, ref: any) => {
      const animateId = props['data-cineview-animate-id'];
      const resolvedStyle: Record<string, unknown> = {};
      if (style) {
        for (const key of Object.keys(style)) {
          resolvedStyle[key] = resolveMotionLike(style[key]);
        }
      }
      if (animateId && style && 'opacity' in style) {
        const opacity = resolveMotionLike(style.opacity);
        if (typeof opacity === 'number') {
          latestOpacityById[animateId] = opacity;
        }
        // Two-track model: the element track is a MotionValue driven by the
        // scene's own useElementTrack, which updates WITHOUT a React re-render
        // (real framer-motion binds style={motionValue} straight to the DOM).
        // Mirror that: subscribe to the opacity motion value's change events so
        // ticks driven purely through the motion value are still observed here,
        // exactly as the browser would paint them.
        const opacityValue = style.opacity;
        if (
          animateId &&
          opacityValue &&
          typeof opacityValue === 'object' &&
          typeof opacityValue.on === 'function'
        ) {
          ReactLib.useEffect(() => {
            const update = (latest: unknown) => {
              if (typeof latest === 'number') {
                latestOpacityById[animateId] = latest;
              }
            };
            update(opacityValue.get());
            return opacityValue.on('change', update);
          }, [opacityValue, animateId]);
        }
      }
      return ReactLib.createElement('div', { ref, ...props, style: resolvedStyle }, children);
    }
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    __esModule: true,
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      set: jest.fn(),
    }),
    // Real framer-motion useMotionValue returns a STABLE instance across renders.
    // The two-track model relies on that stability: the scene's element track is
    // a single MotionValue written by useElementTrack and read by the style
    // bindings. A fresh stub per render would swap identity mid-animation (the
    // warm-cache test re-renders when the Animate child registers), so keep it in
    // a ref to mirror production.
    useMotionValue: (initial: number) => {
      const ref = ReactLib.useRef(null);
      if (ref.current === null) {
        ref.current = createMotionValueStub(initial);
      }
      return ref.current;
    },
    useTransform: (
      source: { get: () => number; on?: (e: string, l: (v: number) => void) => () => void },
      transform: (value: number) => number
    ) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value) => motionValue.set(transform(value)));
      return motionValue;
    },
    animate: (
      _value: { set?: (next: number) => void } | number,
      target: number,
      options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
    ) => {
      const controller: DriverController = {
        target,
        onUpdate: options?.onUpdate,
        onComplete: options?.onComplete,
        stopped: false,
      };
      driverControllers.push(controller);
      // Do NOT auto-run: the test drives onUpdate/onComplete so the enter
      // sweep is observable and deterministic.
      return {
        stop: () => {
          controller.stopped = true;
        },
      };
    },
  };
});

const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

const RealImage = global.Image;

beforeEach(() => {
  imageInstances = [];
  driverControllers = [];
  for (const key of Object.keys(latestOpacityById)) delete latestOpacityById[key];
  resetPreloadedImageCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Image = ControllableImage;
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Image = RealImage;
});

// Helper: render a single-priority-image first scene with one or more Animate
// elements, in drag mode.
function renderDragFirstScene(
  options: {
    firstSceneTimeout?: number;
    onError?: (d: CineViewErrorDetail) => void;
    transitionDuration?: number;
    extraAnimate?: boolean;
  } = {}
) {
  const cineViewRef = createRef<CineViewRef>();
  const utils = render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{
        drag: {
          direction: 'y',
          transitionDuration: options.transitionDuration ?? 800,
          firstSceneTimeout: options.firstSceneTimeout,
        },
      }}
      config={{ size: 750 }}
      callbacks={{
        onError: options.onError,
      }}
    >
      <Scene assets={{ preloadImages: ['/hero.jpg'] }}>
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 200 }}
          >
            <h1>Title</h1>
          </Animate>
        </Position>
        {options.extraAnimate ? (
          <Position at={{ x: 375, y: 400 }}>
            <Animate
              animateId="subtitle"
              enterAnimation="fade-in"
              duration={{ enter: 600 }}
              timeline={{ delay: 500 }}
            >
              <h2>Subtitle</h2>
            </Animate>
          </Position>
        ) : null}
      </Scene>
      <Scene>
        <Position at={{ x: 375, y: 220 }}>
          <Animate animateId="next-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Next</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
  return { cineViewRef, ...utils };
}

describe('drag first-scene cold-start enter (acceptance lane)', () => {
  // --- Spec 1 + Spec 3 (fromPreload: true) --------------------------------
  it('holds the first scene at its enter-initial frame until priority assets settle, then enters to terminal', async () => {
    renderDragFirstScene();

    // The active scene's fade-in Animate mounts after async variant parse.
    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
    });

    // Spec 1: BEFORE priority assets settle, the element is pinned at its enter
    // initial frame (opacity 0), not snapped to terminal (1).
    expect(latestOpacityById.title).toBeLessThan(0.01);
    // The driver has not started the timeline enter yet (ready-gating).
    expect(driverControllers).toHaveLength(0);

    // Settle the first scene's priority asset.
    fireImageLoads((src) => src.includes('hero'));

    // Spec 3: once priority assets are ready, the cold-start driver starts a
    // single timeline enter pass on scene 0's element track.
    await waitFor(() => {
      expect(driverControllers.length).toBeGreaterThan(0);
    });

    // Spec 1: complete the enter sweep -> element rests at terminal (opacity 1).
    act(() => {
      driverControllers[0].onComplete?.();
    });
    await waitFor(() => {
      expect(latestOpacityById.title).toBeGreaterThan(0.99);
    });
  });

  // --- Regression: driver must cover delay + duration, not just transitionDuration
  // Repro of the real-world bug: an element with delay 1000 + enter 760 (= 1760ms
  // timeline) on the first scene, while transitionDuration is 800. The cold-start
  // driver used to drive sharedElapsedMs only 0->800 (transitionDuration), so the
  // element sat at its initial frame the whole 0->800 window (all <= delay 1000),
  // then snapped to terminal when firstSceneEnterActive flipped off — "delay
  // elapses then the element just appears instead of animating in".
  it('drives the cold-start timeline to the full registry duration (delay + duration), not just transitionDuration', async () => {
    const cineViewRef = createRef<CineViewRef>();
    render(
      <CineView
        ref={cineViewRef}
        mode="drag"
        modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
        config={{ size: 750 }}
      >
        <Scene assets={{ preloadImages: ['/hero.jpg'] }}>
          <Position at={{ x: 375, y: 220 }}>
            <Animate
              animateId="copy"
              enterAnimation="slide-up"
              duration={{ enter: 760, exit: 360 }}
              timeline={{ delay: 1000 }}
            >
              <h1>Copy</h1>
            </Animate>
          </Position>
        </Scene>
        <Scene>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="next" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Next</h1>
            </Animate>
          </Position>
        </Scene>
      </CineView>
    );

    await waitFor(() => {
      expect(latestOpacityById.copy).toBeDefined();
    });

    fireImageLoads((src) => src.includes('hero'));
    await waitFor(() => {
      expect(driverControllers.length).toBeGreaterThan(0);
    });

    // The driver target must be the full element timeline (delay 1000 + enter
    // 760 = 1760), so the delay gate (1000ms) can be crossed AND the element can
    // ramp 0->1 across the following 760ms. transitionDuration (800) alone would
    // finish entirely inside the delay window and never animate the element.
    expect(driverControllers[0].target).toBeGreaterThanOrEqual(1760);

    // Mid-sweep, just past the delay, the element must be partway through its
    // enter (not still 0, not snapped to 1). At elapsed 1380ms:
    // localProgress = (1380 - 1000) / 760 = 0.5.
    act(() => {
      driverControllers[0].onUpdate?.(1380);
    });
    await waitFor(() => {
      expect(latestOpacityById.copy).toBeGreaterThan(0.2);
    });
    expect(latestOpacityById.copy).toBeLessThan(0.8);
  });

  // --- Regression: cold-start driver must read the registry duration under the
  // WARM-CACHE ordering race. When the priority image resolves (onload) BEFORE
  // the Animate children finish their async variant parse and register their
  // delay + duration, preloadState.priorityComplete fires first and the driver
  // starts immediately. If the driver reads the reported sharedTimelineDurationMs
  // at that instant it sees only the stale base transitionDuration (the registry
  // report has not propagated yet), so it under-drives the timeline: the element
  // sits at its initial frame through the whole sweep and then snaps to terminal
  // — "delay elapses, element just appears instead of animating in". The driver
  // must resolve the full registry duration regardless of registration timing.
  it('drives the full registry duration under the warm-cache ordering (asset settles before registration)', async () => {
    const cineViewRef = createRef<CineViewRef>();
    render(
      <CineView
        ref={cineViewRef}
        mode="drag"
        modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
        config={{ size: 750 }}
      >
        <Scene assets={{ preloadImages: ['/hero.jpg'] }}>
          <Position at={{ x: 375, y: 220 }}>
            <Animate
              animateId="copy"
              enterAnimation="slide-up"
              duration={{ enter: 760, exit: 360 }}
              timeline={{ delay: 1000 }}
            >
              <h1>Copy</h1>
            </Animate>
          </Position>
        </Scene>
        <Scene>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="next" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Next</h1>
            </Animate>
          </Position>
        </Scene>
      </CineView>
    );

    // Fire the priority asset IMMEDIATELY — before awaiting the async variant
    // parse — to reproduce the warm-cache race where the image is ready before
    // the Animate child has registered its delay + duration.
    fireImageLoads((src) => src.includes('hero'));

    // The driver starts (assets ready). Under the warm-cache race the first tween
    // may target the stale base 800, but the extend-on-growth path must re-target
    // to the full element timeline (delay 1000 + enter 760 = 1760) once the
    // registry report propagates — continuing from the current elapsed, never
    // resetting. So the LATEST live driver must reach >= 1760. Before the fix the
    // driver stayed at 800, the element never crossed its 1000ms delay gate, and
    // it snapped to terminal.
    await waitFor(() => {
      const live = driverControllers.filter((c) => !c.stopped);
      expect(live.some((c) => c.target >= 1760)).toBe(true);
    });

    // Drive the re-targeted tween to mid-sweep, just past the delay (elapsed
    // 1380ms -> localProgress (1380-1000)/760 = 0.5). The element must be partway
    // through its enter (animating), not snapped to terminal.
    const active = driverControllers.filter((c) => !c.stopped && c.target >= 1760).pop();
    expect(active).toBeDefined();
    act(() => {
      active!.onUpdate?.(1380);
    });
    // eslint-disable-next-line no-console
    await waitFor(() => {
      expect(latestOpacityById.copy).toBeGreaterThan(0.2);
    });
    expect(latestOpacityById.copy).toBeLessThan(0.8);
  });

  it('waits for the first non-empty prepared snapshot when scene 0 has no assets', async () => {
    render(
      <React.StrictMode>
        <CineView
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 680 } }}
          config={{ size: 390 }}
        >
          <Scene>
            <Animate animateId="copy" enterAnimation="fade-in" duration={{ enter: 640 }}>
              <h1>Copy</h1>
            </Animate>
            <Animate
              animateId="sub"
              enterAnimation="slide-up"
              duration={{ enter: 700 }}
              timeline={{ waitFor: 'copy', delay: 80 }}
            >
              <p>Sub</p>
            </Animate>
          </Scene>
          <Scene>
            <Animate animateId="next" enterAnimation="fade-in" duration={{ enter: 400 }}>
              <h1>Next</h1>
            </Animate>
          </Scene>
        </CineView>
      </React.StrictMode>
    );

    // With no priority assets, firstSceneEnterReady becomes true immediately.
    // The empty T=0 registry snapshot must not consume the one-shot before the
    // async presets register and publish the real scene-0 playback snapshot.
    await waitFor(() => {
      expect(latestOpacityById.copy).toBeDefined();
      expect(latestOpacityById.sub).toBeDefined();
    });
    await waitFor(() => {
      const live = driverControllers.filter((controller) => !controller.stopped);
      expect(live.some((controller) => controller.target >= 1420)).toBe(true);
    });

    const active = driverControllers
      .filter((controller) => !controller.stopped && controller.target >= 1420)
      .pop();
    expect(active).toBeDefined();
    act(() => {
      active!.onUpdate?.(320);
    });
    await waitFor(() => {
      expect(latestOpacityById.copy).toBeGreaterThan(0.1);
    });
    expect(latestOpacityById.copy).toBeLessThan(0.9);
    expect(latestOpacityById.sub).toBeLessThan(0.01);
  });

  // --- Spec 2: timeout + preventDefault() called --------------------------
  it('emits FIRST_SCENE_TIMEOUT with preventDefault(); when called, scene stays at initial', async () => {
    let captured: CineViewErrorDetail | null = null;
    const onError = jest.fn((detail: CineViewErrorDetail) => {
      captured = detail;
      // Consumer takes over recovery.
      detail.preventDefault?.();
    });

    renderDragFirstScene({ firstSceneTimeout: 60, onError });

    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
    });
    // Priority asset never settles -> timeout fires.
    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    expect(captured).not.toBeNull();
    const detail = captured as unknown as CineViewErrorDetail;
    expect(detail.code).toBe('FIRST_SCENE_TIMEOUT');
    expect(typeof detail.preventDefault).toBe('function');

    // preventDefault() called -> framework does NOT force a reveal; the scene
    // remains at its enter-initial frame and the driver never starts.
    expect(driverControllers).toHaveLength(0);
    expect(latestOpacityById.title).toBeLessThan(0.01);
  });

  // --- Spec 2: timeout + preventDefault() NOT called (static reveal) ------
  it('falls back to a static reveal (terminal) when preventDefault() is not called on timeout', async () => {
    const onError = jest.fn(); // does not call preventDefault
    renderDragFirstScene({ firstSceneTimeout: 60, onError });

    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
    });
    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    const detail = onError.mock.calls[0][0] as CineViewErrorDetail;
    expect(detail.code).toBe('FIRST_SCENE_TIMEOUT');

    // Default fallback: the first scene is statically placed at its terminal
    // (rest) visual so the page is usable.
    await waitFor(() => {
      expect(latestOpacityById.title).toBeGreaterThan(0.99);
    });
  });

  // --- Spec 4: delay ordering --------------------------------------------
  it('honours per-element delays during the first-scene enter sweep', async () => {
    renderDragFirstScene({ extraAnimate: true });

    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
      expect(latestOpacityById.subtitle).toBeDefined();
    });

    fireImageLoads((src) => src.includes('hero'));
    await waitFor(() => {
      expect(driverControllers.length).toBeGreaterThan(0);
    });

    // Cold-start uses REAL-TIME playback (useScrub=false, 2026-06-29): elements
    // enter at their authored ms offsets, NOT scrubbed by drag ratio. The driver
    // runs the scene track in real ms and each element reads (m - delay) / dur
    // directly, so the title (delay 200) leads the subtitle (delay 500) by a real
    // 300ms — the first-screen sweep preserves authored timing.
    // At track elapsed=300ms: title = (300-200)/600 ~= 0.167; subtitle is still
    // before its 500ms delay -> 0.
    act(() => {
      driverControllers[0].onUpdate?.(300);
    });

    await waitFor(() => {
      expect(latestOpacityById.title).toBeGreaterThan(0.05);
    });
    // The earlier-delay element leads the later-delay one.
    expect(latestOpacityById.title).toBeGreaterThan(latestOpacityById.subtitle + 0.05);
    expect(latestOpacityById.subtitle).toBeLessThan(0.01);
  });

  // --- Spec 5: enter not interrupted by background image settling ---------
  it('does not restart the enter when more images settle mid-enter', async () => {
    renderDragFirstScene();

    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
    });

    // Settle priority -> enter starts (one driver run).
    fireImageLoads((src) => src.includes('hero'));
    await waitFor(() => {
      expect(driverControllers).toHaveLength(1);
    });

    // Advance the enter partway.
    act(() => {
      driverControllers[0].onUpdate?.(300);
    });

    // Any further images settling (e.g. adjacent/background scene assets) must
    // NOT spawn a second driver run nor stop the in-flight one.
    fireImageLoads(() => true);
    await Promise.resolve();

    expect(driverControllers).toHaveLength(1);
    expect(driverControllers[0].stopped).toBe(false);
  });

  // --- Spec 6: no regression in scroll mode -------------------------------
  it('never triggers the first-scene driver in scroll mode', async () => {
    const onError = jest.fn();
    render(
      <CineView
        mode="scroll"
        modes={{ scroll: { direction: 'y' } }}
        config={{ size: 750 }}
        callbacks={{ onError }}
      >
        <Scene scroll={{ zoneId: 'z0' }} assets={{ preloadImages: ['/hero.jpg'] }}>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="s-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Scroll Title</h1>
            </Animate>
          </Position>
        </Scene>
        <Scene scroll={{ zoneId: 'z1' }}>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="s-next" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Scroll Next</h1>
            </Animate>
          </Position>
        </Scene>
      </CineView>
    );

    // Settle assets; in scroll mode the first-scene driver must not run. The
    // preload promise chain resolves async and setStates the scroll root, so the
    // settle wait runs inside act to keep those updates wrapped.
    fireImageLoads(() => true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(driverControllers).toHaveLength(0);
    const firstSceneTimeoutErrors = onError.mock.calls.filter(
      (call) => (call[0] as CineViewErrorDetail).code === 'FIRST_SCENE_TIMEOUT'
    );
    expect(firstSceneTimeoutErrors).toHaveLength(0);
  });

  // --- Spec 6: one-shot enter (fires exactly once) ------------------------
  it('runs the first-scene enter exactly once', async () => {
    const { rerender } = renderDragFirstScene();

    await waitFor(() => {
      expect(latestOpacityById.title).toBeDefined();
    });
    fireImageLoads((src) => src.includes('hero'));
    await waitFor(() => {
      expect(driverControllers).toHaveLength(1);
    });

    act(() => {
      driverControllers[0].onComplete?.();
    });

    // Force re-renders / more image settles: enter must not run again. The extra
    // settle resolves async and setStates the root, so flush it inside act.
    fireImageLoads(() => true);
    await act(async () => {
      await Promise.resolve();
    });
    rerender(
      <CineView
        mode="drag"
        modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
        config={{ size: 750 }}
      >
        <Scene assets={{ preloadImages: ['/hero.jpg'] }}>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Title</h1>
            </Animate>
          </Position>
        </Scene>
        <Scene>
          <Position at={{ x: 375, y: 220 }}>
            <Animate animateId="next-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
              <h1>Next</h1>
            </Animate>
          </Position>
        </Scene>
      </CineView>
    );
    await act(async () => {
      await Promise.resolve();
    });

    // One-shot: no second driver run spawned by the re-render / extra settles.
    expect(driverControllers).toHaveLength(1);
  });
});
