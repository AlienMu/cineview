import React, { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

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
      if (typeof value === 'object' && value?.set) {
        value.set(target);
      }
      options?.onUpdate?.(target);
      options?.onComplete?.();
      return { stop: jest.fn() };
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

describe('drag mode live-release regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles an upward mouse drag from Scene 1 into Scene 2 without dropping the active scene', async () => {
    const cineViewRef = createRef<CineViewRef>();
    const onSceneDidChange = jest.fn();

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
              duration={{ enter: 600 }}
            >
              <h1>Drag Scene 2</h1>
            </Animate>
          </Position>
        </Scene>
      </CineView>
    );

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
      expect(screen.getByText('Drag Scene 1')).toBeInTheDocument();
    });

    const activeSceneWrapper = document.querySelector(
      '[data-scene-index="0"]'
    ) as HTMLElement | null;
    const activeSceneSurface = activeSceneWrapper?.firstElementChild as HTMLElement | null;
    expect(activeSceneWrapper).not.toBeNull();
    expect(activeSceneSurface).not.toBeNull();

    fireEvent.mouseDown(activeSceneSurface!, { clientX: 375, clientY: 620 });
    fireEvent.mouseMove(activeSceneSurface!, { clientX: 375, clientY: 120 });
    fireEvent.mouseUp(activeSceneSurface!, { clientX: 375, clientY: 120 });

    await waitFor(() => {
      expect(onSceneDidChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
      );
      expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      expect(screen.getByText('Drag Scene 2')).toBeInTheDocument();
    });
  });
});
