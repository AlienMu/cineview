/**
 * Tier 1 render-prop 测试。覆盖 Animate.tsx 的函数 children 分支:
 *   - 非函数 children 原样透传(不挂 bridge)
 *   - 函数 children + scroll → ScrollRenderBridge 派生 state
 *   - 函数 children + drag  → DragRenderBridge 派生 state
 *   - 无动画早退分支下,函数 children 收到 IDLE_RENDER_STATE(不渲染成 [object Function])
 *
 * 断言方式沿用主套件:getByText 冒烟 + 读渲染出的 state 文本。framer mock inline
 * (本仓无共享 mock),补齐 motion.span / useMotionValueEvent 供 bridge 订阅。
 */
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import type { MotionValue } from 'framer-motion';
import { ScrollRenderBridge, DragRenderBridge } from './AnimateRenderBridge';
import type { GatePhase } from './useAnimateScroll';
import type { DragVisualState } from './useAnimateDrag';

type Listener = (value: unknown) => void;

function makeStub<T = unknown>(initial: T): MotionValue<T> {
  let current: T = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    set: (v: T) => {
      current = v;
      listeners.forEach((l) => l(v));
    },
    on: (_e: string, l: Listener) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  } as unknown as MotionValue<T>;
}

jest.mock('framer-motion', () => {
  const React = jest.requireActual('react');
  const passthrough =
    (Tag: string) =>
    ({
      children,
      initial: _i,
      animate: _a,
      variants: _v,
      custom: _c,
      style,
      ...props
    }: Record<string, unknown>): JSX.Element =>
      React.createElement(
        Tag,
        { 'data-testid': `motion-${Tag}`, style, ...props },
        children as never
      );
  return {
    motion: { div: passthrough('div'), p: passthrough('p'), span: passthrough('span') },
    useAnimation: () => ({ start: jest.fn(), set: jest.fn(), stop: jest.fn() }),
    useMotionValue: (initial: number) => makeStub(initial),
    useTransform: () => makeStub(0),
    useMotionValueEvent: (mv: MotionValue, _event: string, cb: Listener) => {
      const React2 = jest.requireActual('react');
      React2.useEffect(() => mv.on('change', cb), [mv, cb]);
    },
    animate: () => ({ stop: jest.fn() }),
  };
});

jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn((animation) => {
    if (typeof animation === 'string') {
      return Promise.resolve({
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.6 } },
        exit: { opacity: 0 },
      });
    }
    return Promise.resolve({
      initial: animation.initial ?? {},
      animate: animation.animate ?? { opacity: 1 },
      exit: animation.exit ?? {},
    });
  }),
}));

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function scrollCtx(): SceneContextType {
  return {
    mode: 'scroll',
    isActive: true,
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 600,
    enterDuration: 600,
    isDragging: false,
    dragProgressMotion: makeStub(0) as MotionValue<number>,
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
  } as unknown as SceneContextType;
}

describe('Tier 1 render-prop', () => {
  it('passes non-function children through untouched', async () => {
    render(
      <SceneContext.Provider value={scrollCtx()}>
        <Animate animateId="rp-plain" enterAnimation="fade-in">
          <div>Plain Child</div>
        </Animate>
      </SceneContext.Provider>
    );
    await flush();
    expect(screen.getByText('Plain Child')).toBeInTheDocument();
  });

  it('scroll: function children receive an enterProgress + phase state', async () => {
    render(
      <SceneContext.Provider value={scrollCtx()}>
        <Animate animateId="rp-scroll" enterAnimation="fade-in">
          {(s) => <div>{`p=${s.enterProgress.toFixed(2)} ${s.phase}`}</div>}
        </Animate>
      </SceneContext.Provider>
    );
    await flush();
    // Initial frame: visualMotion 0 → enterProgress 0, phase idle.
    expect(screen.getByText(/^p=0\.00 /)).toBeInTheDocument();
  });

  it('no-animation early return: function children get idle state, not [object Function]', async () => {
    render(
      <SceneContext.Provider value={scrollCtx()}>
        <Animate animateId="rp-noanim">
          {(s) => <div>{`idle:${s.phase}:${s.enterProgress}`}</div>}
        </Animate>
      </SceneContext.Provider>
    );
    await flush();
    expect(screen.getByText('idle:idle:0')).toBeInTheDocument();
    expect(screen.queryByText(/object Function/)).not.toBeInTheDocument();
  });
});

// 直接驱动 bridge 的 MotionValue change 回调 —— scrub 的核心路径(进度/相位变化时
// 重新派生 state)。穿过整个 Animate 无法确定性推进 motion value,故直接测导出组件。
describe('ScrollRenderBridge — 订阅 signedVisual + phaseMotion 重新派生', () => {
  it('progress 与 phase 变化都触发重新渲染', () => {
    const signed = makeStub(0) as MotionValue<number>;
    const phase = makeStub<GatePhase>('idle') as unknown as MotionValue<GatePhase>;
    render(
      <ScrollRenderBridge
        signedVisual={signed}
        phaseMotion={phase}
        render={(s) => <div>{`p=${s.enterProgress.toFixed(2)}/${s.phase}`}</div>}
      />
    );
    expect(screen.getByText('p=0.00/idle')).toBeInTheDocument();

    act(() => {
      (phase as unknown as MotionValue).set('entering' as never);
    });
    act(() => {
      signed.set(0.5);
    });
    expect(screen.getByText('p=0.50/entering')).toBeInTheDocument();

    // 退出段 signedVisual<0 → enterProgress 夹到 0
    act(() => {
      signed.set(-1);
      (phase as unknown as MotionValue).set('exiting' as never);
    });
    expect(screen.getByText('p=0.00/exiting')).toBeInTheDocument();
  });
});

describe('DragRenderBridge — 订阅 visualState 派生 mode+progress', () => {
  const vs = (mode: DragVisualState['mode'], localProgress: number): DragVisualState =>
    ({ mode, localProgress }) as DragVisualState;

  it('null 初始 → idle;enter 中途 → entering;rest → entered', () => {
    const state = makeStub<DragVisualState | null>(
      null
    ) as unknown as MotionValue<DragVisualState | null>;
    render(
      <DragRenderBridge
        visualState={state}
        render={(s) => <div>{`${s.phase}@${s.enterProgress.toFixed(2)}`}</div>}
      />
    );
    expect(screen.getByText('idle@0.00')).toBeInTheDocument();

    act(() => {
      (state as unknown as MotionValue).set(vs('enter', 0.3) as never);
    });
    expect(screen.getByText('entering@0.30')).toBeInTheDocument();

    act(() => {
      (state as unknown as MotionValue).set(vs('rest', 1) as never);
    });
    expect(screen.getByText('entered@1.00')).toBeInTheDocument();
  });
});

describe('drag 模式 Animate:函数 children 走 DragRenderBridge', () => {
  it('挂载即渲染 state 文本(不崩、不 [object Function])', async () => {
    const ctx = {
      ...scrollCtx(),
      mode: 'drag' as const,
    } as SceneContextType;
    render(
      <SceneContext.Provider value={ctx}>
        <Animate animateId="rp-drag" enterAnimation="fade-in">
          {(s) => <div>{`drag:${s.phase}`}</div>}
        </Animate>
      </SceneContext.Provider>
    );
    await flush();
    expect(screen.getByText(/^drag:/)).toBeInTheDocument();
    expect(screen.queryByText(/object Function/)).not.toBeInTheDocument();
  });
});
