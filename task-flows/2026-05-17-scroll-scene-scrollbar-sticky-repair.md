# Task: Scroll Scene / Scrollbar / Sticky Repair Restart

## Goal

- Repair the current `scroll` runtime without deleting `Scene.scroll` takeover behavior.
- Fix the real runtime regression where takeover chapters render as empty / do not animate in.
- Restore usable native scrollbar behavior on the real scroll container.
- Make `Position layer.fixed` in `scroll` mode behave like reusable sticky positioning rather than something that only works because of a scene-specific host.
- Stay within the implementation lane and leave final acceptance to the verification lane.

## Required Rules

- Re-read `design.md`, `requirements.md`, `AGENTS.md`, and `AGENT_SELF_REVIEW.md` before changing runtime behavior.
- Use TDD: one failing behavior slice, then the minimal fix.
- Do not revert or overwrite unrelated work already present in the dirty worktree.
- Keep edits scoped primarily to:
  - `src/components/CineView/DirectScrollCineView.tsx`
  - `src/components/CineView/DirectScrollCineView.test.tsx`
  - `src/components/Position/Position.tsx`
  - `src/components/Position/Position.test.tsx`
- Touch other files only if the owned surface cannot safely express the fix.

## Nodes

- [x] Re-read docs and self-review log for the new 2026-05-17 execution round
- [x] Inspect current owned files and real scroll example path
- [x] Add a red test for native scroll / scrollbar drag entering takeover without runtime activation
- [x] Implement the minimal runtime fix for takeover content visibility
- [x] Re-check scrollbar/native-scroll behavior under the same runtime
- [ ] Re-check sticky semantics in ordinary regions, not only scene host contexts
- [x] Run targeted tests for changed modules
- [ ] Run broader verification needed for touched files
- [ ] Hand remaining risks to verification lane

## Verification

- [ ] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx src/components/Position/Position.test.tsx --runInBand`
- [x] Any newly touched module tests pass
- [ ] Runtime evidence exists for:
- [x] takeover chapter content animates in while zone progress advances
- [x] native scrollbar remains present and usable
- [ ] sticky positioning still works in non-scene ordinary regions

## Risks / Blockers

- The visible regression may live at the boundary between `DirectScrollCineView`, `Animate`, and the example authoring, so the first red test must distinguish runtime semantics from example-only issues.
- The design docs still describe `Position.fixed` in scroll as scene-scoped fixed; if code is moved further toward generic sticky semantics, docs may need follow-up alignment outside the implementation lane.

## Current Status

- In progress
- Active node: Re-check sticky semantics in ordinary regions, not only scene host contexts
