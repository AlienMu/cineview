# Build a Cineview page

Applies to `cineview@1.0.1`. Start here when generating an application. Use the [reading index](../../llms.txt) to select additional guides.

## Install

Use an existing React 19 application with TypeScript support, such as a React TypeScript Vite project:

```bash
npm install cineview@1.0.1 react@19 react-dom@19 framer-motion@13
```

The component is `Cineview`. Examples for the older `CineView` component target a different package API. Check [package metadata](../../package.json) and [public types](../../src/types/index.ts) when working against a different version.

## Understand the parts

| Part             | Configure                                             |
| ---------------- | ----------------------------------------------------- |
| `Cineview`       | Page interaction: `mode="drag"` or `mode="scroll"`    |
| `Scene`          | Content and its own element timeline                  |
| `Animate`        | An element's effect, duration, and timeline position  |
| `timeline.after` | A dependency on another element's entrance completion |
| `AnimateVideo`   | Video frames controlled by animation progress         |

The timeline is per Scene. Several elements can start together or follow one another. Dragging, scrolling, and clock playback advance those declarations in different ways; read [mode selection](./modes.md) before changing modes.

## Run a drag example

Replace `App.tsx` with this complete component. It needs no media files. Set the document body margin to `0` in the application's global stylesheet.

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ background: '#f5e8d8', padding: 32 }}>
        <h1>Drag up to continue</h1>
      </Scene>
      <Scene sceneId="details" style={{ background: '#e8edf0', padding: 32 }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>A scene has its own timeline</h2>
        </Animate>
        <Animate
          enterAnimation="slide-up"
          duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}
        >
          <p>The explanation follows the title.</p>
        </Animate>
      </Scene>
    </Cineview>
  );
}
```

The title occupies 0–600ms; the explanation occupies 700–1100ms. With this percent mapping, half a screen of drag advances the target Scene's element time to 550ms. Committing the change continues unfinished animations; cancelling restores the target's initial state. Focus the Cineview container to navigate with arrow keys.

## Generate the next page

1. Select [drag or scroll](./modes.md) from the intended interaction.
2. Divide content into Scenes and assign stable `sceneId` values.
3. Declare explicit entrance durations. Add `animateId` only where an element needs an identity, such as an `after` target.
4. Calculate the [timeline](./timeline.md) before adding media or additional effects.
5. Use a [complete recipe](./recipes.md) for scroll zones or video. Include its required assets in the deliverable.

Keep persistent navigation outside `Cineview`. Prefer ordinary CSS for typography and spacing. Add `data-cineview-ignore-drag` to controls that need their own drag interaction. `designWidth` is the framework's only responsive conversion base; it follows viewport width, including for vertical design coordinates.

## Work in this repository

The root, website, and minimal example have separate lockfiles:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir site dev
```

The dev command builds the linked framework before starting Vite. The alternative is `pnpm --dir examples/minimal dev`. Use the URL printed by Vite. Keep root `dist/` while either consumer runs; rebuild with `pnpm build` after framework edits made during a running session.

Verify both navigation directions in a browser, check the console, and run the application's type check. Repository contributors also follow [Contributing](../../CONTRIBUTING.md). A successful TypeScript check alone does not establish gesture or video behavior.
