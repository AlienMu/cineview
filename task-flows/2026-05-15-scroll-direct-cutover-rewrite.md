# Task: Scroll Direct Cutover Rewrite

## Goal

- Replace the current `scroll` runtime with a direct-cutover implementation that matches the latest design intent.
- Do not preserve compatibility behavior, compatibility APIs, or hybrid runtime branches for the old scroll model.
- Treat this file as the execution source of truth for the rewrite.

## Direct-Cutover Rule

This rewrite is not incremental. The target state is a single new `scroll` architecture with no compatibility lane.

- No legacy `ScrollZone` public path
- No root-level virtual scroll track
- No global offset model that mixes document motion with zone budget motion
- No full-viewport gate for first paint
- No requirement that old scroll examples continue to behave the same

If an old runtime branch conflicts with the target design, delete it instead of bridging it.

## Why The Current Runtime Must Be Replaced

The current implementation has drifted away from the design in structural ways:

1. The page is not really scrolling as a normal document. It is rendered inside a `100vh` scroll shell with a translated inner track.
2. Scroll takeover budget is encoded into root scroll coordinates, so scene transitions can feel discontinuous.
3. Scene continuity depends on virtualized placeholders and transformed track positioning instead of real layout flow.
4. First paint is gated by scene-level preload state, which can hide the whole first viewport.
5. Scrollbar behavior is coupled to the synthetic root scroll axis rather than a true document-like container.

These are not isolated bugs. They come from the runtime model itself.

## Design Target

### Primary Product Rule

`scroll` mode must behave like a real reading surface first, and like an animation engine second.

The page is a real flowing document. `Scene.scroll` adds local takeover moments inside that document. It does not redefine the page as a synthetic track.

### Core Principles

1. `CineView mode="scroll"` owns the mode selection, but does not turn the page into a fake scroller.
2. `Scene` remains a real document-flow section.
3. `Scene.scroll` declares local takeover ownership for that scene only.
4. `Animate.timeline.driver='scroll'` consumes progress from the owning scene takeover only.
5. `Animate.timeline.driver='visibility'` stays document-driven and never enters the takeover budget path.
6. The scrollbar reflects the real scroll container.
7. The first viewport is allowed to render immediately. Media loading may gate media, not the whole viewport.

## New Runtime Architecture

### Root Scroll Container

`CineView` in `scroll` mode keeps a real scroll container as the single source of truth.

- The container may still be the root `CineView` element so scrollbar styling stays centralized.
- The container scroll position is the real page progress.
- No translated scene track.
- No `virtualScroll`.
- No synthetic `nativeScrollSpan`.
- No mapping from "global offset" back into a second visual offset.

Root state is limited to:

- `scrollTop` or `scrollLeft`
- `viewportSize`
- measured scene layout metadata
- active takeover zone id or `null`
- active scene index
- direction
- scrolling or idle flags

### Scene Layout Model

Each `Scene` is rendered in normal flow.

- The scene's block size comes from real layout content.
- `layout.height` remains an authored hint, not a forced fake-page segment budget.
- A short scene stays short.
- A long scene stays long.
- No root-time conversion that turns every scene into a synthetic scroll segment.

The runtime measures each scene's actual document offsets:

- `sceneStart`
- `sceneEnd`
- `sceneSize`
- optional takeover anchor rect

These values are used for visibility, active scene computation, and takeover hit testing only.

### Takeover Model

`Scene.scroll` remains the only public takeover declaration.

At runtime:

1. A scene with `scroll` may register one takeover owner.
2. The owner exposes:
   - scene index
   - anchor rect
   - budget
   - replay policy
   - animation registrations
3. When the anchor reaches the trigger condition, takeover becomes eligible.
4. While takeover is active and still has remaining budget in the current direction, input is consumed into zone progress first.
5. Once budget is exhausted in that direction, document scrolling resumes.
6. Reverse input first rewinds zone progress, then resumes document movement.

Important: the zone budget is local state. It does not get inserted into the document's physical scroll distance.

### Input Handling

The new runtime must distinguish two motion channels:

1. document movement
2. takeover progress movement

For wheel or touch input:

- If no eligible takeover is active, pass motion to the real scroll container.
- If takeover is active and budget can still be consumed, prevent document movement for that input and advance zone progress only.
- If takeover cannot consume more in that direction, allow real document movement.

This means the page may temporarily pause at a scene while its takeover animation progresses, but the page layout itself does not remap or jump.

### Active Scene Computation

The active scene is derived from real layout intersection, not transformed-track math.

Recommended rule:

- Compute viewport center from real scroll container position.
- Choose the scene whose real document range contains the center.
- Fallback to nearest scene if the center sits between measured ranges during relayout.

This keeps nav state, callbacks, and overlays aligned to what the user is actually seeing.

### Scroll-Driven Animation Model

`timeline.driver='scroll'` means:

- the animation is owned by the nearest scene takeover context
- progress comes from that scene's local zone progress
- no `getBoundingClientRect()`-driven phase ownership
- no fallback to visibility semantics

`timeline.driver='visibility'` means:

- independent of takeover budget
- triggered from real element visibility within the real scroll container
- replay behavior remains visibility-driven

The runtime should keep budget calculation, but scope it strictly to the owning scene.

### Fixed Layer Model

`Position.layer.fixed` in `scroll` mode remains scene-scoped.

But the host is computed against the real scene visibility window:

- fixed nodes render into a scene-owned host
- the host is clipped to the scene's visible region
- release happens at the real scene boundary
- no transformed track assumptions

### Virtualization Model

The current pagination-style virtualization is not appropriate as the default scroll strategy.

New rule:

- default scroll rendering keeps all scenes mounted
- optional performance trimming may later unmount scenes only when they are far outside the viewport
- any trimming must preserve real layout continuity and must not replace nearby scenes with synthetic shells that alter takeover math

For this rewrite, correctness beats aggressive virtualization.

## Scrollbar Design Under Real Scrolling

The scrollbar remains fully supported.

### Required Rule

Scrollbar state must read from the real scroll container, not from a synthetic global progress model.

### Supported Strategies

1. Native styled scrollbar on the root container
2. Custom-painted visual scrollbar that mirrors the root container's real scroll metrics

Both remain compatible with the new runtime because the source metrics are simpler:

- `scrollTop`
- `scrollHeight`
- `clientHeight`

or horizontal equivalents.

The scrollbar layer must stay visually independent from takeover budget state.

## Preload And First Paint

The current full-scene gate must be removed.

### New Rule

The first viewport should render immediately with layout, copy, and non-blocking surfaces intact.

Media loading policy:

1. collect preload URLs for all scenes
2. classify only first-viewport critical media as initial priority
3. start rendering immediately
4. let priority media fade in or resolve in place
5. continue adjacent and later scene preload in the background

What must not happen:

- hiding the entire scene viewport with `opacity: 0`
- waiting for adjacent scene images before allowing first paint
- coupling scene visibility to aggregate preload counters

## Public API Target

The public authoring target after the rewrite is:

- `CineView mode="scroll"`
- `modes.scroll`
- `Scene.scroll`
- `Animate.timeline`
- `Position.layer.fixed`

The rewrite may remove deprecated or conflicting authoring paths rather than mapping them.

## Required Deletions

The rewrite should remove the following runtime concepts from the main scroll path:

- root `virtualScroll`
- transformed scroll track as the primary page movement model
- synthetic global offset budget insertion
- placeholder-shell virtualization as default scroll behavior
- whole-viewport preload gating
- any old public `ScrollZone` dependency in the main authored path

## Files Expected To Change

The rewrite will likely require broad edits across:

- `src/components/CineView/CineView.tsx`
- `src/components/Scene/Scene.tsx`
- `src/components/Scene/useSceneScrollTakeover.ts`
- `src/components/Scene/sceneScrollRuntime.tsx`
- `src/components/Scene/sceneScrollBudget.ts`
- `src/components/Animate/useAnimateScroll.ts`
- `src/components/Position/*` scroll fixed-host code paths
- scroll-related tests
- performance example scroll page and supporting content

The exact write set may expand if old assumptions are spread across helpers.

## Acceptance Criteria

The rewrite is complete only when all of the following are true:

1. Scroll mode uses a real scroll container with no translated root scene track.
2. `Scene` layout continuity is preserved through real document flow.
3. A takeover scene can locally consume input without causing chapter-entry jumps.
4. The 04 -> 05 style transition issue is gone because takeover no longer remaps page position.
5. The first viewport renders immediately without whole-viewport hidden gating.
6. Scrollbar behavior works off the real root scroll container.
7. Scroll-driven and visibility-driven animations remain clearly separated.
8. Scene-scoped fixed layers still clip and release correctly.
9. Tests and examples are rewritten for the new model rather than patched around the old one.

## Execution Checklist

This is a direct comprehensive rewrite checklist, not a phased migration.

- [ ] Re-read `design.md`
- [ ] Re-read `requirements.md`
- [ ] Re-read this file before editing runtime code
- [ ] Remove root scroll synthetic track architecture from `CineView`
- [ ] Replace synthetic global-offset takeover math with scene-local takeover progress
- [ ] Rebuild active scene detection against real layout measurements
- [ ] Rebuild scroll input routing so takeover progress and document motion are separate channels
- [ ] Remove whole-viewport preload gating and replace it with media-level first-paint behavior
- [ ] Rework scene-scoped fixed host behavior against real scene visibility instead of transformed track assumptions
- [ ] Disable default near-scene placeholder virtualization for scroll mode
- [ ] Rewrite scroll-related tests to assert the new runtime model
- [ ] Rewrite the performance example scroll page to exercise the new model honestly
- [ ] Run targeted test suites for scroll runtime, animate scroll ownership, fixed layers, preload behavior, and scrollbar behavior
- [ ] Run framework build
- [ ] Run example build
- [ ] Perform browser verification of the rewritten scroll page
- [ ] Confirm no compatibility branch remains in the main scroll runtime

## Verification Expectations

Runtime verification must include:

1. first paint behavior
2. short and long scene continuity
3. takeover entry and release in both directions
4. scene-scoped fixed behavior near scene boundaries
5. scrollbar behavior on the real container
6. absence of discontinuity at takeover chapter boundaries
7. no hidden full-page gate on initial load

## Final Delivery Rule

Do not declare this rewrite complete because one bug disappears.

Declare it complete only when the old scroll mental model has been removed and the new one is the only surviving runtime path.
