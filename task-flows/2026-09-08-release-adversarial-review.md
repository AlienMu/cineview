# Formal-release adversarial review

## Objective and constraints

Follow up on the completed release and main integration. Review the whole project for omissions and deliver an evidence-based approval or rejection for a formal release. Inspect the actual demo without using `/drag`.

Baseline at intake: local main `30ae87f4a49b3047a2282bfacae21779fc8a92f1`. Revalidate remote main, CI, the npm artifact, and the deployed site independently. Existing untracked user files are preserved. Review evidence is recorded under `review/release-adversarial-2026-09-08/`; browser artifacts belong under `output/playwright/`.

## Nodes

- [x] Establish current Git, CI, registry, and deployment identities and a review inventory.
- [x] Review published exports, declarations, installation, browser compatibility, dependency and release configuration.
- [x] Review runtime ownership, lifecycle cleanup, animation timing, scroll/drag boundaries, media, responsive behavior, and accessibility against source and actual test coverage.
- [x] Review documentation completeness, public API claims, bilingual consistency, demo links, and contributor/release instructions.
- [x] Run the required static gates and relevant existing browser acceptance; inspect what each gate actually proves.
- [x] Perform adversarial browser review of the homepage demo and other permitted example routes, with desktop/mobile, reverse and large input, keyboard/scrollbar, media, fixed content, and overlapping animation cases. Do not navigate to `/drag`.
- [x] Reproduce findings, assess release severity, and distinguish blockers from non-blocking follow-up work.
- [x] Complete a requirement-by-requirement release decision with evidence and limits.

## Decision criteria

Approval requires a reproducible consumer artifact, coherent exported APIs and documentation, passing relevant gates on the assessed source, correct core interaction behavior in actual demos, and no unresolved release-blocking findings. Passing tests alone is insufficient. A rejection is a completed review outcome only after the full review scope has been covered and material findings have concrete evidence.

## Completed review

Verdict: **do not approve the assessed revision as a formally accepted release**. The already published npm 1.0.0 remains available. This is a completed review decision, not a claim that remediation is complete.

Full Chinese report: [REPORT.zh-CN.md](../review/release-adversarial-2026-09-08/REPORT.zh-CN.md). The review directory is local evidence, excluded from Git by the repository's existing ignore rule. It contains raw CI/audit results, browser logs, a consolidated browser-results.json, artifact comparisons, and reproduction scripts. Screenshots are under output/playwright/2026-09-08-release-adversarial/.

### Findings

| ID  | Priority | Finding                                                                        | Disposition                                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| F1  | P1       | Scroll input handlers consume Ctrl-wheel and two-finger pinch gestures         | Reproduced on the public homepage and isolated npm 1.0.0 consumer; required before approval                           |
| F2  | P1       | Mobile homepage has 6.5px explanatory text and approximately 4px primary links | Verified at 390×844 after animations settle; required before approval                                                 |
| F3  | P1       | Exact-head Node 24 CI fails the wall-clock first-screen test                   | Local Node 24 passes; remote failure is not a proven browser performance regression, but the release gate remains red |
| F4  | P2       | DESIGN.md lost its body and has 117 missing table-of-contents targets          | Confirmed against Git history; restore current architecture documentation before approval                             |
| F5  | P2       | Site and example lockfiles retain dependency advisories                        | Exposure conditions reviewed; no confirmed public-site remote-code-execution finding                                  |
| F6  | P2       | Accessibility probe checks whether an inert descendant contains document.body  | Assertion cannot detect a hidden current Scene; follow-up test repair required                                        |
| F7  | P2       | Local v1.0.0 points to an old revision; no remote tags or GitHub release       | Preserve existing history; correct release traceability before future tagging                                         |
| F8  | P3       | profile:browser references a locally ignored script absent from HEAD           | Clean-directory reproduction with HEAD package.json returns MODULE_NOT_FOUND                                          |

### Verification evidence

- Local and remote main are 30ae87f4a49b3047a2282bfacae21779fc8a92f1. CI run 34230116165 is for this exact revision: Node 22 and browser acceptance passed; Node 24 failed at a 111.776ms measurement against a <100ms assertion.
- Published archive integrity verified. All 124 dist files match the current rebuilt artifact byte for byte. Online JS/CSS match local site/dist. No framework source changed during the review.
- Clean consumer installation, exports, and SSR passed on Node 18.0.0 and 22.22.1. All four bilingual README TSX modules passed strict TypeScript against the npm package.
- Local Node 24.11.1 verify:framework:static passed: 118 framework suites / 1,582 tests, 24 example tests, types, lint, formatting, duplication thresholds, 17 build checks, and five static failure-injection checks.
- The exact-head Node 22 CI also passed site formatting, types, documentation contracts/style, and both site/example builds.
- Fresh acceptance:browser passed both modes on permitted hash-based example URLs. Inspected its coverage of real inputs, large deltas, reversal, cancellation/re-grab, multiple scroll zones, fixed content, concurrent animation, callbacks, and media.
- Homepage Chrome 152 at 1440×1000 and 390×844: first six scenes inspected; no horizontal overflow; video advances/reverses and reloads after release; keyboard and scrollbar inputs work. Reduced-motion hero samples stayed unchanged, and a fresh hero's three links can receive focus.
- Root dependency audit has no advisories. Site and example audits were evaluated separately, including the conditions required by React Router and Vitest advisories.
- An additional local, ignored profiling script did run and failed its own scroll budget (53.47fps, 3 long tasks, maximum 61ms). Its output is retained as local-untracked-profile.log and disclosed in the report as a signal requiring controlled reproduction, separate from the versioned browser acceptance. A clean-directory check separately proves the profile script is absent from HEAD.

### Review limits and self-review

- `/drag` was not visited in this review. Its hidden preload and final homepage iframe were blocked too. The embedded Cinema experience therefore has no new acceptance verdict. Intentionally blocked requests were not reported as product defects.
- Browser coverage is current desktop Chrome with viewport/touch emulation, not physical mobile devices or the full historical browser versions listed in package metadata. The report explicitly reserves those compatibility claims.
- Runtime review is risk-based source inspection plus tests and actual browser behavior, not a proof that every line or all possible inputs are correct. Mock-based coverage and timing assertions were not presented as actual 60fps evidence.
- The interim focus sample after a scrollbar operation did not record its viewport offset; it is not treated as proof that an on-screen hero was hidden. The fresh-load check records offset 0, visible hero geometry, and successful link focus.
- No runtime, website implementation, tags, dependencies, or release state was changed. Existing untracked files were preserved. The report separates confirmed blockers, maintenance findings, and unverified platform scope. No new npm publication or Git push was performed for this review.

## Subsequent user decision

After this review, the user explicitly excluded zoom gestures (F1) and requested remediation of the other findings. The original verdict above remains the historical result for 30ae87f. Follow-up implementation and scoped acceptance are recorded in [release-review-remediation](./2026-09-08-release-review-remediation.md).
