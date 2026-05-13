# Project Agent Rules

This file defines the default collaboration workflow for the `cineview` project only.

## Scope

These rules apply only to:
- `/Users/alienmu/Documents/alien/cineView/cineview`

They are not intended as global rules for unrelated projects.

## Default Workflow

1. Start from documentation
   - Read `design.md` and `requirements.md` before changing framework behavior, public API, mode semantics, animation semantics, layout semantics, or performance strategy.
   - If code and docs conflict, call out the conflict before implementation.
   - Do not make architecture-level changes first and explain later.

2. Create a task flow before substantial work
   - Before implementation, create or update a project-local task flow checklist.
   - Use node-style task steps rather than a loose prose plan.
   - Mark each node explicitly as completed when it is actually done.
   - Do not rely on conversational status messages as the source of truth.

3. Use multi-agent collaboration by default for substantial work
   - Use one implementation agent.
   - Use one verification/testing agent.
   - The main thread is responsible for orchestration, integration, and final judgment.
   - Do not declare the task complete until both implementation and verification have been reviewed.

4. Separate implementation from verification
   - The implementation agent should focus on code changes.
   - The verification agent should focus on tests, browser checks, regressions, console errors, and UX issues.
   - Do not let the same sub-agent both implement and sign off on its own work when parallel verification is feasible.

## Required Verification Before Final Response

For any non-trivial change, perform end-of-task self-verification.

1. Always run relevant verification
   - Run targeted tests for changed modules.
   - Run build if the affected area can influence packaging or type output.
   - For frontend work, perform real runtime verification whenever possible.
   - Check browser console errors for frontend tasks.

2. Frontend verification expectations
   - Verify the actual rendered result, not only static code inspection.
   - Check interaction behavior, not just initial render.
   - Check layout, overlap, visibility, and regression-prone transitions.
   - Check that no obvious white screen, layer overlap, or broken state exists.

3. No optimistic completion
   - Do not say "done", "fixed", or equivalent before verification finishes.
   - If work is modified but not yet verified, clearly say that verification is still pending.
   - If verification is partial, state exactly what was and was not verified.

4. Final response must include
   - What changed
   - What was tested
   - What remains risky, unclear, or unverified

## Documentation Sync

Any change to framework behavior or public surface must update documentation in the same task.

This includes:
- architecture
- public API
- mode semantics
- parameter semantics
- animation behavior
- layout behavior
- scroll behavior
- callback or method changes

Required docs to sync when relevant:
- `design.md`
- `requirements.md`

Do not leave framework code and framework docs knowingly out of sync.

## API and Architecture Discipline

1. Prefer root-first API design
   - Mode selection belongs at the root.
   - Mode-specific parameters should be grouped into mode objects.

2. Prefer grouped configuration over flat parameter sprawl
   - Fields belonging to the same business concern should live in the same object.
   - Provide stable defaults.
   - Avoid scattering one feature across `CineView`, `Scene`, and `Animate` unless that split is intentional and documented.

3. Prefer progressive disclosure
   - Keep the default API simple.
   - Put advanced tuning behind nested objects or advanced components.
   - Avoid forcing users to understand runtime internals for common use cases.

4. Prefer explicit ownership
   - Runtime state should have one owner.
   - Public API should not mirror every internal mechanism.
   - Scene layout concerns, mode concerns, animation concerns, and runtime concerns should not be mixed casually.

## Testing and Review Posture

1. For review-like tasks, prioritize
   - correctness
   - regressions
   - UX breakage
   - missing tests
   - performance risks

2. For frontend tasks, explicitly check
   - layout overlap
   - missing content
   - incorrect visibility timing
   - console/runtime errors
   - scroll/drag interaction regressions

3. For performance-sensitive tasks, explicitly inspect
   - unnecessary DOM measurement
   - redundant observers
   - duplicated React/runtime state
   - avoidable re-renders
   - query-based DOM lookups in hot paths

## Response Discipline

1. Be precise about status
   - "Implemented"
   - "Implemented and tested"
   - "Implemented, partially verified"
   - "Blocked by ..."

2. If something is not verified, say so plainly.

3. If a workaround is temporary, label it as temporary.

4. If the docs are still stale, say that explicitly instead of implying completion.

## Self-Review Log

The agent must maintain a project-local self-review log.

1. Log file
   - Use `AGENT_SELF_REVIEW.md` in the project root.

2. When to log
   - After a confirmed mistake
   - After a user-corrected misunderstanding
   - After a regression introduced by the agent
   - After an overconfident completion statement that was not fully verified
   - After discovering a recurring workflow failure

3. What to log
   - Date
   - Task context
   - What was wrong
   - Why it happened
   - What signal should have been noticed earlier
   - What rule or behavior should change next time

4. How to use it
   - Read `AGENT_SELF_REVIEW.md` at the start of substantial work in this project
   - Before finalizing complex work, check whether any logged failure pattern is repeating

5. Writing style
   - Keep entries concise, factual, and operational
   - Write for future agent use, not for presentation
   - Prefer actionable rules over emotional commentary

## Task Flow Log

The agent must maintain a per-task task flow file for active work.

1. Task flow location
   - Use the `task-flows/` directory in the project root.
   - Create one new markdown file per substantial user task.

2. Naming
   - File name format:
     - `YYYY-MM-DD-<short-slug>.md`
   - Example:
     - `2026-05-10-scroll-mode-api-audit.md`

3. When to create it
   - Immediately after receiving a substantial task
   - Before implementation begins

4. When to update it
   - When task scope changes materially
   - When a node is completed
   - Before final response
   - When blocked status changes

5. Format requirements
   - Use a checklist
   - Break work into concrete nodes
   - Keep exactly one node actively in progress when possible
   - Mark completed nodes with `[x]`
   - Mark pending nodes with `[ ]`
   - Mark blocked nodes explicitly in a notes section

6. Minimum structure
   - Task title
   - Goal
   - Node checklist
   - Verification checklist
   - Risks / blockers
   - Current status

7. Execution rule
   - The task flow file is the source of truth for progress.
   - Do not rely on conversational status messages as the only progress tracking mechanism.
   - Before each major action, re-check the task flow file.
   - If unchecked nodes remain and there is no blocker, automatically continue with the next node.
   - Do not stop after one node if the task is still active and executable.

8. Completion rule
   - A node may be checked only after the underlying work is actually completed.
   - Verification nodes must not be checked before tests or runtime checks finish.
   - A task is not complete while relevant unchecked nodes remain.
