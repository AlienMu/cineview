import React, { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

type PendingAnimation = {
  stop: () => void;
  flush: () => void;
  isStopped: () => boolean;
};

type PendingAnimationKind = 'motion-value' | 'number';

const pendingObjectAnimations: PendingAnimation[] = [];
const pendingNumberAnimations: PendingAnimation[] = [];
const completedAnimations = {
  motionValue: 0,
  number: 0,
};

async function flushPendingObjectAnimations(): Promise<void> {
  await act(async () => {
    for (const animation of pendingObjectAnimations.splice(0)) {
      if (!animation.isStopped()) {
        animation.flush();
      }
    }
  });
}

async function flushPendingNumberAnimations(): Promise<void> {
  await act(async () => {
    for (const animation of pendingNumberAnimations.splice(0)) {
      if (!animation.isStopped()) {
        animation.flush();
      }
    }
  });
}

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');

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
        if (event !== 'change') {
          return () => undefined;
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  const MotionDiv = React.forwardRef(
    (
      {
        children,
        onPanStart,
        onPan,
        onPanEnd,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        onPanStart?: () => void;
        onPan?: (
          event: Event,
          info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
        ) => void;
        onPanEnd?: (
          event: Event,
          info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
        ) => void;
      },
      ref: React.Ref<HTMLDivElement>
    ) => {
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
          offset: {
            x: point.x - start.x,
            y: point.y - start.y,
          },
          velocity: {
            x: point.x - last.x,
            y: point.y - last.y,
          },
        };
      };

      return (
        <div
          ref={ref}
          {...props}
          onMouseDown={(event) => {
            const point = getPoint(event);
            startRef.current = point;
            lastRef.current = point;
            onPanStart?.();
          }}
          onMouseMove={(event) => {
            if (!startRef.current) return;
            const point = getPoint(event);
            onPan?.(event.nativeEvent, buildInfo(point));
            lastRef.current = point;
          }}
          onMouseUp={(event) => {
            if (!startRef.current) return;
            const point = getPoint(event);
            onPanEnd?.(event.nativeEvent, buildInfo(point));
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
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      set: jest.fn(),
    }),
    useMotionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: (
      source: {
        get: () => number;
        on?: (event: string, listener: (value: number) => void) => () => void;
      },
      transform: (value: number) => number
    ) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value) => {
        motionValue.set(transform(value));
      });
      return motionValue;
    },
    animate: (
      value: { set?: (next: number) => void } | number,
      target: number,
      options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
    ) => {
      const kind: PendingAnimationKind =
        typeof value === 'object' && value?.set ? 'motion-value' : 'number';
      let stopped = false;
      const animation: PendingAnimation = {
        stop: () => {
          stopped = true;
        },
        flush: () => {
          if (stopped) {
            return;
          }
          if (typeof value === 'object' && value?.set) {
            value.set?.(target);
          }
          options?.onUpdate?.(target);
          if (kind === 'motion-value') {
            completedAnimations.motionValue += 1;
          } else {
            completedAnimations.number += 1;
          }
          options?.onComplete?.();
          stopped = true;
        },
        isStopped: () => stopped,
      };

      if (kind === 'motion-value') {
        pendingObjectAnimations.push(animation);
        options?.onUpdate?.(target * 0.6);
        if (typeof value === 'object' && value?.set) {
          value.set(target * 0.6);
        }
      } else {
        pendingNumberAnimations.push(animation);
        options?.onUpdate?.(target * 0.6);
      }

      return { stop: animation.stop, flush: animation.flush };
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

function renderDragApp(onSceneDidChange: jest.Mock): React.RefObject<CineViewRef> {
  const cineViewRef = createRef<CineViewRef>();

  render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
      config={{ width: 750, height: 1334 }}
      callbacks={{ onSceneDidChange }}
    >
      <Scene transition={{ exitDuration: 800 }}>
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="drag-scene-1-title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
          >
            <h1>Drag Scene 1</h1>
          </Animate>
        </Position>
      </Scene>

      <Scene transition={{ exitDuration: 800 }}>
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="drag-scene-2-title"
            enterAnimation="fade-in"
            duration={{ enter: 1400 }}
          >
            <h1>Drag Scene 2</h1>
          </Animate>
        </Position>
      </Scene>

      <Scene transition={{ exitDuration: 800 }}>
        <Position at={{ x: 375, y: 220 }}>
          <Animate
            animateId="drag-scene-3-title"
            enterAnimation="fade-in"
            duration={{ enter: 900 }}
          >
            <h1>Drag Scene 3</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );

  return cineViewRef;
}

function dragUp(surface: HTMLElement, fromY: number, toY: number): void {
  fireEvent.mouseDown(surface, { clientX: 375, clientY: fromY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: toY });
  fireEvent.mouseUp(surface, { clientX: 375, clientY: toY });
}

describe('drag mode settle handshake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pendingObjectAnimations.length = 0;
    pendingNumberAnimations.length = 0;
    completedAnimations.motionValue = 0;
    completedAnimations.number = 0;
  });

  // The release now has a SINGLE lane: the page-slide (render lane, a plain
  // number animation). It is the sole commit trigger and runs on the
  // scene-transition timescale, decoupled from the element timeline (delay +
  // duration). When it completes, the scene commits at the release ratio and the
  // incoming scene's activation-settle continues the element timeline to 100% at
  // natural rate (continuous cross-commit completion). See task-flow
  // 2026-06-24-drag-delay-page-decoupling.
  it('commits the scene change when the page-slide (render) lane completes', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
      expect(screen.getByText('Drag Scene 1')).toBeInTheDocument();
    });

    const activeSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(activeSceneSurface, 620, 120);

    // Before the page-slide finishes, the scene has not changed.
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // Completing the render (page-slide) lane alone commits the scene change.
    await flushPendingNumberAnimations();

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });
  });

  it('fires onSceneDidChange at the render commit; the element continuation runs on independently', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    const activeSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(activeSceneSurface, 620, 120);

    // Page-slide completes -> scene index advances at the partial release ratio.
    await flushPendingNumberAnimations();
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

    // Draining the incoming element continuation (the independent line) drives the
    // visual enter to completion but does NOT fire onSceneDidChange a second time.
    await flushPendingObjectAnimations();

    expect(onSceneDidChange).toHaveBeenCalledTimes(1);
  });

  it('finalizes a pending release on a new drag start and commits once', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    // Drain the spec-mandated first-screen cold-start enter (a SEPARATE lane —
    // now the scene-0 element track, a motion-value animation — unrelated to the
    // release path) so the counters below measure only the release lanes.
    await flushPendingObjectAnimations();
    await flushPendingNumberAnimations();
    completedAnimations.number = 0;
    completedAnimations.motionValue = 0;

    const firstSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(firstSceneSurface, 620, 120);

    // Release in flight: page-slide not yet complete, scene unchanged.
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // Start a new drag before the page-slide finishes -> handleDragStart
    // finalizes the pending release (flushes the render lane) and commits once.
    const pendingSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    fireEvent.mouseDown(pendingSurface, { clientX: 375, clientY: 620 });

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });

    // Finish the incoming continuation; the change callback fires exactly once.
    await flushPendingObjectAnimations();
    await flushPendingNumberAnimations();

    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
    await waitFor(() => {
      expect(onSceneDidChange).toHaveBeenCalledTimes(1);
    });
  });
});
