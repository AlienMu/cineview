# Task: Three-Agent Scroll Runtime Repair

## Goal

- Repair the current direct-scroll foundation instead of reverting to the old virtual-scroll model.
- Make scroll mode match `design.md` and `requirements.md` as the source of truth.
- Use the requested three-agent workflow: main director, implementation lane, independent review lane.
- Complete implementation, review, real browser verification, and follow-up fixes without waiting for repeated user prompts.

## Required Rules

- Main agent owns direction, decomposition, conflict resolution, and final judgment.
- Implementation agent owns code changes and uses TDD / red-green-refactor.
- Review agent owns independent design, interaction, performance, and completion review.
- Implementation and verification must stay separated. The implementation lane must not be treated as acceptance.
- Do not revert to the old scroll runtime or old public API.
- Do not preserve legacy compatibility when it conflicts with the current design.
- Do not claim completion without runtime evidence for focus/takeover animation, scrollbar behavior, console health, and CPU/performance risk.
- After each node, re-read this task flow and continue to the next unchecked executable node unless blocked.

## Design Decisions For This Round

- `CineView mode="scroll"` remains the only root scroll mode entry.
- `Scene.scroll` remains the authored local takeover declaration.
- `Scene` in scroll mode is a real document-flow section, not a forced `100vh` page unless explicitly configured.
- `Animate` must work outside `Scene`; outside takeover it defaults to visibility-driven behavior.
- Inside `Scene.scroll`, omitted `timeline.driver` defaults to scroll-driven.
- Scrollbar metrics must come from the real scroll container, not zone progress.
- Takeover progress is local scene state and must not be inserted into physical page scroll distance.
- CPU remediation must remove high-frequency DOM querying, broad observers, and unnecessary React subtree re-renders.

## Implementation Nodes

- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `2026-05-15-scroll-direct-cutover-rewrite.md`
- [x] Read `2026-05-15-scroll-drag-redesign-and-scrollzone-removal.md`
- [x] Read `2026-05-14-scroll-content-performance-remediation.md`
- [x] Launch implementation agent with TDD / web-artifacts-builder instructions
- [x] Launch review agent with frontend-design-review instructions
- [ ] Implementation lane: add failing tests for current scroll/runtime gaps before fixes
- [ ] Implementation lane: fix `Animate` outside `Scene` in scroll mode
- [ ] Implementation lane: reduce scroll CPU hotspots in `DirectScrollCineView` and `useAnimateScroll`
- [ ] Implementation lane: verify `Scene.scroll` focus/takeover animation is driven by local budget
- [ ] Implementation lane: verify scrollbar remains visible/configurable and reads real container metrics
- [ ] Implementation lane: run targeted tests and builds
- [ ] Review lane: independently review code/API/design/performance against docs
- [ ] Review lane: perform real browser acceptance and collect evidence
- [ ] Main agent: integrate results, resolve conflicts, and either dispatch another fix loop or close

## Acceptance Evidence Required

- Targeted tests show red-green coverage for the repaired behavior.
- `pnpm type-check` passes.
- Relevant test command passes.
- Framework build passes.
- Performance example runs in a real browser.
- Browser evidence covers:
  - scroll page first screen visible
  - native/custom scrollbar present according to config
  - document sections scroll normally
  - `Scene.scroll` takeover pauses document scroll and advances focus animation
  - reverse scroll rewinds takeover before document resumes
  - console has no maximum update depth or runtime crash
  - idle page does not show obvious runaway CPU from monitor/observers/animation loops

## Current Status

- 2026-05-15 13:57 CST: Main director read the required documents and identified likely gaps:
  - `useAnimateScroll` currently returns early when `sceneContext` is missing, which conflicts with Animate outside Scene.
  - visibility-driven animation relies on React updates from scene scroll state instead of a standalone document-flow visibility loop.
  - `DirectScrollCineView` stores high-frequency scroll offset/direction/scrolling in React state and re-clones scene subtrees on scroll.
  - takeover code repeatedly writes the real root scroll offset to the anchor while advancing zone progress; this needs focused review against the local-budget rule.
  - real browser acceptance must test focus/takeover animation, not only "can scroll".
- 2026-05-15 13:58 CST: Initial implementation agent failed with `429 Too Many Requests`.
- 2026-05-15 13:58 CST: Initial review agent completed and found blocking issues: ordinary document `Animate` does not work, non wheel/touch native scroll can bypass takeover, scroll tick still risks broad React re-render, and direct scroll ignores `performance.monitor`.
- 2026-05-15 13:59 CST: User requested restarting all current agents and task. Old agents were closed; this task continues with the same requirements and refreshed agents.
- 2026-05-15 14:00 CST: Second implementation agent failed with `429 Too Many Requests`. Second review agent completed a first-pass review; at that time DirectScroll target tests were red.
- 2026-05-15 14:01 CST: Main director re-ran target tests after partial implementation edits landed:
  - `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand` passed, 7 tests.
  - `pnpm test -- src/components/Animate/useAnimateScroll.warning.test.tsx src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` passed, 9 tests.
- 2026-05-15 14:01 CST: User requested another restart of the task and subagents. Current agents were closed; new agents must continue from the current worktree and verify, not assume completion.
- 2026-05-16 14:43 CST: User requested restarting all tasks and subagents again, explicitly reusing the existing agents without closing them. Current worktree state, tests, and browser evidence remain the baseline for the next pass.
- 2026-05-16 15:08 CST: User requested another restart while still reusing the same agents. New baseline includes a fresh browser observation: with `BODY` focused on the scroll example, `PageDown` is captured globally but does not advance the internal scroll container before takeover becomes eligible.
