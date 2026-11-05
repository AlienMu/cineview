---
title: Working with AI
eyebrow: GETTING STARTED / WORKING WITH AI
---

The repository has a design skill for AI assistants: `skills/cineview-design/`. With it, an assistant agrees on the page with the user before writing code.

## What the skill does

At its core is a planning conversation. The assistant asks one question at a time, each with its own recommendation and the reason for it, and settles the page in this order:

1. Which devices the page is for: phone, desktop or both.
2. Who the page is for, and what they do after reading it.
3. The one thing the reader takes away.
4. The material at hand: video, photos, screenshots, copy.
5. The page mode: drag, which is for phones, or scroll, which works on any device. A page for both devices is one scroll page, or the same scenes paged by the finger on phones and scrolled on desktops.
6. Two or three directions, each with its number of scenes.
7. Each scene: what it says, what the reader sees, how it hands over to the next one (on a drag page, how the page changes into it), which material it uses, what is missing.
8. The look: a visual style or the brand, with colours taken from the material.
9. Constraints: languages, motion preferences, the date the page goes live.

Once agreed, the assistant writes a storyboard table and a material list. It writes no page files until the user has said yes to the storyboard in their own words, which is the skill's one strict rule. When the user says "you decide," the assistant fills in its own recommendations, marks which ones it chose, and still waits for a yes.

## What is in the skill

| File | Contents |
| --- | --- |
| `SKILL.md` | The entry point: talk before building, and a map of the files |
| `conversation.md` | How to run the planning conversation, and the storyboard format |
| `styles.md`, `pairings.md` | 16 visual styles as qualities and options, and how they go with motion, modes and material |
| `motion.md`, `relationships.md`, `handovers.md` | What the 41 references express, how words and pictures relate, how scenes hand over |
| `drag.md`, `phone.md` | Designing drag pages, for phones, and for both devices |
| `video.md`, `images.md`, `type.md`, `line-art.md`, `colour.md` | What each kind of material can say, and how to prepare it |
| `sources.md`, `ranges.md` | Questions that draw a look out of the product, and numbers that hold |
| `framework.md`, `drawing.md`, `checks.md` | Syntax for the build, custom drawing, and checks for scroll and drag pages |

These are design ideas and options with their reasons, not templates, so different pages can look different.

## How to use it

- With Claude Code and other assistants that load skills: put `skills/cineview-design` in the directory the assistant reads skills from, or link it from the project.
- With other assistants: have it read `skills/cineview-design/SKILL.md` and `conversation.md` first, and open other files as needed.
- `llms.txt` at the repository root is the reading index for AI, listing the skill and the guides in `docs/ai/`.

## A first message

There is no need for a full brief up front. One sentence about the page is enough:

```text
Make a page for a motorcycle that opens with: After work, take the long way home.
```

The assistant starts by asking which devices the page is for, with its recommendation. Send material at any point in the conversation; the assistant looks at it before deciding how each scene uses it.
