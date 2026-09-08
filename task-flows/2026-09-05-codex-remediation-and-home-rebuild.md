# Codex Remediation And Home Rebuild

Written against: `a1daed9` plus the existing working tree

## Evidence Chain

- Surface: framework public exports, Animate visibility and clock paths, scroll layout, and `/` homepage
- Problem: React 19 migration and package exports are incomplete; several runtime ownership and visibility cases are incorrect; the homepage still uses unsupported scroll triggers and unfinished scenes
- Design evidence: `DESIGN.md`, `AGENTS.md`, Claude homepage history, and local `ui-skills` 0.2.4 guidance
- Owner: framework runtime plus `site/src/pages/HomePage.tsx`
- Scope and affected surfaces: `src/`, `site/src/`, package manifests, CI, generated homepage media
- Uncertainty: real browser acceptance requires a running writable site environment

## Nodes

- [x] Restore public Animate typing and composition assertions
- [x] Fix visibility scheduling, inert ownership, clock authoring freeze, and offscreen loop completion
- [x] Complete horizontal scroll layout and browser regression coverage
- [x] Close React 19, performance panel, dev export, and CI/release gaps
- [ ] Rebuild the homepage as nine coherent scenes with valid APIs and responsive typography
- [ ] Add coherent studio hero/equipment media or record the exact generation handoff when image generation is unavailable
- [ ] Run framework/site static gates and browser acceptance; record evidence

## Stop Conditions

- Stop implementation if a change requires a new public API not described by `DESIGN.md`.
- Stop media generation if the built-in image tool is unavailable; keep the prompt/specification explicit instead of fabricating assets.

## Resumed Bug Fix Pass (2026-09-05)

Latest recovered user direction: finish the separate image/material/layout plan, then prioritize bugs. The image plan exists in `2026-09-05-home-image-materials-and-layout.md`; visual reconstruction and image generation remain deferred. Local browser acceptance was explicitly authorized in the recovered conversation.

- [x] Recover latest local conversation and reconcile the working tree without resetting existing changes
- [x] Verify and complete horizontal layout with real browser geometry and input regression checks
- [x] Complete packaged dev exports, React 19 example dependencies, and CI installation/runtime requirements
- [x] Verify shared performance snapshots, SSR behavior, polling cleanup, and homepage sampling
- [x] Verify existing Animate scheduler, inert, frozen clock authoring, and offscreen loop fixes
- [x] Remove the two unfinished homepage scene registrations identified in the previous handoff; keep their draft source files and separate design plan
- [x] Run applicable static gates and browser acceptance, and record current results and any remaining failures

Existing deletions and unrelated working-tree changes predate this resumed pass and are preserved.

## Bug Fix Results

- Horizontal ordinary scenes and ordinary children now resolve percentage widths against the viewport-width stream exactly once, retain intrinsic content widths, and update after resize. Browser baseline at 1200px: a full-width scene was 255px and a half-width scene was 127.5px. Corrected widths are 1200px and 600px; the ordinary 75% child is 900px.
- Horizontal scrollbar positioning uses the container bottom. The former width-based top coordinate placed the rail below the viewport.
- Fractional scroll-zone boundaries no longer trap repeated reverse input at a half-pixel interior offset. A pure-function regression and the 390px browser run cover the failure.
- Public Animate composition guards and authored inert behavior pass regression checks. Additional tests cover cancellation during a shared frame, cancellation followed by rescheduling, pending clock authoring changes across activation tokens, and loop entry completing offscreen.
- `cineview/dev` now ships ESM, declarations, and explicit `cineview/dev/style.css`. The verifier checks every export target and imports the real unpacked tarball for SSR, types, and CSS consumption without source aliases.
- Both examples now use React 19 and Motion 13. CI/release install all four independent projects and use compatible development Node versions. Installation docs and CONTRIBUTING reflect these requirements.
- Performance scene visibility enables the existing runtime sampler in production. The scene and development panel share one 500ms display poll; leaving the production scene stops both sampling and polling. Metrics describe FPS, average frame time, optional JS heap, and estimated loaded page code. Unsampled chart entries are omitted.
- Emanation and Canvas draft registrations were removed from HomePage as directed in the previous conversation. Draft files remain available for the separate image-backed homepage work.
- Existing formatting failures were normalized with Prettier without changing the affected files' behavior. Removed one unused test import that blocked the root TypeScript check.
- Final mobile browser inspection found the English scroll hint overlapping the intro. The hint now anchors to the Scene bottom instead of applying a width-scaled offset from its center; the existing animation timing is unchanged.

## Verification Evidence

Development runtime for the complete static gate: Node 22.22.1.

- `pnpm verify:framework:static`: PASS, 118 suites / 1581 tests; statements 95.18%, branches 90.51%, functions 95.49%, lines 96.58%. Includes formatting, framework/example types, lint, example tests, duplicate threshold, build verification, and failure injection.
- After the final presentation-only filter for unsampled chart entries, dev tests (11), local lint/format, and final `pnpm build:verify` (17/17) pass.
- `pnpm type-check`, `pnpm type-check:site`, `pnpm test:site-contracts` (11 suites / 63 tests), `pnpm docs:style:static`, and `pnpm --dir site build`: PASS.
- `pnpm --dir examples/performance-test acceptance:browser`: PASS for drag and vertical scroll. `pnpm verify:browser-failure-injection`: all eight injected failures are rejected.
- Horizontal browser route: actual Vite URL `http://127.0.0.1:4010/__acceptance/horizontal-scroll`. Three configurations pass: desktop content, mobile content, and desktop screen sizing with a narrow zone. Covers forward/reverse large wheel input, touch, keyboard, native scrolling, thumb dragging, fixed layers, four concurrent animations, intrinsic/percentage sizing, and resize. A 1200ms zone remains 1200px. See `output/playwright/horizontal-scroll/report.json` and `scripts/horizontal-scroll-acceptance.mjs`.
- Production performance preview: `http://127.0.0.1:4020/`. Lifecycle and layout evidence is saved in `output/playwright/2026-09-05-performance/results.json`; final build rerun is recorded there.
- Consolidated command logs: `output/playwright/resumed-bugfix/`. Desktop/mobile homepage screenshots use the real title-entry completion condition; the initial empty screenshot was taken before the inner title animations finished, not a runtime failure.
- Final Hero layout check after the hint correction: English/Chinese at 1440×900 and 390×844 all pass. The hint clears both intro and CTA, stays inside the viewport, and causes no horizontal overflow or page errors. Final screenshots and rectangles: `output/playwright/resumed-bugfix/home-hint-layout.json`. Site types, final site build, and formatting also pass after this site-only correction.

The full nine-scene visual rebuild and asset generation remain deferred by the user's latest priority. Canvas rendering and generated image crops are therefore not claimed as accepted in this bug-fix pass. The pre-existing truncated `DESIGN.md` remains unchanged in this resumed pass; current source, public types, and AGENTS.md govern the implemented fixes. Existing Vite configuration/chunk-size warnings remain visible; no size limits were relaxed.
