import { createContext, useContext } from 'react';
import type { ScrollMode } from '../../types';

export interface CineViewRuntimeContextValue {
  mode: ScrollMode;
  // Routes framework-detected runtime issues (e.g. after chains, missing
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
  // px via the single-ruler scale inside useAnimateScroll.
  scrollEnterMargin?: number;
  scrollExitMargin?: number;
  // OS "reduce motion" preference, read once at the root (one matchMedia
  // subscription per CineView, not one per Animate). When true, animations that the
  // framework starts on its own resolve to their end state and loops do not run.
  // Scrub is deliberately NOT suppressed: it is the user's own pointer or scroll
  // input being reflected, not motion the page decided to play (WCAG 2.3.3).
  prefersReducedMotion?: boolean;
}

export const CineViewRuntimeContext = createContext<CineViewRuntimeContextValue | null>(null);

export function useCineViewRuntimeContext(): CineViewRuntimeContextValue | null {
  return useContext(CineViewRuntimeContext);
}
