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

  // 只给最外层那一个 motion.div 打 testid：内层（infinite 的嵌套 wrapper、stagger 的
  // 子项）不带，避免 getByTestId 命中多个。用 depth 计数区分。
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

/** 解析请求按被请求的 phase 分发：enter → 入场变体，infinite → 循环变体。 */
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

  // 四格全覆盖。scroll + infinite 那格曾是唯一绑原始 scrub style 的分支
  // （`scrollResult.style` 而非 `scrollOuterStyle`），2026-08-27 修正后并回矩阵。
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

      // 变体解析落地后，外层必须交出视觉属性 = 中性 opacity 1。
      // 若某个分支绑了原始 scrub style，这里会读到初始帧的 0（或其他 scrub 值）。
      await waitFor(() => {
        expect(readOuterOpacity()).toBe('1');
      });
    }
  );

  it('leaves the outer wrapper scrub-driven when stagger is NOT used', async () => {
    // 反向守卫：中和只应在 stagger 生效时发生。没有 stagger 时外层必须仍由
    // 自己的驱动轨拥有（初始帧 0），否则「中和」就泄漏成了无条件行为。
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
