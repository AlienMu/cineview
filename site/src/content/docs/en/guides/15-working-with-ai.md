---
title: Working with AI
eyebrow: GUIDES / WORKING WITH AI
---

The repository has a design skill for AI assistants: `skills/cineview-design/`. With it, an assistant agrees on the page with the user before writing code.

## What the skill does

At its core is a planning conversation. The assistant asks one question at a time, each with its own recommendation and reason, and settles the page in this order:

1. Who the page is for, and what they do after reading it.
2. The one thing the reader takes away.
3. The material at hand: video, photos, screenshots, copy.
4. A direction and a number of scenes, usually 3 to 7.
5. Each scene: what it says, what the reader sees, how it scrolls, which material it uses, what is missing.
6. The look: type, palette, pace of motion.
7. Constraints: devices, languages, the date the page goes live.

Once agreed, the assistant writes a storyboard table and a material list, and starts on the page only after the user confirms them. When the user says "you decide," the assistant fills in its own recommendations and marks which ones it chose.

## What is in the skill

| File | Contents |
| --- | --- |
| `SKILL.md` | The entry point: conversation first, then references |
| `conversation.md` | How to run the planning conversation, and the storyboard format |
| `framework.md` | A quick reference for 2.0 elements, attributes, presets and rules |
| `styles.md` | 13 visual directions, each with reference values for type, palette and motion |
| `layouts.md`, `combinations.md`, `pages.md` | References for layouts, combinations and whole-page structures |
| `video.md`, `images.md`, `type.md`, `line-art.md`, `drawing.md` | Techniques by kind of material |
| `transitions.md` | Transitions with video and motion |
| `checks.md` | Checks before handing over: language switching, browser probes, reloading without a flash |

These are references and suggestions rather than fixed templates, so different pages can look different.

## How to use it

- With Claude Code and other assistants that load skills: put `skills/cineview-design` in the directory the assistant reads skills from, or link it from the project.
- With other assistants: have it read `skills/cineview-design/SKILL.md` first and open other files as needed.
- `llms.txt` at the repository root is the reading index for AI, listing the skill and the guides in `docs/ai/`.

## A first message

There is no need for a full brief up front. One sentence about the page is enough:

```text
Make a page for a motorcycle that opens with: After work, take the long way home.
```

The assistant starts by asking who the page is for. Send material at any point in the conversation; the assistant looks at it before deciding how each scene uses it.
