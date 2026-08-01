# Task Flow - Animation framework remediation (2026-08-01)

## Objective

- Preserve the current rendered appearance and code in a recoverable baseline commit before changing animation ownership.
- Remove every active site-owned animation path that bypasses CineView's `Animate`, `AnimateVideo`, `infiniteAnimation`, or phase-gated canvas contract.
- Preserve layout, typography, framing, timing intent, and scene composition while changing ownership.
- Verify drag and scroll behavior in real Chromium on desktop and mobile, with implementation and acceptance performed by separate agents.

## Baseline Evidence

- [x] B1 - Record the current worktree and exclude one-off probe artifacts from the baseline commit.
- [x] B2 - Capture current `/` and `/drag` desktop/mobile screenshots, including all five drag acts.
- [x] B3 - Commit the current product source, assets, tests, task records, acceptance script, and visual baseline.

## Remediation Nodes

- [ ] R1 - Replace Act 1 ambient Framer Motion/CSS loops/ungated canvas and drag-direction CSS transitions with framework-owned lanes or phase-gated canvas output.
- [ ] R2 - Replace Act 3 site-owned video seeking/transport animation with `AnimateVideo` while preserving V1/media timing, subtitles, fullscreen crop, and blur/fade transitions.
- [ ] R3 - Move Act 4 timecode opacity and eclipse limb opacity/scale into framework-owned animation lanes; retain only unsupported text/SVG rendering as MotionValue consumers.
- [ ] R4 - Replace home background, Hero, Capability, Demo subtitle, and DragPhone framework-bypass animations without changing layout or visual hierarchy.
- [ ] R5 - Remove dead animation writers/hooks and scan the full site for remaining direct motion imports, CSS keyframes, ungated rAF, per-frame React state, and manual supported-property writes.

## Verification Nodes

- [ ] V1 - After each remediation node, re-read changed owners for unique writers, dead code, file growth, and per-frame cost.
- [ ] V2 - Run formatting, site/framework type checks, focused contracts, full tests, lint, and production build.
- [ ] V3 - Compare post-fix desktop/mobile screenshots against the committed visual baseline for layout displacement, crop changes, missing effects, and timing regressions.
- [ ] V4 - Independent agent validates complete `/drag` and `/` scroll paths in real Chromium, including reverse/re-entry and concurrent animation smoothness.
- [ ] V5 - Resolve all findings, repeat static and browser verification, and record authoritative evidence below.

## Evidence Log

- Baseline capture: `scripts/capture-animation-snapshots.mjs --label baseline --port 3000` produced 20 viewport screenshots and `report.json` under `output/playwright/animation-baseline`.
- Baseline browser evidence: all five `/drag` scenes settled at `top=0` on 1440x900 and 390x844; all five `/` scroll scenes were advanced with real wheel input to their center-lock segment ends.
- Baseline runtime evidence: 0 console warnings/errors and 0 page errors across both routes and viewports.
- Baseline visual review: `contact-drag.png` and `contact-home.png` show the expected five distinct scenes on desktop and mobile; no blank or misidentified capture remains.
- Baseline commit completed after site type-check, diff check, pre-commit ESLint/Prettier, and 32 focused contract tests passed.
