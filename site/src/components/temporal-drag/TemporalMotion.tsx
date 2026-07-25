import { useReducedMotion } from 'framer-motion';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

const REDUCED_DURATION_MS = 80;
const REDUCED_DURATION_SECONDS = REDUCED_DURATION_MS / 1000;

type TemporalMotionTiming = {
  reduced: boolean;
  duration: (milliseconds: number) => number;
  delay: (milliseconds: number) => number;
  stagger: (milliseconds: number) => number;
  seconds: (seconds: number) => number;
};

const DEFAULT_TIMING: TemporalMotionTiming = {
  reduced: false,
  duration: (milliseconds) => milliseconds,
  delay: (milliseconds) => milliseconds,
  stagger: (milliseconds) => milliseconds,
  seconds: (seconds) => seconds,
};

const TemporalMotionContext = createContext<TemporalMotionTiming>(DEFAULT_TIMING);

export function TemporalMotionProvider({ children }: { children: ReactNode }): JSX.Element {
  const reduced = useReducedMotion() ?? false;
  const timing = useMemo<TemporalMotionTiming>(
    () => ({
      reduced,
      duration: (milliseconds) =>
        reduced && milliseconds > 0 ? REDUCED_DURATION_MS : milliseconds,
      delay: (milliseconds) => (reduced ? 0 : milliseconds),
      stagger: (milliseconds) => (reduced ? 0 : milliseconds),
      seconds: (seconds) => (reduced && seconds > 0 ? REDUCED_DURATION_SECONDS : seconds),
    }),
    [reduced]
  );

  return <TemporalMotionContext.Provider value={timing}>{children}</TemporalMotionContext.Provider>;
}

export function useTemporalMotion(): TemporalMotionTiming {
  return useContext(TemporalMotionContext);
}
