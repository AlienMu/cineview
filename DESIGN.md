# Cineview architecture

This document describes the current implementation for contributors. Use the
[public types](./src/types.ts) and the [element attributes](./src/jsx.ts) for exact names, and the
[documentation](./site/src/content/docs/en/start/01-overview.md) for page examples. Historical
reviews record earlier states; they do not override the current source.

## Contents

- [Elements](#elements)
- [State ownership](#state-ownership)
- [Building a stage](#building-a-stage)
- [Layers and output](#layers-and-output)
- [Scroll input](#scroll-input)
- [Drag input](#drag-input)
- [Time](#time)
- [First screen](#first-screen)
- [Media and text](#media-and-text)
- [Accessibility](#accessibility)
- [Errors](#errors)
- [Package boundaries](#package-boundaries)
- [Verification](#verification)
- [Changing the architecture](#changing-the-architecture)

## Elements

The runtime is a set of custom elements, defined when the module loads (`src/index.ts`,
`src/elements/define.ts`). Content stays in the light DOM; each element attaches a shadow root only
for the structure it owns.

| Element | File | Role |
| --- | --- | --- |
| `cv-stage` | `elements/stage.ts` | The page: collects scenes, builds them, hands motion to an input |
| `cv-scene` | `elements/scene.ts` | One scene: solves its timeline; in scroll input, the sticky shell of a zone |
| `cv-animate` | `elements/animate.ts` | One element's effects, read from attributes into layer plans |
| `cv-stack` | `elements/stack.ts` | Cards that arrive one after another |
| `cv-video` | `elements/video.ts` | A video whose time follows the element's timeline |
| `cv-fixed` | `elements/fixed.ts` | A scene's fixed layer |
| `cv-pause` | `elements/pause.ts` | A toggle that pauses motion played on time |

Registration flows upward on connect (animate to scene to stage). Any change invalidates the stage,
which rebuilds once per microtask.

## State ownership

Each value that changes every frame has one writer.

| Value | Owner and rule |
| --- | --- |
| Structure: scene order, solved windows, layers | The stage's build (`stage.build()`). Inputs read it; they never edit it. |
| Scroll motion | `input/scroll.ts` owns every write for scroll input: zone time, view and page progress, stacked scenes, rows, decks. |
| Drag motion | `input/drag.ts` owns the page position and each scene's element time. Pointer and key handlers record intent; the frame loop is the only writer. |
| Entrances played on time | `input/enter.ts` owns the gate machine (`data-cv-phase`) and the clock animations of `enter`, `eye` and `clock` roots and their followers. |
| Loops and clock animations | `render/clock.ts`, one per stage, also the pause owner. |
| A scrub video's playback | `media/ownership.ts`, a pure reducer; `media/driver.ts` applies its decisions. |
| First-screen readiness | `assets/first-screen.ts` (the asset wait) and `boot.ts` (the CSS that runs before the module). |

Per-frame code reads first (scroll offset, rects), then writes, and never alternates the two. It
writes styles directly or through native animations; it does not create elements or listeners per
frame. Every subscription and animation started by a build is disposed by the next build or by
disconnection.

## Building a stage

A build (`elements/stage.ts`):

1. Orders the scenes and reads stage attributes.
2. Loads the optional modules the elements need (split text, stills, counts, keyframes); a module
   that fails is reported and its elements keep their whole-element fallback.
3. Plans and builds each `cv-animate` for its scene's time source, refusing sources the scene
   cannot drive, then solves each scene's timeline.
4. Creates the input (`input/scroll.ts`, or the drag module loaded on demand) and, when scenes have
   `on="clock"` elements, a clock-source entrance controller.
5. Marks the elements live (`data-cv-live`) in the same task as the input's first writes, so the
   boot state hands over without a frame in between, then dispatches `cv-ready`.

## Layers and output

`render/layers.ts` builds, inside each `cv-animate`'s shadow root, one layer per progress source, in
a fixed order from outside in. Within one layer, translation and rotation add and opacity and scale
multiply (`core/props.ts`); different sources compose through nesting.

Output takes one of three paths:

- Native scroll-driven animations for compositor properties when the browser supports
  `ScrollTimeline`/`ViewTimeline` (scroll input, not `fallback`).
- Clock animations (WAAPI) for entrances and loops played on time.
- Direct style writes from the input's frame loop for everything else: drag, the fallback path,
  blur and clip in zones, signals.

For stack cards, a custom `--cv-veil` uses the HTML card's `::after`; media and SVG belong inside
a container card. A direct media/SVG card reports an authoring error and the stack keeps its default
darkening. The build validates this once; the input still owns all covering progress writes.

## Scroll input

The document scrolls natively (`input/scroll.ts`). A zone (`cv-scene zone`) is a spacer with a
sticky shell; its time is the scroll offset within it, 1 ms per pixel. `track="x"` rows, stacked
scenes and decks are written from the same offset. Ordinary scenes play their entrances on time
through visibility gates (`input/gates.ts`): fully in view with a margin, or across the eye line,
or any overlap for `enter(partial)`. An activation window of about one viewport around the screen
limits events and media.

## Drag input

Each scene fills the screen (`input/drag.ts`, loaded on demand). The page position follows the
finger and settles on release; the incoming scene's element time follows the finger
(`unit`/`scale`) and continues on time after release. Release rules are pure functions in
`input/drag-rules.ts`. One time base per frame: the tick reads `performance.now()` once, because
tweens start from it and a rAF timestamp can lag it by seconds in a lazily loaded iframe. Only the
current scene and its neighbours are rendered.

## Time

`core/time.ts` solves each scene's timeline: `duration`, `delay`, `after` with offsets, `sequence`,
stagger tails and `at` shares. Unsolvable declarations are reported and ignored; the solver never
throws. A zone's length is where its last element ends. `core/timeline.ts` is the read-only
`el.timeline` each element exposes; it publishes time sources only.

`replay` (`core/replay.ts`) decides whether an entrance plays again: omitted keeps the source's own
rule, `replay` plays on every return, `replay="false"` shows the final state after one complete
entrance while followers keep their own windows.

## First screen

Before the module runs, `cineview.css` (generated from `boot.ts`) sets structure and the first
scene's initial states: single default presets play as CSS animations that the runtime adopts at
their elapsed time; other time-sourced elements start hidden, with a 4 s CSS failsafe that shows
them. Content the reader already saw before the runtime took over (the failsafe, or another scene
painted as written after a reload) is adopted at its end instead of being hidden and played again. The opening clock activation adopts the same boot
progress; later visits use the element's replay setting.
`assets/first-screen.ts` holds the opening scene's entrances until its `preload` assets settle, at
most `first-scene-timeout`.

## Media and text

`cv-video` drives a `<video>` through `media/driver.ts`, fetching the file whole into a shared blob
cache (`media/cache.ts`) so every frame is seekable. Explicit `clock` frames use the same scrub reducer as the input-driven
frames; native tail playback and user pauses keep their existing ownership. Split text (`text/split.ts`) keeps the author's
text in the light DOM and animates an `aria-hidden` mirror measured from the browser's own line
breaks; it is re-measured when size, fonts or text change (`text/watch.ts`). Counts, stills and
keyframes are separate chunks loaded before a build that uses them.

## Accessibility

Content stays real, selectable text. Reduced motion keeps only the opacity change of entrances
played on time (at most 200 ms), stops loops and rate effects, and leaves motion that follows the
reader's own scroll or finger. `cv-pause` and `stage.pause()` hold everything played on time (WCAG
2.2.2). Drag scenes outside the current one are `inert`; scene changes are announced in a polite
live region.

## Errors

An authoring error is reported in production too, as a bubbling, cancelable `cv-error` on the
element at fault with a stable `code` (`core/errors.ts`); the development build also logs it.
Whatever cannot be read is ignored and the rest of the page keeps working. Craft warnings
(`dev/`) exist only in the development build, behind `__DEV__`, so their text is not shipped.

## Package boundaries

`build.mjs` builds the package into `dist/`: the production module (`cineview.js`, minified, with
on-demand chunks), the development build (`dev/`), `cineview.css`, `head.js` with its content
security policy hash, `surface.json` (the authoring surface as data, from `surface.mjs`) and the
type declarations, checked by compiling `types-test/usage.tsx` against them. The build fails when
the initial module and its static imports exceed 44 KiB gzip, or the drag chunk exceeds 12 KiB.
The package has no runtime dependencies; `package.json` `files` lists only `dist/` output.

## Verification

```bash
pnpm verify          # repository scope, format, lint, types, unit tests, build, site checks
pnpm test:browser    # browser checks in Chromium and WebKit (gate/checks.mjs)
pnpm docs:links
```

Unit tests (`src/**/*.test.ts`) cover parsing, solving and the input rules; they do not prove
motion. Browser checks (`gate/probes/`, run by `gate/checks.mjs` against `fixtures/`) cover each
element and source in both inputs, on the native and fallback paths, forward and reverse,
cancellation, reload and the first screen. Do not edit source while they run: the fixture server
reloads changed modules and the run reports false failures.

Performance is measured with `gate/run-phase1.mjs` on an idle machine; record the browser, machine,
load and raw results, and compare against a same-machine control before calling a regression.
Real devices are tested with `device-test/` (`pnpm device`).

## Changing the architecture

Create or update a local, Git-ignored task flow before a multi-file change. Describe observable
behavior, the state owner and acceptance criteria. Update this document alongside any ownership or
public behavior change, and keep its links valid.

Use focused tests to reproduce a defect, then run the relevant static and browser gates.
[AGENT_SELF_REVIEW.md](./AGENT_SELF_REVIEW.md) requires independent browser review for visual,
interaction, accessibility and runtime performance work. Record limitations explicitly. Review
reports, task flows, screenshots, traces and generated measurements remain local and must not be
committed. Keep reusable verification scripts and regression tests in the repository.
