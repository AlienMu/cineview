# Release review remediation

## Scope

The user requested fixing the remaining release-review findings and explicitly excluded zoom gestures (F1). Preserve that behavior. Continue the authorized main integration and Cloudflare deployment after verification. Do not republish npm 1.0.0 or move existing Git tags. Do not visit the standalone /drag route; block the homepage's embedded and preload requests to it during acceptance.

Baseline: main 30ae87f4a49b3047a2282bfacae21779fc8a92f1. Existing untracked and ignored user files remain untouched. Current TypeScript source and public types are authoritative; DESIGN.md currently lacks its body and will be reconstructed from the implementation and history.

## Nodes

- [x] Repair mobile homepage typography, controls, and video layout within the existing visual design (F2).
- [x] Replace environment-sensitive jsdom timing claims with semantic tests and reproducible browser profiling (F3, F8).
- [x] Restore current architecture documentation and validate its links and anchors (F4).
- [x] Update the separate site/example dependency sets and verify their audits and builds (F5).
- [x] Repair the active-scene accessibility assertion and prove it detects injected failures (F6).
- [x] Record and publish unambiguous npm-to-source release correspondence without moving old tags or republishing the package (F7).
- [x] Run static gates, independent browser acceptance, and controlled profiling; review the final diff.
- [x] Commit and push to main, verify its CI, deploy Cloudflare Pages, and verify the public result.

## Acceptance

Use the documentation and UI skills for the affected surfaces. AGENT_SELF_REVIEW.md requires an independent browser agent for visual/accessibility changes; this is authorized repository verification, not a new user task. Record actual results and any remaining limits. F1 remains excluded by the user's explicit decision and is not a blocker for this scoped work.

## Implementation and verification

- F2: mobile Hero uses 16px body text, a 52px primary control and 44px secondary controls. English words wrap intact. The video canvas has a definite viewport height; narrow-screen subtitles wrap, title clears the fixed header, and short-landscape text no longer overlaps. Film content uses two columns in the tested short landscape viewport.
- F3/F8: jsdom now verifies rendered content, onReady, navigation and finite metric values. The tracked production profiler imports the built library, records browser paint/frames/long tasks under real wheel input, and fails on explicit fixture budgets. Its command and CI/release jobs are wired to the tracked file; the user's ignored profile-browser.mjs remains untouched.
- F4: DESIGN.md was reconstructed from current source and ownership rules, replacing 117 broken TOC targets. The local-link checker covers architecture, README and contributor/release documents; deliberate missing-anchor input fails the static injection suite.
- F5: site React Router 7 and Vite 8, example Vite 8 and Vitest 5, compatible configuration updates and refreshed locks. All four independent dependency audits report zero known vulnerabilities. CI and the release workflow audit all four projects.
- F6: the shared assertion locates the announced current Scene, then checks itself and ancestors for inert/aria-hidden. Both deliberately hidden variants fail browser acceptance. The standalone accessibility probe passes 12/12 on the permitted production fixture URL /#/acceptance/drag.
- F7: tarball integrity and SHA-256 verified; all 124 dist files match the rebuilt runtime, and metadata/license/both README files match ba0adf440c8a52be97db827b02f43089019b1750 byte for byte. releases/1.0.0.json and RELEASING.md explain the reconstructed correspondence and absent registry gitHead. Annotated npm/v1.0.0 prepared at that commit; old v1.0.0 remains unchanged. The correspondence tag and record were pushed with the implementation.

Local Node 22.22.1 framework static gate passes: 118 suites / 1,582 framework tests, 24 example tests, 17 build checks, six deliberate static failures, formatting, types, lint and duplicate-code gate. Node 24.11.1 focused readiness tests pass 16/16. Site formatting/types, root types, 79 site contracts, documentation style (zero structural issues), 50 local documentation links, and all site/example production builds pass. Both production browser acceptance modes pass on permitted hash routes.

Independent browser review covers EN/ZH, 320×700, 390×844, 844×390 and 1440×1000, the first six homepage scenes, settled visuals, real input, media exit/reentry and direct documentation navigation after the router upgrade. It caught and verified fixes for the initial percentage-height regression and landscape overlap. Independent production profiling passed three fresh-context runs (FCP 68–80ms on Chrome 152 / Apple M4); frame rates are diagnostics, not a universal guarantee. A direct DevTools busy loop was not counted by Long Tasks, so injection now runs in a page timer task; the independent check records 300ms and exit 1. The complete browser failure-injection suite passes all 11 deliberate failures after that correction.

Evidence: review/release-remediation-2026-09-08/ and output/playwright/2026-09-08-release-remediation/ (local, intentionally excluded from Git). The original adversarial review is preserved separately.

## Self-review and limits

Runtime source is unchanged; the only src change is the semantic integration test. No new progress writer, per-frame React state, listener, or asset owner was introduced. UI changes remain in website CSS and one title class. User-owned ignored and untracked files remain intact. No npm publication or existing-tag rewrite occurs.

F1 zoom gestures are explicitly outside this remediation. Standalone /drag and its hidden homepage preload/iframe requests were blocked throughout independent homepage review; the separate hash-based framework fixture was tested. Chrome desktop with touch/viewport emulation does not establish physical mobile-device, historical browser, or full assistive-technology support. Production deployment and exact-implementation CI results are recorded below.

## Main integration and production result

Implementation commit **73bacdfae2adf06af9e156c03989aba8cab6ad04** was pushed to main together with the annotated npm/v1.0.0 tag. The normal pre-push hook ran the complete framework static gate on Node 24.11.1 and passed. Existing v1.0.0 still resolves to 44809d955c53e251d3146b8920bae2e05a7f0431; npm 1.0.0 was not republished.

Exact-implementation GitHub CI [34242374265](https://github.com/AlienMu/cineview/actions/runs/34242374265) completed successfully: Node 22.22.1, Node 24.x, and framework browser acceptance, including the new audits, documentation links, production profiling and deliberate-failure checks.

Cloudflare Pages deployment **cc5fb73f** serves [cineview.pages.dev](https://cineview.pages.dev) and [its deployment URL](https://cc5fb73f.cineview.pages.dev). Public homepage, /docs and /docs/03-quickstart return the new entry. Main assets index-TsbidsfF.js and index-CDIEGSex.css match the independently accepted local build byte for byte. Video media is accessible. Wrangler's dirty-directory warning came from the preserved local untracked files; tracked implementation files were clean and only the verified site/dist directory was uploaded.

Independent public-domain smoke passes: 390px settled Hero text and controls, 844×390 video without title/subtitle overlap, Quickstart direct navigation and Chinese switching. Title/subtitle gap is 37.59px in landscape; page and console errors are zero. Evidence is public-browser.md and public-http.json under review/release-remediation-2026-09-08/, plus the corresponding screenshots under output/playwright/. The same /drag and F1 exclusions apply.

All scoped findings F2–F8 are closed by the recorded checks. This final task-flow update changes verification history only; the website and library artifacts remain those from the accepted implementation commit. The original adversarial verdict remains the historical result for its earlier baseline.
