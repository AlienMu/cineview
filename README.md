# CineView

[简体中文](./README.zh-CN.md)

![Version 1.0.0](https://img.shields.io/badge/version-1.0.0-8A5B43?style=flat-square)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
![TypeScript types included](https://img.shields.io/badge/TypeScript-types_included-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![Framework tests: 1582 passing](https://img.shields.io/badge/framework_tests-1582_passing-4F7562?style=flat-square)](#verification)
[![Line coverage: 96.27 percent](https://img.shields.io/badge/line_coverage-96.27%25-4F7562?style=flat-square)](#verification)
[![MIT license](https://img.shields.io/badge/license-MIT-625D54?style=flat-square)](./LICENSE)

CineView is a React framework for pages made of animated scenes. It handles dragging between scenes, animations that follow scrolling, and animation sequences within a scene. It also provides positioning in design coordinates, image preloading, and video controlled by animation progress.

The test and coverage badges refer to the local run recorded in [Verification](#verification).

[Install](#install) · [Run an example](#run-an-example) · [How it works](#how-it-works) · [Website and documentation](#website-and-documentation) · [Contributing](#contributing)

## Install

Install CineView 1.0.0 and its peer dependencies in a React application:

```bash
npm install cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

With pnpm:

```bash
pnpm add cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

Applications supply React `^19.0.0`, React DOM `^19.0.0`, and Framer Motion `^13.0.0`. TypeScript declarations are included.

## Run an example

Use Node.js 22.22.1 or a newer 22.x release, or Node.js 24+, with pnpm 10.22.0. These are the repository's development requirements.

From this checkout:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

Open the address printed by Vite. The [minimal example](./examples/minimal) has three scenes and a button that restarts the page in the other navigation mode.

To test local package changes in another application, build and pack the checkout:

```bash
pnpm build
pnpm pack
```

For an application next to the `cineview` checkout, install the generated archive and its peer dependencies:

```bash
pnpm add ../cineview/cineview-1.0.0.tgz react@19 react-dom@19 framer-motion@13
```

Adjust the archive path for your directories.

## A page with two scenes

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function App() {
  return (
    <CineView mode="drag" designWidth={750} a11y={{ label: 'Product tour' }}>
      <Scene sceneId="opening">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Animate enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Start here</h1>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="details">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Animate enterAnimation="slide-up" duration={{ enter: 800 }}>
            <h2>Take a closer look</h2>
          </Animate>
        </div>
      </Scene>
    </CineView>
  );
}
```

Drag vertically to change scenes. With the CineView container focused, the arrow keys, PageUp/PageDown, Home, and End also navigate. Buttons and inputs inside a scene keep their own keyboard handling.

## How it works

`CineView` selects the navigation mode. `Scene` groups content and defines its layout. `Animate` applies an animation to that content.

| Configuration                                                           | What controls the animation                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `mode="drag"` with `timeline.driver: 'scene'`                           | The scene's element timeline follows the gesture and continues after release. |
| `mode="drag"` with `timeline.driver: 'clock'`                           | The animation plays by time after the scene arrives.                          |
| `mode="scroll"`, inside a `Scene.scroll` region, with `driver: 'scene'` | The region's real scroll position controls progress.                          |
| `mode="scroll"` outside a scroll region, or with `driver: 'clock'`      | The animation plays by time when its element meets the visibility conditions. |

The default mode is `drag` and the default driver is `scene`. Mode and driver answer different questions: how the page moves, and how an element's animation advances.

A mode change starts a different engine. The [example](./examples/minimal/src/App.tsx) uses separate branches and a `key` to restart explicitly; it does not transfer progress between modes.

### Animation that follows scrolling

In scroll mode, scenes stay in document flow. Adding `Scene.scroll` creates a region that holds the scene in view while scrolling advances its animation:

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function ScrollPage() {
  return (
    <CineView mode="scroll" designWidth={750}>
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <h1>A page that scrolls</h1>
      </Scene>

      <Scene
        sceneId="detail"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'detail', trigger: 'center-lock' }}
      >
        <Animate
          enterAnimation={{
            initial: { opacity: 0, y: 60 },
            animate: { opacity: 1, y: 0 },
          }}
          duration={{ enter: 1600, exit: 0 }}
          timeline={{ driver: 'scene' }}
        >
          <h2>Scroll to reveal the detail</h2>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

One millisecond of authored region duration corresponds to one CSS pixel of scroll travel. In this example, the animation spans 1,600 pixels. Scroll back to reverse it. The scene's visible height is separate from that animation distance.

A large input can stop at a region boundary; the next input continues. Wheel, touch, keyboard, and scrollbar input use the same scroll position. [Scroll behavior](./site/src/content/docs/en/scroll/01-centerlock.md) explains the bounds and zero-duration cases.

### Sequencing and repetition

Use `timeline.after` to connect animations in the same Scene, and `timeline.delay` to add a pause. For example, `timeline={{ after: 'heading', delay: 120 }}` starts after the animation named `heading`, with another 120 ms of delay.

`stagger={{ each: 110 }}` starts a container's direct children at timed intervals. Use separate Animate elements when each item needs its own progress controlled by scrolling.

`loopAnimation` repeats an effect while that animation is active. `exitAnimation` defines an optional exit. The [timeline guide](./site/src/content/docs/en/concepts/02-timeline.md) covers driver differences: drag animations with `driver: 'clock'` do not participate in `after` sequencing and ignore `exitAnimation`.

### Responsive coordinates

`designWidth` is the design's width in pixels; it defaults to `750`. Position coordinates and numeric Container lengths use:

```text
scale = viewport width / designWidth
```

Both axes use this scale. CSS strings retain their units, and unitless values such as opacity are not scaled. Viewport height does not introduce another conversion factor. Use CSS breakpoints for text and layout that need to reflow; design-coordinate scaling alone does not provide a mobile reading layout.

## Components and extension points

| API                  | Purpose                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `CineView`           | Navigation mode, shared configuration, callbacks, and navigation ref                               |
| `Scene`              | Scene content, layout, asset declarations, and optional scroll region                              |
| `Animate`            | Presets, custom property changes, parallel or sequential composition, and timing                   |
| `Position`           | Coordinates and centering relative to the containing block; `fixed` keeps content within its Scene |
| `Container`          | Convert layout lengths from design pixels                                                          |
| `Image`              | Load an image through the shared preload cache                                                     |
| `AnimateVideo`       | Seek video frames from animation progress or use normal playback                                   |
| `useAnimateTimeline` | Read the nearest Animate's progress as MotionValues for custom DOM, SVG, or Canvas work            |

A custom component can read progress without putting each frame into React state:

```tsx
import { motion } from 'framer-motion';
import { useAnimateTimeline } from 'cineview';

export function ProgressLine() {
  const { progress } = useAnimateTimeline();

  return (
    <motion.div
      style={{
        height: 4,
        width: '100%',
        background: '#d59273',
        transformOrigin: 'left',
        scaleX: progress,
      }}
    />
  );
}
```

Render `ProgressLine` inside an `Animate`. The hook reads that Animate's timeline. Render-prop children are also available, but their progress updates render React; use the MotionValue hook for continuous drawing.

`ref.current.goToScene(index)` changes the scene. The ref also exposes `refreshLayout()`, `preload()`, `getCurrentIndex()`, and `getPerformanceMetrics()`. Scroll refs provide `goToZone()`. `onReady` supplies this API when it becomes available; use `preload()` to wait for declared asset loading.

Scene fixed content is clipped to its Scene. Put persistent site navigation outside CineView. See the [component reference](./site/src/content/docs/en/components/01-cineview.md) for configuration and callbacks.

## Package entry points

| Entry                    | Supported use                                                              |
| ------------------------ | -------------------------------------------------------------------------- |
| `cineview`               | Main ESM and CommonJS entry, including both navigation engines             |
| `cineview/drag`          | CommonJS `require` and types for drag mode                                 |
| `cineview/scroll`        | CommonJS `require` and types for scroll mode                               |
| `cineview/dev`           | Optional ESM development tools, including `PerfPanel` and `usePerfMonitor` |
| `cineview/dev/style.css` | Styles for the development panel                                           |

Use `import { CineView } from 'cineview'` in an ESM application. The mode-specific subpaths have no ESM import condition. Browser script distributions are `cineview.umd.js`, `cineview-drag.umd.js`, and `cineview-scroll.umd.js`.

React, React DOM, and Framer Motion remain external peer dependencies. Development tools and their CSS are opt-in.

## Accessibility and motion preferences

The drag container supports keyboard navigation, a configurable accessible label, and scene-position announcements. Inactive drag scenes use `inert` and `aria-hidden`. Native controls inside scenes retain their normal interaction.

With `prefers-reduced-motion`, `loopAnimation` effects stop. Entrances and exits triggered by visibility changes jump to their final state. Animations controlled by dragging or scrolling still follow the input. Authored content still needs readable text, labels, and a usable focus order; a site's accessibility requires checking its complete content and interactions.

## Verification

Local framework run on **September 8, 2026**, using Node.js 22.22.1:

| Measure               | Result       |
| --------------------- | ------------ |
| Framework test suites | 118 passed   |
| Framework tests       | 1,582 passed |
| Statement coverage    | 94.85%       |
| Branch coverage       | 90.22%       |
| Function coverage     | 95.15%       |
| Line coverage         | 96.27%       |

The figures come from `pnpm test:coverage:framework`, which excludes site tests. The configured coverage minimum is 90% for each metric. Regenerate the snapshot after framework changes and before a release.

The [verification record](./VERIFICATION.md) records the commands, scope, and browser results. To run the checks:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/performance-test install --frozen-lockfile

pnpm verify:framework:static
pnpm type-check
pnpm type-check:site
pnpm test:site-contracts
pnpm docs:style:static
pnpm --dir site build
```

With Chrome available, `pnpm test:browser` runs the framework's browser checks. Static checks and coverage do not establish drag or scroll behavior on their own. The [CI workflow](./.github/workflows/ci.yml) defines Node.js 22.22.1 and 24.x checks; the [release workflow](./.github/workflows/release.yml) requires browser acceptance before publishing.

## Website and documentation

A public site URL has not been configured in this repository. Run the bilingual site locally:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm build
pnpm --dir site dev
```

The default address is [http://localhost:4000](http://localhost:4000); use the address printed by Vite if the port is occupied. The [documentation](http://localhost:4000/docs) and [drag demo](http://localhost:4000/drag) are routes on that site.

Documentation source: [English](./site/src/content/docs/en) · [简体中文](./site/src/content/docs/zh). Both languages cover installation, concepts, drag and scroll behavior, components, and advanced use.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and [AGENTS.md](./AGENTS.md) for repository rules. Runtime changes need browser evidence in addition to unit tests. Keep the English and Chinese documentation aligned.

Report bugs through [GitHub issues](https://github.com/AlienMu/cineview/issues).

## License

[MIT](./LICENSE), copyright Alien.mu.
