# Task: Scrollbar Live Overlay Acceptance

## Goal

- Fix the remaining scroll-mode scrollbar issue in the real runtime.
- Eliminate the "independent page / blank band" feeling caused by incorrect scrollbar placement.
- Ensure the example runtime actually consumes the latest framework code instead of a stale local package build.
- Finish with independent implementation, independent review, and independent real-environment acceptance.

## Required Rules

- Re-read `AGENTS.md`, `AGENT_SELF_REVIEW.md`, `design.md`, and `requirements.md` before touching runtime behavior.
- Keep implementation and verification separated.
- Use real runtime verification, not test-only signoff.
- Do not revert unrelated dirty worktree changes.

## Nodes

- [x] Re-read rules, design, requirements, and self-review log
- [x] Inspect current scrollbar runtime and local example import path
- [x] Confirm whether the live example is consuming stale `dist` output
- [x] Create a red verification slice for live scrollbar overlay ownership / presence
- [x] Dispatch independent implementation, review, and runtime-acceptance lanes
- [x] Integrate the minimal fix for live-code alignment and scrollbar rendering
- [x] Run targeted tests for touched files
- [x] Run package build if the example still consumes package entry output
- [ ] Re-run real browser acceptance on the scroll example
- [ ] Update this flow with verified outcome and remaining risks

## Verification

- [ ] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [x] `pnpm build` if local example resolves `cineview` through package entry
- [ ] Real browser check on the active scroll example route
- [ ] Confirm scrollbar rail is visible
- [ ] Confirm scrollbar thumb is draggable
- [ ] Confirm scrollbar overlay is not rendered as scroll content
- [ ] Confirm no new console/runtime errors

## Risks / Blockers

- The example may be pinned to stale prebundled `dist`, creating false negatives during runtime acceptance.
- A visual fix in source can still fail in the live page if the dev server is not consuming the updated package output.

## Notes

- Live red probe on `http://localhost:3001/#/scroll` confirmed the page is still rendering the old scrollbar structure:
  - `data-cineview-scrollbar-overlay="true"` was not found
  - `data-cineview-scrollbar-rail="true"` was found
  - the rail parent still had `position: sticky` and `height: 0px`
- This proves the real example is not currently aligned with the updated source scrollbar overlay implementation.
- Implementation lane updated the example resolver to source-first aliasing and restarted the `3001` dev server.
- A transformed-module sanity check on `http://localhost:3001/src/pages/ScrollModePage.tsx` now shows:
  - `import { CineView } from "/@fs/Users/alienmu/Documents/alien/cineView/cineview/src/index.ts";`
  - meaning the live dev server is no longer resolving `cineview` through stale package `dist` or prebundled deps.

## Current Status

- In progress
- Active node: Re-run real browser acceptance on the scroll example
