# Coverage Report

The project target is at least 90% for statements, branches, functions and lines.
`jest.config.js` (`coverageThreshold.global`) is the enforcement point — the suite fails
below any of the four.

Latest run (2026-09-02, `pnpm test:coverage:framework`, 113 suites / 1547 tests, all green):

| Metric     | Result |   Gate | Margin |
| ---------- | -----: | -----: | -----: |
| Statements | 96.57% | 90.00% |  +6.57 |
| Branches   | 90.62% | 90.00% |  +0.62 |
| Functions  | 95.65% | 90.00% |  +5.65 |
| Lines      | 96.57% | 90.00% |  +6.57 |

All four gates pass. Branches carry the thinnest margin (+0.62), so a change that adds
untested conditionals is the realistic way to break the gate.

Reproduce with `pnpm test:coverage:framework`. Percentages above are computed from
`coverage/lcov.info` after that run; `coverage/coverage-summary.json` is written by a
different invocation and can be stale — prefer lcov or the terminal table.

A caveat the numbers do not carry: 34 of 124 test files mock `framer-motion`, which owns
every per-frame value. Coverage counts executed lines, not what a test asserts — a file
whose assertions never read a computed value scores the same as one that checks every
frame, so these percentages cannot tell you whether a change in animation output would be
caught. `Animate.test.tsx` is the worked example: its stub now consumes `(source, fn)`
faithfully and its assertions read the resolved style, which is what makes a lane that
ignores its input fail there. Per-frame behaviour outside that path is still established
by source review and browser acceptance. See `AGENTS.md` rule 4.
