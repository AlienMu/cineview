---
title: Installation
eyebrow: GETTING STARTED / INSTALLATION
---

Install `cineview` plus its two peer dependencies, pick one entry point, and you are set.

## Package install

```bash
pnpm add cineview framer-motion
# or
npm install cineview framer-motion
```

## Peer dependencies

CineView does not bundle React or Framer Motion. Both are peer dependencies supplied by your app:

| Package         | Required version       |
| --------------- | ---------------------- |
| `react`         | `^18.0.0 \|\| ^19.0.0` |
| `react-dom`     | `^18.0.0 \|\| ^19.0.0` |
| `framer-motion` | `>=10.0.0`             |

Keep one copy of each runtime in the app bundle. Do not duplicate framer-motion into a vendor chunk.

## Three entry points

| Entry             | Contents                                                                  | When to use                            |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| `cineview`        | Full entry, both drag and scroll engines, dispatched by `mode` at runtime | You use both modes, or haven't decided |
| `cineview/drag`   | Drag engine only; exports `CineViewDragProps`                             | Drag pagination only                   |
| `cineview/scroll` | Scroll engine only; exports `CineViewScrollProps`                         | Scroll mode only                       |

```tsx
import { CineView } from 'cineview'; // full entry, dispatched by mode at runtime
```

## On the ES module (ESM) side, the full entry carries both engines

The `CineView` from the full entry is a dispatcher: it picks the drag engine or the scroll engine based on `mode`. The dispatcher references both engines **statically**, so tree-shaking cannot drop either one. Even if you only ever write `mode="scroll"`, the ESM bundle you ship contains both engines.

The build script accepts this cost explicitly (`scripts/build-all.mjs:23-28`). It is not a gap awaiting a fix. The full ESM build stays inside its size budget, and splitting waits until a real ESM consumer asks for it. The only way to avoid that weight right now is the Universal Module Definition (UMD) or CommonJS (CJS) path, described in "The per-mode entries have only a require condition."

## The per-mode entries have only a require condition

In `package.json`'s `exports`, `cineview/drag` and `cineview/scroll` declare only `types` and `require`, with **no `import` condition** (`package.json:14-21`).

The result is asymmetric. TypeScript resolves the types for both subpaths (the `types` condition is present), so completion works and `tsc` stays quiet. ESM bundlers resolve through the `import` condition, and finding none is a resolution error. So `import { CineView } from 'cineview/drag'` **fails to build** in a Vite or webpack ESM graph, even though it looks fine at the type level.

These subpaths exist for exactly one reason: a single-file UMD bundle cannot be code-split. They serve `<script>` inclusion and CJS environments:

```html
<script src="cineview-drag.umd.js"></script>
```

```js
const { CineView } = require('cineview/drag');
```

## Choosing an entry

| How you consume                       | Pick                                               | Cost                                                         |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| ESM bundler (Vite / webpack / Rollup) | the full `cineview` entry                          | both engines in the bundle, not shakeable                    |
| `<script>` tag, one mode only         | `cineview-drag.umd.js` or `cineview-scroll.umd.js` | none, this is the leanest path                               |
| `<script>` tag, both modes            | `cineview.umd.js`                                  | a single file cannot code-split, so both engines are inlined |
| CJS `require`, one mode only          | `cineview/drag` or `cineview/scroll`               | none                                                         |

"Both engines in one UMD file" is a property of the format, not a defect. UMD and IIFE do not support code splitting, and Rollup refuses outright with `UMD and IIFE output formats are not supported for code-splitting builds`.

So there is one way to give single-mode consumers a smaller file: build a separate artifact. That is what the `cineview/drag` and `cineview/scroll` subpaths are. Pick the right entry and there is no wasted weight. Pick the wrong one and the bundle carries an engine you never call.

## Single-mode builds reject the wrong mode

`cineview/drag` (and `cineview-drag.umd.js`) validates `mode` at construction. Passing `mode="scroll"` **throws**, and the message names the build to load instead (`src/entry-drag.ts:35-49`).

That is deliberate. This artifact contains no scroll engine, and around 30 places inside the drag engine read `props.mode` and skip execution when it is not `'drag'`. Rendering silently as drag looks like "scroll mode is broken." Script-tag and CJS consumers have no type protection, so only a runtime throw closes the hole.

The scroll side **does not mirror the check**. `DirectScrollCineView` never reads `props.mode`; it hardcodes `mode: 'scroll'` into the events it emits. A wrong `mode` cannot break it, so there is no silent failure to guard against (`src/entry-scroll.ts:8-13`).

## TypeScript types

Type definitions ship with the package; no separate `@types/*` needed. Entry-level types (`CineViewDragProps` / `CineViewScrollProps`) come from the corresponding subpath. They resolve even on the ESM side, because the `types` condition is present.

Next: [Quickstart](/docs/03-quickstart).
