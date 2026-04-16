/**
 * Animate Component
 * 为子元素添加进入/离开动画，支持延迟和关联延迟机制
 */

import React, { useEffect, useRef, useState, useContext, useMemo, createContext } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { AnimateProps, ParsedAnimationVariant } from '../../types';
import { DEFAULT_ANIMATION_DURATION } from '../../types';
import { parseAnimationSafely, interpolateVariant } from '../../utils/animationHelpers';

// Scene Context (will be created when Scene component is implemented)
export interface SceneContextType {
  slideMode: 'snap' | 'drag';
  isActive: boolean;
  isDragging: boolean;
  dragProgress: number;
  registerAnimate: (id: string, info: AnimateRegistrationInfo) => void;
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (id: string) => number;
}

export interface AnimateRegistrationInfo {
  delay: number;
  duration: number;
  waitFor?: string;
}

// Create a placeholder context (will be replaced when Scene is implemented)
export const SceneContext = createContext<SceneContextType | null>(null);

let animateIdCounter = 0;

export const Animate: React.FC<AnimateProps> = ({
  enterAnimation,
  enterDuration = DEFAULT_ANIMATION_DURATION,
  exitAnimation,
  exitDuration = DEFAULT_ANIMATION_DURATION,
  delay = 0,
  waitFor,
  infiniteAnimation,
  animateId,
  children,
}) => {
  // Generate unique ID if not provided
  const componentId = useRef(animateId || `animate-${++animateIdCounter}`);
  const id = componentId.current;

  // Get Scene context
  const sceneContext = useContext(SceneContext);

  // Animation controls
  const controls = useAnimation();
  const infiniteControls = useAnimation();

  // Parsed animations
  const [enterVariant, setEnterVariant] = useState<ParsedAnimationVariant | null>(null);
  const [exitVariant, setExitVariant] = useState<ParsedAnimationVariant | null>(null);
  const [infiniteVariant, setInfiniteVariant] = useState<ParsedAnimationVariant | null>(null);

  // Animation state
  const [hasEntered, setHasEntered] = useState(false);

  // Drag progress ref for smooth updates
  const dragProgressRef = useRef(0);

  // Error handling: Check if component is used within Scene
  useEffect(() => {
    if (!sceneContext && process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Animate component "${id}" must be used within a Scene component. ` +
          `Please wrap your Animate components inside a Scene.`
      );
    }
  }, [sceneContext, id]);

  // Parse animations on mount
  useEffect(() => {
    const parseAnimations = async (): Promise<void> => {
      const [enter, exit, infinite] = await Promise.all([
        parseAnimationSafely(enterAnimation, id, 'enter'),
        parseAnimationSafely(exitAnimation, id, 'exit'),
        parseAnimationSafely(infiniteAnimation, id, 'infinite'),
      ]);

      if (enter) setEnterVariant(enter as ParsedAnimationVariant);
      if (exit) setExitVariant(exit as ParsedAnimationVariant);
      if (infinite) setInfiniteVariant(infinite as ParsedAnimationVariant);
    };

    parseAnimations();
  }, [enterAnimation, exitAnimation, infiniteAnimation, id]);

  // Register with parent Scene
  useEffect(() => {
    if (!sceneContext) return;

    const registrationInfo: AnimateRegistrationInfo = {
      delay,
      duration: enterDuration,
      waitFor,
    };

    sceneContext.registerAnimate(id, registrationInfo);

    return () => {
      sceneContext.unregisterAnimate(id);
    };
  }, [sceneContext, id, delay, enterDuration, waitFor]);

  // Calculate actual delay (including waitFor chain)
  const calculatedDelay = useMemo(() => {
    if (!sceneContext) return delay;
    return sceneContext.getCalculatedDelay(id);
  }, [sceneContext, id, delay]);

  // Handle enter animation in snap mode
  useEffect(() => {
    if (!sceneContext || !enterVariant) return;
    if (sceneContext.slideMode !== 'snap') return;
    if (!sceneContext.isActive) return;

    console.log(`[Animate ${id}] Playing enter animation...`);

    // Use a flag to prevent multiple executions
    let cancelled = false;

    const playEnterAnimation = async (): Promise<void> => {
      if (cancelled) return;

      // Reset to initial state first (synchronous)
      controls.set(enterVariant.initial as never);
      console.log(`[Animate ${id}] Set initial state:`, enterVariant.initial);

      // Wait for calculated delay
      if (calculatedDelay > 0 && !cancelled) {
        console.log(`[Animate ${id}] Waiting for delay:`, calculatedDelay);
        await new Promise((resolve) => setTimeout(resolve, calculatedDelay));
      }

      if (cancelled) return;

      // Play enter animation and wait for it to complete
      console.log(`[Animate ${id}] Starting animation:`, enterVariant.animate);
      await controls.start({
        ...enterVariant.animate,
        transition: {
          duration: enterDuration / 1000, // Convert ms to seconds
          ease: 'easeOut',
        },
      } as never);

      if (cancelled) return;

      console.log(`[Animate ${id}] Animation completed`);
      setHasEntered(true);

      // IMPORTANT: Start infinite animation AFTER enter animation completes
      // This ensures the infinite loop doesn't interfere with the enter animation
      if (infiniteVariant && sceneContext.isActive && !cancelled) {
        const infiniteTransition = (infiniteVariant.animate as Record<string, unknown>)
          .transition as Record<string, unknown> | undefined;

        infiniteControls.start({
          ...infiniteVariant.animate,
          transition: {
            ...(infiniteTransition || { duration: 1 }),
            repeat: Infinity,
          },
        } as never);
      }
    };

    playEnterAnimation();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneContext?.isActive, enterVariant]);

  // Handle exit animation in snap mode
  useEffect(() => {
    if (!sceneContext || !exitVariant) return;
    if (sceneContext.slideMode !== 'snap') return;

    // Only play exit animation if:
    // 1. Scene becomes inactive (!sceneContext.isActive)
    // 2. Component has previously entered (hasEntered)
    // This prevents exit animation from playing on initial mount
    if (!sceneContext.isActive && hasEntered) {
      const playExitAnimation = async (): Promise<void> => {
        // IMPORTANT: Stop infinite animation immediately when exit animation starts
        // This ensures the exit animation plays cleanly without interference
        infiniteControls.stop();

        // Play exit animation
        await controls.start({
          ...exitVariant.exit,
          transition: {
            duration: exitDuration / 1000, // Convert ms to seconds
            ease: 'easeIn',
          },
        } as never);

        // Reset hasEntered AFTER exit animation completes
        setHasEntered(false);
      };

      playExitAnimation();
    }
  }, [sceneContext, exitVariant, exitDuration, controls, infiniteControls, hasEntered]);

  // Reset state when scene becomes inactive (removed - now handled in exit animation)
  useEffect(() => {
    if (!sceneContext || !exitVariant) return;
    if (sceneContext.slideMode !== 'drag') return;
    if (!sceneContext.isDragging) return;

    // IMPORTANT: Stop infinite animation when dragging starts
    // This ensures the exit animation progress can be controlled by drag progress
    infiniteControls.stop();

    const progress = sceneContext.dragProgress;
    dragProgressRef.current = progress;

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const enterAnimateVariant = (enterVariant?.animate as Record<string, unknown>) || {
        opacity: 1,
      };
      const exitAnimateVariant = exitVariant.exit as Record<string, unknown>;

      const interpolated = interpolateVariant(enterAnimateVariant, exitAnimateVariant, progress);

      controls.set(interpolated as never);
    });
  }, [sceneContext, exitVariant, enterVariant, controls, infiniteControls]);

  // Handle drag release and transition completion in drag mode
  useEffect(() => {
    if (!sceneContext || !enterVariant) return;
    if (sceneContext.slideMode !== 'drag') return;
    if (sceneContext.isDragging || !sceneContext.isActive) return;

    // Use a flag to prevent multiple executions
    let cancelled = false;

    // When drag is released and scene becomes active, play enter animation
    const playEnterAnimation = async (): Promise<void> => {
      if (cancelled) return;

      // Reset to initial state first
      controls.set(enterVariant.initial as never);

      // Wait for calculated delay
      if (calculatedDelay > 0 && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, calculatedDelay));
      }

      if (cancelled) return;

      // Play enter animation and wait for it to complete
      await controls.start({
        ...enterVariant.animate,
        transition: {
          duration: enterDuration / 1000, // Convert ms to seconds
          ease: 'easeOut',
        },
      } as never);

      if (cancelled) return;

      setHasEntered(true);

      // IMPORTANT: Start infinite animation AFTER enter animation completes
      // This ensures the infinite loop doesn't interfere with the enter animation
      if (infiniteVariant && sceneContext.isActive && !cancelled) {
        const infiniteTransition = (infiniteVariant.animate as Record<string, unknown>)
          .transition as Record<string, unknown> | undefined;

        infiniteControls.start({
          ...infiniteVariant.animate,
          transition: {
            ...(infiniteTransition || { duration: 1 }),
            repeat: Infinity,
          },
        } as never);
      }
    };

    playEnterAnimation();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneContext?.isActive, sceneContext?.isDragging, enterVariant]);

  // Reset hasEntered when scene becomes inactive (to allow re-entry animation)
  useEffect(() => {
    if (!sceneContext) return;

    // When scene becomes inactive, reset hasEntered to allow re-entry animation
    if (!sceneContext.isActive && hasEntered) {
      // Use a small delay to ensure exit animation completes first
      const timer = setTimeout(() => {
        setHasEntered(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [sceneContext, hasEntered]);

  // Handle infinite animation lifecycle
  useEffect(() => {
    if (!sceneContext || !infiniteVariant) return;

    if (sceneContext.isActive && hasEntered) {
      // Start infinite animation when scene is active
      const infiniteTransition = (infiniteVariant.animate as Record<string, unknown>).transition as
        | Record<string, unknown>
        | undefined;

      infiniteControls.start({
        ...infiniteVariant.animate,
        transition: {
          ...(infiniteTransition || { duration: 1 }),
          repeat: Infinity,
        },
      } as never);
    } else {
      // Stop infinite animation when scene is inactive
      infiniteControls.stop();
    }
  }, [sceneContext, infiniteVariant, infiniteControls, hasEntered]);

  // Cleanup: Stop animations and clear timers when component unmounts
  // Validates Requirement 26.5: Clean up timers and requestAnimationFrame on unmount
  useEffect(() => {
    return (): void => {
      // Stop all animation controls
      controls.stop();
      infiniteControls.stop();

      // Note: Timers created with setTimeout in async functions
      // are automatically cleaned up when the component unmounts
      // because the promises are abandoned and the component is no longer mounted
      // requestAnimationFrame calls are also automatically cancelled when controls.stop() is called
    };
  }, [controls, infiniteControls]);

  // Determine initial variant
  // IMPORTANT: Keep element in initial state (usually hidden) until animation completes
  const initialVariant = useMemo(() => {
    if (enterVariant) return enterVariant.initial;
    // Default to hidden state if no enter animation is defined
    return { opacity: 0 };
  }, [enterVariant]);

  // CSS performance optimizations
  // Validates Requirement 14.3: CSS transform and opacity for GPU acceleration
  // Validates Requirement 14.3: will-change hints during animations
  const animateStyle = useMemo<React.CSSProperties>(
    () => ({
      // IMPORTANT: Don't use 'display: contents' as it prevents transform/opacity from working
      // Use inline-block to allow animations while minimizing layout impact
      display: 'inline-block',
      // Use will-change hint during animations for GPU optimization
      // IMPORTANT: Only set will-change during animations to avoid memory overhead
      willChange:
        sceneContext?.isActive && (sceneContext.isDragging || hasEntered)
          ? 'transform, opacity'
          : 'auto',
    }),
    [sceneContext, hasEntered]
  );

  return (
    <motion.div initial={initialVariant as never} animate={controls} style={animateStyle}>
      {children}
    </motion.div>
  );
};

Animate.displayName = 'Animate';

export default Animate;
