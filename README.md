# CineView

CineView is a React framework for cinematic, full-screen narrative pages. You declare
scenes, animations and one design-width conversion base; the framework owns scene
switching, timelines and responsive scaling.

Two engines behind one component tree:

- `mode="drag"`: gesture paging. One drag flips one scene; release thresholds decide
  commit or rebound.
- `mode="scroll"`: real document flow. Sections that declare a `scroll` zone become
  scrubbable timelines (center-lock); everything else scrolls natively.

## Install

```bash
pnpm add cineview framer-motion react react-dom
```

React and Framer Motion (>= 10) are peer dependencies, and CineView never bundles them.

Care about bundle size and only use one mode? The package ships per-mode entries:
`cineview/drag` and `cineview/scroll`. The default `cineview` entry carries both
engines, and a single-file UMD build cannot code-split.

## Minimal usage

```tsx
import { CineView, Scene, Animate } from 'cineview';

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

Drag paging is the default mode: swap in `CineViewDragProps`-style config and drop
the `scroll` zone, and the same scenes page on gestures.

## Three ideas worth knowing

**One conversion base.** `designWidth` (default `750`) is the design width. Every
coordinate and box length scales by `scale = viewportWidth / size`, so it stays
width-driven and never stretches. Vertical overflow belongs to the document flow.

**Scenes and timelines.** `Scene` is the chapter boundary, `Animate` consumes the
active mode's timeline. In drag mode `transitionDuration` defaults to 800 ms; in a
scroll takeover zone the budget is **1 ms = 1 px** of real scroll distance.

**Manual override when you need it.** `enterRef` / `exitRef` hand you the trigger,
with `after` / `delay` as a fallback net. `useAnimateTimeline()` exposes the nearest
timeline as read-only MotionValues; bind them to styles, no extra render passes.

## Video scrubbing

`AnimateVideo` maps scroll or drag position straight to `currentTime` (reverse rewind
included). Author scrub videos with dense keyframes. All-keyframe encoding scrubs
predictably:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

## Documentation

Full docs live in this repo's site (`site/`, route `/docs`): getting started,
core concepts, per-component reference, and a pitfalls page that fronts every trap we
hit for real: fixed positioning inside takeover scenes, `loopAnimation` gating,
`timeline.driver` edge cases, legacy props that no longer type-check.

## Verification

```bash
pnpm verify
```

Type-check, lint, coverage, performance example suite and build verification. Browser
acceptance for drag/scroll interaction is a separate human/agent lane; green unit
tests are not proof the motion is right.

## Support matrix

| Runtime or peer   | Supported versions                    |
| ----------------- | ------------------------------------- |
| Node.js           | 18, 20, 22                            |
| React / React DOM | 18.2+ and 19.x                        |
| Framer Motion     | 10.x and 11.x-compatible releases     |
| Browsers          | Current Chrome, Firefox, Safari, Edge |
| Rendering         | CSR only, no SSR                      |

## License

See the repository: https://github.com/AlienMu/cineview
