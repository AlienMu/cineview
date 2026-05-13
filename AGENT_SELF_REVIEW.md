# Agent Self Review Log

This file is a project-local operational memory for recurring mistakes, regressions, and workflow failures.

## Usage

- Read this file before substantial framework work.
- Add an entry after any confirmed mistake, regression, or user-corrected misunderstanding.
- Keep entries short and actionable.

## Entry Template

```md
## YYYY-MM-DD - Short Title

- Context:
- What was wrong:
- Why it happened:
- Missed signal:
- Next-time rule:
```

## 2026-05-10 - Overconfident frontend completion without strong enough verification

- Context: Repeated scroll/scene/layer refactors in `scroll` mode.
- What was wrong: Claimed or implied fixes before enough real runtime verification, while visual and interaction bugs still existed.
- Why it happened: Relied too much on code reasoning and partial checks; insufficient separation between implementation confidence and verification confidence.
- Missed signal: The task involved fragile scene/scroll/layer interactions and the user had already reported many regressions of the same class.
- Next-time rule: For frontend interaction work in this project, do not conclude visually sensitive fixes without explicit runtime checks, console checks, and a separate verification pass.

## 2026-05-10 - Letting runtime internals leak into public API recommendations

- Context: Scroll mode redesign discussion around `Viewport`, `ScrollZone`, root mode, and scene behavior.
- What was wrong: Stayed too close to existing implementation details when shaping public API and documentation.
- Why it happened: Followed current code structure before fully re-centering on user-facing ergonomics.
- Missed signal: The user repeatedly emphasized customer experience, easier semantics, and not exposing internal machinery.
- Next-time rule: For API redesign in this project, start from user tasks and ownership boundaries first, then map to runtime internals second.

## 2026-05-10 - Not narrowing rules to project scope soon enough

- Context: Added workflow rules at the workspace root before the user clarified they should apply only to `cineview`.
- What was wrong: The first placement was broader than the intended scope.
- Why it happened: Optimized for speed before confirming the exact boundary of the persistent rule file.
- Missed signal: The request was explicitly about “该项目”, which should have biased toward the project directory itself.
- Next-time rule: When adding persistent agent rules, scope them to the narrowest directory matching the user’s wording unless broader scope is explicitly requested.

## 2026-05-10 - Continued execution from summary without fully re-running project startup ritual

- Context: User asked to enter code migration and continue the implementation program.
- What was wrong: I resumed from the handoff summary and existing program flow, but did not fully re-run the required project startup ritual for this new execution round.
- Why it happened: I treated the handoff as sufficient operational context and under-weighted the project rule that substantial work must begin from docs plus a task-local flow file.
- Missed signal: The project rules explicitly require reading `design.md`, `requirements.md`, and creating a new per-task task-flow file before substantial implementation.
- Next-time rule: In this project, even with a good handoff, start each substantial execution round by re-reading rules/docs and creating or refreshing a dedicated task-flow file for that round before touching code.

## 2026-05-10 - Stopped after a passed node instead of re-reading task flow

- Context: User asked why the task stopped even though unchecked migration nodes remained.
- What was wrong: I let execution pause after a verification slice instead of immediately re-reading the active task-flow file and continuing the next executable node.
- Why it happened: I treated the local success condition as a natural stopping point and did not enforce the project's "task-flow is the source of truth" rule tightly enough.
- Missed signal: The active task-flow still had unchecked Phase 3 and Phase 4 work, and the user had explicitly asked for automatic continuation.
- Next-time rule: After every completed node in this project, re-open the active task-flow file immediately; if an unchecked executable node remains and there is no blocker, continue in the same turn without waiting for a reminder.

## 2026-05-10 - Drifted from the active node into broader self-directed cleanup

- Context: Phase 4 migration execution with explicit user rules for task-flow-driven progress and separated implementation/acceptance lanes.
- What was wrong: I started chasing adjacent example/runtime polish outside the currently active task-flow node instead of staying anchored to the single unchecked node and routing validation back through the independent lanes.
- Why it happened: I over-weighted local visual findings and under-weighted the requirement that the task flow, not my own curiosity, defines what to do next.
- Missed signal: The user explicitly called out that I was returning to earlier issues instead of following their execution rules.
- Next-time rule: In this project, when new findings appear, first map them to the current task-flow node; if they do not belong to the active node, park them instead of expanding scope mid-turn.

## 2026-05-11 - Collapsed implementation and verification after agent failure

- Context: Phase 5 `ScrollZone` public bridge with explicit project rules requiring separate implementation and acceptance lanes.
- What was wrong: After the implementation agent hit `429`, I completed remaining code changes myself and then ran the verification myself, which collapsed implementation and acceptance into one lane.
- Why it happened: I over-prioritized keeping momentum after the agent failure and treated local verification as an acceptable substitute for the required independent acceptance flow.
- Missed signal: The user had already repeated multiple times that I must not write and validate my own frontend changes on this project.
- Next-time rule: In this project, if the implementation or acceptance lane fails, I must mark the node blocked or re-establish separate lanes; I must not silently replace both roles with myself.

## 2026-05-12 - Left completed validator agents hanging and exhausted thread slots

- Context: Phase 6 follow-up work needed repeated independent acceptance passes across implementation and runtime-evidence nodes.
- What was wrong: After collecting completed sub-agent results, I left validator/acceptance agents hanging instead of closing them promptly, and later hit the agent thread limit when I needed a fresh independent acceptance lane.
- Why it happened: I treated a completed agent as harmless to leave around and focused on preserving context, but under-weighted the finite thread-slot constraint.
- Missed signal: The acceptance result had already been harvested and written into the flow, so the lingering agent no longer provided unique value but still consumed capacity needed for the next node.
- Next-time rule: In this project, once a sub-agent has completed and its result has been integrated into the active task flow, immediately `close_agent` it unless there is a concrete near-term reason to reuse that exact agent context.

## 2026-05-13 - Wrapped a React component mock in `jest.fn` and broke render invocation

- Context: Follow-up drag-mode bugfix work around `Scene.dragMode.test.tsx`.
- What was wrong: I changed a `framer-motion` component mock into `jest.fn(React.forwardRef(...))`, which made Jest try to call a forwardRef object like a plain function and triggered `specificMockImpl.apply is not a function`.
- Why it happened: I optimized for mock inspectability and warning suppression before re-checking the exact React component shape expected at render time.
- Missed signal: The mock target was a renderable component, not a callback dependency; wrapping it in `jest.fn` changed the callable contract.
- Next-time rule: For React component mocks in this project, keep the exported component as a real `forwardRef` component unless the test genuinely needs a function spy at the component boundary.
