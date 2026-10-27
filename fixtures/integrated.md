# Integrated desktop example

[中文](./integrated.zh-CN.md)

Open `integrated.html` to compare a source document, assemble its annotations, and save the example. The main Scene has six related modules in one 1280 × 800 viewport. The Scenes before and after it provide readable destinations for navigation and reversal.

## Run the example

Build and serve the V2 production fixture, then open the printed address with `/integrated.html` appended:

```js
import { prepareDesktopSite, serveDesktopSite } from '../gate/desktop-site.mjs';

const directory = await prepareDesktopSite('review/my-integrated/site', 'integrated');
const server = await serveDesktopSite(directory, 4394);
// When the preview is no longer needed:
// await new Promise((resolve) => server.httpServer.close(resolve));
```

These imports are relative to this document's directory. Choose a fresh build directory and an available port. The mode, layout, language, replay, and shared pause controls sit outside the Stage. The comparison slider and gallery controls operate within the content.

The page also exposes `window.integrated.mount({ context, layout, language })`, `read()`, and `dispose()` for local inspection. `language` is `en` or `zh-CN`. These helpers belong to this fixture; they are not public Cineview APIs.

## Read the composition

| Module      | What changes                                                                     | Owner                                                                                                 |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Source      | Compare two aligned illustrations; draw and reveal their connection              | Native range and page clipping; framework `draw`, `wipe`, and view entry                              |
| Cards       | Stack three annotations after the title                                          | Framework `cv-stack` and `after`                                                                      |
| Explanation | Reveal lines and words; change font weight; show a sample count                  | Framework split/stagger, variable axis, and count; page text mask and vertical text                   |
| Gallery     | Snap between examples or drag a separate inertial strip                          | Native scrolling and page controls/inertia; framework child stagger                                   |
| Media       | Hold a loading illustration, print it in two inks, and seek a video              | Framework develop/duotone/push, view focus, and `cv-video`; page pan/dissolve, blur, and Bayer canvas |
| Timing      | Show independent clock steps, overlapping loops, scoped color, and a drawn meter | Framework clock/loop/variables and custom effect; page SVG subscriber                                 |

The title, controls, and primary action remain available while decorative content changes. Put `cv-fixed` directly inside its Scene: its status stays in the Scene's stationary frame while track content moves. The page owns its marquee, gallery inertia, pan/dissolve animations, event listeners, and SVG subscription. Shared pause, reduced motion, departure, and disposal also control that page-owned work.

## Follow the timing

The input timeline spans 2400 authored milliseconds. In a scroll zone, each millisecond corresponds to one pixel of document scroll. A starts at 100 and ends at 500. `sequence="60"` places B at 560–860; C explicitly declares `after="B 60"` and runs at 920–1120. D runs at 650–950, while E overlaps it at 660–960. Their declared exits follow those entrances.

The video maps 500–1500 to the first second of its real media file. The scoped `at="25% 75%"` window occupies 600–1800. Two autonomous clock items run at 0–500 and 400–800 after Scene entry; they do not increase scroll distance. The overlapping sway/spin loops retain their own 5000ms and 8000ms periods.

Ordinary scroll starts the dependency group when its root enters view. Its followers then use that group's elapsed time, including offscreen followers. Drag maps incoming movement to element time and completes the remaining entrance after commitment. A drag cancellation and a reverse transition therefore need separate checks from controlled zone positions.

## Select a desktop context

| Layout  | Contexts                             | Behavior                                                                |
| ------- | ------------------------------------ | ----------------------------------------------------------------------- |
| `grid`  | `drag`                               | Full-screen gesture navigation                                          |
| `grid`  | `zone-auto`, `zone-fallback`         | Locked scroll zone with automatic native selection or explicit fallback |
| `grid`  | `enter-auto`, `enter-fallback`       | Ordinary document scroll with timed entrances                           |
| `track` | `drag`, `zone-auto`, `zone-fallback` | The same modules move horizontally through their actual overflow        |

Track layout uses a scroll zone in scroll mode. Early track controls are accessible during entry but leave the viewport at the drag endpoint; use grid for a stationary overview. Native selection and actual attachment are recorded separately. An automatic context can use fallback when the platform lacks the relevant timeline support.

`integratedInventory()` in [integrated.mjs](../gate/integrated.mjs) maps all 41 references to locations, ownership, or exclusions. Infinite Stage wrapping (#21) is excluded from this finite example. Track (#5) is a layout variant. Several references use page CSS, native controls, or a deliberate adaptation. The reference catalog describes design ideas; it does not define 41 interchangeable presets.

## Run and interpret acceptance

```js
import { runIntegrated } from '../gate/integrated.mjs';

await runIntegrated({
  base: 'http://127.0.0.1:4394',
  output: 'review/my-integrated/acceptance',
  engines: ['chromium', 'webkit'],
});
```

Run serially against an unchanged production build while other measured workers are stopped. The default profile selects eight contexts in each engine, producing 16 main rows. Selected grid fallback rows also change reduced-motion preference and remount Chinese text; these are additional same-case checks. Chromium uses installed Chrome. Playwright WebKit is a desktop engine check and does not establish branded Safari or physical iPhone acceptance.

Inspect failed assertions, actual output, trusted input logs, and screenshots together. The runner checks authored timing, actual clipping/text/image/video output, local controls, forward/reverse movement, cancellation, large wheel input, keyboard navigation, scrollbar movement, fixed geometry, pause, return, and cleanup. Early drag-track controls are checked in grid and scroll-track contexts; their absence at the drag endpoint is recorded.

Performance windows record raw callback cadence and supported observer data for active, paused, resumed, and departed states. Unsupported observer metrics are `null`. A selected Chrome fallback window runs for 8100ms to observe both loop periods. These samples describe this case and machine; they provide no universal frame-rate guarantee, capacity result, or proof that every possible combination works. Preserve failures and use a fresh evidence directory for a changed candidate.
