# Coverage Report

The project target is at least 90% for statements, branches, functions and lines.
`jest.config.js` (`coverageThreshold.global`) is the enforcement point — the suite fails
below any of the four.

Latest run (2026-09-01, `pnpm test:coverage:framework`, 112 suites / 1533 tests, all green):

| Metric     | Result |   Gate | Margin |
| ---------- | -----: | -----: | -----: |
| Statements | 96.57% | 90.00% |  +6.57 |
| Branches   | 90.56% | 90.00% |  +0.56 |
| Functions  | 95.65% | 90.00% |  +5.65 |
| Lines      | 96.54% | 90.00% |  +6.54 |

All four gates pass. Branches carry the thinnest margin (+0.56), so a change that adds
untested conditionals is the realistic way to break the gate.

Reproduce with `pnpm test:coverage:framework`. Percentages above are computed from
`coverage/lcov.info` after that run; `coverage/coverage-summary.json` is written by a
different invocation and can be stale — prefer lcov or the terminal table.

A caveat the numbers do not carry: 34 of 123 test files mock `framer-motion`, which owns
every per-frame value, so per-frame behaviour is established by source review and browser
acceptance rather than by these percentages. See `AGENTS.md` rule 4.
