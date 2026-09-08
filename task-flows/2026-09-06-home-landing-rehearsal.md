# Homepage scenes 3–5 — design discussion

Current continuation: [2026-09-08 homepage acceptance](./2026-09-08-home-acceptance-closure.md). The approved V8.3 implementation and subsequent scene 4/5 corrections supersede the earlier proposal/approval checkpoints below. Static checks and independent desktop/mobile browser acceptance now pass. Earlier unchecked acceptance entries are historical; the continuation records the final evidence.

## Historical direction — V8

The user wants attractive non-photorealistic elements/icons in both scenes 3 and 5, with visual material and copy entering together, in an elegant and softly expressive style. V8 fixes the visual treatment as translucent paper planes with fine-line illustrations and fixes scene 5 as product introduction, brand story, and editorial feature. Both remain natural-scroll sections; scene 4 keeps the particle Canvas scroll region. No `/drag` cases, first-scene edits, implementation, final asset generation, or service startup are authorized by this design discussion.

The user additionally requires designed exits. V8 specifies distinct scene 3/5 visual-and-copy exits, readable grouping, and loop-to-exit handling. The current native code supports both upper-bound forward exits and lower-bound reverse exits; leaving a loop stops it at its current state rather than waiting for a full cycle. Whole-plan approval is still pending.

- [x] Archive V6 and add concrete exit choreography for scenes 3 and 5.
- [x] Update topology and native behavior notes for bidirectional exits, loop stopping, and short group timing.
- [x] Verify the proposal contains no automatic loop-return or full-cycle-wait promise.

A single grill-me question previously asked about visual treatment. V8 closes that question with translucent paper-like planes and fine-line illustrations; watercolor is not part of the implementation baseline. Timing and application copy are now specified in the proposal and still require whole-plan approval.

- [x] Archive V5 and update proposal/topology for visual elements and coordinated copy entrances in scenes 3 and 5.
- [x] Supply concrete visual motifs and choreography recommendations for user review.
- [x] Check for obsolete scene 3 static-only / scene 5 typography-only statements.
- [ ] Confirm visual treatment and obtain explicit approval of the complete proposal before implementation.

## Accepted user direction

- The preceding sequence/coordinate/stagger playground design was rejected as too rough and dependent on controls. It is not the approved final design.
- Use grill-me to resolve design decisions one question at a time, with a recommendation for each question. Check code for questions that have factual code answers.
- User explicitly requires a complete proposal, topology diagram, copy, and described effects for review. Runtime implementation, final visual asset production, and service startup must wait for explicit approval of the whole proposal. Approval of one individual design choice is not permission to start implementation.
- Redesign only scenes 3–5. Each has its own visual subject. Preserve the original first scene and the previously accepted scope of the other scenes.
- Reference the structural layouts of About Company, How It Works, Many Great Features, and Client-Centric Services at https://shadcn-landing-page.vercel.app/.
- Keep the existing warm theme and typography. Avoid a photorealistic direction.
- Current behavior: scenes 3 and 5 both pair attractive visual elements/icons with copy and coordinated entrances during natural scrolling; scene 4 is the regional-scroll particle Canvas demonstration. V8 records the visual baseline and choreography; whole-plan approval remains pending.
- Scenes 3 and 5 use natural page scrolling with visual/copy animation. Scene 4 uses a native scroll zone. Scene 5 must not reuse `/drag` cases.
- Scene 4 controls a Canvas transformation from one phrase to another, with intermediate patterns. The user explicitly confirmed that all text/patterns are drawn live by HTML Canvas, not produced with the Canva design service.
- Latest content direction: scene 3 is specifically about Scenes, includes the feature explanations previously placed in scene 5, and considers panels/translucent background layers. Scene 4 opens with a Canvas extensibility title and ends with a concise invitation to imagine richer scenes; all visible text and patterns are made of particles. Scene 5 introduces scene examples only.
- Scroll mode has no mobile support requirement.
- All seven leftover project dev/preview services and the task-owned acceptance browsers were stopped. Do not start a local service during this design discussion. For later implementation acceptance, inspect/reuse existing services and keep one server.

## Reference structures verified from public components

- About: a bordered section with a main illustration on the left and introduction/information on the right.
- How It Works: centered heading and introduction over a four-column card group.
- Features: heading, feature tags, and three illustrated cards.
- Services: vertical information cards on the left and a large illustration on the right.

The remote page did not load through the in-app browser. Structural observations were verified through the deployed HTML and the author's public components at https://github.com/leoMirandaa/shadcn-landing-page/tree/main/src/components. No visual screenshot inspection is claimed.

## Previously checked native animation facts — relevant to natural-scroll scenes 3 and 5

- With no Scene.scroll zone, default scene driver and explicit clock use visibility-driven timing in scroll mode. Enter, loop, and exit are available.
- Enter can be sequenced with animateId, timeline.after/delay, and time-driven stagger. Keep sequences short so they remain useful during ordinary reading.
- Current source supports forward exit across the upper boundary and reverse exit across the lower boundary. Overlapping gates hold the current phase. Increasing exitMargin does not guarantee an earlier center-screen exit; do not group a whole long section into a single early exit.
- Loop is eligible only after entry and while on-screen. On exit it stops immediately, without waiting for a full cycle or automatically returning to its origin; the outer exit must accommodate the current small loop offset. Keep remaining body text readable.
- Manual enterRef/exitRef and framework changes are not needed for this proposed behavior.
- Free scrolling cannot guarantee viewers see every animation at every scroll speed. Browser acceptance must include fast forward/reverse input.

## Decisions and next nodes

- [x] Confirm scenes 3–5 scope and independent subjects
- [x] Confirm reference layouts and existing theme
- [x] Verify natural-scroll enter/loop/exit and sequencing support
- [x] Verify existing native scroll progress can drive Canvas drawing without a second animation clock
- [x] Confirm scene 3/5 illustration and icon style, and scene 4 particle shapes
- [x] Finalize scene 3/5 copy, visual subjects, layout, and coordinated entrances; retain scene 4 particle choreography for review
- [x] Deliver the complete review proposal with topology, copy, visual direction, and animation choreography
- [ ] Receive explicit user approval of the complete proposal before implementation
- [ ] Implement the agreed design
- [ ] Verify desktop appearance and native animation behavior with one reused service

No runtime code was changed during this discussion.

## Review submission V1

Submitted `review/home-landing-2026-09-06/proposal.md` with the layout topology, Chinese/English copy, icon and illustration subjects, proposed timing tables, and native animation boundaries. Editable topology: `review/home-landing-2026-09-06/topology.mmd`.

Mermaid source was checked for consistency with the proposal. The skill renderer was invoked but local `mmdc` is unavailable, so no SVG/image output is claimed. The editable Mermaid diagram is included in the proposal and can render in a Markdown viewer. No dependency was installed and no local server was started.

The complete proposal remains pending user review and explicit permission to begin implementation. Visual material, copy, and choreography are proposals, not approved designs.

## Review submission V2

The user changed scene 4 to an extensibility demonstration with a native scroll zone and confirmed HTML Canvas draws all stage text and patterns. This replaces the four-step natural-scroll section. Scenes 3 and 5 remain introductions with natural scrolling. Existing scene 6 is outside the authorized redesign scope; scene 4 proposes two phrases and geometric patterns to distinguish it from scene 6's existing particle-word assembly.

Updated `proposal.md` and `topology.mmd`. V1 was preserved as `proposal-v1.md` and `topology-v1.mmd`. Canvas binding was verified against the existing scene 6 implementation: one native progress source, deterministic drawing, no independent animation clock. True time-based loop remains in natural introduction sections; scene 4 freezes when scrolling stops and retraces with reverse scrolling.

V2 proposes the phrases “从组件动画” → “到自定义绘制”, intermediate framing/ring/page patterns, and a 3600 px zone with five progress segments. These creative choices and distances are pending review. The user has approved the mode division and drawing technology, not the complete implementation proposal. No runtime code, formal visual assets, or services were started.

## Review submission V3

Revised the complete proposal for the user's latest direction: scene 3 introduces Scenes and contains the feature explanations, with layered translucent panels; scene 4 opens with a Canvas extensibility title and uses particles for every visible stage letter and pattern; scene 5 presents scene examples only.

The proposed scene 4 closing is “让想象成为场景”. The 3600 px regional scroll and five progress segments remain pending review. The opening title is recognizable at the start of the region. All transitions use one deterministic progress source; natural sections retain time-based local loops.

Scene 5 proposes Dial, Editing desk, and Aperture from the existing single `/drag` experience, accurately labeled as a scene selection. There are no individual scene routes. Case selection, copy, visuals, and timing remain pending; a single grill-me question asks whether to use these existing scenes or develop new themed cases.

Updated `review/home-landing-2026-09-06/proposal.md` and `topology.mmd`; archived V2 as `proposal-v2.md` and `topology-v2.mmd`. Verified embedded Mermaid matches its editable source and both earlier versions remain available. No SVG rendering, runtime implementation, formal visual assets, or local service startup is claimed. Explicit approval of the entire proposal is still required before implementation.

## Review submission V4

Removed all proposed animation and live-preview behavior from natural-scroll scenes 3 and 5, including entrances, loops, exits, stagger, moving panels, and visibility-triggered delays. Scene 3 uses a text-led split layout with static translucent background panels and feature descriptions. Scene 5 proposes static textual application plans for product introductions, brand stories, and editorial features, with no `/drag` cases or navigation to them. These application topics remain pending user review.

Scene 4 retains the regional-scroll particle Canvas proposal. Removed the assignment of time-based loops to natural sections; no replacement independent-clock loop has been approved. The earlier requirement to consider loop animation does not authorize adding it back to static sections.

Archived V3, synchronized editable topology with the embedded diagram, and checked that rejected case names and old natural-section effect instructions are absent from the current proposal. Historical versions remain evidence of superseded proposals. Only review files and this task-flow changed; no runtime work or service startup. Full proposal approval is still pending.

## Review submission V5

The user explicitly requires animation in scene 5 without regional scrolling, then selected text/layout animation in the grill-me question. Scene 3 stays static, scene 4 retains its particle Canvas scroll region, and scene 5 has natural-scroll title/card entrances and exits with light decorative loops. No `/drag` cases, separate thematic graphic animations, fixed stage, extra scroll distance, or playback controls are included.

Proposed choreography: a 400 ms heading entrance, 500 ms card entrances staggered by about 120 ms, one small decorative marker looping over about 4 s, and 320 ms decorative exits with readable body copy. These specifics and the application copy/topics remain pending full proposal review. Updated all current summary, scope, topology, scene 5, behavior table, and approval-table statements; archived V4 and verified topology consistency.

Only review documents and this task-flow changed. Services remain stopped, no runtime implementation or formal visual assets were produced, and full proposal approval remains pending.

## Review submission V6

User requested elegant, non-photorealistic icons/visual elements in both scenes 3 and 5, entering with their copy. Current proposal recommends translucent paper-like planes and fine-line illustrations using verified existing warm colors/fonts; watercolor is a pending alternative in one grill-me question. Scene 3 proposes layered scene pages and four semantically meaningful icons. Scene 5 proposes three small editorial compositions for the still-pending product/brand/editorial topics.

The asset and its title begin together; body copy follows by roughly 100–160 ms. Proposed layered entrances take 600–800 ms per group, with restrained local looping and decorative exits. All creative specifics remain pending. Scene 4’s regional particle Canvas proposal and the no-`/drag` rule remain intact.

Archived V5, checked current proposal/topology consistency and absence of obsolete static-only constraints. Read existing theme tokens and hero code without changing them. Applied frontend-design and grill-me; a read-only subagent supplied motif suggestions. No production assets, implementation, or services were started.

## Review submission V7

Added detailed exit choreography for scene 3’s layered pages/functional text groups and scene 5’s three proposed application compositions. Visual forms gather locally before a short fade; titles and short descriptions follow with small overlap. Long text remains separately grouped so a section-level boundary does not clear it early. All timings and compositions remain proposals.

Verified focused current sources: natural exits support both boundaries; loop controllers stop on exit without waiting or automatic reset; after/delay are entrance dependencies, while exit keyframe timing is a distinct mechanism. Read-only agent corroborated grouping and fast/reverse-input risks. Direction-sensitive small offsets are proposed, not claimed implemented. Scene 4 retains its progress-driven closing and no additional clock.

Archived V6, verified embedded/source topology equality and review gate, retained all versions. Only review documents and task-flow changed. Style selection and complete user approval are still pending; no runtime changes, production assets, or services.

## Review submission V8

The latest project-history review was read before editing. The current proposal was complete in structure but still left the visual treatment and scene 5 topics open. V8 resolves those choices into an execution baseline: translucent paper planes with fine-line illustrations, and the three scene 5 topics product introduction, brand story, and editorial feature.

- [x] Preserve V7 as `review/home-landing-2026-09-06/proposal-v7.md` and `topology-v7.mmd`.
- [x] Update `proposal.md` to V8 with fixed visual/content choices, asset generation constraints, implementation ownership, and acceptance matrix.
- [x] Synchronize `topology.mmd` with the embedded Mermaid source in V8.
- [x] Keep the public API boundary unchanged: scene 3/5 natural scroll, scene 4 one `Scene.scroll` zone and one Canvas progress source.
- [x] Record that no runtime code, formal assets, browser service, or acceptance evidence was produced in this documentation pass.
- [ ] Receive explicit approval of the complete V8 proposal before implementation.
- [ ] Implement the approved design and produce the browser evidence described in the proposal.

The proposal now supplies all information needed for a single approval decision. It remains a review artifact; the unchecked approval and implementation nodes are intentional.

## Adversarial Review V8

The V8 proposal was reviewed against the current source and the 2026-09-05 implementation flow. The review found three blocking boundary conflicts: the approved target is different from the currently accepted interactive scenes; the proposal says 3600px while the current Canvas registers 9000ms (and therefore about 9000px); and the proposed Canvas states are not the current `CINEVIEW`-only implementation. Major follow-up gaps are explicit exit variants, `animateId` namespaces, raster-versus-SVG delivery, resource fallback, performance budgets, Canvas alternative text, and the duplicate Canvas responsibility between proposed scene 4 and retained scene 6.

- [x] Record evidence and line references in `review/home-landing-2026-09-06/adversarial-review-v8.md`.
- [x] Define five recommended approval boundaries: one target plan, one zone budget, one Canvas state table, one asset strategy, and one animation contract.
- [x] Preserve V8 unchanged so the review does not silently choose between the two competing homepage directions.
- [ ] Decide whether V8 replaces the 2026-09-05 interactive implementation.
- [ ] Resolve 3600px versus 9000px and update the proposal and source together.
- [ ] Approve the complete corrected proposal before implementation.

No runtime code, production asset, or browser service was changed in this review pass.

## V8 Implementation Pass: Scenes 3-4

The user selected the latest V8 design and limited the first implementation pass to scenes 3 and 4. Scene 3 will replace the temporary sequence demo with the Scenes introduction and inline vector artwork. Scene 4 will replace the temporary Position + Loop playground with the Canvas extensibility demonstration. Scene 5 and the retained scene 6 Canvas remain outside this pass.

- [x] Confirm V8 as the implementation source and limit scope to scenes 3-4.
- [x] Replace the scene 3 component with layered paper pages, four feature illustrations, bilingual copy, and native enter/loop/exit animation.
- [x] Replace the scene 4 component with the deterministic Canvas state table and explicit 3600ms scene budget.
- [x] Keep scene 5, retained scene 6 Canvas, Hero, film, performance, video, and Cinema unchanged.
- [x] Add focused site contract coverage for scene topology, Canvas progress states, and the 3600px budget.
- [x] Run site type-check, contract tests, build, and desktop browser acceptance; record evidence.

### V8 implementation results

- Scene 3 now uses `AboutScenesScene` with code-native layered paper artwork, four semantic line icons, bilingual copy, short visibility-driven enter/exit groups, and one gated loop marker. The paper artwork was moved into the first viewport's enter boundary after browser inspection found it waiting below the default bottom margin.
- Scene 4 now uses `CanvasExtensibilityScene` and `canvasExtensibility.ts`. One `Animate` owns `CANVAS_ZONE_MS = 3600`; the Canvas uses seven deterministic progress stops, bilingual opening/closing targets, frame/ring/layers intermediate targets, 1800 particles, and a static particle closing state for reduced motion.
- `Act3DollyScene`, `PositionLoopScene`, scene 5 `EmanationScene`, the retained scene 6 `ParticleCanvasScene`, and all later scenes remain mounted as before.
- Focused pure-function coverage passes for the 3600ms budget, seven stops, clamped progress, and boundary states. `pnpm type-check:site`, `pnpm test:site-contracts` (13 suites / 68 tests), and `pnpm --dir site build` pass. Build retains the existing large-chunk warning.
- Desktop browser acceptance at `http://127.0.0.1:4010/` passes with screenshots in `output/playwright/v8-scenes/`: scene 3 visible after native enter, scene 4 midpoint progress about `0.48` shows the particle ring, final progress about `0.97` shows the bilingual closing target, 1800 particles are reported, non-zero Canvas pixels are present, reverse scrolling returns to about `0.52`, and no console errors were observed.

## User Amendment: Remove Scenes 6-7, Rework Scene 5, Fullscreen Text Canvas, and Debug Controls

The user superseded the previous retained-scene boundary after the first V8 implementation pass:

- Remove the old sixth scene (`ParticleCanvasScene`) and seventh scene (`RuntimeControlScene`) from the homepage. Video and Cinema become scenes 6 and 7. The `/drag` route remains dark and unchanged.
- Replace the previous scene 5 stagger gallery with a new `EditorialIndexScene` composition. It uses one continuous editorial index with three application themes and no poster grid or prior control layout.
- Make scene 4 a fullscreen Canvas. Remove its visible DOM heading, frame metadata, grid decoration, and shape stages. Canvas now switches particle typography only as progress changes.
- Keep performance tooling. Add a public `CineView.debug` parameter, a homepage parameter-debug switch, and a draggable performance panel that starts collapsed so it does not cover bilingual content.
- Keep the primary warm accent `#d59273`, revise supporting warm neutrals and frame lines across the light homepage palette, and leave `/drag` black styling scoped to that route.

- [x] Remove old scenes 6 and 7 from `HomePage.tsx`; keep Video and Cinema as scenes 6 and 7.
- [x] Add the new Editorial Index scene 5.
- [x] Convert scene 4 to fullscreen text-only Canvas transitions.
- [x] Add `CineView.debug`, the homepage debug switch, and draggable/collapsed `PerfPanel` behavior.
- [x] Revise light-theme support colors and frame tokens without changing the primary warm accent or `/drag` surface.
- [ ] Run the final site type-check, site contracts, build, and browser acceptance for the seven-scene homepage.

### V8.1 implementation completion

- Scene 4 now uses five text-only particle states: `Canvas`, `Extensibility`, `Compose with components`, `Let type follow scroll`, and `Turn imagination into scenes` (localized in Chinese). The Canvas fills the entire scene and exposes no visible DOM heading or shape metadata.
- A terminal target duplicate fixed the progress-1 index boundary; focused tests now cover target count and final-state drawing.
- The performance panel remains available behind the homepage `参数调试 / Parameter debug` switch, starts collapsed, supports pointer dragging, and follows the active site language.
- Browser verification after the amendment reports seven scroll scenes, no old scene 6/7 mounts, three Editorial Index entries, a 1440x900 Canvas, 1800 particles, non-zero text pixels, and no page errors.

### V8.1 verification notes

- The seven-scene browser pass reports no old ParticleCanvasScene or RuntimeControlScene mount. Editorial Index renders three entries and no old Stagger replay control.
- Fullscreen Canvas occupies the 1440×900 scene, reports 1800 particles and non-zero pixels during a native wheel-driven zone pass, and no longer exposes the removed DOM heading or shape metadata.
- The parameter-debug switch renders the collapsed panel with the active Chinese label, exposes scroll geometry when enabled, and the expanded panel moves to a new position after a pointer drag.
- The Canvas target table now includes a duplicated terminal text state so progress 1.0 cannot index beyond the target array. Focused Canvas tests now cover target count and final-state drawing.

## V8.2 User-Approved Full Homepage Reframe

The user approved a full visual and narrative reframe after reviewing V8.1. This pass is not an incremental polish of the existing Editorial Index or technical labels.

- Remove visible stage numbers, `Animate / Scene`, `PAGE LAYERS`, `FOCUS`, `THREAD`, `INDEX`, and other implementation-facing labels from product scenes.
- Scene 3 becomes a content-composition page with plain-language copy and one visual editorial spread. Its capability statements are content relationships, not API annotations.
- Scene 4 becomes a fullscreen Canvas text transformation. The opening state uses product copy, not `Canvas`; five copy states are `场景，从内容开始`, `文字可以进入时间`, `滚动可以控制进度`, `每一帧都可以编排`, and `让想象成为场景` with localized English equivalents. Supporting brackets, baselines, and progress marks are drawn with the text and never become standalone scenes.
- Scene 5 becomes a single composition that morphs between product introduction, brand story, and editorial feature structures. It has no three-column card/list treatment and no prior stagger gallery.
- The homepage light palette uses warm ivory, burnt terracotta, and brass clay support colors while keeping the primary `#d59273`; `/drag` remains on its existing black surface.
- Performance diagnostics remain behind the homepage parameter-debug switch. The panel stays bilingual, collapsed by default, and draggable.

- [x] Record the approved V8.2 direction before implementation.
- [x] Replace scene 3 with the clean content-composition page.
- [x] Replace scene 4 with the final text-plus-supporting-lines Canvas states.
- [x] Replace scene 5 with the single-morph editorial composition.
- [x] Apply the homepage-only palette revision and retain `/drag` styling.
- [ ] Run the full homepage browser acceptance and update screenshots/evidence.

Implementation now uses a natural-scroll shared composition in scene 5. Discrete content visibility selects its product, brand, or feature layout; it adds no Scene.scroll budget and no per-frame React state. Scene 4 retains one 3600px source, adds multiline solid text for legibility with particle interpolation during transitions, and holds the final text through zone completion. UI Skills installed context was verified through the CLI (`mengto/landing-page`, `emilkowalski/animation-vocabulary`). Product content remains subject to browser review before completion.

### V8.2 static verification and remaining acceptance

- [x] Archive the previous proposal and topology as `proposal-v8-1.md` and `topology-v8-1.mmd`.
- [x] Replace the current proposal and topology with the V8.2 implementation, copy, theme scope, and verification status.
- [x] Remove product-facing implementation labels from scenes 3 through 5.
- [x] Keep a shared final Canvas target and explicit opaque exit; cover all text stops and the terminal state in focused tests.
- [x] Correct scene 5's visibility margins to derive from viewport height; percentage IntersectionObserver margins otherwise depend on width and can collapse on ultrawide screens.
- [x] Test skipped chapters, reverse selection, viewport resize, stable composition identity, and route palette isolation.
- [x] Run framework/site type checks, lint, 14 site suites / 72 tests, site production build, and `build:verify` (17/17).
- [ ] Run desktop/mobile browser screenshots, Canvas pixel/terminal/reverse checks, keyboard/wheel/scrollbar checks, performance-panel dragging and localization, and `/drag` appearance checks.

The site build retains the existing large-chunk warning. No new package was installed for the implementation. `BackgroundRibbon` selects the new LUT only on `/`; other routes use the previous LUT, and the new content tokens are scoped to `.home-page`.

Browser acceptance is currently blocked by automatic approval service failures (HTTP 503). Two attempts to start the local Chrome acceptance script and one in-app browser navigation were rejected before execution. This is an environment blocker, not a browser pass or an observed product failure. The prepared script is `output/playwright/v8-2-home/acceptance.mjs`; no V8.2 screenshots are claimed. A renewed approval request was sent after implementation and static verification were complete.

The Vite preview remains available at `http://127.0.0.1:4010/` for review while browser approval is pending. All verification command sessions have completed; the preview service is the only retained process. The acceptance script now includes performance-panel dragging/localization, wheel/keyboard/scrollbar input, a large reverse jump, reduced motion, and `/drag` surface color checks in addition to the screenshot and Canvas assertions.

## V8.3 User Correction: Particle Letterforms and Practical Animation Features

The user requires scene 4 letterforms to be generated entirely by two-color particles. Solid display-canvas text is not acceptable. The user accepts the scene 3/5 layout and requests richer layered/combined animation plus practical feature copy. Scene 3 must explain timing and sequencing with concrete examples; scene 5 must explain animation composition instead of generic product/brand/editorial applications. These decisions supersede the V8.2 solid-text choice and application copy.

- [x] Read current animation composition, timeline, and lifecycle APIs before changing the examples.
- [x] Draw every scene 4 text state using two-color particles only; retain multiline layout, reversible progress, guides, and terminal hold.
- [x] Keep scene 3 layout; add page-layer assembly, concrete timing copy, and distinct grouped motion.
- [x] Keep scene 5 layout; replace application topics with parallel composition, sequencing, and enter/loop/exit features; demonstrate layered transforms.
- [x] Update regression checks and V8.3 proposal; pass 73 site tests, site type-check, lint, formatting, and production build.
- [ ] Finish real-browser verification of the Canvas visibility correction and layered motion on desktop/mobile.

V8.3 implementation and static checks: 14 site suites / 73 tests, site type-check, lint, and production build pass. New tests assert that the display canvas never calls fillText, every frame contains particle arcs, colors are mixed, final particle positions remain identical, the scene 3 illustration waits on its title plus 120ms, and scene 5 uses native parallel transforms and stagger.

Browser diagnosis: the existing local 4010 service was reused. The corrected navigation reached scene 3 and captured its new readable content and assembled pages. Scene 4 reached top=0 with a 1440x900 canvas, but its observer still reported visible=false and no pixels; the screenshot shows the DOM fallback. The local Canvas host now has explicit full dimensions and the observer uses the native CineView scroll container. This correction still requires a browser check. Follow-up measurements were blocked by automatic approval HTTP 429 and timeouts; a renewed approval request is pending. No full V8.3 browser pass is claimed yet.

## Scene 4 Copy Correction: Extensibility

The user clarified that scene 4 explains extensibility. Replace the generic content/timeline narrative with five concrete extension capabilities: beyond built-in animations, custom components, custom Canvas drawing, shared animation progress, and unified orchestration. Preserve the two-color particle renderer, multiline layout, guides, scroll budget, and terminal hold. Scene 3 remains about timeline sequencing; scene 5 remains about combined animation.

- [x] Confirm the extension boundary against `useAnimateTimeline` and its documented custom-renderer use.
- [x] Update the five bilingual copy states and the proposal; fallback and accessible copy share the same source.
- [x] Adjust the existing glyph-sampling assertion and run focused Canvas tests plus site type-check (3 Canvas tests pass).

## Scene 5 Reading Synchronization

The user reports that the left composition switches to the third topic while the right side still shows the second topic, and asks whether this is a locked scroll zone. Verified: scene 5 has no `Scene.scroll`; its left column is CSS sticky, and a wide IntersectionObserver band selects the highest intersecting chapter index. That band can include the next topic before it reaches the main reading position.

- [x] Explain the natural scroll plus sticky behavior and identify the premature chapter-selection rule.
- [x] Add a regression for the next chapter entering the viewport while the previous chapter still occupies the reading position. It failed on the old implementation (expected sequence, received lifecycle).
- [x] Replace the broad intersection band with a narrow reading line, positioned below the sticky illustration on mobile. The regression and five focused scene tests now pass.
- [ ] Verify forward/reverse, jumps, resizing, and the actual scene 5 route; record remaining visual risks.

Verification result: 14 site suites / 74 tests pass, including the failing-before/fixed-after early-switch regression, reverse movement, jumps, desktop resize, and a mobile reading line below a 320px illustration. Site type-check and production build pass; the existing bundle-size warning remains. The left sticky layout is intentionally retained. Browser script `output/playwright/v8-3-reading/acceptance.mjs` is ready, but both launch attempts were rejected by automatic approval because of the account concurrency limit. No real-browser pass is claimed for this correction. The earlier Canvas visibility browser check also remains pending.

## 2026-09-08 continuation

- [x] Recover the latest conversation and preserve the approved seven-scene scope.
- [x] Reproduce and correct ignored zero-area IntersectionObserver entries in scene 4 and scene 5. Accepting edge contact prevents the Canvas from remaining paused and the reading selector from retaining the previous chapter.
- [x] Pass 15 site suites / 75 tests, complete source/framework/site type checks, lint, changed-file formatting, and the site build.
- [x] Add real Canvas pixel/progress/fallback assertions and breakpoint-resize checks to the reading acceptance script; update the comprehensive script's chapter targets for the narrow reading line.
- [x] Finish the real-browser acceptance and inspect current screenshots. The final independent report covers all four language/viewport configurations and 72 supplemental assertions.

The initial blocker was automatic approval HTTP 404: the configured service did not support `codex-auto-review`. Access was subsequently restored. The independent homepage review now passes English/Chinese desktop/mobile runs, including 72 supplemental assertions; it also found and verified the mobile scene 3 width correction. See the continuation task-flow and `output/playwright/2026-09-08-home-independent/REPORT.md` for current results.
