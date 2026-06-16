import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CineViewRef, PerformanceMetrics } from 'cineview';

export function usePerformanceMetrics(
  ref: RefObject<CineViewRef>,
  enabled: boolean
): PerformanceMetrics | null {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMetrics(null);
      return;
    }

    const update = () => {
      if (ref.current) {
        setMetrics(ref.current.getPerformanceMetrics());
      }
    };

    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [enabled, ref]);

  return metrics;
}
