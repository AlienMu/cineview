<p align="center">
  <a href="https://cineview.pages.dev">
    <img src="./site/public/favicon.svg" width="64" height="64" alt="Cineview" />
  </a>
</p>

<h1 align="center">Cineview</h1>

<p align="center">A React animation framework built around timelines, with drag and scroll modes.</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/dm/cineview?style=flat-square&amp;color=8A5B43" alt="npm monthly downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-555?style=flat-square" alt="MIT license" /></a>
  <br />
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-287EA3?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript" /></a>
  <a href="https://cineview.pages.dev/coverage.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&amp;style=flat-square" alt="Framework line coverage" /></a>
</p>

<p align="center">
  <a href="https://cineview.pages.dev">Try scrolling</a> ·
  <a href="https://cineview.pages.dev/drag">Try dragging</a> ·
  <a href="https://cineview.pages.dev/docs">Documentation</a> ·
  <a href="#ai-read-this">AI, read this</a>
</p>

Cineview is a React animation framework for landing pages and interactive presentations. Its goal is to make thoughtfully designed pages easier to build, maintain, and extend as their content changes. Scenes and timelines organize the page, with drag and scroll modes for product introductions, brand showcases, and campaigns.

Much of the work on these pages repeats: coordinating animations, recovering from interrupted gestures, and loading assets during scene changes. Cineview maintains this shared behavior in the framework, reducing the timing conflicts and animation-state problems that separate implementations can introduce. Page code can focus on content, layout, and pacing.

Package common sections as React components and reuse them across pages. Update copy, assets, or animation order in the relevant scene. Responsive sizing and CSS layouts adapt the same page to desktop, tablet, and phone browsers. Combine animation presets, define custom effects, or connect Canvas, SVG, and WebGL content to the existing timeline.

The same conventions help with AI-assisted development. Reusing components and reading only the guides and code needed for a task can reduce tokens spent regenerating basic behavior and reconstructing an entire page. New pages build on existing components; updates stay focused on the scenes that need to change.

## Features

| Capability                                                                               | How to use it                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable scenes and components                                                           | Divide content into Scenes and package common sections as React components for product pages, campaigns, or interactive presentations.      |
| Timeline sequencing                                                                      | Declare durations, delays, and dependencies. Dependent animations adjust when a predecessor's entrance duration changes.                    |
| Drag and scroll modes                                                                    | Drag between full-screen scenes or scroll through a page. Connect animations to scroll progress where content needs to unfold gradually.    |
| [Animation presets](https://cineview.pages.dev/docs/08-presets)                          | Start with fades, slides, zooms, rotations, flips, bounces, blurs, and other built-in effects.                                              |
| [Composition and custom animations](https://cineview.pages.dev/docs/05-custom-animation) | Combine presets and custom properties on one element, define finer changes with keyframes, and use timelines to sequence separate elements. |
| Entrances, loops, and stagger                                                            | Configure entrance, loop, and exit effects where needed. Reveal children at intervals to sequence headings, cards, or lists.                |
| [Video control](https://cineview.pages.dev/docs/11-video-timeline)                       | Use AnimateVideo to advance video frames through dragging or scrolling, select a video interval, and coordinate it with text animations.    |
| [Custom drawing and extensions](https://cineview.pages.dev/docs/09-use-animate-timeline) | Read animation progress with useAnimateTimeline and connect Canvas, SVG, WebGL, or your own components to the existing progress controls.   |
| [Responsive layout](https://cineview.pages.dev/docs/05-responsive)                       | Scale dimensions from a design width, position and size content with Position and Container, and adapt layouts with CSS.                    |
| [Resource preloading](https://cineview.pages.dev/docs/02-preload)                        | Prepare scene images in advance and handle initial loading, progress, and failures to reduce waiting for assets during scene changes.       |
| Types and interaction                                                                    | Check component configuration with TypeScript; drag mode provides keyboard navigation and current-scene announcements.                      |

## Try it

In a React 19 project, install Cineview and its peer dependencies:

```bash
npm install cineview@1.0.1 react@19 react-dom@19 framer-motion@13
```

This example uses the `Cineview` API in 1.0.1. Version 1.0.0 uses the earlier `CineView` API; update imports and configuration when upgrading.

Replace `App.tsx` with the component below and set `body { margin: 0; }` in your global stylesheet. No media files are needed.

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ background: '#f5e8d8', padding: 40 }}>
        <h1>Drag up to the next scene</h1>
      </Scene>
      <Scene sceneId="details" style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>The title appears first</h2>
        </Animate>
        <Animate
          enterAnimation="slide-up"
          duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}
        >
          <p>The detail follows the title.</p>
        </Animate>
      </Scene>
    </Cineview>
  );
}
```

Drag upward to reveal the second scene: the title appears, then the description follows. Try changing the text and animation durations to make it your own. For scroll mode, start with the [interactive quick start](https://cineview.pages.dev/docs/03-quickstart).

## AI, read this

If you are an AI coding assistant working with Cineview, **read [llms.txt](./llms.txt) first**, then follow its links for the task at hand:

- [Quick start](./docs/ai/quickstart.md): install the package and build a complete page.
- [Timelines](./docs/ai/timeline.md): arrange animation order, durations, and delays.
- [Modes](./docs/ai/modes.md): choose drag or scroll and check their constraints.
- [Recipes](./docs/ai/recipes.md): add a scroll narrative or video.

These guides target the Cineview 1.0.1 API. Check the version in the index before writing code, and use the linked types and detailed references when a property is unclear. Read only what the task needs: loading selected guides uses fewer input tokens than loading the entire documentation, leaving more context for the page being built.

## Docs and examples

See the [documentation](https://cineview.pages.dev/docs) for component APIs and more examples:

- [Animation order](https://cineview.pages.dev/docs/04-orchestration)
- [Video control](https://cineview.pages.dev/docs/11-video-timeline)
- [Canvas, SVG, and WebGL](https://cineview.pages.dev/docs/09-use-animate-timeline)
- [Responsive layout](https://cineview.pages.dev/docs/05-responsive)
- [Resource preloading](https://cineview.pages.dev/docs/02-preload)

Prefer to run the source locally? The [minimal example](./examples/minimal/README.md) includes startup commands and both modes.

## Contributing

Bug reports, examples, and improvements are welcome. Start with [Contributing](./CONTRIBUTING.md) for local setup and checks. See the [Changelog](./CHANGELOG.md) for version changes and [Releases](./RELEASING.md) for publishing instructions.

## License

[MIT](./LICENSE) © Alien.mu.
