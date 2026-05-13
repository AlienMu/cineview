# 2026-05-10-scene-responsibility-followup

## Goal
- Patch CineView/Scene for Phase 4 follow-up: reject silent mixed legacy scene modes, remove scroll 100vh clamping, consume modes.scroll.direction, fix grouped transition fallback.

## Nodes
- [x] Inspect current CineView/Scene bridges and runtime mode wiring
- [x] Patch CineView runtime mode + scroll direction + 100vh clamp behavior
- [x] Patch Scene mixed-mode guard + transition fallback behavior
- [x] Run targeted verification (tests/build as relevant)

## Verification
- [x] Targeted tests for CineView/Scene
- [x] Build passes

## Risks / blockers
- Need to avoid reverting unrelated in-flight changes

## Current status
- Internal runtime prop shrink pass landed: CineView now injects grouped `sceneRuntime` / `dragRuntime` / `scrollRuntime` objects into Scene, while Scene keeps compatibility fallbacks for existing flat internal props and tests. Targeted verification passed for `pnpm exec tsc --noEmit`, `pnpm exec jest src/components/CineView/CineView.test.tsx --runInBand`, focused Scene bridge tests for grouped layout / visibility callback / fixed host, and `pnpm build`. Independent acceptance lane is still pending; a full historical Scene drag suite remains noisy and is not yet a clean acceptance signal for this node.
