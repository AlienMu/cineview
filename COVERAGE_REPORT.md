# Coverage Report

The project target is at least 90% for statements, branches, functions and lines.
The Jest configuration is the enforcement point.

The latest review run before restoring the branch gate reported:

| Metric     | Result |
| ---------- | -----: |
| Statements | 95.90% |
| Branches   | 89.15% |
| Functions  | 96.03% |
| Lines      | 96.15% |

The branch metric is currently below the required target and must not be described
as release-ready until the missing branch cases are covered. Run
`pnpm test:coverage --runInBand` after each remediation slice.
