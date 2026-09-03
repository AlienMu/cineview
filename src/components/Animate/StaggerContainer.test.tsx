/**
 * StaggerContainer 测试 — 覆盖 renderStaggerTree 纯渲染 + ScrollStagger/DragStagger
 * 两个订阅组件的全部相位分支（motionTag / orderFor / derive）。
 */

import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { DragVisualState } from './useAnimateDrag';
import {
  countStaggerItems,
  renderStaggerTree,
  resolveStaggerTiming,
  ScrollStagger,
  DragStagger,
} from './StaggerContainer';

jest.mock('framer-motion', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const actual = jest.requireActual('framer-motion') as typeof import('framer-motion');
  const MotionLabelContext = React.createContext('initial');
  const MockMotionTag = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
    const { variants, animate, initial, custom, children, ...domProps } = props as {
      variants?: Record<string, unknown>;
      animate?: string;
      initial?: string;
      custom?: number;
      children?: React.ReactNode;
    };
    const inheritedLabel = React.useContext(MotionLabelContext);
    const label = animate ?? inheritedLabel ?? initial ?? 'initial';
    const target = variants?.[label];
    const resolved = typeof target === 'function' ? target(custom) : target;
    const transition = (resolved as { transition?: Record<string, unknown> } | undefined)
      ?.transition;
    React.useLayoutEffect(() => {
      const probe = (
        globalThis as typeof globalThis & {
          __CINEVIEW_STAGGER_COMMIT_PROBE__?: (detail: {
            custom?: number;
            label: string;
            duration?: number;
            delay?: number;
          }) => void;
        }
      ).__CINEVIEW_STAGGER_COMMIT_PROBE__;
      probe?.({
        custom,
        label,
        duration: typeof transition?.duration === 'number' ? transition.duration : undefined,
        delay: typeof transition?.delay === 'number' ? transition.delay : undefined,
      });
    });
    return React.createElement(
      MotionLabelContext.Provider,
      { value: label },
      React.createElement(
        'div',
        {
          ...domProps,
          ref,
          'data-stagger-child': custom === undefined ? undefined : custom,
          'data-duration':
            typeof transition?.duration === 'number' ? String(transition.duration) : undefined,
          'data-delay':
            typeof transition?.delay === 'number' ? String(transition.delay) : undefined,
        },
        children
      )
    );
  });
  const motionProxy = new Proxy(
    {},
    {
      get: () => MockMotionTag,
    }
  );
  return { ...actual, motion: motionProxy };
});

const variant: ParsedAnimationVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0 },
};

// animate variant 无 transition 的分支（?? {} 兜底）
const variantNoTransition: ParsedAnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const container = (
  <p className="stagger-parent">
    <span>a</span>
    <span>b</span>
    <span>c</span>
  </p>
);

function makeDragState(partial: Partial<DragVisualState>): DragVisualState {
  return {
    mode: 'rest',
    direction: 'forward',
    transitionProgress: 0,
    sharedElapsedMs: 0,
    projectedSceneElapsedMs: 0,
    sharedTimelineDurationMs: 0,
    sceneTimelineDurationMs: 0,
    localProgress: 0,
    sceneOffset: 0,
    ...partial,
  };
}

describe('renderStaggerTree', () => {
  it('folds the stagger tail into the effective group duration', () => {
    expect(resolveStaggerTiming(variant, 600, 80, 'first', 5)).toEqual({
      itemDurationMs: 400,
      tailDurationMs: 320,
      effectiveDurationMs: 720,
    });
  });

  it('uses duration.enter as item duration when the variant has no duration', () => {
    expect(resolveStaggerTiming(variantNoTransition, 600, 80, 'first', 3)).toEqual({
      itemDurationMs: 600,
      tailDurationMs: 160,
      effectiveDurationMs: 760,
    });
  });

  it('keeps an explicitly longer group duration and resolves center ordering', () => {
    expect(resolveStaggerTiming(variant, 1000, 80, 'center', 4)).toEqual({
      itemDurationMs: 400,
      tailDurationMs: 120,
      effectiveDurationMs: 1000,
    });
  });

  it('counts exactly the direct valid child elements used by stagger rendering', () => {
    expect(countStaggerItems(container)).toBe(3);
    expect(
      countStaggerItems(
        <p>
          text
          <span>a</span>
          {null}
        </p>
      )
    ).toBe(1);
  });

  it('克隆 container 与直接子元素为 motion 元素，play=true 时父挂 animate 标签', () => {
    const tree = renderStaggerTree(container, variant, 40, 'first', true);
    const { container: root } = render(tree);
    const parent = root.querySelector('.stagger-parent');
    expect(parent).toBeInTheDocument();
    // 三个子元素文本都在
    expect(root.textContent).toBe('abc');
  });

  it('play=false 时正常渲染（父挂 initial 标签）', () => {
    const tree = renderStaggerTree(container, variant, 40, 'first', false);
    const { container: root } = render(tree);
    expect(root.querySelector('.stagger-parent')).toBeInTheDocument();
  });

  it('from=last / from=center 顺序分支均可渲染', () => {
    const last = render(renderStaggerTree(container, variant, 40, 'last', true));
    expect(last.container.textContent).toBe('abc');
    const center = render(renderStaggerTree(container, variant, 40, 'center', true));
    expect(center.container.textContent).toBe('abc');
  });

  it('each<0 被 clamp 到 0（Math.max 分支）', () => {
    const { container: root } = render(renderStaggerTree(container, variant, -100, 'first', true));
    expect(root.querySelector('.stagger-parent')).toBeInTheDocument();
  });

  it('animate 无 transition 时走 ?? {} 兜底', () => {
    const { container: root } = render(
      renderStaggerTree(container, variantNoTransition, 40, 'first', true)
    );
    expect(root.textContent).toBe('abc');
  });

  it('非字符串 type 的 container / 子元素回退到 motion.div', () => {
    const Custom = (props: { children?: React.ReactNode }): React.JSX.Element => (
      <div>{props.children}</div>
    );
    const custom = (
      <Custom>
        <Custom>x</Custom>
      </Custom>
    );
    const { container: root } = render(renderStaggerTree(custom, variant, 40, 'first', true));
    expect(root.textContent).toBe('x');
  });

  it('过滤非法子元素（纯文本节点被 isValidElement 过滤）', () => {
    const withText = (
      <p className="stagger-parent">
        文本
        <span>a</span>
      </p>
    );
    const { container: root } = render(renderStaggerTree(withText, variant, 40, 'first', true));
    expect(root.textContent).toBe('文本a');
    expect(root.querySelector('.stagger-parent')).toBeInTheDocument();
  });

  it('calculates the exit stagger tail from the authored exit transition', () => {
    expect(resolveStaggerTiming(variant, 500, 80, 'last', 4, 'exit')).toEqual({
      itemDurationMs: 500,
      tailDurationMs: 240,
      effectiveDurationMs: 740,
    });
  });
});

describe('ScrollStagger', () => {
  it('signedVisual>0 初始即 play', () => {
    const signed = motionValue(1);
    const { container: root } = render(
      <ScrollStagger
        container={container}
        variant={variant}
        each={40}
        from="first"
        signedVisual={signed}
      />
    );
    expect(root.querySelector('.stagger-parent')).toBeInTheDocument();
  });

  it('signedVisual<=0 初始不 play，change 到 >0 后 play', () => {
    const signed = motionValue(0);
    const { container: root } = render(
      <ScrollStagger
        container={container}
        variant={variant}
        each={40}
        from="first"
        signedVisual={signed}
      />
    );
    expect(root.textContent).toBe('abc');
    act(() => {
      signed.set(1);
    });
    expect(root.textContent).toBe('abc');
    // 回退到 0（退出）
    act(() => {
      signed.set(-1);
    });
    expect(root.textContent).toBe('abc');
  });
});

describe('DragStagger', () => {
  it('mode=enter 且 localProgress>0 → play', () => {
    const vs = motionValue<DragVisualState | null>(
      makeDragState({ mode: 'enter', localProgress: 0.5 })
    );
    const { container: root } = render(
      <DragStagger
        container={container}
        variant={variant}
        each={40}
        from="first"
        visualState={vs}
      />
    );
    expect(root.querySelector('.stagger-parent')).toBeInTheDocument();
  });

  it('mode=rest → play', () => {
    const vs = motionValue<DragVisualState | null>(makeDragState({ mode: 'rest' }));
    const { container: root } = render(
      <DragStagger
        container={container}
        variant={variant}
        each={40}
        from="first"
        visualState={vs}
      />
    );
    expect(root.textContent).toBe('abc');
  });

  it('null / mode=hidden / mode=enter&localProgress=0 → 不 play，change 后更新', () => {
    const vs = motionValue<DragVisualState | null>(null);
    const { container: root } = render(
      <DragStagger
        container={container}
        variant={variant}
        each={40}
        from="first"
        visualState={vs}
      />
    );
    expect(root.textContent).toBe('abc');
    act(() => {
      vs.set(makeDragState({ mode: 'hidden' }));
    });
    act(() => {
      vs.set(makeDragState({ mode: 'enter', localProgress: 0 }));
    });
    act(() => {
      vs.set(makeDragState({ mode: 'enter', localProgress: 0.8 }));
    });
    expect(root.textContent).toBe('abc');
  });
});

describe('mounted stagger phase stability', () => {
  const mountedVariant: ParsedAnimationVariant = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0 },
  };
  const mountedContainer = (
    <p>
      <span>a</span>
      <span>b</span>
      <span>c</span>
    </p>
  );

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    delete (
      globalThis as typeof globalThis & {
        __CINEVIEW_STAGGER_COMMIT_PROBE__?: unknown;
      }
    ).__CINEVIEW_STAGGER_COMMIT_PROBE__;
  });

  const readTransitions = (root: HTMLElement): Array<{ duration: string; delay: string }> =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-stagger-child]')).map((node) => ({
      duration: node.dataset.duration ?? '',
      delay: node.dataset.delay ?? '',
    }));

  it('keeps ScrollStagger authored timing across ordinary rerenders until the group completes', () => {
    const signedVisual = motionValue(1);
    const Host = ({ tick }: { tick: number }): React.JSX.Element => (
      <div data-tick={tick}>
        <ScrollStagger
          container={mountedContainer}
          variant={mountedVariant}
          each={40}
          from="first"
          signedVisual={signedVisual}
        />
      </div>
    );
    const view = render(<Host tick={0} />);
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });

    act(() => jest.advanceTimersByTime(100));
    view.rerender(<Host tick={1} />);
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });

    act(() => jest.advanceTimersByTime(379));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
    act(() => jest.advanceTimersByTime(1));
    expect(readTransitions(view.container)).toEqual([
      { duration: '0', delay: '0' },
      { duration: '0', delay: '0' },
      { duration: '0', delay: '0' },
    ]);
  });

  it('resets the completion clock after ScrollStagger leaves and re-enters animate', () => {
    const signedVisual = motionValue(1);
    const Host = (): React.JSX.Element => (
      <ScrollStagger
        container={mountedContainer}
        variant={mountedVariant}
        each={40}
        from="first"
        exitVariant={mountedVariant}
        signedVisual={signedVisual}
      />
    );
    const view = render(<Host />);
    act(() => jest.advanceTimersByTime(300));
    act(() => signedVisual.set(-1));
    act(() => signedVisual.set(1));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
    act(() => jest.advanceTimersByTime(479));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
    act(() => jest.advanceTimersByTime(1));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0', delay: '0' });
  });

  it('keeps DragStagger authored timing across MotionValue changes that retain animate phase', () => {
    const visualState = motionValue<DragVisualState | null>({
      mode: 'enter',
      direction: 'forward',
      transitionProgress: 0.5,
      sharedElapsedMs: 0,
      projectedSceneElapsedMs: 0,
      sharedTimelineDurationMs: 0,
      sceneTimelineDurationMs: 0,
      localProgress: 0.5,
      sceneOffset: 0,
    });
    const Host = ({ tick }: { tick: number }): React.JSX.Element => (
      <div data-tick={tick}>
        <DragStagger
          container={mountedContainer}
          variant={mountedVariant}
          each={40}
          from="first"
          visualState={visualState}
        />
      </div>
    );
    const view = render(<Host tick={0} />);
    act(() => jest.advanceTimersByTime(100));
    act(() => visualState.set({ ...visualState.get()!, localProgress: 0.6 }));
    view.rerender(<Host tick={1} />);
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
  });

  it('re-arms the settled clock when exit and re-entry are batched in one MotionValue burst', () => {
    const signedVisual = motionValue(1);
    const Host = (): React.JSX.Element => (
      <ScrollStagger
        container={mountedContainer}
        variant={mountedVariant}
        each={40}
        from="first"
        exitVariant={mountedVariant}
        signedVisual={signedVisual}
      />
    );
    const view = render(<Host />);

    act(() => jest.advanceTimersByTime(480));
    expect(readTransitions(view.container)).toEqual([
      { duration: '0', delay: '0' },
      { duration: '0', delay: '0' },
      { duration: '0', delay: '0' },
    ]);

    act(() => {
      signedVisual.set(-1);
      signedVisual.set(1);
    });

    // The final phase is still animate, but it is a new entry and must retain
    // authored timing until its fresh 480ms budget completes.
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
    act(() => jest.advanceTimersByTime(479));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0.4', delay: '0.08' });
    act(() => jest.advanceTimersByTime(1));
    expect(readTransitions(view.container)[2]).toEqual({ duration: '0', delay: '0' });
  });

  it('does not commit instant timing on the first render of a batched re-entry revision', () => {
    const signedVisual = motionValue(1);
    const Host = (): React.JSX.Element => (
      <ScrollStagger
        container={mountedContainer}
        variant={mountedVariant}
        each={40}
        from="first"
        exitVariant={mountedVariant}
        signedVisual={signedVisual}
      />
    );
    const view = render(<Host />);
    act(() => jest.advanceTimersByTime(480));

    const commits: Array<{
      custom?: number;
      label: string;
      duration?: number;
      delay?: number;
    }> = [];
    (
      globalThis as typeof globalThis & {
        __CINEVIEW_STAGGER_COMMIT_PROBE__?: (detail: (typeof commits)[number]) => void;
      }
    ).__CINEVIEW_STAGGER_COMMIT_PROBE__ = (detail) => commits.push(detail);

    act(() => {
      signedVisual.set(-1);
      signedVisual.set(1);
    });

    const firstReentryCommit = commits.find(
      ({ custom, label }) => custom === 2 && label === 'animate'
    );
    expect(firstReentryCommit).toEqual({
      custom: 2,
      label: 'animate',
      duration: 0.4,
      delay: 0.08,
    });
    view.unmount();
  });
});
