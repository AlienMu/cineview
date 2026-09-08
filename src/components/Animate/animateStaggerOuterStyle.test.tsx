/**
 * Outer-wrapper style ownership across the branch matrix (mode × stagger × infinite).
 *
 * `Animate` ends in four `return` branches, and each binds a `style` to the outer
 * `motion.div`. When `stagger` is active the outer wrapper MUST hand over its visual
 * properties (`Animate.tsx` ~900-905): otherwise the container animates as a whole
 * while its children also stagger, and the two compose into a double animation.
 * That handover is `STAGGER_NEUTRAL_STYLE` (`{ opacity: 1 }`), applied through
 * `scrollOuterStyle` / `dragOuterStyle`.
 *
 * `animateVariantsPending.test.tsx` already guards this for the drag non-infinite
 * branch. The other three had no guard, and the scroll+infinite one was in fact
 * binding the raw scrub style rather than the neutralised one (fixed 2026-08-27:
 * it now binds `scrollOuterStyle` like its siblings). These tests cover all four
 * cells so that asymmetry cannot come back unnoticed.
 *
 * What the assertions read: the framer mock below resolves every MotionValue on
 * `style` down to its current value and publishes it as `data-opacity` on the
 * outermost rendered div. A neutralised wrapper therefore reads exactly `1`; a
 * scrub-driven wrapper reads whatever its lane resolved (0 at the initial frame).
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import type { ParsedAnimationVariant } from '../../types';
import { parseAnimationWithComposition } from '../../animations/composer';

jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  const React = jest.requireActual('react');

  const isMotionValue = (
    value: unknown
  ): value is { get: () => unknown; on: (event: 'change', listener: () => void) => () => void } =>
    Boolean(
      value &&
      typeof value === 'object' &&
      'get' in value &&
      typeof (value as { get: unknown }).get === 'function' &&
      'on' in value &&
      typeof (value as { on: unknown }).on === 'function'
    );

  // Only the outermost motion.div gets a testid: inner layers (infinite's nested wrapper,
  // stagger children) do not, to prevent getByTestId from matching multiple elements.
  let depth = 0;

  const MotionDiv = ({
    children,
    style,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    style?: Record<string, unknown>;
  }): React.JSX.Element => {
    const [, forceRender] = React.useState(0);

    React.useEffect(() => {
      const unsubs = Object.values(style ?? {})
        .filter(isMotionValue)
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
        isMotionValue(value) ? value.get() : value,
      ])
    );

    const myDepth = depth;
    depth += 1;
    React.useEffect(() => {
      depth = 0;
    });

    return (
      <div
        data-testid={myDepth === 0 ? 'outer-motion' : `inner-motion-${myDepth}`}
        data-opacity={String(resolvedStyle.opacity ?? '')}
        {...props}
        style={resolvedStyle as React.CSSProperties}
      >
        {children}
      </div>
    );
  };

  const MotionP = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  );
  const MotionSpan = ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  );

  return {
    ...actualMotion,
    motion: { div: MotionDiv, p: MotionP, span: MotionSpan },
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

const ENTER_VARIANT: ParsedAnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: {},
};

const INFINITE_VARIANT: ParsedAnimationVariant = {
  initial: {},
  animate: { opacity: [0.4, 1, 0.4], transition: { duration: 1 } },
  exit: {},
};

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

function createSceneContext(mode: 'drag' | 'scroll'): SceneContextType {
  return {
    mode,
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

/** Parse requests dispatch by requested phase: enter → enter variant, infinite → loop variant. */
function mockParseByPhase(): void {
  (parseAnimationWithComposition as jest.Mock).mockImplementation((animation: unknown) => {
    const isInfinite =
      typeof animation === 'object' &&
      animation !== null &&
      JSON.stringify(animation).includes('0.4');
    return Promise.resolve(isInfinite ? INFINITE_VARIANT : ENTER_VARIANT);
  });
}

function readOuterOpacity(): string {
  return screen.getByTestId('outer-motion').getAttribute('data-opacity') ?? '';
}

describe('Animate outer style ownership under stagger (branch matrix)', () => {
  beforeEach(() => {
    mockParseByPhase();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Full coverage of the four-cell matrix. The scroll + infinite cell was the only branch
  // binding the raw scrub style (`scrollResult.style` instead of `scrollOuterStyle`),
  // fixed 2026-08-27 and merged back into the matrix.
  it.each([
    ['drag', undefined, 'drag, no infinite'],
    ['drag', INFINITE_VARIANT, 'drag + infinite'],
    ['scroll', undefined, 'scroll, no infinite'],
    ['scroll', INFINITE_VARIANT, 'scroll + infinite'],
  ] as const)(
    'neutralises the outer wrapper when stagger is active (%s, %s)',
    async (mode, infinite, label) => {
      void label;
      render(
        <SceneContext.Provider value={createSceneContext(mode)}>
          <Animate
            animateId={`stagger-${mode}-${infinite ? 'inf' : 'plain'}`}
            enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
            {...(infinite ? { loopAnimation: { animate: { opacity: [0.4, 1, 0.4] } } } : {})}
            stagger={{ each: 40 }}
          >
            <p>
              <span>A</span>
              <span>B</span>
            </p>
          </Animate>
        </SceneContext.Provider>
      );

      // After variant parsing lands, the outer wrapper must hand over visual properties
      // = neutral opacity 1. If a branch binds the raw scrub style, this reads 0 (or other
      // scrub values) from the initial frame.
      await waitFor(() => {
        expect(readOuterOpacity()).toBe('1');
      });
    }
  );

  it('leaves the outer wrapper scrub-driven when stagger is NOT used', async () => {
    // Reverse guard: neutralization should only occur when stagger is active. Without
    // stagger, the outer wrapper must still be owned by its own drive lane (initial frame 0),
    // otherwise "neutralization" would leak into unconditional behavior.
    render(
      <SceneContext.Provider value={createSceneContext('scroll')}>
        <Animate
          animateId="no-stagger"
          enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
        >
          <p>plain</p>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('plain')).toBeInTheDocument();
    });
    expect(readOuterOpacity()).toBe('0');
  });
});
