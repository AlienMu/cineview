# Task: Scroll Takeover Rate Model

## Goal

- Keep `Scene.scroll` as one precise waterfall model instead of stacking 03/05-specific patches.
- Make document scroll distance, takeover animation progress, and overlay scrollbar progress use the same px unit.
- Fix reverse re-entry skipping early title/body phases in completed takeover scenes.
- Preserve enough extension room for future scenes by centralizing timing in the scene scroll budget resolver.

## Findings

The user report was correct: the first visible skip was not caused by React failing to mount the takeover scene. It was caused by inconsistent progress coordinates.

There were five separate problems:

- Scroll rate mismatch: native document movement used real wheel px, but the old takeover path damped pixel wheel input through `wheelStep` / `touchStep`. This made document flow feel faster than scene animation progress.
- Phase coordinate mismatch: authored `timeline.phase` values such as `0.22`, `0.34`, `0.2`, and `0.38` were intended as ratios of the whole takeover budget. The runtime was still resolving them inside each animation's local enter-duration window.
- Completed reverse re-entry capture mismatch: after a takeover had completed and the page had continued into later document flow, backward input re-entered the completed scene at `sceneEnd`, but the runtime modeled the takeover from the center-lock anchor. For full-screen takeover scenes the anchor is effectively `sceneStart`, so the `sceneEnd -> anchor` span was folded out of the global scroll offset. The visible symptom was a large scrollbar jump even when the animation state did start reversing.
- Rendered scene span mismatch: takeover scenes are rendered through the same viewport-clamped span that the DOM actually scrolls through, but layout measurement still allowed the authored declared height to expand `sceneEnd`. In the live page, 03/05 rendered as one viewport (`837px` in the sampled browser) while the state machine still reasoned from the authored `1200px` span. This delayed reverse re-entry until after the real scene had already been passed.
- Same-wheel reverse remainder leak: after a completed takeover was captured at `sceneEnd`, the same reverse wheel could still release its remaining delta back to native document scroll. That moved `scrollTop` past the just-captured scene in the same frame, so the user saw a real document jump rather than just a missing animation frame.

For 03 / specs, that meant `phase.end = 0.22` should be `1800 * 0.22 = 396px`, but the old resolver produced about `78px` for the pill because it scaled inside the 240ms local enter segment. For 05 / scenarios, `phase.end = 0.2` should be `1400 * 0.2 = 280px`, not a local-duration fragment.

That local-window interpretation made early title/body phases too short. When reverse re-entry started from a completed takeover, the state machine could be anchored correctly while the visual timeline had already passed the authored title/body phase. The result looked like the scene jumped to the middle and skipped the expected reverse animation.

The second visible skip was lower in the state machine: a completed reverse re-entry must capture at the scene end edge, then spend only the overshoot past `sceneEnd` against `progressPx`. The native container must also lock at that capture edge while the takeover owns the waterfall. Pinning the real DOM scroll position back to the anchor folds out the page distance between `sceneEnd` and `anchor`, which is the large scroll jump the user sees.

The final root cause for the persistent live-page skip was that the `sceneEnd` used by the state machine was not the DOM's rendered scene end. For 05, the sampled real DOM scene was `4637 -> 5474`, but the takeover lock happened at `5837` (`4637 + 1200`). That is why previous fixes could be logically correct around scene-end capture yet still appear broken in the browser: they captured the wrong scene end.

The final same-wheel failure mode was confirmed by a large reverse wheel from page bottom: the runtime did capture the completed takeover, but then applied the unconsumed remainder to native scroll immediately. The fix is not scene-specific. A completed reverse re-entry capture is a frame boundary: the crossing wheel is intercepted, native stays at rendered `sceneEnd`, and later input may continue the reverse waterfall or release document flow after the takeover has actually rewound.

## Model Decision

`Scene.scroll` budget is the single waterfall timeline, expressed in px.

- Pixel wheel input maps 1:1 into takeover px.
- Line wheel input maps through a fixed line-height approximation.
- Page wheel input maps to one viewport span per page unit.
- Touch movement maps 1:1 from pointer movement into takeover px.
- Keyboard remains viewport-step based.
- Native scroll position, takeover progress, and overlay indicator are separate ledgers. Overlay may derive a visual capture offset plus consumed takeover budget for display continuity, but that derived value must not become root scroll distance or native metrics. For ordinary takeover ownership the lock offset is the anchor; for completed reverse re-entry from later document flow it is rendered `sceneEnd`.

`wheelStep` and `touchStep` remain accepted in config for compatibility, but the direct-scroll takeover path no longer uses them as hidden dampers.

## Phase Decision

For scroll takeover scenes, `timeline.phase.start/end` are ratios of the whole takeover budget.

- `phaseStartPx = totalBudgetPx * phase.start`
- `phaseEndPx = totalBudgetPx * phase.end`
- Missing phase values still fall back to the resolved delay/duration timing.
- `enterStartPx` / `enterEndPx` remain the raw duration-derived timing fields.
- `phaseStartPx` / `phaseEndPx` are the authored waterfall breakpoints consumed by Animate and DirectScroll.

For phase-authored animations with an exit animation, exit is reserved near the end of the takeover budget. This avoids short title/copy animations entering early and then disappearing immediately in the middle of the scene. It also gives reverse replay a clean path: completed state -> exit rewind -> held visible state -> authored early phase rewind.

## State-Machine Decision

The active takeover is the current waterfall owner.

- Large forward/reverse deltas stop at semantic breakpoints instead of crossing multiple authored phases in one frame.
- A completed reverse re-entry includes a near-completion edge before stepping through the authored phase stops.
- A completed takeover that is re-entered from later document flow captures at `sceneEnd`, not the anchor. The first reverse frame subtracts only the overshoot past `sceneEnd` from `totalBudgetPx`, and the real native `scrollTop` stays at the capture edge while takeover progress rewinds.
- The same input that creates a reverse `sceneEnd` capture must not also apply its leftover delta to native scroll. Capture first; native flow can continue only on a later input after the takeover boundary has been visibly re-entered.
- For takeover scenes, `sceneEnd` means the rendered DOM span used by the scroll container after viewport clamping, not the original authored design height.
- Until `progressPx` reaches 0, native document flow is not allowed to continue past that completed takeover in the reverse direction.
- If an active zone is anchored and still has budget in the input direction, it keeps priority over earlier/later crossed anchors.
- Forward replay after reverse re-entry is rearmed through the same zone marker, not scene-specific logic. Capture offsets are retained through the forward restart frame so the same scroll reconciliation pass cannot fall back to the anchor formula and restore completed progress.
- When a completed reverse replay reaches `progressPx = 0`, the capture offset may still be needed for the next zero-delta scroll reconciliation. A zone at its capture edge with zero progress must not be treated as completed again.

This keeps the implementation generic for 03/05 and future takeover scenes.

## Code Changes

- `src/components/Scene/sceneScrollBudget.ts`
  - Added `phase` to `SceneScrollAnimationRegistration`.
  - Added `phaseStartPx` / `phaseEndPx` to resolved animation budgets.
  - Resolved authored phases against the whole takeover budget.
  - Reserved phase-authored exit windows near the end of the takeover budget.

- `src/components/Animate/useAnimateScroll.ts`
  - Registers authored phase data with the scroll budget resolver.
  - Uses resolved `budget.phaseStartPx` / `budget.phaseEndPx` instead of recomputing phase locally.
  - Treats authored enter/exit animation props as explicit even before async preset parsing completes.

- `src/components/CineView/DirectScrollCineView.tsx`
  - Uses one px-based input model for wheel/touch takeover progress.
  - Uses resolved phase/exit breakpoints for waterfall stops.
  - Captures completed reverse re-entry at `sceneEnd` and keeps native `scrollTop`, takeover progress, and overlay visual state in separate ledgers driven by the same input ownership decision.
  - Measures takeover scene layout from the rendered wrapper span so reverse re-entry captures the same scene edge the user actually scrolls through.
  - Holds the same-wheel reverse remainder at a completed `sceneEnd` capture so native document flow cannot skip the just-reacquired scene.
  - Uses one boundary condition for reverse re-entry capture and progress-delta calculation, so `sceneEnd + 2px` tolerance does not accidentally spend the full wheel delta.
  - Uses one native lock offset per active zone: `captureOffset ?? anchorOffset`.
  - Keeps capture offsets alive across zero-delta reconciliation and second forward replay restart; clears them only on real release/reset/unregister paths.
  - Keeps reverse re-entry and current-owner priority generic.

## Tests Added Or Updated

- Budget resolver:
  - `phase.end = 0.2` with `budget = 1800` resolves to `360px`.
  - 03-like short title phase resolves to `396px` and keeps its exit near `1800px`.

- Animate scroll phase:
  - Phase windows now assert against shared takeover budget coordinates.
  - Replay and sibling phase tests use explicit resolved phase px fixtures.

- DirectScroll:
  - Pixel wheel input maps to takeover progress in px.
  - Large forward/reverse deltas stop inside authored phase windows.
  - Same-frame wheel bursts do not cross multiple phase stops.
  - A completed takeover re-entered from page bottom subtracts only the overshoot past `sceneEnd`; native `scrollTop` remains locked at the rendered capture edge while local `progressPx` rewinds.
  - A large reverse wheel from page bottom is intercepted before native scroll can pass a completed takeover in the same frame.
  - A takeover whose authored height is larger than its viewport-clamped rendered height captures reverse re-entry at the rendered `sceneEnd`.
  - Reverse re-entry across multiple completed takeover scenes remains covered without skipping the earlier scene.
  - Second forward replay after reverse re-entry remains covered and restarts from enter progress instead of restoring stale completed progress.

## Verification Log

- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx src/components/Scene/sceneScrollBudget.test.ts src/components/Animate/useAnimateScroll.phase.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx --runInBand --silent`
  - 4 suites / 83 tests passed.
- `pnpm --dir examples/performance-test test -- src/components/ScrollScenes.test.tsx`
  - 4 files / 20 tests passed.
- `pnpm run type-check`
  - `tsc --noEmit` passed.
- `git diff --check`
  - passed.
- In-app browser, real page at `http://localhost:3000/#/scroll`:
  - Rendered takeover spans: 03/specs `2440 -> 3277`, 05/scenarios `4637 -> 5474`.
  - After forward scrolling to bottom (`scrollTop 6960.5 / max 6961`), reverse wheel re-entered 05 at `scrollTop 5474` and held there while `scenarios-pill`, `scenarios-copy`, and `scenarios-center` progressed through visible reverse frames.
  - Continuing reverse wheel re-entered 03 at `scrollTop 3277` and held there while `specs-pill`, `specs-copy`, and `specs-media` progressed through visible reverse frames.

## Acceptance Boundary

The acceptance invariant is model-level first, with the in-app browser sequence used only as runtime evidence for the example page. The required path starts after the takeover animation has fully completed: finish 03/05, continue into later document flow or the page bottom, then reverse back through the completed takeover. Mid-takeover reverse sampling is not sufficient for this bug.

- From later document flow, the first backward input that crosses a completed takeover's `sceneEnd` must be intercepted.
- A completed takeover re-entered by reverse scroll must replay as `100% -> 0%`: the completed state is the starting progress, and reverse input spends that budget downward before native document flow can pass above the scene.
- `sceneEnd` must come from the rendered DOM span for takeover scenes; authored `layout.height` must not expand the native re-entry edge after the scene has been viewport-clamped.
- The native lock offset for that takeover is `sceneEnd`, not anchor.
- The first reverse frame consumes only the overshoot inside `sceneEnd`, so native `scrollTop` remains at the rendered capture edge while local `progressPx` rewinds.
- The first reverse frame must not apply same-wheel remainder to native scroll after establishing a `sceneEnd` capture.
- Dense reverse input must pass through authored waterfall breakpoints before native document flow is released upward.
- The next forward replay after reverse re-entry must start from enter progress, not from stale completed progress.
- After one completed takeover has already replayed from `sceneEnd` down to `0%` in the current upward traversal, its center-lock anchor must not resurrect the same zone back to `100%` before a later forward replay. This prevents a later completed scene such as 05 from blocking the earlier completed scene 03.

## Revised Conclusion

The earlier fixes addressed real contributing problems, but they are not sufficient proof for the user's current live failure. The live report is stronger: after 03 or 05 has fully completed and natural document flow has taken over, reverse scroll can still skip the entire scene. That points first to input ownership being lost while the page is in natural document flow before the completed takeover has a chance to reacquire at rendered `sceneEnd`.

The next implementation pass must therefore start with a RED behavior test for the complete path: forward takeover `0% -> 100%`, continue into later natural document flow, then reverse across rendered `sceneEnd`. The expected result is immediate DirectScroll ownership, native lock at rendered `sceneEnd`, and local takeover progress `100% -> 0%` before document flow may pass above the scene. Phase math, authored height, same-wheel remainder, and stale replay markers remain previous failure modes to guard with regression tests, not assumptions to patch again blindly.

## 2026-06-08 Follow-up Correction

The later "prevent anchor replay after sceneEnd replay" direction was withdrawn. It optimized an internal duplicate-trigger hypothesis instead of proving the user's product lifecycle. The current acceptance target is not "do not replay"; it is: forward takeover plays `0% -> 100%`, the completed scene remains at `100%` while natural document flow continues, and reverse re-entry from behind plays the retained state back from `100% -> 0%`.

The next RED proof must assert that lifecycle directly through public behavior. Internal anchor crossing or duplicate-callback tests may remain secondary regression coverage, but they cannot replace the main proof that reverse scrolling re-executes the completed scene animation.

## 2026-06-08 Multi-Scene Public Path Fix

The missing RED was not a single-zone proof. A public `<Scene scroll>` test now completes two takeover scenes with 03/05-like budgets (`1800` and `1400`), continues to bottom natural document flow, then reverses through the page. The observed red failure was: after 05 replayed from `100% -> 0%`, continued upward input crossed 05's center-lock anchor and `getReplayReadyZoneProgress` reinterpreted `progressPx = 0` as `totalBudgetPx`, causing another `scenarios-takeover` progress event before 03 could own the input.

The runtime now keeps a traversal-local consumed sceneEnd replay marker. It does not block the required `100% -> 0%` reverse replay; it only prevents the same completed zone from resurrecting at anchor after that replay has already reached `0%`. The marker is cleared by an explicit later forward replay, `goToZone`, or unregister, so normal second forward `0% -> 100%` behavior remains armed.

Verification for this pass:

- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
  - 61 tests passed.
- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx src/components/Scene/sceneScrollBudget.test.ts src/components/Animate/useAnimateScroll.phase.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx --runInBand`
  - 4 suites / 85 tests passed.
- `pnpm run type-check`
  - `tsc --noEmit` passed.
- `git diff --check -- src/components/CineView/DirectScrollCineView.tsx src/components/CineView/DirectScrollCineView.test.tsx AGENT_SELF_REVIEW.md task-flows/2026-06-07-scroll-takeover-rate-model.md design.md requirements.md`
  - passed.

## 2026-06-08 Native Reconcile Capture Fix

The remaining live skip matched a different path from the wheel consume fixes. If browser-native scroll reconciliation crossed a completed takeover's rendered `sceneEnd` and the first corrected progress was still effectively `100%`, the reconcile path did not persist `takeoverCaptureOffsetsRef`. The same `syncNativeScrollState` pass then compared the active zone against its center anchor, marked it inactive at `sceneEnd`, and allowed later native scroll to move through the scene.

This is now covered by `keeps native sceneEnd reverse capture active when the first reconciled frame is still at completion`. The test failed before the fix with `scrollTop` corrected to `sceneEnd`, progress still `100%`, but `active=false`; after the fix the sceneEnd capture remains active and the next reverse native scroll consumes progress downward.

The runtime change is intentionally small: `reconcileNativeTakeoverOffset` now mirrors `consumeTakeoverDelta` by persisting a backward `reverseReplayCaptureOffset` whenever `nextProgress > 0.5`, including the completion-edge frame. This does not change the design model: completed reverse re-entry still starts from retained `100%`, locks native scroll at rendered `sceneEnd`, and consumes local takeover progress toward `0%` before document flow can pass above the scene.

The same RED also guards release symmetry. After the native sceneEnd reverse replay reaches `0%`, `syncNativeScrollState` clears the persisted capture when it releases the active zone. Without that cleanup, the next forward replay could reuse stale `sceneEnd` as the native lock instead of restarting from the center-lock anchor. The covered lifecycle is now: `100%` retained in document flow -> native reverse capture at rendered `sceneEnd` -> reverse progress to `0%` -> no anchor resurrection while continuing upward -> later forward replay starts from `0%`.

Verification for this pass:

- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx --runInBand -t "keeps native sceneEnd reverse capture active"`
  - red before fix, green after fix.
- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx --runInBand -t "reconciles native reverse scroll|native sceneEnd reverse capture|reverses completed public Scene.scroll|keeps completed Scene.scroll|reverse-runs completed|large reverse wheel|viewport-clamped|second forward|current reverse waterfall|scrollbar reverse"`
  - 12 targeted reverse/takeover tests passed.

## 2026-06-08 Visual Carrier Correction

The final missed cause was not another progress or ownership bug. The runtime correctly captured completed reverse re-entry at rendered `sceneEnd`, but that same value was also used as the visual viewport offset passed through `Scene.scrollRuntime`. At `scrollTop === sceneEnd`, the scene timeline is `after`, the sticky takeover shell has left the viewport, and `getFixedLayerMetrics` marks the scene-scoped fixed layer hidden. The animation could therefore replay from `100% -> 0%` offscreen, which is exactly the user's "the scene is really skipped" symptom.

The corrected model keeps two ledgers:

- Native/input ledger: completed reverse re-entry still captures and locks at rendered `sceneEnd`; this preserves the no-anchor-jump rule and prevents native document flow from passing the scene while budget remains.
- Visual ledger: while an active backward capture still has progress, the rendered Scene receives a derived visible viewport offset (`captureOffset - viewportSpan`, clamped to the scene range), and the takeover shell is translated back into the viewport with a temporary stacking lift. This keeps the shell and scene-scoped fixed layer visible without changing `scrollTop`, `scrollHeight`, overlay distance, or takeover progress.

This is covered by `keeps completed reverse replay visually mounted while native scroll is captured at sceneEnd`. The test proves the complete user-facing invariant: after forward completion and natural document flow, native reverse re-entry locks at `sceneEnd`, zone progress is between `100%` and `0%`, the takeover shell is visually compensated and stacked, the fixed clip is visible, and the scroll-driven Animate opacity is in a live intermediate state.

Verification for this pass:

- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx --runInBand -t "keeps completed reverse replay visually mounted"`
  - red before fix because the shell had no compensation and the fixed layer was hidden, green after fix.
- `pnpm exec jest src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
  - 63 tests passed.
- Independent review agent:
  - No blocking issue found. It confirmed the design split: `sceneEnd` remains the ownership/native lock boundary, while the render-only visible offset keeps shell/fixed layer in the viewport. It noted one non-blocking future edge: author code reading `SceneContext.isActive` during a visual reverse replay still sees native active scene semantics, while built-in scroll-driven `Animate` is driven by zone state and remains correct.

## 2026-06-09 SceneEnd Capture Rate Correction

Real wheel logging showed the next missed cause after visual compensation. Completed 05 did reacquire ownership at rendered `sceneEnd` and kept native `scrollTop` locked, but subsequent reverse wheel frames still reused center-lock anchor crossing math. At `currentOffset === captureOffset === sceneEnd`, a large reverse wheel also crossed the old anchor, so `remainingDelta` was clipped to `delta + (currentOffset - anchorOffset)`. In the real page this made a `-900px` input spend only a small slice of the local takeover budget, so the document/input felt much faster than the scene animation.

The fix keeps the first capture-boundary behavior unchanged: the first reverse input crossing `sceneEnd` consumes only the overshoot inside the scene and does not hand remainder to native flow. Once the zone is already locked at a persisted `sceneEnd` capture offset, later reverse input now spends the full input delta against takeover budget and ignores center-lock anchor overshoot. The anchor still exists for ordinary center-lock entry and later forward replay; it no longer throttles an already-owned completed reverse replay.

This is covered by `continues a sceneEnd reverse replay by spending full reverse wheel delta instead of anchor overshoot`. The RED failure was progress staying around `1130 / 1400` after the second large reverse input; green verifies that the same input brings progress near `0` while native `scrollTop` remains locked at `sceneEnd`.

## 2026-06-09 Native Capture-Lock Jitter Correction

The latest real-browser logs ruled out cache and the earlier first-frame/capture hypotheses. The dev server served the current `DirectScrollCineView.tsx`, and the completed reverse re-entry did capture 05 at rendered `sceneEnd` with progress still near `100%`.

The remaining skip happened after capture: browser/native scroll reconciliation produced tiny forward jitter around the native lock (`sceneEnd + a few px`). Because `reverseReplayReentryZonesRef` was armed for the next valid forward replay, `reconcileNativeTakeoverOffset` treated that jitter as `shouldRestartForwardReplay` while the same zone was still active, backward, capture-locked, and above `0%`. That reset progress from near completion to the first few px. The next reverse input then released almost immediately, so the user saw a real document jump through the scene.

The runtime fix is deliberately scoped to native reconciliation, not to the generic forward replay predicate. In `reconcileNativeTakeoverOffset`, a forward native sample is ignored as replay restart only when all of these are true:

- the selected zone is the current active zone;
- the active direction is still backward;
- a persisted `sceneEnd` capture offset exists;
- the previous native offset is still at that capture lock;
- progress is still above `0%`.

Normal later forward replay remains armed after the reverse replay actually releases or a later forward traversal enters through the ordinary trigger. This preserves the waterfall model: completed reverse re-entry owns input at rendered `sceneEnd` and must finish `100% -> 0%` before native document flow or forward replay state can pass through that zone.

This is covered by `does not restart forward replay from capture-lock jitter before reverse replay reaches 0%`. The RED failure was a progress collapse from about `1330 / 1400` to a few px after a native `sceneEnd + 2.5px` jitter scroll; green verifies that native scroll is corrected back to `sceneEnd`, the zone remains active, and progress stays near the captured reverse-replay value.
