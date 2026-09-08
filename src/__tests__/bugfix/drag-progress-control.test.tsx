/**
 * Drag Progress Control Bug Fix Test
 *
 * Original defect: element animation does not follow progress during drag, stuck at initial frame.
 *
 * The modern form of this defect is defined by the **two-track model**. Both assertions must apply to resolved styles:
 *  - The active scene sliding away: its exit visual follows **renderProgress** (page displacement track);
 *  - `dragProgressMotion` changes alone do **not** drive element visuals — element tracks belong to the scene itself.
 *
 * This file deliberately does not mock framer-motion: assertions read the inline styles that motion.div
 * actually writes to the DOM, not the props passed to it.
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

  const TestComponent = (): React.JSX.Element => {
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

    // 800ms displacement track against 600ms exit: 0 → 1, 0.75 → 0, linear between.
    expect(samples[0]).toBeCloseTo(1, 5);
    expect(samples[1]).toBeCloseTo(2 / 3, 5);
    expect(samples[2]).toBeCloseTo(1 / 3, 5);
    expect(samples[3]).toBeCloseTo(0, 5);
    // Strictly monotonic: when visual is stuck at initial frame (original defect), all samples are identical.
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

    // Element track belongs to the scene; if page displacement track doesn't move, visual shouldn't move.
    expect(readOpacity(container)).toBeCloseTo(before, 5);
  });

  it('resolves the outgoing visual even with a loopAnimation attached', async () => {
    const { TestComponent } = makeHarness({ renderProgress: 0.5, loopAnimation: 'pulse' });
    const { container } = render(<TestComponent />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // With loop animation, outer layer must still yield exit progress, not stuck at initial frame.
    expect(readOpacity(container)).toBeCloseTo(1 / 3, 5);
  });
});
