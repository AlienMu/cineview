# t2b docs notes (2026-08-23)

## Paradigm
- frontmatter: title + eyebrow only. zh/en isomorphic trees, byte-identical code blocks.
- Style: terse H2 sections, tables ok (cineview.md uses tables), code fences tsx/bash.

## direction-x evidence
- gestureDetector.ts:80-92 x/y swipe branches; :114-117 getDragProgress axis; :194-204 detectGesture x/y.
- DragSceneStack.tsx:79 DragSceneFrameProps direction:'x'|'y'; :107 transform translate3d x vs y; :180 slideDirection = dragConfig?.direction ?? sceneProps.slideDirection ?? 'y'.
- useDragSceneEngine.ts:51-54 resolveProgressVelocity axisVelocity by slideDirection; :375 offset = info.offset.x|y; :376 viewportSize innerWidth|Height.
- ScrollbarOverlay.tsx:97-101 x writes style.left; :156-158 track geometry x=width/left/clientX; :261 aria-orientation horizontal; :272-288 x rail laid out along bottom (left:inset, top:viewportSpan-thickness-inset, width:railLength,height:thickness).
- useScrollSceneSnapshots.ts:105 viewportSpan = direction==='x' ? width : height; :182 prev axis; :229.
- ScrollSceneSlot.tsx:195,212,271-321 x: width takeover span, minWidth 100vw etc.
- DirectScrollCineView.tsx:400-401 offset top|left; :462-463 overflowX scroll / overflowY hidden.
- useScrollInputBindings.ts:35 wheel delta = deltaX; :61 axis.
- directScrollHelpers.ts:90-100 overflowProperty/scrollLeft/clientWidth/scrollWidth; :445,:467-468 rootScroll axis.
- types/index.ts:11 SlideDirection = 'x'|'y'.
- defaults: modes.drag.direction 'y', modes.scroll.direction 'y' (types/index.ts — verify).

## scrollbar theming evidence (ScrollbarOverlay.tsx)
- width: ??6, Math.max(_, 4) floor 4
- radius: ??999, floor 0
- inset: ??0, floor 0
- trackColor: ??'transparent'
- thumbColor: ??'rgba(255, 255, 255, 0.28)' → style.background verbatim (CSS var works)
- thumbHoverColor: ??'rgba(255, 255, 255, 0.42)' → consumed as 1px ring boxShadow `0 0 0 1px ${...}` (always on, ring not hover-swap)
- autoHide: ??true; ariaLabel ??'CineView scroll position'
- thumb min length 40px: clamp(thumb, Math.min(40, railLength), railLength)
- overlay hidden when nativeScrollableSpan <= 1 (content fits viewport)
- fade-in 'opacity 0.08s ease-out'; fade-out 'opacity 0.5s ease-in 0.15s'; isScrolling idle timer 120ms (useNativeScrollController.ts:427-433)
- rail boxShadow fixed (white ring + shadow), not configurable
- keyboard focus outline 2px blue fixed
- site instance: site/src/pages/HomePage.tsx:60-67 width 8, trackColor rgba(26,24,20,0.06), thumbColor 'var(--accent)', thumbHoverColor rgba(255,255,255,0.9); --accent written by BackgroundRibbon into :root, flows with scroll (tokens.css:24, global.css:41)

## TODO
- sceneScrollBudget.ts:183-215 phase windows
- resolveScrollIntentOffset
- useFirstSceneEnter / cache dedup / preload targets
- ZoneReadout DemoPage
- onError vs [CineView] dev warnings
- ffmpeg + 50ms seek guard
- rAF P95<25ms + longtask

## centerlock evidence (verified)
- sceneScrollBudget.ts:182-215: hasAuthoredPhase = phase.start|end authored; authored -> window [0, totalBudgetPx]; else window = own enter segment; resolvePhaseBoundaryPx clamps 0..1 lerped in window (:59-71); phaseEndPx >= phaseStartPx+1; authored phase re-pins exit (exitEndPx=totalBudgetPx, exitStartPx=max(phaseEndPx, total-exitDurationPx)) (:220-233). waitFor accumulation is ms-clock: predecessorEnd = predecessor.totalEndMs (:133) -> T1.8 split.
- T1.8 (task-flows/2026-08-23-stage3-demo-hub-docs.md:71-76): leader w/ phase -> follower started at leader 14%. Fix: pure 3-level chain. Framework gap recorded P2.
- resolveScrollIntentOffset (directScrollHelpers.ts:148-215): jump crossing whole segment -> clamp segmentStart+1 (fwd) / segmentEnd-1 (bwd); jump out of active segment -> clamp to segment boundary.

## preload evidence
- useFirstSceneEnter.ts: priorityComplete -> ready one-shot; timeout -> FIRST_SCENE_TIMEOUT recoverable w/ counts context; preventDefault -> consumer owns, else settleStatically; scroll: window flag inert, ready only.
- imagePreloadCache.ts: module-level URL Set, dedup across instances.
- useImagePreloader.ts:43-65: priority batch excludes from background; processed/loaded filtered.
- preloadTargets.ts: number=scene index (int in range), string=sceneId, scroll also zoneId; dedup within call.
- useCineViewImperativeApi.ts:67-76 + DirectScrollCineView.tsx:413-420: preload enqueues resolved images as PRIORITY then awaits startPreload.

## callbacks evidence
- DemoPage.tsx:25-45 ZoneReadout forwardRef project() -> transform scaleX + textContent; handleZoneProgress useCallback([]).
- devLog.ts: [CineView] prefix, development gated, devWarnOnce cross-instance dedup.
- DirectScrollCineView.tsx:188-216: same condition emits onError AND console (non-production).
- types/index.ts:133-152: 8 error codes; preventDefault on recoverable.

## performance evidence
- README.md:78-83: ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4; dev warns once when median seek latency > 50ms.
- N6 S5 probe (site/review/20260822-n6-acceptance/n6-probes/s5-perf.mjs): 6s continuous drive ('/' wheel; '/drag' CDP pointer); P1 rAF gap P95<25ms, P2 >25ms ratio <10%, P3 longtask <=2, P4 console 0. rAF = main thread, not GPU.
- infinite-lane memory: 10 whitelisted props (opacity,x,y,scale,rotate,rotateX,rotateY,skewX,skewY,filter) owned by style MotionValue; controls.start() silently ignored; drive CSS custom property instead.
- ScrollbarOverlay gutter: DirectScrollCineView.tsx:490 overlay on -> inject createScrollbarCss() hiding native gutter.

## STATUS
- [x] evidence complete; writing 12 files

## FINAL
- 12 files written (2 new pages x2 langs, 4 enhanced x2 langs; existing bodies untouched, append-only)
- docsContent.test.ts 3/3 PASS; site type-check 0 err; site build PASS
- zh/en code fences byte-identical (python check), heading counts match per pair
