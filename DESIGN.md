# CineView architecture

This document describes the current implementation of CineView 1.0.0 for contributors.
Use the [public types](./src/types/index.ts) for exact property names and unions,
and the [documentation](./site/src/content/docs/en/getting-started/01-introduction.md) for application examples.
Historical reviews record earlier states; they do not override the current source.

## Contents

- [Component structure](#component-structure)
- [State ownership](#state-ownership)
- [Drag mode](#drag-mode)
- [Scroll mode](#scroll-mode)
- [Animation timing](#animation-timing)
- [Layout and responsive sizing](#layout-and-responsive-sizing)
- [Assets and readiness](#assets-and-readiness)
- [Accessibility](#accessibility)
- [Errors and cleanup](#errors-and-cleanup)
- [Package boundaries](#package-boundaries)
- [Verification](#verification)
- [Changing the architecture](#changing-the-architecture)

## Component structure

A `CineView` contains `Scene` elements. A Scene owns its layout, animation registry,
asset lifecycle, and fixed elements. `Animate` controls an element's animation;
`AnimateVideo` connects video playback or seeking to an animation timeline.
`Position` places content, `Container` defines box dimensions and spacing, and
`Image` integrates image loading with scene readiness.

[CineViewDispatch](./src/components/CineView/CineViewDispatch.tsx) selects the drag or
scroll implementation from the `mode` discriminant. Mode-specific public types
reject configuration that belongs to the other mode. The default mode is `drag`.
Application callbacks are grouped under `callbacks`; scene layout and behavior
are grouped under `layout`, `transition`, `assets`, `drag`, `scroll`, and `callbacks`.

The implementations share conversion and scene contexts but retain separate input
controllers. Do not combine their progress state just because both modes animate
the same properties.

| Responsibility                     | Implementation                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag entry and scene stack         | [CineView](./src/components/CineView/CineView.tsx), [DragSceneStack](./src/components/CineView/DragSceneStack.tsx)                                              |
| Scroll entry and native offset     | [DirectScrollCineView](./src/components/CineView/DirectScrollCineView.tsx), [useNativeScrollController](./src/components/CineView/useNativeScrollController.ts) |
| Scene lifecycle and mode selection | [Scene](./src/components/Scene/Scene.tsx)                                                                                                                       |
| Animation semantics                | [animateSemantics](./src/components/Animate/animateSemantics.ts), [animateTimeline](./src/components/Animate/animateTimeline.tsx)                               |
| Width-based conversion             | [CineViewContext](./src/context/CineViewContext.tsx)                                                                                                            |

## State ownership

Each frequently updated value has one writer. Consumers subscribe to MotionValues
or the existing external stores instead of duplicating the value in React state.

| Value                    | Owner and rule                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Drag render progress     | The render path writes `renderProgress`. Input handlers submit intent; they must not add another writer.                                  |
| Element elapsed time     | Each Scene owns its `elementElapsedMotion`. Never share a mutable elapsed value between Scenes.                                           |
| Drag release             | The active drag transaction owns its release directive and terminal result.                                                               |
| Scroll offset            | The native scroll controller coordinates the root's real scroll position and programmatic movement.                                       |
| Zone progress            | A valid `Scene.scroll` declaration owns its local progress and duration budget.                                                           |
| Fixed element visibility | The containing Scene owns clipping and visibility.                                                                                        |
| Asset lifetime           | The loading/cache owner controls acquisition, completion, and release. Stale asynchronous completions must not revive released resources. |

Per-frame code must not trigger React renders, rebuild configuration objects, or
alternate layout reads and writes. Subscribe once to stable inputs, write visual
properties through the existing animation driver, and dispose of subscriptions.
Read geometry during the existing measurement phase, then publish the resulting
snapshot for consumers.

## Drag mode

Users move between scenes with pointer gestures, supported keyboard input, or
`goToScene`. Scene transition progress and element animation elapsed time are
related but distinct. A scene can have no element animation and still transition;
an element's authored duration must not become the scene transition duration.

The drag engine prepares the source and candidate scenes before committing a
transition. Its snapshot defines the geometry, mapping, and animation bounds used
throughout that transaction. A new gesture can interrupt a settling transition;
resumption must start from the displayed frame rather than an outdated target.

[useDragSceneEngine](./src/components/Scene/useDragSceneEngine.ts) coordinates the
transaction. [dragPreparedState](./src/components/Scene/dragPreparedState.ts) records
prepared values, and [useElementTrack](./src/components/Scene/useElementTrack.ts)
maintains the Scene's element timing. Preserve this separation when modifying
thresholds, release animation, or reverse input.

`dragConfig` defines direction, threshold, transition duration, and the `unit` /
`scale` mapping. Scene-level drag configuration can specialize the behavior.
Check normalization in the implementation rather than inferring a unit from a
number. Callback ordering follows official scene arrival and departure; a
candidate preview must not be reported as a committed scene change.

Only the active scene should expose interactive content to assistive technology.
Neighboring scenes may remain mounted for smooth movement and preloading. Their
presence in the DOM does not make them active.

## Scroll mode

Ordinary scenes remain in document flow. The root provides a real scroll range,
so wheel, keyboard, touch, scrollbar, and imperative navigation must produce
consistent scene and zone state. Scroll mode does not reuse drag thresholds or
drag release state.

A Scene with a valid `scroll={{ zoneId, trigger: 'center-lock' }}` declaration
adds a local animation interval. Its authored scene-driven duration determines
the additional real scroll distance: one millisecond equals one CSS pixel.
Viewport height and `designWidth` do not rescale that duration budget.

[sceneScrollBudget](./src/components/Scene/sceneScrollBudget.ts) derives the budget
from registered animations. [useScrollZoneRegistry](./src/components/CineView/useScrollZoneRegistry.ts)
collects zones, while [useScrollSceneLayout](./src/components/CineView/useScrollSceneLayout.ts)
and [useScrollSceneSnapshots](./src/components/CineView/useScrollSceneSnapshots.ts)
provide measured layout and scene state. Animations consume this published state.
They must not each independently measure or write the root's scroll offset.

Input at a zone boundary must retain the correct order of approach, animation,
and departure in both directions. Large deltas and reverse movement need browser
acceptance; a unit test of interpolation alone cannot prove those transitions.

Scene height can come from authored layout or measured content. Refresh layout
when application content changes dimensions. The scroll ref adds `goToZone` to
the shared navigation API; use an existing registered zone identifier.

A `Position fixed` element belongs to its Scene and is clipped to that Scene's
visible area. Place cross-scene navigation and persistent application controls
outside `CineView`.

## Animation timing

`timeline.driver` is `scene` or `clock`. The scene driver derives animation time
from the owning Scene's progress. The clock driver advances with elapsed time
when the scene's activation conditions allow it. Switching drivers must not
create two writers for one property.

Animation duration and delay contribute to the scene-driven timing bounds.
Dependency references are resolved through the Scene animation registry. Cycles
are invalid. Preserve initial frames while authored variants are still pending;
an unresolved declaration is not an instruction to display the final frame.

Manual animation controls and automatic triggers share the existing control
logic. Do not start a second animation while a manual operation owns the same
property. Stagger timing applies to the supported child structure; additional
wrappers can change which children receive timing offsets.

The scroll and drag drivers consume the same authored animation semantics but
translate progress independently. Clock-driven effects must not extend a scroll
zone merely because they run for a long time.

`AnimateVideo` owns its timeline and media operations through its existing media
controller. Scene exit and unmount release resources according to the component's
configuration. Reentry reacquires media; asynchronous loading must respect the
current resource generation. Video seeking is a browser/media operation and
requires a real browser test with a real asset.

## Layout and responsive sizing

`designWidth` is the only numeric conversion base. Conversion follows viewport
width, including for vertical design coordinates. It does not switch to viewport
height for portrait screens.

`Position` owns placement; `Container` owns dimensions and internal spacing.
Their numeric convenience properties use the design conversion. Use ordinary
CSS through supported style and class properties for viewport-relative layout
or constraints; do not widen public numeric types to accept arbitrary strings.
Scene layout properties have their own public types.

A design canvas is useful for a fixed composition, but scaling all text from a
large desktop width makes mobile text unreadable. Website content can use media
queries to set readable font sizes, wrap text, and reorganize controls while
retaining the framework's numeric coordinate system.

Do not add an independent conversion factor inside a component. Read conversion
values from `CineViewContext`. Preserve consistent conversion between initial,
animated, and restored styles.

## Assets and readiness

Scene assets participate in preload and first-screen readiness. The first screen
can render its loading or error state while assets resolve. The first-screen
timeout prevents an indefinitely pending startup; it is not a performance
promise for every network or device.

The ref API exposes navigation, current scene index, layout refresh, preload, and
performance metrics. `onReady` provides the usable ref after the runtime reaches
its readiness condition. Verify readiness by observing content and using the API,
not by comparing jsdom execution time with a browser paint budget.

Preloading neighboring scenes must respect the cache's existing ownership and
release rules. Network completion after navigation must not alter an obsolete
scene transaction. Tests should cover cancellation, failure, exit, and reentry.

## Accessibility

Drag mode provides a labelled region, keyboard navigation, and a live scene
announcement. Inactive scene content uses `inert` and `aria-hidden` so off-screen
controls do not remain in the tab order or accessibility tree.

A browser assertion must identify the announced current scene and inspect that
scene and its ancestors for hidden state. Testing whether an inactive descendant
contains `document.body` cannot detect a hidden active scene. The assertion must
fail when the scene is missing, inert, or inside an `aria-hidden="true"` ancestor.

Reduced-motion handling follows the existing animation scheduling rules; it does
not imply that every directly controlled scrub animation becomes static.
Applications still need meaningful text, labels, focus order, and sufficient
contrast. Chrome viewport emulation does not establish compatibility with every
mobile browser or assistive technology.

## Errors and cleanup

Public error codes are defined in the types. They cover empty scenes, invalid
component structure or animation configuration, circular dependencies, image or
animation asset failures, and first-screen timeout.

Report errors through the existing callback and fallback behavior. Only suppress
a fallback where the error contract supports recovery; do not silently continue
with inconsistent state. Avoid duplicating reports from both controller and
renderer for the same failure.

Unmounting must cancel pending animation work, remove browser listeners, release
resource references, and dispose of MotionValue subscriptions. Keep generation
or transaction checks around asynchronous completions. Cancellation tests must
verify the resulting state as well as whether cleanup functions were called.

## Package boundaries

[package.json](./package.json) defines the published surface. The root entry
supports ESM and CommonJS. The `cineview/drag` and `cineview/scroll` subpaths expose
CommonJS entries in 1.0.0. `cineview/dev` exposes an ESM development panel, with
its stylesheet imported separately from `cineview/dev/style.css`.

React, React DOM, and Framer Motion are peer dependencies. The library build
keeps them external. Build verification checks declared entries, types, assets,
and package contents. Tests and acceptance evidence remain in the repository and
are excluded from the npm package by the files allowlist.

The root, site, minimal example, and performance example have separate lockfiles.
Install and audit all four. A clean root audit says nothing about vulnerabilities
in another project's lockfile. See [Contributing](./CONTRIBUTING.md) for development
versions and deployment commands, and [release records](./RELEASING.md) for artifact
correspondence.

## Verification

Run the framework static gate before publishing or integrating runtime changes:

```bash
pnpm verify:framework:static
pnpm docs:links
pnpm audit:all
```

For website changes, also run formatting, site types, documentation contracts,
static documentation style checks, and a production site build. Keep the English
and Chinese page trees, section counts, slugs, and frontmatter eyebrows aligned.

Browser acceptance uses the built library and production fixtures. Cover forward
and reverse movement, large deltas, keyboard and scrollbar input, fixed elements,
concurrent animations, cancellation, and media exit/reentry where affected.
Inject deliberate failures to establish that a gate exits unsuccessfully when
its contract is violated.

Use the production browser profiler for actual paint, readiness, frame intervals,
and long tasks. Record browser, machine, viewport, workload, and raw results.
Frame rate is diagnostic data, not a universal release guarantee. jsdom tests
verify behavior and metric shape; they do not measure browser rendering speed.

## Changing the architecture

Create or update a task-flow before a multi-file change. Describe observable
behavior, the state owner, and acceptance criteria. Update this document alongside
any ownership or public behavior change, and keep its links valid.

Use focused tests to reproduce a defect, then run the relevant static and browser
gates. [AGENT_SELF_REVIEW.md](./AGENT_SELF_REVIEW.md) requires independent browser
review for visual, interaction, accessibility, and runtime performance work.
Record limitations explicitly. Preserve previous evidence and user-owned files.
