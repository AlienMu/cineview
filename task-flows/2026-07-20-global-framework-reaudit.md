# CineView Global Framework Re-audit

## Goal

Re-evaluate CineView after the recent prop-composition, callback, ref API, performance, and site work.
Judge whether the current framework still meets professional open-source expectations for architecture,
authoring ergonomics, extensibility, runtime efficiency, maintainability, documentation, and release safety.

## Review Nodes

- [x] **0.1 Re-read architecture and prior review evidence.**
- [x] **1.1 Inventory public package and authoring surface.**
- [x] **1.2 Trace drag and scroll ownership boundaries.**
- [x] **1.3 Inspect component composition and extension paths.**
- [x] **1.4 Inspect callbacks, refs, lifecycle, and cleanup.**
- [x] **2.1 Measure file size, complexity, duplication, and dead surface.**
- [x] **2.2 Audit per-frame runtime and render subscriptions.**
- [x] **2.3 Audit package, docs, examples, and release metadata.**
- [x] **3.1 Run automated verification and build consumption checks.**
- [ ] **3.2 Run independent drag and scroll browser acceptance.**
- [x] **4.1 Produce severity-ranked findings and release verdict.**

## Evaluation Scale

- **Professional**: coherent public mental model, predictable composition, verified runtime behavior,
  maintainable ownership boundaries, complete package metadata, and credible release gates.
- **Conditional professional**: suitable for serious use with documented constraints or a small number of
  non-blocking remediation items.
- **Not release-ready**: correctness, API, runtime, packaging, or documentation defects block broad use.

## Verification Record

- Root `pnpm verify`: passed; 87 suites / 1218 tests, coverage 96.02% statements / 90.31% branches,
  examples 22/22, duplication 1.73%, build verify 12/12, failure-injection gates passed.
- `site`: `pnpm type-check` and `pnpm build` passed.
- `examples/performance-test`: Vitest 22/22 passed, but direct `pnpm exec tsc --noEmit` fails on removed
  `timeline.driver`, removed `snap` mode, missing `renderSnapScenes`, and an unbuilt vite config declaration.
  The example package has no `type-check` script, so root `pnpm verify` does not detect this drift.
- Browser profiler (`examples/performance-test/profile-browser.mjs`): scroll 59.999 FPS, 0 long tasks,
  3.38 React commits/input and 3.70 layout reads/animate/input; drag 60.002 FPS, 0 long tasks,
  4.38 React commits/input and listener growth 5. Regression budgets pass, stricter professional targets fail.
- Independent browser lane: pending.
- `pnpm format:check` fails on 25 root source files; the example/site source check also reports 11 example
  files. `verify` does not include format checking. `git diff --check` is clean.

## Findings

### P1

- **Official examples are not type-safe against the published API.** `ScrollScenes.tsx` still authors
  removed `timeline.driver` values, and `SnapModePage.tsx` still authors removed `mode="snap"` and an
  absent renderer. This makes the official extension surface misleading even though Vitest passes.
- **The public composition engine does not implement true sequential composition.**
  `composeSequentialAnimation` computes per-step delays, then merges variants with `Object.assign`, so
  overlapping properties and the final `transition` overwrite earlier steps. Existing tests assert only
  that an object exists, not that each sequence step is observable.
- **Documentation delivery is incomplete and contains stale API examples.** `site/src/pages/DocsPage.tsx`
  and `DemoPage.tsx` are placeholders, while the visible `demoVideo.code` string shows a removed Scene
  render-prop and an unsupported `AnimateVideo progress` prop. The site builds, but it is not a usable API
  reference for open-source consumers.

### P2

- **The runtime is functionally smooth but not yet lean at the architecture target.** The active Scene
  context carries changing timeline values; `useAnimateDrag` and `useAnimateScroll` depend on broad context/
  zone objects, causing per-frame React commits and effect work. The profiler passes regression budgets but
  fails the configured professional targets. This is headroom debt, not a current visible frame-drop bug.
- **Core owners remain oversized:** `DirectScrollCineView.tsx` (~1600 lines), `Scene.tsx` (~1130),
  `CineView.tsx` (~1020), and `DirectScrollCineView.test.tsx` (~6100). Ownership is conceptually clearer,
  but changes still require navigating large orchestration modules and broad test fixtures.
- **The public extension seam is narrow for zero-render custom timelines.** Hooks are intentionally not
  exported from the root package; custom consumers get `Animate` render props, which use React state per
  progress update, while the zero-render `__renderProgress` seam is internal. This is usable for authored
  scenes but not an ideal plugin/custom-renderer API.
- **The sole architecture document is internally stale in later sections:** current `sceneControlled` rules
  coexist with older `timeline.driver` examples and contradictory “must explicitly declare driver” wording.

### P3

- No CI workflow, changelog, contributing guide, security policy, or support matrix is present in the
  repository. MIT licensing and packed consumer smoke tests are present, but the project governance surface
  is below mature open-source expectations.
- React 19 is declared as a peer range, while the checked-in test/example matrix runs React 18 only; support
  is plausible but not evidenced by CI.

## Decision: reduced-motion scope

The previously proposed framework-level reduced-motion policy is explicitly rejected as a CineView
requirement. CineView's core value is authored scene orchestration, timeline semantics, and drag/scroll
takeover; a consumer that wants ordinary document flow should not mount CineView merely to obtain a
reduced-motion fallback. Experience selection remains application-owned. CineView must not silently remove
scroll takeover or change document geometry based on `prefers-reduced-motion`. Existing site-level handling
is an application concern and is not evidence of a framework defect.

## Verdict

Pending independent browser lane. Automated correctness and packaging are strong; the framework is suitable
for curated production experiences, but it is not yet defensible as fully professional open-source quality
until the P1 example/docs/composition issues are resolved and the P2 runtime architecture debt is either
reduced or explicitly bounded in the release documentation.
