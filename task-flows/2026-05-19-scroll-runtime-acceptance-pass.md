# Task: Scroll Runtime Acceptance Pass

## Goal

- As the independent acceptance lane, verify the current real preview page at `http://127.0.0.1:4173/#/scroll`.
- Current restart scope is the `PERFORMANCE ENVELOPE / spec-takeover` chapter only.
- Treat `http://127.0.0.1:4173/#/scroll` as the stale preview and `http://127.0.0.1:4174/#/scroll` as the rebuilt preview for this pass.
- Focus on entry handoff shape, authored forward leave/hand-off, reverse rollback shape, and console/runtime health on `4174`.

## Nodes

- [x] Re-read `AGENTS.md`
- [x] Re-read `AGENT_SELF_REVIEW.md`
- [x] Re-read relevant `design.md` and `requirements.md` sections for scroll semantics
- [x] Read browser automation skill and choose real-page verification method
- [x] Connect to the live preview page and confirm it is reachable
- [x] Identify stale preview vs rebuilt preview target
- [ ] Connect to rebuilt preview `http://127.0.0.1:4174/#/scroll`
- [ ] Reproduce `PERFORMANCE ENVELOPE / spec-takeover` entry on rebuilt preview
- [ ] Reproduce authored forward leave/hand-off for `spec-takeover` on rebuilt preview
- [ ] Reproduce reverse rollback behavior for `spec-takeover` on rebuilt preview
- [ ] Check console/runtime errors on the rebuilt preview during the `spec-takeover` pass
- [x] Write independent acceptance report

## Verification

- [x] Live page `http://127.0.0.1:4173/#/scroll` reachable
- [ ] Rebuilt preview `http://127.0.0.1:4174/#/scroll` reachable
- [ ] Entry handoff shape observed on rebuilt `spec-takeover`
- [ ] Authored forward leave/hand-off observed on rebuilt `spec-takeover`
- [ ] Reverse rollback shape observed on rebuilt `spec-takeover`
- [ ] No console/runtime errors during the rebuilt `spec-takeover` pass

## Risks / Blockers

- Preview content may differ from source if the running preview is stale.
- Runtime acceptance may need browser automation plus screenshots to establish timing-sensitive behavior.

## Current Status

- In progress
- Active node: Connect to rebuilt preview `http://127.0.0.1:4174/#/scroll`
