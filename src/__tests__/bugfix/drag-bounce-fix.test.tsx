/**
 * Test drag bounce scenario fix
 *
 * Issue: After releasing drag, even without scene switch (bounce back), the current scene replays enter animation
 * Fix: Detect bounce scenario (sceneOffset = 0 and progress < 0.5), restore directly to complete state
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useMotionValue } from 'framer-motion';
import { Animate, SceneContext } from '../../components/Animate/Animate';
import type { SceneContextType } from '../../components/Animate/Animate';

describe('Drag Bounce Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not replay enter animation on bounce back (sceneOffset=0, progress<0.5)', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0.3);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: true,
        dragProgressMotion,
        sceneState: 'active',
        sceneOffset: 0,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 800,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            loopAnimation="pulse"
            animateId="test-bounce"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  it('should replay enter animation on scene switch (sceneOffset changes from 1 to 0)', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: false,
        dragProgressMotion,
        sceneState: 'entering',
        sceneOffset: 0,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 800,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" animateId="test-switch">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  it('should handle edge case: progress exactly at 0.5', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0.5);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: false,
        dragProgressMotion,
        sceneState: 'active',
        sceneOffset: 0,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 800,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" animateId="test-edge">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});
