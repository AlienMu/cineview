# Task: Scroll and Drag Redesign with ScrollZone Removal Review

## Goal

- Evaluate the current `scroll` and `drag` experiences against professional consumer-grade expectations.
- Decide whether `ScrollZone` should be removed in favor of `Scene`-owned scroll takeover semantics.
- If the removal is the right direction, implement the API/runtime/example migration without drifting from the current mode architecture.
- Redesign the `scroll` and `drag` demos so they show richer, more flexible authored layouts, mixed document-flow and animated scenes, and materially stronger motion variety.
- Complete the work with implementation plus independent acceptance, not a half-finished architectural note.

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect current `scroll` runtime, `ScrollZone` usage, and demo composition
- [x] Produce an assessment of current `scroll` quality, flexibility, and consumer-grade readiness
- [x] Decide and document the `ScrollZone` removal / absorption strategy
- [ ] Implement runtime and public API changes for the approved `scroll` direction
- [ ] Redesign `scroll` demo scenes with varied heights, mixed document flow, and richer motion
- [ ] Redesign `drag` demo scenes with richer motion, layout variety, and stronger authored transitions
- [ ] Update tests/docs affected by the runtime and authoring changes

## Verification

- [ ] Run targeted tests for changed runtime/example surfaces
- [ ] Run relevant builds
- [ ] Perform runtime/browser verification for `scroll`
- [ ] Perform runtime/browser verification for `drag`
- [ ] Run an independent acceptance pass
- [ ] Re-check for remaining unchecked executable nodes

## Risks / Blockers

- Dirty worktree; preserve unrelated user changes.
- `ScrollZone` is baked into current design/requirements docs, tests, and examples, so removal needs coordinated runtime and authoring migration.
- Example redesign must improve fidelity without turning into a marketing shell or repeating one layout across scenes.

## Assessment

- Current `scroll` is not yet professional consumer-grade. It is readable, but too repetitive in structure and too timid in authored height rhythm and motion variety.
- Current `drag` is also not yet at the target bar. It proves engine behavior more than premium storytelling, and some preset choices read playful instead of precise.
- Flexibility is not strong enough in author-facing practice because both demos lean on one repeated scene recipe instead of showing distinct chapter compositions.

## Architecture Decision

- Public authoring will move away from requiring `<ScrollZone>` as the primary surface.
- `Scene` will become the authored scroll takeover boundary for the common case, matching the user's mental model that a scene is the focus unit and non-animated content remains normal document flow.
- Internal zone runtime semantics may remain in place to preserve budget math, callbacks, and navigation behavior while the public component path is simplified.
- `ScrollZone` should no longer be part of the recommended docs/examples path after this migration; compatibility can remain only if needed to avoid a destabilizing runtime rewrite.

## Current Status

- In progress: auditing the current runtime and example surfaces before locking the migration path.
