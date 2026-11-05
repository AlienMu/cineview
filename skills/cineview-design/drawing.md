# Your own drawing on the scene's time

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

When no preset does what the content needs, draw it yourself (Canvas, SVG, WebGL) and drive it from
an element's timeline. It then scrubs, stops, reverses and jumps with everything else in the scene.

## D1 Subscribe

```html
<cv-scene zone>
  <cv-animate id="time" fx="fade" duration="1200" ease="linear"><p class="caption">...</p></cv-animate>
  <canvas id="art"></canvas>
</cv-scene>
<script type="module">
  const time = document.getElementById('time');
  await customElements.whenDefined('cv-animate');
  const draw = (frame) => render(Math.min(Math.max(frame.progress, 0), 1));
  time.timeline.subscribe(draw);
  draw(time.timeline.frame);
</script>
```

The anchor element is real (here a caption that fades in), and its `duration` sets the zone's
length. Draw only when the progress changes (compare with the last value).

## D2 Canvas drawn from progress

- Size the backing store to `clientWidth x devicePixelRatio` (cap DPR at 2) on a ResizeObserver.
- One `requestAnimationFrame` per change; a permanent loop for something the scroll drives costs
  frames for nothing.
- Keep per-frame work under ~3 ms at 1920: fewer than ~1500 sprites (pre-render each sprite once
  to a small canvas and `drawImage` it), no `getImageData`, no shadows.

## D3 A model that assembles from pieces (WebGL)

Suits: a product or a symbol that comes together as the reader scrolls, or as the finger pulls
it in on a drag page. Flat-shaded low-poly is one look that stays clear at small sizes; any style
of model works the same way.

Shape: a canvas the size of the scene, under its text (`position: absolute; inset: 0; z-index: 0;
pointer-events: none`); the model is drawn in a square of its own, which is also what the reader turns.

Data, built once: triangles with, per vertex, position, face centre, normal, a scattered start
(x, y in -1..1, a tumble phase), part id and wait (when this part starts), colour.

Vertex shader, per frame (only uniforms change, such as the progress, the view size and the
reader's rotation). Each piece eases from its scattered start to its place over its own share of
the progress, so the pieces arrive one after another:

```glsl
float g = clamp((u_progress - a_wait) / u_span, 0.0, 1.0);  // this piece's share of the progress
g = 1.0 - pow(1.0 - g, 3.0);                                 // ease out as it lands
vec3 placed = turn(a_pos, u_rotation);                        // the reader's rotation
gl_Position = vec4(mix(a_start, project(placed), g), depth(placed), 1.0);
```

Parts can also move with the progress (a wheel turning, a lid opening): transform their vertices
by a function of `u_progress` in the shader.

Interaction: pointer drag on the square changes `u_ry`/`u_rx` (clamp the tilt), a little inertia
after release, arrow keys turn it too; `touch-action: pan-y` keeps vertical page scroll on touch. On a drag page, give the square `data-cv-ignore-drag` so turning the model does not page.

Loop: run `requestAnimationFrame` only while the scene is on screen (IntersectionObserver, or
`cv-activate` / `cv-deactivate` on drag pages), the page is visible, and the pieces are still
drifting (`progress < 0.85`); otherwise redraw on change.

Fallback: if `getContext('webgl')` fails, hide the canvas; the copy still explains the point.

## Budgets (check them)

- rAF frame interval P95 under 25 ms while wheel-scrolling through the scene at 1920x1080, compared
  with the same page without the drawing.
- 0 draw calls while the scene is off screen.
- Under reduced motion: the finished state, no drifting.
