---
title: cv-animate
eyebrow: ELEMENTS / ANIMATE
---

`cv-animate` wraps some content and declares how it looks along the timeline. Effects go in `fx`; `from` and `to` take values directly.

## Attributes

| Attribute | Example | Notes |
| --- | --- | --- |
| `fx` | `rise(soft), wipe(left)` | Effect presets, several separated by commas |
| `from`, `to` | `from="opacity:0; y:40"` | Start and end values written out |
| `duration`, `delay` | `600` | Length and wait in ms; in a locked zone, also px of scroll |
| `name`, `after` | `after="title -200"` | Follow another element's entrance in the same scene; see [timelines](/docs/05-timeline) |
| `at` | `20% 60%` | Place by share of the scene's length |
| `on` | `clock` | The progress source; see [progress sources](/docs/06-progress-sources) |
| `ease` | `linear` | Easing |
| `exit`, `exit-duration` | `exit="opacity:0; y:-16"` | What leaving looks like and how long it takes; values or presets |
| `split` | `lines`, `words` | Play each line or word on its own |
| `target`, `stagger` | `target=".card" stagger="120"` | Play matching descendants one after another |
| `loop`, `loop-duration` | `loop="float"` | A loop after the entrance, running only on screen |
| `replay` | `replay`, `replay="false"` | Whether the entrance plays again; see [replay](#Replay) |
| `margin` | `50 30` | An entrance margin for this element only |

## Effect presets

| Preset | Arguments | Effect |
| --- | --- | --- |
| `fade` | None | Opacity from 0 to 1 |
| `rise` | `soft` (20 px), `strong` (80), px, `%`, `line`; 40 px without one | Rises from below while fading in; `rise(line)` rises out of its own clip without fading |
| `grow` | `soft`, `strong`, a factor; 0.9 without one | Scales up to full size while fading in |
| `focus` | `soft`, `strong`, px, `band`; 4.5 px without one | Blur to sharp while opacity goes from 0.34 to 1; `focus(band)` is sharp only in the middle of the passage through the viewport |
| `wipe` | `left` (default), `right`, `top`, `bottom`, `up`, `down`, `center` | A clip edge travels across; `center` opens from the middle line outward |
| `push` | `in`, `out`, or start and end factors with a focus point | A slow scale about a focus point |
| `reveal` | A side and a blur, such as `reveal(left, soft)` | `wipe`, `focus` and `push` in one |
| `develop` | None | Pictures develop from a blurred stand-in as they load |
| `duotone` | `blue`, `orange`, `terracotta`, `mono`, or a dark and a light color | Prints the pictures inside in two inks |
| `draw` | None | Strokes draw themselves; confine with `target` |
| `count` | None | A number rolls up digit by digit to its value |
| `axis` | `wght 250 650`, `wdth 75 100` | A variable-font axis over time |
| `drift` | `soft` (3.5%), `strong` (16%), `%`, px; 10% of the element's height without one, and a bare number is px | Parallax offset with the position in the viewport |
| `skew` | `soft`, `strong`, an angle; 4 degrees without one | Leans with scroll speed |
| `hue` | One or two angles | Turns `--cv-hue` for color changes with `oklch()` |
| `invert` | None | A difference blend against what is behind |
| `unroll` | None | A long vertical-writing strip unrolls with the scroll |
| `keyframes` | The name of a `@keyframes` rule on the page | Plays your own keyframes on the element's progress |
| `fade-in`, `slide-up`, `zoom-in`, `rotate-in`, `blur-in` | None | Simple entrances: fade, slide up a full height, zoom from 0, rotate in, unblur |

The size words are `soft` and `strong`; without an argument a preset takes its middle value, and `normal` is reported as an error. `rise`, `grow` and `focus` fade in already, so adding `fade` puts two effects on one property. Presets that change different properties combine cleanly, as in `rise(soft), wipe(left)`.

## Values written out

`from` and `to` take `opacity`, `x`, `y`, `scale`, `scale-x`, `scale-y`, `rotate`, `rotate-x`, `rotate-y`, `skew-x`, `skew-y`, `blur`, `clip`, `draw` and custom properties (`--name`). A `%` on `x` or `y` is of the element itself.

```html
<cv-animate from="opacity:0; x:-24" to="opacity:1; x:0" duration="500"><p>Slides in from the left</p></cv-animate>
<cv-animate from="--lit:0" to="--lit:1" duration="800"><span class="glow">Glow</span></cv-animate>
```

A custom property is set on the blocks that wrap the content: the elements inside read it, the `cv-animate` itself does not. Give a fallback where it is read: `opacity: var(--lit, 0)`.

## How the content is wrapped

The children of `cv-animate` stay where they are, slotted into blocks in its shadow root, and the motion is applied to those blocks:

- Layout for the children (grid, flex, gap) goes on an inner element, not on the `cv-animate`.
- Set the transform origin with `::part(layer)`: `.bar::part(layer) { transform-origin: left center; }`.
- Paint what moves (a line, for example) on an inner element.

## Replay

`replay` decides whether an entrance plays again:

| Written | Behavior |
| --- | --- |
| Omitted | The source's own rule: in ordinary scroll an entrance plays once, and an `on="clock"` element plays again each time its scene becomes current |
| `replay` or `replay="true"` | Plays again on every return; in ordinary scroll the element re-arms once it leaves the viewport |
| `replay="false"` | After one complete entrance, later triggers show its final state; elements that follow it keep their own timing |

```html
<cv-animate name="title" on="clock" fx="rise(soft)" replay="false"><h2>Rises only on the first visit</h2></cv-animate>
```

## Split text

`split="lines"` plays each line, `split="words"` each word. The real text stays for screen readers; hidden copies move:

```html
<cv-animate split="lines" fx="rise(line)" stagger="90"><h2>A title that rises line by line</h2></cv-animate>
```

## Loops

A `loop` starts after the entrance and runs only while the element is on screen. The built-in loops are `float`, `sway`, `pulse`, `breathe` and `spin`, each taking `soft` or `strong` (`spin` takes a direction). An effect preset in `loop` plays there and back. A keyframe list works too:

```html
<cv-animate loop="float(soft)"><img src="badge.svg" alt=""></cv-animate>
<cv-animate loop="opacity: 1 .45 1" loop-duration="2400"><span class="dot"></span></cv-animate>
```

## Custom effects

`defineEffect` registers a new preset for `fx`, `exit` and `loop`:

```js
import { defineEffect } from 'cineview';

defineEffect('lift', { from: 'opacity:0; y:24; scale:.98', to: 'opacity:1; y:0; scale:1', ease: 'settle', duration: 700 });
defineEffect('swing', (args) => ({ from: `rotate:${args[0] ?? 8}`, to: 'rotate:0' }));
```

When the runtime comes from a content delivery network (CDN), import from the runtime module's address instead of `'cineview'`.

Names use lowercase letters, digits and hyphens, and built-in names cannot be replaced. Registering after the stage has built is fine: the stage builds again.
