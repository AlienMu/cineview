---
title: Installation
eyebrow: GETTING STARTED / INSTALLATION
---

Install CineView 1.0.0 in a React application with React 19 and Framer Motion 13.

## Install in a React app

```bash
npm install cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

With pnpm:

```bash
pnpm add cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

## Run the local example

The repository uses pnpm 10.22.0 and Node.js `^22.22.1 || >=24.0.0`.

```bash
git clone https://github.com/AlienMu/cineview.git
cd cineview
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

To test local package changes in another app, run `pnpm pack` in the CineView repository after building, then install the generated `.tgz` file in that app.

## Peer dependencies

The application supplies these three runtimes:

| Package         | Required version |
| --------------- | ---------------- |
| `react`         | `^19.0.0`        |
| `react-dom`     | `^19.0.0`        |
| `framer-motion` | `^13.0.0`        |

Keep one copy of each runtime in the app bundle.

## Three runtime entries

| Entry             | Contents                         | Module support          |
| ----------------- | -------------------------------- | ----------------------- |
| `cineview`        | Both engines, selected by `mode` | ES modules and CommonJS |
| `cineview/drag`   | Drag engine                      | CommonJS                |
| `cineview/scroll` | Scroll engine                    | CommonJS                |

```tsx
import { CineView, Scene, Animate } from 'cineview';
```

## The full ES module (ESM) entry includes both engines

Use `cineview` in Vite, webpack, or Rollup applications. The full entry references both engines, so selecting a single `mode` does not remove the other engine from the bundle.

## Mode subpaths support CommonJS

The mode subpaths have `types` and `require` export conditions, with no `import` condition. TypeScript can resolve their types, but an ESM application cannot import runtime exports through those subpaths.

```js
const { CineView } = require('cineview/drag');
```

Separate Universal Module Definition (UMD) files support script loading when the application already provides the required React, React DOM, and Framer Motion globals. These files do not supply those runtimes.

## Select an entry

| Application setup           | Entry or file            |
| --------------------------- | ------------------------ |
| ESM bundler                 | `cineview`               |
| CommonJS, drag only         | `cineview/drag`          |
| CommonJS, scroll only       | `cineview/scroll`        |
| Browser script, drag only   | `cineview-drag.umd.js`   |
| Browser script, scroll only | `cineview-scroll.umd.js` |
| Browser script, both modes  | `cineview.umd.js`        |

A UMD file contains its selected engine code in one bundle.

## Single-mode behavior

The drag entry always runs drag mode. A JavaScript caller that passes another `mode` value receives an error. The scroll entry always runs scroll mode and does not use a supplied `mode` value. For runtime mode selection, use the full `cineview` entry.

## TypeScript and development tools

Types ship with the package. Import shared types from `cineview`; `CineViewDragProps` and `CineViewScrollProps` are exported by their respective mode subpaths.

Import the optional performance panel and its styles separately:

```tsx
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';
```

Enable `monitor` on CineView and pass the ref from `callbacks.onReady` to the panel's `source` prop. The same entry exports `usePerfMonitor` for custom displays. See [Performance](/docs/01-performance) for the available metrics.

Continue with [Quickstart](/docs/03-quickstart).
