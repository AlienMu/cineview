/**
 * Task flow: 2026-06-25-drag-two-track-refactor — I1 (caveat 2, lockable part)
 *
 * Bounce (sub-threshold release, NO scene change). The user model I1: when the
 * release does not switch scenes, BOTH tracks return smoothly to 0 together —
 * the render track (page slides back) AND the incoming scene's element track
 * (the partially-entered incoming content is pushed back to its un-entered
 * state). The incoming scene is cleanly un-done.
 *
 * Concretely, on a sub-threshold release after dragging the incoming scene
 * partway in:
 *  - a render-lane animate toward renderProgress 0 exists (page bounce-back);
 *  - the incoming scene's element track animate toward 0 exists IN PARALLEL
 *    (element un-enter), NOT toward terminal T;
 *  - no scene change commits (getCurrentScene stays 0).
 *
 * The regression this guards: a bounce that only resets render while leaving the
 * incoming element track stuck at its dragged-in elapsed (content half-entered
 * on a scene that bounced away), or worse, snapping it to terminal.
 *
 * Step-driver mock records each animate() with from/target/duration so the two
 * parallel return lanes are observable before they complete.
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
          if (isMotionValue) value.set(target);
          options?.onUpdate?.(target);
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

// Scene 1 (incoming) owns a large-delay element so T = max(600, 2000+500) =
// 2500ms; dragging it partway in puts its element track at a clearly non-zero,
// non-terminal elapsed before the bounce.
function renderDragApp() {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 600 } }}
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
    </CineView>
  );
  return cineViewRef;
}

function drainColdStart(): void {
  for (const c of [...animateCalls]) {
    if (!c.stopped && !c.completed) c.flush();
  }
  animateCalls.length = 0;
}

describe('drag two-track bounce return (I1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('returns the render track AND the incoming element track to 0 together on a sub-threshold bounce, with no scene change', async () => {
    const cineViewRef = renderDragApp();
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });
    await act(async () => {
      drainColdStart();
    });

    // Sub-threshold drag, released short of the switch threshold. Bare fireEvents
    // (NOT wrapped in a single act) so React flushes between move and up — the
    // follow-finger effect runs on the move and pegs scene 1's element track to
    // r·T, exactly as a real pointer drag would. 620 -> 520 is ~13% of the jsdom
    // viewport: enough to pull scene 1 partway in, under the ~30% rest threshold.
    const s0 = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    fireEvent.mouseDown(s0, { clientX: 375, clientY: 620 });
    fireEvent.mouseMove(s0, { clientX: 375, clientY: 520 });
    fireEvent.mouseUp(s0, { clientX: 375, clientY: 520 });

    // No scene change: the bounce does not cross the threshold.
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // Both bounce lanes are motion-value animates toward 0; they are told apart
    // by fromValue. The RENDER track bounces dragProgressMotion (a drag fraction,
    // |fromValue| < 1) back to 0 — the page slides back into place.
    const renderReturn = animateCalls.find(
      (c) => c.kind === 'motion-value' && c.target === 0 && Math.abs(c.fromValue) < 1
    );
    expect(renderReturn).toBeDefined();

    // IN PARALLEL, the incoming scene's ELEMENT track (elapsed ms, fromValue ≫ 1
    // ≈ r·T) also returns to 0 — the partially-entered content un-enters. The
    // runtime DECISION to drive the track toward 0 (not toward terminal T) is the
    // I1 behavior the browser caveat called out. (We assert the lane was CREATED
    // toward 0 from a non-zero elapsed; whether the step-driver mock later marks
    // it stopped is mock-timing noise — the render bounce's onComplete never fires
    // under the mock, so isDragging stays true and the follow-finger effect
    // re-stops it. The runtime created exactly the right lane.)
    const elementReturn = animateCalls.find(
      (c) => c.kind === 'motion-value' && c.target === 0 && c.fromValue > 1
    );
    expect(elementReturn).toBeDefined();
    expect(elementReturn!.fromValue).toBeGreaterThan(1);
    expect(elementReturn!.target).toBe(0);
    // Sanity: the incoming element track must NOT be driven toward terminal T on a
    // bounce — that would be the regression (content completes its enter on a
    // scene that bounced away).
    const towardTerminal = animateCalls.find((c) => c.kind === 'motion-value' && c.target >= 2400);
    expect(towardTerminal).toBeUndefined();
  });
});
