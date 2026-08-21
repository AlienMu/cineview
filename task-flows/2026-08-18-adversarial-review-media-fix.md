# 2026-08-18 Media Adversarial Fix

## Scope

Only `src/media/VideoFrameRenderer.tsx`, `src/media/videoPlaybackOwnership.ts`, and
their tests are in scope. The parent review found two deterministic media failures:

1. keyed `<video>` replacement did not re-apply the authored `playbackRate`;
2. a delayed framework `play` event could arrive after promise settlement and reclaim
   native ownership after the timeline had already taken ownership back.

## Nodes

- [x] 1. Read `DESIGN.md`, `CLAUDE.md`, `AGENT_SELF_REVIEW.md`, and the independent code-review report.
- [x] 2. Inspect the current media implementation, tests, and working-tree scope.
- [x] 3. Fix playback-rate reapplication and framework play-token ownership.
- [x] 4. Add deterministic reducer and renderer regression tests.
- [x] 5. Run focused media tests and `pnpm type-check`; re-read changed code and record results.

## Baseline Evidence

- Independent report: `task-flows/2026-08-18-adversarial-review-code.md`, findings at lines 20-25.
- Baseline focused media tests were green in the parent review, but did not cover the two
  counterexamples above.

## Node 3: Implementation Evidence

- `VideoFrameRenderer.tsx:378-382` now reapplies `playbackRate ?? 1` when `src`, object URL,
  residency state, or keyed media-node epoch changes.
- `VideoFrameRenderer.tsx:206-233,438-464` retains a resolved framework play token until the
  native event arrives; rejected requests are retired so external native retry remains valid.
  Capture listeners tag matching late events and refuse callbacks for stale/blocked events.
- `videoPlaybackOwnership.ts:14-24,278-356` records the settled request and a
  `frameworkPlayBlocked` handoff guard. Tagged stale events and untagged events after a
  framework takeover issue a defensive pause; untagged play remains accepted before takeover
  and after an ordinary native/play-rejected path.

### Node 3 self-check

- Re-read the reducer and listener control flow after editing. There is one ownership reducer
  and one pending request ref; no scroll/site files were changed by this subtask.
- The token is cleared on accepted/rejected native event, source/activation reset, or a new
  request. A framework-induced pause preserves the invalidation marker, preventing a later
  untagged queued play from reclaiming scrub ownership.

## Node 4: Regression Evidence

- Added `videoPlaybackOwnership.test.ts:487-514`: promise-settled handoff followed by an
  untagged late play remains `framework-scrub` and emits `pause`.
- Added `VideoFrameRenderer.test.tsx:506-522`: source swap with unchanged `playbackRate`
  receives the rate on the replacement node.
- Added `VideoFrameRenderer.test.tsx:546-589`: resolved `play()` followed by scroll takeover
  rejects a delayed play event, emits the defensive pause, and does not call `onPlay`.
- Added `VideoFrameRenderer.test.tsx:1040-1074`: release and warm-up keyed remounts retain
  the authored rate.

### Node 4 self-check

- Existing native takeover coverage remains green (`continues framework settle...` and
  `allows an external play after automatic play rejection`); the fix does not blanket-drop
  untagged native play.

## Node 5: Verification Evidence

- `pnpm test --runInBand src/media/videoPlaybackOwnership.test.ts src/media/VideoFrameRenderer.test.tsx`
  -> **2 suites / 68 tests PASS**.
- `pnpm test --runInBand src/components/Animate/AnimateVideo.plumbing.test.tsx
  src/components/Animate/AnimateVideo.test.tsx src/media/videoPlaybackOwnership.test.ts
  src/media/VideoFrameRenderer.test.tsx` -> **4 suites / 75 tests PASS**.
- `pnpm type-check` -> **PASS** (exit 0).
- `pnpm exec eslint src/media/VideoFrameRenderer.tsx src/media/videoPlaybackOwnership.ts
  src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts` -> **PASS**.
- `git diff --check` -> **PASS**.

### Node 5 self-check and boundary

- Focused tests exercise both the reducer counterexample and the actual renderer event path;
  source-swap and residency remount playback-rate behavior are asserted on the new DOM node.
- This is a child-subtask result only. It does not establish the repository-wide verdict,
  scroll/site fixes, build verification, or real-browser acceptance; the parent agent must run
  independent code review and the required broader gates.
