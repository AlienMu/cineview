# Homepage acceptance continuation

## Scope recovered from the latest task

The latest project task is `你好` (`01a0753e-74cd-79f3-b7a3-22c869533a6a`). Its last implementation pass corrected scene 5's early chapter selection, but browser execution was interrupted by account concurrency limits. Scene 4's Canvas visibility correction and the complete V8.3 homepage browser pass were also unverified at recovery. All homepage browser nodes are now complete.

Current scope follows the approved seven-scene homepage, the scene 4 extensibility copy and two-color particle letterforms, and the existing scene 3/5 layout. Earlier nine-scene and photographic proposals are superseded. Local browser acceptance was explicitly authorized in the recovered project conversation. Existing unrelated working-tree modifications and deletions are preserved.

`AGENTS.md`, the current `DESIGN.md`, and the relevant TypeScript source were read before this pass. The existing `DESIGN.md` ends after its overview; public types and current implementation supply the detailed runtime contract.

## Nodes

- [x] Recover the latest project conversation and reconcile outstanding work with current files.
- [x] Reproduce scene 4 Canvas drawing and scene 5 chapter selection in the actual local site.
- [x] Correct the reproduced observer-edge defects with focused regression coverage.
- [x] Verify desktop/mobile and English/Chinese screenshots, Canvas stops/terminal/reverse drawing, reading synchronization, resize, and large input deltas.
- [x] Verify keyboard, wheel, scrollbar, fixed layers, concurrent animations, reduced motion, debug-panel dragging/localization, and the retained `/drag` appearance.
- [x] Run applicable static checks and update the current task-flow and review evidence.

## Initial evidence

- Scene 5 currently observes a one-pixel reading band and uses CSS sticky. Its `Scene` has no `scroll` configuration.
- Scene 4 currently sizes its Animate host explicitly and roots its visibility observer in the CineView scroll container. Actual drawing still requires browser verification.
- The original `output/playwright/v8-3-reading/acceptance.mjs` recorded Canvas pixels without asserting that they were nonzero. This pass adds explicit pixel, visibility, progress, fallback, and viewport-resize assertions.
- A local Node service is listening on `127.0.0.1:4010`; its project identity and browser reachability will be checked before reuse.

## Observer edge regression

Both observers discarded zero-area intersections even though they use the default threshold of zero. An element can first meet the observed boundary with `isIntersecting: true` and zero area. Increasing overlap does not require another threshold crossing, so ignoring that first entry can leave Canvas drawing disabled or scene 5 on an earlier chapter.

- Focused tests reproduced both failures before the correction: Canvas never became ready, and an entering scene 5 chapter retained `combine` instead of `sequence`.
- The correction accepts `isIntersecting` at boundary contact. It keeps the one-pixel reading band, pauses Canvas when it leaves the viewport, and does not add scroll listeners, per-frame React state, or a second progress writer.
- This is a deterministic observer-callback regression, not a substitute for the outstanding real-browser layout and rendering check.

## Initial browser environment (resolved)

The command-line Chrome launch and the restricted in-app browser selection were both rejected before execution. Automatic approval returned HTTP 404 because the configured service does not support `codex-auto-review`. The local service is not accessible from the shell sandbox. No new browser pass or screenshot is claimed. Online UI Skills discovery met the same approval error; the installed motion-performance guide was read locally instead.

## Verification results

Executed with Node 22.22.1:

- `pnpm test:site-contracts`: PASS, 15 suites / 75 tests. The observer-edge regressions failed on the previous conditions and pass after correction. Coverage includes drawing on re-entry, stopping offscreen, subscription cleanup, reverse chapter selection, and the existing early-switch case.
- `pnpm type-check`: PASS. The complete source check also found an incorrect pre-existing type import in `homeComposition.test.tsx`; its path and the matching new test import now resolve to `src/types`.
- `pnpm type-check:framework`, `pnpm type-check:site`, and `pnpm lint`: PASS.
- `pnpm --dir site build`: PASS after the runtime correction. The existing large-chunk warning remains.
- Prettier on the four changed source/test files: PASS.
- `node --check output/playwright/v8-3-reading/acceptance.mjs` and `node --check output/playwright/v8-2-home/acceptance.mjs`: PASS. This checks syntax only; neither browser script ran in this pass.

The comprehensive browser script now places chapters above the current reading line, replacing its outdated 44%-viewport target with 20%. It retains Canvas text stops, terminal/reverse hashes, wheel/keyboard/scrollbar input, debug-panel dragging, reduced motion, and `/drag` theme checks. The reading script retains the early-switch case, reverse movement, native scrolling, and screenshots, and now rejects empty/fallback Canvas output and checks resizing across the mobile breakpoint.

## Current completion

The approval blocker was resolved and the local Vite service was restored at its printed `http://127.0.0.1:4010/` address after the previous process exited. The independent homepage review passed all four language/viewport configurations and all 72 supplemental behavior assertions. See `output/playwright/2026-09-08-home-independent/REPORT.md` and `completion.json` for current evidence. The expanded README and `/docs` work continues in `2026-09-08-readme-and-docs-redesign.md`.

## Browser continuation after access was restored

The next goal turn runs with browser access available. The existing Vite process (PID 36520, site Vite entry, `--host 127.0.0.1 --port 4010 --strictPort`) and the served CineView HTML were verified before reuse.

- [x] Run the reading/Canvas browser script for 1440×900 and 390×844 in English and Chinese. All four configurations pass native forward/reverse selection, early-switch, jumps, breakpoint resize, nonempty Canvas drawing, and no page errors. Evidence: `output/playwright/v8-3-reading/report.json` and screenshots.
- [x] Verify and correct the mobile sticky composition's overlap with the fixed debug toggle. At `top: 0`, the sequence title stayed at `translateY(100%) rotate(3deg)` because it met both native enter and exit gates. Moving only the sticky offset to 80px in the browser completed both title transforms. The source now retains its existing 5rem desktop offset on mobile, and the reading line includes that offset. A failing-before/passing-after resize regression covers the reading-line calculation.
- [x] Repeat the affected browser checks with explicit title-transform and control-overlap assertions.
- [x] Diagnose the last desktop chapter: the taller sticky illustration moved to top=-26px while the third chapter was still at the reading line. A browser-only padding experiment moved it back to top=80px and completed both title transforms. The source now reserves the measured difference between the illustration bottom and reading line, calculated only during setup/resize. The mobile sequence note also receives its own text space above the color panel.
- [x] Correct the independent review's mobile scene 3 finding: auto inline margins and only absolutely positioned children collapsed the illustration to 0×0. Setting the existing mobile figure to width:100% restored its 342×256.5 layout and all four visible layers in the reviewer's browser experiment.
- [x] Complete the comprehensive Canvas/input/debug/reduced-motion/drag pass. Desktop English and Chinese passed initially. Mobile exposed a test sampling problem: rounding a fractional native scroll position sampled progress 0.799900 instead of the requested 0.8, so its final progress marker differed. The script now samples the first whole scroll pixel inside each requested stage and retains the pixel-equality assertion.

## Independent acceptance result

Five independent browser commands exited 0. Tests verified actual concurrent scene 3 motion, scene 5 dependency/stagger/loop timing, real scrollbar dragging, large input deltas, keyboard boundary handling, fixed-layer clipping, reduced motion, and the retained drag entry appearance. Both English and Chinese mobile illustration layouts measure 342×256.5 after the width correction.

Strict Canvas reverse equality was verified with native screenshots and with pixels read from an offscreen copy. Repeated direct reads of the displayed canvas caused Chrome to switch raster backends; controlled checks proved this was measurement interference rather than a drawing defect. Production drawing stayed unchanged. Final harnesses retain exact pixel assertions and wait for DOM/font readiness instead of ongoing network inactivity.
