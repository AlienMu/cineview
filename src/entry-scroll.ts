/**
 * `cineview/scroll` — entry point containing **only the scroll engine**.
 *
 * Rationale matches `entry-drag.ts`: single-file UMD cannot code-split, so a full entry
 * point inevitably bundles both engines. Consumers using only scroll should not carry
 * the drag engine's weight.
 *
 * **Asymmetry** with drag entry (empirically verified, not an omission): runtime `mode`
 * enforcement is **not needed** here. `DirectScrollCineview` internally hardcodes
 * `mode: 'scroll'` in the event detail it emits (DirectScrollCineview.tsx:188, 469)
 * and **never reads `props.mode`**, so passing the wrong `mode` will not short-circuit it.
 * The drag engine is the opposite (~30 `!== 'drag'` guards), hence only that side needs
 * the override. Adding a useless wrapper here would only bloat the bundle.
 *
 * Props type does not use `Omit<CineviewProps, 'mode'>` — rationale in `entry-drag.ts` header.
 */

import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { DirectScrollCineview } from './components/Cineview/DirectScrollCineview';
import type { CineviewBaseProps, ScrollModeCallbacks, CineviewRef } from './types';

export * from './public-api';

/** Scroll entry Props: no `mode`, callbacks fixed to scroll group. */
export type CineviewScrollProps = CineviewBaseProps & {
  callbacks?: ScrollModeCallbacks;
};

export const Cineview = DirectScrollCineview as unknown as ForwardRefExoticComponent<
  CineviewScrollProps & RefAttributes<CineviewRef>
>;
