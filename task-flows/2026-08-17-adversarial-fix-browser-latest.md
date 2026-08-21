# 2026-08-17 Adversarial Fix Latest Independent Validation

## Scope and rules

- Role: independent validation agent; this lane made no production-code edits.
- Specification read before execution: `DESIGN.md`, `AGENTS.md`, `AGENT_SELF_REVIEW.md`, and the Playwright browser skill.
- Browser verdicts below come only from real Chromium runs. Unit/type/build success is not used as browser evidence.
- Actual authored site routes are `http://localhost:4000/` and `http://localhost:4000/drag`; the historical `/#/scroll` and `/#/drag` hashes are not current site routes. The dedicated fixture uses `/#/acceptance/scroll` and `/#/acceptance/drag` on port 4318.

## Nodes

- [x] N1. Capture environment/worktree evidence and discover actual site/browser commands.
- [x] N2. Run focused scroll/drag/media/site tests and record the result.
- [x] N3. Run type checks, lint, and build verification.
- [x] N4. Run the complete Jest suite in-band.
- [x] N5. Execute the independent real-browser core matrix and actual-site five-act path; save screenshots, DOM, and performance evidence.
- [x] N6. Re-read the validation scope, classify every obtained or missing browser result, and issue the final verdict.

## Environment

- Branch at validation start: `codex/drag-release-dual-gate`; HEAD `4660d96`.
- Runtime: Node `v21.7.3`, pnpm `10.22.0`, npx `10.5.0`.
- Browser: Playwright Chromium 1228, using `Google Chrome for Testing` explicitly.
- Viewport: `390x844`.
- Worktree was already heavily dirty. All pre-existing production changes were preserved.
- Starting the acceptance preview inside the sandbox first failed with `listen EPERM 127.0.0.1:4318`; the same preview was then started in the approved external browser lane and became reachable. This was a resolved environment setup issue, not a product result.

## Automated gates

| Command | Classification | Result |
| --- | --- | --- |
| Focused Jest selection covering framework scroll/drag, Animate/AnimateVideo, media ownership/rendering, hot path, and site timer sequencing | PASS | 29 suites, 519 tests passed, 0 snapshots; exit 0; 25.742 s |
| `pnpm type-check` | PASS | exit 0 |
| `pnpm type-check:site` | PASS | exit 0 |
| `pnpm lint` | PASS | exit 0; no warnings or errors |
| `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify` | PASS | 14/14 checks; ESM gzip 43.53 KB, full UMD 51.81 KB, drag UMD 41.93 KB, scroll UMD 46.15 KB |
| `pnpm test --runInBand` | PASS | 116 suites, 1541 tests passed, 0 snapshots; exit 0; 51.825 s |

The build emitted only non-failing Vite CJS/API Extractor version diagnostics. Jest emitted only the existing Node `punycode` deprecation warning.

## Core browser acceptance

The acceptance preview was already running at `http://127.0.0.1:4318`. The independent lane ran:

```text
CINEVIEW_ACC_SKIP_BUILD=1 \
CINEVIEW_ACC_PREVIEW_CMD=true \
CINEVIEW_CHROME_PATH='<Chrome for Testing>' \
pnpm --dir examples/performance-test acceptance:scroll
```

Classification: **PASS**.

- Forward center-lock completed `0 -> 100%` and released.
- Large forward flick was forced through an interior frame at `scrollTop + 1`, progress `0.000833333...`; it did not skip the zone.
- Keyboard, touch, native-scroll reconciliation, and scrollbar forward/backward paths passed.
- Reverse endpoint was forced through the interior before `100% -> 0%`.
- Multiple zones replayed in reverse document order; final zone A and B progress were both `0`.
- Console errors: 0; page errors: 0; acceptance Long Tasks: 0.

Drag ran against the same preview port:

```text
ACC_PORT=4318 \
CINEVIEW_ACC_SKIP_BUILD=1 \
CINEVIEW_ACC_PREVIEW_CMD=true \
CINEVIEW_CHROME_PATH='<Chrome for Testing>' \
pnpm --dir examples/performance-test acceptance:drag
```

Classification: **PASS**.

- Candidate tap did not acquire drag ownership.
- Pointer cancel emitted exactly one cancel.
- Candidate tap froze and resumed an in-flight bounce.
- Rush re-grab held both the page offset and video time at the baseline, then resumed without teleport.
- Forward commit emitted exactly once.
- Blocked direction did not acquire ownership or add a commit.
- Representative counters: after cancel `starts=1 cancels=1 commits=0`; after commit `current=1 starts=3 cancels=2 commits=1`; after blocked input `blocked=1 commits=1`.
- Console errors: 0; page errors: 0.

The evidence collector (`node /private/tmp/cineview-browser-evidence.mjs`) also completed with `status: PASS`. Its scroll and drag captures had no console/page errors or Long Tasks, with ordinary rAF intervals near 16.6 ms.

Core artifact: `output/playwright/2026-08-17-adversarial-fix/report.json`, mtime **2026-08-17T05:20:31+0800**. Matching PNG/DOM captures cover initial scroll, forward-flick interior, keyboard, reverse-flick interior, drag initial, pointer cancel, and forward commit.

## Actual site evidence

Basic route probe:

```text
node /private/tmp/cineview-site-probe.mjs
```

Classification: **PASS for route/render smoke only**. Both `/` and `/drag` loaded with zero console/page errors; `/` exposed the real 33,000 px CineView scroll container and `/drag` rendered the drag experience. Its startup Long Tasks (137 ms and 196 ms) were not treated as interaction-performance verdicts because the samples included cold load.

Five-act real-site probe:

```text
node /private/tmp/cineview-site-five-act.mjs
```

Functional classification: **PASS**. Real CDP touch gestures produced the exact scene sequence:

```text
0 -> 1 -> 2 -> 3 -> 4 -> 3
```

This proves all five authored acts can be advanced in order and the final transition can be reversed to act 4. There were zero console errors and zero page errors.

Performance classification: **FAIL**. The probe waited for cold readiness, then explicitly cleared both Long Task and frame samples before the first gesture. The interaction window subsequently captured:

- forward scene 1: one **53 ms** Long Task; maximum rAF gap 33.3 ms;
- forward scene 2 onward: a second **131 ms** Long Task;
- maximum post-reset rAF gap: **283.2 ms**;
- final cumulative sample: 11 intervals over 32 ms and 7 intervals over 50 ms.

The failure is therefore a reproduced warm interaction counterexample, not the earlier cold-start sample. The script's own `status: PASS` evaluates only the scene-index sequence; it does not apply a performance threshold, so it cannot override this independent performance `FAIL`.

Performance artifact: `output/playwright/2026-08-17-adversarial-fix/site-five-act-report.json`, mtime **2026-08-17T05:33:52+0800**. Visual evidence:

- `site-drag-scene-5.png`, mtime `2026-08-17T05:33:51+0800`;
- `site-drag-reverse-scene-4.png`, mtime `2026-08-17T05:33:52+0800`;
- matching `.html` snapshots at the same output directory.

## Explicit evidence gaps

The following site-specific adversarial cases were not executed before the validation cutoff. They are classified **BLOCKED** for this browser lane and must not be read as PASS:

- BackgroundRibbon listener reattachment after an SPA CineView-container replacement;
- Scene5 offscreen freeze versus late `cineview-embed-finished` race;
- keyboard focus reaching collapsed Scene5 CTA links;
- `cineview-embed-unfinished` arriving during the CSS transform entrance;
- initial and dynamically toggled `prefers-reduced-motion` behavior across the complete site.

No claim about these cases is inferred from source inspection, Jest, type-check, or the successful core fixtures.

## Final verdict

**FAIL**.

The framework's dedicated scroll and drag acceptance matrices pass, all automated gates pass, and the actual `/drag` five-act forward/reverse functional path passes. Release-level acceptance still fails because the warm real-site gesture run reproduced a 131 ms Long Task and a 283.2 ms rAF gap. The unexecuted site-specific cases remain explicit `BLOCKED` evidence gaps; they do not dilute or replace the reproduced performance failure.
