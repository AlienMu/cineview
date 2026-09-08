/**
 * Task flow: 2026-06-24-drag-delay-page-decoupling
 *
 * User model (locked 2026-06-24):
 *  - Element timeline T = delay + duration. delay is unrelated to the page
 *    transition; it only shifts WHEN the element animation starts within T.
 *  - Dragging consumes T by percentage: drag to p% puts the element timeline at
 *    p% * (delay + duration).
 *  - On release the element timeline CONTINUES to 100% (no replay, no snap).
 *  - The page-slide (render lane) duration is INDEPENDENT of delay — it uses the
 *    scene transition/slide duration only, so a large delay must NOT slow the
 *    next-scene transition.
 *
 * These tests record every framer-motion animate() call so we can assert the
 * render lane and the timeline lane have INDEPENDENT durations on release.
 */

import React, { createRef } from 'react';
import { act } from '@testing-library/react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

type AnimateCall = {
  kind: 'motion-value' | 'number';
  target: number;
  durationMs: number | null;
  stop: () => void;
  flush: () => void;
  isStopped: () => boolean;
};

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
      source.on?.('change', (value: number) => {
        motionValue.set(transform(value));
      });
      return motionValue;
    },
    animate: (value: any, target: number, options?: any) => {
      const kind = typeof value === 'object' && value?.set ? 'motion-value' : 'number';
      let stopped = false;
      const call: AnimateCall = {
        kind,
        target,
        durationMs:
          typeof options?.duration === 'number' ? Math.round(options.duration * 1000) : null,
        stop: () => {
          stopped = true;
        },
        flush: () => {
          if (stopped) return;
          if (typeof value === 'object' && value?.set) value.set?.(target);
          options?.onUpdate?.(target);
          options?.onComplete?.();
          stopped = true;
        },
        isStopped: () => stopped,
      };
      animateCalls.push(call);
      return { stop: call.stop, flush: call.flush };
    },
  };
});

(window as any).IntersectionObserver = jest.fn(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
}));

// The first scene (the one we drag AWAY from) owns a large-delay element so its
// getTimelineDuration() = max(transitionDuration 600, delay 2000 + duration 500
// = 2500) = 2500. The page slide (render lane) must stay bounded by the slide
// duration (~600/800ms), NOT inflate to the 2500ms element timeline. The release
// timeline lane is driven by the OUTGOING (active) scene's timeline, so the big
// delay belongs here to exercise symptom 1.
function renderDragApp(onSceneLeave?: jest.Mock) {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      direction={'y'}
      transitionDuration={600}
      designWidth={750}
      callbacks={{ onSceneLeave }}
    >
      <Scene
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 600 }}
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
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 600 }}
      >
        <Position at={{ x: 375, y: 220 }}>
          <Animate animateId="s2-title" enterAnimation="fade-in" duration={{ enter: 400 }}>
            <h1>Scene 2</h1>
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

describe('drag delay / page-transition decoupling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    animateCalls.length = 0;
  });

  it('keeps the page-slide (render lane) duration independent of the element delay', async () => {
    const cineViewRef = renderDragApp();
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(0);
    });

    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    animateCalls.length = 0;
    // Release at a partial progress that switches (jsdom viewport ~768px;
    // dragging 620 -> 120 is ~65%).
    await dragUp(surface, 620, 120);

    // The render lane animates renderProgress (a plain number, currentProgress
    // -> targetProgress = 1). Its duration is the page slide and must be bounded
    // by the scene transition/slide duration (<= ~600ms), NOT inflated by the
    // element's 2500ms timeline. Before the fix it was max(sceneTravel,
    // timelineRemaining) = ~timelineRemaining (well over 600ms).
    const renderLane = animateCalls.find((c) => c.kind === 'number' && c.target === 1);
    expect(renderLane).toBeDefined();
    expect(renderLane!.durationMs).not.toBeNull();
    expect(renderLane!.durationMs!).toBeLessThanOrEqual(650);
  });

  it('commits the scene change on the page-slide timescale, not after the full delayed timeline', async () => {
    const onSceneLeave = jest.fn();
    const cineViewRef = renderDragApp(onSceneLeave);
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(0);
    });

    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    animateCalls.length = 0;
    await dragUp(surface, 620, 120);

    // Completing ONLY the page-slide (render) lane must be enough to commit the
    // scene change. The long element timeline (2500ms) then continues on the
    // incoming scene; it must not gate the commit.
    await act(async () => {
      for (const c of animateCalls.filter((c) => c.kind === 'number' && c.target === 1)) {
        if (!c.isStopped()) c.flush();
      }
    });

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(1);
    });
  });
});
