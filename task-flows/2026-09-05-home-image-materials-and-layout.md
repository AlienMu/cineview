> Superseded by the user's latest direction: preserve the original Hero, avoid photographic redesign, keep scene 2 structurally intact, and redesign scenes 3–5 as useful interactive demonstrations in the original visual style. Do not implement the photographic asset plan below. See `2026-09-05-home-nine-scenes-implementation.md` for active work.

# Home Image Materials And Layout

Written against: `a1daed9` plus the current working tree

This task flow defines the image-backed version of the homepage before assets are generated or wired into runtime code.

## Evidence Chain

- Surface: `/` homepage, nine-scene sequence
- Product intent: show CineView as a working animation framework through a cinematic studio narrative
- Existing identity: Fraunces/Songti display, Inter/PingFang body, Roboto Mono timecodes, continuous warm LUT ribbon, film-strip motifs
- Existing media: `site/public/video.mp4`, `site/public/act3-edit.mp4`, `site/public/act3-edit-poster.jpg`, `site/public/act3-clip-poster-1.jpg` through `site/public/act3-clip-poster-5.jpg`
- Asset constraint: generated images must not contain product copy, logos, UI controls, or fake metrics
- Asset status: not generated yet

## Art Direction

- Real photographic studio environment with neutral plaster, pale floor, and clear material detail
- Graphite-black anodized equipment, brushed silver hardware, restrained honey-gold markings
- Soft warm-neutral side light from upper left; crisp reflections; inspectable edges
- Warmth comes from light and small metal details, not a full-page beige wash
- No pink cast, neon edge, artificial gradient, haze, bokeh, decorative orbs, large blur, text, logos, watermark, or baked interface
- Photography is full-bleed where it is the primary scene; transparent cutouts are used only as independent moving objects

## Asset Inventory

| ID | File | Size | Type | Use | Loading |
| --- | --- | --- | --- | --- | --- |
| A1 | `site/public/hero-studio-desktop.webp` | 2048x1280 | opaque photo | Hero desktop full-bleed background | eager, responsive `picture` source |
| A2 | `site/public/hero-studio-mobile.webp` | 1024x1536 | opaque photo | Hero mobile full-bleed background | eager mobile source |
| A3 | `site/public/equipment-prime-lens.webp` | 1536x1536 | alpha cutout | Position + Loop moving object 1 | preload before scene |
| A4 | `site/public/equipment-reel.webp` | 1536x1536 | alpha cutout | Position + Loop moving object 2 | preload before scene |
| A5 | `site/public/equipment-clapperboard.webp` | 1536x1536 | alpha cutout | Position + Loop moving object 3 | preload before scene |
| A6 | existing act3 posters | existing dimensions | opaque stills | Emanation/Stagger six-frame expansion | preload with scene |
| A7 | existing `video.mp4` | existing | video | Video scene actual frame playback | existing preload contract |
| A8 | existing `act3-edit.mp4` | existing | video | Film/Dolly continuity where applicable | existing preload contract |

Target web delivery: A1/A2 <= 450 KB each after WebP encoding; A3-A5 <= 90 KB each after WebP encoding. Keep source masters outside the web bundle if needed. Do not replace existing media in place; use versioned siblings until browser acceptance approves them.

## Scene Layouts

### 1. Hero

- Desktop: A1 fills the scene without a card or split column. Camera sits in the lower center at about 42% of image width. The upper 42% contains real studio wall detail with low visual contrast for live copy. `CineView` is the H1, with the existing title, slogan, intro, and CTA rendered by DOM on top of the photo. The next scene's film-strip edge or timecode appears in the bottom 8-12% of the viewport.
- Mobile: A2 is a dedicated portrait composition. Camera sits in the lower half at about 76% of image width. Upper 44% remains quiet photographic space for live copy. Text uses breakpoint sizes in `rem`; only object geometry follows `designWidth`.
- Motion ownership: Hero text uses existing `Animate`; photo stays static. Scroll is natural. No generated text in A1/A2.

### 2. Film Strip

- Use existing film-strip structure and nine preset cells. The strip occupies the middle 70% of the viewport, with perforations and timecode axis kept as DOM/CSS details.
- Give each frame a minimum readable viewing interval; distribute authored budget across the nine frame transitions instead of adding a long empty hold.
- Reuse A6 only where a still is needed; do not turn the poster set into a page-wide background.
- Motion ownership: local center-lock zone and existing Animate preset demonstrations. Hover may inspect the settled frame after the sequence completes.

### 3. Dolly

- Natural document scrolling. Four feature blocks form a horizontal editorial sequence inside the scene: Chain, Stagger, Nested, Scroll.
- Each block has one real media crop or code excerpt, one concise label, and a visible progress marker. The stage keeps a wide composition on desktop and stacks to one column on mobile.
- Use A8 or A6 as a restrained media insert only where it clarifies the demonstrated behavior. Do not add a fake `Scene.scroll` trigger.
- Motion ownership: site-local scroll progress via the actual CineView container and scene ref; no framework render-progress writer.

### 4. Position + Loop

- Desktop: three independent A3-A5 cutouts sit in an unframed wide stage at separate anchor points. Paths do not overlap. A compact code line and coordinate readout sit below the objects.
- Mobile: anchors become a vertical triangle; cutouts shrink and path radii reduce so all three remain visible without horizontal overflow.
- Motion ownership: each object uses `Position` and a clock-driven `loopAnimation`; visibility gate starts entry and pauses loops offscreen. The scene itself remains natural scroll.

### 5. Emanation / Stagger

- Arrange A6 as a 3-column by 2-row 9:16 image array. The center column appears first, then the outer columns expand in sequence from the center.
- Use image gaps and a shared timecode axis instead of nested cards, heavy shadows, or labels over every image. The array remains readable at mobile width with each cell approximately 88x156 CSS pixels at 390px viewport.
- Motion ownership: one-time visibility entry with `visibility={{ replay: false }}`; no exit animation required. Images remain real poster frames.

### 6. Canvas

- Keep the stage visually sparse so the actual particle typography is legible. Use a thin photographic edge or A6 still as a low-area reference, never as a full backdrop.
- Canvas is a real `<canvas>` drawn from deterministic progress. It must render non-zero pixels, support reverse progress, resize with device pixel ratio, pause when offscreen, and settle to a readable static state for reduced motion.
- Motion ownership: one `Animate` parent with a declared duration; the child consumes `useAnimateTimeline()` and subscribes to the timeline MotionValue.

### 7. Performance

- Use a neutral studio bench crop or a narrow A3-A5 equipment detail only as a static visual anchor. The primary content is a real FPS/average frame time chart and loaded-resource estimate.
- One CineView sampler owns frame collection. A 500ms external store supplies both this scene and `PerfPanel`; the scene must not invent P95, dropped-frame, or active-animation values.
- Desktop uses a two-column composition; mobile stacks chart and metric labels without shrinking below readable sizes.

### 8. Video

- Preserve A7 frame scrubbing and existing subtitle treatment. Keep the video area large enough to inspect the actual content and use the same warm-neutral studio palette only in surrounding DOM.
- Do not generate a replacement video poster unless the current poster fails browser inspection.
- Motion ownership: existing `AnimateVideo` timeline and the scene's center-lock zone.

### 9. Cinema

- Preserve the existing dark cinema transition, phone mockup, and actual `/drag` handoff. A generated equipment image is not used here; the phone and drag experience are product evidence.
- Ensure the transition reaches a stable static state for reduced motion and that fixed layers remain scene-scoped.

## Generation Prompts

### A1 Desktop Hero

Use case: `photorealistic-natural`

Asset: `hero-studio-desktop.webp`, 2048x1280, opaque full-bleed photo.

Prompt: Photograph one unbranded professional cinema camera in a clean realistic studio. Use graphite-black anodized metal, brushed-silver hardware, tiny honey-gold details, soft warm-neutral side light from the upper left, crisp natural reflections, a neutral plaster wall, and a pale floor with believable contact shadows. Place the complete camera in the lower center at about 42% of frame width. Keep the upper 42% visually quiet but photographic for live website typography. Keep the full silhouette sharp and inspectable. No split layout, cards, text, logos, artificial gradients, pink cast, sepia treatment, neon, glow, haze, bokeh, or motion blur.

### A2 Mobile Hero

Use case: `photorealistic-natural`

Asset: `hero-studio-mobile.webp`, 1024x1536, opaque full-bleed portrait photo.

Prompt: Recompose the supplied desktop studio photograph vertically while preserving the identical unbranded cinema camera, graphite and silver materials, warm-neutral side lighting, neutral studio wall, pale floor, perspective, and sharp detail. Place the complete camera in the lower half at about 76% of image width. Reserve the upper 44% as quiet real photographic background for live title and controls. Keep every hardware part inside the frame and maintain natural contact shadows. No text, logos, decorative frames, cards, pink lighting, orange backdrop, haze, glow, bokeh, or blur.

### A3-A5 Independent Equipment Cutouts

Use case: `background-extraction`

Assets: three separate files, each 1536x1536, alpha WebP or PNG master.

Prompt template: Create exactly one photorealistic transparent cutout of `{object}` matching the supplied studio camera photograph: graphite-black anodized metal, brushed silver, restrained honey-gold details, warm upper-left side light, crisp realistic reflections, consistent three-quarter viewing angle, complete silhouette, and 18% transparent padding on every side. No floor, baked shadow, other objects, sheet layout, labels, logos, readable text, glowing edge, haze, or blur. Object: `{compact cine prime lens | machined silver film reel | closed clapperboard with blank writing area}`.

## Acceptance Nodes

- [ ] Generate A1 and A2 with the approved shared art direction
- [ ] Generate A3, A4, and A5 as independent transparent files
- [ ] Inspect subject completeness, alpha edges, lighting consistency, and file sizes
- [ ] Wire A1/A2 into Hero with responsive `picture` sources and stable aspect-ratio sizing
- [ ] Wire A3-A5 into Position + Loop without changing framework ownership rules
- [ ] Reuse A6-A8 only in the scenes listed above
- [ ] Verify desktop 1440x900 and mobile 390x844 crops, no text overlap, no horizontal overflow
- [ ] Verify reduced motion, offscreen loop pause, Canvas non-zero pixels, and scene transitions

## Stop Conditions

- Stop and revise the prompt if any generated image contains text, a logo, a watermark, or an uninspectable blurred subject.
- Stop wiring if an asset forces a new public CineView API or makes a scene depend on per-frame React state.
- Keep the current poster/video assets when a generated replacement does not improve inspectability.
