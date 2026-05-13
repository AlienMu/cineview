# Task: Drag Direction Regression Fix

- Goal: repair the drag-direction regression in `drag` mode, restore aligned tests, and verify with a separate acceptance lane in real runtime.

## Nodes
- [x] Re-read project rules, self-review log, active drag bug flow, and the affected drag engine/test files.
- [x] Confirm regression cause and capture the exact implementation/testing split for this round.
- [x] Launch implementation lane for drag-direction and broken test-mock follow-up.
- [x] Launch independent verification lane for targeted tests and real runtime drag behavior.
- [x] Integrate implementation result into the main branch without widening scope.
- [x] Run local orchestration checks needed before acceptance handoff.
- [x] Collect independent acceptance verdict, including console/runtime status.
- [x] Sync this result into self-review log and task flow status.

## Verification
- [x] `pnpm exec jest --runTestsByPath src/components/Scene/Scene.dragMode.test.tsx src/hooks/useSceneManager.test.ts --runInBand`
- [x] `pnpm exec jest --runInBand src/__tests__/integration/dragModeRealRelease.test.tsx src/__tests__/integration/crossPlatform.test.tsx --testNamePattern="drag mode live-release regression|滑动模式兼容性测试.*drag 模式"`
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] Real browser/runtime drag check on the local example, including console status

## Risks / blockers
- `Scene.dragMode.test.tsx` is currently red because of a mock refactor I introduced while trying to reduce Framer Motion warning noise.
- Acceptance must stay separate from the implementation lane; local checks here are orchestration support only, not final sign-off.

## Changed files
- `src/components/Scene/useDragSceneEngine.ts`
- `src/components/Scene/Scene.dragMode.test.tsx`

## Current status
- Runtime direction regression root cause is identified.
- `Scene.dragMode.test.tsx` mock surface is repaired and focused orchestration checks are green.
- Independent verification commands passed.
- Real runtime verification passed via the local drag example: upward drag settled into Scene 2, downward drag returned to Scene 1, and screenshots showed no blank/black viewport.
- Console status: no runtime JS errors or warnings were captured during Playwright verification; the manual Chrome DevTools check did show a missing `favicon.ico` request in dev.
