import { useEffect, useState } from 'react';

/** Phone breakpoint. Must use the same value as `@media (max-width: 600px)` in `Act3DollyScene.css` on the CSS side. */
export const PHONE_MAX_WIDTH = 600;

/** Design canvas width baseline, sourced from `HomePage`'s `config={{ size: 1440 }}`. */
const DESIGN_WIDTH = 1440;

/** Desktop canvas height (design px), i.e. the default value of `HomeSceneCanvas`. */
const DESKTOP_DESIGN_HEIGHT = 900;

export interface DesignCanvasHeight {
  /** Viewport width ≤ PHONE_MAX_WIDTH. Switch for phone layout (2 columns × 3 rows). */
  phone: boolean;
  /**
   * Height the design canvas should declare (design px).
   * Desktop constant 900; phone takes `1440 * vh / vw` — i.e. the design-px equivalent value of "canvas exactly equals one viewport height".
   */
  designH: number;
}

/**
 * Home page design canvas height / phone mode switch.
 *
 * Why phone needs a different canvas height: `config.size=1440` + "width-aware, height-agnostic" ⇒ `--cineview-unit = vw/1440`,
 * at 390 width u=0.2708, declaring 1440×900 canvas actually yields only **390×244**, occupying 29% of 844 viewport height —
 * six blocks plus closing title all compressed into a top strip. The canvas's positioning container (`.capability-full`) fills the canvas,
 * so raising canvas height to "one viewport" allows the six blocks to use the full portrait screen (measured: when 244→844, six blocks shift down 300 =
 * (844−244)/2). See task-flow `2026-08-04-act3-phone-layout.md` for details.
 *
 * **Not in per-frame hot path**: only subscribes to `resize` and media query `change`. Return value is used for layout data
 * calculation during render (panel coordinates / peak scale), not participating in scrub per-frame mapping (CLAUDE.md self-check 4).
 */
export function useDesignCanvasHeight(): DesignCanvasHeight {
  const [state, setState] = useState<DesignCanvasHeight>(() => read());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = (): void =>
      setState((prev) => {
        const next = read();
        // Same value doesn't swap reference: avoids meaningless re-renders caused by resize jitter.
        return prev.phone === next.phone && prev.designH === next.designH ? prev : next;
      });

    sync();
    window.addEventListener('resize', sync);

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`)
        : null;
    mql?.addEventListener('change', sync);

    return (): void => {
      window.removeEventListener('resize', sync);
      mql?.removeEventListener('change', sync);
    };
  }, []);

  return state;
}

function read(): DesignCanvasHeight {
  if (typeof window === 'undefined') {
    return { phone: false, designH: DESKTOP_DESIGN_HEIGHT };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw <= PHONE_MAX_WIDTH;
  if (!phone || vw <= 0) {
    return { phone: false, designH: DESKTOP_DESIGN_HEIGHT };
  }
  // Canvas = one viewport height, converted back to design px: vh / u, where u = vw / 1440.
  return { phone: true, designH: Math.round((DESIGN_WIDTH * vh) / vw) };
}
