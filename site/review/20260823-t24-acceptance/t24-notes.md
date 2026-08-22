# T2 Wave Final Acceptance Notes — 2026-08-23 06:09:51
- Located 20 doc files under site/src/content/docs/{zh,en}/{animation,advanced,components}

## A-audit progress
- Fact sources read: presets/index.ts (43 presets / 11 cats), types/index.ts (PresetAnimation union=43, ScrollbarConfig, CineViewErrorCode, AnimateStaggerConfig each=40/from='first'), registry.ts, composer.ts, animationParser.ts, animateInterpolation.ts (10 props), StaggerContainer.tsx, useSceneAnimationRegistry.ts (issue→code map), Animate.tsx (stagger defaults 40/'first'), useAnimateArrival (waitFor ignored), sceneScrollBudget.ts, ScrollbarOverlay.tsx, useNativeScrollController.ts (idle 120ms), fade.ts, CapabilityScene.tsx
- animation/presets.md zh+en: PASS so far (43/11 correct, fade-in triple exact, 3000ms timeout, codes correct)
- animation/custom.md zh+en: PASS so far (validateCustomAnimation, transformOrigin maps, times resolution, 10 props, interpolator, composer rules, solid/riseVariant match site)
- animation/waitfor-stagger.md zh+en: PASS so far (formula, windows 0-600/600-1200/1200-7200, driver matrix, issue→code map, stagger defaults, 1080/840 numbers, phase-constraint matches sceneScrollBudget dual-clock)
- components/animate-video.md zh+en: PASS (props table exact vs AnimateVideoProps; preload=true, playbackRate=1, dur 600/600, delay 0, replay true, releaseOnLeave false; 2% hysteresis=TAKEOVER_HYSTERESIS 0.02; clamp [0,duration]; handoff only when range end < clip end; outgoing latch; bands far=1.5vh near=1vh=SCENE_SCROLL_APPROACH_*; ffmpeg cmd identical to renderer warning + README; 50ms median/once-per-src=SLOW_SCRUB_SEEK_MS 50 + SCRUB_SAMPLE_MIN 6; onPlay/onPause/onEnded generation+activation gated, onTimeUpdate/onError passthrough; priorityComplete gate confirmed in useFirstSceneEnter/mediaPreloadCache)
- advanced/direction-x.md zh+en: PASS (default y; drag offset.x/velocity.x/innerWidth in useDragSceneEngine:52,375-376; translate3d(x%,0,0) DragSceneStack:107; overflow-x scroll/y hidden DirectScrollCineView:462-463; wheel deltaX-only useScrollInputBindings:35; keyboard sign axis-agnostic normalizeKeyboardDeltaPx; takeover span→width ScrollSceneSlot:212 + minWidth 100vw :273 + sticky :299; viewport.width snapshots :105; nested overflow-x/scrollLeft helpers:90-99)
- advanced/scrollbar-theming.md zh+en: PASS (all 9 fields+defaults+clamps match ScrollbarOverlay:46-53; 40px thumb floor :73; >1px render gate :67; autoHide 80ms/120ms/0.15s+0.5s matches :250-253 + controller :433; site example matches HomePage.tsx:61-66 exactly; BackgroundRibbon --accent live rewrite confirmed)

## Part B (port 4026 fresh server, killed after)
- 6 new pages × zh+en: HTTP 200, article non-empty (1174–10109 chars), hljs tokens present (16–158/page), GFM tables rendered where source has tables (direction-x has none, by design)
- TOC: anchors resolve to rendered heading ids AND full reverse coverage (every h2/h3 in TOC), per-lang counts match md source headings
- Sidebar zh: 入门 | 核心概念 | 组件 API | 动画 | 进阶 (动画 between 组件 API and 进阶) ✓; en: Getting Started | Core Concepts | Components | Animation | Advanced ✓; animation group holds custom/presets/waitfor-stagger
- Mixed-language spot check (presets + scrollbar-theming, both langs): zh prose has no long English runs; en prose zero CJK chars
- console error/warning + pageerror: 0 across all 12 page loads (both langs)
- Server stopped; port 4026 free
- VERDICT: PASS
