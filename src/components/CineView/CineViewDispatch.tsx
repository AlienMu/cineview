import { forwardRef } from 'react';
import { CineViewDragEngine, resolveRootMode } from './CineView';
import { DirectScrollCineView } from './DirectScrollCineView';
import type {
  CineViewDragModeProps,
  CineViewProps,
  CineViewRef,
  CineViewScrollModeProps,
} from '../../types';

/**
 * `mode` dispatcher — the full-featured `CineView` entry point for ES / bundler consumers.
 *
 * Why this is a separate file: it is the **only place that statically imports both engines**.
 * Originally this was at the bottom of `CineView.tsx`, causing any import path reaching that
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
const CineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  if (resolveRootMode(props.mode) === 'scroll') {
    return <DirectScrollCineView {...(props as CineViewScrollModeProps)} ref={ref} />;
  }
  return <CineViewDragEngine {...(props as CineViewDragModeProps)} ref={ref} />;
});

CineViewComponent.displayName = 'CineView';

export const CineView = CineViewComponent;
