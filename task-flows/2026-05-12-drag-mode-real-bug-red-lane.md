# 2026-05-12 Drag Mode Real-Bug Red Lane

- Goal: add a focused failing regression test for the real drag-mode bug observed in the live example: after refresh Scene 1 shows, but a real upward mouse drag does not settle to Scene 2 and can leave the viewport blank/black.

## Nodes
- [x] Re-read project rules, self-review log, design.md, requirements.md, and TDD skill.
- [x] Audit existing drag tests and example/runtime entry points.
- [x] Add one focused red regression test that reproduces the missing commit / bad release behavior through a public interface.
- [x] Run the targeted test and capture the failing assertion/result.
- [x] Update this flow with changed files and exact red result.

## Verification
- [x] `pnpm exec jest --runTestsByPath src/__tests__/integration/dragModeRealRelease.test.tsx --runInBand`

## Risks / blockers
- Need a test seam that reflects the real drag release path instead of shallow synthetic context assertions.
- Must not change runtime implementation in this lane.

## Changed files
- `src/__tests__/integration/dragModeRealRelease.test.tsx`

## Exact red result
- Failing assertion:
  - `expect(onSceneDidChange).toHaveBeenCalledWith(expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' }))`
- Actual result:
  - `Number of calls: 0`
- Observed DOM at failure time:
  - `data-scene-index="0"` remained at `transform: translate3d(0, 0%, 0)`
  - `data-scene-index="1"` remained at `transform: translate3d(0, 100%, 0)`
- Interpretation:
  - The real upward mouse drag release path did not commit from Scene 1 to Scene 2.

## Current status
- Red lane complete: focused failing regression captured with no implementation changes.
