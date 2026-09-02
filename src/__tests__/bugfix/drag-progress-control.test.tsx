/**
 * Drag Progress Control Bug Fix Test
 *
 * 原始缺陷：拖拽时元素动画不跟随进度，停在初始帧。
 *
 * 该缺陷的现代形态由**双轨模型**定义，两条断言都必须落在解析出来的样式上：
 *  - 正在滑走的 active 场景，其退场视觉跟随 **renderProgress**（页面位移轨）；
 *  - `dragProgressMotion` 单独变化**不**推动元素视觉——元素轨是场景自有的。
 *
 * 本文件刻意不 mock framer-motion：断言读的是 motion.div 真正写进 DOM 的行内样式，
 * 而不是传给它的 props。
 */

import { render, act } from '@testing-library/react';
import { useMotionValue, type MotionValue } from 'framer-motion';
import { Animate, SceneContext, type SceneContextType } from '../../components/Animate/Animate';

function readOpacity(container: HTMLElement): number {
  const element = container.querySelector('.cineview-animate') as HTMLElement | null;
  expect(element).not.toBeNull();
  return parseFloat(element!.style.opacity || '1');
}

interface HarnessOptions {
  renderProgress: number;
  loopAnimation?: 'pulse';
}

function makeHarness({ renderProgress, loopAnimation }: HarnessOptions) {
  let motion: MotionValue<number> | null = null;

  const TestComponent = (): JSX.Element => {
    const dragProgressMotion = useMotionValue(0);
    motion = dragProgressMotion;
    const mockContext: SceneContextType = {
      mode: 'drag',
      isActive: true,
      isDragging: true,
      dragProgressMotion,
      renderProgress,
      sceneState: 'exiting',
      sceneOffset: 0,
      sceneTransitionDuration: 800,
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn(() => 0),
      enterDuration: 600,
    };

    return (
      <SceneContext.Provider value={mockContext}>
        <Animate enterAnimation="fade-in" exitAnimation="fade-out" loopAnimation={loopAnimation}>
          <div>Test Content</div>
        </Animate>
      </SceneContext.Provider>
    );
  };

  return {
    TestComponent,
    get dragProgressMotion(): MotionValue<number> {
      return motion!;
    },
  };
}

describe('Drag Progress Control Bug Fix', () => {
  it('scrubs the outgoing element opacity with renderProgress', async () => {
    const samples: number[] = [];

    for (const renderProgress of [0, 0.25, 0.5, 0.75]) {
      const { TestComponent } = makeHarness({ renderProgress });
      const { container, unmount } = render(<TestComponent />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      samples.push(readOpacity(container));
      unmount();
    }

    // 800ms 的位移轨对 600ms 的退场：0 → 1、0.75 → 0，中间线性。
    expect(samples[0]).toBeCloseTo(1, 5);
    expect(samples[1]).toBeCloseTo(2 / 3, 5);
    expect(samples[2]).toBeCloseTo(1 / 3, 5);
    expect(samples[3]).toBeCloseTo(0, 5);
    // 严格单调：视觉卡在初始帧（原缺陷）时这里全是同一个数。
    expect(samples[1]).toBeLessThan(samples[0]);
    expect(samples[2]).toBeLessThan(samples[1]);
    expect(samples[3]).toBeLessThan(samples[2]);
  });

  it('does not move the element visual when only dragProgressMotion changes (two-track)', async () => {
    const harness = makeHarness({ renderProgress: 0.25 });
    const { container } = render(<harness.TestComponent />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const before = readOpacity(container);
    expect(before).toBeCloseTo(2 / 3, 5);

    await act(async () => {
      harness.dragProgressMotion.set(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // 元素轨是场景自有的；页面位移轨没动，视觉就不该动。
    expect(readOpacity(container)).toBeCloseTo(before, 5);
  });

  it('resolves the outgoing visual even with a loopAnimation attached', async () => {
    const { TestComponent } = makeHarness({ renderProgress: 0.5, loopAnimation: 'pulse' });
    const { container } = render(<TestComponent />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 带循环动画时外层仍须交出退场进度，不能停在初始帧。
    expect(readOpacity(container)).toBeCloseTo(1 / 3, 5);
  });
});
