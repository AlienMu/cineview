# Colour

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

`styles.md` describes palettes for each visual style. This file covers taking colours from the
user's material, colour that moves with the page, and keeping text readable.

## Colours from the material

A palette taken from the user's own photos, footage or brand makes the page belong to them.
1. **Ground.** Find the lightest calm area of the main pictures (paper, sky, a wall) for a light
   page, or the darkest for a dark one.
2. **Ink.** Find the darkest area for a light page, or the lightest for a dark one. Check it
   against the ground: 4.5:1 for body text.
3. **Accent.** Pick the most saturated colour that matters to the product: the logo, the drink,
   the product's paint, the interface's main colour. Use it sparingly: for actions, highlights
   and one figure.
4. **Surfaces and lines.** Derive them from the ground and the ink (C1), so they follow any later
   change.
5. **Check every pair the page uses** (text on ground, text on surface, button label on accent) in
   every palette the page switches between.

## C1 Tokens that everything derives from

When surfaces are derived from a few tokens, a single change to `--ground` moves the whole page
together:

```css
:root {
  --ground: #ffffff; --ink: #0f172a; --ink-soft: #475569; --accent: #2563eb; --on-accent: #fff;
  --surface: color-mix(in srgb, var(--ground) 92%, var(--ink));
  --line: color-mix(in srgb, var(--ground) 80%, var(--ink));
}
body { background: var(--ground); color: var(--ink); }
```

To animate a token, for example `--ground` between scenes, register it so the browser can
interpolate it:

```css
@property --ground { syntax: "<color>"; inherits: true; initial-value: #ffffff; }
:root.tokens-live { transition: --ground .7s ease, --ink .7s ease; }
```

Turn the transition on only after `stage.ready`. Otherwise a reload inside a dark scene fades in
from the light palette:

```js
document.querySelector('cv-stage').ready.then(() =>
  requestAnimationFrame(() => document.documentElement.classList.add('tokens-live')));
```

## C2 A palette per scene

`<cv-scene theme="sage">` sets `data-cv-theme="sage"` on the stage while that scene is current.
On scroll pages that means at eye level; on drag pages, once the page passes the middle of a
drag. Page CSS maps the theme to tokens:

```css
:root:has(cv-stage[data-cv-theme="sage"]) { --ground: #e6efe6; --ink: #1d2b22; --ink-soft: #46584b; --accent: #3f7d5a; }
```

It can be one deliberate change for one chapter, alternating chapters, or a different palette
for every scene. The more often it changes, the more each change has to mean.

## C3 A ground that follows the scroll

Instead of changing in steps, the ground can glide with the scroll position. Take a few colour
stops, mix them for the current position, and write the result only when it changes:

```js
const STOPS = [[0, [255, 255, 255]], [0.5, [238, 244, 255]], [1, [255, 255, 255]]]; // any colours
let last = '';
function paint() {
  const f = Math.min(1, Math.max(0, (scrollY + innerHeight / 2) / document.documentElement.scrollHeight));
  let i = 1; while (i < STOPS.length - 1 && STOPS[i][0] < f) i++;
  const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], t = (f - a) / (b - a);
  const css = `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(' ')})`;
  if (css !== last) document.documentElement.style.setProperty('--ground', (last = css));
}
addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true }); paint();
```

Close stops read as one atmosphere that shifts. Far-apart stops read as distinct chapters. A
ground that follows the scroll and a theme change on the same scenes both write the ground, so
where they meet, one of them wins.

## C4 Hue that turns

`fx="hue(0deg, 120deg)"` turns `--cv-hue` over an element's progress. Colours written as
`oklch(.6 .15 calc(250deg + var(--cv-hue)))` follow it. Scoping it to one figure keeps the rest of
the page stable.

## C5 Readability

- Body text: 4.5:1 against what is behind it is the usual accessibility reference (WCAG AA). Large
  titles: 3:1.
- Text over photos or video stays readable as the picture changes with a gradient, a progressive
  blur or a panel behind it.
- Small labels set in a lighter colour, rather than with `opacity`, keep their contrast
  predictable.
- Check the button label on its fill in every palette the page uses.
