# Agent Self-Review

Use this checklist after every implementation node.

## Behavior

- Read the relevant `DESIGN.md` rule again.
- Confirm the changed code fixes the behavior rather than only satisfying a test.
- Check both drag and scroll paths when the change touches shared components.

## Ownership and Runtime

- `renderProgress` still has one writer.
- Each Scene's `elementElapsedMotion` still has one writer.
- `dragRelease` still has one writer.
- No per-frame React state, object cloning, layout read/write interleaving or
  avoidable allocation was introduced.
- MotionValue subscriptions and browser listeners are cleaned up.

## Structure

- Search for stale field names, duplicate helpers, dead exports and compatibility
  fallbacks.
- Check file and function growth and record any oversized owner for a later split.
- Keep tests semantic; do not hide behavior in an overly broad fixture.

## Evidence

- Run focused tests for the changed behavior.
- Run static checks and the relevant build or coverage gate.
- Require an independent browser agent for drag, scroll, visual, accessibility or
  runtime-performance changes.
- Record changed files, test output, self-review and browser evidence in the task
  flow before checking a node off.
