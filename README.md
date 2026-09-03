# CineView

[中文文档](./README.zh-CN.md)

CineView is a React framework for full-screen narrative interfaces. It provides two navigation modes, scene-scoped animation timelines, width-based responsive coordinates, image preloading, and fixed layers that stay inside their scene.

## Installation

```bash
npm install cineview
# or
pnpm add cineview
# or
yarn add cineview
```

To run the examples from a checkout:

```bash
pnpm install
pnpm build
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev
```

After the package is published, install it with:

```bash
pnpm add cineview framer-motion react react-dom
```

React, React DOM, and Framer Motion are peer dependencies. CineView does not bundle them.

## Choose a mode

Use one component tree with either navigation mode:

| Mode     | Behavior                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `drag`   | One pointer gesture moves between scenes. Release thresholds decide whether the scene change commits or returns to the current scene.       |
| `scroll` | The document scrolls normally. A `Scene` with a `scroll` zone becomes a center-lock section; other sections remain in normal document flow. |

## Quick start

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="scroll">
      <Scene sceneId="hero" scroll={{ zoneId: 'hero', trigger: 'center-lock' }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
          <h1>Opening frame</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

The default mode is `drag`. Remove the `scroll` configuration to use gesture paging. The complete runnable example is in [`examples/minimal`](./examples/minimal).

## Core building blocks

| Component      | Use it for                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `CineView`     | Select the mode, provide the responsive conversion base, preload assets, and expose the imperative ref. |
| `Scene`        | Define a chapter boundary, scene layout, visibility callbacks, and an optional scroll zone.             |
| `Animate`      | Apply a preset or custom animation with `timeline`, `duration`, and `visibility` settings.              |
| `Position`     | Place a node in design coordinates or mount a scene-scoped fixed layer.                                 |
| `Container`    | Convert box-model lengths from design pixels.                                                           |
| `Image`        | Load images through the shared preload cache.                                                           |
| `AnimateVideo` | Map scene or scroll progress to a video's `currentTime`.                                                |

`designWidth` defaults to `750`. Position coordinates and box-model lengths use `viewportWidth / designWidth`; the conversion follows width and does not scale from viewport height.

## Entry points

The primary ESM entry is `cineview` and includes both engines. The `cineview/drag` and `cineview/scroll` subpaths expose `types` and CommonJS `require` conditions only. Use them with `require()` or the matching UMD file, not with an ESM `import` statement.

```js
const { CineView } = require('cineview/drag');
```

The package also publishes `cineview.umd.js`, `cineview-drag.umd.js`, and `cineview-scroll.umd.js` for browser script tags.

## Accessibility and input

The framework leaves native links, buttons, form controls, and editable fields available to the host application, and provides four behaviours of its own:

- **Keyboard paging in drag mode.** The root is a focusable `region` (`aria-roledescription="carousel"`). `PageDown` / `PageUp`, `Home` / `End`, and the arrow keys for the configured axis page between scenes; keys that originate inside a scene are left to whatever authored control received them. Scroll mode is a real scroll container and keeps the browser's own key handling.
- **Scene position is announced.** An off-screen `role="status"` `aria-live="polite"` region publishes the current position on every change.
- **Inactive scenes are removed from the accessibility tree.** A covered, parked, or inactive scene carries `inert` and `aria-hidden`, so it is neither read out nor reachable with Tab.
- **`prefers-reduced-motion` is honoured.** With the OS preference set, persistent `loopAnimation` never starts and visibility-driven enter/exit tweens land on their end state immediately. Scrub is deliberately unchanged: it reflects the reader's own pointer or scroll, rather than motion the page decided to play.

Name the region with `a11y={{ label: 'Product tour' }}` when a page has more than one CineView; it defaults to `Scenes`.

**This is not a claim of WCAG conformance.** Automated tooling covers roughly half of the WCAG success criteria, and the checks here (`src/__tests__/a11y/`, plus a real-browser probe at `site/tools/a11y-probe.mjs` that drives actual key presses and verifies `inert` by attempting to focus through it) are automated ones. Conformance for a shipped page still needs manual testing with real assistive technology, and the authored content inside your scenes is yours to make accessible.

For continuous values, use `useAnimateTimeline()` and bind its MotionValues to styles. Avoid writing per-frame progress to React state. A scroll zone maps one millisecond of authored duration to one pixel of real scroll distance.

## Verification status

The following values are a local baseline and must be regenerated before a release:

| Check               | Baseline      |
| ------------------- | ------------- |
| Framework tests     | 1,533 passing |
| Line coverage       | 96.57%        |
| Function coverage   | 95.64%        |
| Branch coverage     | 90.57%        |
| Type-check and lint | Passing       |
| Build verification  | 14/14         |

Run the static checks with:

```bash
pnpm verify:framework:static
pnpm type-check:site
pnpm test:site-contracts
pnpm --dir site build
```

Unit tests do not replace browser acceptance. Validate drag and scroll input in a real browser, including reverse movement, keyboard and scrollbar input, large deltas, and concurrent animations.

## Documentation

The documentation site is in [`site`](./site). It contains getting-started guides, concepts, component references, mode-specific behavior, and troubleshooting pages. English and Chinese pages use the same directory and URL structure.

## Contributing

Read [`AGENTS.md`](./AGENTS.md) before changing code or documentation. It points to the current specification, task-flow requirements, verification commands, and documentation rules. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the pull request workflow.

## License

MIT. See [`package.json`](./package.json).
