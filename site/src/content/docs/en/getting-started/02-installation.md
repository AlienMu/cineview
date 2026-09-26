---
title: Installation
eyebrow: GETTING STARTED / INSTALLATION
---

These guides target `cineview@0.0.1-beta` and its `Cineview` API. Use the exact version below to run the examples.

## Install the beta and its dependencies

```bash
npm install cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

With pnpm:

```bash
pnpm add cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

The `beta` channel tracks this API. The `latest` channel remains on 1.0.0, which exports `CineView` and has a different API.

The application supplies React, React DOM, and Framer Motion and shares them with Cineview. Installing a second React instance can cause Hook errors.

| Package | Required version |
| --- | --- |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `framer-motion` | `^13.0.0` |

## Import components

Import components from the main entry:

```tsx
import { Animate, AnimateVideo, Cineview, Scene } from 'cineview';
```

The main entry supports drag and scroll mode. Continue with [Quickstart](/docs/03-quickstart), or run the local example below to change the framework source.

## Run the repository example

Repository development uses pnpm 10.22.0 and Node.js `^22.22.1 || >=24.0.0`. The npm package declares Node.js 18 as its minimum; an application's build tools may require a newer version.

```bash
git clone https://github.com/AlienMu/cineview.git
cd cineview
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

To test local changes in another app, build Cineview and run `pnpm pack`. Install the resulting `.tgz` file in that app.

## Other package entries

The main entry supports ECMAScript modules (ESM) and CommonJS and includes both modes. Setting `mode` selects which mode runs; it does not remove the other mode from the bundle.

| Application setup | Entry or file | Included modes |
| --- | --- | --- |
| ES modules or CommonJS | `cineview` | drag and scroll |
| CommonJS | `cineview/drag` | drag |
| CommonJS | `cineview/scroll` | scroll |
| Browser script | `cineview-drag.umd.js` | drag |
| Browser script | `cineview-scroll.umd.js` | scroll |
| Browser script | `cineview.umd.js` | drag and scroll |

CommonJS applications can choose a mode entry to include less engine code:

```js
const { Cineview } = require('cineview/drag');
```

**The two mode subpaths do not provide ES module runtime entries.** TypeScript can resolve their types, but ESM applications must import runtime exports from `cineview`.

`cineview/drag` always runs drag mode and throws if passed a different `mode`. `cineview/scroll` always runs scroll mode. Use the main entry to select modes at runtime.

Universal Module Definition (UMD) files support browser script loading. The page must first supply the React, React DOM, and Framer Motion globals.

## Types and the performance panel

Type declarations ship with the package. Import shared types from `cineview`. Import `CineviewDragProps` and `CineviewScrollProps` from their respective mode subpaths.

Set `monitor` on Cineview to collect frame metrics. To display a panel, import `PerfPanel` from `cineview/dev` and import its stylesheet separately:

```tsx
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';
```

Receive the Cineview ref in `callbacks.onReady` and pass it to `<PerfPanel source={ref} />`. In scroll mode, `debug` only writes locked-zone layout diagnostics to the DOM; it does not display a panel. The same entry provides `usePerfMonitor` for custom metric displays. See [Performance](/docs/01-performance) for a complete example.

Continue with [Quickstart](/docs/03-quickstart).
