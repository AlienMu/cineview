/**
 * Task flow: 2026-06-24-drag-delay-page-decoupling
 *
 * Contract (user's chosen model, overriding the earlier single-settle decision):
 * the page transition (render/position slide) commits on its OWN short timescale,
 * and the element timeline continues ACROSS the commit at its NATURAL rate —
 * continuously, without replaying from 0 and without snapping to terminal.
 *
 * Concretely, for a partial release where the element timeline T (= delay +
 * duration) is longer than the page slide:
 *  - completing the page-slide (render) lane ALONE commits the scene change
 *    (the long element timeline must NOT gate the commit);
 *  - the commit lands at the PARTIAL release elapsed (< T), so a settle
 *    continuation is created on the incoming scene; onSceneDidChange fires AT
 *    the commit (scene-switch-complete = render commit), NOT gated on the
 *    continuation — the element line is independent and interruptible;
 *  - the continuation advances the remaining timeline at natural rate (its
 *    duration reflects T minus the elapsed reached at commit) — it is NOT
 *    crammed into the slide window (which caused the "animation runs too fast
 *    after the delay" symptom) and NOT restarted from 0.
 *
 * Before the fix the release dual-gated on both lanes and committed at 100%, so
 * flushing the render lane alone never committed, and no continuation ran.
 *
 * This uses a STEP-DRIVER framer-motion mock: animate() records each call and
 * the test calls onUpdate/onComplete explicitly, so partial lane states are
 * observable (a flush-to-target mock cannot express "render done while timeline
 * is only partway").
 */

import React, { act, createRef } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
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
    useMotionValue: (initial: number) => createMotionValueStub(initial),
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

// Both scenes carry a large-delay element so T = max(600, 2000+500) = 2500ms,
// well above the page slide. Dragging away from scene 0 exercises the partial
// outgoing commit; scene 1's matching timeline gives the activation-settle a
// remaining window to continue at natural rate.
function renderDragApp(onSceneDidChange?: jest.Mock) {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 600, dragTimeScale: 25 } }}
      config={{ width: 750, height: 1334, unit: 'px' }}
      callbacks={{ onSceneDidChange }}
    >
      <Scene
        transition={{ enterAnimation: 'slide-up', exitAnimation: 'fade-out', exitDuration: 600 }}
      >
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="s0-copy"
            enterAnimation="slide-up"
            duration={{ enter: 500 }}
            timeline={{ delay: 2000 }}
          >
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

function dragUp(surface: HTMLElement, fromY: number, toY: number) {
  fireEvent.mouseDown(surface, { clientX: 375, clientY: fromY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: toY });
  fireEvent.mouseUp(surface, { clientX: 375, clientY: toY });
}

function findRenderLane(): AnimateCall | undefined {
  // Render lane animates renderProgress (a plain number) toward 1.
  return animateCalls.find((c) => c.kind === 'number' && c.target === 1 && !c.stopped);
}

describe('drag continuous cross-commit completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('commits on the page-slide lane alone and fires onSceneDidChange AT commit; the element continuation runs on independently', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    animateCalls.length = 0;
    dragUp(surface, 620, 120); // ~65% partial release

    // Complete ONLY the render (page-slide) lane. The long element timeline lane
    // is left only partway (not flushed).
    const renderLane = findRenderLane();
    expect(renderLane).toBeDefined();
    await act(async () => {
      renderLane!.onComplete?.();
    });

    // Page-slide completion alone commits the scene change.
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    });

    // The scene switch is COMPLETE at the render commit, so onSceneDidChange has
    // already fired exactly once — it is NOT gated on the element continuation.
    await waitFor(() => {
      expect(onSceneDidChange).toHaveBeenCalledTimes(1);
    });
    expect(onSceneDidChange).toHaveBeenCalledWith(
      expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
    );

    // A continuation animation exists on the incoming scene, advancing the
    // element timeline toward its full duration (2500ms) from the partial elapsed
    // reached at commit — i.e. at natural rate, NOT crammed into the slide, NOT
    // restarted from 0 (continuous completion).
    const continuation = animateCalls.find(
      (c) => c.kind === 'motion-value' && c.target >= 2400 && !c.stopped
    );
    expect(continuation).toBeDefined();
    // Its remaining duration is substantial (hundreds of ms), proving natural
    // rate rather than a snap-to-terminal.
    expect(continuation!.durationMs).not.toBeNull();
    expect(continuation!.durationMs!).toBeGreaterThan(200);

    // Finishing the continuation drives the visual enter to completion but does
    // NOT fire onSceneDidChange a second time — the public callback already fired
    // at commit; the element line only triggers internal cleanup.
    await act(async () => {
      continuation!.onComplete?.();
    });
    expect(onSceneDidChange).toHaveBeenCalledTimes(1);
  });
});
