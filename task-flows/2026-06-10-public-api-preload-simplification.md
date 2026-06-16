# Public API Preload Simplification

## Goal

Simplify CineView's public surface for professional out-of-the-box use: keep one public image/lazy-load component, make scene asset preloading framework-owned, remove redundant public exports and legacy/debug-oriented public fields, preserve drag-mode current/adjacent scene preloading, and use global preload planning in scroll mode.

## Node Checklist

- [x] Confirm current preload behavior and public preload/lazy image surface.
- [x] Remove redundant public preload component and unnecessary public exports.
- [x] Update Image to be the single public native-img-compatible component with `preload` defaulting to true.
- [x] Route numeric Image dimensions through CineView responsive conversion.
- [x] Use global scene asset preloading for scroll mode and current/adjacent preloading for drag mode.
- [x] Hide internal runtime/debug types from the main entry.
- [x] Update tests to assert drag current/adjacent scene preloading and public export cleanup.
- [x] Update documentation to describe the single public image component and framework-owned preloading.
- [x] Remove the old internal component directory so the codebase keeps only `Image` and `useImagePreloader`.
- [x] Run targeted verification.

## Verification Checklist

- [x] Public entry no longer exports redundant preload component or internal runtime/debug types.
- [x] Drag mode preloads current scene plus adjacent scenes before those scenes are displayed.
- [x] Scroll mode preloads all declared scene assets globally instead of optimizing by active scene.
- [x] Existing framework-owned preload behavior still uses `Scene.assets.preloadImages`.
- [x] Image supports native img props and CineView responsive numeric dimensions.
- [x] Targeted tests pass.

## Risks / Blockers

- Working tree is already heavily modified; do not revert unrelated changes.
- No sub-agents: available sub-agent tool requires explicit user request for delegation.

## Current Status

Completed: public preload surface is reduced to `Image`, framework-owned preload planning is mode-specific, old component-layer naming has been removed, and docs/tests/type-check are aligned. `ref.preload(targets)` is intentionally limited to `CineViewPreloadTarget[]` (`scene index | sceneId | scroll zoneId`) with no options object. Full `DirectScrollCineView.test.tsx` still contains unrelated scroll geometry failures outside this API/preload change; the new scroll global preload test passes in isolation.
