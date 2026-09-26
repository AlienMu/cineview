# Minimal example

This example shows the same three scenes in drag and scroll mode. The button at the top switches modes and remounts Cineview so each mode starts with its own layout and progress.

## Run the example

From the repository root:

```bash
pnpm install
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev
```

The development command builds the framework before starting Vite, so it also works without an existing `dist/` directory. Open the URL printed by Vite. Rebuild the root package with `pnpm build` after changing framework source while Vite is running; the example reads its built output. Keep `dist/` while the example is running.

## What to look for

- In drag mode, move up or down to change full-screen scenes. The second scene plays its heading before its caption.
- In scroll mode, the scenes follow the page's reading order. The second scene stays in view while scrolling advances its heading and caption. Scrolling back reverses them.
- The mode switch uses `key={mode}` to create a fresh Cineview instance. A single Cineview instance runs one mode at a time.

The code is in [src/App.tsx](./src/App.tsx). `timeline.after` orders the two animations in the second scene. Its `scroll` configuration creates the locked zone used in scroll mode.

## Continue

- [Quickstart](https://cineview.pages.dev/docs/03-quickstart) has complete drag and scroll video examples.
- [Animation composition](https://cineview.pages.dev/docs/04-orchestration) shows how to combine presets and sequence elements.
- [Preloading](https://cineview.pages.dev/docs/02-preload) explains image and video loading.
- [Custom drawing](https://cineview.pages.dev/docs/09-use-animate-timeline) connects Canvas, SVG, or WebGL content to progress.
