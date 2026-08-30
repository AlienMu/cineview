/**
 * Task flow: 2026-06-25-drag-two-track-refactor — RED1
 *
 * Two-track contract (user model, 2026-06-25, supersedes single-scalar settle):
 *  - render track (page slide): global, ∝ slideDuration, SOLE commit trigger.
 *  - element track (element enter timeline T = delay + duration): owned by the
 *    INCOMING scene instance, driven from the release instant.
 *
 * RED1 asserts the two tracks start as PARALLEL, INDEPENDENT clocks AT RELEASE:
 * on a successful partial release, BOTH a render-lane animate (toward
 * renderProgress 1, duration bounded by the slide) AND an element-track
 * continuation animate (toward the full timeline T ≈ 2500ms, duration ∝
 * (T − elapsed)) must exist TOGETHER, BEFORE the render lane completes / before
 * the commit.
 *
 * In the OLD single-scalar model the release path created ONLY the render lane;
 * the element continuation (activation-settle) appeared post-commit on the
 * incoming scene. So at release time there is no element-track continuation →
 * this test is RED until the two-track release is implemented.
 *
 * Uses a STEP-DRIVER framer-motion mock: animate() records each call (from/
 * target/duration) and only advances on explicit onUpdate/onComplete, so the
 * "both lanes live in parallel before commit" state is observable.
 */

import React, { createRef } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

interface AnimateCall {
  kind: 'motion-value' | 'number';
  fromValue: number;
  target: number;
  durationMs: number | null;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  stopped: boolean;
}

const animateCalls: AnimateCall[] = [];

jest.mock('framer-motion', () => {
  const React = require('react');
  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();
    return {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((l) => l(current));
      },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') return () => undefined;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
  const MotionDiv = React.forwardRef(
    ({ children, onPanStart, onPan, onPanEnd, ...props }: any, ref: any) => {
      const startRef = React.useRef(null as { x: number; y: number } | null);
      const lastRef = React.useRef(null as { x: number; y: number } | null);
      const getPoint = (event: React.MouseEvent<HTMLDivElement>) => ({
        x: event.clientX,
        y: event.clientY,
      });
      const buildInfo = (point: { x: number; y: number }) => {
        const start = startRef.current ?? point;
        const last = lastRef.current ?? start;
        return {
          offset: { x: point.x - start.x, y: point.y - start.y },
          velocity: { x: point.x - last.x, y: point.y - last.y },
        };
      };
      return (
        <div
          ref={ref}
          {...props}
          onMouseDown={(event) => {
            const p = getPoint(event);
            startRef.current = p;
            lastRef.current = p;
            onPanStart?.();
          }}
          onMouseMove={(event) => {
            if (!startRef.current) return;
            const p = getPoint(event);
            onPan?.(event.nativeEvent, buildInfo(p));
            lastRef.current = p;
          }}
          onMouseUp={(event) => {
            if (!startRef.current) return;
            const p = getPoint(event);
            onPanEnd?.(event.nativeEvent, buildInfo(p));
            startRef.current = null;
            lastRef.current = null;
          }}
        >
          {children}
        </div>
      );
    }
  );
  MotionDiv.displayName = 'MotionDiv';
  return {
    __esModule: true,
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      set: jest.fn(),
    }),
    useMotionValue: (initial: number) => {
      const ref = React.useRef(null);
      if (ref.current === null) {
        ref.current = createMotionValueStub(initial);
      }
      return ref.current;
    },
    motionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: (source: any, transform: (value: number) => number) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value: number) => motionValue.set(transform(value)));
      return motionValue;
    },
    animate: (value: any, target: number, options?: any) => {
      const isMotionValue = typeof value === 'object' && value?.set;
      const call: AnimateCall = {
        kind: isMotionValue ? 'motion-value' : 'number',
        fromValue: isMotionValue ? value.get() : (value as number),
        target,
        durationMs:
          typeof options?.duration === 'number' ? Math.round(options.duration * 1000) : null,
        onUpdate: options?.onUpdate,
        onComplete: options?.onComplete,
        stopped: false,
      };
      const controls = {
        stop: () => {
          call.stopped = true;
        },
        flush: () => {
          if (call.stopped) return;
          if (isMotionValue) value.set(target);
          call.onUpdate?.(target);
          call.onComplete?.();
          call.stopped = true;
        },
      };
      animateCalls.push(call);
      return controls;
    },
  };
});

(window as any).IntersectionObserver = jest.fn(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
}));

// The INCOMING scene (scene 1) owns a large-delay element so its element
// timeline T = max(transitionDuration 600, delay 2000 + duration 500) = 2500ms.
// The render (page-slide) lane must stay bounded by the slide (~600ms); the
// element track must continue toward ~2500ms at natural rate.
function renderDragApp() {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      direction={'y'}
      transitionDuration={600}
      unit={'time'}
      scale={25}
      designWidth={750}
    >
      <Scene
        transition={{ enterAnimation: 'slide-up', exitAnimation: 'fade-out', exitDuration: 600 }}
      >
        <Position at={{ x: 375, y: 220 }}>
          <Animate animateId="s0-copy" enterAnimation="slide-up" duration={{ enter: 500 }}>
            <h1>Scene 0</h1>
          </Animate>
        </Position>
      </Scene>
      <Scene
        transition={{ enterAnimation: 'slide-up', exitAnimation: 'fade-out', exitDuration: 600 }}
      >
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="s1-copy"
            enterAnimation="slide-up"
            duration={{ enter: 500 }}
            timeline={{ delay: 2000 }}
          >
            <h1>Scene 1</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
  return cineViewRef;
}

async function dragUp(surface: HTMLElement, fromY: number, toY: number): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  const ownershipY = fromY - 8;
  const targetY = toY - 8;
  fireEvent.mouseDown(surface, { clientX: 375, clientY: fromY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: ownershipY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: targetY });
  fireEvent.mouseUp(surface, { clientX: 375, clientY: targetY });
}

describe('drag two-track parallel release (RED1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('starts the render track and the element-track continuation as parallel independent clocks at release', async () => {
    const cineViewRef = renderDragApp();
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(0);
    });

    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    animateCalls.length = 0;
    await dragUp(surface, 620, 120); // ~65% partial release, switches forward

    // BEFORE flushing/completing anything: the render (page-slide) lane exists,
    // a plain-number tween toward renderProgress 1, bounded by the slide.
    const renderLane = animateCalls.find(
      (c) => c.kind === 'number' && c.target === 1 && !c.stopped
    );
    expect(renderLane).toBeDefined();
    expect(renderLane!.durationMs).not.toBeNull();
    expect(renderLane!.durationMs!).toBeLessThanOrEqual(650);

    // AND, in parallel at the same release (before the render lane completes /
    // before commit), the element-track continuation exists: a motion-value
    // tween toward the full element timeline T ≈ 2500ms with an INDEPENDENT
    // duration proportional to (T − elapsed) — much longer than the slide.
    const elementLane = animateCalls.find(
      (c) => c.kind === 'motion-value' && c.target >= 2400 && !c.stopped
    );
    expect(elementLane).toBeDefined();
    expect(elementLane!.durationMs).not.toBeNull();
    // (T − elapsed) at ~65% of 2500 ≈ 875ms remaining — clearly not the slide
    // window and clearly not a snap (0ms).
    expect(elementLane!.durationMs!).toBeGreaterThan(650);

    // The two clocks are independent: different durations.
    expect(elementLane!.durationMs!).not.toBe(renderLane!.durationMs!);
  });
});

describe('drag two-track continuity across commit (RED2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('continues the element track from the release elapsed across commit — no replay from 0, no second pass', async () => {
    const cineViewRef = renderDragApp();
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(0);
    });

    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    animateCalls.length = 0;
    await dragUp(surface, 620, 120); // ~65% partial release, switches forward

    // The element-track continuation created at release. T ≈ 2500ms; at ~65%
    // the live elapsed is ~1625ms, so the continuation must START from a
    // substantial elapsed (NOT 0 — that would be a replay) and END at ~T.
    const elementLane = animateCalls.find(
      (c) => c.kind === 'motion-value' && c.target >= 2400 && !c.stopped
    );
    expect(elementLane).toBeDefined();
    // Continuity: the continuation begins at the release elapsed, well above 0.
    // A replay-from-0 (the historic double-animation bug) would start here at ~0.
    expect(elementLane!.fromValue).toBeGreaterThan(800);
    // Monotone: it advances toward T (target > from), never rewinds.
    expect(elementLane!.target).toBeGreaterThan(elementLane!.fromValue);

    // Drive the render (page-slide) lane to completion → commit fires.
    const renderLane = animateCalls.find(
      (c) => c.kind === 'number' && c.target === 1 && !c.stopped
    );
    expect(renderLane).toBeDefined();
    const elementLaneCountBeforeCommit = animateCalls.filter(
      (c) => c.kind === 'motion-value' && c.target >= 2400
    ).length;
    await act(async () => {
      renderLane!.onComplete?.();
    });
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(1);
    });

    // No second element-track pass is created at/after commit. The SAME in-flight
    // continuation keeps running uninterrupted (single writer = the incoming
    // scene). A new element-track animate toward ~T appearing here is exactly the
    // activation-settle replay seam this refactor deletes.
    const elementLaneCountAfterCommit = animateCalls.filter(
      (c) => c.kind === 'motion-value' && c.target >= 2400
    ).length;
    expect(elementLaneCountAfterCommit).toBe(elementLaneCountBeforeCommit);

    // The original continuation is still live (not stopped by the commit).
    expect(elementLane!.stopped).toBe(false);
  });
});
