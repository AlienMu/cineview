/**
 * CineView Context
 * Provides global responsive size conversion context.
 *
 * Conversion model: px2vw single ruler (width-only, height-agnostic). The design spec has
 * one size baseline `size` (design px), and the entire canvas locks to `scale = viewportWidth / size`
 * proportional scaling — horizontal 1px and vertical 1px multiply by the same `scale`, so squares
 * remain squares, circles remain circles, with zero distortion. Vertical overflow is handled by
 * natural document flow / scroll extension (naturally aligned with scroll mode).
 *
 * Context exposes only the conversion kernel `{ scale, convert }`; Provider root DOM outputs
 * the length-type `--cineview-unit: ${scale}px` for external CSS consumption. No independent height
 * baseline exists. Scroll takeover time budget is independently settled at `1ms = 1px`, absolute scene
 * span falls back to DOM measurement; neither creates a second design ruler. Thus provider accepts
 * only `designSize`, tracks only `viewportWidth`.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounceCancelable } from '../utils/debounce';
import { devErrorOnce, devWarnOnce } from '../utils/devLog';

export interface CineViewContextValue {
  /** px2vw single-ruler ratio: `viewportWidth / size`. Only useAnimateScroll gate margin conversion reads this. */
  scale: number;
  /** px2vw single-ruler conversion: design px → physical px (`size * scale`). Shared by all length values. */
  convert: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  /** Design spec size baseline (design px). Single conversion ruler site-wide: `scale = viewportWidth / designSize`. */
  designSize?: number;
  children: React.ReactNode;
}

const FALLBACK_DESIGN_SIZE = 750;

/**
 * designSize guard: `scale = viewportWidth / size` denominator must be a finite positive number,
 * otherwise scale becomes 0 / Infinity / NaN and pollutes all conversions. Invalid values fall back
 * to 750, with a one-time warning in development.
 */
function resolveDesignSize(designSize: number | undefined): number {
  if (designSize === undefined) return FALLBACK_DESIGN_SIZE;
  if (Number.isFinite(designSize) && designSize > 0) return designSize;
  devErrorOnce(
    'cineview-context:invalid-design-size',
    `Invalid designSize (${String(designSize)}). ` +
      `It must be a finite number > 0; falling back to ${FALLBACK_DESIGN_SIZE}.`
  );
  return FALLBACK_DESIGN_SIZE;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({ designSize, children }) => {
  const resolvedDesignSize = resolveDesignSize(designSize);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );

  // px2vw single ruler: width-only. No independent height baseline.
  const scale = useMemo(
    () => viewportWidth / resolvedDesignSize,
    [viewportWidth, resolvedDesignSize]
  );
  const convert = useCallback(
    (size: number): number => {
      return size * scale;
    },
    [scale]
  );

  // Handle window resize: track width only (sole conversion input).
  // Use cancelable debounce: cancel() clears in-flight timer on unmount,
  // avoiding setState trigger within 150ms after unmount.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { debounced: handleResize, cancel } = debounceCancelable(() => {
      setViewportWidth(window.innerWidth);
    }, 150);

    window.addEventListener('resize', handleResize);

    return (): void => {
      window.removeEventListener('resize', handleResize);
      cancel();
    };
  }, []);

  const contextValue = useMemo<CineViewContextValue>(
    () => ({
      scale,
      convert,
    }),
    [scale, convert]
  );
  const responsiveStyle = useMemo(
    () =>
      ({
        '--cineview-unit': `${scale}px`,
      }) as React.CSSProperties,
    [scale]
  );

  return (
    <CineViewContext.Provider value={contextValue}>
      <div className="cineview-responsive-container" style={responsiveStyle}>
        {children}
      </div>
    </CineViewContext.Provider>
  );
};

/**
 * Use CineView context
 */
export const useCineViewContext = (): CineViewContextValue | null => {
  const context = useContext(CineViewContext);
  return context;
};

// Fallback conversion outside Provider: module-level singleton ensures stable identity across renders —
// consumers placing it in dependency arrays / memo won't invalidate on every render due to reference change.
const identityConvert = (size: number): number => size;

/**
 * Use size conversion function
 * Convenience hook for directly obtaining the convert function (px2vw single ruler) in components.
 * Returns stable identity function (no conversion) when used outside CineView, with one-time dev warning.
 */
export const useConvertSize = (): ((size: number) => number) => {
  const context = useCineViewContext();

  if (!context) {
    devWarnOnce(
      'cineview-context:convert-outside-provider',
      'useConvertSize must be used within a <CineView> component. ' +
        'Returning identity function (no conversion).'
    );
    return identityConvert;
  }

  return context.convert;
};
