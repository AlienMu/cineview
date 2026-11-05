# Handovers: from one scene to the next

How a scene hands over to the next one says something by itself. A plain continuation says "and
then". A cover says "new chapter". A held scene says "watch this". Choosing the handover for each
pair of scenes, not only what each scene shows, gives a page its rhythm.

## On scroll pages

**Continue.** The next section follows as the reader scrolls. The scroll itself is the
transition: elements in the next scene enter as they come into view, and elements with an `exit`
leave as they go.
- Says: the story goes on.
- Watch for: a page made only of these, where every screen arrives the same way.

**Hold, then release.** A held scene (`<cv-scene zone>`) keeps the screen while the scroll plays
its timeline, then the page moves on.
- Says: stop and watch this part.
- Watch for: held scenes back to back, which feel stuck. Put an ordinary section or a cover
  between them.

**Cover.** The next scene slides over the current one, which stays in place and can dim or recede
as it is covered.
- Write: `stack` and `covered` go on the scene being covered: `<cv-scene stack covered="dim">`.
- Says: a new chapter, laid on top of the last.
- Watch for: a covered scene that keeps animating underneath.

**Sideways.** A row moves sideways as the reader scrolls (`<cv-scene track="x">`). Placed after a
covered scene, it slides over it.
- Says: a set of things of one kind.

**Shared element.** One object stays on screen while the scenery around it changes.
- Write: `<cv-fixed>` holds it while its scene passes. Something that persists across scenes goes
  outside `cv-stage`.
- Says: this is the constant, and everything else is context.

**Palette change.** The scene's `theme` marks the stage while it is current
(`<cv-scene theme="sage">`), and page CSS changes the ground and ink from that mark (`colour.md`).
- Says: a new chapter.

**Wipe between two pictures.** Inside a held scene, two pictures are stacked and the top one wipes
away over the scene's time.
- Says: this became that.

**Zoom through.** The current picture scales up (`push(1, 3, 50% 40%)`) until a detail fills the
screen, and the next scene starts inside that detail.
- Says: let's go inside.

**A cut on video.** A short clip (a whip pan, a door, ink spreading) carries the change, so it
reads as one shot. See "Transition clips" below.

## On drag pages: how do we change into this scene?

Two scenes are on screen at once during a drag. The leaving scene plays its exits, or runs its
entrance backwards when the reader drags back. The arriving scene's entrance follows the finger.
For each change, tell the user three things (`drag.md` has the facts):
- what the finger brings in first;
- what plays after release;
- what runs backwards on the way back.

**Push** (the default). The current scene moves up while the next comes in from below.
- Says: next.
- Exits on the leaving scene and the first part of the entrance on the arriving one share the
  screen.

**Cover.** The current scene stays where it is while the next slides over it. It can dim or
recede.
- Write: `stack` (and `covered="dim"` or `covered="recede"`) goes on the scene before the one you
  are changing into. In the storyboard, the change is listed on the arriving scene, but the markup
  goes on the covered one.
- Says: the next moment, on top of this one.
- On the way back, the covered scene's entrance plays again from its start as it is uncovered.

**Join at the boundary.** Something at the bottom of the current scene meets something at the top
of the next: a line that continues, a horizon, an object cut in two.
- Write: page work, through composition. View-progress motion (references 02 and 04 in
  `motion.md`) moves layers at different rates while the page slides.
- Says: these two belong together.

**Palette change past the middle.** `theme` on the arriving scene. The ground and ink change once
the page passes halfway.
- Says: a different act.

**A played cut**, for a change started by a button or by the end of a clip rather than by the
finger: under the finger the page already moves. See "Transition clips" below.

## Pacing

- A sequence of handovers that varies (continue, continue, cover, hold) has more shape than one
  repeated everywhere.
- When every scene carries a different effect, the page reads as a sampler. A treatment or a
  motif that returns ties the scenes together.
- On drag pages each change costs a gesture. Alternating changes, such as push for steps and
  cover for chapters, can show the reader where they are.

## Transition clips

A short clip played over the cut from one scene to the next makes the change feel like a single
shot.

**Scrubbed, inside a held scene.** The scene's own timeline is the transition:

```html
<cv-scene zone>
  <cv-video class="cut" src="cut.mp4" duration="900" ease="linear" aria-hidden="true"></cv-video>
  <cv-animate class="from" from="opacity:1" to="opacity:0" at="0% 45%">...first picture...</cv-animate>
  <cv-animate class="to" from="opacity:0" to="opacity:1" at="55% 100%">...next picture...</cv-animate>
</cv-scene>
```

**Played at a scene change** (after a click, or on a drag page). The clip sits fixed over the page
and plays, and the page changes scene while the clip covers the screen:

```js
async function cutTo(id) {
  const cut = document.querySelector('.cut-overlay');           // a <video> fixed over the page, hidden
  cut.currentTime = 0; cut.hidden = false; await cut.play();
  setTimeout(() => stage.goTo(id, { animated: false }), 450);   // swap while the clip covers it
  cut.addEventListener('ended', () => (cut.hidden = true), { once: true });
}
```

Preparing them:
- Swap at the clip's most covered frame, which you can find by stepping through the file. The
  first and last frames can match the two scenes so the cut is invisible.
- Keep cuts short, around 0.6-1.5 s.
- A scrubbed clip needs every frame to be a keyframe (`video.md`). A played clip can use a normal
  encode, which is smaller.
- Keep clips muted unless the reader starts them, with a poster from the first frame, sized to
  the screen they cover: landscape for desktops, a portrait cut for phones.
