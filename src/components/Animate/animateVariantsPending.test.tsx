/**
 * FOUC regression: authored-but-not-yet-parsed variants must hold the INITIAL frame.
 *
 * Preset variants resolve through an async import, so the first commit after a page
 * load has `enterVariant === null` even though an animation WAS authored. Rendering
 * bare children there paints the child at its natural CSS (opacity 1) until the parse
 * lands, and it then snaps back to its initial frame before animating in — the
 * "flash → hide → animate" a user sees on every refresh.
 *
 * The guard: while a playable animation is authored but unparsed, Animate renders its
 * normal motion path (same DOM shape as after the parse, so nothing remounts) and each
 * driver resolves the initial frame.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import type { ParsedAnimationVariant } from '../../types';
import { parseAnimationWithComposition } from '../../animations/composer';

jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  const React = jest.requireActual('react');

  const MotionDiv = ({
    children,
    style,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    style?: Record<string, unknown>;
  }): JSX.Element => {
    const [, forceRender] = React.useState(0);

    React.useEffect(() => {
      const unsubs = Object.values(style ?? {})
        .filter(
          (
            value
          ): value is {
            get: () => unknown;
            on: (event: 'change', listener: () => void) => () => void;
          } =>
            Boolean(
              value &&
              typeof value === 'object' &&
              'get' in value &&
              typeof value.get === 'function' &&
              'on' in value &&
              typeof value.on === 'function'
            )
        )
        .map((value) =>
          value.on('change', () => {
            queueMicrotask(() => forceRender((count: number) => count + 1));
          })
        );
      return () => unsubs.forEach((unsubscribe) => unsubscribe());
    }, [style]);

    const resolvedStyle = Object.fromEntries(
      Object.entries(style ?? {}).map(([key, value]) => [
        key,
        value && typeof value === 'object' && 'get' in value && typeof value.get === 'function'
          ? value.get()
          : value,
      ])
    );

    return (
      <div
        data-testid="motion-div"
        data-opacity={String(resolvedStyle.opacity ?? '')}
        {...props}
        style={resolvedStyle as React.CSSProperties}
      >
        {children}
      </div>
    );
  };

  return {
    ...actualMotion,
    motion: { div: MotionDiv },
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      stop: jest.fn(),
    }),
  };
});

jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn(),
}));

function createMotionStub(initial: number): {
  get: () => number;
  set: (value: number) => void;
  on: (event: string, listener: (value: number) => void) => () => void;
} {
  let current = initial;
  const listeners = new Set<(value: number) => void>();
  return {
    get: () => current,
    set: (value: number) => {
      current = value;
      listeners.forEach((listener) => listener(value));
    },
    on: (_event, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createDragSceneContext(): SceneContextType {
  return {
    mode: 'drag',
    isActive: true,
    isDragging: false,
    dragProgressMotion: createMotionStub(0) as never,
    sharedElapsedMotion: createMotionStub(0) as never,
    renderProgressMotion: createMotionStub(0) as never,
    renderProgress: 0,
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 800,
    getTimelineDuration: jest.fn(() => 800),
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
    enterDuration: 600,
  };
}

function readOpacity(): number {
  return Number(screen.getByTestId('motion-div').getAttribute('data-opacity') ?? '');
}

describe('Animate FOUC guard (authored variants still parsing)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('holds the initial frame instead of flashing the rest frame before the parse lands', async () => {
    let resolveParse!: (variant: ParsedAnimationVariant) => void;
    (parseAnimationWithComposition as jest.Mock).mockImplementation(
      () =>
        new Promise<ParsedAnimationVariant>((resolve) => {
          resolveParse = resolve;
        })
    );

    render(
      <SceneContext.Provider value={createDragSceneContext()}>
        <Animate animateId="pending-probe" enterAnimation="fade-in" duration={{ enter: 40 }}>
          <article>Pending content</article>
        </Animate>
      </SceneContext.Provider>
    );

    // Parse is still in flight. The element must already be wrapped (same DOM
    // shape as after the parse — no remount) and painted at its initial frame.
    const wrapper = screen.getByText('Pending content').closest('.cineview-animate');
    expect(wrapper).not.toBeNull();
    // The bug this guards: an active, at-rest drag scene resolved the empty
    // variant records through their `animate` defaults → opacity 1 → visible flash.
    expect(readOpacity()).toBe(0);

    await act(async () => {
      resolveParse({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      } as ParsedAnimationVariant);
      await Promise.resolve();
    });

    // Once parsed, the at-rest active scene settles at its animate frame as before.
    await waitFor(() => expect(readOpacity()).toBe(1));
  });

  it('still renders bare children when no playable animation is authored', async () => {
    (parseAnimationWithComposition as jest.Mock).mockResolvedValue({
      initial: {},
      animate: {},
      exit: { opacity: 0 },
    });

    render(
      <SceneContext.Provider value={createDragSceneContext()}>
        {/* exit-only is an invalid payload: it fails open statically rather than
            being held hidden by the pending guard. */}
        <Animate animateId="exit-only" exitAnimation="fade-out">
          <article>Exit only</article>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Exit only')).toBeInTheDocument();
    });
    expect(screen.getByText('Exit only').closest('.cineview-animate')).toBeNull();
  });
});
