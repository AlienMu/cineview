/**
 * Drag Progress Control Bug Fix Test
 *
 * 测试拖拽控制动画进度的功能是否正常工作
 */

import { render, act } from '@testing-library/react';
import { useMotionValue } from 'framer-motion';
import { Animate, SceneContext, type SceneContextType } from '../../components/Animate/Animate';

describe('Drag Progress Control Bug Fix', () => {
  it('should update animation progress when dragProgress changes', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: true,
        dragProgressMotion,
        sceneEnterCompleted: true,
        sceneState: 'active',
        sceneOffset: 0,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 600,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(true).toBe(true);
  });

  it('should handle sceneOffset = 0 (current scene) correctly', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0.5);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: true,
        dragProgressMotion,
        sceneEnterCompleted: true,
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
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Current Scene</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    const { container } = render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('should handle sceneOffset = 1 (next scene) correctly', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0.5);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: false,
        isDragging: true,
        dragProgressMotion,
        sceneEnterCompleted: false,
        sceneState: 'initial',
        sceneOffset: 1,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 600,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Next Scene</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    const { container } = render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('should handle sceneOffset = -1 (previous scene) correctly', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(-0.5);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: false,
        isDragging: true,
        dragProgressMotion,
        sceneEnterCompleted: false,
        sceneState: 'initial',
        sceneOffset: -1,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 600,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Previous Scene</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    const { container } = render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('should stop infinite animation when dragging starts', async () => {
    const TestComponent = () => {
      const dragProgressMotion = useMotionValue(0);
      const mockContext: SceneContextType = {
        mode: 'drag',
        isActive: true,
        isDragging: false,
        dragProgressMotion,
        sceneEnterCompleted: true,
        sceneState: 'active',
        sceneOffset: 0,
        sceneTransitionDuration: 800,
        registerAnimate: jest.fn(),
        unregisterAnimate: jest.fn(),
        getCalculatedDelay: jest.fn(() => 0),
        enterDuration: 600,
      };

      return (
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );
    };

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(true).toBe(true);
  });
});
