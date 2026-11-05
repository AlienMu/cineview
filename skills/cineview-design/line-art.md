# Line art and small marks

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

Line art and small marks make a page feel drawn rather than assembled, and they cost little. A
shape taken from the product's own world, returning across the page, tends to tie the scenes
together better than a new ornament in each (`sources.md`). For example: a lens ring for a camera
app, a leaf vein for a tea brand, a route line for a travel service, a cursor for an editor.

## Making line art sit well

- **Under the content** (`position: absolute; z-index: 0`), with the content above it.
- **Lighter than the text**: a stroke in `var(--line)`, or a mix such as
  `color-mix(in srgb, var(--ground), var(--ink) 18%)`, 1.5-2 px wide.
- **Drawn in a viewBox with the scene's aspect**, with `preserveAspectRatio="xMidYMid meet"` so
  nothing is cut off at other screen shapes, and shapes placed in the empty areas.
- **Clear of a fixed top bar**, if the page has one.
- **Round caps and joins** (`stroke-linecap: round; stroke-linejoin: round`), so drawn shapes
  close without a seam.
- **On phones, hidden** where it would sit under text.

## A sketch drawn behind a section

A drawing as large as its scene can draw itself on the clock when the scene becomes current
(`on="clock"`), because waiting for it to be fully in view would never happen:

```html
<cv-scene>
  <section class="with-sketch">
    <cv-animate class="sketch" on="clock" fx="draw" target=".sketch-svg *" duration="1800" aria-hidden="true">
      <svg class="sketch-svg" viewBox="0 0 1920 900" preserveAspectRatio="xMidYMid meet">
        <!-- paths taken from the product's world -->
      </svg>
    </cv-animate>
    <div class="content">...</div>
  </section>
</cv-scene>
```

```css
.with-sketch { position: relative; overflow: clip; }
.sketch { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.sketch-svg { width: 100%; height: 100%; fill: none; stroke: var(--line); stroke-width: 1.6;
              stroke-linecap: round; stroke-linejoin: round; }
.content { position: relative; z-index: 1; }
```

## One object, drawn once, then turning

An object with a round or iconic form, such as a record, a lens ring, a gear or a compass rose,
can draw its outline once and then turn slowly while it is on screen. It can sit on the boundary
between two sections, so half shows in each.

- In Cineview: `fx="draw"` with `loop="spin"` and `loop-duration="20000"` on the same element. The
  loop starts after the drawing ends and runs only on screen.
- With fills: put the outline shapes in one group (`pathLength="1"` on each) and the fills in
  another that fades in after the outline.
- A part that moves on its own, such as a needle or a hand, is best as its own small SVG, which
  turns cheaply, rather than as a group moving inside one large SVG.

## Lines that show "this follows that"

For timelines and flows: from the end of one item to the start of the next, draw a short line,
perhaps with a rounded elbow and a small arrowhead. A lit copy can wipe in from the top when the
next item starts (`fx="wipe(top)" after="previous"`), or the line can draw itself
(`fx="draw"`).

## Small marks that help reading

- Step numbers in outlined circles, filled as their step is reached.
- Tags as outlined pills.
- A coloured keyword in a code sample, frame numbers, a scale bar.
- Grain or a paper texture. On scenes that do not move it costs nothing; on scenes that move every
  frame it costs frames on phones (`phone.md`).
