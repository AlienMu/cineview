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
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview/beta?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm beta version" /></a>
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

AI-generated landing pages often feel scattered to me. The content and animations are there, but the page lacks a clear order and rhythm. I want a landing page to unfold like a film, one scene at a time.

- **Timeline sequencing:** Arrange animations in order; dependent animations follow when durations change.
- **Two interaction modes:** Scroll through content or drag between full-screen scenes.
- **Video control:** Advance video frames with scroll or drag progress.
- **Responsive layout:** Scale design dimensions to the viewport width.

## Try it

In a React 19 project, install the beta and its peer dependencies:

```bash
npm install cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

This example uses the beta `Cineview` API. The npm `latest` version, `1.0.0`, uses the earlier `CineView` API; install the version above to run this example.

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

These guides target the current beta API. Check the version in the index before writing code, and use the linked types and detailed references when a property is unclear. Read only what the task needs: loading selected guides uses fewer input tokens than loading the entire documentation, leaving more context for the page being built.

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
