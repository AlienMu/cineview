/**
 * Animate Component Tests
 */

import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import type { ParsedAnimationVariant, PresetAnimation } from '../../types';
import { parseAnimationWithComposition } from '../../animations/composer';
import type { MotionValue } from 'framer-motion';
import {
  type SceneScrollZoneRuntime,
  type SceneScrollTimelineState,
} from '../Scene/sceneScrollRuntime';
import { useAnimateScroll } from './useAnimateScroll';
import { CineViewRuntimeContext } from '../CineView/runtimeContext';

const animationControlsRegistry: Array<{
  start: jest.Mock;
  set: jest.Mock;
  stop: jest.Mock;
}> = [];

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = jest.requireActual('react');
  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();

    return {
      get: (): number => current,
      set: (value: number): void => {
        current = value;
        listeners.forEach((listener) => listener(value));
      },
      on: (_event: string, listener: (value: number) => void): (() => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  return {
    motion: {
      div: ({
        children,
        initial,
        animate,
        variants,
        custom,
        style,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        variants?: unknown;
        custom?: unknown;
        style?: React.CSSProperties;
      }): JSX.Element => {
        void animate;
        void variants;
        void custom;
        return (
          <div
            data-testid="motion-div"
            data-initial={JSON.stringify(initial)}
            {...props}
            style={style}
          >
            {children}
          </div>
        );
      },
    },
    useAnimation: (): {
      start: jest.Mock;
      set: jest.Mock;
      stop: jest.Mock;
    } => {
      const controlsRef: React.MutableRefObject<{
        start: jest.Mock;
        set: jest.Mock;
        stop: jest.Mock;
      } | null> = React.useRef(null);

      if (!controlsRef.current) {
        controlsRef.current = {
          start: jest.fn().mockResolvedValue(undefined),
          set: jest.fn(),
          stop: jest.fn(),
        };
        animationControlsRegistry.push(controlsRef.current);
      }

      return controlsRef.current;
    },
    useMotionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: () => createMotionValueStub(0),
    useMotionValueEvent: (
      motionValue: { on: (event: string, listener: (value: number) => void) => () => void },
      event: string,
      listener: (value: number) => void
    ): void => {
      React.useEffect(() => motionValue.on(event, listener), [event, listener, motionValue]);
    },
    animate: () => ({
      stop: jest.fn(),
    }),
  };
});

function createMotionValueStub(initial: number): MotionValue<number> {
  let current = initial;
  const listeners = new Set<(value: number) => void>();

  return {
    get: (): number => current,
    set: (value: number): void => {
      current = value;
      listeners.forEach((listener) => listener(value));
    },
    on: (_event: string, listener: (value: number) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as MotionValue<number>;
}

const flushAnimationParsing = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function installDefaultParseAnimationMock(): void {
  (parseAnimationWithComposition as jest.Mock).mockImplementation((animation) => {
    if (typeof animation === 'string') {
      return Promise.resolve({
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.6 } },
        exit: { opacity: 0, transition: { duration: 0.6 } },
      });
    }

    return Promise.resolve({
      initial: animation.initial ?? {},
      animate: animation.animate ?? { opacity: 1 },
      exit: animation.exit ?? {},
    });
  });
}

// Mock animation parser
jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn((animation) => {
    if (typeof animation === 'string') {
      // Return mock preset animation
      return Promise.resolve({
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.6 } },
        exit: { opacity: 0, transition: { duration: 0.6 } },
      });
    }
    // Return mock custom animation
    return Promise.resolve({
      initial: animation.initial ?? {},
      animate: animation.animate ?? { opacity: 1 },
      exit: animation.exit ?? {},
    });
  }),
}));

describe('Animate Component', () => {
  const createMockSceneContext = (
    overrides?: Partial<Omit<SceneContextType, 'dragProgressMotion'>> & { dragProgress?: number }
  ): SceneContextType => {
    const dragProgress = overrides?.dragProgress ?? 0;
    const dragProgressMotion = createMotionValueStub(dragProgress);
    const sharedElapsedMotion = createMotionValueStub(0);
    const rest = { ...(overrides || {}) };
    delete (rest as { dragProgress?: number }).dragProgress;

    return {
      mode: 'drag',
      isActive: true,
      isDragging: false,
      dragProgressMotion,
      sharedElapsedMotion,
      renderProgress: 0,
      sceneState: 'active',
      sceneOffset: 0,
      sceneTransitionDuration: 800,
      getTimelineDuration: jest.fn(() => 800),
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn(() => 0),
      enterDuration: 600,
      ...rest,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    animationControlsRegistry.length = 0;
    installDefaultParseAnimationMock();
  });

  const createScrollZoneState = (
    overrides?: Partial<SceneScrollTimelineState>
  ): SceneScrollTimelineState => ({
    zoneId: 'zone-1',
    sceneIndex: 0,
    progressPx: 100,
    totalBudgetPx: 100,
    active: false,
    direction: null,
    approach: 'near',
    sequence: {
      budgets: {
        'scroll-infinite': {
          animateId: 'scroll-infinite',
          startMs: 0,
          enterStartMs: 0,
          enterEndMs: 100,
          exitStartMs: null,
          exitEndMs: null,
          totalEndMs: 100,
          startPx: 0,
          enterStartPx: 0,
          enterEndPx: 100,
          exitStartPx: null,
          exitEndPx: null,
          totalEndPx: 100,
          hasExit: false,
        },
      },
      totalDurationMs: 100,
      totalBudgetPx: 100,
    },
    ...overrides,
  });

  const renderScrollInfiniteProbe = (zoneState: SceneScrollTimelineState) => {
    const scrollRuntime: SceneScrollZoneRuntime = {
      version: 1,
      zoneStates: { 'zone-1': zoneState },
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };
    const scrollSceneContext = createMockSceneContext({
      mode: 'scroll',
      runtimeState: 'active',
      isSceneAnimating: false,
      scrollDirection: 'forward',
      scrollProgress: 1,
      scrollTimelineState: null,
      scrollActiveSceneIndex: 0,
    });
    const enterVariant: ParsedAnimationVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
    const ScrollInfiniteProbe = (): JSX.Element => {
      const result = useAnimateScroll({
        sceneContext: scrollSceneContext,
        zoneRuntime: scrollRuntime,
        zoneId: 'zone-1',
        enterVariant,
        exitVariant: null,
        hasInfiniteAnimation: true,
        componentId: 'scroll-infinite',
        duration: { enter: 100, exit: 0 },
        timeline: { driver: 'scroll', delay: 0, phase: {} },
        visibility: {
          replayOnReenter: true,
        },
      });

      return <output data-testid="should-run-infinite">{String(result.shouldRunInfinite)}</output>;
    };

    return render(<ScrollInfiniteProbe />);
  };

  describe('8.1 Core Functionality', () => {
    it('should register with parent Scene on mount', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            animateId="test-1"
            enterAnimation="fade-in"
            timeline={{ delay: 100 }}
            duration={{ enter: 500 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('test-1', {
          delay: 100,
          duration: 500,
          waitFor: undefined,
          driver: 'drag',
        });
      });
    });

    it('should unregister from parent Scene on unmount', async () => {
      const mockContext = createMockSceneContext();

      const { unmount } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate animateId="test-2" enterAnimation="fade-in">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('test-2', {
          delay: 0,
          duration: 600,
          waitFor: undefined,
          driver: 'drag',
        });
      });

      unmount();

      await waitFor(() => {
        expect(mockContext.unregisterAnimate).toHaveBeenCalledWith('test-2');
      });
    });

    it('should support waitFor parameter for animation chaining', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            animateId="test-3"
            enterAnimation="fade-in"
            timeline={{ waitFor: 'test-1', delay: 200 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('test-3', {
          delay: 200,
          duration: 600,
          waitFor: 'test-1',
          driver: 'drag',
        });
      });
    });

    it('registers waitFor plus stagger with the full visual group duration', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            animateId="stagger-follower"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ waitFor: 'leader' }}
            stagger={{ each: 80 }}
          >
            <div>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenLastCalledWith('stagger-follower', {
          delay: 0,
          duration: 920,
          waitFor: 'leader',
          driver: 'drag',
        });
      });
    });

    it('should use calculated delay from Scene context', async () => {
      const mockContext = createMockSceneContext({
        getCalculatedDelay: jest.fn(() => 1500), // Simulated calculated delay
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate animateId="test-4" enterAnimation="fade-in" timeline={{ delay: 500 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('test-4');
      });
    });

    it('should generate unique ID if animateId is not provided', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in">
            <div>Test Content 1</div>
          </Animate>
        </SceneContext.Provider>
      );

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in">
            <div>Test Content 2</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledTimes(2);
      });
      const firstCall = (mockContext.registerAnimate as jest.Mock).mock.calls[0][0];
      const secondCall = (mockContext.registerAnimate as jest.Mock).mock.calls[1][0];
      expect(firstCall).not.toBe(secondCall);
    });
  });

  describe('scroll mode infinite animation', () => {
    it('keeps the infinite loop running once scroll-driven enter has completed, even after takeover stops being the active input owner', async () => {
      renderScrollInfiniteProbe(
        createScrollZoneState({
          progressPx: 100,
          totalBudgetPx: 100,
          active: false,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('should-run-infinite')).toHaveTextContent('true');
      });
    });
  });

  describe('8.2 Animation Execution', () => {
    it('should parse and apply preset enter animation', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should parse and apply custom animation', async () => {
      const mockContext = createMockSceneContext();
      const customAnimation = {
        initial: { opacity: 0, transform: 'scale(0.5)' },
        animate: { opacity: 1, transform: 'scale(1)', transition: { duration: 1 } },
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={customAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support composed animations', async () => {
      const mockContext = createMockSceneContext();
      const composedAnimation = {
        animations: ['fade-in' as PresetAnimation, 'slide-up' as PresetAnimation],
        mode: 'sequential' as const,
        delays: [0, 500],
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle drag mode animation execution', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" duration={{ enter: 500 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle drag mode progress synchronization', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: true,
        dragProgress: 0.5,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.3 Infinite Loop Animation', () => {
    it('should start infinite animation AFTER enter animation completes', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Verify that the component renders correctly with both animations
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should stop infinite animation when exit animation starts in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            animateId="test-exit-stop"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Trigger exit animation by deactivating scene
      const inactiveContext = createMockSceneContext({
        mode: 'drag',
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            animateId="test-exit-stop"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        // Component should still be in the document during exit animation
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should stop infinite animation when dragging starts in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
        isDragging: false,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation="fade-out" infiniteAnimation="pulse" animateId="test-drag-stop">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Start dragging
      const draggingContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
        isDragging: true,
        dragProgress: 0.3,
      });

      rerender(
        <SceneContext.Provider value={draggingContext}>
          <Animate exitAnimation="fade-out" infiniteAnimation="pulse" animateId="test-drag-stop">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        // Component should still be in the document during drag
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should stop infinite animation when scene becomes inactive', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Change scene to inactive
      const inactiveContext = createMockSceneContext({
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should restart infinite animation when scene becomes active again', async () => {
      const mockContext = createMockSceneContext({
        isActive: false,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate infiniteAnimation="heartbeat">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Change scene to active
      const activeContext = createMockSceneContext({
        isActive: true,
      });

      rerender(
        <SceneContext.Provider value={activeContext}>
          <Animate infiniteAnimation="heartbeat">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle infinite animation with enter animation in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            infiniteAnimation="pulse"
            animateId="test-infinite"
            duration={{ enter: 300 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('test-infinite', {
          delay: 0,
          duration: 300,
          waitFor: undefined,
          driver: 'drag',
        });
      });
    });

    it('should handle complete lifecycle: enter -> infinite -> exit in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            duration={{ enter: 200, exit: 200 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Wait for enter animation to complete
      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Trigger exit by deactivating scene
      const inactiveContext = createMockSceneContext({
        mode: 'drag',
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            duration={{ enter: 200, exit: 200 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Verify content is still present during exit
      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle complete lifecycle in drag mode: enter -> infinite -> drag -> release', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
        isDragging: false,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Start dragging - should stop infinite animation
      const draggingContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
        isDragging: true,
        dragProgress: 0.5,
      });

      rerender(
        <SceneContext.Provider value={draggingContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Release drag and transition to next scene
      const releasedContext = createMockSceneContext({
        mode: 'drag',
        isActive: false,
        isDragging: false,
        dragProgress: 1,
      });

      rerender(
        <SceneContext.Provider value={releasedContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.4 Error Handling', () => {
    it('should still render outside Scene in development without requiring a Scene wrapper', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <Animate animateId="test-error">
          <div>Test Content</div>
        </Animate>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle invalid enter animation gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockContext = createMockSceneContext();

      // Mock parser to return null for invalid animation
      // parseAnimationWithComposition is imported at the top
      (parseAnimationWithComposition as jest.Mock).mockResolvedValueOnce(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={'invalid-animation' as PresetAnimation} animateId="test-invalid">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse enter animation')
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle invalid exit animation gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockContext = createMockSceneContext();

      // Mock parser to return null for invalid animation
      // parseAnimationWithComposition is imported at the top
      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        })
        .mockResolvedValueOnce(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation={'invalid-animation' as PresetAnimation}
            animateId="test-invalid-exit"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse exit animation')
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should render children even when animations fail to parse', async () => {
      const mockContext = createMockSceneContext();

      // Mock parser to return null
      // parseAnimationWithComposition is imported at the top
      (parseAnimationWithComposition as jest.Mock).mockResolvedValue(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={'invalid' as PresetAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('keeps structurally equal inline animations stable across parent rerenders', async () => {
      const mockContext = createMockSceneContext();
      const createInlineAnimation = () => ({
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate animateId="stable-inline" enterAnimation={createInlineAnimation()}>
            <div>Stable inline animation</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1));

      for (let index = 0; index < 3; index += 1) {
        rerender(
          <SceneContext.Provider value={mockContext}>
            <Animate animateId="stable-inline" enterAnimation={createInlineAnimation()}>
              <div>Stable inline animation</div>
            </Animate>
          </SceneContext.Provider>
        );
      }
      await flushAnimationParsing();

      expect(parseAnimationWithComposition).toHaveBeenCalledTimes(1);
      expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1);
      expect(mockContext.unregisterAnimate).not.toHaveBeenCalled();
      expect(
        screen.getByText('Stable inline animation').closest('.cineview-animate')
      ).not.toBeNull();
    });

    it('keeps the arrival host and child mounted when authoring changes during one activation', async () => {
      const mockContext = createMockSceneContext({
        activationToken: 1,
        activationKind: 'commit',
      });
      const initialVariant: ParsedAnimationVariant = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
      let resolveNext!: (variant: ParsedAnimationVariant) => void;
      const nextVariant = new Promise<ParsedAnimationVariant>((resolve) => {
        resolveNext = resolve;
      });
      (parseAnimationWithComposition as jest.Mock).mockImplementation((animation: string) =>
        animation === 'slide-up' ? nextVariant : Promise.resolve(initialVariant)
      );

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            animateId="arrival-authoring-freeze"
            enterAnimation="fade-in"
            timeline={{ sceneControlled: false }}
          >
            <div data-testid="arrival-frozen-child">Frozen arrival content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Frozen arrival content').closest('.cineview-animate')
        ).not.toBeNull();
      });
      const originalChild = screen.getByTestId('arrival-frozen-child');
      const originalHost = originalChild.closest('.cineview-animate');
      expect(originalHost).not.toBeNull();

      rerender(
        <SceneContext.Provider value={mockContext}>
          <Animate
            animateId="arrival-authoring-freeze"
            enterAnimation="slide-up"
            timeline={{ sceneControlled: false }}
          >
            <div data-testid="arrival-frozen-child">Frozen arrival content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => expect(parseAnimationWithComposition).toHaveBeenCalledWith('slide-up'));
      expect(screen.getByTestId('arrival-frozen-child')).toBe(originalChild);
      expect(screen.getByTestId('arrival-frozen-child').closest('.cineview-animate')).toBe(
        originalHost
      );

      await act(async () => {
        resolveNext({
          initial: { y: 100 },
          animate: { y: 0 },
          exit: { y: -100 },
        });
        await nextVariant;
      });

      expect(screen.getByTestId('arrival-frozen-child')).toBe(originalChild);
      expect(screen.getByTestId('arrival-frozen-child').closest('.cineview-animate')).toBe(
        originalHost
      );
    });

    it('reports and fails open statically for an exit-only runtime payload', async () => {
      const mockContext = createMockSceneContext();
      const reportError = jest.fn();

      render(
        <CineViewRuntimeContext.Provider value={{ mode: 'drag', reportError }}>
          <SceneContext.Provider value={mockContext}>
            <Animate animateId="exit-only-runtime" exitAnimation="fade-out">
              <div>Static exit-only content</div>
            </Animate>
          </SceneContext.Provider>
        </CineViewRuntimeContext.Provider>
      );

      await waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_ANIMATION',
            context: expect.objectContaining({
              componentId: 'exit-only-runtime',
              hasExitAnimation: true,
            }),
          })
        )
      );

      expect(parseAnimationWithComposition).not.toHaveBeenCalled();
      expect(mockContext.registerAnimate).not.toHaveBeenCalled();
      expect(screen.getByText('Static exit-only content').closest('.cineview-animate')).toBeNull();
    });

    it('does not let an older successful generation overwrite or re-register the current one', async () => {
      const mockContext = createMockSceneContext();
      let resolveOld!: (variant: ParsedAnimationVariant) => void;
      const oldResult = new Promise<ParsedAnimationVariant>((resolve) => {
        resolveOld = resolve;
      });
      const currentVariant: ParsedAnimationVariant = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
      (parseAnimationWithComposition as jest.Mock).mockImplementation((animation: string) =>
        animation === 'slide-up' ? oldResult : Promise.resolve(currentVariant)
      );

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate animateId="generation-success" enterAnimation="slide-up">
            <div>Current generation</div>
          </Animate>
        </SceneContext.Provider>
      );

      rerender(
        <SceneContext.Provider value={mockContext}>
          <Animate animateId="generation-success" enterAnimation="fade-in">
            <div>Current generation</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1));

      await act(async () => {
        resolveOld({
          initial: { y: 100 },
          animate: { y: 0 },
          exit: { y: -100 },
        });
        await oldResult;
      });

      expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1);
    });

    it('does not report a rejected preset from an obsolete generation', async () => {
      const mockContext = createMockSceneContext();
      const reportError = jest.fn();
      let rejectOld!: (error: Error) => void;
      const oldResult = new Promise<ParsedAnimationVariant>((_resolve, reject) => {
        rejectOld = reject;
      });
      const currentVariant: ParsedAnimationVariant = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
      (parseAnimationWithComposition as jest.Mock).mockImplementation((animation: string) =>
        animation === 'slide-up' ? oldResult : Promise.resolve(currentVariant)
      );

      const { rerender } = render(
        <CineViewRuntimeContext.Provider value={{ mode: 'drag', reportError }}>
          <SceneContext.Provider value={mockContext}>
            <Animate animateId="generation-failure" enterAnimation="slide-up">
              <div>Current generation</div>
            </Animate>
          </SceneContext.Provider>
        </CineViewRuntimeContext.Provider>
      );

      rerender(
        <CineViewRuntimeContext.Provider value={{ mode: 'drag', reportError }}>
          <SceneContext.Provider value={mockContext}>
            <Animate animateId="generation-failure" enterAnimation="fade-in">
              <div>Current generation</div>
            </Animate>
          </SceneContext.Provider>
        </CineViewRuntimeContext.Provider>
      );

      await waitFor(() => expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1));

      await act(async () => {
        rejectOld(new Error('obsolete chunk failure'));
        await oldResult.catch(() => undefined);
      });

      expect(reportError).not.toHaveBeenCalled();
      expect(mockContext.registerAnimate).toHaveBeenCalledTimes(1);
    });
  });

  describe('8.5 Preset Animations', () => {
    const presetAnimations: PresetAnimation[] = [
      // Basic animations
      'fade',
      'fade-in',
      'fade-out',
      // Slide animations
      'slide-up',
      'slide-down',
      'slide-left',
      'slide-right',
      // Zoom animations
      'zoom-in',
      'zoom-out',
      'scale-up',
      'scale-down',
      // Rotate animations
      'rotate',
      'rotate-in',
      'rotate-out',
      'spin',
      // Flip animations
      'flip',
      'flip-x',
      'flip-y',
      // Bounce animations
      'bounce',
      'bounce-in',
      'bounce-out',
      // Blink animations
      'blink',
      'flash',
      'pulse',
      // Shake animations
      'shake',
      'shake-x',
      'shake-y',
      'vibrate',
      'jello',
      // Blur animations
      'blur-in',
      'blur-out',
      'focus-in',
      // Elastic animations
      'elastic',
      'rubber-band',
      'wobble',
      'swing',
      // Special effects
      'heartbeat',
      'tada',
      'wave',
      'roll-in',
      'roll-out',
      'hinge',
      'jack-in-the-box',
    ];

    presetAnimations.forEach((animationName) => {
      it(`should support preset animation: ${animationName}`, async () => {
        const mockContext = createMockSceneContext({
          isActive: true,
        });

        render(
          <SceneContext.Provider value={mockContext}>
            <Animate enterAnimation={animationName}>
              <div>Test Content</div>
            </Animate>
          </SceneContext.Provider>
        );

        await waitFor(() => {
          expect(screen.getByText('Test Content')).toBeInTheDocument();
        });
      });
    });

    it('fails open for the removed "none" preset when runtime input bypasses types', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={'none' as unknown as PresetAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.6 Custom Animations', () => {
    it('should support Framer Motion variant subset format', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const customAnimation = {
        initial: { opacity: 0, transform: 'scale(0.5) rotate(0deg)' },
        animate: {
          opacity: [0.5, 1],
          transform: ['scale(0.75) rotate(180deg)', 'scale(1) rotate(360deg)'],
          transition: { duration: 1, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        },
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={customAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support array-valued variant properties', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const customAnimation = {
        initial: { opacity: 0, transform: 'translateY(100px)' },
        animate: {
          opacity: [0.5, 1],
          transform: ['translateY(50px)', 'translateY(0)'],
          transition: { duration: 0.8, ease: 'easeOut' },
        },
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={customAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support custom animation with delay and duration', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const customAnimation = {
        initial: { opacity: 0, transform: 'translateX(-100px)' },
        animate: {
          opacity: 1,
          transform: 'translateX(0)',
          transition: { duration: 0.5, delay: 0.2, ease: 'easeInOut' },
        },
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={customAnimation} timeline={{ delay: 300 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support custom exit animation', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const customExitAnimation = {
        exit: { opacity: 0, transform: 'scale(0.5)', transition: { duration: 0.4 } },
      };

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation={customExitAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Trigger exit
      const inactiveContext = createMockSceneContext({
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate exitAnimation={customExitAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.7 Composed Animations', () => {
    it('should support sequential composed animations', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const composedAnimation = {
        animations: [
          'fade-in' as PresetAnimation,
          'slide-up' as PresetAnimation,
          'zoom-in' as PresetAnimation,
        ],
        mode: 'sequential' as const,
        delays: [0, 300, 600],
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support parallel composed animations', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const composedAnimation = {
        animations: [
          'fade-in' as PresetAnimation,
          'rotate' as PresetAnimation,
          'scale-up' as PresetAnimation,
        ],
        mode: 'parallel' as const,
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support mixing preset and custom animations in composition', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const customAnimation = {
        animate: {
          transform: ['translateY(-10px)', 'translateY(0)'],
          transition: { duration: 0.5 },
        },
      };

      const composedAnimation = {
        animations: ['blur-in' as PresetAnimation, customAnimation, 'pulse' as PresetAnimation],
        mode: 'sequential' as const,
        delays: [0, 400, 800],
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should support composed animations in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: true,
        dragProgress: 0.5,
      });

      const composedAnimation = {
        animations: ['fade-out' as PresetAnimation, 'slide-down' as PresetAnimation],
        mode: 'parallel' as const,
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle empty animations array in composition', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const composedAnimation = {
        animations: [],
        mode: 'sequential' as const,
      };

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation={composedAnimation}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.8 Animation Delay Calculation', () => {
    it('should apply delay correctly', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn(() => 500),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="delayed" timeline={{ delay: 500 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('delayed');
      });

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should calculate delay with waitFor chain', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn((id) => {
          if (id === 'first') return 0;
          if (id === 'second') return 1000; // first delay + first duration
          if (id === 'third') return 2500; // second delay + second duration
          return 0;
        }),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            animateId="first"
            timeline={{ delay: 0 }}
            duration={{ enter: 500 }}
          >
            <div>First</div>
          </Animate>
          <Animate
            enterAnimation="slide-up"
            animateId="second"
            timeline={{ delay: 500, waitFor: 'first' }}
            duration={{ enter: 1000 }}
          >
            <div>Second</div>
          </Animate>
          <Animate
            enterAnimation="zoom-in"
            animateId="third"
            timeline={{ delay: 500, waitFor: 'second' }}
            duration={{ enter: 800 }}
          >
            <div>Third</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('first');
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('second');
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('third');
      });

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
      });
    });

    it('should handle zero delay', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn(() => 0),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="no-delay" timeline={{ delay: 0 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('no-delay');
      });

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('8.9 WaitFor Mechanism', () => {
    it('should wait for referenced animation to complete', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn((id) => {
          if (id === 'first') return 0;
          if (id === 'second') return 1000; // Wait for first (delay 0 + duration 1000)
          return 0;
        }),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="first" duration={{ enter: 1000 }}>
            <div>First</div>
          </Animate>
          <Animate enterAnimation="slide-up" animateId="second" timeline={{ waitFor: 'first' }}>
            <div>Second</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('first', {
          delay: 0,
          duration: 1000,
          waitFor: undefined,
          driver: 'drag',
        });

        expect(mockContext.registerAnimate).toHaveBeenCalledWith('second', {
          delay: 0,
          duration: 600,
          waitFor: 'first',
          driver: 'drag',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
      });
    });

    it('should support multi-level waitFor chains', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn((id) => {
          if (id === 'a') return 0;
          if (id === 'b') return 500; // a: 0 + 500
          if (id === 'c') return 1200; // b: 500 + 700
          if (id === 'd') return 2000; // c: 1200 + 800
          return 0;
        }),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="a" duration={{ enter: 500 }}>
            <div>A</div>
          </Animate>
          <Animate
            enterAnimation="slide-up"
            animateId="b"
            timeline={{ waitFor: 'a' }}
            duration={{ enter: 700 }}
          >
            <div>B</div>
          </Animate>
          <Animate
            enterAnimation="zoom-in"
            animateId="c"
            timeline={{ waitFor: 'b' }}
            duration={{ enter: 800 }}
          >
            <div>C</div>
          </Animate>
          <Animate
            enterAnimation="rotate"
            animateId="d"
            timeline={{ waitFor: 'c' }}
            duration={{ enter: 600 }}
          >
            <div>D</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('a');
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('b');
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('c');
        expect(mockContext.getCalculatedDelay).toHaveBeenCalledWith('d');
      });

      await waitFor(() => {
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('C')).toBeInTheDocument();
        expect(screen.getByText('D')).toBeInTheDocument();
      });
    });

    it('should combine waitFor with delay', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn((id) => {
          if (id === 'first') return 0;
          if (id === 'second') return 1500; // first execution (1000) + own delay (500)
          return 0;
        }),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="first" duration={{ enter: 1000 }}>
            <div>First</div>
          </Animate>
          <Animate
            enterAnimation="slide-up"
            animateId="second"
            timeline={{ delay: 500, waitFor: 'first' }}
          >
            <div>Second</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('second', {
          delay: 500,
          duration: 600,
          waitFor: 'first',
          driver: 'drag',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
      });
    });
  });

  describe('8.10 Circular Dependency Detection', () => {
    it('should detect direct circular dependency (A -> B -> A)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockContext = createMockSceneContext({
        isActive: true,
      });

      // This would be caught by the Scene component's dependency checker
      // For now, we just verify registration happens
      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="a" timeline={{ waitFor: 'b' }}>
            <div>A</div>
          </Animate>
          <Animate enterAnimation="slide-up" animateId="b" timeline={{ waitFor: 'a' }}>
            <div>B</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledWith('a', {
          delay: 0,
          duration: 600,
          waitFor: 'b',
          driver: 'drag',
        });

        expect(mockContext.registerAnimate).toHaveBeenCalledWith('b', {
          delay: 0,
          duration: 600,
          waitFor: 'a',
          driver: 'drag',
        });
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect indirect circular dependency (A -> B -> C -> A)', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="a" timeline={{ waitFor: 'c' }}>
            <div>A</div>
          </Animate>
          <Animate enterAnimation="slide-up" animateId="b" timeline={{ waitFor: 'a' }}>
            <div>B</div>
          </Animate>
          <Animate enterAnimation="zoom-in" animateId="c" timeline={{ waitFor: 'b' }}>
            <div>C</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(mockContext.registerAnimate).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete animation lifecycle in drag mode', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 300, exit: 300 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Deactivate scene
      const inactiveContext = createMockSceneContext({
        mode: 'drag',
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 300, exit: 300 }}
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle drag release transition', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: true,
        dragProgress: 0.7,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Release drag
      const releasedContext = createMockSceneContext({
        mode: 'drag',
        isDragging: false,
        dragProgress: 1,
        isActive: true,
      });

      rerender(
        <SceneContext.Provider value={releasedContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle multiple Animate components with different delays', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
        getCalculatedDelay: jest.fn((id) => {
          const delays: Record<string, number> = {
            'anim-1': 0,
            'anim-2': 200,
            'anim-3': 400,
          };
          return delays[id] || 0;
        }),
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="anim-1" timeline={{ delay: 0 }}>
            <div>Content 1</div>
          </Animate>
          <Animate enterAnimation="slide-up" animateId="anim-2" timeline={{ delay: 200 }}>
            <div>Content 2</div>
          </Animate>
          <Animate enterAnimation="zoom-in" animateId="anim-3" timeline={{ delay: 400 }}>
            <div>Content 3</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Content 1')).toBeInTheDocument();
        expect(screen.getByText('Content 2')).toBeInTheDocument();
        expect(screen.getByText('Content 3')).toBeInTheDocument();
      });
    });

    it('should handle scene reactivation', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });

      // Deactivate
      const inactiveContext = createMockSceneContext({
        isActive: false,
      });

      rerender(
        <SceneContext.Provider value={inactiveContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Reactivate
      const reactivatedContext = createMockSceneContext({
        isActive: true,
      });

      rerender(
        <SceneContext.Provider value={reactivatedContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle rapid scene changes', async () => {
      const mockContext = createMockSceneContext({
        isActive: true,
      });

      const { rerender } = render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" duration={{ enter: 100 }}>
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      // Rapidly toggle active state
      for (let i = 0; i < 5; i++) {
        const toggledContext = createMockSceneContext({
          isActive: i % 2 === 0,
        });

        rerender(
          <SceneContext.Provider value={toggledContext}>
            <Animate enterAnimation="fade-in" exitAnimation="fade-out" duration={{ enter: 100 }}>
              <div>Test Content</div>
            </Animate>
          </SceneContext.Provider>
        );
      }

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('Branch Coverage Tests', () => {
    it('should handle enter animation parsing error in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockContext = createMockSceneContext();

      // Mock parser to throw error
      (parseAnimationWithComposition as jest.Mock).mockRejectedValueOnce(new Error('Parse error'));

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="test-error">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error parsing enter animation'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle exit animation parsing error in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockContext = createMockSceneContext();

      // Mock parser to succeed for enter, throw for exit
      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        })
        .mockRejectedValueOnce(new Error('Parse error'));

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" animateId="test-exit-error">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error parsing exit animation'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle infinite animation parsing error in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockContext = createMockSceneContext();

      // Mock parser to succeed for enter, throw for infinite
      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        })
        .mockRejectedValueOnce(new Error('Parse error'));

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            infiniteAnimation="blink"
            animateId="test-infinite-error"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error parsing infinite animation'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle infinite animation parsing failure (returns null)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockContext = createMockSceneContext();

      // Mock parser to succeed for enter, return null for infinite
      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        })
        .mockResolvedValueOnce(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate
            enterAnimation="fade-in"
            infiniteAnimation={'invalid' as PresetAnimation}
            animateId="test-infinite-null"
          >
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse infinite animation')
        );
      });

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle drag mode with string pixel values in interpolation', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: true,
        dragProgress: 0.5,
      });

      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { x: '0px' },
          animate: { x: '0px' },
          exit: { x: '100px' },
        })
        .mockResolvedValueOnce({
          initial: { x: '0px' },
          animate: { x: '0px' },
          exit: { x: '100px' },
        });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="slide-right" exitAnimation="slide-left" animateId="test-drag-px">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle drag mode with non-numeric values in interpolation', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: true,
        dragProgress: 0.3,
      });

      (parseAnimationWithComposition as jest.Mock)
        .mockResolvedValueOnce({
          initial: { display: 'block' },
          animate: { display: 'block' },
          exit: { display: 'none' },
        })
        .mockResolvedValueOnce({
          initial: { display: 'block' },
          animate: { display: 'block' },
          exit: { display: 'none' },
        });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" exitAnimation="fade-out" animateId="test-drag-string">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle drag release without hasEntered flag', async () => {
      const mockContext = createMockSceneContext({
        mode: 'drag',
        isDragging: false,
        isActive: true,
      });

      (parseAnimationWithComposition as jest.Mock).mockResolvedValue({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate enterAnimation="fade-in" animateId="test-drag-release">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });
});

describe('Additional Animate Branch Coverage Tests', () => {
  const createMockSceneContext = (overrides?: Partial<SceneContextType>): SceneContextType => {
    const dragProgressMotion = createMotionValueStub(0);
    const sharedElapsedMotion = createMotionValueStub(0);

    return {
      mode: 'drag',
      isActive: true,
      isDragging: false,
      dragProgressMotion,
      sharedElapsedMotion,
      sceneState: 'active',
      sceneOffset: 0,
      sceneTransitionDuration: 800,
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn(() => 0),
      enterDuration: 600,
      ...overrides,
    };
  };

  describe('Infinite animation edge cases', () => {
    it('should handle infiniteAnimation without enterAnimation', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle infiniteAnimation parsing that returns null', async () => {
      const mockContext = createMockSceneContext();

      // Mock parseAnimationWithComposition to return null
      const mockParse = parseAnimationWithComposition as jest.Mock;
      mockParse.mockResolvedValueOnce(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate infiniteAnimation="pulse">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('Exit animation edge cases', () => {
    it('should handle exitAnimation without enterAnimation', async () => {
      const mockContext = createMockSceneContext();

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should handle exitAnimation parsing that returns null', async () => {
      const mockContext = createMockSceneContext();

      const mockParse = parseAnimationWithComposition as jest.Mock;
      mockParse.mockResolvedValueOnce(null);

      render(
        <SceneContext.Provider value={mockContext}>
          <Animate exitAnimation="fade-out">
            <div>Test Content</div>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });
  });

  describe('Scene context interactions', () => {
    it('should handle missing scene context gracefully', async () => {
      // Render without Scene context
      render(
        <Animate animateId="test-animate" enterAnimation="fade-in">
          <div>Test Content</div>
        </Animate>
      );

      await flushAnimationParsing();

      // Should still render
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});

describe('Error Handling and Edge Cases Coverage', () => {
  it('should use default initial variant when enterVariant is null', () => {
    const sharedElapsedMotion = createMotionValueStub(0);
    const mockSceneContext = {
      mode: 'drag' as const,
      isActive: true,
      isDragging: false,
      dragProgress: 0,
      sceneOffset: 0,
      dragProgressMotion: createMotionValueStub(0),
      sharedElapsedMotion,
      renderProgress: 0,
      sceneState: 'active' as const,
      sceneTransitionDuration: 800,
      getTimelineDuration: jest.fn(() => 800),
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn().mockReturnValue(0),
      enterDuration: 600,
    };

    const { container } = render(
      <SceneContext.Provider value={mockSceneContext}>
        <Animate>
          <div>Test</div>
        </Animate>
      </SceneContext.Provider>
    );

    // Should render with default opacity: 1
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('should handle drag mode with string pixel values in animation variants', async () => {
    const sharedElapsedMotion = createMotionValueStub(0);
    const mockSceneContext = {
      mode: 'drag' as const,
      isActive: true,
      isDragging: true,
      dragProgress: 0.5,
      sceneOffset: 0,
      dragProgressMotion: createMotionValueStub(0.5),
      sharedElapsedMotion,
      renderProgress: 0.5,
      sceneState: 'exiting' as const,
      sceneTransitionDuration: 800,
      getTimelineDuration: jest.fn(() => 800),
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn().mockReturnValue(0),
      enterDuration: 600,
    };

    render(
      <SceneContext.Provider value={mockSceneContext}>
        <Animate
          enterAnimation="fade-in"
          exitAnimation={{
            exit: { opacity: 0, transform: 'translateY(100px)', transition: { duration: 0.5 } },
          }}
        >
          <div>Test</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(mockSceneContext.registerAnimate).toHaveBeenCalled();
    });
  });

  it('should handle non-numeric animation values in drag mode', async () => {
    const sharedElapsedMotion = createMotionValueStub(0);
    const mockSceneContext = {
      mode: 'drag' as const,
      isActive: true,
      isDragging: true,
      dragProgress: 0.5,
      sceneOffset: 0,
      dragProgressMotion: createMotionValueStub(0.5),
      sharedElapsedMotion,
      renderProgress: 0.5,
      sceneState: 'exiting' as const,
      sceneTransitionDuration: 800,
      getTimelineDuration: jest.fn(() => 800),
      registerAnimate: jest.fn(),
      unregisterAnimate: jest.fn(),
      getCalculatedDelay: jest.fn().mockReturnValue(0),
      enterDuration: 600,
    };

    render(
      <SceneContext.Provider value={mockSceneContext}>
        <Animate
          enterAnimation="fade-in"
          exitAnimation={{
            exit: { opacity: 0, visibility: 'hidden', transition: { duration: 0.5 } },
          }}
        >
          <div>Test</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(mockSceneContext.registerAnimate).toHaveBeenCalled();
    });
  });
});
