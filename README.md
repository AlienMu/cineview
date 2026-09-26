# Cineview

[简体中文](./README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/cineview/beta?style=flat-square&color=8A5B43)](https://www.npmjs.com/package/cineview)
[![Tests](https://github.com/AlienMu/cineview/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AlienMu/cineview/actions/workflows/ci.yml)
[![Framework line coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&style=flat-square)](https://cineview.pages.dev/coverage.json)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square)](https://react.dev/)
[![MIT](https://img.shields.io/badge/license-MIT-555?style=flat-square)](./LICENSE)

Cineview is a React framework for pages controlled by dragging and scrolling. Define animation durations and dependencies, then let gestures or scroll position advance that timeline.

Each `Scene` owns its content and element time. `Animate` describes effects such as fading and movement; `after` starts an element when its predecessor finishes entering, then adds the follower’s delay. Ordinary entrances that play over time can coexist with these interactions.

[Quick start and interactive examples](https://cineview.pages.dev/docs/03-quickstart) · [Documentation](https://cineview.pages.dev/docs) · [Website](https://cineview.pages.dev)

## Install the beta

These examples target `cineview@0.0.1-beta` and its `Cineview` API. Install the exact beta version:

```bash
npm install cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

The npm `beta` channel tracks this API. The `latest` channel remains on `1.0.0`, which uses the earlier `CineView` API.

## Run the local example

To change the source and try it in the included example:

```bash
pnpm install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal dev
```

The current package requires React `^19.0.0`, React DOM `^19.0.0`, and Framer Motion `^13.0.0`. See the [Changelog](./CHANGELOG.md) for migration notes.

## Build a drag page

Use this as `App.tsx`. No media assets are required:

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

In the second scene, the title enters over 600ms. After another 100ms, the detail enters over 400ms, making a 1100ms timeline. Change the title to 900ms and the detail moves later automatically, without changing its delay.

This example maps drag percentage to timeline percentage. Half a screen advances element time to 550ms. A committed release continues unfinished animations; cancellation restores them. Focus the Cineview container to navigate with arrow keys.

## How input advances animation

| Mode                 | Use                                                                                             | When input stops                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| drag                 | Change scenes while previewing the target scene's animations                                    | Distance and release velocity decide whether to continue or restore          |
| scroll               | Keep ordinary content in flow; add `scroll` to a Scene to advance its animations at `1ms = 1px` | Stopping within the zone holds the frame; reverse scrolling moves backward   |
| Independent entrance | `timeline={{ driver: 'clock' }}`                                                                | Plays over time once its start conditions are met, even when scrolling stops |

[Quick start](https://cineview.pages.dev/docs/03-quickstart) includes working examples and basic code for both modes. The [mode guide](https://cineview.pages.dev/docs/01-modes) explains page movement and element time.

## Explore further

- [Animation order](https://cineview.pages.dev/docs/04-orchestration): `after`, delays, composition, and staggered entrances.
- [Video control](https://cineview.pages.dev/docs/11-video-timeline): use drag and scroll progress to seek video frames.
- [Custom drawing](https://cineview.pages.dev/docs/09-use-animate-timeline): drive Canvas, SVG, or WebGL from MotionValues.
- [Responsive layout](https://cineview.pages.dev/docs/05-responsive): use `designWidth`, Position, and Container.
- [Preloading](https://cineview.pages.dev/docs/02-preload): prepare scene resources and handle first-screen waiting.

Add `data-cineview-ignore-drag` to controls that need their own gestures. Keep navigation and persistent state that span scenes outside Cineview.

## Verify and develop

The test badge shows GitHub CI status. The coverage badge reports line coverage generated by a successful framework test run for the deployed website. It does not establish browser interaction coverage; drag and scroll have separate browser acceptance checks.

See [Contributing](./CONTRIBUTING.md) and [Releases](./RELEASING.md) for the full environment, validation, and publishing commands. The [minimal example](./examples/minimal/README.md) switches between both modes.

## License

[MIT](./LICENSE) © Alien.mu.
