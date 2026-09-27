# Changelog

All notable changes to Cineview are documented here.

## Unreleased

- Reverse video seeking when dragging back from a fully entered Scene. Restore
  the departure position when the return is cancelled, including videos that
  continued playing beyond a partial scrub range.
- Update the interactive video example and bilingual guides to cover reverse
  departure and cancellation.
- Rewrite the README around maintainable landing pages, responsive web layouts,
  extensibility, and component reuse in AI-assisted development.

## 1.0.1 — 2026-09-27

Stable release of the API introduced in 0.0.1-beta, published under the npm
`latest` tag, including subsequent fixes and documentation updates.

### Compatibility with 1.0.0

This early release includes incompatible API changes despite its patch version.
Applications using 1.0.0 must update imports from `CineView` to `Cineview` and
check configuration against the current public types and documentation.

- Remove `zoneTrigger`, `Scene.scroll.trigger`, `goToZone`'s `align` option,
  and `Animate.timeline.zoneId`. Declare zones on `Scene.scroll` and place
  animations in their owning Scene.
- Use flat, mode-specific callback configuration.
- `after` waits for entrance completion, excluding exit duration.
- Update package versions, installation examples and AI guides to 1.0.1.

## 0.0.1-beta — 2026-09-27

First beta of the current API on the npm `beta` channel. The `latest` channel
remains on 1.0.0 and its earlier API.

- Standardize public component and type names on `Cineview`. This differs from
  the `CineView` spelling in the published 1.0.0 package.
- Provide separate drag and scroll input behavior, Scene-owned element timelines,
  `after` dependencies, and independent clock entrances.
- Add beginner drag and scroll examples to Quick start and move video control to
  an advanced tutorial.
- Show drag distance, element time, and paused-release guidance in the drag example.
- Ignore stale pointer velocity after a hold so short drags restore as described.
- Explain callback types and JSX composition separately from configuration tables.
- Generate the website coverage badge from successful framework test coverage.
- Keep performance sampling under `monitor`; `debug` exposes scroll layout data.
- Remove the single-value `zoneTrigger`, `Scene.scroll.trigger`, and `goToZone`
  `align` options. Declare zones with `scroll={{ zoneId: 'film' }}` and navigate
  with `goToZone('film', { animated: false })`; lock positioning is unchanged.
- Make `after` consistently wait for entrance completion, excluding exit duration.
  Resolve phase-based scroll timing directly and report unreachable phases through
  `INVALID_ANIMATION`, falling back to duration, delay, and dependencies.
- Remove `Animate.timeline.zoneId`; place animations inside their owning Scene.
  Retain `Scene.scroll.zoneId` for zone identity and navigation.
- Include all mode-specific configuration in the `cineview/drag` and
  `cineview/scroll` entry types. Clarify composition timing across ordinary
  animations, loops, staggered children, and Scene transitions.
- Add an interactive AnimateVideo tutorial, remove the final `/drag` scene's
  navigation buttons, and add a title above the fourth scene's timecode.
- Keep fixed layers in their locked Scene when scrolling reaches the zone end,
  without changing Scene transition timing.
- Preserve active Scene DOM and input values when keyed scenes are reordered,
  and let navigation finish while parent components continue rendering.
- Move production browser acceptance and profiling into the site project, retain
  failure-injection coverage, and remove references to the retired performance
  example from installation, auditing, CI, and release commands.

## 1.0.0 — 2026-09-08

Initial npm release of Cineview. The migration table lists API renames from the
pre-1.0 development versions.

### BREAKING — renames from pre-1.0

| Old                                 | New                                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| `config={{ size: 750 }}`            | `designWidth={750}`                                        |
| `modes={{ drag, scroll }}` wrapper  | mode fields flattened to the root, discriminated by `mode` |
| `performance={{ monitor }}`         | `monitor`                                                  |
| `timeline.waitFor`                  | `timeline.after`                                           |
| `timeline.sceneControlled`          | `timeline.driver: 'scene' \| 'clock'`                      |
| `visibility.replayOnReenter`        | `visibility.replay`                                        |
| `infiniteAnimation`                 | `loopAnimation`                                            |
| `Position layer={{ fixed }}`        | `Position fixed`                                           |
| `Scene stack.mode` / `stack.zIndex` | `layout.overlap` / `layout.zIndex`                         |
| `onSceneWillChange`                 | `onSceneEnter`                                             |
| `onSceneDidChange`                  | `onSceneLeave`                                             |
| `onDragCommit` / `DragCommitDetail` | `onDragEnd` / `DragEndDetail`                              |
| `getCurrentScene()`                 | `getCurrentIndex()`                                        |
| `NO_SCENES` error code              | `EMPTY_SCENES`                                             |

No compatibility shims ship for the old names: each one fails type-checking, so
a migration surfaces at build time rather than at runtime.

### Added

- Added `useAnimateTimeline` to read animation progress through read-only
  MotionValues without per-frame React rendering.
- Added the optional `cineview/dev` ESM entry with `PerfPanel` and
  `usePerfMonitor`. The panel accepts a public Cineview ref through `source`,
  supports English and Chinese labels, and loads styles from
  `cineview/dev/style.css`.
- Split drag/scroll scene rendering, pointer input, fixed layers, animation
  registration, scroll input, viewport measurement, and imperative ref wiring
  into focused owners.
- Narrowed scroll runtime context updates with per-scene external timeline
  stores.
- Completed the Docs and Demo site for the current public API.
- Added root, site, and example format checks to the verification gate.
- Added the React and Node support matrix, CI, and contributor governance files.

### Fixed

- `useLayoutEffect` now resolves to `useEffect` when there is no DOM, so
  server-side rendering no longer emits React's layout-effect warning.
- Development-only diagnostic strings no longer ship in production bundles;
  a build gate keeps them out.

### Package

- Applications must provide React `^19.0.0`, React DOM `^19.0.0`, and Framer
  Motion `^13.0.0` as peer dependencies.
- The main `cineview` entry supports ESM and CommonJS. The `cineview/drag` and
  `cineview/scroll` subpaths provide CommonJS runtime entries and types.
- `files` includes runtime JavaScript, type declarations, CSS, and the build
  artifact manifest. Source maps and pre-compressed copies are excluded.
- `prepublishOnly` runs the headless-safe static gate, so publishing no longer
  requires a local Chrome.
- Added `homepage`, `bugs`, and `browserslist`.
