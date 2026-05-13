# Phase 3 Runtime Fixes

## Goal

Patch the current Phase 3 runtime so it matches the documented root-first mode semantics for scroll and snap behavior, with minimal edits limited to `src/components/CineView/CineView.tsx` and `src/components/Scene/Scene.tsx`.

## Node Checklist

- [x] Re-read `design.md`
- [x] Re-read `requirements.md`
- [x] Inspect current `CineView.tsx` / `Scene.tsx` runtime for the reported issues
- [x] Make scene-scoped fixed layer metrics direction-aware
- [x] Make snap settle duration follow root-owned config / compatibility bridge
- [x] Wire `modes.scroll.sceneSizing` into runtime layout behavior
- [x] Remove first-frame viewport fallback enlargement in content sizing path
- [x] Make viewport activation use actual container coordinates
- [x] Unify grouped transition bridge semantics with documented public fields
- [x] Run focused verification for changed runtime paths

## Verification Checklist

- [x] TypeScript compile for touched files remains healthy
- [x] Targeted tests around affected runtime still pass
- [x] Report follow-up browser verification targets

## Risks / Blockers

- Existing scroll examples live outside the owned files, so this pass can fix the runtime but not create a new dedicated scroll acceptance example inside the current ownership boundary.
- Runtime acceptance item #5 remains open as a follow-up: `http://127.0.0.1:3002` currently serves `examples/simple-test` (snap), so scroll behavior still needs a dedicated example/page for real browser sign-off.

## Current Status

- Implemented and partially verified: runtime patches are in `CineView.tsx` and `Scene.tsx`; code-level checks passed, but dedicated browser acceptance for scroll still needs a real scroll example/page.
