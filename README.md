# CineView

[简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/cineview?style=flat-square&color=8A5B43)](https://www.npmjs.com/package/cineview)
[![CI](https://github.com/AlienMu/cineview/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AlienMu/cineview/actions/workflows/ci.yml)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square)](https://react.dev/)
[![MIT license](https://img.shields.io/npm/l/cineview?style=flat-square)](./LICENSE)

CineView is a React framework for building interactive product showcases, full-screen presentations, and scroll-driven pages. It combines scene navigation, animation sequencing, responsive positioning, and media playback in a component-based API.

A page is composed of `Scene` components. Each scene contains ordinary React content and declares its layout and animations. CineView connects those scenes to drag or scroll input, so page navigation and the animations within each scene work together.

[Website](https://cineview.pages.dev) · [Documentation](https://cineview.pages.dev/docs) · [Drag demo](https://cineview.pages.dev/drag) · [npm](https://www.npmjs.com/package/cineview)

## Use cases

- Product and brand pages that introduce a subject through a sequence of animated sections.
- Full-screen presentations and portfolios with vertical or horizontal drag navigation.
- Editorial pages that combine normal reading flow with illustrations and video controlled by scrolling.

CineView uses Framer Motion for animation and works with existing React components, CSS layouts, and custom graphics. Page structure and visual design remain part of the application.

## Core capabilities

- **Scenes and navigation.** Organize a page into sections, configure their size and transitions, and select drag or scroll navigation. Drag pages support pointer, touch, and keyboard interaction; scroll pages use a real scroll container.
- **Animation sequencing.** Apply presets or custom property animations. Connect entrances with `timeline.after`, add delays, and compose parallel effects. Staggered reveals, loops, and exits cover different parts of a scene's presentation.
- **Responsive positioning.** Combine CSS layouts with `Position` and `Container` for design-coordinate placement. `designWidth` scales numeric design lengths with viewport width, while CSS units and breakpoints remain available for layouts that reflow.
- **Images and video.** Declare images for preloading and reuse the shared image cache. `AnimateVideo` connects video frames to animation progress or supports normal playback within a scene.
- **Custom rendering.** `useAnimateTimeline` exposes progress as MotionValues for custom DOM, SVG, and Canvas components. Continuous updates can run without putting each frame into React state.
- **Application controls.** Navigate through a ref, respond to scene and animation callbacks, and refresh layout after content changes. Optional tools in `cineview/dev` provide a performance panel and a metrics hook.

## Installation

In a React 19 application, install CineView and Framer Motion 13:

```bash
npm install cineview framer-motion@13
```

With pnpm:

```bash
pnpm add cineview framer-motion@13
```

CineView 1.0.0 requires React `^19.0.0`, React DOM `^19.0.0`, and Framer Motion `^13.0.0`. The main package includes TypeScript declarations and supports ESM and CommonJS. See the [installation guide](https://cineview.pages.dev/docs/02-installation) for package entry points and development tools.

## Quick start

The examples are complete application components. Use either one as `App.tsx` in a React application. They use inline styles and require no additional stylesheet or media files.

### Drag between scenes

This page presents two full-screen scenes. The first scene reveals a heading followed by its description; dragging moves to the second scene.

```tsx
import type { CSSProperties } from 'react';
import { Animate, CineView, Scene } from 'cineview';

const panel: CSSProperties = {
  boxSizing: 'border-box',
  height: '100%',
  display: 'grid',
  placeContent: 'center',
  padding: '2rem',
  textAlign: 'center',
};

export default function App() {
  return (
    <CineView mode="drag" designWidth={750} a11y={{ label: 'Product introduction' }}>
      <Scene sceneId="introduction">
        <div style={{ ...panel, background: '#f7f2ec' }}>
          <Animate animateId="heading" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Meet the new collection</h1>
          </Animate>
          <Animate
            enterAnimation="slide-up"
            duration={{ enter: 400 }}
            timeline={{ after: 'heading' }}
          >
            <p>Designed for everyday use.</p>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="details">
        <div style={{ ...panel, background: '#e8edf0' }}>
          <Animate enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h2>Explore the details</h2>
          </Animate>
        </div>
      </Scene>
    </CineView>
  );
}
```

`CineView` controls navigation, `Scene` defines each section, and `Animate` defines an element's animation. `timeline.after` connects the description to the heading's entrance. Drag vertically to navigate; use `direction="x"` for a horizontal presentation. Keyboard navigation is available when the CineView container is focused.

### Follow scroll progress

Scroll mode keeps content in document flow. A scene with `scroll` holds its position at the center of the viewport while scrolling advances the animation. The surrounding scenes continue to behave as page sections.

```tsx
import type { CSSProperties } from 'react';
import { Animate, CineView, Scene } from 'cineview';

const panel: CSSProperties = {
  boxSizing: 'border-box',
  height: '100%',
  display: 'grid',
  placeContent: 'center',
  padding: '2rem',
  textAlign: 'center',
};

export default function App() {
  return (
    <CineView mode="scroll" designWidth={750}>
      <Scene sceneId="introduction" layout={{ height: '100vh' }}>
        <div style={panel}>
          <h1>Every detail has a story</h1>
        </div>
      </Scene>

      <Scene
        sceneId="details"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'details', trigger: 'center-lock' }}
      >
        <div style={{ ...panel, background: '#f7f2ec' }}>
          <Animate
            enterAnimation={{
              initial: { opacity: 0, y: 60 },
              animate: { opacity: 1, y: 0 },
            }}
            duration={{ enter: 1600, exit: 0 }}
            timeline={{ driver: 'scene' }}
          >
            <h2>Reveal it as the page scrolls</h2>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="closing" layout={{ height: '100vh' }}>
        <div style={panel}>
          <h2>Continue exploring</h2>
        </div>
      </Scene>
    </CineView>
  );
}
```

The details animation spans 1,600 CSS pixels of scrolling: one millisecond of authored duration corresponds to one pixel of scroll distance. Scrolling back reverses the animation. The scene's visible height is configured separately from that distance.

Scenes without `scroll` can still contain animations triggered by visibility. The [mode guide](https://cineview.pages.dev/docs/04-choosing-mode) and [scroll guide](https://cineview.pages.dev/docs/01-centerlock) explain when to use each behavior.

## Learn more

| Topic                                      | Guide                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page structure and navigation              | [CineView](https://cineview.pages.dev/docs/01-cineview) and [Scene](https://cineview.pages.dev/docs/02-scene)                                                                              |
| Presets, custom animations, and sequencing | [Animate](https://cineview.pages.dev/docs/03-animate) and [Timelines](https://cineview.pages.dev/docs/02-timeline)                                                                         |
| Layout and design coordinates              | [Responsive layout](https://cineview.pages.dev/docs/05-responsive), [Position](https://cineview.pages.dev/docs/05-position), and [Container](https://cineview.pages.dev/docs/07-container) |
| Loading images and controlling video       | [Preloading](https://cineview.pages.dev/docs/02-preload) and [AnimateVideo](https://cineview.pages.dev/docs/04-animate-video)                                                              |
| Extending animation progress               | [useAnimateTimeline](https://cineview.pages.dev/docs/09-use-animate-timeline)                                                                                                              |

The website includes English and Chinese documentation, a scroll-based homepage, and a separate drag demonstration. The [minimal example](./examples/minimal/src/App.tsx) shows both modes with the same scene content.

## Accessibility

Drag navigation includes keyboard controls, scene-position announcements, and inactive-scene focus handling. CineView also responds to reduced-motion preferences for loops and visibility-triggered animations; animations linked directly to dragging or scrolling continue to follow the input. See the [accessibility configuration](https://cineview.pages.dev/docs/01-cineview) for these behaviors and the page-level labels and focus order an application needs to provide.

## Contributing

Development setup, local examples, and validation commands are in [CONTRIBUTING.md](./CONTRIBUTING.md). The [verification record](./VERIFICATION.md) documents test coverage and browser acceptance; framework coverage checks enforce a 90% minimum for statements, branches, functions, and lines.

Report bugs and propose improvements through [GitHub issues](https://github.com/AlienMu/cineview/issues). Release changes are recorded in the [changelog](./CHANGELOG.md).

## License

[MIT](./LICENSE) © Alien.mu.
