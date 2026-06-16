# Two-Mode Performance Guide

## Overview

This guide covers the authored performance example in `examples/performance-test`. The example compares two CineView modes against the same six-chapter product narrative so motion, pacing, and runtime behavior can be judged on equal content.

## Experience model

Shared story:

1. Hero
2. Highlights
3. Specs
4. Details
5. Scenarios
6. CTA

Modes under test:

- `drag`: gesture-first progression with weighted premium staging between scenes
- `scroll`: real document reading mixed with local `Scene.scroll` takeover chapters

## Running the example

```bash
cd examples/performance-test
pnpm install
pnpm dev
```

Open the hub and mode routes in the browser:

- `http://localhost:3000/#/`
- `http://localhost:3000/#/drag`
- `http://localhost:3000/#/scroll`

If port `3000` is occupied, Vite will print the actual local URL.

## Verification checklist

### 1. Routing

- The hub loads at `#/`
- Invalid hashes fall back to the hub
- Each mode route is directly addressable
- The bottom navigation can move between hub and both modes

### 2. Shared authored content

- Both modes present the same six sections
- Media comes from local assets under `public/assets`
- No generator-driven scene factory remains in the example

### 3. Mode distinction

- `drag` feels weighty and premium rather than elastic or playful
- `scroll` reads as a real document with noticeably different chapter heights and local takeover moments

### 4. Performance instrumentation

- The monitor is hidden by default
- The monitor can be toggled open and closed
- Scene index, load progress, FPS, frame time, memory, and bundle size update when available

## Automated checks

```bash
pnpm test
pnpm build
```

The local test suite currently covers:

- route parsing and fallback behavior
- hub exposure of the two curated mode links
- shared authored content shape and local asset usage

## Manual review prompts

- Does the hub clearly explain why there are two pages?
- Does each mode feel intentionally different without changing the story?
- Does the monitor stay out of the way until requested?
- Does the example feel like a real product showcase instead of a synthetic scene benchmark?

## Notes

- This example is still a performance-facing artifact, but its visual surface is now authored content rather than generated stress scenes.
- The most meaningful comparison comes from opening both routes and moving through the same chapters in sequence.
