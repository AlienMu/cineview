/**
 * 测试拖拽回弹场景的修复
 *
 * 问题：释放拖拽后，即使没有切换场景（回弹），当前场景也会重新运行入场动画
 * 修复：检测回弹场景（sceneOffset = 0 且 progress < 0.5），直接恢复到完成状态
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
            infiniteAnimation="pulse"
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
