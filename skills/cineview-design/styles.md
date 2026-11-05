# Visual styles

A style is a set of qualities: how the type is paired, how colour is used, how dense the page
is, its edges and textures, and the character of its motion. The same scenes read very
differently under each. Below are sixteen as starting points. Mix parts of several, push one
toward the user's brand, or leave them all for something the product suggests (`sources.md`).

Each style says what makes the feel, then gives options:
- two or three font pairings (Latin, and Chinese where it matters);
- two example palettes, labelled as examples, and how to take colours from the user's own
  material instead (`colour.md`);
- what it suits, what tends to go wrong, and how to move it toward a brand.

Fonts named here are free for the web (Google Fonts, SIL OFL). Check the licence of any other
font. Chinese web fonts are large, so subset them or let phones use system fonts (`phone.md`).

The recipes in other files use these variables, so a style is mostly a matter of setting them:

```css
:root {
  --font-display: ...;  /* titles */
  --font-body: ...;     /* text */
  --ground: ...;        /* page background */
  --surface: ...;       /* cards, panels */
  --ink: ...;           /* titles */
  --ink-soft: ...;      /* body text */
  --accent: ...;        /* links, buttons, highlights */
  --on-accent: ...;     /* text on the accent */
  --line: ...;          /* rules, outlines, line art */
  --radius: ...;        /* corner rounding */
}
```

## Clean product

- **Feel:** clear, calm, trustworthy.
- **Where it comes from:** one sans family in two weights; a lot of space; a single saturated
  accent against a near-white ground; the product's interface as the main picture.
- **Type:** Inter in two weights; Manrope with IBM Plex Sans; Noto Sans SC or the system font for
  Chinese. Tabular figures for numbers.
- **Colour:** near-white ground, dark slate ink, the accent kept for actions and highlights.
  Example A: `#ffffff` / `#0f172a` / accent `#2563eb`. Example B: `#f6f6f1` / `#1c1917` / accent
  `#0f766e`. From material: take the accent from the logo or the product's own interface.
- **Density:** airy, one idea per block.
- **Edges and texture:** medium radius, hairline borders or soft shadows.
- **Motion:** short and crisp, such as rises and wipes, with little decoration.
- **Suits:** readers who scan and need to trust what they read; screenshots as material; a calm
  tone.
- **Watch for:** everything turning into cards; grey text losing contrast; a page that looks like
  every other software page unless it carries the product's own colour and pictures.
- **Toward a brand:** the brand font for titles, the accent from the logo, screenshots of the real
  interface.

## Editorial paper

- **Feel:** literary, crafted, unhurried.
- **Where it comes from:** a serif for titles; warm paper grounds; thin rules; large titles set in
  lines with room around them.
- **Type:** Fraunces with Source Sans 3; Newsreader with Inter; Noto Serif SC with Noto Sans SC.
- **Colour:** paper ground, brown-black or blue-black ink, one earthy accent. Example A:
  `#fbefdd` / `#352820` / accent `#994f36`. Example B: `#f4f1ea` / `#1f2a2e` / accent `#5b6b3c`.
  From material: the paper tone from the lightest warm area of the photos.
- **Density:** generous margins; text in narrow columns; pictures given whole lines.
- **Edges and texture:** thin rules and small radii; a faint paper grain is optional.
- **Motion:** slow entrances, lines drawn out, lines of text arriving one after another.
- **Suits:** culture, publishing, studios, long reads.
- **Watch for:** low contrast between ink and paper; titles too light to read on phones.
- **Toward a brand:** the brand's serif or a close one, an accent from its print material.

## Night neon

- **Feel:** electric, after dark.
- **Where it comes from:** a near-black ground; one or two glowing colours; high contrast; a
  technical sans or mono.
- **Type:** Space Grotesk with JetBrains Mono; Sora with Inter; for Chinese, Noto Sans SC in a
  heavy weight for titles.
- **Colour:** black or deep navy, very light ink, glowing accents. Example A: `#07080d` /
  `#f4f6ff` / accent `#ff3d7f`. Example B: `#0a0614` / `#ecebff` / accent `#39f5c8`. From
  material: the brightest saturated colour in the footage.
- **Density:** sparse, with each glowing element given space.
- **Edges and texture:** small radii, glow on titles and numbers only, grids or scan lines in the
  background.
- **Motion:** fast wipes, counts, footage that plays as the reader scrolls.
- **Suits:** games, music, nightlife, gadgets.
- **Watch for:** glowing body text tires the eyes, so keep the glow for titles and numbers.
- **Toward a brand:** the glow colour from the product's lights or UI.

## Poster

- **Feel:** loud, graphic, immediate.
- **Where it comes from:** flat blocks of colour; a heavy grotesque at huge sizes; tight leading;
  almost no ornament.
- **Type:** Anton or Archivo Black with Inter; Bebas Neue with Work Sans; Smiley Sans (得意黑) for
  Chinese titles.
- **Colour:** two or three flat colours used as whole grounds. Example A: `#ffde21` / `#111111` /
  accent `#ff4b1f`. Example B: `#f2efe6` / `#0b0b0b` / accent `#2b4bff`. From material: the
  dominant colours of the campaign art.
- **Density:** one huge statement per screen.
- **Edges and texture:** square corners, hard edges.
- **Motion:** big moves: hard wipes with linear easing, blocks covering each other, numbers as
  graphics.
- **Suits:** events, launches, campaigns.
- **Watch for:** words that break badly at phone widths; contrast on mid-tone blocks.
- **Toward a brand:** the brand's two strongest colours as grounds.

## Soft lifestyle

- **Feel:** warm, friendly, photo-led.
- **Where it comes from:** pale grounds; rounded shapes; photography first; a gentle serif or a
  rounded sans.
- **Type:** DM Serif Display with DM Sans; Young Serif with Nunito; LXGW WenKai (霞鹜文楷)
  with Noto Sans SC for Chinese.
- **Colour:** cream or pale green grounds, soft dark ink, a warm accent. Example A: `#f6f1ea` /
  `#2b2a28` / accent `#d9774b`. Example B: `#f3f6f1` / `#26302a` / accent `#c4627a`. From
  material: a ground taken from the photos' light, the accent from the food or the product.
- **Density:** relaxed, with photos large and text short.
- **Edges and texture:** large radii, rounded photo crops, small hand-drawn marks.
- **Motion:** gentle: focus, soft rises, photos that drift a little.
- **Suits:** food, cafés, wellness, travel, consumer apps.
- **Watch for:** pastel text on pastel grounds; too many rounded boxes.
- **Toward a brand:** the brand's photography style decides most of it.

## Monochrome documentary

- **Feel:** serious, honest, timeless.
- **Where it comes from:** the photos are the subject and the layout steps back. Black and white
  removes the mood that colour brings, leaving light and people. Captions read like an archive.
- **Type:** Source Serif 4 with IBM Plex Mono; Newsreader with JetBrains Mono; Noto Serif SC with
  a mono for Chinese.
- **Colour:** near-black or paper-white, almost no colour, one accent at most. Example A:
  `#111111` / `#f2f2f2` / accent `#e23b2e`. Example B: `#f4f1ea` / `#1a1a1a` / no accent. From
  material: take the ground and the ink from the darkest and lightest areas of the photos, so the
  page and the pictures share one grey scale.
- **Density:** big photos and little space between them; small, dense text.
- **Edges and texture:** square corners, no shadows; grain only on dark scenes.
- **Motion:** slow. Slow pushes, captions arriving after their photos, `duotone(mono)` to tie
  together photos from different sources.
- **Suits:** pages where the reader must believe the material is real: archives, dates, places,
  a restrained voice.
- **Watch for:** black and white exaggerating noise in uneven photos; buttons and links that
  disappear when everything is grey.
- **Toward a brand:** the brand colour as the single accent, the brand font for titles.

## Playful

- **Feel:** bright, bouncy, approachable.
- **Where it comes from:** saturated colours; rounded shapes; illustrations or characters;
  motion that overshoots a little.
- **Type:** Fredoka with Nunito; Baloo 2 with Quicksand; ZCOOL KuaiLe (站酷快乐体) for Chinese
  titles.
- **Colour:** warm white or pale sky, deep ink, two lively accents. Example A: `#fff7e6` /
  `#1d1b4b` / accent `#7c5cff`. Example B: `#eaf7ff` / `#0d2b45` / accent `#ff6b3d`. From
  material: the colours of the illustrations or the mascot.
- **Density:** busy is fine when the shapes are big.
- **Edges and texture:** large radii, stickers, blobs.
- **Motion:** grows with a springy curve (`cubic-bezier(.34, 1.56, .64, 1)`), loops, small
  rotations.
- **Suits:** children's products, education, communities.
- **Watch for:** everything bouncing at once; text set over busy shapes.
- **Toward a brand:** the mascot or illustration style leads.

## Luxury minimal

- **Feel:** quiet, expensive, precise.
- **Where it comes from:** a lot of empty space; a thin high-contrast serif; black with one muted
  or metallic tone; very slow motion.
- **Type:** Cormorant Garamond with Jost; Bodoni Moda with Montserrat (light); Noto Serif SC
  (light) for Chinese.
- **Colour:** off-white or near-black, with one muted tone. Example A: `#f7f5f2` / `#121212` /
  accent `#a08458`. Example B: `#101010` / `#efe9df` / accent `#c8b28a`. From material: the muted
  tone from the product's metal, leather or fabric.
- **Density:** very sparse, with a few words per screen.
- **Edges and texture:** square corners, thin rules, a monogram.
- **Motion:** very slow pushes, focus and long fades. Nothing bounces.
- **Suits:** fashion, jewellery, hotels, cars, perfume.
- **Watch for:** thin serifs at small sizes on phones; empty space that reads as unfinished
  rather than calm.
- **Toward a brand:** the brand's photography and monogram.

## Brutalist

- **Feel:** raw, direct, unpolished on purpose.
- **Where it comes from:** system or mono fonts; hard borders; clashing colours; visible
  structure.
- **Type:** Space Mono with system-ui; Archivo Black with Courier Prime; the system fonts for
  Chinese.
- **Colour:** grey or white with pure black, plus one pure colour. Example A: `#f2f2f2` /
  `#000000` / accent `#0000ff`. Example B: `#e9e4d8` / `#000000` / accent `#ff3b00`. From
  material: the one pure colour from the brand, or the loudest colour in the raw screenshots.
- **Density:** dense, with the grid on show.
- **Edges and texture:** 2-4 px black borders, no radius, raw screenshots.
- **Motion:** abrupt: linear wipes, instant switches, skew on fast scroll.
- **Suits:** agencies, independent tools, art projects.
- **Watch for:** "raw" turning into unreadable; links that cannot be told from text.
- **Toward a brand:** the brand's own blunt voice and one colour.

## Retro terminal

- **Feel:** nerdy, nostalgic, technical.
- **Where it comes from:** monospace everywhere; green or amber on black; a blinking cursor.
- **Type:** JetBrains Mono with IBM Plex Mono; VT323 for display; a mono plus Noto Sans SC for
  Chinese.
- **Colour:** dark ground, phosphor ink. Example A: `#0b0f0a` / `#b7f7a5` / accent `#ffcc33`.
  Example B: `#1a1206` / `#ffb000` / accent `#ffe7a3`. From material: the colours of the
  product's own terminal theme or logs, if it has them.
- **Density:** text-heavy but in short lines.
- **Edges and texture:** window frames, faint scan lines.
- **Motion:** typing (`type.md`), stepped easing in `keyframes`, a cursor blink as a loop.
- **Suits:** developer tools, command-line products, hacker events.
- **Watch for:** long passages in a mono font; low-contrast green on black.
- **Toward a brand:** the product's real commands and output as the copy.

## Swiss grid

- **Feel:** ordered, rational, typographic.
- **Where it comes from:** a strict grid; a neo-grotesque; flush-left text; big numbers; one
  strong colour.
- **Type:** Inter Tight with Inter; Arimo with IBM Plex Sans; Noto Sans SC for Chinese.
- **Colour:** white or warm grey, black, one strong colour. Example A: `#ffffff` / `#111111` /
  accent `#e3000f`. Example B: `#f1f1ec` / `#151515` / accent `#0047ff`. From material: the strong
  colour from the brand or from one key photograph; everything else stays neutral.
- **Density:** medium, with everything aligned to the grid.
- **Edges and texture:** square corners, thin rules, numbered sections.
- **Motion:** precise wipes along grid lines, lines entering in order.
- **Suits:** architecture, design studios, reports, conferences.
- **Watch for:** a rigid grid that falls apart at phone widths, so plan the narrow grid too.
- **Toward a brand:** the brand's grid and numbering.

## Organic nature

- **Feel:** earthy, slow, textured.
- **Where it comes from:** earth colours; paper or linen texture; hand-drawn lines; photos of
  materials.
- **Type:** Lora with Source Sans 3; EB Garamond with Nunito Sans; LXGW WenKai with Noto Sans SC
  for Chinese.
- **Colour:** stone or linen grounds, deep green or brown ink, a plant or clay accent. Example A:
  `#efeadf` / `#2f3a2c` / accent `#7a8b4a`. Example B: `#f2ece4` / `#3b2f2a` / accent `#b5653b`.
  From material: the soil, leaf or clay tones of the photos.
- **Density:** relaxed.
- **Edges and texture:** soft radii, grain, irregular crops.
- **Motion:** lines that draw themselves, slow drift on layers, photos coming into focus.
- **Suits:** outdoor brands, farms, ceramics, tea, sustainability.
- **Watch for:** texture under text lowering its contrast.
- **Toward a brand:** the brand's materials and their colours.

## Cinematic

- **Feel:** dramatic, widescreen, story-led.
- **Where it comes from:** dark grounds; big moving pictures; sparse titles set like credits;
  letterbox frames.
- **Type:** Oswald or Barlow Condensed with Inter; an elegant serif with a light sans; Noto Serif
  SC for Chinese titles.
- **Colour:** near-black, warm light ink, one film-like accent. Example A: `#050505` / `#f5f1ea` /
  accent `#d4a24c`. Example B: `#0b0f12` / `#f1ebe2` / accent `#e07a3f`. From material: grade the
  page to the footage's own colour.
- **Density:** one picture and one line per screen.
- **Edges and texture:** square frames, letterbox bars, film grain.
- **Motion:** footage that plays as the reader scrolls or drags, slow pushes, cuts between scenes.
- **Suits:** films, games, brand stories, launches with strong footage.
- **Watch for:** footage that never loads on slow phones, so plan posters and sizes (`video.md`).
- **Toward a brand:** the footage leads, and the titles follow its colour.

## East Asian paper

- **Feel:** quiet, literate, rooted.
- **Where it comes from:** rice-paper grounds; ink black; a seal red or a pine green; brush or
  kai lettering for titles; vertical writing as an option; empty space as part of the
  composition.
- **Type:** Ma Shan Zheng or Zhi Mang Xing (brush) with Noto Serif SC; LXGW WenKai with Noto Serif
  SC; for Latin, Cormorant Garamond or EB Garamond.
- **Colour:** paper, ink, one seal colour. Example A: `#f3ede0` / `#1b1b1b` / accent `#b3261e`.
  Example B: `#e9e6dc` / `#2b2a26` / accent `#3d5a4c`. From material: the paper tone from a scan
  of real paper, the accent from a seal or a glaze.
- **Density:** sparse, with text in short columns.
- **Edges and texture:** paper fibre, ink edges, a seal mark as a signature.
- **Motion:** slow reveals, brush strokes drawn as paths, vertical text unrolling (`unroll`).
- **Suits:** tea, culture, calligraphy, heritage, seasonal events.
- **Watch for:** brush fonts in body text; vertical writing mixed with Latin and numbers without
  rules (reference 35 in `motion.md`).
- **Toward a brand:** the brand's seal or calligraphy, its own paper.

## Handmade collage

- **Feel:** personal, crafted, a little irreverent.
- **Where it comes from:** cut-out photos; torn paper; tape; scanned textures; slightly rotated
  pieces overlapping.
- **Type:** Caveat or Gochi Hand for notes with Work Sans; a slab such as Roboto Slab with Inter;
  LXGW WenKai for Chinese notes.
- **Colour:** cream or kraft, deep ink, one bold paper colour. Example A: `#f5efe3` / `#22201c` /
  accent `#e8572a`. Example B: `#fdf7e8` / `#1e2a3a` / accent `#2f80ed`, with kraft `#c9a66b` as
  a surface. From material: the paper and tape colours of real scans.
- **Density:** layered, with pieces overlapping.
- **Edges and texture:** torn edges, tape, shadows under the cut-outs.
- **Motion:** pieces arriving one by one at slight angles, small drifts per layer.
- **Suits:** independent makers, zines, events, personal stories.
- **Watch for:** text placed on top of collage; shadows and textures on scenes that move every
  frame (`phone.md`).
- **Toward a brand:** the maker's own scans and handwriting.

## Technical drawing

- **Feel:** precise, engineered, explanatory.
- **Where it comes from:** blueprint or drafting paper; dimension lines; callouts; numbered parts;
  a mono for labels.
- **Type:** IBM Plex Sans with IBM Plex Mono; Barlow with JetBrains Mono; Noto Sans SC with a mono
  for Chinese.
- **Colour:** blueprint blue with white lines, or drafting white with dark lines and red marks.
  Example A: `#0e2a47` / `#e6f0fa` / accent `#ffd166`. Example B: `#f7f6f2` / `#1b1f24` / accent
  `#d9480f`. From material: the product's own drawings and colours.
- **Density:** medium, with labels around a central drawing.
- **Edges and texture:** fine lines, grids, crosshairs.
- **Motion:** lines drawing themselves, parts arriving in assembly order, labels that follow
  their part (`drawing.md`).
- **Suits:** hardware, engineering, architecture, how-it-works pages.
- **Watch for:** hairlines that vanish on phones; too many labels at once.
- **Toward a brand:** the brand's real drawings and part names.

## Choosing

What usually decides it: the product's tone and readers, the material (photos suit lifestyle and
documentary; screenshots suit clean product and Swiss; drawings suit technical), an existing
brand, and the tone the user wants. Offering two or three that fit, with a sentence on the basis
for each, gives the user something to react to. Their answer often lands between them.
