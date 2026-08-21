# 2026-08-18 Independent Adversarial Browser Review

## Scope And Independence

- Independent browser verification only; no prior review/browser reports are consulted.
- Production source is read-only for this lane.
- Writable artifacts are limited to `output/playwright/2026-08-18-adversarial-review-browser/`
  and this task-flow report.
- Final status must be exactly one of `PASS`, `FAIL`, or `BLOCKED`, backed by raw evidence.

## Nodes

- [x] N1 Read `DESIGN.md`, `CLAUDE.md`, `AGENTS.md`, `AGENT_SELF_REVIEW.md`, browser
  automation skill, Playwright skill, and browser skill `tool-index.md`; check actual tool paths.
- [x] N2 Inspect the current site routes and DOM/test hooks needed to exercise the requested paths,
  without reading historical review artifacts.
- [x] N3 Run focused tests, `pnpm type-check`, `pnpm lint`, and `pnpm build:verify` serially while
  no site server is running; record commands, exit codes, timestamps, and dist provenance.
- [ ] N4 BLOCKED: Start a fresh site Vite server on an independent port; record command, URL, PID,
  and log. Sandbox returned `EPERM`; escalation reviewer returned 503 and rejected the request.
- [ ] N5 BLOCKED: Launch a fresh Chromium context and install independent console, page-error, long-task,
  request-failure, rAF-gap, DOM/progress, and screenshot probes.
- [ ] N6 Verify drag paths: forward, backward, cancel, re-grab, huge flick anti-skip, keyboard,
  scrollbar, and concurrent multi-element animation performance.
- [ ] N7 Verify scroll paths: forward/reverse re-entry, cancel/re-grab where exposed, huge flick
  anti-skip, keyboard, scrollbar, multi-zone reverse order, and concurrent animation performance.
- [ ] N8 Verify Scene5 finished/unfinished, offscreen, focus, cancel/reopen, and four-beat replay.
- [ ] N9 Verify AnimateVideo source swap, release/warmUp, ended/re-entry/public callback behavior.
- [ ] N10 Verify BackgroundRibbon same-pathname container replacement and route-leave cleanup.
- [ ] N11 Verify dynamic `prefers-reduced-motion` behavior.
- [x] N12 Run the full test suite if time permits, aggregate raw JSON/screenshots/trace, review console
  and performance evidence, stop browser/server, and write the final PASS/FAIL/BLOCKED report.

## Tool Availability

- `npx`: available at `/Users/alienmu/.nvm/versions/node/v21.7.3/bin/npx`.
- Browser skill tool index: `agent-browser` unavailable; `npx` available.
- Playwright wrapper exists at
  `/Users/alienmu/.codex/skills/playwright/scripts/playwright_cli.sh` but is not executable; it can
  be invoked through `bash` if its package bootstrap succeeds.
- Repository-local `pnpm exec playwright`: unavailable at initial check.

## Command Log

- `pnpm test:site-contracts` -> exit 0; 10 suites, 52 tests passed.
- `pnpm test -- --runInBand <six focused files>` -> exit 0; 6 suites, 165 tests passed
  (DirectScrollCineView, ScrollbarOverlay, AnimateVideo plumbing, VideoFrameRenderer,
  videoPlaybackOwnership, useAnimateScroll hot path).
- `pnpm type-check` -> exit 0.
- `pnpm lint` -> exit 0.
- `pnpm build:verify` -> exit 1 after rebuilding dist; 13/14 verification checks passed, packed
  tarball consumer was blocked by root-owned files in `/Users/alienmu/.npm/_cacache`.
- `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify` -> exit 0;
  14/14 checks passed. No Vite server was running during either build.
- `pnpm exec jest --runInBand` -> exit 0; 120 suites, 1575 tests passed in 51.547s.

Browser start blocker (no browser assertions were made):

- `BROWSER=none pnpm --dir site dev --host 127.0.0.1 --port 41793 --strictPort` -> exit 1,
  `Error: listen EPERM: operation not permitted 127.0.0.1:41793` in the default sandbox.
- The same exact command with `sandbox_permissions=require_escalated` was rejected because the
  automatic approval reviewer returned `503 Service Unavailable`; policy forbids a workaround or
  reuse of an existing server/context. Raw blocker evidence:
  `output/playwright/2026-08-18-adversarial-review-browser/environment-blocker.json`.
- Raw static/build/test summary:
  `output/playwright/2026-08-18-adversarial-review-browser/static-checks.json`.

Dist provenance after the successful rebuild (`2026-08-18T17:54:18-19+0800`):

- `dist/cineview.es.mjs` SHA-256
  `97f1a59b3f0f5b0b3ab69d206bfe3664211876d972571973adc37c5ba5749b8f`
- `dist/cineview.umd.js` SHA-256
  `73d7726e976d69be33bdcbde2f48086ec85d8050c60632ae21fbdb2a5e32b111`
- `dist/cineview-drag.umd.js` SHA-256
  `b92074a74421588cea75d4556aff3d3d7cf66436d1c7b4b7ee2702c943bc425e`
- `dist/cineview-scroll.umd.js` SHA-256
  `34128b38a3adcf51b1676e99fa943b4b01a36e53ee6f16f65e63b245ee5fedca`
- `dist/index.d.ts` SHA-256
  `9a0558324b334182538fffb4902cb9467b3daf044f4f93593963ba93e700d20e`

## Browser Evidence

None. Fresh server and Chromium context were not created; therefore no drag/scroll/Scene5/
AnimateVideo/BackgroundRibbon/reduced-motion/performance scenario is claimed as PASS or FAIL.

## Findings

- Environment blocker: real-browser lane could not start due to local bind EPERM plus unavailable
  escalation approval service. This is not a product finding.

## Final Status

BLOCKED
