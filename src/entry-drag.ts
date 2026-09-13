/**
 * `cineview/drag` — drag-only engine entry point.
 *
 * Rationale: single-file UMD cannot code-split (Rollup reports
 * `UMD and IIFE output formats are not supported for code-splitting builds`),
 * so the full entry's UMD bundle necessarily includes both drag + scroll engines.
 * The scroll engine (`DirectScrollCineview`) alone occupies 10437 gzipped bytes
 * ≈ 20% of the full bundle; drag-only consumers should not carry that weight.
 *
 * Two differences from the full entry:
 * 1. `Cineview` here is the drag engine itself, not a mode-dispatching wrapper.
 * 2. **`mode` is runtime-enforced to `'drag'`**, not just type-level blocking.
 *    Reason: the drag engine has ~30 internal `if (resolvedRootMode !== 'drag') return;`
 *    guards reading `props.mode`. Passing `mode="scroll"` renders a shell but
 *    short-circuits all logic — silent failure. UMD / script-tag consumers lack
 *    type protection; only runtime override truly prevents this.
 *
 * Props type is not `Omit<CineviewProps, 'mode'>`: `CineviewProps` is a discriminated
 * union keyed on `mode` (types/index.ts:377-379). Omitting the discriminant collapses
 * `callbacks` into the union of both modes, matching neither. Instead, assemble directly
 * from `CineviewBaseProps` + drag callbacks — naturally no `mode`, and preserves the
 * callbacks-to-mode correspondence.
 */

import { forwardRef, createElement } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { CineviewDragEngine } from './components/Cineview/Cineview';
import type { CineviewBaseProps, DragModeCallbacks, CineviewRef } from './types';

export * from './public-api';

/** Drag entry props: no `mode`, callbacks fixed to drag set. */
export type CineviewDragProps = CineviewBaseProps & {
  callbacks?: DragModeCallbacks;
};

const CineviewDragOnly = forwardRef<CineviewRef, CineviewDragProps>((props, ref) => {
  // script-tag / CJS consumers lack type protection and may pass `mode="scroll"`.
  // **Must throw**: this artifact has no scroll engine; silently rendering as drag
  // would make users think "scroll mode is broken". Throwing points them to the
  // correct artifact. Type layer already Omits mode, so TS consumers never reach here.
  const requested = (props as { mode?: string }).mode;
  if (requested !== undefined && requested !== 'drag') {
    throw new Error(
      `[Cineview] This artifact (cineview.umd.js / "cineview/drag") contains only the drag engine ` +
        `and does not support mode="${requested}". For scroll mode, load cineview-scroll.umd.js ` +
        `(or import "cineview/scroll"); for runtime mode switching, use the full entry import "cineview".`
    );
  }
  // mode is always 'drag': drag engine has ~30 internal `!== 'drag'` guards; default must be explicit.
  return createElement(CineviewDragEngine, { ...props, mode: 'drag', ref });
});

CineviewDragOnly.displayName = 'CineviewDragOnly';

export const Cineview = CineviewDragOnly as ForwardRefExoticComponent<
  CineviewDragProps & RefAttributes<CineviewRef>
>;
