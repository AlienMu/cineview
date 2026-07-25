# CineView Framework Review

## Goal

Assess CineView against `DESIGN.md` for correctness, architecture, runtime performance,
developer experience, extensibility, professional use, maintainability, and duplication.

## Review Plan

本任务的交付物不是只列问题，而是形成一份有证据、有优先级、可执行的框架评审结论。执行顺序如下：

1. **建立基线**：读取 `DESIGN.md`、公共类型、核心运行时、示例和测试配置，记录当前工作树、构建产物、覆盖率、警告和已知浏览器问题。
2. **做结构与逻辑评审**：绘制 `CineView → Scene → Animate/Position/Container/Image` 的职责和数据流，检查 drag/scroll 的时间语义、状态所有权、模式隔离、fixed layer 和 preload 行为。
3. **做性能评审**：聚焦每帧热路径，检查 React state fan-out、MotionValue 使用、子树重渲染、layout thrashing、事件监听器、视频 seek、对象分配和资源释放；同时记录包体积，但不以包体积替代运行时结论。
4. **做代码 review**：按 P0/P1/P2/P3 分级记录真实缺陷、回归风险、重复实现、死代码、兼容层污染、过大的模块和缺失测试，并给出文件/行号证据。
5. **实施必要整改**：只处理影响正确性、性能、公共 API、可维护性或发布可靠性的事项；每个节点完成后立即回读代码、grep 旧路径、运行聚焦验证，并更新本任务流。
6. **自动化验收**：执行 type-check、lint、全量测试、覆盖率、示例测试、构建/包体积、exports consumer smoke test 和 warning hygiene；覆盖率门槛保持语句/分支/函数/行均不低于 90%。
7. **独立真实环境验收**：由独立 agent 在真实浏览器验证 `#/drag` 与 `#/scroll`，覆盖桌面和移动尺寸、正反向、回弹、取消、大 flick、防跳过、键盘、scrollbar、nested scroll、多 zone、动态布局和高并发动画；实现 agent 不得自行签收该节点。
8. **形成最终决策**：分别评估易用性、扩展覆盖、专业模式适配、可维护性、代码重复性和 runtime 精简度，明确已解决项、残留限制、workaround、发布阻塞项和是否达到 production-ready。

## Final Assessment Rubric

- **易用性**：首次接入路径、API 心智、默认行为、错误提示、文档和普通文档流兼容性。
- **扩展覆盖**：场景组合、动画属性、事件/DOM 属性/ref、媒体、嵌套交互、动态 children 和自定义动画扩展面。
- **专业模式**：复杂叙事、长页面、响应式、可访问性、SSR/打包消费、输入设备和可观测性。
- **可维护性**：职责边界、状态唯一所有者、模块规模、类型清晰度、测试结构、兼容层和死代码。
- **代码重复性**：生产代码与测试 fixture 的重复实现、重复状态转换、重复测量/订阅/适配逻辑。
- **Runtime 精简度**：连续滚动/拖拽下的 React commit、layout read/write、监听器数量、MotionValue 订阅、视频 seek、内存回收和包体积。

结论采用“证据分级”：自动化测试证明逻辑约束，静态检查证明工程完整性，构建/consumer smoke test 证明发布面，独立浏览器和性能观测证明真实交互与运行时行为。任何 drag/scroll、视觉、可访问性或性能结论，在独立浏览器节点未通过前不得标记为完成。

## Review Nodes

- [x] Establish the repository baseline, current changes, package surface, and specification consistency.
- [x] Map the public API and evaluate ease of use, failure modes, documentation, and extension seams.
- [x] Review drag and scroll engines for state ownership, correctness, and cross-mode leakage.
- [x] Audit runtime hot paths, rendering behavior, layout measurement, media handling, and memory cleanup.
- [x] Audit module boundaries, file/function size, duplication, dead compatibility code, and test architecture.
- [x] Run static checks, focused/full tests, build verification, and inspect bundle output.
- [ ] Complete independent browser acceptance for drag/scroll paths and observe animation concurrency/performance.
- [x] Consolidate findings by severity, re-read touched evidence, and produce an actionable framework verdict.

## Node Self-Review Checklist

For every completed node:

- Confirm the conclusion addresses the actual framework behavior, not only test outcomes.
- Search for contradictory or duplicate implementations before closing the node.
- Note any file/function growth or ownership ambiguity discovered.
- Re-check per-frame cost and single-owner invariants for affected runtime paths.

## Notes

- `DESIGN.md` remains the authority when implementation and historical documents disagree.
- Browser interaction conclusions require an independent acceptance lane.

## Baseline Evidence

- Worktree is already dirty with unrelated in-progress changes; review is read-only with respect to source behavior.
- `pnpm type-check`: passed.
- `pnpm lint`: passed.
- `pnpm test --runInBand`: 83 suites / 1167 tests passed, with React warnings in integration output.
- `pnpm test:coverage --runInBand`: global statements 96.4%, branches 90.29%, functions 96.58%, lines 96.69%.
- Initial `pnpm build:verify`: passed 8/8; ES gzip 47.79 KB, UMD gzip 40.60 KB.
- Missing repository artifacts referenced by the onboarding/spec: `README.md`, `requirements.md`, `AGENT_SELF_REVIEW.md`, and `COVERAGE_REPORT.md`.
- Initial review found a likely margin wiring mismatch: provider wrote `visibilityEnterMargin`/`visibilityExitMargin`, while the consumer read `scrollEnterMargin`/`scrollExitMargin`. The follow-up code now uses the `scroll*Margin` shape in the active runtime.

## Review Evidence Before Browser Lane

- Scroll progress enters React state (`zoneStates`, `scrollOffset`, active scene) and clones all Scene children on updates; Animate then writes MotionValues from an effect.
- `SceneContext` changes with scroll timeline fields; Animate registry effects depend on the whole context object, so scroll frames can repeatedly unregister/register animation IDs.
- Visibility-driven Animate instances each attach their own scroll listener and perform their own layout reads.
- `AnimateVideo` uses the render-prop bridge, whose MotionValue subscription calls React `setState` per progress change before `video.currentTime` is assigned.
- Initial review found scroll root input capture without a nested-scroll ownership check, plus blanket drag Scene `userSelect`/`touchAction` suppression. Nested-scroll ownership now has helper coverage, while full browser fixture coverage remains pending; blanket drag Scene selection suppression was changed in the follow-up pass.
- Scroll preloader places every declared scene asset in `priorityUrls`, so first-scene readiness waits on the entire page.
- Scrollbar overlay defaults and semantics differ from the documented contract and the custom rail is `aria-hidden` with no scrollbar role/value model.
- Internal legacy compatibility props and scroll transition state remain in production paths; production duplication is low (~1.07%), while test duplication is high (~14.75%).
- `examples/performance-test` build passes, but its Vitest suite currently has 6 failures from stale route/animation expectations; root `pnpm test` does not include it.

## Initial Independent Browser Evidence

- At 1280x720, scroll wheel/keyboard/scrollbar/large-flick/multiple-zone traversal broadly passed; reverse re-lock passed with visual caveats.
- At 1280x720, primary drag gestures did not change the scene counter in either direction; button navigation worked. Drag release/bounce remains unverified.
- Visual acceptance found clipped/occluded content in scroll scene 3 and drag scene 2.
- The live app emitted 95 warnings, including repeated delay-cache misses and missing waitFor dependency diagnostics.
- Browser sample reported 60 FPS with no visible frame drops, but long-task observation was unavailable and memory rose from ~17.8 MB to ~36.4 MB.

## Final Verdict

- Architecture: promising concepts, but the runtime ownership split is not yet reflected in the React update graph.
- Usability: good for curated cinematic demos; not yet frictionless for ordinary production pages or nested interactive content.
- Extensibility: broad animation vocabulary, but limited DOM prop/ref forwarding, brittle Scene recognition, and a narrow interpolated property set constrain composition.
- Professional readiness: not ready to call production-grade until drag gestures, visible overlaps/clipping, warning hygiene, docs/package metadata, and runtime hot paths are corrected.
- Runtime lean-ness: bundle is within the current budget, but scroll/visibility/video paths still carry avoidable per-frame React and layout work.

## Remediation Plan

### Execution Rules

- Keep `DESIGN.md` as the only architecture authority; update it first when a remediation changes a public invariant.
- Complete and self-review one node before starting the next node. Do not batch-check nodes at the end.
- Preserve the unique writers of `renderProgress`, per-scene `elementElapsedMotion`, and `dragRelease`.
- Any per-frame value introduced by this plan defaults to MotionValue or a narrowly subscribed external store; React state requires a documented structural-render reason.
- Any node touching drag/scroll behavior requires focused automated tests plus an independent browser lane on the real examples. The implementation agent cannot sign off its own browser acceptance.
- Before closing each node, grep for superseded fields, names, helpers, fixtures, and compatibility branches; no half-migrated path is accepted.

### Current Execution Snapshot (2026-07-19)

The review conclusions above are complete. Remediation status is tracked separately from
implementation status: a change is not checked off until its focused tests, current full
verification matrix, self-review, and required independent browser evidence are complete.

- **Baseline and review:** complete; the initial evidence and framework verdict are recorded above.
- **Automated verification is currently green:** `pnpm verify`, type-check, lint, 87 root suites / 1195 tests, 4 example files / 21 tests, and `build:verify` 12/12 all pass.
- **Coverage is above the four 90% gates:** statements 96.29%, branches 90.41%, functions 96.41%, and lines 96.52%.
- **Published-package consumption is verified:** the packed tarball works through both `require('cineview')` and `import('cineview')`; ESM is emitted as `dist/cineview.es.mjs`, while UMD/CommonJS remains `dist/cineview.umd.js`. A second clean-copy install with both root and example lockfiles frozen also passed the full `pnpm verify` matrix.
- **Current bundle evidence:** ESM gzip is 45.69 KB and UMD gzip is 38.81 KB; declarations, source maps, and animation chunks are present.
- **Duplication evidence:** a fresh `jscpd@4.0.5` scan at `min-lines=8,min-tokens=50` reports production-source duplicated lines at `1.72%`; the full test-inclusive `src` scan reports `12.85%`, confirming test fixture duplication is the material maintenance cost.
- **Warning hygiene improved:** fresh drag/scroll acceptance tabs report zero framework warnings and zero runtime errors; registry mount-order warning remediation is effective.
- **Latest independent post-fix targeted acceptance passes:** `1280x720` traversal reaches `6/6` with `warn=0,error=0`; Scene 5 content and fixed navigation have zero measured intersections; `390x844` forward drag settles to `2/6` with scene 1 at `y=0`; a scroll `+560→-560` smoke returns to `scrollTop=0` with no warnings/errors.
- **Earlier independent full acceptance also passed the exercised scroll paths:** wheel forward/reverse, two takeover zones, large-input anti-skip, keyboard, scrollbar, resize, and approximately 60 FPS with no observed long task.
- **Current browser boundary:** the original desktop/mobile/Scene 5 failures are closed on a fresh server. Nested ownership and dynamic mutation now have explicit fixtures and independent desktop/mobile evidence. Physical-device touch inertia/pinch and the stricter invariant that one continuous mobile swipe must never change owner mid-gesture remain outside this lane; exact React commit/listener counts also remain unmeasured.
- **Fresh-server supplementary evidence:** after stopping three stale Vite processes that all served the same example directory, a clean `localhost:3000` instance passed desktop drag `1→2→1`, mobile `390x844` drag `1→2`, and reported zero fresh warning/error entries. The old failures must be re-run by the independent agent against this fresh instance before being attributed to source behavior.
- **Fresh layout evidence:** at `1280x720`, final drag Scene 5 subtitle/media, media/bullet, and fixed-navigation intersections are all `0 px2`; the example navigation was made flex-wrapping and its `Next` control is inside the `390x844` viewport. The narrow-screen composition still needs a professional usability judgment because some authored scene content remains desktop-oriented.
- **Post-fix isolated-tab evidence:** after moving flavor-0 media registration before the copy `waitFor` consumer and reducing/repositioning final Scene 5 media to `y=414,width=360`, a brand-new independent `localhost:3000` tab traversed to `6 / 6` with `0 warning / 0 error`; Scene 5 media/bullet and media/fixed-navigation intersections were `0 px2`. Example tests remained 20/20.
- **Acceptance status after the post-fix change:** separate agents repeated the targeted fixes, full drag/scroll matrix, nested ownership, and dynamic mutation checks. Physical-device inertia/pinch and strict continuous-swipe ownership remain release limitations.
- **2026-07-19 follow-up pass:** Phase 4.2 implementation now removes blanket drag-scene `userSelect: none`; selection suppression is scoped to active dragging, and drag `touchAction` resolves by axis to preserve the perpendicular pan/pinch-zoom intent. Focused Scene/native-pointer/drag-release tests pass.
- **2026-07-19 follow-up pass:** Scene discovery no longer relies on `displayName === 'Scene'`; production recognition uses the explicit `cineViewScene` marker, including wrapped/memo/forwardRef scene components. Legacy displayName-spoofed children now receive an actionable development warning in both drag and scroll roots.
- **2026-07-19 follow-up pass:** `scripts/verify-build.js` now gates package exports, direct and packed-tarball `require('cineview')` / dynamic `import('cineview')` consumers, peer externalization, and source-map traceability; `pnpm verify` includes the new 12/12 build verify result.
- **Current independent browser lanes:** Phase 4.2 input/accessibility smoke and the broader drag/scroll/nested/dynamic matrix passed for supported paths. Phase 8.2 is complete with physical-device input and precision-profiler limits explicitly bounded.
- **Phase 4.2 browser evidence:** independent agent `019f7abe-6c5b-7de0-9206-cd5c13cb5049` verified desktop `1280x720` below-threshold rebound, drag forward/reverse, button/ref navigation, mobile `390x844` CDP touch-like forward/reverse, idle no blanket `user-select:none`, active-drag scoped selection suppression, `touch-action: pan-x pinch-zoom` on the drag y surface, console warning/error/pageerror `0`, RAF avg `16.67ms`, max `18.7/18.8ms`, and long tasks `0`.
- **Full browser matrix evidence:** independent agent `019f7ab5-f870-7591-b50b-4f8c877d3f26` verified desktop drag rebound/slow forward/slow reverse/quick flick/button navigation/repeated traversal, mobile `390x844` CDP touch forward/reverse plus `touchcancel` and `pointercancel` stability, scroll center-lock `0→100%` and reverse `100%→0%`, wheel/keyboard/scrollbar parity, large-flick anti-skip, reverse multi-zone order, resize, mobile scroll, console warning/error `0`, FPS about `58.5/60`, long tasks `0`, and no visible supported-path overlap/horizontal overflow.
- **Nested/dynamic fixture follow-up:** `examples/performance-test` includes `nested-scroll-fixture` and `dynamic-layout-fixture` in the ordinary document-flow interlude, with example unit coverage. Independent agent `019f7afe-1392-7c90-b826-5adfbc32829a` passed desktop `1280x720` and mobile `390x844` nested wheel/keyboard/touch-like ownership under the boundary-transfer interpretation, plus dynamic expand/collapse and forward/reverse traversal. Desktop/mobile FPS was about `60`, P95 frame interval `18.6ms` (fresh mobile `17.6ms`), long tasks `0`, and warning/error/pageerror `0`. The stricter single-owner-across-one-continuous-mobile-swipe property remains unverified.

### Current Browser-Blocker Closure Plan

The following nodes are the active execution path. They refine Phase 1 and Phase 8.2 and take
priority over the broader backlog below.

- [x] **B1 Freeze and audit the native Pointer settle failures.**
  - Add focused cases for desktop `Scene 2 -> Scene 1` reverse release after a successful forward transition and mobile `390x844` forward release from `Scene 1 -> Scene 2`.
  - Cover slow release, quick release, `pointerup` delivered through element/window/document paths, lost capture, and cancellation where the test environment permits it.
  - Assert the final scene index, final scene offsets, release invocation count, and absence of a persistent half-transition state after the configured settle duration.
  - Exit criteria: the original desktop and mobile failures are either deterministic source regressions or are ruled out with a clean-server reproduction. The latter is the current result: three stale Vite processes explained the earlier failure, and fresh independent Pointer traversal did not reproduce it.

- [x] **B2 Diagnose and verify the drag release/settle pipeline without changing ownership.**
  - Primary files: `src/components/Scene/useNativePointerDrag.ts`, `src/components/Scene/useDragSceneEngine.ts`, `src/components/Scene/Scene.tsx`, and their focused tests.
  - Trace one gesture through pointer identity/capture, physical-pixel distance and threshold calculation, release direction, callback suppression, settle completion, render-lane commit, and scene-index update.
  - Preserve the unique writers of `renderProgress`, per-scene `elementElapsedMotion`, and `dragRelease`; do not add a second release/commit path to patch the symptom.
  - Exit criteria: forward/reverse commit exactly once at desktop and mobile viewports, below-threshold input rebounds, cancellation returns to a stable state, and button/ref navigation remains unchanged.
  - Outcome: focused tests and independent fresh-server desktop/mobile Pointer traversal pass; no source release-path change was needed after stale-server isolation.

- [x] **B3 Remove the Scene 5 subtitle/media/navigation overlap at the correct ownership layer.**
  - Start with `examples/performance-test/src/components/PagedScenes.tsx`; change framework layout/runtime code only if bounding-box evidence proves the example is not the owner.
  - Validate the title, subtitle, media, navigation, and viewport bounds at `1280x720` and `390x844`.
  - Exit criteria: subtitle/media and fixed-navigation intersections are `0 px2`, all measured content remains inside the viewport, and the fix does not mask overflow or fixed-layer defects. Independent post-fix measurement passed.

- [x] **B4 Bound currently untestable input ownership paths and record the support decision.**
  - The example now contains explicit nested overflow and dynamic-layout fixtures. Independent desktop/mobile evidence covers wheel, keyboard, touch-like boundary transfer, expansion/collapse, and reverse traversal. Physical-device inertia/pinch and strict single-owner continuity across one mobile swipe remain explicit limitations rather than silently treated as supported.
  - Exit criteria: the final framework verdict names the remaining input limits, their risk, and the release posture. The strict continuous-swipe invariant is a follow-up capability slice, not a hidden acceptance pass.

- [x] **B5 Run focused and complete automated verification after the fixes.**
  - Focused: native Pointer drag engine, Scene integration, affected example/layout tests, and any new nested-scroll/cancel suites.
  - Complete: `pnpm verify`, coverage, type-check, lint, example tests, `build:verify`, and packed-tarball `require`/dynamic-`import` smoke tests.
  - Exit criteria: all four coverage dimensions remain at or above 90%, ESM gzip remains below 50 KB, declarations/exports remain correct, and there are no unexplained React/framework warnings.
  - Outcome: `pnpm verify` passed after the follow-up framework changes; 87/87 root suites, 1195/1195 tests, 21/21 example tests, coverage 96.29/90.41/96.41/96.52%, and build verification 12/12. A clean-copy install with frozen root and example lockfiles reproduced the full matrix.

- [x] **B6 Obtain a fresh independent browser sign-off for supported paths.**
  - A separate acceptance agent must test drag forward/reverse, quick/slow release, rebound, cancel, desktop/mobile-sized viewports, controls, button/ref navigation, and repeated traversal.
  - The same lane must re-run scroll wheel/touch-like input/keyboard/scrollbar, nested ownership, large flick, reverse multi-zone traversal, resize, and dynamic content.
  - Record FPS, long tasks, visible layout shifts/overlaps, console warnings/errors, and whether concurrent animations/video scrubbing trigger visible stalls.
  - Exit criteria: no blocking issue remains on supported/exercised paths; unsupported physical-device behavior, strict continuous-touch ownership, and unavailable precision metrics are explicitly documented rather than reported as passed. Independent post-fix targeted checks, the earlier full scroll matrix, and the final nested/dynamic lane satisfy the supported-path sign-off.
  - Final nested/dynamic evidence: desktop and mobile nested wheel/keyboard/touch-like boundary transfer passed; dynamic expand/collapse changed `scrollHeight` by `85px` desktop and `216px` mobile and preserved forward/reverse zone traversal without skip/jump. All lanes reported `warning=0,error=0,pageerror=0`, about `60 FPS`, and zero long tasks.

- [x] **B7 Publish the final framework assessment and release decision.**
  - Re-score ease of use, extension coverage, professional-mode suitability, maintainability, duplication, and runtime lean-ness using the completed automated and browser evidence.
  - Separate verified facts, supported limitations, deferred P2/P3 improvements, and release blockers.
  - Exit criteria: Phase 8.2 supported paths and the conditional release posture are checked with evidence; unverified capabilities are named with follow-up scope.

### Final Framework Assessment (2026-07-19)

#### Decision

**Supported-path acceptance: PASS. General production readiness: CONDITIONAL, not yet a
blanket approval.** CineView is suitable for curated cinematic demos and controlled product
storytelling pages. It should not yet be presented as a fully frictionless general-purpose
interaction framework until nested input ownership, real touch/cancel coverage, and precise
hot-path profiling are formalized.

#### Logic and Architecture

- The drag dual-track model is coherent: `renderProgress` owns page movement/commit,
  `elementElapsedMotion` is scene-owned, and `dragRelease` is a read-only handoff directive.
  Fresh independent desktop/mobile traversal confirms release settles to integral scene states.
- Scroll now has a stable external timeline store and measured gesture-burst layout reads;
  center-lock, reverse re-entry, large-input anti-skip, keyboard and scrollbar paths passed the
  independent matrix.
- Scene, Animate, Position, Container and Image have understandable primary boundaries, but
  `CineView` still injects large runtime objects through `cloneElement` in the render path
  (`src/components/CineView/CineView.tsx`), so the ownership model is cleaner than the React
  update graph.

#### Performance

- Automated coverage is `96.29% / 90.41% / 96.41% / 96.52%` for statements/branches/functions/lines.
- ESM gzip is `45.69 KB`, UMD gzip is `38.81 KB`; package `import` and `require` smoke tests are now part of `build:verify`.
- Independent browser observation reached approximately 60 FPS for the exercised drag/scroll
  paths with no observed long task. Exact React commit counts, listener counts and heap snapshots
  were not available, so those are not claimed as verified.
- Remaining hot-path risks: `AnimateRenderBridge` uses React state for render-prop MotionValue
  updates (`src/components/Animate/AnimateRenderBridge.tsx`), and drag root renders still rebuild
  injected Scene runtime objects. These are acceptable for current sample sizes but should be
  profiled before high-concurrency video/story deployments.

#### Ease of Use and Extension

- The public mode model is readable and the animation vocabulary is broad, with `waitFor`,
  visibility gates, media and scene-scoped fixed layers covering common narrative use cases.
- Extensibility is only moderate: DOM/ref/event forwarding and custom animation property contracts
  are not uniformly broad, Scene discovery now uses an explicit marker with development warnings
  for displayName-spoofed children, and authors must understand when `Container` is required for
  px2vw conversion.
- Drag Scene no longer applies blanket `userSelect: none` / `touchAction: none` to the whole Scene:
  text selection is left available while idle, active dragging scopes selection suppression, and
  the touch-action policy is axis-specific. Independent browser smoke passed for desktop pointer
  and mobile CDP touch-like gestures; physical-device inertia/pinch remains outside this lane.

#### Maintainability and Duplication

- The pure registry/reducer/helper tests are strong and the test suite is broad; the final matrix
  had 87 root suites/1195 tests and 21 example tests passing.
- Maintainability remains mixed because `CineView`/`Scene` are large composition modules, legacy
  compatibility fields remain internally, and runtime context values span several ownership
  concerns. Production duplication is low, but test fixture duplication remains material.
- Recommended next refactor: isolate input adapters, scene descriptor injection, imperative API
  assembly and profiling hooks without introducing another shared mutable progress owner.

#### Acceptance Boundaries and Advice

- Passed independently: desktop/mobile Pointer drag forward/reverse/settle, rebound, button/ref
  navigation, repeated traversal, scroll wheel/keyboard/scrollbar/large-flick/reverse multi-zone,
  resize, console hygiene, Scene 5 geometry and supported-path performance observation.
- Not verified: physical-device touch inertia/pinch, strict single-owner continuity across one
  continuous mobile swipe, exact React-commit/listener profiling, heap growth after repeated
  traversal, and full mobile composition quality for arbitrary authored child styles. Nested
  scroll handoff and dynamic mutation/layout injection were independently exercised at desktop
  and mobile sizes under the boundary-transfer interpretation. Pointer/touch cancellation was
  verified in the Chromium/CDP lane.
- Recommended release posture: **beta / controlled production use** for authored narrative pages;
  defer a broad “professional general-purpose framework” claim until the unverified input paths
  receive fixtures and the hot-path risks are measured with Profiler/PerformanceObserver data.

### Current Verification Commands

Run this matrix after the current browser-blocker fixes and again before Phase 8 sign-off:

```bash
pnpm type-check
pnpm lint
pnpm test --runInBand
pnpm test:coverage --runInBand
pnpm build:verify
pnpm --dir examples/performance-test test
```

Record the root and example results separately so a passing root Jest run cannot hide an
example-suite regression.

### Node Sign-Off Template

For each remediation node, append evidence before changing `[ ]` to `[x]`:

1. Changed files and the ownership invariant affected.
2. Focused tests and their result, including a regression test for the original failure.
3. Static/build/coverage evidence required by the node.
4. Self-review result: no stale names, duplicate path, dead field, or half-migrated branch.
5. Independent browser-lane result for any drag/scroll, visual, accessibility, or runtime-performance behavior.

### Phase 0 — Reproducible Acceptance Baseline

- [ ] **0.1 Freeze the current browser failures and warning evidence as executable acceptance cases.**
  - Likely areas: `examples/`, drag/scroll example routes, browser acceptance notes or scripts, focused integration tests under `src/**/__tests__`.
  - Capture: drag forward/backward gestures, drag release/bounce, scroll forward/reverse center-lock, keyboard, scrollbar, large flick, multiple zones, nested interactive content, and the known clipped scenes.
  - Exit criteria: every current blocker has deterministic steps, viewport/input details, expected state transitions, and a failing automated assertion where practical.
  - Verification: run focused tests and have an independent browser lane reproduce the drag failure, clipping, and warning burst before fixes begin.

- [x] **0.2 Define measurable runtime budgets for the remediation.**
  - Likely areas: `DESIGN.md`, performance example, profiler/browser acceptance checklist, package scripts if a repeatable measurement command is added.
  - Record budgets for React commits during continuous scroll/drag, layout reads per gesture burst, listener count, long tasks, concurrent Animate instances, video scrubbing, and heap growth after repeated traversal.
  - Exit criteria: the plan has before/after metrics that judge per-frame work, not only FPS or bundle size; measurements are reproducible at fixed viewport and scenario data.
  - Evidence: `examples/performance-test/profile-browser.mjs` runs fixed drag/scroll scenarios and records FPS, P95 frame interval, long tasks, React commits, layout reads, listener growth, and heap growth. Regression budgets gate the command; stricter professional targets are reported separately and currently fail where Phase 3 optimization remains required.

### Phase 1 — Restore Core Interaction Correctness

- [ ] **1.1 Diagnose and fix the drag gesture blocker without changing the dual-track ownership model.**
  - Likely areas: `src/components/CineView/`, `src/hooks/useSceneManager.ts`, `src/utils/gestureDetector.ts`, `src/utils/gestureHandlers.ts`, drag runtime hooks and focused drag tests.
  - Trace pointer/touch start, threshold resolution, release instruction, render-lane commit, scene index update, and element-track elapsed values with temporary diagnostics.
  - Exit criteria: forward and backward gestures commit exactly once; below-threshold gestures rebound; button/ref navigation remains correct; no second writer is introduced for `renderProgress`, `elementElapsedMotion`, or `dragRelease`.
  - Verification: focused unit/integration tests, full type/lint checks, and independent browser acceptance for mouse/touch forward, reverse, quick flick, slow drag, cancellation, and release/bounce.

- [ ] **1.2 Correct the known scroll/drag clipping and occlusion failures at the layout ownership boundary.**
  - Likely areas: affected examples, `src/components/Scene/`, `src/components/Position/`, scene fixed-layer host/scaffolding, layout measurement helpers.
  - Determine whether each failure is framework layout, fixed-layer lifetime/z-index, measurement footprint, or invalid example composition before editing.
  - Exit criteria: content remains visible at supported desktop/mobile viewports; fixed layers cannot escape their scene; layout footprint excludes non-layout scaffolding; no CSS workaround hides a runtime bug.
  - Verification: focused layout tests where stable, screenshot comparison at multiple viewports, and independent drag/scroll browser acceptance.

### Phase 2 — Public API and Runtime Semantic Correctness

- [ ] **2.1 Repair visibility margin wiring and lock the public naming contract.**
  - Likely areas: `src/components/CineView/runtimeContext.tsx`, CineView providers, `src/components/Animate/useAnimateScroll*`, public types, normalization helpers, API tests.
  - Resolve `visibilityEnterMargin`/`visibilityExitMargin` versus `scrollEnterMargin`/`scrollExitMargin` to one canonical internal shape; keep any compatibility mapping at a single boundary only if required.
  - Exit criteria: root defaults and per-Animate overrides reach the visibility calculation correctly in drag/scroll-relevant paths; generated declarations match source types.
  - Verification: positive/negative/custom margin tests, type fixtures, full grep for obsolete names, and browser checks at enter/exit boundaries.

- [x] **2.2 Split preload priority from background scene preloading.**
  - Likely areas: CineView preload orchestration, `src/hooks/useImagePreloader.ts`, `src/hooks/imagePreloadCache.ts`, Scene asset collection, Image/AnimateVideo preload integration.
  - Priority readiness should include only the assets needed to reveal the initial scene; later scenes should preload without blocking `onReady` or first visibility.
  - Exit criteria: slow/failing later-scene assets do not delay first-scene readiness; explicit `preload()` and cache deduplication still work; videos retain correct metadata/readiness semantics.
  - Verification: fake-timer/network-order tests, failure/timeout tests, cache reuse tests, and browser acceptance with throttled later-scene assets.
  - Follow-up status: current-scene assets are the only priority queue; remaining scenes are background/lazy. Focused tests, clean-install verification, and an independent fresh browser lane observed hero request at `165ms`/completion at `169ms`, with later assets requested at `185ms`.

- [ ] **2.3 Defer dependency validation until animation registration is stable.**
  - Likely areas: `src/animations/registry.ts`, Animate registration effects, dependency/delay cache, warning utilities and tests.
  - Separate registration from graph validation so ordinary React mount order does not emit false missing-`waitFor` or delay-cache warnings.
  - Exit criteria: valid async/mount-order dependencies produce no warnings; genuine missing IDs and cycles still produce one actionable diagnostic; StrictMode does not duplicate warnings or corrupt cache state.
  - Verification: ordered/reversed/conditional registration tests, StrictMode integration tests, warning-count assertions, and browser console acceptance with zero unexplained framework warnings.

### Phase 3 — Runtime Hot-Path Architecture

- [ ] **3.1 Split stable Scene registration APIs from per-frame timeline data.**
  - Likely areas: `src/components/Scene/sceneScrollRuntime.tsx`, Scene context definitions/providers, Animate hooks and registration effects.
  - Keep registration, scene identity, fixed-layer host, and callbacks in stable contexts; expose changing progress/phase through MotionValues or selector-based subscriptions.
  - Exit criteria: a scroll frame cannot unregister/re-register Animate IDs; stable consumers do not re-render when only progress changes; waitFor graph ownership remains centralized.
  - Verification: render-count and registration-count tests, StrictMode tests, React Profiler evidence, and single-owner self-review.

- [ ] **3.2 Replace scroll progress React-state fan-out with per-zone MotionValues or a narrowly subscribed external store.**
  - Likely areas: `src/components/CineView/DirectScrollCineView.tsx`, direct-scroll helpers/reducer, scroll runtime contexts, `useAnimateScroll`, callbacks/ref snapshots.
  - Keep native offset reduction and center-lock decisions under one scroll owner; derive zone progress once and write only changed zones without rebuilding a page-wide object every frame.
  - Exit criteria: continuous scroll updates visual MotionValues without a root React commit per frame; structural state such as active scene changes only at semantic boundaries; callback/ref snapshots remain current and deterministic.
  - Verification: reducer/property tests, render-count tests with many scenes/animations, multi-zone reverse traversal tests, profiler comparison against Phase 0, and independent browser acceptance for all input paths.

- [ ] **3.3 Stop cloning every Scene child on per-frame scroll updates.**
  - Likely areas: DirectScrollCineView child normalization/injection, Scene runtime providers, scene registration/layout maps.
  - Move stable runtime injection to one-time scene descriptors or context registration; preserve child keys, fragments, conditional scenes, and public React composition.
  - Exit criteria: scene elements retain identity during progress updates; only the active data subscriber receives hot-path changes; scene add/remove/reorder remains correct after layout refresh.
  - Verification: identity/render-count tests, dynamic children tests, refresh/goToZone tests, profiler evidence, and browser acceptance with multiple zones.

- [ ] **3.4 Consolidate visibility observation and layout measurement.**
  - Likely areas: visibility-mode Animate hook, shared observer/scheduler utility, CineView/Scene layout invalidation, resize handling.
  - Replace one scroll listener plus layout read per Animate with a root/scene-owned scheduler or observer that measures once per frame/invalidation and distributes visibility data.
  - Exit criteria: listener and layout-read counts do not scale linearly with Animate count; reads are batched before writes; resize/content changes invalidate measurements without stale visibility.
  - Verification: listener-count tests, measurement-spy tests, many-element stress case, resize tests, profiler/layout evidence, and independent browser acceptance.

- [ ] **3.5 Drive AnimateVideo directly from MotionValue subscriptions.**
  - Likely areas: `src/components/AnimateVideo/`, Animate render-prop bridge, media preload/cache tests.
  - Subscribe to the authoritative progress MotionValue and schedule/coalesce `currentTime` writes without React `setState`; define behavior before metadata is available and after source changes/unmount.
  - Exit criteria: frame scrubbing causes no React commit per progress tick; reverse playback and boundary clamping are correct; subscriptions and pending callbacks are cleaned up.
  - Verification: subscription/seek tests, render-count tests, source-swap/unmount tests, concurrent-video stress case, and browser performance acceptance.

### Phase 4 — Input Ownership and Accessibility

- [x] **4.1 Add nested-scroll ownership to wheel, touch, keyboard, and scrollbar intent handling.**
  - Likely areas: DirectScrollCineView input handlers/reducer helpers, DOM ancestry/overflow helpers, focused interaction tests.
  - Let a nested scrollable consume input while it can move in the requested direction; transfer ownership to CineView only at its boundary. Preserve center-lock anti-skip behavior once CineView owns the gesture.
  - Exit criteria: textarea/select/dialog/carousel/nested overflow content remains usable; direction reversal at nested boundaries is deterministic; no duplicate owner handles one delta.
  - Verification: DOM integration tests for nested overflow boundaries and independent browser tests for wheel, trackpad-like deltas, touch, keyboard, and scrollbar.
  - Follow-up status: helper-level ownership tests and the performance example's `nested-scroll-fixture` are covered by an independent `1280x720` and `390x844` browser lane. Wheel, keyboard, and touch-like input remain with the nested element while it can move; the next input at a boundary transfers to CineView without double consumption, including reverse direction. Strict single-owner continuity across one continuous mobile swipe remains explicitly unverified.

- [x] **4.2 Remove blanket interaction suppression and define explicit touch/text-selection policy.**
  - Likely areas: Scene/CineView styles, drag gesture activation, interactive target guards, public config/types if opt-in behavior is needed.
  - Avoid global `userSelect: none` and `touchAction: none`; scope suppression to active gestures and preserve pinch zoom, links, controls, editable content, and text selection where the framework does not own the interaction.
  - Exit criteria: normal content interaction works by default; drag still avoids accidental selection during an active gesture; accessibility zoom is not blocked.
  - Verification: style/unit tests and independent mobile/desktop browser checks across interactive descendants.
  - Follow-up status: implementation, automated tests, full `pnpm verify`, and independent browser acceptance are complete for the supported desktop pointer and mobile CDP touch-like paths. Physical-device inertia/pinch remains an acceptance boundary, not a blocker for this node.

- [x] **4.3 Align scrollbar defaults with the specification and expose accessible semantics.**
  - Likely areas: scrollbar config normalization, DirectScrollCineView scrollbar DOM, public types/docs and tests.
  - Implement keyboard-operable `role="scrollbar"`, orientation, min/max/current values, focus styling, and an accessible label; document whether native or custom scrollbar is the default.
  - Exit criteria: defaults match `DESIGN.md`; screen-reader state tracks zone/native offset; keyboard controls use the same reducer as wheel/touch and cannot skip locked segments.
  - Verification: role/value/keyboard tests, accessibility audit, and independent browser acceptance.
  - Follow-up status: `role=scrollbar`, configurable `aria-label`, orientation, min/max/current values, keyboard Home/End/Page/Arrow handling, and visible focus outline are covered by tests and independent desktop/mobile browser evidence. Keyboard traversal remained inside center-lock segments.

### Phase 5 — Extensibility and Developer Experience

- [ ] **5.1 Add consistent DOM attribute, event, className/style, and ref forwarding to public layout components.**
  - Likely areas: CineView, Scene, Position, Container, Image, Animate/AnimateVideo wrappers, public prop types and API tests.
  - Define collision precedence between framework-owned styles/handlers and consumer props; compose event handlers instead of silently replacing either side.
  - Exit criteria: consumers can attach IDs, data/ARIA attributes, test hooks, handlers, and refs without wrapper hacks; framework invariants cannot be overwritten accidentally.
  - Verification: TypeScript fixtures, ref/handler composition tests, ARIA propagation tests, and generated declaration inspection.

- [x] **5.2 Replace `displayName === 'Scene'` recognition with an explicit internal Scene marker/registration contract.**
  - Likely areas: CineView child discovery, Scene export, memo/forwardRef wrappers, fragment/conditional-child normalization.
  - Exit criteria: minification, aliases, memo, forwardRef, and supported wrappers do not break Scene discovery; unsupported child shapes fail with an actionable development warning.
  - Verification: wrapped/aliased/minified-like component tests, dynamic children tests, and production build smoke tests.
  - Follow-up status: production discovery now uses the explicit `cineViewScene` marker and no longer accepts `displayName === 'Scene'`; wrapped/memo/forwardRef tests pass, unsupported legacy displayName-spoofed children receive an actionable development warning in drag and scroll roots, and CineView/direct-scroll suites plus full `pnpm verify` pass. Dynamic authored children remain a broader Phase 8 fixture gap, not a blocker for this recognition-contract node.

- [ ] **5.3 Define the supported custom animation property extension surface.**
  - Likely areas: animation parser/composer/registry, Animate style mapping, public animation types, preset tests and documentation.
  - Decide whether custom animations are intentionally limited to the current interpolated property set or expose a typed property/plugin contract; reject unsupported values early rather than silently ignoring them.
  - Exit criteria: the extension contract is explicit, typed, composable with waitFor/sequential/parallel behavior, and does not introduce per-frame object allocation or React state.
  - Verification: type fixtures, parser/composer tests, custom animation examples, bundle/runtime cost review.

### Phase 6 — Maintainability and Duplication Reduction

- [ ] **6.1 Remove internal legacy Scene props and dead scroll-manager transition state after usage proof.**
  - Likely areas: `src/components/Scene/types.ts`, normalization helpers, `src/hooks/useSceneManager.ts`, runtime context/types, tests/examples.
  - Inventory every compatibility field and state transition with `rg`; retain a migration adapter only when a real supported consumer requires it.
  - Exit criteria: no zero-consumer fields, exports, callbacks, state branches, or fallback names remain; public API type rejection tests stay green.
  - Verification: full-repository grep, type-check, focused behavioral tests, coverage review, and bundle inspection.

- [ ] **6.2 Split oversized runtime modules along ownership boundaries.**
  - Likely areas: `DirectScrollCineView.tsx`, Scene runtime, Animate hooks, preload orchestration.
  - Extract pure intent reduction, layout registry/invalidation, input adapters, scrollbar view, and imperative API assembly only where each extracted unit has a clear owner and focused tests.
  - Exit criteria: root components primarily compose owners; extracted modules do not share mutable refs implicitly; no new abstraction duplicates existing helpers.
  - Verification: unchanged behavior tests, module dependency review, function/file size review, and hot-path allocation review.

- [ ] **6.3 Consolidate repeated test fixtures without hiding behavioral differences.**
  - Likely areas: repeated CineView/Scene setup, observer/motion mocks, drag/scroll input factories, example test configuration.
  - Prefer typed builders and semantic gesture helpers; keep scenario-specific assertions local and readable.
  - Exit criteria: materially lower test duplication than the current ~14.75%; root and example suites use the same authoritative interaction vocabulary; helpers do not encode the implementation under test.
  - Verification: duplication report, mutation/revert-to-confirm-red spot checks, and full test suite.

### Phase 7 — Professional Release Hardening

- [ ] **7.1 Restore and reconcile the missing project documentation artifacts.**
  - Likely areas: root `README.md`, `requirements.md`, `AGENT_SELF_REVIEW.md`, coverage/report documentation, examples.
  - Document installation, peer dependencies, mode selection, core examples, accessibility/input constraints, browser support, SSR expectations, migration policy, troubleshooting, and measured performance limits.
  - Exit criteria: onboarding references resolve; public examples compile against the published API; historical documents cannot override `DESIGN.md`.
  - Verification: link/code-example checks and a clean consumer-project smoke test.

- [x] **7.2 Modernize package exports and debugging artifacts.**
  - Likely areas: `package.json`, Vite/Rollup config, generated declarations, dist verification scripts.
  - Add an explicit `exports` map with import/require/types entries, preserve peer dependency externalization, and decide/publish source maps appropriate for a professional library.
  - Exit criteria: ESM and CJS/UMD consumer smoke tests resolve only supported entry points; declarations and source maps map back to source; no bundled React/Framer Motion copy.
  - Verification: packed-tarball installs in clean fixture projects, dist inspection, and build verification.
  - Follow-up status: `build:verify 12/12` checks package exports, packed-tarball require/import consumer smoke, peer externalization, and source-map traceability against `dist`; clean-copy frozen installs reproduce the complete verification matrix.

- [x] **7.3 Turn size, warning, coverage, and example drift into CI gates.**
  - Likely areas: package scripts, `test-threshold.js`, build verification, example Vitest config, CI workflow.
  - Include `examples/performance-test` in the authoritative test command after repairing its stale six expectations; fail on unexpected React/framework console warnings and enforce actual compressed artifact limits.
  - Exit criteria: one documented verification command covers root tests, examples, type-check, lint, coverage, build, package smoke tests, and warning hygiene; a deliberate regression proves each gate fails.
  - Verification: `pnpm` clean-install CI-equivalent run and failure-injection checks.
  - Follow-up status: `pnpm verify` now covers type-check, lint, coverage, example tests, `jscpd` production duplication threshold, compressed bundle size, package exports, packed consumer smoke, peer/source-map checks, and four deliberate failure injections. Root/example console gates fail on unexpected `warn/error`; clean frozen installs pass.

### Phase 8 — Final Integrated Acceptance

- [x] **8.1 Run the complete automated verification matrix.**
  - Required: type-check, lint, all root/example tests, coverage thresholds, build verification, package-consumer fixtures, duplication scan, warning gate, and bundle/source-map inspection.
  - Exit criteria: all commands pass from a clean install; generated dist/types match source; no unexplained console warnings or ignored failing suite remains.
  - Evidence: current and clean frozen-install `pnpm verify` pass; root `87/87` suites / `1196/1196` tests, examples `5/5` files / `22/22` tests, coverage `96.29% / 90.46% / 96.42% / 96.52%`, `build:verify 12/12`, duplication `1.72%`, and warning/coverage/duplication/bundle failure injection all pass.

- [x] **8.2 Run independent real-browser drag and scroll acceptance on desktop and mobile-sized viewports.**
  - Required drag paths: forward/reverse, below-threshold rebound, quick flick, slow drag, touch/pointer cancellation, controls inside scenes, ref/button navigation, and repeated traversal.
  - Required scroll paths: `0→100%` lock/release, `100%→0%` reverse re-lock, wheel/touch/keyboard/scrollbar parity, nested scrolling, large-flick anti-skip, multiple zones in reverse order, resize, and dynamic content.
  - Performance observation: concurrent Animate instances, visibility animations, video scrubbing, React commit counts, long tasks, layout reads, listener cleanup, and heap after repeated traversal.
  - Exit criteria: acceptance agent reports no blocking functional/visual/accessibility regression and measured hot-path budgets from Phase 0 are met.
  - Evidence: independent agents passed the drag/scroll supported matrix, nested ownership under boundary-transfer semantics, and dynamic layout mutation at `1280x720` and `390x844`; fresh lanes reported zero warnings/errors/pageerrors, approximately `60 FPS`, and zero long tasks. Repeatable profiling measured React commits, layout reads, listener growth, and heap growth: regression budgets pass, while professional targets fail at scroll `3.38 commits/input` and `3.70 layout reads/Animate/input`, and drag `4.54 commits/input`. Single-owner continuity across one physical mobile swipe remains unverified and is a release limitation.

- [x] **8.3 Reassess professional readiness and publish the final framework verdict.**
  - Re-score usability, extension coverage, professional-mode suitability, maintainability, duplication, and runtime lean-ness using evidence from the completed nodes.
  - Exit criteria: remaining limitations are explicitly documented with severity and workaround; no P0/P1 item is deferred under a passing-test rationale; release decision is evidence-based.
  - Decision: supported-path acceptance and release engineering gates pass, but general production readiness remains conditional. Recommended posture is controlled narrative production use until strict continuous-touch ownership and the measured Phase 3 React/layout hot-path targets are addressed.

### 2026-07-20 Hardening Result

- Completed: warning/error gate, duplication gate, four failure-injection checks, clean-install verification, scrollbar accessibility, priority/background preload ordering, shared visibility-root measurement, and repeatable browser profiling.
- Browser acceptance: independent fresh desktop/mobile lanes passed scrollbar keyboard behavior, preload ordering, drag/scroll forward/reverse, `390x844` touch-like input, zero warning/error/pageerror, and zero long tasks.
- Runtime profile: regression budgets pass at about `60 FPS`, P95 frame interval `18.6ms`, zero long tasks, stable heap growth, and bounded listener growth. The stricter professional targets still fail at scroll `3.38 commits/input` and `3.70 layout reads/Animate/input`, and drag `4.54 commits/input`; this remains an explicit Phase 3 optimization item, not a hidden pass.

## Recommended Delivery Slices

1. **Release blocker slice:** Phase 0, Phase 1, and Phase 2.
2. **Runtime architecture slice:** Phase 3, followed immediately by independent performance/interaction acceptance.
3. **Production usability slice:** Phase 4 and Phase 5.
4. **Maintainability/release slice:** Phase 6 and Phase 7.
5. **Release candidate sign-off:** Phase 8.

Do not combine the runtime architecture slice with public API expansion in one implementation task. Each Phase 3 node should have its own task-flow because it changes hot-path ownership and requires a focused rollback boundary.

## 2026-07-20 Final Hardening Execution

- [x] Add repository-owned warning, duplication, and failure-injection gates to the authoritative verification command.
- [x] Re-verify scrollbar ARIA, keyboard reducer parity, and visible keyboard focus; close Phase 4.3 with focused and browser evidence.
- [x] Re-verify first-scene priority versus later-scene background preload ordering; close Phase 2.2 with focused evidence.
- [x] Add a repeatable browser profiling lane for React commits, listeners, layout reads, long tasks, FPS, and heap.
- [x] Run focused/full verification, clean-install verification, and independent desktop/mobile browser acceptance.
- [x] Re-read touched code, remove stale evidence, and publish the final release decision.
