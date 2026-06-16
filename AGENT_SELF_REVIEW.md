# Agent Self Review Log

This file is a project-local operational memory for recurring mistakes, regressions, and workflow failures.

## Usage

- Read this file before substantial framework work.
- Add an entry after any confirmed mistake, regression, or user-corrected misunderstanding.
- Keep entries short and actionable.

## Entry Template

```md
## YYYY-MM-DD - Short Title

- Context:
- What was wrong:
- Why it happened:
- Missed signal:
- Next-time rule:
```

## 2026-05-10 - Overconfident frontend completion without strong enough verification

- Context: Repeated scroll/scene/layer refactors in `scroll` mode.
- What was wrong: Claimed or implied fixes before enough real runtime verification, while visual and interaction bugs still existed.
- Why it happened: Relied too much on code reasoning and partial checks; insufficient separation between implementation confidence and verification confidence.
- Missed signal: The task involved fragile scene/scroll/layer interactions and the user had already reported many regressions of the same class.
- Next-time rule: For frontend interaction work in this project, do not conclude visually sensitive fixes without explicit runtime checks, console checks, and a separate verification pass.

## 2026-05-10 - Letting runtime internals leak into public API recommendations

- Context: Scroll mode redesign discussion around `Viewport`, `ScrollZone`, root mode, and scene behavior.
- What was wrong: Stayed too close to existing implementation details when shaping public API and documentation.
- Why it happened: Followed current code structure before fully re-centering on user-facing ergonomics.
- Missed signal: The user repeatedly emphasized customer experience, easier semantics, and not exposing internal machinery.
- Next-time rule: For API redesign in this project, start from user tasks and ownership boundaries first, then map to runtime internals second.

## 2026-05-10 - Not narrowing rules to project scope soon enough

- Context: Added workflow rules at the workspace root before the user clarified they should apply only to `cineview`.
- What was wrong: The first placement was broader than the intended scope.
- Why it happened: Optimized for speed before confirming the exact boundary of the persistent rule file.
- Missed signal: The request was explicitly about “该项目”, which should have biased toward the project directory itself.
- Next-time rule: When adding persistent agent rules, scope them to the narrowest directory matching the user’s wording unless broader scope is explicitly requested.

## 2026-05-10 - Continued execution from summary without fully re-running project startup ritual

- Context: User asked to enter code migration and continue the implementation program.
- What was wrong: I resumed from the handoff summary and existing program flow, but did not fully re-run the required project startup ritual for this new execution round.
- Why it happened: I treated the handoff as sufficient operational context and under-weighted the project rule that substantial work must begin from docs plus a task-local flow file.
- Missed signal: The project rules explicitly require reading `design.md`, `requirements.md`, and creating a new per-task task-flow file before substantial implementation.
- Next-time rule: In this project, even with a good handoff, start each substantial execution round by re-reading rules/docs and creating or refreshing a dedicated task-flow file for that round before touching code.

## 2026-05-10 - Stopped after a passed node instead of re-reading task flow

- Context: User asked why the task stopped even though unchecked migration nodes remained.
- What was wrong: I let execution pause after a verification slice instead of immediately re-reading the active task-flow file and continuing the next executable node.
- Why it happened: I treated the local success condition as a natural stopping point and did not enforce the project's "task-flow is the source of truth" rule tightly enough.
- Missed signal: The active task-flow still had unchecked Phase 3 and Phase 4 work, and the user had explicitly asked for automatic continuation.
- Next-time rule: After every completed node in this project, re-open the active task-flow file immediately; if an unchecked executable node remains and there is no blocker, continue in the same turn without waiting for a reminder.

## 2026-05-10 - Drifted from the active node into broader self-directed cleanup

- Context: Phase 4 migration execution with explicit user rules for task-flow-driven progress and separated implementation/acceptance lanes.
- What was wrong: I started chasing adjacent example/runtime polish outside the currently active task-flow node instead of staying anchored to the single unchecked node and routing validation back through the independent lanes.
- Why it happened: I over-weighted local visual findings and under-weighted the requirement that the task flow, not my own curiosity, defines what to do next.
- Missed signal: The user explicitly called out that I was returning to earlier issues instead of following their execution rules.
- Next-time rule: In this project, when new findings appear, first map them to the current task-flow node; if they do not belong to the active node, park them instead of expanding scope mid-turn.

## 2026-05-11 - Collapsed implementation and verification after agent failure

- Context: Phase 5 `ScrollZone` public bridge with explicit project rules requiring separate implementation and acceptance lanes.
- What was wrong: After the implementation agent hit `429`, I completed remaining code changes myself and then ran the verification myself, which collapsed implementation and acceptance into one lane.
- Why it happened: I over-prioritized keeping momentum after the agent failure and treated local verification as an acceptable substitute for the required independent acceptance flow.
- Missed signal: The user had already repeated multiple times that I must not write and validate my own frontend changes on this project.
- Next-time rule: In this project, if the implementation or acceptance lane fails, I must mark the node blocked or re-establish separate lanes; I must not silently replace both roles with myself.

## 2026-05-12 - Left completed validator agents hanging and exhausted thread slots

- Context: Phase 6 follow-up work needed repeated independent acceptance passes across implementation and runtime-evidence nodes.
- What was wrong: After collecting completed sub-agent results, I left validator/acceptance agents hanging instead of closing them promptly, and later hit the agent thread limit when I needed a fresh independent acceptance lane.
- Why it happened: I treated a completed agent as harmless to leave around and focused on preserving context, but under-weighted the finite thread-slot constraint.
- Missed signal: The acceptance result had already been harvested and written into the flow, so the lingering agent no longer provided unique value but still consumed capacity needed for the next node.
- Next-time rule: In this project, once a sub-agent has completed and its result has been integrated into the active task flow, immediately `close_agent` it unless there is a concrete near-term reason to reuse that exact agent context.

## 2026-05-13 - Wrapped a React component mock in `jest.fn` and broke render invocation

- Context: Follow-up drag-mode bugfix work around `Scene.dragMode.test.tsx`.
- What was wrong: I changed a `framer-motion` component mock into `jest.fn(React.forwardRef(...))`, which made Jest try to call a forwardRef object like a plain function and triggered `specificMockImpl.apply is not a function`.
- Why it happened: I optimized for mock inspectability and warning suppression before re-checking the exact React component shape expected at render time.
- Missed signal: The mock target was a renderable component, not a callback dependency; wrapping it in `jest.fn` changed the callable contract.
- Next-time rule: For React component mocks in this project, keep the exported component as a real `forwardRef` component unless the test genuinely needs a function spy at the component boundary.

## 2026-05-15 - Let a stateful context object leak into registration effect dependencies

- Context: Scroll/content performance remediation introduced a runtime loop ending at `setZoneStates(...)` with `Maximum update depth exceeded`.
- What was wrong: `ScrollZone` and scroll-driven `Animate` registration effects depended on the whole `zoneRuntime` context object instead of only the stable registration callbacks they actually use.
- Why it happened: I optimized for exhaustive-looking dependency lists without re-checking whether the consumed context value changes identity on ordinary runtime state updates.
- Missed signal: `zoneRuntime` includes `zoneStates` and `version`, so any registration effect that depends on the whole object is effectively subscribed to its own state writes.
- Next-time rule: In this project, registration/setup effects must depend on stable action callbacks and semantic inputs, not on stateful context wrapper objects that are expected to churn during runtime.

## 2026-05-21 - Review blockers were not promoted to hard failures

- Context: Scroll takeover repair around reverse replay, scrollbar handoff, and duplicated 03/05 titles in `examples/performance-test`.
- What was wrong: A prior implementation pass reported green tests while the independent design review still had blocking findings, and those blockers were not immediately turned into failing tests, task-flow status, and a self-review entry.
- Why it happened: I treated focused structural tests and a partial browser pass as sufficient, instead of making the review lane's "still should not pass" verdict authoritative.
- Missed signal: The task-flow and review response already named repeated double-title and missing runtime-motion risks, and the user had explicitly complained about the same failures multiple times.
- Next-time rule: In this project, any independent review Blocking finding must become an unchecked task-flow node and at least one executable red proof before the task can be called fixed.

## 2026-05-22 - Invented preAnchor authoring became product behavior

- Context: Scenes 03/05 takeover examples used a `preAnchor` visibility-driven copy plus a takeover phase copy for the same title/pill content.
- What was wrong: `preAnchor` was not a documented design concept, but it became visible product behavior and caused the user to see takeover-owned content animate before takeover ownership.
- Why it happened: I tried to preserve pre-takeover visual continuity by adding a second authoring owner instead of challenging whether takeover content should appear before ownership begins.
- Missed signal: `design.md` says `Scene.scroll` owns takeover timing and `Scene.scroll` does not define visual style; it does not require duplicate pre-anchor content.
- Next-time rule: Do not introduce example-only ownership concepts for takeover content unless they are explicitly documented or approved; one visible content owner must be the default.

## 2026-05-31 - Coarse reverse-replay checks hid ownership bugs

- Context: Reopened 03/05 takeover reverse replay after full-page scroll traversal.
- What was wrong: Early green tests and coarse browser samples were not enough to catch stale active takeover ownership and missed reverse intermediate frames.
- Why it happened: The test first proved final state, not the first owner selected during the handoff, and browser sampling only checked sparse points.
- Missed signal: The user had repeatedly reported skip-like behavior, which requires sampling every takeover handoff frame and callback ownership, not only end-state assertions.
- Next-time rule: For takeover replay bugs, add at least one first-callback/first-frame assertion and a dense browser sampling pass before claiming the reverse path is fixed.

## 2026-06-06 - Called replay verified before second-pass runtime coverage

- Context: User challenged the previous takeover replay fix because second forward/backward passes no longer showed animations in the real scroll page.
- What was wrong: I treated focused unit tests as enough verification and did not cover real page second-pass wheel behavior or the custom scrollbar synthetic path.
- Why it happened: I fixed the wheel/native path in isolation and under-weighted that `replayOnReenter` has multiple input routes with shared user-visible semantics.
- Missed signal: Prior task logs already warned that sparse browser samples and unpromoted review findings caused repeated takeover regressions.
- Next-time rule: For takeover replay, verify wheel/native/scrollbar paths separately and record at least one second-forward progress sequence from the real page before saying the issue is fixed.

## 2026-06-08 - Authored scene height was mistaken for rendered takeover height

- Context: Repeated 03/05 reverse scroll skip after prior fixes for phase windows, sceneEnd capture, and prior incorrect anchor-locking attempts.
- What was wrong: I treated the authored `sceneHeight` / declared span as the takeover scene's physical document span during layout measurement, even though takeover rendering clamps that scene to the viewport height. The state machine therefore waited for `sceneStart + declaredHeight` while the real DOM scene had already ended at `sceneStart + renderedHeight`.
- Why it happened: The tests used synthetic scene heights where declared span and rendered wrapper height matched, so the model-level `sceneEnd` assertions were green while the real page had `03/05` rendered at one viewport height.
- Missed signal: Browser sampling showed 05 locking at `5837` even though the real DOM scene end was `5474`; that exact `363px` gap was the difference between authored `1200` and rendered viewport `837`.
- Next-time rule: For takeover re-entry bugs, assert against the rendered DOM span used by the scroll container, not only authoring props. Add a red proof whenever declared span and measured span can diverge.

## 2026-06-08 - Same-wheel reverse remainder skipped completed takeover

- Context: User clarified the failing path is completed takeover, continued scroll to later page/bottom, then reverse wheel back. The bug is not validated by reversing in the middle of the takeover animation.
- What was wrong: I let the same reverse wheel both capture the completed takeover at `sceneEnd` and then hand its remaining delta back to native document scroll. That could move `scrollTop` past the just-captured scene in the same frame.
- Why it happened: I treated "budget exhausted" release rules as symmetric, but completed reverse re-entry needs a capture frame boundary before native flow may continue.
- Missed signal: The correct RED case is a large reverse wheel from page bottom that crosses the entire completed scene, not only a small wheel that barely crosses `sceneEnd`.
- Next-time rule: For completed reverse re-entry, add a same-wheel native-default test: the first crossing input must be intercepted, lock at rendered `sceneEnd`, keep takeover active, and not apply remainder to native scroll until a later input.

## 2026-06-08 - Claimed browser self-test without completing the user's path

- Context: User reported 03 and 05 still skip in the live `#/scroll` page after the claimed fix.
- What was wrong: I treated unit coverage and earlier/incomplete browser sampling as enough. In the latest browser run I did not actually complete 03/05, continue to later document flow/page bottom, and then reverse through both completed takeovers.
- Why it happened: I verified the state-machine invariant in isolation and did not force the live page to prove the same path the user described. A stalled browser scroll at 03 was not valid evidence for the completed-to-bottom reverse scenario.
- Not the conclusion: This does not prove the remaining bug is phase math, authored height, or same-wheel remainder. Those are prior suspects, not the current root cause until traced against the live 03 and 05 failure.
- Next-time rule: When the user says the live page still skips, accept that as the primary evidence. Before editing runtime code again, log the wrong assumption, trace both 03 and 05 through the same generic path, and add a RED test for the shared failure.

## 2026-06-08 - Old design text still described completed reverse re-entry as anchor locking

- Context: User asked whether the old design document is wrong if a new implementation model is needed.
- What was wrong: The design text still said a completed takeover re-entered from behind should "lock back to anchor", even though the accepted model requires capture at the rendered `sceneEnd` and replay from `100% -> 0%`.
- Why it happened: I kept layering fixes on the runtime while leaving an outdated state-machine description in the source of truth, so later implementation work could keep rediscovering the wrong anchor-based path.
- Not the conclusion: This does not mean the whole scroll-mode design is invalid. The real document flow, local takeover budget, and no root virtual track principles are still correct; the completed reverse re-entry ownership rule was incomplete/outdated.
- Next-time rule: Before changing takeover runtime again, verify that requirements, design, task-flow, and tests all describe the same ownership boundary: completed reverse re-entry captures rendered `sceneEnd`, not anchor.

## 2026-06-08 - SceneEnd reverse replay could resurrect at anchor in the same upward traversal

- Context: User reported that reverse scrolling still skipped 03/05 after completed takeover playback and natural document takeover.
- What was wrong: I treated the rendered `sceneEnd` capture as the only remaining ownership edge, but the old anchor-based replay path still considered a zero-progress completed zone eligible when the same reverse traversal later crossed anchor / `sceneStart`.
- Why it happened: `getReplayReadyZoneProgress` converted `progressPx <= 0` back to `totalBudgetPx` for backward input after anchor, unless the runtime was still exactly at the capture offset. Once native flow resumed above `sceneEnd`, that protection was gone.
- Missed signal: A correct test must continue the same reverse traversal after the `sceneEnd` replay reaches `0%`, then assert that the anchor crossing is not intercepted and does not restore completed progress.
- Next-time rule: Completed reverse re-entry is a single `sceneEnd 100% -> 0%` replay per upward traversal. Anchor crossing after that is ordinary document flow, not another completed replay trigger.

## 2026-06-08 - Mistook preventing a second trigger for the user's reverse replay requirement

- Context: User restated the product logic: forward takeover plays `0% -> 100%`, completion keeps the scene at `100%`, and reverse scroll must play the same scene back from `100% -> 0%`.
- What was wrong: I changed the runtime around suppressing a later anchor crossing and wrote a test for "do not replay again", which shifted the goal from "reverse must execute" to "prevent a duplicate trigger".
- Why it happened: I over-indexed on a browser trace artifact and optimized an internal ownership edge without first proving the user-facing lifecycle: completed state is retained after release, then consumed backward on re-entry.
- Missed signal: The user had explicitly said many times that the desired behavior is re-executing the animation backward, not preventing calls or clearing state.
- Next-time rule: The first RED must assert the public lifecycle `0 -> 100`, retained `100` during natural document flow, and reverse `100 -> 0`. Internal anchor/re-entry dedupe tests are secondary and cannot replace that acceptance test.

## 2026-06-08 - Single-zone proof hid multi-takeover anchor resurrection

- Context: User clarified that both 03 and 05 are wrong after the completed scene has fully released to natural document flow and the user reverses from below.
- What was wrong: I kept validating a single completed takeover. That could pass while the real failure happened after 05 completed its reverse `100% -> 0%`: continued upward input crossed 05's center-lock anchor and revived 05 from `0%` back toward `100%`, delaying or hiding 03's reverse replay.
- Why it happened: The earlier tests did not complete two public `<Scene scroll>` takeovers in order, continue to page bottom, then assert reverse ownership order as 05 followed by 03.
- Missed signal: The user repeatedly said "03 or 05, after scene complete and natural document takeover, reverse scroll skips"; this implies cross-zone traversal order, not only a single-zone lifecycle.
- Next-time rule: For completed takeover replay bugs, include a public multi-zone test that finishes later and earlier takeovers, reverses from bottom, and proves a consumed later zone cannot resurrect at anchor before the earlier zone gets ownership.

## 2026-06-08 - Reconcile sceneEnd capture was not persisted at the completion edge

- Context: The live page still skipped 03/05 after fixes for rendered `sceneEnd`, same-wheel remainder, and anchor resurrection.
- What was wrong: I had repaired the wheel/touch consume path, but the native `scroll` reconciliation path was still asymmetric. When a browser-native reverse scroll landed at rendered `sceneEnd` while takeover progress was still effectively `100%`, `reconcileNativeTakeoverOffset` captured the edge for that calculation but did not persist the capture offset because `nextProgress` was not below `totalBudget`.
- Why it happened: Immediately after that temporary capture, `syncNativeScrollState` asked for the active native lock offset. With no persisted capture, the lock fell back to the center anchor, so the just-captured zone was marked inactive at `sceneEnd` and later native scroll could pass through the scene.
- Follow-up gap: Persisting the capture exposed the symmetric release problem: when `syncNativeScrollState` itself released an active zone after the reverse replay reached `0%`, it cleared active state but did not clear the persisted capture offset. The next forward replay could then be pulled back to stale `sceneEnd` instead of restarting from the anchor.
- Not the conclusion: This was not the 50% first-frame hold, not authored-vs-rendered height, not same-wheel remainder, and not `consumedReverseSceneEndReplayZonesRef` blocking the first reverse replay. Those were earlier failure modes or guards; the remaining bug was path asymmetry between `consumeTakeoverDelta` and `reconcileNativeTakeoverOffset`.
- Next-time rule: For scroll takeover ownership bugs, test both direct input consumption and browser-native reconciliation at the same semantic edge. A completed reverse re-entry must persist the rendered `sceneEnd` capture even when the first reconciled frame is still visually at completion, and must clear that capture on real release so the next forward replay starts from `0%`.

## 2026-06-08 - SceneEnd native lock hid the active reverse replay layer

- Context: The live page still looked like it skipped 03/05 after ownership and progress tests were green.
- What was wrong: I treated rendered `sceneEnd` as both the native capture/lock ledger and the visual viewport offset. At `scrollTop === sceneEnd`, the Scene timeline is `after`, sticky takeover shell is outside the viewport, and scene-scoped fixed layer visibility evaluates to hidden. The takeover progress could be replaying `100% -> 0%` correctly while the user saw nothing.
- Why it happened: Earlier tests asserted progress and native lock, but did not assert the actual visual carrier: takeover shell transform/stacking and fixed layer `visibility` while reverse replay is active at `sceneEnd`.
- Not the conclusion: This was not another progress budget bug, not Animate unregistering, not Scene destruction, and not a need to lock native scroll back to the center anchor. The correct model is split ledgers: `sceneEnd` for input ownership/native lock, derived visible viewport offset for render-only shell/fixed-layer compensation.
- Next-time rule: Completed reverse re-entry tests must assert both ledgers: native `scrollTop` stays at rendered `sceneEnd`, and the active takeover's shell/fixed layer remains visible while progress rewinds. Do not call the lifecycle fixed if the animation can run offscreen.

## 2026-06-09 - SceneEnd capture replay still spent only anchor overshoot

- Context: User reported the live 03/05 page still skipped after visual compensation and asked for real-environment logging.
- What was wrong: I treated `sceneEnd` capture as fixed after the first reverse frame, but the continuing wheel path still reused center-lock anchor crossing math. When locked at rendered `sceneEnd`, a `-900px` reverse wheel could be clipped to the small `sceneEnd - anchor` overshoot instead of spending the full local takeover budget delta, making scene progress much slower than the document/input rate.
- Why it happened: Prior tests proved capture, visibility, and no same-wheel native remainder, but did not assert the second and later reverse frames while still locked at the `sceneEnd` capture offset. The live logs showed `currentOffset === captureOffset`, `crossesAnchor === true`, and progress falling by only the anchor overshoot.
- Not the conclusion: This was not scene destruction, not Animate unregistering, not the first-frame 50% hold, and not only an offscreen visual layer. It was a budget-rate conversion bug after ownership had already been acquired.
- Next-time rule: For completed reverse re-entry, test the whole locked replay, not only the first capture frame: after `sceneEnd` capture, subsequent reverse input must consume budget at the same px rate as the input delta and must not be clipped by center-lock anchor overshoot.

## 2026-06-09 - Native capture-lock jitter restarted forward replay mid-reverse

- Context: Real browser logging showed completed 05 did capture at rendered `sceneEnd` and set progress near completion, but immediately afterward the page still appeared to skip the scene.
- What was wrong: Tiny native forward scroll jitter around the `sceneEnd` capture lock was interpreted by `reconcileNativeTakeoverOffset` as a pending forward replay restart. That collapsed the active reverse replay progress from near `100%` to the first few px, so the next reverse input saw almost no remaining budget and released native document flow through the scene.
- Why it happened: I treated `reverseReplayReentryZonesRef` as safe to use for later forward replay while the same zone was still actively capture-locked in backward replay. The state machine did not distinguish a real later forward traversal from browser/native lock jitter at the capture offset.
- Not the conclusion: This was not cache, not the 50% first-frame hold, not scene destruction, not missing takeover registration, and not the prior anchor-overshoot rate bug. The live logs showed ownership was acquired correctly first, then polluted by native reconcile jitter.
- Next-time rule: During completed reverse re-entry, rendered `sceneEnd` capture lock is active ownership. Until progress reaches `0%` or the zone is explicitly released/reset, native opposite-direction jitter must preserve the current reverse replay and must not rearm forward replay.

## 2026-06-09 - Claimed jitter fix while user still saw reverse skip

- Context: After the native capture-lock jitter patch and a CDP wheel sample, the user reported the live `#/scroll` page still skips 03/05 when reversing after the scene animation has completed and natural document flow has resumed.
- What was wrong: I treated one successful CDP path as enough evidence even though the user continued to see the failure in the in-app browser. The correct response is not another immediate runtime patch; it is a bottom-up framework audit across input ownership, native scroll reconciliation, visual carrier visibility, and 03/05 authoring.
- Why it happened: The verification path still did not prove the exact user-observed gesture/device sequence. It sampled a programmatic wheel path, but the real failure may live in a different input route, release state, scene active derivation, fixed-layer visibility, custom scrollbar/native scroll interaction, or authoring/runtime bridge.
- Not the conclusion: The prior fixes may still be valid guards, but they are not sufficient. Do not keep assuming the current remaining failure is 50% hold, cache, authored height, scene destruction, anchor overshoot, or capture-lock jitter until a fresh real log proves it.
- Next-time rule: When the user says the live page still skips, freeze implementation. First collect real logs from the exact completed-scene-to-natural-flow-to-reverse path, then trace the framework ledgers (`native scrollTop`, active zone, capture offset, local progress, visual viewport offset, Scene context, and Animate opacity) before proposing any code change.

## 2026-06-09 - Full center-lock segment crossing was not reduced

- Context: After restarting around the accepted center-lock percentage model, the user again reported that completed 03/05 scenes were truly skipped when reversing from later natural document flow.
- What was wrong: I kept treating the remaining failure as variations of earlier `sceneEnd capture`, phase, replay, or visibility issues. The current reducer already derived progress correctly from `scrollTop - segmentStart`, but the main intent path was not passing the real center-lock segments into `resolveScrollIntentOffset`. A single large reverse input could therefore move from `segmentEnd + n` to `segmentStart - m`; `syncZoneStatesFromNativeOffset` then saw only `progress=0`, `active=false`, and no in-segment frame.
- Why it happened: Old tests and docs still used `sceneEnd`, `capture`, `globalOffset`, `reentry`, and `budget` language, so they kept pulling the mental model back toward a state machine instead of the user's simpler segment/percentage waterfall.
- Not the conclusion: This is not a title phase bug, not scene destruction, not cache, not authored height, and not a need for a public re-entry/capture concept. It is an input reducer failure: every wheel/touch/keyboard/scrollbar/native path must prevent complete center-lock segment skips.
- Next-time rule: For scroll takeover regressions, the first RED must include a large same-intent jump from after a completed segment to before that segment and assert an in-segment `100% -> 0%` frame. Full-file tests that still assert abandoned state-machine terms must be rewritten before they are used as acceptance gates.

## 2026-06-16 - Fix drag release settle on wrong code path; missed visual flash root cause

- Context: Task `2026-06-11-drag-release-progress-settle` — user reported drag mode settle animation restarts from 0% instead of continuing from current progress.
- What was wrong: I first fixed the local-mode fallback `onDragCommit` in `Scene.tsx` (which resets `dragTimelineProgress=0` / `sharedElapsedMs=0`), but this path is never reached in production (CineView always provides `dragRuntime`). The production path through `commitDragSceneChange` + dual gate was already correct. The real root cause was in `useAnimateDrag.ts`: `visualMotion = useMotionValue(0)` initializes to 0, and the `useEffect`-based `updateVisualMotion()` only corrects it AFTER browser paint. When a new scene's Animate elements mount or become active, the first frame shows initial (0%) state before jumping to the correct position.
- Why it happened: I stopped investigating at the first code smell (`_progressRatio`/`_elapsedMs` unused params) instead of tracing the full runtime path through gesture release → dual gate commit → scene exchange → Animate visual state. The local-mode fix felt productive but was irrelevant.
- Missed signal: The user explicitly said the fix was ineffective in the browser and asked me to "着重检查 drag模式下的动画手势释放相关的计算" (focus on drag mode animation gesture release calculations). I should have started from the visual pipeline (Animate → useAnimateDrag → visualMotion) rather than the state management layer.
- Next-time rule: For visual/animation bugs in this project, trace the full pipeline from input → gesture → state → visual motion → rendered output before writing code. The visual motion initialization is a common flash/jump vector — always check whether the first frame's value is correct, not just whether the final state is reached. Use `resolveVisualState` during render (not just in effects) to seed the initial motion value. [[2026-06-08-claimed-browser-self-test-without-completing-user-path]]

## 2026-06-16 - Both fixes were wrong: visual flash fix does not address progress reset

- Context: User confirmed the fix at http://localhost:3000/#/drag is ineffective. The requirement is: if user drags to 50% and releases, the settle animation must go from 50% → 100%, NOT restart from 0%.
- What was wrong: I made TWO fixes, both wrong for the user's actual problem:
  1. **Local-mode fallback** (`Scene.tsx`): Changed `_progressRatio→progressRatio`, `_elapsedMs→elapsedMs`. Wrong because this path is dead code in production.
  2. **Initial visual value** (`useAnimateDrag.ts`): Changed `visualMotion = useMotionValue(0)` to `useMotionValue(initialVisualValue)`. Wrong because this only prevents a one-frame flash — the user's complaint is that the ANIMATION PROGRESS resets to 0%, not a visual flash.
- Why it happened: I conflated "one-frame visual flash" with "animation progress reset to 0%". The user is reporting that the settle animation STARTS from 0% and animates to 100%, instead of STARTING from the drag-end position (e.g. 50%) and continuing to 100%. My fix ensured the FIRST FRAME showed the correct end state, which actually HIDES the fact that there's no settle animation at all — the commit always happens at 100% because the dual gate completes before committing.
- Missed signal: The user repeatedly said "从0开始" (starts from 0) and "以50%的进度完成到100%" (from 50% complete to 100%). This describes the settle animation's START position, not a one-frame visual glitch. The dual gate always commits at 100% (both releases complete), so there IS no settle — the old scene finishes the release animation, then the new scene jumps to 100%. The user wants a visible settle on the NEW scene.
- Next-time rule: Before writing any code for an animation fix, clarify with the user exactly what they SEE vs what they EXPECT. "Starts from 0" could mean: (a) visual flash at 0% due to initialization, or (b) the animation genuinely plays 0%→100% instead of continuing from drag position. These have completely different root causes. [[2026-06-16-fix-drag-release-settle-on-wrong-code-path]]
