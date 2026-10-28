<p align="center">
  <a href="https://cineview.pages.dev">
    <img src="./site/public/favicon.svg" width="64" height="64" alt="Cineview" />
  </a>
</p>

<h1 align="center">Cineview</h1>

<p align="center">A landing-page framework in plain HTML: scenes with their own timelines, moved by the reader's scroll or finger.</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/dm/cineview?style=flat-square&amp;color=8A5B43" alt="npm monthly downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-555?style=flat-square" alt="MIT license" /></a>
  <br />
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript" /></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/dependencies-0-2c7a4b?style=flat-square" alt="No runtime dependencies" /></a>
  <a href="https://cineview.pages.dev/coverage.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&amp;style=flat-square" alt="Line coverage" /></a>
</p>

<p align="center">
  <a href="https://cineview.pages.dev">Homepage</a> ·
  <a href="https://cineview.pages.dev/docs">Documentation</a> ·
  <a href="#ai-read-this">AI, read this</a>
</p>

Cineview writes landing pages and interactive presentations with a handful of custom elements. A page is a series of scenes; each scene has a timeline, and each element declares where it sits on it with attributes such as `fx`, `duration` and `after`. The reader's scroll or finger moves the timeline: in an ordinary section entrances play once they are in view, and in a held scene the scroll distance is the time.

The framework keeps the behavior these pages share: entrances in the right order, gestures that can be interrupted and reversed, a first screen that does not flash, videos that follow the scroll frame by frame, and reduced-motion and pause support. Page code stays content, layout and pacing.

There are no runtime dependencies. The elements work in a plain HTML file and inside React or other framework pages; the startup styles and a short head script keep the first screen right before the module runs.

## Features

| Capability | How to use it |
| --- | --- |
| Scenes and timelines | Split the page into `cv-scene`s. Order elements with `duration`, `delay`, `after="title -200"` or `at="20% 60%"`. |
| Two ways to move | `cv-stage` scrolls by default; `input="drag"` shows one scene per screen and switches with the finger. |
| Held scenes | `cv-scene zone` holds the screen while the scroll moves its time, 1 ms per pixel; scrolling back reverses it. |
| Effect presets | `fx="rise(line)"`, `wipe`, `focus`, `reveal`, `draw`, `count`, `duotone` and more, combined with commas, or written out with `from` and `to`. |
| Progress sources | `on` chooses what moves an effect: time once in view, the eye line, the element crossing the viewport, the page, the scene clock, scroll speed. |
| Stacking, rows and fixed layers | `stack` and `covered` for scenes that are covered, `cv-stack` for cards, `track="x"` for sideways rows, `cv-fixed` for a scene's fixed layer. |
| Video | `cv-video` plays a clip along the timeline, frame by frame, forward and back. |
| Your own drawing | `el.timeline.subscribe()` drives Canvas, SVG or WebGL from an element's progress. |
| First screen and reload | Startup styles, an asset wait and a failsafe keep the opening right; a reload in the middle of a page does not replay what the reader already sees. |
| Accessibility | Real text stays selectable; reduced motion shortens entrances and stops loops; `cv-pause` pauses motion played on time. |

## Try it

```bash
npm install cineview
```

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- 1. head script (node_modules/cineview/dist/head.js), 2. startup styles, 3. the module -->
  <script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.js"></script>
</head>
<body>
  <cv-stage>
    <cv-scene>
      <cv-animate fx="rise(line)" duration="900"><h1>One scene at a time</h1></cv-animate>
      <cv-animate fx="rise(soft)" delay="400"><p>The title rises, then this line follows.</p></cv-animate>
    </cv-scene>
    <cv-scene zone>
      <cv-animate from="scale-x:0" to="scale-x:1" duration="2400" ease="linear"><div class="bar"></div></cv-animate>
      <cv-animate fx="fade" at="30% 60%"><p>Appears as you scroll through the held scene.</p></cv-animate>
    </cv-scene>
  </cv-stage>
</body>
</html>
```

Scroll down: the first scene's entrances play on time, then the second scene holds while the scroll draws the bar. With a bundler, `import 'cineview'` once instead of the module script, and keep the head script and `cineview/cineview.css` in `<head>`. See [setup](https://cineview.pages.dev/docs/02-setup) for the details and [scroll and drag](https://cineview.pages.dev/docs/03-input-modes) for drag mode.

## AI, read this

Cineview is written so that an AI assistant can plan and build pages with it. Start from [llms.txt](./llms.txt), the reading index: it lists the guides by task and the rules that matter most.

- [Landing-page design](./docs/ai/landing-pages.md): define content relationships, reading control, timing and acceptance before selecting effects.
- [AI design workflow](./docs/ai/design-assistant.md): turn a brief or a PRD into a storyboard and recommendations.
- [41 design references](./docs/ai/lexicon.md): what each reference is for and how it maps to the framework.
- [Declaration conventions](./docs/ai/declarative-design.md): how attributes group, inherit and own their output.

### Design skill for your AI

[`skills/cineview-design`](./skills/cineview-design/SKILL.md) has an AI assistant plan the page with you before building it (what it is for, two or three directions, how many scenes, what each scene shows and which material it needs, a storyboard and a material list), with references behind its suggestions: ways to treat video and images, line art and supporting elements, visual directions, how the 41 design references behave together in each mode, 32 layouts and example page structures. It offers options, not a template. Copy the folder into your project's `.claude/skills/` for Claude Code, or point any other assistant at `SKILL.md`.

## Docs and examples

The [documentation](https://cineview.pages.dev/docs) has live examples on its pages:

| Page | What it covers |
| --- | --- |
| [Timelines](https://cineview.pages.dev/docs/05-timeline) | `duration`, `delay`, `after`, `at`, and how long a held scene is |
| [Progress sources](https://cineview.pages.dev/docs/06-progress-sources) | What moves an effect, the entrance rules and reduced motion |
| [cv-animate](https://cineview.pages.dev/docs/11-animate) | Every attribute and preset, values written out, loops and custom effects |
| [cv-video](https://cineview.pages.dev/docs/13-video) | Video on the timeline and how to prepare the file |
| [Drag mode](https://cineview.pages.dev/docs/16-drag-mode) | Finger and time, release rules, keys and events |

Test on real devices with the pages in [`device-test/`](./device-test/README.zh-CN.md) (`pnpm device`).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the development commands and checks, and [DESIGN.md](./DESIGN.md) for the architecture.

## Friends

- [LINUX DO](https://linux.do): a Chinese developer community.

## License

[MIT](./LICENSE)
