/**
 * Task flow: 2026-06-25-drag-two-track-refactor — RED4 (caveat 1)
 *
 * Re-drag MID-SETTLE, POST-COMMIT. This is the one two-track behavior with no
 * dedicated assertion yet (the settle-handshake suite only covers re-drag during
 * the pre-commit render slide). The genuine regression risk:
 *
 *   After a partial release commits (scene 0 -> 1), scene 1 is active and its
 *   element track has an IN-FLIGHT continuation animate toward T (= delay+dur).
 *   If the user grabs scene 1 and drags toward scene 2 BEFORE that continuation
 *   finishes, the old (now-outgoing) scene 1's continuation must STOP IN PLACE —
 *   it must NOT be force-jumped to terminal T. Scene 1 is about to slide out of
 *   view, so freezing its track where it is (and letting it slide away) is
 *   correct; snapping it to its finished visual is the historic force-complete
 *   bug (old handleDragStart did `sharedElapsedMotion.set(T)` + onActivationComplete).
 *
 * Step-driver mock: animate() records each call with a live value reader and a
 * completion flag, advancing only on explicit flush/onComplete — so a track that
 * was stopped vs one that reached terminal are distinguishable.
 */

import React, { act, createRef } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

interface AnimateCall {
  kind: 'motion-value' | 'number';
  fromValue: number;
  target: number;
  durationMs: number | null;
  completed: boolean;
  stopped: boolean;
  readCurrent: () => number | null;
  flush: () => void;
  complete: () => void;
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
    useMotionValue: (initial: number) => createMotionValueStub(initial),
    motionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: (source: any, transform: (value: number) => number) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value: number) => motionValue.set(transform(value)));
      return motionValue;
    },
    animate: (value: any, target: number, options?: any) => {
      const isMotionValue = typeof value === 'object' && value?.set;
      const advance = (): void => {
        if (isMotionValue) value.set(target);
        options?.onUpdate?.(target);
        options?.onComplete?.();
      };
      const call: AnimateCall = {
        kind: isMotionValue ? 'motion-value' : 'number',
        fromValue: isMotionValue ? value.get() : (value as number),
        target,
        durationMs:
          typeof options?.duration === 'number' ? Math.round(options.duration * 1000) : null,
        completed: false,
        stopped: false,
        readCurrent: () => (isMotionValue ? value.get() : null),
        flush: () => {
          if (call.stopped || call.completed) return;
          advance();
          call.completed = true;
        },
        complete: () => {
          if (call.stopped || call.completed) return;
          options?.onComplete?.();
          call.completed = true;
        },
      };
      const controls = {
        stop: () => {
          call.stopped = true;
        },
        flush: call.flush,
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

// Scene 1 (the first forward target) owns a large-delay element so its element
// timeline T = max(600, delay 2000 + duration 500) = 2500ms. After committing
// into scene 1 at a partial release, its continuation runs toward ~2500ms and is
// still well below terminal when we re-grab it.
function renderDragApp() {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 600, dragTimeScale: 25 } }}
      config={{ size: 750 }}
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
      <Scene
        transition={{ enterAnimation: 'slide-up', exitAnimation: 'fade-out', exitDuration: 600 }}
      >
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="s2-copy"
            enterAnimation="slide-up"
            duration={{ enter: 500 }}
            timeline={{ delay: 2000 }}
          >
            <h1>Scene 2</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
  return cineViewRef;
}

function dragUp(surface: HTMLElement, fromY: number, toY: number) {
  fireEvent.mouseDown(surface, { clientX: 375, clientY: fromY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: toY });
  fireEvent.mouseUp(surface, { clientX: 375, clientY: toY });
}

function drainColdStart(): void {
  // The scene-0 cold-start drives its element track to ~600ms; flush any pending
  // animations so the counters below only reflect the release/re-drag lanes.
  for (const c of [...animateCalls]) {
    if (!c.stopped && !c.completed) c.flush();
  }
  animateCalls.length = 0;
}

describe('drag two-track re-drag mid-settle (RED4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('stops the old incoming track in place on a new drag — does NOT jump it to terminal T', async () => {
    const cineViewRef = renderDragApp();
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });
    await act(async () => {
      drainColdStart();
    });

    // Partial release 0 -> 1 (~65%). Creates the render lane + scene-1 element
    // continuation toward T ≈ 2500ms.
    const s0 = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(s0, 620, 120);

    // Complete ONLY the render (page-slide) lane -> commit to scene 1. The
    // element continuation stays in flight (not flushed).
    const renderLane = animateCalls.find(
      (c) => c.kind === 'number' && c.target === 1 && !c.stopped
    );
    expect(renderLane).toBeDefined();
    await act(async () => {
      renderLane!.complete();
    });
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    });

    // The scene-1 element continuation: in flight, toward T ≈ 2500, NOT yet done.
    const continuation = animateCalls.find((c) => c.kind === 'motion-value' && c.target >= 2400);
    expect(continuation).toBeDefined();
    expect(continuation!.completed).toBe(false);
    expect(continuation!.stopped).toBe(false);
    const elapsedAtRegrab = continuation!.readCurrent();
    expect(elapsedAtRegrab).not.toBeNull();
    // It started from the release elapsed (~1625ms) and has not advanced.
    expect(elapsedAtRegrab!).toBeLessThan(2000);

    // Now GRAB scene 1 (active) and drag toward scene 2, mid-settle.
    const s1 = document.querySelector('[data-scene-index="1"] > *') as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(s1, { clientX: 375, clientY: 620 });
      fireEvent.mouseMove(s1, { clientX: 375, clientY: 420 });
    });

    // The old incoming (scene 1) continuation must be STOPPED IN PLACE: stopped,
    // never completed, and its track value left where it was — NOT snapped to the
    // terminal T (2500). A force-jump-to-terminal would set it to ~2500.
    expect(continuation!.stopped).toBe(true);
    expect(continuation!.completed).toBe(false);
    const elapsedAfterRegrab = continuation!.readCurrent();
    expect(elapsedAfterRegrab).not.toBeNull();
    expect(elapsedAfterRegrab!).toBeLessThan(2000);
  });
});
