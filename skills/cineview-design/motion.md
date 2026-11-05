# Motion vocabulary: the 41 references

What each of the 41 design references says to a reader, how strong it can be, where it works,
and what it conflicts with. The names follow the Mocubix design lexicon
(https://mocubix.renocrypt.com/lexicon/). The descriptions and the mapping to Cineview are this
project's own. A fuller index is in `docs/ai/lexicon.md` in the Cineview repository.

**Kind**: F is built into Cineview. P is page work, meaning plain CSS or script with no Cineview
syntax. X is not available.

**Modes**: S ordinary scroll, Z held scene (`zone`), T sideways row (`track`), K cover (`stack`),
D drag, C played on the clock from the scene becoming current (`on="clock"`).

Two things explain most conflicts:
1. **One property of one element follows one progress source.** Two references that drive the
   same property of the same element multiply or fight: two scales, two clips, two opacities. On
   different elements they combine freely.
2. **Attention.** A reader follows one change more easily than two in the same place at once.
   Separate windows (`at`, `after`) or separate scenes give each its moment.

## Arrival: how something comes onto the screen

**30 Clip reveal** (F; S Z T D)
- Says: something new is uncovered from one side. The side reads as where it comes from: from the
  side of its sentence, "this belongs to that"; from the centre, an opening.
- Strength: the direction (`left`, `right`, `top`, `bottom`, `center`), 600-1200 ms. A slight push
  adds weight, and `reveal` adds focus as well.
- Conflicts: a second clip on the same element; a direction that means nothing; a comparison
  slider (31) on the same pair.
- Write: `fx="wipe(left)"`, `fx="wipe(left), push(1.04, 1)"`, `fx="reveal(left, soft)"`.

**32 Split text** (F; S Z D C)
- Says: the sentence is read as it arrives, line by line or word by word.
- Strength: lines or words; a stagger of 60-150 ms; rising out of its own clip without a fade
  (`rise(line)`), or a soft rise.
- Conflicts: word scrub (10) on the same text; long body copy, which delays reading; text that
  changes language after load, since lines are measured once.
- Write: `split="lines" fx="rise(line)" stagger="120"`.

**09 Path drawing** (F; S Z D C)
- Says: a line is being made, as a route, a sequence, a signature or a plan.
- Strength: duration; which strokes draw (`target`); a stagger across strokes; a loop after it.
- Conflicts: shapes whose fill carries the meaning, because the fill only appears afterwards;
  scribbles that follow no route.
- Write: `fx="draw" target="svg path"`.

**25 Blur-up** (F; S Z)
- Says: the picture is arriving, developing from a blurred stand-in while it loads.
- Strength: the stand-in's size, 16-32 px wide.
- Conflicts: faking a load that is not happening.
- Write: `fx="develop"` around `<img src="big.jpg" data-cv-standin="tiny.jpg">`.

**33 Variable font** (F; S Z D)
- Says: emphasis arriving, as weight or width grows.
- Strength: the axis range, such as `wght 250 650`. Most visible on large words.
- Conflicts: fonts without the axis; small text; the cost of laying text out again every frame.
- Write: `fx="axis(wght 250 650)"`.

**35 Vertical writing** (P with an F part; S Z T D)
- Says: a scroll of text, literary and classical.
- Strength: how long the strip takes to unroll.
- Conflicts: Latin words and numbers mixed in without typesetting rules (upright or rotated).
- Write: page CSS `writing-mode: vertical-rl`, and `fx="unroll"` for the unrolling.

**34 Text mask** (P; S Z D)
- Says: the words are made of the picture.
- Strength: the word's size; the picture moving behind it.
- Conflicts: thin fonts; busy pictures. Glyphs can go unpainted where the picture is missing, so
  keep a solid colour fallback.
- Write: page work, with `background-clip: text` and a solid fallback colour.

## Attention: where the eye goes

**12 Depth of field** (F; S Z D; the band form needs content passing the middle of the screen:
ordinary scroll, or a drag page's slide)
- Says: look here; the rest waits out of focus.
- Strength: `focus` goes from blurred to sharp on time; `soft`, `strong` or px set how much.
  `focus(band)` is sharp only near the middle of the screen as content passes.
- Conflicts: text, which is unreadable while blurred; the band inside a held scene, where nothing
  passes the middle.
- Write: `fx="focus"`, `fx="focus(band)"`. On large pictures, add `data-cv-blurred="tiny.jpg"`.

**26 Ken Burns** (F/P; S Z D)
- Says: look slowly, detail by detail. `push` gives the slow push about a fixed point; moving
  focal points across one picture, or dissolves between several, are page work.
- Strength: the scale range and the point that stays still, such as `push(1.06, 1, 30% 40%)`;
  2-6 s, or the length of a held scene.
- Conflicts: parallax (04) on the same picture; two pushes in view at once.
- Write: `fx="push(1.06, 1, 30% 40%)"`.

**10 Word scrub** (F; Z D)
- Says: the reader's own movement reads the sentence out, one word at a time.
- Strength: the stagger over the scene's time. Keywords can share their moment with their
  pictures.
- Conflicts: split text (32) on the same words; long passages.
- Write: in a zone, `split="words" from="opacity:0.2" to="opacity:1" stagger="80"`.

**13 Count** (F; S Z D C)
- Says: this number is real and it matters. The final value is what stays.
- Strength: duration. The unit and the label stay still beside it.
- Conflicts: invented numbers; numbers without a unit or a label.
- Write: `fx="count"` on the element that holds the real number.

**40 Difference invert** (F; S Z D)
- Says: the text stays visible over anything, by inverting what is behind it.
- Conflicts: mid-grey grounds, which invert to grey.
- Write: `fx="invert"`.

## Sequence and holding: order, steps, a scene that stays

**03 Pin and scrub** (F; Z)
- Says: stay here; this unfolds as you scroll.
- Strength: one anchor element's `duration` sets the length (1 ms = 1 px of scroll).
- Conflicts: another held scene straight after, which feels stuck; a held scene longer than its
  content.
- Write: `<cv-scene zone>` with one anchor whose `duration` is the intended length.

**08 Timeline scope** (F; S Z)
- Says: this caption belongs to that picture, because they move at the same moment.
- Strength: a shared `view(#id)` inside one scene, or matching `at` windows in a held scene.
- Conflicts: subjects in different scenes. The scope is one scene.
- Write: `on="view(#photo)"` on the caption.

**06 Stacking cards** (F; S Z K D)
- Says: steps pile up, each one built on the last.
- Strength: `step` (how much of each covered card stays visible), `covered` (`dim`, `recede`), and
  the duration per card.
- Conflicts: a step that cuts a card's first line; a deck taller than the screen.
- Write: `<cv-stack step="64" duration="500">` around HTML cards.

**05 Horizontal section** (F; T, and D on scene time)
- Says: a row of things of one kind that the reader travels along.
- Strength: the travel is the row's real overflow; the panel width.
- Conflicts: a snap strip (14) or a flung strip (22) inside it; panels of uneven height.
- Write: `<cv-scene track="x">`.

**11 Curtain overlap** (F; K D)
- Says: a new chapter covers the old one.
- Strength: `covered="dim"` or `covered="recede"` on the scene being covered.
- Conflicts: a covered scene that keeps animating underneath.
- Write: `<cv-scene stack covered="dim">` on the scene that gets covered.

**18 Stuck state** (F; Z K D)
- Says: this scene is holding. Its look can change while it holds.
- Write: CSS on `cv-scene[data-cv-stuck]`. Ordinary sections never hold.

## Depth and speed

**02 View progress** (F; S, and D during the page slide)
- Says: this object changes as it passes through the screen.
- Strength: the range (`cover`, `entry`, `exit`, with percentages) and the subject.
- Conflicts: the same property also driven by an entrance.
- Write: `on="view(self)" fx="keyframes(turn) cover 10% cover 60%"`.

**04 Parallax** (F; S, and D during the page slide)
- Says: depth, with layers at different distances.
- Strength: `drift(soft)` (3.5%), `drift(strong)` (16%), or px.
- Conflicts: the subject of a sentence drifting away from the words about it; a pinned scene
  scrubbing the same element; body text.
- Write: `fx="drift(soft)"` on a background layer.

**07 Velocity skew** (F; S D)
- Says: speed. Things lean while the reader moves fast.
- Strength: `skew(soft)`, `skew(strong)` or degrees.
- Conflicts: body text; pictures of faces.
- Write: `fx="skew(soft)"` on thin decorative strokes.

**36 Marquee** (P; S)
- Says: a band of names or words in constant slow motion: atmosphere, abundance.
- Strength: speed; one or two rows.
- Conflicts: key information inside it; held scenes, where its loop ignores the scrubbed time.
- Write: page work, as a measured CSS or WAAPI loop with one focusable copy and a pause control.

## Colour and tone

**41 Threshold flip** (F; S Z D)
- Says: the palette changes, marking a new chapter. In drag it flips once the page passes the
  middle.
- Strength: one change or several. Page CSS transitions the colour tokens, often in well under a
  second.
- Conflicts: changes so frequent that none of them means anything; a theme on scenes whose ground
  already follows the scroll.
- Write: `<cv-scene theme="sage">`, styled from `cv-stage[data-cv-theme="sage"]` (`colour.md`).

**27 Duotone** (F; S Z D)
- Says: these pictures belong to one set, printed in two inks.
- Strength: the ink pair, named or from the palette; the window.
- Conflicts: hue (37) on the same pictures; brand colours inside the photos.
- Write: `fx="duotone(var(--ink-dark), var(--ink-light))"`.

**37 Token interpolation** (F; S Z D)
- Says: colour shifts as the scene moves on.
- Strength: the angle range, ideally scoped to one figure (38).
- Conflicts: page-wide brand colours shifting; contrast part-way through, which needs checking.
- Write: `fx="hue(0deg, 120deg)"`, with colours written as `oklch(… calc(250deg + var(--cv-hue)))`.

**38 Scoped rotation** (P; S Z D)
- Says: one figure changes colour while the page stays put.
- Write: page work. Scope the variables to the figure's container.

**39 Gamut arc** (P; S Z)
- Says: one colour travels to another through vivid hues instead of grey.
- Conflicts: middle colours that nobody checked.
- Write: page work with `color-mix(in oklch, …)`.

**29 Dithering** (P; S)
- Says: a limited-tone, printed or retro texture.
- Conflicts: small pictures, where the pattern turns to noise; duotone (27) on the same
  pictures (pick one).
- Write: page work, with an image processed in advance.

**28 Progressive blur** (P; S)
- Says: text sits over a picture that melts into blur behind it.
- Conflicts: the subject placed under the text.
- Write: page work, with layered `backdrop-filter` and masks.

## Orientation: where the reader is

**01 Page progress** (F; S D)
- Says: how far through the page the reader is. In drag it follows the scene position.
- Conflicts: decorative counters that say nothing.
- Write: `on="page" from="scale-x:0" to="scale-x:1"` on a thin bar, with the origin set through
  `::part(layer)`.

**16 Scroll markers** (P, with the marking built in; S D)
- Says: the chapters, and which one is current.
- Conflicts: markers with no current state.
- Write: links to the scene ids, styled as markers. The stage marks the link to the current scene
  with `aria-current="true"`, and the others with `data-cv-before` or `data-cv-after`.

**19 Snapped state** (F; S T D)
- Says: this is the current scene.
- Write: CSS on `cv-scene[data-cv-current]`. Watch for styling that hides content.

**20 Direction state** (F; S D)
- Says: forward or back. For example, a bar that hides while reading on and returns on the way
  back.
- Conflicts: hiding the only way to navigate.
- Write: CSS on `cv-stage[data-cv-direction="forward"]`.

**23 Scrollspy** (F; S D)
- Says: a contents list that follows the reader.
- Conflicts: headings inside scenes that have no scene anchor.
- Write: give scenes ids and link to them. The stage sets `aria-current` on the link to the
  current scene; style from it.

## Control and paging: the reader's own handling

**17 Scroll buttons** (P; S D)
- Says: previous and next, for readers who neither scroll nor drag, including keyboard and
  screen-reader users on drag pages.
- Conflicts: buttons with no end states.
- Write: buttons that call `stage.goTo(i)`, disabled at the ends.

**14 Scroll snap** (P; S, local strips)
- Says: a small strip that settles on each item.
- Conflicts: drag pages, where the finger is for changing scenes; sideways rows.
- Write: page work, as a native scroller with `scroll-snap-type`.

**15 Snap stop** (P; S, local)
- Says: this step must not be skipped.
- Write: page work, with `scroll-snap-stop: always`.

**22 Kinetic drag** (P; S, local)
- Says: a strip the reader can fling sideways.
- Conflicts: drag pages; sideways rows.
- Write: page work, as a local horizontal container with inertia.

**24 Overscroll containment** (P; S D)
- Says: a local panel scrolls without carrying the page along.
- Conflicts: trapping the page's own scroll.
- Write: page work, with `overscroll-behavior: contain`. On drag pages, a panel that can still
  scroll keeps the finger until its edge.

**31 Comparison slider** (P; S)
- Says: before and after, under the reader's control.
- Conflicts: a clip reveal (30) on the same pair; drag pages, where the handle competes with
  changing scenes.
- Write: page work, as a native range input over two clipped pictures, so the keyboard works too.

**21 Infinite loop** (X)
- Not available. Scenes on a stage are finite.

## Observations by mode

- **Held scenes back to back** make the reader feel stuck. An ordinary section, a sideways row or a
  cover between them changes the pace.
- **A held scene longer than its content** gives a screen of scrolling with no change for every
  1000 ms.
- **Inside a sideways row**, a second horizontal movement (a snap strip, a flung strip) competes
  with the row itself.
- **In a deck of cards**, set the step to the card's first line, so no card's text is cut. Add up
  the drawn height (step × (cards - 1) + the last card) so the deck fits the screen.
- **On drag pages**, native scrollers, snap strips and long text compete with the finger, which
  changes scenes. Every scene costs a gesture, so short sequences read best.
- **Clock entrances** (`on="clock"`) suit things that cannot wait to be seen: large decorations
  partly off screen, sketches nearly as tall as their scene. Keep clock elements and
  scroll-driven elements in separate `after` chains.
