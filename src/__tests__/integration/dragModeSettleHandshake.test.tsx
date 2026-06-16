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
      config={{ width: 750, height: 1334, unit: 'px' }}
      callbacks={{ common: { onSceneDidChange } }}
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

  it('does not commit when render release finishes before timeline settle', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
      expect(screen.getByText('Drag Scene 1')).toBeInTheDocument();
    });

    const activeSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(activeSceneSurface, 620, 120);

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(onSceneDidChange).not.toHaveBeenCalled();

    await flushPendingNumberAnimations();

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(onSceneDidChange).not.toHaveBeenCalled();

    await flushPendingObjectAnimations();

    // Both lanes complete → commit at partial progress.
    // Scene changes, onSceneDidChange deferred (needsSettleCompletion=true).
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });
  });

  it('commits only after both timeline settle and render release complete', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    const activeSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(activeSceneSurface, 620, 120);

    await flushPendingObjectAnimations();

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(onSceneDidChange).not.toHaveBeenCalled();

    await flushPendingNumberAnimations();

    // Both lanes complete → commit at partial progress.
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });
  });

  it('completes both interrupted release tracks once and ignores stale callbacks', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    const firstSceneSurface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(firstSceneSurface, 620, 120);

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(onSceneDidChange).not.toHaveBeenCalled();

    await flushPendingNumberAnimations();

    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    expect(onSceneDidChange).not.toHaveBeenCalled();
    expect(completedAnimations.motionValue).toBe(0);
    expect(completedAnimations.number).toBe(1);

    const firstPendingSceneSurface = document.querySelector(
      '[data-scene-index="0"] > *'
    ) as HTMLElement;
    fireEvent.mouseDown(firstPendingSceneSurface, { clientX: 375, clientY: 620 });

    // handleDragStart flushes both pending releases → commit at partial progress.
    // Scene changes immediately. onSceneDidChange is deferred (needsSettleCompletion).
    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });

    expect(completedAnimations.motionValue).toBe(1);
    // render release is NOT stopped in the new tryCommitRelease path,
    // so it may complete once more when flushed by handleDragStart.
    expect(completedAnimations.number).toBeGreaterThanOrEqual(1);

    await flushPendingObjectAnimations();
    await flushPendingNumberAnimations();

    expect(cineViewRef.current?.getCurrentScene()).toBe(1);
  });
});
