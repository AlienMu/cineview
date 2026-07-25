# CineView Requirements

## Engine Semantics

1. The root `CineView` declares either `drag` or `scroll`.
2. Drag has one render-progress owner, one element-track owner per Scene and one
   release-instruction owner.
3. Scroll uses native document flow and gives a Scene takeover zone one owner for
   its local progress.
4. A completed scroll zone can be re-entered in reverse from `100%` to `0%`.

## Runtime

1. Per-frame values use MotionValues or narrowly subscribed external stores.
2. Scroll measurement is batched and does not force a full-scene layout read on
   every native scroll frame.
3. Video scrubbing writes `currentTime` from the authoritative progress source
   without a React state update per progress tick.
4. Event listeners, animation controls and media subscriptions are cleaned up on
   unmount and source changes.

## Public API

1. Public types describe the current authoring model and reject removed legacy
   props at the main entry points.
2. Layout components preserve consumer DOM attributes, refs and event handlers
   without allowing them to overwrite framework invariants.
3. Accessibility state and keyboard input remain aligned with the same scroll
   reducer used by pointer input.

## Acceptance

Automated checks must pass type-checking, lint, root tests, coverage thresholds,
example tests and build verification. Drag and scroll input paths also require an
independent real-browser lane at `/#/drag` and `/#/scroll`, including desktop and
mobile-sized viewports, reverse traversal, nested scrolling and performance
observation.
