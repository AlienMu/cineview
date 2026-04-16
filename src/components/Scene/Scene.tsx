/**
 * Scene Component
 * 表示一个全屏场景，管理场景内的动画和滑动行为
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { SceneProps } from '../../types';
import { DEFAULT_SLIDE_DURATION } from '../../types';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { useCineViewContext } from '../../context/CineViewContext';
import type { AnimateRegistrationInfo } from '../Animate/Animate';
import type { PresetAnimation } from '../../animations/presets';
import { parseAnimationSafely, interpolateVariant } from '../../utils/animationHelpers';
import { createSnapGestureHandlers, createDragGestureHandlers } from '../../utils/gestureHandlers';

export interface SceneInternalProps extends SceneProps {
  isActive?: boolean;
  sceneIndex?: number;
  onSceneChange?: (direction: 'forward' | 'backward') => void;
}

export const Scene: React.FC<SceneInternalProps> = ({
  slideDirection = 'y',
  slideMode = 'snap',
  slideDuration = DEFAULT_SLIDE_DURATION,
  enterAnimation,
  exitAnimation,
  children,
  isActive = false,
  sceneIndex = 0,
  onSceneChange,
}) => {
  // Get CineView context (may be null if not within CineViewProvider)
  const cineViewContext = useCineViewContext();

  // Animation controls for scene-level animations
  const controls = useAnimation();

  // Parsed animations
  const [enterVariant, setEnterVariant] = useState<PresetAnimation | null>(null);
  const [exitVariant, setExitVariant] = useState<PresetAnimation | null>(null);

  // Scene state
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate registry - stores all child Animate component IDs
  const animateRegistry = useRef<Map<string, AnimateRegistrationInfo>>(new Map());
  const animateRegistrySet = useRef<Set<string>>(new Set());

  // Gesture detection refs
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartProgressRef = useRef(0);

  // Error handling: Check if component is used within CineView
  useEffect(() => {
    if (!cineViewContext && process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Scene component must be used within a CineView component.\n\n` +
          `Problem: Scene component at index ${sceneIndex} is not wrapped by CineView.\n` +
          `Fix: Wrap your Scene components inside a <CineView> component:\n\n` +
          `  <CineView config={{ designSize: 750, unit: 'px' }}>\n` +
          `    <Scene>...</Scene>\n` +
          `  </CineView>\n`
      );
    }
  }, [cineViewContext, sceneIndex]);

  // Parse animations on mount
  useEffect(() => {
    const parseAnimations = async (): Promise<void> => {
      const [enter, exit] = await Promise.all([
        parseAnimationSafely(enterAnimation, `Scene ${sceneIndex}`, 'enter'),
        parseAnimationSafely(exitAnimation, `Scene ${sceneIndex}`, 'exit'),
      ]);

      if (enter) setEnterVariant(enter as PresetAnimation);
      if (exit) setExitVariant(exit as PresetAnimation);
    };

    parseAnimations();
  }, [enterAnimation, exitAnimation, sceneIndex]);

  // Register Animate component
  const registerAnimate = useCallback(
    (id: string, info: AnimateRegistrationInfo) => {
      animateRegistry.current.set(id, info);
      animateRegistrySet.current.add(id);

      // Validates Requirement 26.4: Limit animateRegistry size with warnings
      // Warn if registry size exceeds threshold (memory management)
      const MAX_ANIMATE_COMPONENTS = 100;
      if (
        animateRegistry.current.size > MAX_ANIMATE_COMPONENTS &&
        process.env.NODE_ENV === 'development'
      ) {
        console.warn(
          `[CineView Warning] Scene ${sceneIndex} has ${animateRegistry.current.size} Animate components.\n\n` +
            `Problem: Large number of Animate components may impact performance and memory usage.\n` +
            `Recommendation: Consider reducing the number of animated elements or splitting into multiple scenes.\n` +
            `Current limit: ${MAX_ANIMATE_COMPONENTS} components per scene.\n` +
            `Memory Impact: Each Animate component maintains animation state and event listeners.`
        );
      }
    },
    [sceneIndex]
  );

  // Unregister Animate component
  const unregisterAnimate = useCallback((id: string) => {
    animateRegistry.current.delete(id);
    animateRegistrySet.current.delete(id);
  }, []);

  // Calculate delay for Animate component (including waitFor chain)
  const getCalculatedDelay = useCallback(
    (animateId: string): number => {
      const info = animateRegistry.current.get(animateId);
      if (!info) return 0;

      let totalDelay = info.delay;

      // Add waitFor delay if exists
      if (info.waitFor) {
        const waitForInfo = animateRegistry.current.get(info.waitFor);
        if (waitForInfo) {
          // Recursively calculate the execution time of the waitFor component
          const waitForDelay = getCalculatedDelay(info.waitFor);
          totalDelay += waitForDelay + waitForInfo.duration;
        } else if (process.env.NODE_ENV === 'development') {
          // Warn if waitFor references non-existent component
          console.warn(
            `[CineView Warning] Animation dependency error in Scene ${sceneIndex}.\n\n` +
              `Problem: Animate component "${animateId}" references non-existent component "${info.waitFor}" via waitFor.\n` +
              `Fix: Ensure the waitFor component ID matches an existing Animate component's animateId prop:\n\n` +
              `  <Animate animateId="${info.waitFor}">...</Animate>\n` +
              `  <Animate animateId="${animateId}" waitFor="${info.waitFor}">...</Animate>\n\n` +
              `The waitFor dependency will be ignored and only the delay will be used.`
          );
        }
      }

      return totalDelay;
    },
    [sceneIndex]
  );

  // Scene context value
  const sceneContextValue = useMemo<SceneContextType>(
    () => ({
      slideMode,
      isActive,
      isDragging,
      dragProgress,
      registerAnimate,
      unregisterAnimate,
      getCalculatedDelay,
    }),
    [
      slideMode,
      isActive,
      isDragging,
      dragProgress,
      registerAnimate,
      unregisterAnimate,
      getCalculatedDelay,
    ]
  );

  // Handle enter animation in snap mode
  useEffect(() => {
    if (!isActive || !enterVariant || slideMode !== 'snap') return;

    const playEnterAnimation = async (): Promise<void> => {
      // Reset to initial state first (synchronous)
      controls.set(enterVariant.initial as never);

      // Then play enter animation
      await controls.start(enterVariant.animate);
    };

    playEnterAnimation();
  }, [isActive, enterVariant, slideMode, controls]);

  // Handle exit animation in snap mode
  useEffect(() => {
    if (isActive || !exitVariant || slideMode !== 'snap') return;

    const playExitAnimation = async (): Promise<void> => {
      await controls.start(exitVariant.exit);
    };

    playExitAnimation();
  }, [isActive, exitVariant, slideMode, controls]);

  // Gesture detection for snap mode
  useEffect(() => {
    if (slideMode !== 'snap' || !isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const handlers = createSnapGestureHandlers(touchStartRef, {
      slideDirection,
      slideDuration,
      isAnimating,
      onSceneChange,
      onAnimatingChange: setIsAnimating,
    });

    container.addEventListener('touchstart', handlers.handleTouchStart, { passive: true });
    container.addEventListener('touchend', handlers.handleTouchEnd, { passive: true });
    container.addEventListener('mousedown', handlers.handleMouseDown);
    container.addEventListener('mouseup', handlers.handleMouseUp);
    container.addEventListener('wheel', handlers.handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handlers.handleTouchStart);
      container.removeEventListener('touchend', handlers.handleTouchEnd);
      container.removeEventListener('mousedown', handlers.handleMouseDown);
      container.removeEventListener('mouseup', handlers.handleMouseUp);
      container.removeEventListener('wheel', handlers.handleWheel);
    };
  }, [slideMode, isActive, isAnimating, slideDirection, slideDuration, onSceneChange]);

  // Drag mode handling
  useEffect(() => {
    if (slideMode !== 'drag' || !isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const handleDragMove = (progress: number): void => {
      setDragProgress(progress);

      // Use requestAnimationFrame for batch updates
      requestAnimationFrame(() => {
        // Sync Scene's own exit animation progress
        if (exitVariant) {
          const enterAnimateVariant = (enterVariant?.animate as Record<string, unknown>) || {
            opacity: 1,
          };
          const exitAnimateVariant = exitVariant.exit as Record<string, unknown>;

          const interpolated = interpolateVariant(
            enterAnimateVariant,
            exitAnimateVariant,
            progress
          );
          controls.set(interpolated as never);
        }
      });
    };

    const handleDragEnd = (finalProgress: number): void => {
      setIsDragging(false);

      // If dragged more than 50%, trigger scene change
      if (finalProgress > 0.5) {
        onSceneChange?.('forward');
      }

      // Reset drag progress
      setDragProgress(0);
      touchStartRef.current = null;
    };

    const handlers = createDragGestureHandlers(touchStartRef, dragStartProgressRef, {
      slideDirection,
      isDragging,
      dragProgress,
      onDragStart: () => setIsDragging(true),
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
    });

    container.addEventListener('touchstart', handlers.handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handlers.handleTouchMove, { passive: true });
    container.addEventListener('touchend', handlers.handleTouchEnd);
    container.addEventListener('mousedown', handlers.handleMouseDown);
    container.addEventListener('mousemove', handlers.handleMouseMove);
    container.addEventListener('mouseup', handlers.handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handlers.handleTouchStart);
      container.removeEventListener('touchmove', handlers.handleTouchMove);
      container.removeEventListener('touchend', handlers.handleTouchEnd);
      container.removeEventListener('mousedown', handlers.handleMouseDown);
      container.removeEventListener('mousemove', handlers.handleMouseMove);
      container.removeEventListener('mouseup', handlers.handleMouseUp);
    };
  }, [
    slideMode,
    isActive,
    isDragging,
    dragProgress,
    slideDirection,
    exitVariant,
    enterVariant,
    controls,
    onSceneChange,
  ]);

  // Clear registry when scene becomes inactive
  useEffect(() => {
    if (!isActive) {
      animateRegistry.current.clear();
      animateRegistrySet.current.clear();
    }
  }, [isActive]);

  // Cleanup: Clear animation registry when component unmounts
  // Validates Requirement 26.1: Clean up event listeners on scene transitions
  useEffect(() => {
    const registry = animateRegistry.current;
    const registrySet = animateRegistrySet.current;

    return (): void => {
      // Validates Requirement 26.1: Clear animation registry on unmount
      // Event listeners are already cleaned up in individual useEffect hooks
      registry.clear();
      registrySet.clear();
    };
  }, []);

  // Determine initial variant
  const initialVariant = useMemo(() => {
    if (enterVariant) return enterVariant.initial;
    return { opacity: 1 };
  }, [enterVariant]);

  // CSS performance optimizations
  // Validates Requirement 14.3: CSS transform and opacity for GPU acceleration
  // Validates Requirement 14.3: will-change hints during animations
  // Validates Requirement 14.3: CSS contain property for render isolation
  const sceneStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      // Use will-change to hint browser optimization (only when animating)
      // This tells the browser to prepare for transform/opacity changes
      // IMPORTANT: Only set will-change during animations to avoid memory overhead
      willChange: isAnimating || isDragging ? 'transform, opacity' : 'auto',
      // Use CSS contain for render isolation
      // This isolates the rendering context to improve performance
      // contain: layout, style, and paint optimizations
      contain: 'layout style paint',
      // Use transform and opacity for GPU-accelerated animations
      // These properties don't trigger layout or paint, only composite
      transform: 'translateZ(0)', // Force GPU layer creation
      // Prevent text selection during gestures
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }),
    [isAnimating, isDragging]
  );

  return (
    <SceneContext.Provider value={sceneContextValue}>
      <motion.div
        ref={containerRef}
        initial={initialVariant as never}
        animate={controls}
        style={sceneStyle}
      >
        {children}
      </motion.div>
    </SceneContext.Provider>
  );
};

Scene.displayName = 'Scene';

export default Scene;
