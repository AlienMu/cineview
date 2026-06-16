# Task: Remove Takeover Pre-Anchor Authoring

## Goal

- Remove the example-layer `preAnchor` takeover authoring path.
- Ensure scenes 03 and 05 use a single phase-driven takeover owner for shared title/pill content.
- Preserve runtime takeover semantics: forward, backward, replay, and scrollbar traversal must still work.

## Required Rules

- Treat `preAnchor` as an authoring strategy, not a documented framework feature.
- Do not change public framework API unless tests prove it is necessary.
- Start with focused tests that reject duplicate pre-anchor authored content.
- Run focused example and scroll-runtime regressions before reporting.

## Nodes

- [x] Read project rules, self-review log, and relevant design/requirements scroll sections.
- [x] Create this task-flow as the current source of truth.
- [x] Add/update tests so takeover scenes expose only one authored phase owner for shared title/pill content.
- [x] Remove `preAnchor` from `TakeoverReplayAnimate`, `SpecTakeover`, and `ScenarioTakeover`.
- [x] Run focused example tests.
- [x] Run focused scroll runtime tests.
- [x] Run type/build verification for the example path.
- [x] Collect implementation/review lane feedback.
- [x] Update self-review with the confirmed preAnchor design drift.
- [x] Re-check unchecked nodes before final response.

## Verification Checklist

- [x] `pnpm --dir examples/performance-test test -- src/components/ScrollScenes.test.tsx`
- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm --dir examples/performance-test build`
- [x] Search confirms no runtime/source `preAnchor` or `*-pre-anchor` usage remains outside historical task logs.

## Execution Log

- `2026-05-22 red`: Updated `ScrollScenes.test.tsx` to reject `TakeoverReplayAnimate` and `*-pre-anchor` authored layers in 03/05. The focused example test failed with 3 expected failures against the old implementation.
- `2026-05-22 green`: Removed `TakeoverReplayAnimate` and replaced 03/05 pill/copy with direct phase-driven `Animate` layers.
- `2026-05-22 verification`: Focused example tests, DirectScroll runtime tests, root typecheck, and example build passed.
- `2026-05-22 browser`: Headless Chrome CDP pass on `http://127.0.0.1:4175/#/scroll` found `preAnchorIdCount: 0`, `replayOwnerCount: 0`, one DOM text node for each 03/05 title and pill, no console/runtime events, and real wheel samples through 03/05 never showed more than one visible title/pill.
- `2026-05-22 review`: Independent review returned no Blocking and no Major issues. It confirmed 03/05 have no `TakeoverReplayAnimate`, `preAnchor`, `*-pre-anchor`, or replay-owner residue, and noted only the expected visual-risk watchpoint around early phase starts.

## Reopened: Single Owner Reverse Replay

## Goal

- Keep `preAnchor` removed.
- Make the single takeover phase owner re-trigger on reverse re-entry and second forward pass.
- Prevent the old duplicate-title authoring from returning.

## Nodes

- [x] Confirm whether the missing replay is caused by example phase authoring, `Animate` phase semantics, or DirectScroll takeover reacquire.
- [x] Add a red proof that a single phase-owned title replays on reverse re-entry without preAnchor.
- [x] Patch the minimal owner/runtime behavior.
- [x] Run focused `Animate`, DirectScroll, and example tests.
- [x] Run build/type checks.
- [x] Run real browser forward/backward/second-forward sampling.
- [x] Collect implementation/review lane feedback.
- [x] Update self-review if a new mistake is confirmed.

## Reopened Execution Log

- `2026-05-31 audit`: Read project rules, self-review log, design/requirements scroll sections, and both subagent reports. Main-agent裁决: current duplicate-title/preAnchor authoring is not present in example source; the remaining user-visible failure is runtime-level takeover reacquire/reverse replay after full-page traversal. Ampere and Helmholtz both point to `DirectScrollCineView` reverse re-entry/native reconcile skip paths.
- `2026-05-31 tests`: Focused checks passed: `pnpm --dir examples/performance-test test -- src/components/ScrollScenes.test.tsx`, `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand`, and `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`.
- `2026-05-31 type/build`: `pnpm exec tsc --noEmit` and `pnpm --dir examples/performance-test build` passed.
- `2026-05-31 browser`: Playwright/Chrome real-wheel acceptance on `http://127.0.0.1:4175/#/scroll` passed. It found no `pre-anchor` animate ids, no replay owner residue, no duplicate visible tracked title/copy, no console/page errors, and sampled reverse intermediate opacity on both 05 and 03 after full-page forward traversal.
- `2026-05-31 review follow-up`: Helmholtz found no Blocking, but flagged stale `activeZoneIdRef` ownership priority as Major. Added a focused red proof that the first progress callback for a newly crossed takeover must belong to the new zone, then patched native reconcile so an active zone only receives priority while it still has budget in the current direction. Full DirectScroll tests, example tests, Animate phase tests, typecheck, example build, and browser acceptance all passed afterward.
