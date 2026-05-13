# Task: Code Migration Execution Round

## Goal

- Execute the current interface migration in code, starting from the latest documented rules in `design.md` and `requirements.md`.
- Use this file as the source of truth for this execution round rather than relying only on the longer migration program file.
- Continue automatically through unchecked executable nodes unless blocked.

## Linked Program

- Parent migration program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`

## Nodes

- [x] Re-read `AGENTS.md`
- [x] Re-read `design.md`
- [x] Re-read `requirements.md`
- [x] Re-read `AGENT_SELF_REVIEW.md`
- [x] Verify current migration phase and prior code changes
- [x] Complete Phase 2 additive type bridge and export surface
- [x] Verify Phase 2 with `pnpm exec tsc --noEmit`
- [x] Verify Phase 2 with `pnpm build`
- [x] Start multi-agent execution for this round
- [x] Start real-page verification instead of build-only verification
- [x] Repair example runtime path so browser verification can run on a working page
- [x] Start Phase 3 root runtime migration in `src/components/CineView/CineView.tsx`
- [x] Add compatibility mapping from legacy root/scene mode props to root-owned mode config
- [x] Run targeted verification for `CineView` runtime changes
- [x] Sync any doc language if Phase 3 behavior changes
- [x] Start Phase 4 scene responsibility reduction in `src/components/Scene/Scene.tsx`
- [x] Continue shrinking `SceneInternalProps` breadth and mode-specific ownership
- [x] Map grouped `SceneProps` (`layout/stack/transition/assets/callbacks`) into runtime consumption
- [x] Verify scene-scoped fixed layer behavior after Phase 4 bridge changes
- [x] Verify scene visibility callbacks after Phase 4 bridge changes

## Verification

- [x] TypeScript compile passes for current tree
- [x] Package build passes
- [x] Targeted `CineView` tests pass after Phase 3 changes
- [x] Targeted grouped Scene bridge tests pass
- [x] Targeted grouped CineView asset bridge tests pass
- [x] Browser/runtime verification if runtime behavior changes

## Risks / Blockers

- Phase 4 is only partially complete; `SceneInternalProps` and scene runtime hook ownership are still broader than the target design.
- Runtime compatibility precedence between legacy `Scene.slideMode` and root `CineView.mode` must stay explicit while bridges still exist.
- Port collisions and pre-existing local listeners in this repo context can obscure whether the example itself is healthy; acceptance should keep checking the example's own runtime path, not only a borrowed server.
- `Scene.test.tsx` still contains broad historical noise outside the new grouped-prop bridge cases, so verification should stay focused on the bridge-specific tests until that suite is cleaned up.
- Acceptance findings queued for implementation:
  - fresh independent runtime acceptance is still pending against `http://127.0.0.1:3001/?test=scroll` and `?test=scroll-fixed`
  - Phase 4 still needs another shrink pass on scene-owned legacy mode/scroll tuning that remains visible in root hot paths
- Acceptance workflow note:
  - independent acceptance agents must remain active as separate code-review and runtime-check lanes
  - agent timeout / empty return does not count as acceptance
  - if an acceptance lane drops, re-establish it immediately before any completion claim

## Current Status

- This execution round is aligned with project rules and the migration program has progressed through Phase 8.
- `CineView` owns resolved mode selection, grouped root mode config, and legacy mode fallback bridging.
- Targeted verification passed: `pnpm test -- --runInBand animation-trigger`, `pnpm exec tsc --noEmit`, `pnpm build`, plus live page sanity on `http://127.0.0.1:3002`.
- Latest local verification also passed:
  - `pnpm exec jest src/components/CineView/CineView.test.tsx -t "scene wrapper" --runInBand`
  - `pnpm exec jest src/components/CineView/CineView.test.ts -t "resolveActiveViewportId" --runInBand`
- Phase 4 is in progress, but acceptance has reopened five concrete root/scroll bridge issues; implementation is now focused on those findings before any further completion claims.
- Independent acceptance lanes have been re-established and are pending fresh results on the latest code/runtime.
- Latest independent acceptance results:
  - code-review acceptance reopened four bridge/runtime issues in `CineView.tsx` / `Scene.tsx`
  - runtime acceptance confirmed `3002` is not a valid scroll acceptance page and identified remaining content-sizing / grouped-transition drift risks
- Latest implementation pass addressed:
  - root-owned scroll direction now propagates into Scene runtime direction-sensitive paths
  - `modes.scroll.sceneSizing='screen'` now applies a real main-axis minimum on scroll scene wrappers
  - `CineView.tsx` now has a DOMRect fallback helper so scroll-mode tests do not require a browser-native constructor
  - `examples/performance-test/?test=scroll-fixed` is now the live scroll acceptance surface and uses root-owned scroll mode configuration

- Latest Phase 4 shrink pass:
  - `CineView.tsx` now injects grouped internal runtime bags (`sceneRuntime`, `dragRuntime`, `scrollRuntime`) instead of a large flat prop bundle
  - `Scene.tsx` now consumes grouped runtime objects as the primary path while preserving legacy flat internal prop compatibility during migration
  - local verification passed for `pnpm exec tsc --noEmit`, `pnpm exec jest src/components/CineView/CineView.test.tsx --runInBand`, and Scene bridge-focused tests in `Scene.test.tsx`
  - full historical `Scene.test.tsx` still contains drag-event test noise and is not treated as completion evidence for this node
- Phase 5 bridge work is now partially landed under a dedicated task flow:
- Phase 5 bridge work was completed through dedicated task flows:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-scrollzone-public-bridge.md`
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase5-reverification.md`
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase5-acceptance-followup.md`
  - `ScrollZone` now exists as a public bridge component and is exported from `src/index.ts`
  - orphan `scrollDriven` warning now points to `<ScrollZone>` first while keeping legacy `<Viewport>` guidance
  - `Viewport` now emits a dev-only legacy compatibility warning
  - canonical scroll showcases now author with `ScrollZone`
  - independent re-verification plus follow-up acceptance have now closed the reopened public-surface and favicon issues
  - final Phase 5 status: accepted with residual risks limited to missing browser-console capture and missing dedicated automated tests for the follow-up-only fixes
- Phase 6 first slice is now partially landed under:
- Phase 6 first slice was completed through dedicated task flows:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-animate-semantic-migration.md`
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-timeline-phase-followup.md`
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-runtime-evidence-followup.md`
  - grouped `duration` / `timeline` / `visibility` normalization landed in `Animate.tsx`
  - `useAnimateScroll.ts` now consumes grouped `timeline.driver`, grouped phase, and grouped visibility settings
  - focused code/test acceptance and fresh real-page runtime acceptance now both pass
  - current Phase 6 status: first slice accepted; follow-up nodes are tracked in:
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-omitted-driver-default.md`
    - omitted-driver default follow-up is now independently accepted
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-drag-snap-alignment.md`
    - drag/snap hook alignment follow-up is now independently accepted
- Phase 6 is complete and accepted.
- Phase 7 dual-axis positioning is now landed and locally verified:
  - root config, context conversion, `Position`, and `Container` use dual-axis sizing
  - focused `Position`, `Container`, and `CineView` verification passed
- Phase 8 cleanup is now landed on the primary authoring path:
  - docs recommend `mode + modes.*`, `ScrollZone`, grouped `Animate.timeline`, and grouped `Position`
  - examples were rewritten back onto the final recommended API surface
  - deprecated compatibility APIs remain available, but now warn clearly as compatibility-only paths
