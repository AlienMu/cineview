---
title: Installation
eyebrow: GETTING STARTED / INSTALLATION
---

Install `cineview` and its peer dependencies, then select the target entry point.

## Package install

```bash
pnpm add cineview framer-motion
# or
npm install cineview framer-motion
```

## Peer dependencies

CineView does not bundle React or Framer Motion. Both are peer dependencies supplied by the host application:

| Package         | Required version       |
| --------------- | ---------------------- |
| `react`         | `^18.0.0 \|\| ^19.0.0` |
| `react-dom`     | `^18.0.0 \|\| ^19.0.0` |
| `framer-motion` | `>=10.0.0`             |

Keep one copy of each runtime in the app bundle. Do not duplicate framer-motion into a vendor chunk.

## Three entry points

| Entry             | Contents                                                                  | When to use                                      |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| `cineview`        | Full entry, both drag and scroll engines, dispatched by `mode` at runtime | Projects needing both modes or dynamic selection |
| `cineview/drag`   | Drag engine only; exports `CineViewDragProps`                             | Drag pagination only                             |
| `cineview/scroll` | Scroll engine only; exports `CineViewScrollProps`                         | Scroll mode only                                 |

```tsx
import { CineView } from 'cineview'; // full entry, dispatched by mode at runtime
```

## On the ES module (ESM) side, the full entry carries both engines

The `CineView` from the full entry is a dispatcher: it picks the drag engine or the scroll engine based on `mode`. The dispatcher references both engines **statically**, so tree-shaking cannot drop either one. Even when declaring only `mode="scroll"`, the ESM bundle contains both engines.

The bundle size remains within standard performance targets. For production environments requiring strict isolation of unused engine code, specialized mode-specific entry points are available.

## The per-mode entries have only a require condition

In `package.json`, `cineview/drag` and `cineview/scroll` define `types` and `require` export conditions. In standard ESM bundling setups, import the primary `cineview` package. Mode-specific subpaths serve CommonJS runtimes and standalone browser script tags:

```html
<script src="cineview-drag.umd.js"></script>
```

```js
const { CineView } = require('cineview/drag');
```

## Choosing an entry

| Consumption method                     | Pick                                               | Cost                                                |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| ESM bundlers (Vite / Webpack / Rollup) | Primary `cineview` entry                           | Includes both engines; dispatches at runtime        |
| Browser `<script>` tag (single mode)   | `cineview-drag.umd.js` or `cineview-scroll.umd.js` | Loads only the target engine; minimal download size |
| Browser `<script>` tag (both modes)    | `cineview.umd.js`                                  | Single-file distribution containing both engines    |
| CommonJS `require` (single mode)       | `cineview/drag` or `cineview/scroll`               | Loads only the specified engine implementation      |

Single-file Universal Module Definition (UMD) formats cannot support dynamic code splitting due to distribution format constraints. To maintain a lightweight footprint when loaded via browser `<script>` tags, CineView provides independently built UMD bundles for each interaction mode.

## Single-mode builds reject the wrong mode

`cineview/drag` (and `cineview-drag.umd.js`) validates the `mode` parameter at startup. If initialized with `mode="scroll"`, the engine throws an error detailing the correct scroll bundle to import.
`DirectScrollCineView` operates in scroll mode by default and injects `mode: 'scroll'` into event arguments, requiring no redundant mode checks.

## TypeScript types

Type definitions ship with the package; no separate `@types/*` needed. Entry-level types (`CineViewDragProps` / `CineViewScrollProps`) come from the corresponding subpath. They resolve even on the ESM side, because the `types` condition is present.

Next: [Quickstart](/docs/03-quickstart).
