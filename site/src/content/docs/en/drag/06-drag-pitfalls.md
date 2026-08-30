---
title: Drag troubleshooting
eyebrow: DRAG / TROUBLESHOOTING
---

Six drag-specific failures. Each entry first describes what you actually see and why, then how to fix it. For failures shared across modes see [Troubleshooting](/docs/07-common-pitfalls).

## 1. transitionDuration changed nothing about gesture paging

What you see: `transitionDuration` goes from 800 to 300, and gesture paging is exactly as slow as before. That is because this prop does not control gesture paging. Gesture page movement and rebound use an internal duration fixed at 800, which no public prop reaches. The only place `transitionDuration` is read is the settle timer for programmatic navigation, so it affects nothing beyond when `onSceneLeave` fires after `ref.goToScene()`.

The fix: gesture paging duration is not configurable. To change the overall pace, adjust the element-side `duration` and `delay` (that is the tempo the audience actually perceives), or use `unit: 'percent'` to change how drag distance maps onto the timeline. See [Gestures and thresholds](/docs/02-gestures).

## 2. exitAnimation does nothing when dragging backward

What you see: an element has an `exitAnimation`; dragging forward looks right, dragging backward looks completely different. That is because a backward exit **does not use `exitAnimation`**. It reverses the entrance animation instead (interpolating `initial → animate` at `1 - progress`). `exitAnimation` only participates in a forward exit.

And with no `exitAnimation` declared, a forward exit plays nothing either: the element holds its resting state while only the page slides.

The fix: think of "leaving" as two separate things. A forward exit uses `exitAnimation`; a backward exit is the entrance in reverse. To make both directions feel alike, make `exitAnimation` close to a mirror of the entrance; to get "dragging back is an undo," writing nothing is actually correct.

## 3. The first screen has no entrance, it starts at its final state

What you see: on reload, every element on the first screen appears already in place and the entrance never plays. Later scenes are fine. The reason: the first-screen entrance window flag is initialized once, at first render, from whether any scenes existed at that moment. If scenes arrive asynchronously (awaiting a request, a dynamic import, conditional rendering), the scene count is zero at first render, the flag stays false from then on, and first-screen elements resolve straight to their resting state.

The fix: make sure a `Scene` exists on the very first render. Render a Scene with skeleton content and fill it in later; do not defer the whole first screen behind `{data && <Scene>...</Scene>}`.

## 4. A driver: 'clock' element never exits, and after is ignored

What you see: after setting `timeline.driver: 'clock'`, the element neither exits nor respects `after`. That is because the switch takes the element out of the finger-following scene timeline and plays it on real time once the scene has arrived. This kind of element has no exit stage at all, and it does not join the scene's animation registry, so both `after` and `exitAnimation` are ignored with a development warning. It also does not contribute to the scene's total timeline length.

The fix: keep the default `driver: 'scene'` whenever you need exits or a timeline. Independent playback suits decorative motion that does not belong in the narrative, such as a glow that starts breathing once the scene arrives. See [The Animate timeline](/docs/02-timeline).

## 5. Timers and state in distant scenes vanish

What you see: a poll starts in scene 1, you page to scene 4 and back, and the poll is gone along with the component's state. That is because the drag virtualization window is "current scene ± 1," and scenes outside it are not mounted. Paging more than one screen away unmounts; coming back remounts, so effects re-run, state resets, and the element timeline restarts at 0.

The fix: state that must survive across scenes belongs outside `CineView` (parent state, context, a store). Effects inside a scene handle only what is visually part of that screen. Note also that scenes are keyed by array index, so conditional rendering or reordering ties instance identity to position rather than to the element.

## 6. Scenes disappear after wrapping Scene in another component

What you see: for reuse you wrote `function MySection(props) { return <Scene {...props} /> }`, or grouped several Scenes inside `<>...</>`, and the page went blank. That is because `Scene` must be a direct child of `CineView`. The framework walks only one level of children to discover scenes. Arrays are flattened by React (so `{list.map(...)}` works), but Fragments are not flattened, and Scenes inside one are never found.

Custom wrapper components fare slightly better: discovery unwraps through the component type, so `memo` and `forwardRef` wrappers are recognized up to six levels. But if your wrapper returns `Scene` from its render function rather than exposing `Scene` as its type, the framework sees your component, not a Scene.

The hardest case to spot is the mixed one: one direct Scene plus a Fragment holding two more. The framework finds one, with **no error and no warning** (`EMPTY_SCENES` fires only when there are none at all).

The fix: keep `Scene` flat as a direct child of `CineView`. To reuse a group of scenes, export a function that returns an array and spread it, rather than returning a Fragment.

## Related pages

- [Drag layout contract](/docs/01-layout): the virtualization window and ignored props
- [Ownership and transactions](/docs/04-ownership): why the first few gestures can do nothing
- [Drag callback timing](/docs/05-callbacks): where callback timing contradicts the names
- [Troubleshooting](/docs/07-common-pitfalls): failures shared across modes
