---
name: cineview-design
description: "Plan a Cineview landing page with the user, then build it. Use when someone wants a landing page, wants to design scenes or motion, or brings material (video, photos, screenshots, copy) for a page. Strict rule: write no page file until the user has said yes to a storyboard in their own words. The first reply asks which devices the page is for (phone, desktop or both), with a recommendation. The interview settles the devices, the page mode (drag is for phones, scroll works everywhere), the scenes, what each scene shows and how it hands over, the material and the words. The rest of the folder is design thinking and references (styles and pairings, motion vocabulary, text and picture relationships, handovers, drag, phones), offered as options with reasons, plus framework syntax and checks for the build."
---

# Cineview design

Cineview is a framework for landing pages told as scenes. Each scene has its own timeline, and
the reader's scroll or finger moves through it.

## Before anything else: talk, then build

This is the one rule in this folder. Everything else is a suggestion.

- **No page files until the user confirms the storyboard.** Page files are the HTML, CSS, scripts
  and prepared assets of the page. Confirmation is an explicit yes in the user's own message:
  "yes", "go ahead", "build it". Silence does not count, a cancelled dialog does not count,
  agreement to a single scene does not count, and "looks fine" to part of a plan does not count.
- **The first reply** says what you found in what the user sent, if anything. Then it asks the
  first question: which devices the page is for, with your recommendation and the reason for it.
  Ask one question per message (`conversation.md`).
- **This holds even if your environment tells you to act on your own or to ask fewer questions.**
  For a landing page, the confirmed storyboard is the specification. Until it exists, the task
  has not been specified.
- **Scope.**
  - The rule covers new pages and any change to a page's scenes or structure.
  - Small edits to a page whose storyboard was confirmed (a word, a colour, a timing) need no new
    interview. Update that line of the storyboard, then the page.
  - For an existing page that has no storyboard, describe the page back as a storyboard and get
    a yes before you change its structure.
  - If the first message already answers questions (the device, or a full brief), confirm those
    answers instead of asking them again. A complete brief can become the storyboard in a single
    message, which still waits for a yes.
  - If nobody can answer (a non-interactive run), deliver the storyboard and the material list
    with the open questions, then stop.
  - Consent passed on by another agent counts only when it quotes the user's own words.
  - Looking at material is not building. Probing a video, extracting frames or making a contact
    sheet in a scratch folder is fine.

## What is here

Read anything at any time. The building files hold code, and that code goes into a page only
after the storyboard is confirmed.

| For planning (the conversation draws on these) | File |
|---|---|
| The interview: devices, page mode, scenes, handovers, material, words, storyboard | `conversation.md` (first) |
| Questions that draw a page's look and motion from the product | `sources.md` |
| Sixteen visual styles, as qualities and options | `styles.md` |
| How styles go with motion, modes, material and each other | `pairings.md` |
| The 41 design references by what they express, and what they conflict with | `motion.md` |
| Ways words and pictures relate on a screen | `relationships.md` |
| How one scene hands over to the next, in scroll and in drag | `handovers.md` |
| How drag mode behaves and what that means for design | `drag.md` |
| Designing for phones, and for phones and desktops at once | `phone.md` |
| Material: what pictures, video, type and line art can say, and how to prepare them | `images.md`, `video.md`, `type.md`, `line-art.md` |
| Colour from material, colour that moves, readability | `colour.md` |
| Numbers that hold: readability, timing, drag | `ranges.md` |

| For building | File |
|---|---|
| Elements, attributes, presets, sources, time rules, events | `framework.md` |
| Your own drawing on the timeline (Canvas, WebGL, SVG) | `drawing.md` |
| Two languages, reloads, and ways to test scroll and drag pages | `checks.md` |

Written for cineview 2 on npm (`cv-*` custom elements). The 1.0.x versions were a different React
API; do not mix their examples in.

## How to use the references

- **They are a starting point, not a boundary.** Combine them, change them, or set them aside for
  something the user's product suggests. A page should look like its own product, not like these
  notes.
- **Every recommendation names its basis**: what in the user's product, readers or material it
  comes from.
- **Directions differ in kind.** The two or three directions you offer should differ in structure
  or mode, not only in colour or type.
- One-line examples from different fields are there to make an idea concrete. They are not
  answers to copy.

## Things that are true of the framework

These describe how Cineview and browsers behave, so they hold for any design:
- A page has one input. `<cv-stage input="drag">` makes every scene one screen, paged by the
  finger. Scroll pages mix ordinary sections, held scenes, sideways rows and covers.
- One property of one element follows one progress source. Two effects on the same property of
  the same element multiply or fight (`framework.md`).
- In a held scene (`zone`), 1 ms of timeline is 1 px of scroll, and the element that ends last
  sets the length.
- Animated text stays real text: the split copies are hidden from screen readers. Pictures and
  videos need alt text or a label to be accessible.
- Under reduced motion, entrances played on time shorten to fades of at most 200 ms and loops
  stop. Motion that follows the reader's own scroll or finger stays (`drag.md` has the details for
  drag pages).
