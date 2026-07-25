# CineView

CineView is a React framework for cinematic scene transitions and scroll-driven
narrative interfaces. It has two explicit engines:

- `mode="drag"` for scene-to-scene paging with thresholded release and rebound.
- `mode="scroll"` for normal document flow with optional `Scene.scroll` takeover zones.

## Install

```bash
pnpm add cineview framer-motion react react-dom
```

React and Framer Motion are peer dependencies. CineView does not bundle them.

## Minimal Usage

```tsx
import { CineView, Scene, Animate } from 'cineview';

export function Story(): JSX.Element {
  return (
    <CineView config={{ size: 750 }} mode="scroll">
      <Scene sceneId="hero" scroll={{ zoneId: 'hero', trigger: 'center-lock' }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
          <h1>Reference-grade monitoring</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

The root `CineView` owns the mode. `Scene` owns chapter layout and optional
scroll takeover. `Animate` consumes the active mode's timeline; it does not
declare a root mode.

## Public Building Blocks

- `CineView`: engine entry point, responsive scale context, preload orchestration,
  scrollbar and imperative ref methods.
- `Scene`: chapter boundary, visibility signal and scene-scoped fixed-layer host.
- `Animate`: preset or custom visual animation with `timeline`, `duration` and
  `visibility` semantics.
- `Position`: design-coordinate placement and scene-scoped fixed layers.
- `Container`: design-coordinate box sizing.
- `Image`: preload-aware image component.
- `AnimateVideo`: MotionValue-driven video scrubbing without a React commit per tick.

## Input and Accessibility

Interactive descendants such as links, buttons, form controls and editable text
are excluded from drag ownership. Scroll takeover must yield to nested scrollable
content at its usable boundary. The custom scrollbar exposes the same reducer as
wheel, touch and keyboard input.

Applications should still test their own interactive descendants and provide
accessible names for custom controls.

## Verification

```bash
pnpm verify
```

This runs type-checking, lint, root coverage, the performance example suite and
the production build verifier. The independent browser acceptance required for
drag and scroll behavior is documented in
`task-flows/2026-07-19-framework-review.md` and cannot be replaced by unit tests.

## Support Matrix

| Runtime or peer   | Supported versions                        | CI coverage                                  |
| ----------------- | ----------------------------------------- | -------------------------------------------- |
| Node.js           | 18, 20, 22                                | Every verification job                       |
| React / React DOM | 18.2+ and 19.x                            | React 18 lockfile job plus React 19 peer job |
| Framer Motion     | 10.x and 11.x-compatible releases         | Peer range and root test install             |
| Browsers          | Current Chrome, Firefox, Safari, and Edge | Release browser lane                         |

Node.js 18 is the minimum because it is the baseline required by the Vite 5
toolchain. React and React DOM are peer dependencies and are never bundled.

## Release Notes

The architecture specification is `DESIGN.md`. Historical plans and compatibility
fields do not override it. The package publishes ESM and UMD entry points with
generated declarations and source maps; React and Framer Motion remain external
peer dependencies.
