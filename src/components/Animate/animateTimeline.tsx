import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AnimateTimeline } from '../../types';

const AnimateTimelineContext = createContext<AnimateTimeline | null>(null);

interface AnimateTimelineProviderProps {
  value: AnimateTimeline;
  children: ReactNode;
}

export function AnimateTimelineProvider({
  value,
  children,
}: AnimateTimelineProviderProps): JSX.Element {
  return (
    <AnimateTimelineContext.Provider value={value}>{children}</AnimateTimelineContext.Provider>
  );
}

/**
 * Read the nearest Animate timeline without subscribing React to frame updates.
 * Consumers attach MotionValues directly to motion styles or subscribe with
 * useMotionValueEvent; CineView remains the only timeline writer.
 */
export function useAnimateTimeline(): AnimateTimeline {
  const timeline = useContext(AnimateTimelineContext);

  if (!timeline) {
    throw new Error('useAnimateTimeline must be used inside an <Animate> child.');
  }

  return timeline;
}
