# Task Flow - Act 1 minute-hand reveal regression (2026-08-01)

## Scope

- Diagnose the reported Act 1 ordering bug: the tick calibration completes before the minute hand becomes visible.
- Do not change source behavior during diagnosis; establish a deterministic browser-level failure signal first.

## Nodes

- [x] D1 - Read `DESIGN.md`, `AGENT_SELF_REVIEW.md`, the prior five-act task flow, and the diagnose workflow.
- [x] D2 - Reproduce the exact ordering bug on the real `/drag` route and capture time-point evidence for minute-hand and tick visibility.
- [x] D3 - Trace the hand/tick authored timelines and rank falsifiable root-cause hypotheses.
- [x] D4 - Test the hypotheses against runtime values and identify the exact cause and missing acceptance assertion.
- [x] D5 - Report the diagnosis and the invalid prior verification claim; leave implementation unchanged unless the user requests the fix.

## Evidence Log

- Prior V4 recorded the completed calibration lap and final clock state, but did not assert that the minute hand was visible before the first tick or throughout the first-lap tick reveal.
- Real Chromium reproduction at `/drag`: 250ms = 5 visible ticks / minute-hand effective opacity 0; 1200ms = 24 / 0; 2400ms = 48 / 0; 2950ms = 59 / 0; 3050ms = 60 / 0.039. Three reload probes reproduced the hidden inner hand lane consistently.
- Root cause: `RunningMinuteHand` nests the real hand inside `s01-hand-minute-advance`, whose timeline delay is `DIAL_SWEEP_MS` (3000ms). CineView resolves every missing opacity through `getDefaultValue`: initial opacity 0 and animate opacity 1. Although that lane authors only rotation, its entire host therefore remains transparent until its delay elapses.
- Rejected alternatives: the sweep host rotates correctly, so CSS geometry/stacking is not the cause; timing is unreduced and matches the authored 50ms tick grid/3000ms delay; repeated reloads begin with only the leading tick visible, so registry terminal-state catch-up is not the cause.
- False-positive seam: `temporalDragW1.contract.test.ts` checks constants, descriptor wiring, and AST shape but never renders the nested Animate composition or measures effective descendant opacity. It and `animateInterpolation.unit.test.ts` pass 23/23 while the browser repro fails; the latter explicitly confirms the default-opacity behavior that causes the composition bug.
- The prior five-act task flow has reopened N1 and V4 and retracted the aggregate browser PASS until Act 1 is fixed and independently retested.
