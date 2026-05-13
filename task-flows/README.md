# Task Flows

This directory stores one temporary task flow file per substantial task.

## Rule

- Create a new file for each substantial task.
- Use the file as the execution source of truth.
- Update checkboxes as nodes are actually completed.
- Before stopping or replying with completion, verify that all relevant nodes are checked or explicitly blocked.

## File Name Format

- `YYYY-MM-DD-<short-slug>.md`

Example:

- `2026-05-10-scroll-mode-api-audit.md`

## Suggested Template

```md
# Task: <short title>

## Goal

- <what this task must achieve>

## Nodes

- [ ] Read `design.md`
- [ ] Read `requirements.md`
- [ ] Read `AGENT_SELF_REVIEW.md`
- [ ] Inspect relevant code
- [ ] Implement changes
- [ ] Update docs if required

## Verification

- [ ] Run targeted tests
- [ ] Run build if relevant
- [ ] Perform runtime/browser verification if relevant
- [ ] Re-check for remaining unchecked executable nodes

## Risks / Blockers

- None yet

## Current Status

- In progress
```
