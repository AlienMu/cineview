# CineView Prop Composition Audit

## Goal

Audit meaningful public-prop combinations across every exported component, add regression tests for
the intended composition semantics, and fix conflicts where individually valid props become incorrect,
ambiguous, silently ignored, or inconsistent between drag, scroll takeover, and visibility drivers.

This is a semantic interaction audit, not a Cartesian-product test generator. Combinations are selected
where props share ownership of timing, layout, resource priority, input handling, callbacks, rendering,
or accessibility.

## Invariants

- `DESIGN.md` remains the authoritative behavior specification.
- One prop must not silently disable another valid public prop. Unsupported combinations must be rejected
  by types or produce a deterministic development diagnostic.
- The same authoring intent must resolve consistently across drag, scroll takeover, and visibility unless
  the mode difference is explicitly documented.
- Timeline completion must match visual completion. A downstream `waitFor` cannot start before the final
  visible child of its dependency completes.
- Hot-path changes must retain single ownership and avoid per-frame React state or repeated layout reads.
- Every fixed node closes with focused tests, code reread, residue search, and then broader verification.

## Composition Matrix

### Animate (P0/P1)

- [x] `waitFor + delay + duration`: dependency completion, own delay, cycle/missing target diagnostics.
- [x] `waitFor + stagger + duration`: group starts after dependency; final child completion owns the
      effective group duration; downstream `waitFor` starts after the stagger tail.
- [x] `stagger + from + dynamic child count`: first/last/center ordering and rerendered child counts.
- [x] `stagger + custom transition`: authored item transition is preserved and effective duration is
      deterministic.
- [x] `stagger + exitAnimation + replayOnReenter`: exit and reverse/replay do not silently bypass children.
- [x] `stagger + render-prop / infiniteAnimation`: either compose deliberately or reject explicitly; no
      silent prop loss.
- [x] `timeline.sceneControlled + phase + waitFor/stagger`: visibility and takeover use coherent start and
      completion boundaries.
- [x] grouped props + legacy compatibility props: grouped fields win deterministically without duplicate
      registration or timing.

### CineView / Scene (P1)

- [x] `mode + modes + scrollbar + callbacks + ref`: mode-specific behavior, callback cardinality, ref
      freshness, keyboard/scrollbar parity.
- [x] `performance.monitor + callbacks + navigation`: monitoring does not alter navigation or duplicate
      callbacks.
- [x] `Scene.scroll + layout + stack + transition`: takeover budget and scene footprint remain independent
      from overlay/fixed scaffolding.
- [x] `Scene.assets + first-scene readiness + dynamic scenes`: priority/background ordering and ready-once
      behavior remain deterministic.
- [x] `Scene.callbacks + visibility + scroll takeover`: callback payloads and cardinality match the active
      owner without per-frame duplicate React work.

### Position / Container (P1/P2)

- [x] `Position.at + layer.fixed + style/className`: coordinates, authored transforms, fixed ownership, and
      style precedence compose without transform loss.
- [x] `Position fixed + Scene stack/overflow`: fixed layers stay scene-scoped and correctly clipped.
- [x] `Container width/height + style lengths + responsive scale`: all supported lengths use the single
      width ruler while percentages and non-length values remain intact.
- [x] nested `Container + Position`: size conversion does not become a second coordinate owner.

### Image / AnimateVideo (P1/P2)

- [x] `Image preload + loading + src/srcSet/style`: priority intent, native loading, registration, and
      forwarded media props do not conflict.
- [x] first-scene and later-scene media combinations: only current critical media gates readiness; later
      media remains background/lazy.
- [x] `AnimateVideo timeline + duration + waitFor`: scrub registration, readiness, reverse seek, and
      downstream timing remain aligned.
- [x] media error/load callbacks + preload cache: `Image` native callbacks remain single-fire; AnimateVideo
      intentionally keeps a minimal non-native callback surface, while preload cache fetches are deduplicated.

## Execution Nodes

- [x] **0.1 Read specification and create the composition matrix.**
- [x] **1.1 Add focused failing tests for Animate composition semantics.**
- [x] **1.2 Fix Animate effective duration and unsupported-combination behavior.**
- [x] **1.3 Verify Animate in drag, visibility, and scroll takeover drivers.**
- [x] **2.1 Audit and test CineView/Scene prop composition.**
- [x] **2.2 Fix discovered root/scene composition defects.**
- [x] **3.1 Audit and test Position/Container prop composition.**
- [x] **3.2 Audit and test Image/AnimateVideo prop composition.**
- [x] **4.1 Run focused suites after every component slice.**
- [x] **4.2 Run `pnpm verify` and `pnpm --dir site build`.**
- [ ] **4.3 Independent browser acceptance for drag/scroll composition fixtures.**
- [x] **5.1 Publish supported combinations, explicit exclusions, and remaining risks.**

## Initial Confirmed Defect

- `stagger.each` is currently applied as a wall-clock delay to direct children after the Animate gate opens,
  while animation registry and zone budget only record `duration.enter`. The stagger tail is not derived,
  `duration.enter` is not injected as the child transition duration, and a downstream `waitFor` can begin
  before the final child visually completes. The site Hero manually computes `typingMs`, proving the public
  API currently leaks internal timeline arithmetic to consumers.

## Verification Record

- Focused Animate composition: 151/151 passed before broader integration; media facade/renderer and
  stagger integration: 143/143 passed.
- Focused Position/Container/Image: 63/63 passed.
- Focused CineView/Scene composition: 246/246 passed.
- `pnpm verify`: 87/87 suites, 1210/1210 tests; coverage 96.05% statements, 90.45% branches,
  95.90% functions, 96.29% lines; example tests 22/22; duplication 1.69%; build verify 12/12;
  ESM gzip 46.50 KB, UMD gzip 39.48 KB; all four failure-injection gates passed; lint 0 warnings.
- `pnpm --dir site type-check` and `pnpm --dir site build`: passed, 422 modules transformed.
- Implementer Playwright smoke: desktop Hero rendered all 80 stagger items; `/video.mp4` first requested
  about 385ms after navigation; desktop forward/reverse traversal returned near the root; mobile-sized
  programmatic forward/reverse remained responsive; final console warning/error/pageerror sample was zero.
- Independent browser acceptance: the first lane stalled and was terminated; the replacement lane only
  confirmed the `1280x720` page loaded and the final Hero/CTA state rendered. It did not complete timing,
  network, reverse traversal, mobile, or console checks. Node 4.3 therefore remains open and is not
  represented as an acceptance pass.
