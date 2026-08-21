# 2026-08-17 Adversarial Fix Independent Validation (Final)

## Scope and independence

- Role: independent validation/acceptance agent; no production-code edits in this lane.
- Specification read before execution: `DESIGN.md`, `AGENTS.md`, `AGENT_SELF_REVIEW.md`.
- Worktree is shared and intentionally dirty; pre-existing user changes are preserved.
- Required checks: focused scroll/drag/media tests, `pnpm type-check`, `pnpm type-check:site`, `pnpm lint`, `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify`, and full `pnpm test --runInBand`.
- Required browser lane: real browser coverage for scroll/drag forward and reverse, cancel/re-grab, large-flick skip prevention, keyboard, scrollbar, concurrent animation performance, screenshots/DOM/PerformanceObserver evidence.

## Nodes

- [x] N1. Capture immutable environment/worktree evidence and discover actual site/browser commands.
- [x] N2. Run focused scroll/drag/media tests and record exact output.
- [x] N3. Run type checks, lint, and build verification; record exact output.
- [x] N4. Run complete Jest suite in-band; record exact output.
- [ ] N5. Start site/acceptance lane and execute real-browser interaction matrix with screenshots, DOM snapshots, and PerformanceObserver.
- [ ] N6. Re-read changed validation scope, classify every check as PASS/FAIL/BLOCKED, and report to parent.

## Evidence log

Results are appended as each node closes. No production source file is changed by this validation lane.

### N1 evidence (2026-08-17)

- Branch: `codex/drag-release-dual-gate`; HEAD `4660d96` (`feat: Animate 手动控制 + FOUC 修复；五幕视觉缺陷真机定位与整改`).
- Worktree was already dirty (47 tracked paths modified plus 26 untracked paths before this report); those changes were preserved.
- Runtime: Node `v21.7.3`, pnpm `10.22.0`, npx `10.5.0`.
- Site Vite config uses port `4000`; only an external `node` listener on `[::1]:4000` was observed. No local `chromium`, `chromium-browser`, `google-chrome`, or global `playwright` executable was found.
- Acceptance harnesses discovered in `examples/performance-test`: scroll `4318`, drag `4317`, routes `/#/acceptance/scroll` and `/#/acceptance/drag`; authored site routes remain `/#/scroll` and `/#/drag`.

### N2 evidence (2026-08-17)

Command:

```text
pnpm test --runInBand \
  src/components/CineView/DirectScrollCineView.test.tsx ... \
  src/components/Animate/useAnimateScroll.hotpath.test.tsx \
  src/components/Animate/useAnimateDrag*.test.* \
  src/components/Animate/AnimateVideo*.test.tsx \
  src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts \
  src/__tests__/site/lastWinsTimerSequence.test.ts
```

Result: **29 suites passed, 519 tests passed, 0 snapshots; exit 0** (Jest reported `Time: 25.742 s`).

### N3 evidence (2026-08-17)

| Command | Result |
| --- | --- |
| `pnpm type-check` | PASS, exit 0 |
| `pnpm type-check:site` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0; no warnings/errors emitted |
| `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify` | PASS, exit 0; 14/14 checks |

Build verifier sizes: ESM gzip `43.53 KB` (< 50 KB), full UMD gzip `51.81 KB` (<= 55 KB), drag UMD gzip `41.93 KB` (<= 50 KB), scroll UMD gzip `46.15 KB` (<= 50 KB). Non-failing diagnostics were Vite's CJS Node API deprecation and API Extractor noting bundled TS 5.4.2 versus project TS 5.9.3.

### N4 evidence (2026-08-17)

Command: `pnpm test --runInBand`

Result: **116 suites passed, 1541 tests passed, 0 snapshots; exit 0** (`Time: 51.825 s`). Jest emitted only the existing Node `punycode` deprecation warning.
