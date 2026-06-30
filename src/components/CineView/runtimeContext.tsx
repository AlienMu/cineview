import { createContext, useContext } from 'react';
import type { ScrollMode } from '../../types';

export interface CineViewRuntimeContextValue {
  mode: ScrollMode;
  // Routes framework-detected runtime issues (e.g. waitFor cycles, missing
  // dependencies, duplicate Animate ids) to the consumer's onError callback.
  // Without this, validation only surfaced via dev-only console.warn and was
  // silent in production builds.
  reportError?: (detail: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  }) => void;
  // CineView-level default visibility gate margins (design px) for the scroll
  // visibility path. Per-Animate `visibility.enterMargin` / `exitMargin` override
  // these; if both are undefined the hook falls back to 50. Resolved to physical
  // px via scaleY inside useAnimateScroll.
  scrollEnterMargin?: number;
  scrollExitMargin?: number;
}

export const CineViewRuntimeContext = createContext<CineViewRuntimeContextValue | null>(null);

export function useCineViewRuntimeContext(): CineViewRuntimeContextValue | null {
  return useContext(CineViewRuntimeContext);
}
