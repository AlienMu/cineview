import { forwardRef } from 'react';
import { CineviewDragEngine, resolveRootMode } from './Cineview';
import { DirectScrollCineview } from './DirectScrollCineview';
import type {
  CineviewDragModeProps,
  CineviewProps,
  CineviewRef,
  CineviewScrollModeProps,
} from '../../types';

/**
 * `mode` dispatcher — the full-featured `Cineview` entry point for ES / bundler consumers.
 *
 * Why this is a separate file: it is the **only place that statically imports both engines**.
 * Originally this was at the bottom of `Cineview.tsx`, causing any import path reaching that
 * file to pull in both engines. UMD requires a single file (Rollup refuses UMD code splitting),
 * so consumers using only drag would pay for the scroll engine — 10437 gzip bytes (20.3% of
 * the full bundle), pushing the package over the 50 KB threshold.
 *
 * After isolating to this file:
 * - `src/index.ts` (full ES export) → this file → both engines, behavior **byte-identical** to pre-split.
 * - `src/entry-drag.ts` / `entry-scroll.ts` (UMD single-engine) **bypass this file**,
 *   each importing only its own engine.
 * See task-flow `2026-08-04-umd-mode-split.md`.
 */
const CineviewComponent = forwardRef<CineviewRef, CineviewProps>((props, ref) => {
  if (resolveRootMode(props.mode) === 'scroll') {
    return <DirectScrollCineview {...(props as CineviewScrollModeProps)} ref={ref} />;
  }
  return <CineviewDragEngine {...(props as CineviewDragModeProps)} ref={ref} />;
});

CineviewComponent.displayName = 'Cineview';

export const Cineview = CineviewComponent;
