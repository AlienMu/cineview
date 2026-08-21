# 2026-08-17 Adversarial Remediation Round 2 - Independent Code Review

## Review Identity And Scope

- Role: fresh independent code-level adversarial reviewer. I did not implement the reviewed code and did not use another Agent's verdict as evidence.
- Baseline: `4660d96` plus the current shared uncommitted worktree.
- Required sources read first: `DESIGN.md`, `CLAUDE.md`, `AGENT_SELF_REVIEW.md`, and `task-flows/2026-08-17-adversarial-remediation-round-2.md`.
- Reviewed seams: scroll frame store / React hot path, media activation and native terminal events, BackgroundRibbon container ownership, Scene5 lifecycle / freeze / transform / focus / replay, dynamic reduced motion, and the stagger settled re-entry edge.
- This review did not modify production code.

## Findings

### P1 - Stagger settled re-entry still commits the instant terminal variant before it re-arms

Location: `src/components/Animate/StaggerContainer.tsx:104-156`.

`useStaggerPhase` correctly adds a revision when a MotionValue emits `exit` and then `animate` in one React batch. However, `useStaggerSettled` clears the old `settled=true` value only inside a passive `useEffect` (`setSettled(false)` at line 145). The first React commit for the new `animate` revision therefore still returns `settled=true`. `ScrollStagger` passes that value as `instant`, so `renderStaggerTree` emits duration/delay zero for that commit. Only after the passive effect does a second render restore authored timing.

This is the exact batch boundary under review: a settled group can commit its terminal frame before the new entry clock is armed. With real Framer Motion, changing the label while `instant=true` can snap children to the animate target; restoring duration on the next render does not guarantee replay from `initial`. The new test uses an `act()` flush and reads only the final DOM after passive effects, so it cannot observe the bad intermediate commit or prove a real Framer replay occurred.

Reproduction seam:

1. Let `ScrollStagger` finish and become `settled=true`.
2. In one input batch, publish signed progress `-1` and then `1`.
3. Observe the first commit for the new animate revision. It still renders `instant=true` before the passive effect clears settled.

Required repair: make settled generation-aware during render (for example, store the revision that settled and only return settled when it equals the current animate revision), or synchronously invalidate settled before the new animate commit. A passive-effect correction is too late for an animation start boundary.

### P1 - Scroll debug progress attributes became stale by construction

Locations: `src/components/CineView/ScrollSceneSlot.tsx:82-123` and `:251-265`.

The render snapshot equality deliberately ignores `sceneTimelineState.enterProgress`, `exitProgress`, `sceneProgress`, `sceneZoneState.progressPx`, and `visualViewportOffset`. That is correct for keeping the Scene React tree off the continuous hot path. But the same ignored React snapshot still renders the opt-in debug attributes:

- `data-cineview-takeover-progress-px`
- `data-cineview-takeover-viewport-offset`

After an in-phase scroll frame, `ScrollSceneSlot` does not render, so those values remain at the last discrete boundary. Debug mode previously exposed live probes and is used to validate takeover progress. The hot-path fix therefore changed an existing diagnostic semantic instead of moving these two attributes onto the imperative frame lane.

Reproduction seam: enable `window.__CINEVIEW_SCROLL_DEBUG__`, enter the middle of one hold/enter phase, read the two attributes, scroll within the same phase, then read again. The frame store changes while both DOM attributes stay unchanged.

Required repair: update only the debug attributes imperatively from the frame store when debug mode is enabled, or explicitly remove and replace this debug contract together with its tests/probes. Reintroducing a Scene render per pixel is not acceptable.

### P1 - Media generation is mutated during render, so an aborted concurrent render can disable the committed source listener

Location: `src/media/VideoFrameRenderer.tsx:136-155`.

The source/object-URL generation is incremented during render to invalidate the old native closures before effects run. This mutates the generation observed by the currently committed listener even if React later abandons that render. In React 18 concurrent rendering, a speculative `src=B` render can increment the ref and then be aborted while the DOM remains on `src=A`. The committed A listener now fails `isCurrent()` forever, and no committed effect rebinds it.

The stale-ended test exercises a committed `rerender`; it does not exercise an interrupted transition/Suspense render. Thus the activation token fixes the reducer path, but the listener invalidation mechanism introduces a concurrency regression.

Required repair: bind generation changes to a committed media identity. Avoid changing the token that live DOM listeners read during render; use a commit/layout-owned listener generation or an identity captured from the actual media element/source assignment.

### P2 - A stale native `ended` is filtered for ownership but not for the public callback

Location: `src/media/VideoFrameRenderer.tsx:455-476`.

The new imperative ended listener checks generation and activation before dispatching `media-ended`, so a stale source event no longer poisons the ownership reducer. The React `onEnded` handler still unconditionally calls the latest consumer callback. A queued ended event from source A dispatched on the retained video element after source B commits can therefore invoke source B's `onEnded` callback.

The regression test calls the captured old imperative listener function directly. It never dispatches the stale event through the video element and never asserts the public callback, so this failure path is uncovered.

Required repair: route ownership and the consumer terminal callback through the same generation-tagged native listener, or otherwise gate the public callback by committed media identity.

### P2 - Scene5 can collapse the layout while visible closing content is still active

Locations: `site/src/components/scene5Lifecycle.ts:152-155` and `site/src/components/Scene5Cinema.css:122-131`.

The scroll scrub window maps opacity from 0 at progress `0.85` to 1 at `1`. The lifecycle collapses `split` as soon as progress is below `0.90`. At `0.90`, closing content opacity is about `(0.90 - 0.85) / 0.15 = 0.333`, not fully faded. Consequently the phone/text layout starts its 1.1 s collapse while the right column is still visibly rendering. This also bypasses the unfinished path's stated guarantee that text exits before the column collapses when reverse scroll and an unfinished sequence overlap.

The CSS comment says text is already fully faded at this threshold, but the authored scrub math contradicts it. Existing reducer tests assert only the boolean threshold; they do not verify opacity/layout ordering or the unfinished-plus-reverse race.

This needs real-browser evidence and either an aligned collapse threshold (at or below the scrub start) or an explicit specification that visible text may move during reverse collapse.

### P3 - Site-targeted lint is not clean

The official `pnpm lint` command checks only `src`, so it passes. A targeted ESLint run over the touched files reports two warnings:

- `site/src/components/Scene5Cinema.tsx:407` missing explicit return type.
- `site/src/components/scene5Lifecycle.ts:222` missing explicit return type.

This is not the functional blocker, but it conflicts with the repository's stated zero-warning discipline and shows the normal lint gate does not cover site code.

## Area Conclusions

### Scroll frame store / React hot path

- The main repair is structurally valid: `useNativeScrollController` remains the continuous source owner; the new scene frame store transports its calculated result and does not independently derive native progress.
- `Scene`, `SceneFixedLayer`, scene visibility callbacks, and scene visual controls subscribe as consumers. No second scroll progress writer was found.
- Continuous Scene render-count coverage and visual-control coverage are meaningful.
- The repair is incomplete because debug attributes still consume the intentionally stale React projection.
- Ordinary frames still allocate the freshly built `ScrollSceneFrame` and timeline objects before equality, but they do not clone the complete frame array or schedule React state. This is a residual per-frame cost, not a second owner.

### Media activation / terminal event ownership

- `media-ended` now requires an activation ID in the reducer, stale tagged events are ignored, and the component test invokes the actual old native listener closure. This fixes the original reducer poisoning path for committed source replacements.
- Native pause/ended listeners are cleaned and rebound on activation/source generations.
- The render-phase generation mutation creates an uncovered concurrent-render race, and public `onEnded` remains outside the token gate. Therefore the media fix is not complete.

### BackgroundRibbon

- Same-path container replacement is detected with a MutationObserver.
- Attach first detaches the prior scroll listener and ResizeObserver; route loss and unmount remove all four inline root variables and disconnect observers.
- No per-frame React state or custom rAF was introduced.
- The focused tests exercise replacement, route loss, stale old-container scroll, and unmount cleanup. I found no blocking code defect in this area.

### Scene5 lifecycle / freeze / transform / focus / replay

- Messages, visibility, progress thresholds, and timers now enter one reducer; generation-tagged timer completions prevent older sequences from winning.
- `freezeScene5Element` captures computed transform before cancelling CSS animation, and links use both `inert` ownership and explicit `tabIndex=-1` while collapsed.
- Reopen increments a keyed replay generation, so the four children remount instead of retaining finished CSS animation state.
- No second continuous opacity writer was added: scroll opacity remains the Animate scrub lane; JS writes only the separate manual-opacity event channel.
- The progress-collapse threshold is inconsistent with the authored scrub window, and component-level DOM/timer/browser coverage is still required. Pure reducer tests do not prove transform, focus, or replay behavior in the mounted component.

### Reduced motion

- The module-level static cache was removed. `useSyncExternalStore` subscribes to both modern and legacy `matchMedia` APIs and cleans up.
- `PhoneMockup` re-renders when the OS preference changes and switches between static and framework-owned infinite lanes.
- No blocking defect was found in this area.

### Stagger batch edge

- The phase revision detects a batched round trip, but settled invalidation occurs after the decisive commit.
- The existing mocked test proves eventual React state only, not animation restart semantics. This original P2 is only half fixed and remains blocking.

## Verification Executed

- `pnpm type-check` - PASS.
- `pnpm type-check:site` - PASS.
- `pnpm lint` - PASS (framework `src` only).
- `git diff --check` - PASS.
- Targeted ESLint over all reviewed production files - 0 errors, 2 site warnings listed above.
- Focused Jest command covering media ownership/renderer, scroll snapshots/slot/stack/engine, BackgroundRibbon, Scene5 reducer/timer helpers, reduced motion, and stagger - 11 suites, 102 tests PASS.

Focused Jest command:

```text
pnpm test --runInBand src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts src/components/CineView/ScrollSceneStack.test.tsx src/components/CineView/ScrollSceneSlot.test.ts src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/Scene/useScrollSceneEngine.test.ts src/components/Animate/StaggerContainer.test.tsx src/__tests__/site/backgroundRibbon.test.tsx src/__tests__/site/scene5Lifecycle.test.ts src/__tests__/site/usePrefersReducedMotion.test.tsx src/__tests__/site/lastWinsTimerSequence.test.ts
```

These green checks do not override the code-level failures above. I did not run the independent browser lane and do not use browser evidence as the basis for this code verdict.

## Required Questions

1. Did the changes truly solve the original problems? **Partially.** BackgroundRibbon and dynamic reduced motion are code-complete; the scroll React hot path and committed stale-ended reducer path are materially improved. Stagger re-entry is still wrong at the commit boundary, and media handling remains incomplete under concurrent rendering/public callbacks.
2. Did existing semantics change? **Yes.** Opt-in scroll debug progress attributes no longer update continuously. Scene5 also begins layout collapse while its scrubbed text remains visibly nonzero.
3. Was a second writer, race, or timing regression introduced? **No second scroll/progress writer was found.** A new media race exists because committed native listeners read a generation mutated by potentially aborted renders. The stagger passive-effect reset is a timing regression at the animation start boundary.
4. Are failure paths uncovered? **Yes.** Aborted concurrent media source renders, stale terminal events reaching the public callback, the first stagger commit before passive effects, Scene5 unfinished plus reverse-progress overlap, and continuous debug attributes are not covered.
5. Is there dead code, duplication, or a half-fixed branch? **No material dead export or old Scene5 split writer was found.** The stagger edge and media event gating are half fixed: tests cover the reducer/eventual state while missing the decisive commit/public callback/concurrent branch.
6. Final result: **FAIL**.

## Final Verdict

VERDICT: FAIL
