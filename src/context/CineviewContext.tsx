/** Width conversion and the shared constrained layout for both runtime modes. */
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { devErrorOnce, devWarnOnce } from '../utils/devLog';

export interface CineviewContextValue {
  /** Measured content width divided by the design width. */
  scale: number;
  /** Design lengths converted to CSS pixels with the shared scale. */
  convert: (size: number) => number;
}

const CineviewContext = createContext<CineviewContextValue | null>(null);

// Export the context for testing purposes
export { CineviewContext };

export interface CineviewProviderProps {
  /** Design-coordinate baseline and maximum stage width in CSS pixels. */
  designSize?: number;
  minWidth?: number;
  /** Actual content width published by the owning runtime measurement. */
  viewportWidth?: number;
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

export const CineviewProvider: React.FC<CineviewProviderProps> = ({
  designSize,
  minWidth,
  viewportWidth,
  children,
}) => {
  const resolvedDesignSize = resolveDesignSize(designSize);
  const validMinimum =
    minWidth !== undefined &&
    Number.isFinite(minWidth) &&
    minWidth >= 0 &&
    minWidth <= resolvedDesignSize;
  const minimum = validMinimum ? minWidth : 0;
  if (minWidth !== undefined && !validMinimum) {
    devErrorOnce(
      'cineview-context:invalid-min-width',
      `Invalid minWidth (${String(minWidth)}). It must be between 0 and designWidth (${resolvedDesignSize}); ignoring it.`
    );
  }
  // The runtime owns measurement. The initial estimate is replaced on mount,
  // including when a parent or a native scrollbar reduces the available width.
  const initialWidth = typeof window === 'undefined' ? resolvedDesignSize : window.innerWidth;
  const width =
    viewportWidth && viewportWidth > 0
      ? viewportWidth
      : Math.min(resolvedDesignSize, Math.max(minimum, initialWidth));
  const scale = Math.min(width, resolvedDesignSize) / resolvedDesignSize;
  const convert = useCallback((size: number): number => size * scale, [scale]);
  const contextValue = useMemo<CineviewContextValue>(() => ({ scale, convert }), [scale, convert]);
  const responsiveStyle = useMemo(
    () =>
      ({
        '--cineview-unit': `${scale}px`,
        width: '100%',
        height: '100vh',
        minWidth: 0,
        overflowX: minimum > 0 ? 'auto' : undefined,
        overflowY: minimum > 0 ? 'hidden' : undefined,
      }) as React.CSSProperties,
    [scale, minimum]
  );

  return (
    <CineviewContext.Provider value={contextValue}>
      <div
        className="cineview-responsive-container"
        style={responsiveStyle}
        tabIndex={minimum > 0 ? 0 : undefined}
      >
        <div
          className="cineview-stage"
          style={{
            width: '100%',
            minWidth: minimum,
            maxWidth: resolvedDesignSize,
            marginInline: 'auto',
            height: '100%',
          }}
        >
          {children}
        </div>
      </div>
    </CineviewContext.Provider>
  );
};

/**
 * Use Cineview context
 */
export const useCineviewContext = (): CineviewContextValue | null => {
  const context = useContext(CineviewContext);
  return context;
};

// Fallback conversion outside Provider: module-level singleton ensures stable identity across renders —
// consumers placing it in dependency arrays / memo won't invalidate on every render due to reference change.
const identityConvert = (size: number): number => size;

/**
 * Use size conversion function
 * Convenience hook for directly obtaining the convert function (px2vw single ruler) in components.
 * Returns stable identity function (no conversion) when used outside Cineview, with one-time dev warning.
 */
export const useConvertSize = (): ((size: number) => number) => {
  const context = useCineviewContext();

  if (!context) {
    devWarnOnce(
      'cineview-context:convert-outside-provider',
      'useConvertSize must be used within a <Cineview> component. ' +
        'Returning identity function (no conversion).'
    );
    return identityConvert;
  }

  return context.convert;
};
