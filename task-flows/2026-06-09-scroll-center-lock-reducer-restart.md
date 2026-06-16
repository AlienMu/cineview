# Scroll Center-Lock Reducer Restart

## Goal

Rebuild scroll takeover behavior around the accepted center-lock model: native document flow owns normal reading, each `Scene.scroll` owns one local progress segment at the scene center, and completed scenes reverse from preserved `100%` to `0%` when scrolling back from following document flow.

## Nodes

- [x] Re-read `AGENT_SELF_REVIEW.md`, `requirements.md`, `design.md`, and project rules after context compression.
- [x] Restart multi-agent process with main / landing / review responsibilities.
- [x] Audit current scroll input and native reconciliation chain for the reverse skip root cause.
- [x] Add or identify a RED public behavior test for completed reverse center-lock replay without skip.
- [x] Implement the minimal real-px scroll intent reducer for full center-lock segment crossing.
- [x] Update requirements/design/self-review docs for the confirmed full-segment skip cause.
- [x] Run targeted tests, typecheck, and real browser verification on `#/scroll`.

## Verification Checklist

- [x] `pnpm exec tsc --noEmit`
- [x] Targeted `DirectScrollCineView` reverse center-lock tests.
- [ ] Scene scroll budget/runtime bridge tests affected by distance naming or empty timelines.
- [x] Real browser route `http://localhost:3000/#/scroll`, including completed 03 and 05 forward, natural flow after completion, then reverse `100% -> 0%`.

## Risks / Blockers

- Existing test file still contains old `sceneEnd`, `reentry`, `replay`, `budget`, and `globalOffset` assumptions. These must not drive runtime back to the old state machine.
- Worktree is already dirty with unrelated changes. Only scroll reducer, public type cleanup, tests, and docs for this task should be touched.
- Agent thread limit previously blocked new agents; completed agents were closed and new landing/review agents were spawned for this restart.

## Current Status

Implementation in progress. Confirmed root cause: the generic intent path could still let one large reverse input move from after a completed center-lock segment to before that same segment, so `syncZoneStatesFromNativeOffset` only observed `progress=0` and the scene looked truly skipped. The minimal reducer now receives real center-lock segments for wheel, keyboard, scrollbar, and native reconciliation paths, and clamps full-segment crossings to an in-segment frame while preserving normal in-segment px-rate progress.

Full `DirectScrollCineView.test.tsx` still has many failures because old assertions describe `sceneEnd`, `capture`, `globalOffset`, and `budget` state-machine behavior. Those failures are logged as stale-test risk and should not pull the runtime back to the abandoned model.

Real browser verification on `http://localhost:3000/?fresh=1781014330460#/scroll`:

- Initial center-lock segments: 03 `2440 -> 3660` with total `1220`; 05 `5857 -> 6877` with total `1020`.
- Forward real wheel: 03 progressed `440 -> 1160 -> 1220`, then released and preserved `1220`; 05 progressed `683 -> 1020`, then released and preserved `1020`; bottom reached `scrollTop ~= 9228.5`.
- Reverse real wheel from bottom: 05 entered the segment at `scrollTop=6348.5`, `progress=491.5`, active `scenarios-takeover`, then reached `0`; later 03 entered at `scrollTop=2977`, `progress=537`, active `specs-takeover`, then reached `0`.
- Large reverse real wheel `-4200` from bottom: reducer stopped at `scrollTop=6876`, 05 active with `progress=1019/1020`, then subsequent real wheel input spent the segment `1019 -> 299 -> 0` before normal document flow continued. This directly covers the prior "one input jumps over the whole scene" failure mode.
