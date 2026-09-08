# Changelog

All notable changes to CineView are documented here.

## 1.0.0 — 2026-09-08

Initial npm release of CineView. The migration table lists API renames from the
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
  `usePerfMonitor`. The panel accepts a public CineView ref through `source`,
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
